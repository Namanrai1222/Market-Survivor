'use client';

// The Market City (DESIGN.md): every stock is a tower, sectors are districts.
// Footprint = index weight, height = market value, roof glow = today's move, lit windows = today's volume.
// Lazy-loaded (three.js only downloads on the World desk). Prices also live in HTML (inspector/tooltip).
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import * as THREE from 'three';
import type { CareerView, Instrument } from '@ms/engine';
import { SECTORS, STOCKS } from '@ms/content/universe';
import { arrow, formatINR, formatPct } from '@ms/ui/format';
import { cityMood, layoutCity, towerState, type CityMood, type TowerLayout } from './cityModel';
import { DistantSkyline, Sky, Streets, Traffic } from './CityLife';
import { Plaza, plazaLeader, useStudioEnv } from './Plaza';
import { Suspense } from 'react';

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;

const LAYOUT = layoutCity(STOCKS, SECTORS);
const MAX_W = Math.max(...STOCKS.map((s) => s.indexWeight));
const EASE = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)); // expo-out ≈ cubic-bezier(.16,1,.3,1)

const UP = new THREE.Color('#34C79A');
const DOWN = new THREE.Color('#F2645A');
const FLAT = new THREE.Color('#A39E94');
const CHAMPAGNE = '#D9B26A';

/** One shared window grid; each tower clones it to set its own repeat. */
let windowTex: THREE.CanvasTexture | null = null;
function windowTexture(): THREE.CanvasTexture {
  if (windowTex) return windowTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 128);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < 16; r++)
    for (let k = 0; k < 4; k++) {
      const v = rnd();
      if (v < 0.42) continue; // dark office
      const b = Math.round(150 + 105 * rnd());
      g.fillStyle = `rgb(${b},${b},${b})`;
      g.fillRect(k * 16 + 4, r * 8 + 2, 8, 4);
    }
  windowTex = new THREE.CanvasTexture(c);
  windowTex.colorSpace = THREE.SRGBColorSpace;
  windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
  windowTex.anisotropy = 4;
  return windowTex;
}

// Shared outline geometries (built once, never per render).
const TOWER_EDGES = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.01, 1.04));
const PLOT_EDGES = new Map(LAYOUT.districts.map((d) => [d.id, new THREE.EdgesGeometry(new THREE.PlaneGeometry(d.size, d.size).rotateX(-Math.PI / 2))]));
const DISTRICT_OF = new Map(LAYOUT.districts.flatMap((d) => d.members.map((id) => [id, d.id] as const)));
/** Districts always labelled (the heaviest); the rest appear when one of their towers is in focus. */
const ALWAYS_LABELLED = new Set(LAYOUT.districts.slice(0, 8).map((d) => d.id));

const moveColor = (move: number) => (Math.abs(move) < 0.0005 ? FLAT : move > 0 ? UP : DOWN);

interface TowerProps {
  inst: Instrument;
  layout: TowerLayout;
  career: CareerView;
  mood: CityMood;
  selected: boolean;
  hovered: boolean;
  reduced: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

function Tower({ inst, layout, career, mood, selected, hovered, reduced, onHover, onSelect }: TowerProps) {
  const bar = career.prices[inst.id]!;
  const state = towerState(inst, bar, MAX_W);
  const group = useRef<THREE.Group>(null);
  const roofMesh = useRef<THREE.Mesh>(null);
  const sideMat = useRef<THREE.MeshStandardMaterial>(null);
  const roofMat = useRef<THREE.MeshStandardMaterial>(null);
  // Each tower repeats the shared window grid to its own height.
  const [tex] = useState(() => {
    const t = windowTexture().clone();
    t.needsUpdate = true;
    return t;
  });
  useEffect(() => () => tex.dispose(), [tex]);
  const anim = useRef({ h: state.height, from: state.height, pulse: 0, t0: -1, power: state.lit * mood.power, powerFrom: state.lit * mood.power, p0: -1 });
  const dist = Math.hypot(layout.x, layout.z);


  // A new trading day: grow/shrink to the new height and pulse by the move, rippling out from the centre.
  useEffect(() => {
    const a = anim.current;
    a.from = a.h;
    a.pulse = reduced ? 0 : Math.max(-0.22, Math.min(0.22, state.move * 9));
    a.t0 = performance.now() / 1000 + (reduced ? 0 : dist * 0.035);
  }, [career.date, reduced, state.move, dist]);

  // World state change: lights fade street by street (west → east).
  useEffect(() => {
    const a = anim.current;
    a.powerFrom = a.power;
    a.p0 = performance.now() / 1000 + (reduced ? 0 : (layout.x + LAYOUT.radius) * 0.05);
  }, [mood.power, reduced, layout.x]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const a = anim.current;
    const now = performance.now() / 1000;
    // height
    const t = a.t0 < 0 ? 1 : Math.max(0, (now - a.t0) / 1.2);
    a.h = a.from + (state.height - a.from) * (reduced ? 1 : EASE(t));
    const bump = t > 0 && t < 1 ? Math.sin(Math.PI * t) * a.pulse : 0;
    const h = Math.max(0.3, a.h * (1 + bump));
    g.scale.set(layout.w, h, layout.w);
    roofMesh.current?.position.setY(h + 0.03);
    // windows
    const target = state.lit * mood.power;
    const pt = a.p0 < 0 ? 1 : Math.max(0, Math.min(1, (now - a.p0) / 0.6));
    a.power = reduced ? target : a.powerFrom + (target - a.powerFrom) * pt;
    const side = sideMat.current;
    if (side) {
      side.emissiveIntensity = a.power * (hovered || selected ? 1.35 : 1);
      side.emissive.set(mood.windows);
      side.emissiveMap?.repeat.set(1, Math.max(1, h / 1.1));
    }
    // roof: colour and strength from today's move
    const roof = roofMat.current;
    if (roof) {
      roof.emissive.copy(moveColor(state.move));
      roof.emissiveIntensity = 0.35 + Math.min(Math.abs(state.move) * 45, 1.8);
    }
  });

  return (
    <group position={[layout.x, 0, layout.z]}>
      <group ref={group}>
        <mesh
          position={[0, 0.5, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(inst.id);
          }}
          onPointerOut={() => onHover(null)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(inst.id);
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial ref={sideMat} color="#17171B" roughness={0.32} metalness={0.6} emissive={mood.windows} emissiveMap={tex} />
        </mesh>
        {(selected || hovered) && (
          <lineSegments position={[0, 0.5, 0]}>
            <primitive object={TOWER_EDGES} attach="geometry" />
            <lineBasicMaterial color={CHAMPAGNE} />
          </lineSegments>
        )}
      </group>
      <mesh ref={roofMesh} position={[0, state.height + 0.03, 0]} scale={[layout.w * 1.04, 1, layout.w * 1.04]}>
        <boxGeometry args={[1, 0.06, 1]} />
        <meshStandardMaterial ref={roofMat} color="#0F0F12" roughness={0.4} emissive={moveColor(state.move)} />
      </mesh>
    </group>
  );
}

function districtMove(career: CareerView, members: string[]): number {
  const moves = members.map((id) => {
    const b = career.prices[id]!;
    return b.prevClose ? (b.c - b.prevClose) / b.prevClose : 0;
  });
  return moves.reduce((a, m) => a + m, 0) / moves.length;
}

function Districts({ career }: { career: CareerView }) {
  return (
    <>
      {LAYOUT.districts.map((d) => {
        const avg = districtMove(career, d.members);
        return (
          <group key={d.id} position={[d.x, 0, d.z]}>
            <mesh position={[0, 0.03, 0]}>
              <boxGeometry args={[d.size, 0.06, d.size]} />
              <meshStandardMaterial color="#16161A" roughness={0.9} />
            </mesh>
            <lineSegments position={[0, 0.07, 0]}>
              <primitive object={PLOT_EDGES.get(d.id)!} attach="geometry" />
              <lineBasicMaterial color={avg > 0.0005 ? '#1D4A40' : avg < -0.0005 ? '#4D2330' : '#2A2A31'} />
            </lineSegments>
          </group>
        );
      })}
    </>
  );
}

type Anchor = { el: HTMLElement; at: THREE.Vector3 };

/** HTML elements that follow points in the scene. `ref(key, at)` is a callback ref for the element. */
class AnchorRegistry {
  readonly items = new Map<string, Anchor>();
  ref(key: string, at: THREE.Vector3) {
    return (el: HTMLElement | null) => {
      if (el) this.items.set(key, { el, at });
      else this.items.delete(key);
    };
  }
}

/**
 * Positions plain HTML labels over the canvas each frame (no extra React roots).
 * Anchors behind the camera or outside the view are hidden.
 */
function LabelProjector({ anchors }: { anchors: AnchorRegistry }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const a of anchors.items.values()) {
      v.copy(a.at).project(camera);
      const off = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1;
      a.el.style.visibility = off ? 'hidden' : 'visible';
      if (!off) a.el.style.transform = `translate3d(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px, 0) translate(-50%, -50%)`;
    }
  });
  return null;
}

/** Lerps sky, fog and hemisphere light to the current world state. */
function Atmosphere({ mood, reduced }: { mood: CityMood; reduced: boolean }) {
  const [initial] = useState(mood);
  const bg = useRef<THREE.Color>(null);
  const fog = useRef<THREE.Fog>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const target = useMemo(() => ({ sky: new THREE.Color(mood.sky), fog: new THREE.Color(mood.fog), hemi: new THREE.Color(mood.hemi) }), [mood]);
  useFrame((_, dt) => {
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3);
    bg.current?.lerp(target.sky, k);
    fog.current?.color.lerp(target.fog, k);
    hemi.current?.color.lerp(target.hemi, k);
  });
  return (
    <>
      <color ref={bg} attach="background" args={[initial.sky]} />
      <fog ref={fog} attach="fog" args={[initial.fog, 30, 95]} />
      <hemisphereLight ref={hemi} args={[initial.hemi, '#050506', 1.1]} />
      <directionalLight position={[-20, 30, 15]} intensity={0.55} color="#CFCBD2" />
      <ambientLight intensity={0.25} />
    </>
  );
}

/** A faint studio reflection on every surface (generated locally): glass facades and wet asphalt catch light. */
function StudioReflections() {
  const env = useStudioEnv();
  return <Environment map={env} environmentIntensity={0.28} />;
}

/** Camera flight to the selected tower (expo-out, 1.2 s; any drag cancels it; reduced motion jumps). */
function Flight({ selectedId, controls, reduced, resetKey, plazaKey, home }: { selectedId: string | null; controls: React.RefObject<OrbitControlsImpl | null>; reduced: boolean; resetKey: number; plazaKey: number; home: THREE.Vector3 }) {
  const { camera } = useThree();
  const flight = useRef<{ t0: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3 } | null>(null);

  const start = (toT: THREE.Vector3, toPos: THREE.Vector3) => {
    const c = controls.current;
    if (!c) return;
    flight.current = { t0: performance.now() / 1000, fromPos: camera.position.clone(), toPos, fromT: c.target.clone(), toT };
  };

  useEffect(() => {
    if (!selectedId) return;
    const t = LAYOUT.towers[selectedId];
    const c = controls.current;
    if (!t || !c) return;
    const toT = new THREE.Vector3(t.x, 2.2, t.z);
    const dir = camera.position.clone().sub(c.target).setY(0).normalize();
    start(toT, toT.clone().add(dir.multiplyScalar(10)).setY(8));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (resetKey === 0) return;
    start(new THREE.Vector3(0, 0, 0), home.clone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Exchange Square: a low, close view of the bull and bear with the ticker behind them.
  useEffect(() => {
    if (plazaKey === 0) return;
    const p = LAYOUT.plaza;
    start(new THREE.Vector3(p.x, 1.1, p.z - 0.2), new THREE.Vector3(p.x + 1.2, 3.0, p.z + 7.5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plazaKey]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const cancel = () => (flight.current = null);
    c.addEventListener('start', cancel);
    return () => c.removeEventListener('start', cancel);
  }, [controls]);

  useFrame(() => {
    const f = flight.current;
    const c = controls.current;
    if (!f || !c) return;
    const t = reduced ? 1 : Math.min(1, (performance.now() / 1000 - f.t0) / 1.2);
    const e = EASE(t);
    camera.position.lerpVectors(f.fromPos, f.toPos, e);
    c.target.lerpVectors(f.fromT, f.toT, e);
    c.update();
    if (t >= 1) flight.current = null;
  });
  return null;
}

const HOME = new THREE.Vector3(19, 16, 24);
const PLAZA_LABEL_AT = new THREE.Vector3(LAYOUT.plaza.x, 3.3, LAYOUT.plaza.z - 1.9);
/** Portrait phones see a narrower slice: start further back so the whole city fits. */
const HOME_COMPACT = new THREE.Vector3(27, 27, 34);

export interface MarketCityProps {
  career: CareerView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  resetKey: number;
  /** Bump to fly the camera to Exchange Square. */
  plazaKey: number;
}

export default function MarketCity({ career, selectedId, onSelect, resetKey, plazaKey }: MarketCityProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [idle, setIdle] = useState(true);
  const controls = useRef<OrbitControlsImpl | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const mood = cityMood(career.regime, career.halt !== null);
  const leader = plazaLeader(career);
  const [anchors] = useState(() => new AnchorRegistry());
  const tipId = hovered && hovered !== selectedId ? hovered : null;
  const tipInst = tipId ? STOCKS.find((s) => s.id === tipId) : undefined;
  const tip = tipInst ? { inst: tipInst, bar: career.prices[tipInst.id]!, move: towerState(tipInst, career.prices[tipInst.id]!, MAX_W).move } : null;
  const tipLayout = tipId ? LAYOUT.towers[tipId] : undefined;
  const tipAt = tipLayout && tipInst ? new THREE.Vector3(tipLayout.x, towerState(tipInst, career.prices[tipInst.id]!, MAX_W).height + 0.9, tipLayout.z) : new THREE.Vector3();
  const [{ reduced, compact }] = useState(() => ({
    reduced: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    compact: typeof window !== 'undefined' && (window.matchMedia('(max-width: 640px)').matches || (navigator.hardwareConcurrency ?? 8) <= 4),
  }));

  // Pause rendering when the city is scrolled out of view.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e!.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  return (
    <div className="city-canvas" ref={host}>
      <Canvas
        flat
        frameloop={visible ? 'always' : 'never'}
        dpr={compact ? 1 : [1, 1.75]}
        gl={{ antialias: !compact, powerPreference: 'high-performance' }}
        camera={{ position: (compact ? HOME_COMPACT : HOME).toArray(), fov: 38, near: 0.5, far: 320 }}
        onPointerMissed={() => onSelect(null)}
      >
        <Atmosphere mood={mood} reduced={reduced} />
        <StudioReflections />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[160, 160]} />
          <meshStandardMaterial color="#0B0B0D" roughness={0.55} metalness={0.35} />
        </mesh>
        <gridHelper args={[120, 60, '#1C1B20', '#17171B']} position={[0, 0.01, 0]} />
        <Sky />
        <DistantSkyline radius={LAYOUT.radius} />
        <Streets roads={LAYOUT.roads} />
        <Traffic roads={LAYOUT.roads} density={mood.power} reduced={reduced} />
        <Districts career={career} />
        <Suspense fallback={null}>
          <Plaza career={career} plaza={LAYOUT.plaza} reduced={reduced} />
        </Suspense>
        {STOCKS.map((inst) => (
          <Tower
            key={inst.id}
            inst={inst}
            layout={LAYOUT.towers[inst.id]!}
            career={career}
            mood={mood}
            selected={selectedId === inst.id}
            hovered={hovered === inst.id}
            reduced={reduced}
            onHover={setHovered}
            onSelect={onSelect}
          />
        ))}
        <OrbitControls
          ref={controls}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={9}
          maxDistance={compact ? 80 : 62}
          minPolarAngle={0.35}
          maxPolarAngle={1.32}
          autoRotate={!reduced && idle && !selectedId && plazaKey === 0}
          autoRotateSpeed={0.35}
          onStart={() => setIdle(false)}
        />
        <Flight selectedId={selectedId} controls={controls} reduced={reduced} resetKey={resetKey} plazaKey={plazaKey} home={compact ? HOME_COMPACT : HOME} />
        <LabelProjector anchors={anchors} />
      </Canvas>
      <div className="city-overlay" aria-hidden="true">
        {!compact &&
          LAYOUT.districts
            .filter((d) => ALWAYS_LABELLED.has(d.id) || DISTRICT_OF.get(hovered ?? '') === d.id || DISTRICT_OF.get(selectedId ?? '') === d.id)
            .map((d) => {
              const avg = districtMove(career, d.members);
              return (
                <div key={d.id} className="district-label" ref={anchors.ref(`d:${d.id}`, new THREE.Vector3(d.x, 0.1, d.z + d.size / 2 + 0.5))}>
                  {d.name} <em className={avg > 0.0005 ? 'up' : avg < -0.0005 ? 'down' : 'flat'}>{formatPct(avg, 1)}</em>
                </div>
              );
            })}
        {!compact && (
          <div className={`plaza-label ${leader.side > 0 ? 'bull' : 'bear'}`} ref={anchors.ref('plaza', PLAZA_LABEL_AT)}>
            Exchange Square · <b>{leader.side > 0 ? 'Bulls lead' : 'Bears lead'}</b> <em className={leader.move > 0 ? 'up' : leader.move < 0 ? 'down' : 'flat'}>{formatPct(leader.move)}</em>
          </div>
        )}
        {tip && (
          <div className="city-tip" ref={anchors.ref('tip', tipAt)}>
            <b>{tip.inst.symbol}</b>
            <span>{formatINR(tip.bar.c)}</span>
            <em className={tip.move > 0 ? 'up' : tip.move < 0 ? 'down' : 'flat'}>{arrow(tip.move)}{formatPct(tip.move)}</em>
          </div>
        )}
      </div>
    </div>
  );
}
