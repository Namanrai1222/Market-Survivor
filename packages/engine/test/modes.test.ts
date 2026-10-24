// Career modes: scripted regimes, end dates, checkpoint stops, drawdown, public view (story, daily, time machine).
import { describe, expect, it } from 'vitest';
import { advance, GameError, placeOrder, scriptedRegime, testConfig, toPublicView } from '../src';
import { content, newCareer, R, step } from './fixtures';

describe('scripted regimes', () => {
  const script = [
    { from: '2030-01-01', regime: 'CALM' as const },
    { from: '2030-01-10', regime: 'CRISIS' as const },
    { from: '2030-01-20', regime: 'RECOVERY' as const },
  ];

  it('picks the last step that has started', () => {
    expect(scriptedRegime(script, '2029-12-31')).toBeNull();
    expect(scriptedRegime(script, '2030-01-05')).toBe('CALM');
    expect(scriptedRegime(script, '2030-01-10')).toBe('CRISIS');
    expect(scriptedRegime(script, '2030-02-01')).toBe('RECOVERY');
    expect(scriptedRegime(null, '2030-02-01')).toBeNull();
  });

  it('drives the world regime day by day, overriding Free Play switching', () => {
    let s = newCareer({ type: 'TIMEMACHINE', script });
    const seen: string[] = [];
    for (let i = 0; i < 25; i++) {
      s = advance(s, 1, content, testConfig).state;
      seen.push(`${s.date}:${s.world.regime}`);
    }
    expect(seen).toContain('2030-01-09:CALM');
    expect(seen).toContain('2030-01-10:CRISIS');
    expect(seen).toContain('2030-01-20:RECOVERY');
  });
});

describe('end dates', () => {
  it('stops on the end date, marks the run ended and refuses more play', () => {
    const s = newCareer({ type: 'DAILY', endDate: '2030-01-08' });
    const r = advance(s, 30, content, testConfig);
    expect(r.paused).toBe('ENDED');
    expect(r.state.date).toBe('2030-01-08');
    expect(r.state.ended).toBe(true);
    expect(() => advance(r.state, 1, content, testConfig)).toThrow(GameError);
    expect(() => placeOrder(r.state, { desk: 'STOCKS', instrumentId: 'SOFT', side: 'BUY', type: 'MARKET', qty: 1 }, content, testConfig)).toThrow(/finished/);
    expect(toPublicView(r.state)).toMatchObject({ ended: true, endDate: '2030-01-08' });
  });
});

describe('checkpoint stops', () => {
  it('stops at the requested date and refuses to move while a checkpoint is pending', () => {
    const s = newCareer({ type: 'STORY', story: { chapter: 1, answered: {}, pending: null } });
    const r = advance(s, 30, content, testConfig, { stopAt: '2030-01-15' });
    expect(r.paused).toBe('CHECKPOINT');
    expect(r.state.date).toBe('2030-01-15');
    const pending = { ...r.state, story: { chapter: 1, answered: {}, pending: 'feb-concentration' } };
    expect(() => advance(pending, 1, content, testConfig)).toThrow(/checkpoint/);
  });
});

describe('drawdown and hidden fields', () => {
  it('tracks the deepest fall below the running peak', () => {
    let s = newCareer();
    s = placeOrder(s, { desk: 'STOCKS', instrumentId: 'SOFT', side: 'BUY', type: 'MARKET', qty: 200 }, content, testConfig).state;
    s = step(s).state; // 2 Jan: fills at 4000
    s = step(s, { SOFT: { o: R(4000), h: R(4000), l: R(3600), c: R(3600) } }).state; // −10% on ₹8 lakh
    expect(s.maxDrawdown).toBeGreaterThan(0.07);
    expect(s.maxDrawdown).toBeLessThan(0.09);
  });

  it('keeps the script and story progress out of the public view', () => {
    const s = newCareer({ type: 'STORY', script: [{ from: '2030-01-01', regime: 'CALM' }], story: { chapter: 1, answered: { a: 'b' }, pending: null }, label: 'Chapter 1' });
    const text = JSON.stringify(toPublicView(s));
    expect(text).not.toMatch(/"script"|"story"|"answered"/);
    expect(toPublicView(s).label).toBe('Chapter 1');
  });
});
