'use client';

// Exchange Square (DESIGN.md "The Skyline Is The Market"): the bronze bull and bear from art/blender/bull_bear.py
// face off on pedestals. Whoever is winning today gets the light: a warm spot and a glowing ring for the bull
// when the index is up in a healthy market, a red one for the bear when it falls or the market is under stress.
// Behind them an LED ticker scrolls the index and the day's biggest movers.
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CareerView } from '@ms/engine';
import { BREAKER_INDEX, STOCKS } from '@ms/content/universe';

const BULL_URL = '/models/bull.glb';
const BEAR_URL = '/models/bear.glb';
useGLTF.preload(BULL_URL);
useGLTF.preload(BEAR_URL);

/** Who leads today: +1 bulls, −1 bears (index move, tilted by the regime). */
export function plazaLeader(career: CareerView): { side: 1 | -1; move: number } {
  const q = career.indices[BREAKER_INDEX.id]!;
  const move = q.prevLevel ? q.level / q.prevLevel - 1 : 0;
  const stress = career.halt || career.regime === 'CRISIS' || career.regime === 'STRESSED';
  return { side: stress ? (move > 0.01 ? 1 : -1) : move >= 0 ? 1 : -1, move };
}

/** A small image-based environment so bronze reflects something (generated locally, no network). */
export function useStudioEnv(): THREE.Texture {
  const gl = useThree((s) => s.gl);
  const [env] = useState(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return t;
  });
  useEffect(() => () => env.dispose(), [env]);
  return env;
}

function Statue({ url, color, env, position, rotationY, scale }: { url: string; color: string; env: THREE.Texture; position: [number, number, number]; rotationY: number; scale: number }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const bronze = new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.32, envMap: env, envMapIntensity: 1.1 });
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = bronze;
    });
    return clone;
  }, [scene, color, env]);
  return <primitive object={model} position={position} rotation={[0, rotationY, 0]} scale={scale} />;
}

function tickerCanvas(career: CareerView): HTMLCanvasElement {
  const q = career.indices[BREAKER_INDEX.id]!;
  const items: { text: string; color: string }[] = [{ text: `${BREAKER_INDEX.name.toUpperCase()} ${Math.round(q.level).toLocaleString('en-US')} ${q.level >= q.prevLevel ? '▲' : '▼'}${Math.abs((q.level / q.prevLevel - 1) * 100).toFixed(2)}%`, color: q.level >= q.prevLevel ? '#34C79A' : '#F2645A' }];
  const movers = STOCKS.map((s) => {
    const b = career.prices[s.id]!;
    return { s, m: b.prevClose ? b.c / b.prevClose - 1 : 0, c: b.c };
  })
    .sort((a, b) => Math.abs(b.m) - Math.abs(a.m))
    .slice(0, 10);
  for (const { s, m, c } of movers) items.push({ text: `${s.symbol} ₹${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${m >= 0 ? '▲' : '▼'}${Math.abs(m * 100).toFixed(1)}%`, color: m >= 0 ? '#34C79A' : '#F2645A' });
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#050506';
  g.fillRect(0, 0, c.width, c.height);
  g.font = '600 46px "IBM Plex Mono", ui-monospace, monospace';
  g.textBaseline = 'middle';
  let x = 24;
  for (const it of items) {
    g.fillStyle = it.color;
    g.fillText(it.text, x, 50);
    x += g.measureText(it.text).width + 30;
    g.fillStyle = '#D9B26A';
    g.fillText('◆', x, 50);
    x += 70;
    if (x > c.width) break;
  }
  return c;
}

export function Plaza({ career, plaza, reduced }: { career: CareerView; plaza: { x: number; z: number; size: number }; reduced: boolean }) {
  const env = useStudioEnv();
  const leader = plazaLeader(career);
  const bullLight = useRef<THREE.PointLight>(null);
  const bearLight = useRef<THREE.PointLight>(null);
  const bullRing = useRef<THREE.MeshStandardMaterial>(null);
  const bearRing = useRef<THREE.MeshStandardMaterial>(null);
  const screen = useRef<THREE.MeshBasicMaterial>(null);

  // A fresh ticker each trading day; the old texture is disposed. (Scrolled below through the material ref.)
  const ticker = useMemo(() => {
    const t = new THREE.CanvasTexture(tickerCanvas(career));
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(0.5, 1);
    return t;
  }, [career]);
  useEffect(() => () => ticker.dispose(), [ticker]);

  useFrame((_, dt) => {
    const k = reduced ? 1 : 1 - Math.exp(-dt * 2.5);
    const bullOn = leader.side > 0;
    const strength = Math.min(1, 0.5 + Math.abs(leader.move) * 60);
    if (bullLight.current) bullLight.current.intensity += ((bullOn ? 22 * strength : 3) - bullLight.current.intensity) * k;
    if (bearLight.current) bearLight.current.intensity += ((bullOn ? 3 : 22 * strength) - bearLight.current.intensity) * k;
    if (bullRing.current) bullRing.current.emissiveIntensity += ((bullOn ? 2.2 : 0.1) - bullRing.current.emissiveIntensity) * k;
    if (bearRing.current) bearRing.current.emissiveIntensity += ((bullOn ? 0.1 : 2.2) - bearRing.current.emissiveIntensity) * k;
    const map = screen.current?.map;
    if (map && !reduced) map.offset.x = (map.offset.x + dt * 0.035) % 1;
  });

  const { x, z } = plaza;
  const S = 0.62; // statue scale: the bull is ~2 units long in the city
  return (
    <group position={[x, 0, z]}>
      {/* stone square with a slightly polished finish */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[plaza.size / 2, plaza.size / 2 + 0.1, 0.08, 64]} />
        <meshStandardMaterial color="#1C1C21" roughness={0.35} metalness={0.2} envMap={env} envMapIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[plaza.size / 2 - 0.25, plaza.size / 2 - 0.18, 64]} />
        <meshBasicMaterial color="#D9B26A" transparent opacity={0.35} />
      </mesh>
      {/* pedestals */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.25, 0, 0.2]}>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[1.9, 0.44, 1.05]} />
            <meshStandardMaterial color="#232329" roughness={0.3} metalness={0.3} envMap={env} envMapIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.05, 1.16, 48]} />
            <meshStandardMaterial ref={side < 0 ? bullRing : bearRing} color="#050506" emissive={side < 0 ? '#D9B26A' : '#F2645A'} emissiveIntensity={0.1} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <Statue url={BULL_URL} color="#9C6630" env={env} position={[-1.62, 0.52, 0.2]} rotationY={0} scale={S} />
      <Statue url={BEAR_URL} color="#6A4528" env={env} position={[1.57, 0.52, 0.2]} rotationY={Math.PI} scale={S} />
      <pointLight ref={bullLight} position={[-1.6, 2.6, 1.6]} color="#FFC46B" intensity={10} distance={7} decay={1.6} />
      <pointLight ref={bearLight} position={[1.6, 2.6, 1.6]} color="#FF6A5A" intensity={10} distance={7} decay={1.6} />
      {/* LED ticker on two posts, behind the statues */}
      <group position={[0, 0, -1.9]}>
        {[-2.6, 2.6].map((px) => (
          <mesh key={px} position={[px, 1.2, 0]}>
            <boxGeometry args={[0.12, 2.4, 0.12]} />
            <meshStandardMaterial color="#1E1E23" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 2.25, 0]}>
          <boxGeometry args={[5.5, 0.62, 0.1]} />
          <meshStandardMaterial color="#0B0B0D" roughness={0.6} />
        </mesh>
        <mesh position={[0, 2.25, 0.056]}>
          <planeGeometry args={[5.3, 0.48]} />
          <meshBasicMaterial ref={screen} map={ticker} toneMapped={false} />
        </mesh>
      </group>
      {/* lamp posts around the square */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const r = plaza.size / 2 - 0.35;
        return (
          <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
            <mesh position={[0, 0.55, 0]}>
              <cylinderGeometry args={[0.025, 0.035, 1.1, 8]} />
              <meshStandardMaterial color="#2C2C33" />
            </mesh>
            <mesh position={[0, 1.12, 0]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshBasicMaterial color="#FFE2A8" toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
