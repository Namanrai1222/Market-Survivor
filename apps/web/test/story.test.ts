// Story Mode chapters 1–3 (story.md §4): progression, desk unlocks, scripted rate shock, news.
import { describe, expect, it } from 'vitest';
import { advance, checkInvariants, createCareerWithHistory, defaultConfig as cfg, type CareerState } from '@ms/engine';
import { universe } from '@ms/content/universe';
import { answerCheckpoint, arriveAtCheckpoint, nextCheckpoint, startNextChapter, storyNews, storySetup, storyView, trackIndex } from '@/server/story';

const newStory = (seed: string): CareerState =>
  createCareerWithHistory({ id: 's', slot: 1, type: 'STORY', difficulty: 'REALISTIC', seed, ...storySetup() }, universe, cfg).state;

/** Play the current chapter to its end, answering every checkpoint with `choose` (default: first choice). */
function playChapter(s: CareerState, choose: (id: string) => string | undefined = () => undefined, onDay?: (s: CareerState) => void): CareerState {
  while (!s.ended) {
    const cp = storyView(s, cfg)?.checkpoint;
    if (cp) {
      s = answerCheckpoint(s, cp.id, choose(cp.id) ?? cp.choices[0]!.id)!.state;
      continue;
    }
    const resumed = s.world.halt ? { ...s, world: { ...s.world, halt: null } } : s;
    const r = advance(resumed, 7, universe, cfg, { stopAt: nextCheckpoint(s)?.date ?? null });
    s = arriveAtCheckpoint(trackIndex(r.state, r.records)); // as the server's advance does
    onDay?.(s);
    expect(checkInvariants(s)).toEqual([]);
  }
  return s;
}

describe('Story Mode chapters 1–3', () => {
  it('each chapter unlocks its desks, restarts grading, records the grade, and stops after chapter 3', () => {
    let s = playChapter(newStory('story-a'));
    expect(s.unlockedDesks).toEqual(['STOCKS']);
    expect(Object.keys(s.ipos)).toHaveLength(0); // the pipeline waits for the IPO desk

    s = startNextChapter(s, cfg)!;
    expect(s.chapter).toBe(2);
    expect(s.ended).toBe(false);
    expect(s.unlockedDesks).toEqual(expect.arrayContaining(['STOCKS', 'IPO', 'FUNDS', 'PREDICTION']));
    expect(s.story!.grades!['1']).toMatch(/^[A-E]$/);
    expect(s.story!.start!.date).toBe('2030-06-30');
    const v2 = storyView(s, cfg)!;
    expect(v2.title).toBe("Everyone's Getting Rich");
    expect(v2.objectives.find((o) => o.primary)!.id).toBe('start-sip');
    expect(startNextChapter(s, cfg)).toBeNull(); // not finished yet

    let sawIpo = false;
    s = playChapter(s, undefined, (x) => (sawIpo ||= Object.keys(x.ipos).length > 0));
    expect(sawIpo).toBe(true);
    expect(s.date).toBe('2031-03-31');

    s = startNextChapter(s, cfg)!;
    expect(s.chapter).toBe(3);
    expect(s.unlockedDesks).toEqual(expect.arrayContaining(['FIXED_INCOME', 'COMMODITIES']));
    s = playChapter(s);
    expect(s.date).toBe('2032-03-31');

    // Chapters 4–10 to the ending.
    for (let n = 4; n <= 10; n++) {
      s = startNextChapter(s, cfg)!;
      expect(s.chapter).toBe(n);
      s = playChapter(s);
    }
    expect(s.unlockedDesks).toEqual(expect.arrayContaining(['CRYPTO', 'GLOBAL']));
    expect(s.date).toBe('2039-12-31');
    const end = storyView(s, cfg)!;
    expect(end.debrief!.nextAvailable).toBe(false);
    expect(end.debrief!.ending!.title).toMatch(/Legend|Builder|Survivor|Ruin|Sat It Out/);
    expect(Object.keys(s.story!.grades!)).toHaveLength(9);
    expect(startNextChapter(s, cfg)).toBeNull();
    // The hidden branch rolls and scripts never reach the client.
    expect(JSON.stringify(end)).not.toMatch(/"script"|"hits"|"shocks"|branch/);
  }, 60_000);

  it('chapter 3 is a real rate shock: the central bank hikes in most worlds', () => {
    const seeds = ['r1', 'r2', 'r3', 'r4', 'r5'];
    let hiked = 0;
    for (const seed of seeds) {
      let s = playChapter(newStory(seed));
      s = playChapter(startNextChapter(s, cfg)!);
      s = startNextChapter(s, cfg)!;
      const before = s.world.policyRate;
      let peak = before;
      playChapter(s, undefined, (x) => (peak = Math.max(peak, x.world.policyRate)));
      if (peak > before) hiked++;
    }
    expect(hiked).toBeGreaterThanOrEqual(4);
  });

  it('news lands as the clock passes it, and Sam remembers your advice', () => {
    let s = playChapter(newStory('story-n'));
    s = startNextChapter(s, cfg)!;
    s = playChapter(s, (id) => (id === 'ch2-sam' ? 'go' : undefined));
    s = startNextChapter(s, cfg)!;
    const from = s.date;
    const later = advance(s, 30, universe, cfg, { stopAt: nextCheckpoint(s)?.date ?? null }).state;
    const later2 = arriveAtCheckpoint(advance(later.story?.pending ? answerCheckpoint(arriveAtCheckpoint(later), 'ch3-duration', 'rates')!.state : later, 30, universe, cfg).state);
    const news = [...storyNews(later, from), ...storyNews(later2, later.date)].map((e) => (e.kind === 'NOTICE' ? e.message : ''));
    expect(news.some((m) => m.includes('rate hikes'))).toBe(true);
    const ahead = { ...later2, date: '2031-07-06' };
    expect(storyNews(ahead, '2031-07-01').map((e) => (e.kind === 'NOTICE' ? e.message : '')).join()).toMatch(/You said go for it/);
  });
});

describe('the dramatic chapters hit as written', () => {
  it('war (ch 5) and outbreak (ch 6) bring the index down hard in every world tried', () => {
    for (const seed of ['w1', 'w2', 'w3']) {
      let s = newStory(seed);
      for (let n = 1; n <= 4; n++) s = startNextChapter(playChapter(s), cfg)!;
      let worst5 = 0;
      s = playChapter(s, undefined, (x) => (worst5 = Math.max(worst5, x.story?.indexMaxDrawdown ?? 0)));
      s = startNextChapter(s, cfg)!;
      let worst6 = 0;
      playChapter(s, undefined, (x) => (worst6 = Math.max(worst6, x.story?.indexMaxDrawdown ?? 0)));
      expect(worst5).toBeGreaterThan(0.1);
      expect(worst6).toBeGreaterThan(0.15);
    }
  }, 120_000);
});
