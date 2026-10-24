'use client';

// Life around the Market City: streets with traffic (busy in a boom, nearly empty in a crash), stars, a
// moon and a ring of distant towers that fade into the fog. Everything is instanced and cheap.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CityLayout } from './cityModel';

const CARS = 90;

function rand(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function Streets({ roads }: { roads: CityLayout['roads'] }) {
  return (
    <group>
      {roads.map((r, i) => {
        const len = r.to - r.from;
        const mid = (r.to + r.from) / 2;
        const pos: [number, number, number] = r.axis === 'z' ? [r.at, 0.015, mid] : [mid, 0.015, r.at];
        const rot: [number, number, number] = [-Math.PI / 2, 0, r.axis === 'z' ? 0 : Math.PI / 2];
        return (
          <group key={i}>
            <mesh position={pos} rotation={rot}>
              <planeGeometry args={[0.55, len]} />
              <meshStandardMaterial color="#0D0D10" roughness={0.5} />
            </mesh>
            <mesh position={[pos[0], 0.018, pos[2]]} rotation={rot}>
              <planeGeometry args={[0.03, len]} />
              <meshBasicMaterial color="#2A2A31" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Head- and tail-lights moving along the streets. `density` 0..1 comes from the world state. */
export function Traffic({ roads, density, reduced }: { roads: CityLayout['roads']; density: number; reduced: boolean }) {
  const heads = useRef<THREE.InstancedMesh>(null);
  const tails = useRef<THREE.InstancedMesh>(null);
  // Each car: road, lane direction, position along the road (0..1), speed. Positions advance in useFrame.
  const cars = useMemo(() => {
    const r = rand(42);
    return Array.from({ length: CARS }, () => ({ road: Math.floor(r() * roads.length), dir: r() < 0.5 ? -1 : 1, speed: 0.025 + r() * 0.035 }));
  }, [roads.length]);
  const along = useRef<Float32Array>(Float32Array.from({ length: CARS }, (_, i) => (i * 0.6180339) % 1));
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const scale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_, dt) => {
    const h = heads.current;
    const t = tails.current;
    if (!h || !t || !roads.length) return;
    const n = Math.round(CARS * Math.min(1, Math.max(0.08, density)));
    const a = along.current;
    let hi = 0;
    let ti = 0;
    for (let i = 0; i < n; i++) {
      const c = cars[i]!;
      const road = roads[c.road]!;
      if (!reduced) a[i] = (a[i]! + c.dir * c.speed * dt + 1) % 1;
      const s = road.from + (road.to - road.from) * a[i]!;
      const lane = c.dir * 0.13;
      if (road.axis === 'z') pos.set(road.at + lane, 0.08, s);
      else pos.set(s, 0.08, road.at + lane);
      q.setFromAxisAngle(up, road.axis === 'z' ? 0 : Math.PI / 2);
      m.compose(pos, q, scale);
      // Cars coming toward +axis show headlights to the camera side, the others tail-lights.
      if (c.dir > 0) h.setMatrixAt(hi++, m);
      else t.setMatrixAt(ti++, m);
    }
    h.count = hi;
    t.count = ti;
    h.instanceMatrix.needsUpdate = true;
    t.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={heads} args={[undefined, undefined, CARS]} frustumCulled={false}>
        <boxGeometry args={[0.09, 0.05, 0.22]} />
        <meshBasicMaterial color="#FFF3D6" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={tails} args={[undefined, undefined, CARS]} frustumCulled={false}>
        <boxGeometry args={[0.09, 0.05, 0.22]} />
        <meshBasicMaterial color="#FF4D4D" toneMapped={false} />
      </instancedMesh>
    </>
  );
}

export function Sky() {
  const stars = useMemo(() => {
    const r = rand(7);
    const pts = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const theta = r() * Math.PI * 2;
      const phi = Math.acos(0.15 + r() * 0.85); // upper dome only
      const R = 150;
      pts[i * 3] = R * Math.sin(phi) * Math.cos(theta);
      pts[i * 3 + 1] = R * Math.cos(phi);
      pts[i * 3 + 2] = R * Math.sin(phi) * Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return g;
  }, []);
  useEffect(() => () => stars.dispose(), [stars]);
  return (
    <>
      <points geometry={stars}>
        <pointsMaterial color="#C9D3F5" size={1.6} sizeAttenuation={false} transparent opacity={0.75} fog={false} />
      </points>
      <mesh position={[-70, 48, -95]}>
        <sphereGeometry args={[3.2, 32, 32]} />
        <meshBasicMaterial color="#EDE7D3" fog={false} toneMapped={false} />
      </mesh>
      <mesh position={[-70, 48, -95.5]}>
        <circleGeometry args={[7, 48]} />
        <meshBasicMaterial color="#EDE7D3" transparent opacity={0.06} fog={false} depthWrite={false} />
      </mesh>
    </>
  );
}

/** A far ring of anonymous towers so the city doesn't end at a cliff. */
export function DistantSkyline({ radius }: { radius: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 150;
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const r = rand(99);
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + r() * 0.03;
      const d = radius + 16 + r() * 26;
      const h = 2 + r() * r() * 16;
      const w = 1 + r() * 2.2;
      m.makeScale(w, h, w);
      m.setPosition(Math.cos(a) * d, h / 2, Math.sin(a) * d);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.set(r() < 0.25 ? '#141418' : '#0C0C0F'));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [radius]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <boxGeometry args={[1, 1, 1]} />
      {/* Night skylines read as dark silhouettes, so these stay out of the fog. */}
      <meshStandardMaterial roughness={0.9} envMapIntensity={0.04} emissive="#E8CC8E" emissiveIntensity={0.02} fog={false} />
    </instancedMesh>
  );
}
