// Market City model (DESIGN.md "The Skyline Is The Market Rule"): pure layout + data → tower mapping.
// No three.js here so it can be unit-tested and shared with the 2D fallback.
import type { Bar, Instrument, Regime, Sector } from '@ms/engine';

export interface DistrictLayout {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Plot side length. */
  size: number;
  members: string[];
}

export interface TowerLayout {
  id: string;
  sector: string;
  x: number;
  z: number;
  /** Footprint side length: index weight. */
  w: number;
}

export interface CityLayout {
  districts: DistrictLayout[];
  towers: Record<string, TowerLayout>;
  /** Half-extent of the whole city, for camera framing. */
  radius: number;
  /** Exchange Square: the bull and bear plaza, in the grid cell no district uses. */
  plaza: { x: number; z: number; size: number };
  /** Street centre lines between district rows and columns. */
  roads: { axis: 'x' | 'z'; at: number; from: number; to: number }[];
}

const CELL = 7.2; // district grid pitch
const SLOT = 1.9; // tower grid pitch inside a district

/** Static layout from content only: heavy districts in the middle of a near-square grid, big towers first. */
export function layoutCity(instruments: Instrument[], sectors: Record<string, Sector>): CityLayout {
  const stocks = instruments.filter((i) => i.desk === 'STOCKS');
  const maxW = Math.max(...stocks.map((s) => s.indexWeight));
  const bySector = new Map<string, Instrument[]>();
  for (const s of stocks) bySector.set(s.sector, [...(bySector.get(s.sector) ?? []), s]);
  const groups = [...bySector.entries()]
    .map(([id, members]) => ({ id, members: members.sort((a, b) => b.indexWeight - a.indexWeight), weight: members.reduce((n, m) => n + m.indexWeight, 0) }))
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));

  const cols = Math.ceil(Math.sqrt(groups.length * 1.3));
  const rows = Math.ceil(groups.length / cols);
  const cells: { x: number; z: number; d: number }[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * CELL;
      const z = (r - (rows - 1) / 2) * CELL;
      cells.push({ x, z, d: Math.hypot(x, z * 1.15) });
    }
  cells.sort((a, b) => a.d - b.d || a.x - b.x || a.z - b.z);

  const districts: DistrictLayout[] = [];
  const towers: Record<string, TowerLayout> = {};
  groups.forEach((g, i) => {
    const cell = cells[i]!;
    const n = g.members.length;
    const k = Math.ceil(Math.sqrt(n));
    const size = Math.max(k * SLOT + 0.9, 3.2);
    districts.push({ id: g.id, name: sectors[g.id]?.name ?? g.id, x: cell.x, z: cell.z, size, members: g.members.map((m) => m.id) });
    g.members.forEach((m, j) => {
      const rowsInD = Math.ceil(n / k);
      const cx = (j % k) - (k - 1) / 2;
      const cz = Math.floor(j / k) - (rowsInD - 1) / 2;
      towers[m.id] = { id: m.id, sector: g.id, x: cell.x + cx * SLOT, z: cell.z + cz * SLOT, w: 0.75 + 0.75 * Math.sqrt(m.indexWeight / maxW) };
    });
  });
  // The first free cell becomes the plaza; a full grid puts it just outside, in front.
  const free = cells[groups.length] ?? { x: ((cols + 1) / 2) * CELL, z: ((rows - 1) / 2) * CELL };
  const halfX = (cols * CELL) / 2;
  const halfZ = (rows * CELL) / 2;
  const roads: CityLayout['roads'] = [];
  for (let c = 1; c < cols; c++) roads.push({ axis: 'z', at: (c - cols / 2) * CELL, from: -halfZ, to: halfZ });
  for (let r = 1; r < rows; r++) roads.push({ axis: 'x', at: (r - rows / 2) * CELL, from: -halfX, to: halfX });
  return { districts, towers, radius: (Math.max(cols, rows) * CELL) / 2, plaza: { x: free.x, z: free.z, size: CELL - 0.8 }, roads };
}

export interface TowerState {
  /** Market value since the start (weight × price / start price), mapped to world units. */
  height: number;
  /** Today's close-to-close move, fraction. */
  move: number;
  /** Today's volume vs this stock's normal day (1 = normal). */
  volRatio: number;
  /** 0..1 share of windows lit (from volume). */
  lit: number;
}

export function towerState(inst: Instrument, bar: Bar, maxWeight: number): TowerState {
  const cap = (inst.indexWeight * bar.c) / inst.startPricePaise / maxWeight;
  const move = bar.prevClose ? (bar.c - bar.prevClose) / bar.prevClose : 0;
  const normal = inst.advPaise / Math.max(bar.prevClose, 1);
  const volRatio = bar.v > 0 ? bar.v / normal : 0;
  return {
    height: 0.8 + 6.2 * Math.sqrt(Math.max(cap, 0)),
    move,
    volRatio,
    lit: bar.v > 0 ? Math.min(1, Math.max(0.15, 0.3 + (volRatio - 1) * 0.5)) : 0.35,
  };
}

/** World-state lighting (DESIGN.md "The Lights Out Rule"). */
export interface CityMood {
  sky: string;
  fog: string;
  hemi: string;
  windows: string;
  /** Multiplier on window light: crash/halt switch the city off. */
  power: number;
}

export function cityMood(regime: Regime, halted: boolean): CityMood {
  if (halted) return { sky: '#120A12', fog: '#2A0F18', hemi: '#5C1620', windows: '#E8CC8E', power: 0.12 };
  switch (regime) {
    case 'CRISIS':
      return { sky: '#120A12', fog: '#3A1220', hemi: '#5C1620', windows: '#E8CC8E', power: 0.28 };
    case 'STRESSED':
      return { sky: '#0E0B12', fog: '#2E2018', hemi: '#5A3420', windows: '#D9B26A', power: 0.7 };
    case 'RECOVERY':
      return { sky: '#0A1220', fog: '#16302C', hemi: '#2F6B5C', windows: '#E8CC8E', power: 0.85 };
    case 'EUPHORIA':
      return { sky: '#0C0C10', fog: '#1E1D22', hemi: '#57535C', windows: '#EFD9A6', power: 1.15 };
    default:
      return { sky: '#0B0B0E', fog: '#1C1B20', hemi: '#2A2A31', windows: '#E8CC8E', power: 1 };
  }
}
