// Realism checks for scripted scenarios (market-engine.md §6.5): each replay must produce the shape it
// promises on the median of several seeds. Fast enough to run on every test pass.
import { describe, expect, it } from 'vitest';
import { advance, createCareer, defaultConfig, type CareerState, type ScriptStep } from '@ms/engine';
import { BREAKER_INDEX, universe } from '@ms/content/universe';
import { TIME_MACHINE } from '@/lib/modes';
import { DAILY_PLANS, timeMachineSetup } from '@/server/scenarios';
import { storySetup } from '@/server/story';

const SEEDS = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'];

function indexPath(script: ScriptStep[], endDate: string, seed: string): [string, number][] {
  let s: CareerState = createCareer({ id: 'x', slot: 1, type: 'TIMEMACHINE', difficulty: 'REALISTIC', seed, script, endDate }, universe, defaultConfig);
  const out: [string, number][] = [];
  while (!s.ended) {
    const r = advance(s.world.halt ? { ...s, world: { ...s.world, halt: null } } : s, 30, universe, defaultConfig);
    s = r.state;
    for (const d of r.records) if (d.indices) out.push([d.date, d.indices[BREAKER_INDEX.id]!]);
  }
  return out;
}
const maxDrawdown = (path: [string, number][], from = '') => {
  let peak = 0;
  let dd = 0;
  for (const [d, l] of path) {
    if (d < from) continue;
    peak = Math.max(peak, l);
    dd = Math.max(dd, 1 - l / peak);
  }
  return dd;
};
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

describe('Time Machine replays fall the way their names say', () => {
  const ranges: Record<string, [number, number]> = {
    'TM-SUDDEN-STOP': [0.18, 0.45],
    'TM-BOOM-BUST': [0.18, 0.4],
    'TM-CREDIT-FREEZE': [0.25, 0.55],
    'TM-RATE-SHOCK': [0.08, 0.25],
    'TM-WAR-WEEKEND': [0.07, 0.22],
  };
  for (const t of TIME_MACHINE) {
    it(`${t.title}: median peak-to-trough fall within ${ranges[t.id]!.map((x) => `${x * 100}%`).join('–')}`, () => {
      const setup = timeMachineSetup(t.id)!;
      const dd = median(SEEDS.map((s) => maxDrawdown(indexPath(setup.script, setup.endDate, s))));
      expect(dd).toBeGreaterThan(ranges[t.id]![0]);
      expect(dd).toBeLessThan(ranges[t.id]![1]);
    });
  }
});

describe('Story chapter 1 and the daily shapes', () => {
  it('Chapter 1 has a mild June pullback (story.md: about 5%)', () => {
    const st = storySetup();
    const dip = median(SEEDS.map((s) => maxDrawdown(indexPath(st.script, st.endDate, s), '2030-05-25')));
    expect(dip).toBeGreaterThan(0.02);
    expect(dip).toBeLessThan(0.1);
  });

  it('the crash-shaped daily plans fall harder than the calm ones', () => {
    const toScript = (plan: (typeof DAILY_PLANS)[number]): ScriptStep[] =>
      plan.map(([day, regime, drift]) => ({ from: new Date(Date.parse('2030-01-01') + day * 864e5).toISOString().slice(0, 10), regime, ...(drift ? { drift } : {}) }));
    const dd = DAILY_PLANS.map((p) => median(SEEDS.map((s) => maxDrawdown(indexPath(toScript(p), '2030-01-22', s)))));
    expect(dd[4]!).toBeGreaterThan(dd[0]! * 2);
    expect(dd[1]!).toBeGreaterThan(dd[0]!);
  });
});
