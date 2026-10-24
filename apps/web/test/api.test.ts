// API security tests (testcases.md §15) against the real route handlers and the dev file store.
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkInvariants, type CareerState, type CareerView } from '@ms/engine';
import * as careersRoute from '@/app/api/ms/careers/route';
import * as careerRoute from '@/app/api/ms/careers/[id]/route';
import * as advanceRoute from '@/app/api/ms/careers/[id]/advance/route';
import * as ordersRoute from '@/app/api/ms/careers/[id]/orders/route';
import * as orderRoute from '@/app/api/ms/careers/[id]/orders/[orderId]/route';
import * as historyRoute from '@/app/api/ms/careers/[id]/history/route';
import * as checkpointRoute from '@/app/api/ms/careers/[id]/checkpoint/route';
import * as actionsRoute from '@/app/api/ms/careers/[id]/actions/route';
import * as dashboardRoute from '@/app/api/ms/careers/[id]/dashboard/route';
import * as consentRoute from '@/app/api/ms/consent/route';
import * as meRoute from '@/app/api/ms/me/route';
import * as grievanceRoute from '@/app/api/ms/grievances/route';
import * as academyRoute from '@/app/api/ms/academy/route';
import { TERMS_VERSION } from '@/lib/modes';
import { LESSONS } from '@/content/academy';
import { unseal } from '@/server/seal';

let dataDir: string;
beforeAll(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'ms-api-'));
  process.env.MS_DATA_DIR = dataDir;
});
afterAll(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

interface Body {
  career: CareerView;
  stateVersion: number;
  error?: { code: string; message: string };
  result?: { order?: { id: string } };
  replayed?: boolean;
}

function req(url: string, init: { method?: string; player?: string | null; key?: string | null; body?: unknown } = {}): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (init.player) headers.set('cookie', `ms_pid=${init.player}`);
  if (init.key !== null) headers.set('idempotency-key', init.key ?? randomUUID().replaceAll('-', ''));
  return new Request(`http://localhost${url}`, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}
const ctx = <P extends Record<string, string>>(params: P) => ({ params: Promise.resolve(params) });
const read = async (res: Response) => ({ status: res.status, body: (await res.json()) as Body });

const consent = (player: string, body: Record<string, unknown> = { ageConfirmed: true, acceptTerms: true, termsVersion: TERMS_VERSION }) =>
  consentRoute.POST(req('/api/ms/consent', { method: 'POST', player, body }));

async function newCareer(player: string, slot = 1) {
  await consent(player);
  const r = await read(await careersRoute.POST(req('/api/ms/careers', { method: 'POST', player, body: { slot, type: 'FREEPLAY', difficulty: 'CALM' } })));
  expect(r.status).toBe(201);
  return r.body.career;
}
const getCareer = async (player: string | null, id: string) => read(await careerRoute.GET(req(`/api/ms/careers/${id}`, { player }), ctx({ id })));
const advance = async (player: string | null, id: string, expectedVersion: number, days = 1, key?: string) =>
  read(await advanceRoute.POST(req(`/api/ms/careers/${id}/advance`, { method: 'POST', player, key, body: { expectedVersion, days } }), ctx({ id })));
const order = async (player: string | null, id: string, body: Record<string, unknown>, key?: string) =>
  read(await ordersRoute.POST(req(`/api/ms/careers/${id}/orders`, { method: 'POST', player, key, body: { desk: 'STOCKS', type: 'MARKET', ...body } }), ctx({ id })));
const cancel = async (player: string | null, id: string, orderId: string, expectedVersion: number) =>
  read(await orderRoute.DELETE(req(`/api/ms/careers/${id}/orders/${orderId}`, { method: 'DELETE', player, body: { expectedVersion } }), ctx({ id, orderId })));

const rawState = async (player: string, id: string): Promise<CareerState> =>
  (JSON.parse(await readFile(path.join(dataDir, 'players', player, `${id}.json`), 'utf8')) as { career: CareerState }).career;
/** The saved career with its sealed seed opened. */
async function storedState(player: string, id: string): Promise<CareerState> {
  const c = await rawState(player, id);
  return { ...c, seed: unseal(c.seed) };
}

/** Advance until no open orders remain (orders fill on the next India trading day). */
async function settleOrders(player: string, id: string): Promise<CareerView> {
  let c = (await getCareer(player, id)).body.career;
  for (let i = 0; i < 6 && c.orders.some((o) => o.status === 'OPEN'); i++) c = (await advance(player, id, c.stateVersion)).body.career;
  return c;
}

describe('career lifecycle', () => {
  it('creates, lists and deletes careers in three slots (P1-T02)', async () => {
    const p = randomUUID();
    const a = await newCareer(p, 1);
    await newCareer(p, 2);
    const dup = await read(await careersRoute.POST(req('/api/ms/careers', { method: 'POST', player: p, body: { slot: 1, type: 'STORY', difficulty: 'CALM' } })));
    expect(dup.status).toBe(409);
    const list = (await (await careersRoute.GET(req('/api/ms/careers', { player: p }))).json()) as { careers: { slot: number }[] };
    expect(list.careers.map((c) => c.slot)).toEqual([1, 2]);
    expect((await careerRoute.DELETE(req(`/api/ms/careers/${a.id}`, { method: 'DELETE', player: p }), ctx({ id: a.id }))).status).toBe(200);
    expect((await getCareer(p, a.id)).status).toBe(404);
  });

  it('gives a first-time visitor an HttpOnly session cookie', async () => {
    const res = await careersRoute.GET(req('/api/ms/careers'));
    expect(res.headers.get('set-cookie')).toMatch(/^ms_pid=[0-9a-f-]{36}; Path=\/; HttpOnly; SameSite=Lax/);
  });
});

describe('security', () => {
  it('TC-SEC-01/02: another player cannot read or trade on a career', async () => {
    const owner = randomUUID();
    const other = randomUUID();
    const c = await newCareer(owner);
    expect((await getCareer(other, c.id)).status).toBe(404);
    expect((await order(other, c.id, { instrumentId: 'QUBITCS', side: 'BUY', qty: 1, expectedVersion: c.stateVersion })).status).toBe(404);
    expect((await advance(other, c.id, c.stateVersion)).status).toBe(404);
    expect((await getCareer(owner, c.id)).body.career.stateVersion).toBe(c.stateVersion);
  });

  it('TC-SEC-03: career endpoints reject requests without a session (401)', async () => {
    const c = await newCareer(randomUUID());
    expect((await getCareer(null, c.id)).status).toBe(401);
    expect((await advance(null, c.id, 1)).status).toBe(401);
    expect((await order(null, c.id, { instrumentId: 'QUBITCS', side: 'BUY', qty: 1, expectedVersion: 1 })).status).toBe(401);
    expect((await cancel(null, c.id, 'O1', 1)).status).toBe(401);
    expect((await careerRoute.DELETE(req(`/api/ms/careers/${c.id}`, { method: 'DELETE' }), ctx({ id: c.id }))).status).toBe(401);
  });

  it('rejects mutations without an Idempotency-Key', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    const res = await advanceRoute.POST(req(`/api/ms/careers/${c.id}/advance`, { method: 'POST', player: p, key: null, body: { expectedVersion: 1, days: 1 } }), ctx({ id: c.id }));
    expect(res.status).toBe(400);
  });

  it('TC-SEC-04: the same idempotency key twice has a single effect', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    const key = 'replay-key-0001';
    const first = await order(p, c.id, { instrumentId: 'QUBITCS', side: 'BUY', qty: 5, expectedVersion: c.stateVersion }, key);
    const second = await order(p, c.id, { instrumentId: 'QUBITCS', side: 'BUY', qty: 5, expectedVersion: c.stateVersion }, key);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    expect(second.body.result?.order?.id).toBe(first.body.result?.order?.id);
    const after = (await getCareer(p, c.id)).body.career;
    expect(after.orders).toHaveLength(1);
    expect(after.treasury.availablePaise).toBe(first.body.career.treasury.availablePaise);

    const d1 = await advance(p, c.id, after.stateVersion, 3, 'advance-key-01');
    const d2 = await advance(p, c.id, after.stateVersion, 3, 'advance-key-01');
    expect(d2.body.career.date).toBe(d1.body.career.date);
  });

  it('TC-SEC-05: 20 parallel buys worth 3× available never push available below zero', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    // Each order ≈ 15% of the ₹1,000,000 Treasury → 20 of them ≈ 3× available. (Careers open after two
    // years of history, so prices come from the career, not the content's start prices.)
    const px = c.prices.QUBITCS!.c;
    const qty = Math.floor(15_000_000 / px);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => order(p, c.id, { instrumentId: 'QUBITCS', side: 'BUY', type: 'LIMIT', qty, limitPaise: px, expectedVersion: c.stateVersion })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error?.code === 'STALE_STATE')).toBe(true);

    // Same pressure with fresh versions: the Treasury itself must refuse once cash runs out.
    let v = (await getCareer(p, c.id)).body.career.stateVersion;
    let accepted = 1;
    for (let i = 0; i < 19; i++) {
      const r = await order(p, c.id, { instrumentId: 'QUBITCS', side: 'BUY', type: 'LIMIT', qty, limitPaise: px, expectedVersion: v });
      if (r.status === 200) accepted++;
      else expect(r.body.error?.code).toBe('INSUFFICIENT_FUNDS');
      v = r.status === 200 ? r.body.stateVersion : v;
    }
    const s = await storedState(p, c.id);
    expect(accepted).toBe(6);
    expect(s.treasury.available).toBeGreaterThanOrEqual(0);
    expect(checkInvariants(s)).toEqual([]);
  });

  it('TC-SEC-06: 20 sells of a 10-share holding never sell more than 10', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    await order(p, c.id, { instrumentId: 'SAFFRON', side: 'BUY', qty: 10, expectedVersion: c.stateVersion });
    let career = await settleOrders(p, c.id);
    expect(career.positions.find((x) => x.instrumentId === 'SAFFRON')?.qty).toBe(10);

    const parallel = await Promise.all(Array.from({ length: 20 }, () => order(p, c.id, { instrumentId: 'SAFFRON', side: 'SELL', qty: 1, expectedVersion: career.stateVersion })));
    expect(parallel.filter((r) => r.status === 200)).toHaveLength(1);

    career = (await getCareer(p, c.id)).body.career;
    let v = career.stateVersion;
    for (let i = 0; i < 19; i++) {
      const r = await order(p, c.id, { instrumentId: 'SAFFRON', side: 'SELL', qty: 1, expectedVersion: v });
      if (r.status === 200) v = r.body.stateVersion;
      else expect(r.body.error?.code).toBe('INSUFFICIENT_QTY');
    }
    career = await settleOrders(p, c.id);
    const sold = career.fills.filter((f) => f.side === 'SELL' && f.instrumentId === 'SAFFRON').reduce((n, f) => n + f.qty, 0);
    expect(sold).toBeLessThanOrEqual(10);
    expect(career.positions.find((x) => x.instrumentId === 'SAFFRON')?.qty ?? 0).toBe(10 - sold);
    expect(checkInvariants(await storedState(p, c.id))).toEqual([]);
  });

  it('TC-SEC-07: a stale expectedVersion gets 409 with the fresh state', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    await advance(p, c.id, c.stateVersion);
    const stale = await order(p, c.id, { instrumentId: 'QUBITCS', side: 'BUY', qty: 1, expectedVersion: c.stateVersion });
    expect(stale.status).toBe(409);
    expect(stale.body.error?.code).toBe('STALE_STATE');
    expect(stale.body.career.stateVersion).toBe(c.stateVersion + 1);
  });

  it('TC-SEC-08: extra body fields (price, available, outcome) are rejected with 400', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    for (const extra of [{ price: 1 }, { available: 1e12 }, { outcome: 'YES' }]) {
      const r = await order(p, c.id, { instrumentId: 'QUBITCS', side: 'BUY', qty: 1, expectedVersion: c.stateVersion, ...extra });
      expect(r.status).toBe(400);
    }
    const r = await read(await advanceRoute.POST(req(`/api/ms/careers/${c.id}/advance`, { method: 'POST', player: p, body: { expectedVersion: 1, days: 1, date: '2031-01-01' } }), ctx({ id: c.id })));
    expect(r.status).toBe(400);
    expect((await getCareer(p, c.id)).body.career.stateVersion).toBe(c.stateVersion);
  });

  it('TC-SEC-19: malicious ids are validation errors, not lookups', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    expect((await getCareer(p, '../../etc/passwd')).status).toBe(404);
    expect((await order(p, c.id, { instrumentId: "TCS'; DROP TABLE orders;--", side: 'BUY', qty: 1, expectedVersion: c.stateVersion })).status).toBe(400);
    expect((await cancel(p, c.id, '../x', c.stateVersion)).status).toBe(400);
  });

  it('never sends the seed, pending shocks or factor levels to the client', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    const { seed } = await storedState(p, c.id);
    const responses = [
      JSON.stringify((await getCareer(p, c.id)).body),
      JSON.stringify((await advance(p, c.id, c.stateVersion, 5)).body),
      JSON.stringify(await (await careersRoute.GET(req('/api/ms/careers', { player: p }))).json()),
    ];
    for (const text of responses) {
      expect(text).not.toContain(seed);
      expect(text).not.toMatch(/"(seed|pending|factors)"/);
    }
  });
});

const history = async (player: string | null, id: string, query: string) => {
  const res = await historyRoute.GET(req(`/api/ms/careers/${id}/history?${query}`, { player }), ctx({ id }));
  return { status: res.status, body: (await res.json()) as { date: string; candles: { time: string; open: number; high: number; low: number; close: number; volume: number }[] } };
};

describe('price history', () => {
  it('returns daily candles up to the current date only, newest last (TC-SEC-09)', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    // A new career opens on two years of market history, ending on its first day.
    const before = (await history(p, c.id, 'instrumentId=QUBITCS&days=800')).body.candles;
    expect(before.length).toBeGreaterThan(450);
    expect(before.at(-1)!.time).toBe(c.date);
    const after = (await advance(p, c.id, c.stateVersion, 20)).body.career;
    const r = await history(p, c.id, 'instrumentId=QUBITCS&days=400');
    expect(r.status).toBe(200);
    expect(r.body.candles.length).toBeGreaterThan(10); // weekdays only
    expect(r.body.candles.at(-1)!.time <= after.date).toBe(true);
    expect(r.body.candles.at(-1)!.close).toBe(after.prices.QUBITCS!.c);
    const dates = r.body.candles.map((k) => k.time);
    expect([...dates].sort()).toEqual(dates);
    for (const k of r.body.candles) expect(k.low <= Math.min(k.open, k.close) && k.high >= Math.max(k.open, k.close)).toBe(true);
    expect((await history(p, c.id, 'instrumentId=QUBITCS&days=5')).body.candles).toHaveLength(5);
  });

  it('is private, validated and has no bulk mode', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    expect((await history(null, c.id, 'instrumentId=QUBITCS')).status).toBe(401);
    expect((await history(randomUUID(), c.id, 'instrumentId=QUBITCS')).status).toBe(404);
    expect((await history(p, c.id, 'instrumentId=NOPE')).status).toBe(404);
    expect((await history(p, c.id, 'instrumentId=QUBITCS&days=5000')).status).toBe(400);
    expect((await history(p, c.id, "instrumentId=TCS'--")).status).toBe(400);
    expect((await history(p, c.id, 'days=10')).status).toBe(400);
  });
});

describe('trading through the API', () => {
  it('buy → advance → fill → sell → T+1 settle keeps the Treasury consistent (TC-E2E-01 core)', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    const placed = await order(p, c.id, { instrumentId: 'PIXELWAVE', side: 'BUY', qty: 20, expectedVersion: c.stateVersion });
    expect(placed.status).toBe(200);
    expect(placed.body.career.treasury.blockedPaise).toBeGreaterThan(0);

    let career = await settleOrders(p, c.id);
    expect(career.treasury.blockedPaise).toBe(0);
    expect(career.positions.find((x) => x.instrumentId === 'PIXELWAVE')?.qty).toBe(20);

    const sell = await order(p, c.id, { instrumentId: 'PIXELWAVE', side: 'SELL', qty: 20, expectedVersion: career.stateVersion });
    expect(sell.status).toBe(200);
    career = await settleOrders(p, c.id);
    expect(career.positions.find((x) => x.instrumentId === 'PIXELWAVE')).toBeUndefined();
    expect(career.treasury.unsettledPaise).toBeGreaterThan(0);

    for (let i = 0; i < 5 && career.treasury.unsettledPaise > 0; i++) career = (await advance(p, c.id, career.stateVersion)).body.career;
    expect(career.treasury.unsettledPaise).toBe(0);
    expect(career.netWorthPaise).toBe(career.treasury.availablePaise);
    expect(checkInvariants(await storedState(p, c.id))).toEqual([]);
  });

  it('cancelling an open buy releases the blocked cash', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    const limit = Math.round((c.prices.QUBITCS!.c * 0.95) / 5) * 5;
    const placed = await order(p, c.id, { instrumentId: 'QUBITCS', side: 'BUY', type: 'LIMIT', qty: 10, limitPaise: limit, expectedVersion: c.stateVersion });
    const r = await cancel(p, c.id, placed.body.result!.order!.id, placed.body.stateVersion);
    expect(r.status).toBe(200);
    expect(r.body.career.treasury.blockedPaise).toBe(0);
    expect(r.body.career.treasury.availablePaise).toBe(c.treasury.availablePaise);
  });

  it('turns engine rule violations into readable 422 errors', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    const r = await order(p, c.id, { instrumentId: 'QUBITCS', side: 'BUY', type: 'LIMIT', qty: 1, limitPaise: Math.round((c.prices.QUBITCS!.c * 1.5) / 5) * 5, expectedVersion: c.stateVersion });
    expect(r.status).toBe(422);
    expect(r.body.error?.message).toMatch(/price band/);
  });
});

// ---------------------------------------------------------------- legal fixes, modes, player services

const create = async (player: string, body: Record<string, unknown>) =>
  read(await careersRoute.POST(req('/api/ms/careers', { method: 'POST', player, body })));
type StoryBody = Body & {
  story: { chapter: number; objectives: { id: string; met: boolean; primary: boolean }[]; checkpoint: { id: string; prompt: string; choices: { id: string }[] } | null; debrief: unknown } | null;
  run: { kind: string; dailyDate: string | null; scenarioId: string | null } | null;
  result?: { reply?: string; paused?: string };
};
const asStory = (b: Body) => b as StoryBody;

describe('consent and age gate (L-04, L-05)', () => {
  it('refuses to start or play until the player confirms 18+ and accepts the current terms', async () => {
    const p = randomUUID();
    const blocked = await create(p, { slot: 1, type: 'FREEPLAY', difficulty: 'CALM' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error?.code).toBe('CONSENT_REQUIRED');

    expect((await consent(p, { ageConfirmed: false, acceptTerms: true, termsVersion: TERMS_VERSION })).status).toBe(400);
    expect((await consent(p, { ageConfirmed: true, acceptTerms: true, termsVersion: '2020-01-01' })).status).toBe(409);
    expect((await consent(p)).status).toBe(200);

    const me = (await (await meRoute.GET(req('/api/ms/me', { player: p }))).json()) as { consent: { termsVersion: string } | null };
    expect(me.consent?.termsVersion).toBe(TERMS_VERSION);
    expect((await create(p, { slot: 1, type: 'FREEPLAY', difficulty: 'CALM' })).status).toBe(201);
  });
});

describe('fictional universe (L-01, L-02)', () => {
  it('ships no real company or NSE index names in a career', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    const text = JSON.stringify(c);
    for (const real of ['RELIANCE', 'HDFC', 'NIFTY', 'Nifty', 'Infosys', '"TCS"', 'Tata']) expect(text).not.toContain(real);
    expect(Object.keys(c.indices)).toEqual(['MS50', 'MSBANK']);
  });
});

describe('Story Mode chapter 1', () => {
  it('stops on the checkpoint date, waits for an answer, then carries on', async () => {
    const p = randomUUID();
    await consent(p);
    const made = asStory((await create(p, { slot: 1, type: 'STORY', difficulty: 'REALISTIC' })).body);
    expect(made.story?.chapter).toBe(1);
    expect(made.story?.objectives.find((o) => o.primary)?.met).toBe(false);
    expect(made.career.endDate).toBe('2030-06-30');

    let r = asStory((await advance(p, made.career.id, made.stateVersion, 30)).body);
    expect(r.career.date).toBe('2030-01-31');
    r = asStory((await advance(p, made.career.id, r.stateVersion, 30)).body);
    expect(r.career.date).toBe('2030-02-04');
    expect(r.result?.paused).toBe('CHECKPOINT');
    expect(r.story?.checkpoint?.id).toBe('ch1-concentration');

    const stuck = await advance(p, made.career.id, r.stateVersion, 1);
    expect(stuck.status).toBe(409);
    expect(stuck.body.error?.code).toBe('CHECKPOINT');

    const bad = await read(await checkpointRoute.POST(req(`/api/ms/careers/${made.career.id}/checkpoint`, { method: 'POST', player: p, body: { expectedVersion: r.stateVersion, checkpointId: 'ch1-concentration', choiceId: 'nope' } }), ctx({ id: made.career.id })));
    expect(bad.status).toBe(409);
    const ok = asStory((await read(await checkpointRoute.POST(req(`/api/ms/careers/${made.career.id}/checkpoint`, { method: 'POST', player: p, body: { expectedVersion: r.stateVersion, checkpointId: 'ch1-concentration', choiceId: 'diversify' } }), ctx({ id: made.career.id })))).body);
    expect(ok.result?.reply).toMatch(/Good/);
    expect(ok.story?.checkpoint).toBeNull();
    expect((await advance(p, made.career.id, ok.stateVersion, 1)).status).toBe(200);
  });

  it('never sends future checkpoints, replies or the regime script', async () => {
    const p = randomUUID();
    await consent(p);
    const made = (await create(p, { slot: 1, type: 'STORY', difficulty: 'REALISTIC' })).body;
    const text = JSON.stringify(made);
    expect(text).not.toMatch(/ch1-pullback|weather, not climate|"script"|"answered"|STRESSED/);
  });
});

describe('Daily Challenge and Time Machine', () => {
  it('gives one daily run per day, the same market for every player, and records the best result', async () => {
    const a = randomUUID();
    const b = randomUUID();
    await consent(a);
    await consent(b);
    const first = asStory((await create(a, { type: 'DAILY' })).body);
    const again = asStory((await create(a, { type: 'DAILY' })).body);
    expect(again.career.id).toBe(first.career.id);
    expect(first.run?.kind).toBe('DAILY');

    const runA = asStory((await advance(a, first.career.id, first.stateVersion, 10)).body);
    const otherB = asStory((await create(b, { type: 'DAILY' })).body);
    const runB = asStory((await advance(b, otherB.career.id, otherB.stateVersion, 10)).body);
    expect(runB.career.prices).toEqual(runA.career.prices); // same seed + script for everyone

    let r = runA;
    for (let i = 0; i < 3 && !r.career.ended; i++) r = asStory((await advance(a, first.career.id, r.stateVersion, 30)).body);
    expect(r.career.ended).toBe(true);
    expect((await advance(a, first.career.id, r.stateVersion, 1)).body.error?.code).toBe('ENDED');
    const me = (await (await meRoute.GET(req('/api/ms/me', { player: a }))).json()) as { progress: { dailyBest: Record<string, number> } };
    expect(Object.keys(me.progress.dailyBest)).toHaveLength(1);
  });

  it('runs one fictional replay at a time and rejects unknown scenarios', async () => {
    const p = randomUUID();
    await consent(p);
    expect((await create(p, { type: 'TIMEMACHINE', scenarioId: 'TM-NOT-REAL' })).status).toBe(404);
    const one = asStory((await create(p, { type: 'TIMEMACHINE', scenarioId: 'TM-WAR-WEEKEND' })).body);
    expect(one.career.label).toMatch(/War Weekend/);
    expect(one.career.endDate).toBe('2030-03-02');
    const two = asStory((await create(p, { type: 'TIMEMACHINE', scenarioId: 'TM-SUDDEN-STOP' })).body);
    expect((await getCareer(p, one.career.id)).status).toBe(404);
    const list = (await (await careersRoute.GET(req('/api/ms/careers', { player: p }))).json()) as { careers: unknown[]; timeMachine: { id: string } | null };
    expect(list.careers).toHaveLength(0);
    expect(list.timeMachine?.id).toBe(two.career.id);
  });
});

describe('grievances, academy and delete-my-data', () => {
  it('files a complaint with a reference, validates it and rate-limits', async () => {
    const p = randomUUID();
    const file = (body: Record<string, unknown>) => grievanceRoute.POST(req('/api/ms/grievances', { method: 'POST', player: p, body }));
    expect((await file({ category: 'bug', message: 'short' })).status).toBe(400);
    expect((await file({ category: 'bug', message: 'The chart went blank after a reload.', extra: 1 })).status).toBe(400);
    const ok = (await (await file({ category: 'privacy', message: 'Please tell me what data you hold.', email: 'me@example.com' })).json()) as { ref: string };
    expect(ok.ref).toMatch(/^MS-[0-9A-F]{8}$/);
    for (let i = 0; i < 4; i++) await file({ category: 'other', message: `Follow-up message number ${i}` });
    expect((await file({ category: 'other', message: 'One more message today' })).status).toBe(429);
  });

  it('scores lessons on the server and keeps the best attempt', async () => {
    const p = randomUUID();
    const lesson = LESSONS[0]!;
    const submit = (answers: number[]) => academyRoute.POST(req('/api/ms/academy', { method: 'POST', player: p, body: { lessonId: lesson.id, answers } }));
    expect((await submit(lesson.quiz.map((q) => q.answer))).status).toBe(403); // consent first
    await consent(p);
    const all = (await (await submit(lesson.quiz.map((q) => q.answer))).json()) as { correct: number; total: number };
    expect(all.correct).toBe(all.total);
    const worse = (await (await submit(lesson.quiz.map(() => 5))).json()) as { progress: { academy: Record<string, { correct: number }> } };
    expect(worse.progress.academy[lesson.id]?.correct).toBe(lesson.quiz.length);
    expect((await submit([0])).status).toBe(400);
  });

  it('deletes every record and ends the session', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    const res = await meRoute.DELETE(req('/api/ms/me', { method: 'DELETE', player: p }));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/ms_pid=; .*Max-Age=0/);
    expect((await getCareer(p, c.id)).status).toBe(404);
    const me = (await (await meRoute.GET(req('/api/ms/me', { player: p }))).json()) as { consent: unknown };
    expect(me.consent).toBeNull();
  });
});

describe('storage', () => {
  it('seals the seed at rest (L-13)', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    const raw = await rawState(p, c.id);
    expect(raw.seed).toMatch(/^enc:v1:/);
    expect((await storedState(p, c.id)).seed).toMatch(/^[0-9a-f]{32}$/);
  });

  it('upgrades pre-rename saves: old company ids, memos and plain seeds still load', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    await order(p, c.id, { instrumentId: 'QUBITCS', side: 'BUY', qty: 2, expectedVersion: c.stateVersion });
    await settleOrders(p, c.id);
    const file = path.join(dataDir, 'players', p, `${c.id}.json`);
    const doc = JSON.parse(await readFile(file, 'utf8')) as { career: Record<string, unknown> & CareerState };
    // Rewrite it the way a schema-1 save looked: real ids, plain seed, no mode fields.
    const legacy = JSON.parse(JSON.stringify(doc).replaceAll('QUBITCS', 'TCS').replaceAll('"MS50"', '"NIFTY50"').replaceAll('"MSBANK"', '"BANKNIFTY"')) as typeof doc;
    legacy.career.schema = 1 as never;
    legacy.career.seed = 'abcdef0123456789abcdef0123456789';
    for (const k of ['maxDrawdown', 'script', 'endDate', 'ended', 'label', 'story']) delete legacy.career[k];
    const { writeFile } = await import('node:fs/promises');
    await writeFile(file, JSON.stringify(legacy));

    const loaded = (await getCareer(p, c.id)).body.career;
    expect(loaded.positions.map((x) => x.instrumentId)).toEqual(['QUBITCS']);
    expect(Object.keys(loaded.indices)).toEqual(['MS50', 'MSBANK']);
    expect(loaded.ledger.some((e) => e.memo.includes('QUBITCS'))).toBe(true);
    expect(JSON.stringify(loaded)).not.toMatch(/\bTCS\b|NIFTY/);
    const h = await history(p, c.id, 'instrumentId=QUBITCS');
    expect(h.body.candles.length).toBeGreaterThan(0);
  });
});

const action = async (player: string | null, id: string, body: Record<string, unknown>, key?: string) =>
  read(await actionsRoute.POST(req(`/api/ms/careers/${id}/actions`, { method: 'POST', player, key, body }), ctx({ id })));

describe('desk actions endpoint', () => {
  it('trades crypto on day one, replays idempotently, and rejects unknown fields (TC-SEC-04/08)', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    const key = randomUUID().replaceAll('-', '');
    const buy = { kind: 'TRADE', expectedVersion: c.stateVersion, instrumentId: 'CSTN', side: 'BUY', qty: 10_000 };
    const r = await action(p, c.id, buy, key);
    expect(r.status).toBe(200);
    expect(r.body.career.positions.find((x) => x.instrumentId === 'CSTN')?.qty).toBe(10_000);
    const again = await action(p, c.id, buy, key);
    expect(again.body.replayed).toBe(true);
    expect(again.body.career.positions.find((x) => x.instrumentId === 'CSTN')?.qty).toBe(10_000);
    expect((await action(p, c.id, { ...buy, expectedVersion: r.body.stateVersion, sneaky: 1 })).status).toBe(400);
    expect((await action(p, c.id, { ...buy, expectedVersion: 1 })).status).toBe(409);
    expect(checkInvariants(await storedState(p, c.id))).toEqual([]);
  });

  it('desks locked in Story chapter 1 refuse actions (403) and other players get 404', async () => {
    const p = randomUUID();
    await consent(p);
    const story = (await read(await careersRoute.POST(req('/api/ms/careers', { method: 'POST', player: p, body: { slot: 1, type: 'STORY', difficulty: 'CALM' } })))).body.career;
    const r = await action(p, story.id, { kind: 'FD_BOOK', expectedVersion: story.stateVersion, tenorId: '1Y', amountPaise: 1_000_000 });
    expect(r.status).toBe(403);
    expect(r.body.error?.code).toBe('DESK_LOCKED');
    const other = randomUUID();
    await consent(other);
    expect((await action(other, story.id, { kind: 'FD_BOOK', expectedVersion: story.stateVersion, tenorId: '1Y', amountPaise: 1_000_000 })).status).toBe(404);
  });

  it('a fund order blocks cash, then fills on the next trading day', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    const r = await action(p, c.id, { kind: 'FUND_BUY', expectedVersion: c.stateVersion, fundId: 'SURV50IDX', amountPaise: 2_000_000 });
    expect(r.status).toBe(200);
    expect(r.body.career.treasury.blockedPaise).toBe(2_000_000);
    let v = r.body.career;
    for (let i = 0; i < 5 && v.fundOrders.some((o) => o.status === 'PENDING'); i++) v = (await advance(p, c.id, v.stateVersion)).body.career;
    expect(v.fundOrders[0]?.status).toBe('DONE');
    expect(v.treasury.blockedPaise).toBe(0);
    expect(v.positions.find((x) => x.instrumentId === 'SURV50IDX')!.qty).toBeGreaterThan(0);
  });
});

describe('World desk dashboard series', () => {
  it('is private, starts at day one, and carries no hidden factor levels', async () => {
    const p = randomUUID();
    const c = await newCareer(p);
    const after = (await advance(p, c.id, c.stateVersion, 10)).body.career;
    const res = await dashboardRoute.GET(req(`/api/ms/careers/${c.id}/dashboard`, { player: p }), ctx({ id: c.id }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/factors|regime|seed/);
    const d = JSON.parse(text) as { worth: { time: string }[]; index: { time: string }[]; sparks: Record<string, number[]> };
    expect(d.worth[0]!.time).toBe(c.date);
    expect(d.worth.at(-1)!.time).toBe(after.date);
    expect(d.index.length).toBeGreaterThan(400); // two years of history before day one
    expect(d.sparks.CSTN!.length).toBe(30);
    expect((await dashboardRoute.GET(req(`/api/ms/careers/${c.id}/dashboard`, { player: randomUUID() }), ctx({ id: c.id }))).status).toBe(404);
  });
});
