import { describe, expect, it } from 'vitest';
import { SECTORS, STOCKS } from '@ms/content/universe';
import type { Bar } from '@ms/engine';
import { cityMood, layoutCity, towerState } from '@/components/city/cityModel';

const bar = (o: Partial<Bar>): Bar => ({ date: '2030-01-02', o: 100, h: 100, l: 100, c: 100, v: 0, prevClose: 100, circuit: null, ...o });

describe('Market City layout', () => {
  const city = layoutCity(STOCKS, SECTORS);

  it('places every stock in its own sector district', () => {
    expect(Object.keys(city.towers).sort()).toEqual(STOCKS.map((s) => s.id).sort());
    for (const s of STOCKS) {
      const t = city.towers[s.id]!;
      const d = city.districts.find((x) => x.id === s.sector)!;
      expect(d.members).toContain(s.id);
      expect(Math.abs(t.x - d.x) + t.w / 2).toBeLessThanOrEqual(d.size / 2);
      expect(Math.abs(t.z - d.z) + t.w / 2).toBeLessThanOrEqual(d.size / 2);
    }
  });

  it('never overlaps towers or districts', () => {
    const ts = Object.values(city.towers);
    for (let i = 0; i < ts.length; i++)
      for (let j = i + 1; j < ts.length; j++) {
        const a = ts[i]!, b = ts[j]!;
        const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.z - b.z) >= (a.w + b.w) / 2;
        expect(apart, `${a.id} vs ${b.id}`).toBe(true);
      }
    const ds = city.districts;
    for (let i = 0; i < ds.length; i++)
      for (let j = i + 1; j < ds.length; j++) {
        const a = ds[i]!, b = ds[j]!;
        expect(Math.abs(a.x - b.x) >= (a.size + b.size) / 2 || Math.abs(a.z - b.z) >= (a.size + b.size) / 2).toBe(true);
      }
  });

  it('puts the heaviest district nearest the centre', () => {
    const heaviest = city.districts[0]!;
    const dist = (d: { x: number; z: number }) => Math.hypot(d.x, d.z);
    expect(city.districts.every((d) => dist(d) >= dist(heaviest) - 1e-9)).toBe(true);
  });
});

describe('tower mapping', () => {
  const inst = STOCKS.find((s) => s.id === 'QUBITCS')!;
  const maxW = Math.max(...STOCKS.map((s) => s.indexWeight));

  it('grows with price and reports the day move', () => {
    const flat = towerState(inst, bar({ c: inst.startPricePaise, prevClose: inst.startPricePaise }), maxW);
    const up = towerState(inst, bar({ c: inst.startPricePaise * 1.5, prevClose: inst.startPricePaise * 1.4 }), maxW);
    expect(up.height).toBeGreaterThan(flat.height);
    expect(up.move).toBeCloseTo(1.5 / 1.4 - 1, 6);
    expect(flat.move).toBe(0);
  });

  it('lights more windows on heavy volume', () => {
    const normal = inst.advPaise / inst.startPricePaise;
    const quiet = towerState(inst, bar({ c: inst.startPricePaise, prevClose: inst.startPricePaise, v: normal }), maxW);
    const busy = towerState(inst, bar({ c: inst.startPricePaise, prevClose: inst.startPricePaise, v: normal * 3 }), maxW);
    expect(busy.lit).toBeGreaterThan(quiet.lit);
    expect(busy.lit).toBeLessThanOrEqual(1);
  });

  it('switches the lights off in a crash and further in a halt', () => {
    expect(cityMood('CRISIS', false).power).toBeLessThan(cityMood('CALM', false).power);
    expect(cityMood('CRISIS', true).power).toBeLessThan(cityMood('CRISIS', false).power);
  });
});

describe('Exchange Square', () => {
  it('sits in a free cell: no district plot overlaps the plaza, and roads run between districts', () => {
    const l = layoutCity(STOCKS, SECTORS);
    for (const d of l.districts) {
      const gap = Math.max(Math.abs(d.x - l.plaza.x), Math.abs(d.z - l.plaza.z));
      expect(gap).toBeGreaterThanOrEqual(d.size / 2 + l.plaza.size / 2 - 0.5);
    }
    for (const r of l.roads) for (const d of l.districts) expect(Math.abs((r.axis === 'z' ? d.x : d.z) - r.at)).toBeGreaterThanOrEqual(d.size / 2 - 0.01);
  });
});
