// Macro factor model (market-engine.md §3–4). v0: correlated daily shocks, regime-scaled
// volatility, Markov regime switching in Free Play. Events arrive in Phase 2.
import { addDays, weekday } from '../calendar';
import { stream } from '../rng';
import { FACTORS, REGIMES, type CareerType, type Difficulty, type FactorCode, type FactorVector, type GameEvent, type ISODate, type Regime, type ScriptStep, type WorldState } from '../types';

/** Return contributed per unit loading per 1σ calm factor shock. Tuned so the broad index runs ~14%/yr vol in CALM. */
export const FACTOR_UNIT = 0.004;
const KAPPA = 0.01; // mean reversion of factor levels
/** Share of market-wide factor noise kept when a script drives the regime. */
const SCRIPT_NOISE = 0.5;
const BASE_INFLATION_PCT = 5;

export const REGIME_PARAMS: Record<Regime, { volMult: number; corrBoost: number; grDrift: number }> = {
  CALM: { volMult: 1.0, corrBoost: 0.0, grDrift: 0 },
  EUPHORIA: { volMult: 1.2, corrBoost: 0.05, grDrift: 0.04 },
  STRESSED: { volMult: 1.6, corrBoost: 0.15, grDrift: -0.05 },
  CRISIS: { volMult: 3.0, corrBoost: 0.35, grDrift: -0.35 },
  RECOVERY: { volMult: 1.4, corrBoost: 0.1, grDrift: 0.12 },
};

// Daily transition probabilities (Free Play). Risky transitions scale with difficulty.
const TRANSITIONS: Record<Regime, Partial<Record<Regime, number>>> = {
  CALM: { EUPHORIA: 0.002, STRESSED: 0.002 },
  EUPHORIA: { CALM: 0.004, STRESSED: 0.004 },
  STRESSED: { CALM: 0.008, CRISIS: 0.004 },
  CRISIS: { RECOVERY: 0.04 },
  RECOVERY: { CALM: 0.012, STRESSED: 0.002 },
};
const RISKY: Regime[] = ['STRESSED', 'CRISIS'];
const DIFFICULTY_RISK: Record<Difficulty, number> = { CALM: 0.5, REALISTIC: 1, CHAOTIC: 2 };

const CORRELATIONS: [FactorCode, FactorCode, number][] = [
  ['GR', 'DG', 0.3],
  ['GR', 'CRD', -0.4],
  ['GR', 'LIQ', 0.5],
  ['GR', 'GPR', -0.2],
  ['GR', 'CRY', 0.3],
  ['GR', 'FX', -0.3],
  ['OIL', 'INF', 0.3],
  ['OIL', 'FX', 0.2],
  ['OIL', 'GPR', 0.3],
  ['PR', 'INF', 0.3],
  ['CRD', 'LIQ', -0.4],
  ['DG', 'CRD', -0.2],
];

export const idx = (f: FactorCode): number => FACTORS.indexOf(f);
export const zeros = (): FactorVector => FACTORS.map(() => 0);

export function correlationMatrix(): number[][] {
  const m: number[][] = FACTORS.map((_, i) => FACTORS.map((_, j) => (i === j ? 1 : 0)));
  for (const [a, b, rho] of CORRELATIONS) {
    m[idx(a)]![idx(b)] = rho;
    m[idx(b)]![idx(a)] = rho;
  }
  return m;
}

/** Lower-triangular L with L·Lᵀ = m. Throws if m is not positive definite. */
export function cholesky(m: number[][]): number[][] {
  const n = m.length;
  const L = m.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = m[i]![j]!;
      for (let k = 0; k < j; k++) s -= L[i]![k]! * L[j]![k]!;
      if (i === j) {
        if (s <= 0) throw new Error('correlation matrix is not positive definite');
        L[i]![i] = Math.sqrt(s);
      } else L[i]![j] = s / L[j]![j]!;
    }
  }
  return L;
}

const CHOL = cholesky(correlationMatrix());

function nextRegime(current: Regime, u: number, difficulty: Difficulty): Regime {
  let acc = 0;
  for (const to of REGIMES) {
    const p = TRANSITIONS[current][to];
    if (!p) continue;
    acc += RISKY.includes(to) ? p * DIFFICULTY_RISK[difficulty] : p;
    if (u < acc) return to;
  }
  return current;
}

/** The script step in force on `date` (the last one that has started), or null. */
export function scriptedStep(script: ScriptStep[] | null, date: ISODate): ScriptStep | null {
  let r: ScriptStep | null = null;
  for (const s of script ?? []) if (s.from <= date) r = s;
  return r;
}
export const scriptedRegime = (script: ScriptStep[] | null, date: ISODate): Regime | null => scriptedStep(script, date)?.regime ?? null;

/** Policy meetings: the first Wednesday on or after the 5th of every even month. */
export function isPolicyMeeting(date: ISODate): boolean {
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  return m % 2 === 0 && weekday(date) === 3 && d >= 5 && d <= 11;
}

/** The next policy meeting strictly after `date`. */
export function nextPolicyMeeting(date: ISODate): ISODate {
  let d = addDays(date, 1);
  while (!isPolicyMeeting(d)) d = addDays(d, 1);
  return d;
}

/**
 * How hawkish the central bank feels, from inflation, growth, the rupee and the regime.
 * Above +HIKE_AT it raises rates; below −HIKE_AT it cuts. Also feeds the forecast bots.
 */
export function policyPressure(world: Pick<WorldState, 'factors' | 'regime'>): number {
  const f = world.factors;
  const regime = { CALM: 0, EUPHORIA: 0.8, STRESSED: -1.5, CRISIS: -5, RECOVERY: -0.5 }[world.regime];
  return 0.5 * f[idx('INF')]! + 0.25 * f[idx('DG')]! + 0.15 * f[idx('FX')]! + regime;
}
export const HIKE_AT = 3.5;

/** Bond yields from the policy rate plus inflation, credit and growth premia (percent). */
export function yieldsFor(policyRate: number, f: FactorVector): WorldState['yields'] {
  const inf = f[idx('INF')]!;
  const crd = f[idx('CRD')]!;
  const pr = f[idx('PR')]!;
  const dg = f[idx('DG')]!;
  const r2 = (x: number) => Math.round(Math.max(0.5, x) * 1000) / 1000;
  return { y3: r2(policyRate + 0.35 + 0.04 * inf + 0.03 * crd + 0.02 * pr), y10: r2(policyRate + 0.9 + 0.06 * inf + 0.04 * crd + 0.03 * pr + 0.02 * dg) };
}

const EXCHANGE_FAIL_PROB = 0.004;

export interface WorldStepOptions {
  /** India trades today: yields reprice only on market days. */
  inOpen: boolean;
  rateBounds: { min: number; max: number };
}

/** Advance the world one calendar day. Returns the new state, today's factor shock and world news. */
export function stepWorld(
  world: WorldState,
  date: ISODate,
  seed: string,
  type: CareerType,
  difficulty: Difficulty,
  script: ScriptStep[] | null = null,
  opts: WorldStepOptions = { inOpen: true, rateBounds: { min: 3, max: 9 } },
): { world: WorldState; shock: FactorVector; notices: GameEvent[] } {
  // A script (story chapter, daily challenge, time machine) fixes the regime; Free Play switches by Markov chain.
  const step = scriptedStep(script, date);
  const regime = step?.regime ?? (type === 'FREEPLAY' ? nextRegime(world.regime, stream(seed, 'world.regime', date).next(), difficulty) : world.regime);
  const rp = REGIME_PARAMS[regime];
  const rng = stream(seed, 'world.factors', date);
  const eps = FACTORS.map(() => rng.normal());
  // Under a script the market-wide noise is damped so the scenario's shape shows up run after run;
  // stock-specific noise (prices.ts) is untouched, so individual stocks still differ.
  const noise = step ? SCRIPT_NOISE : 1;
  const shock = CHOL.map((row) => row.reduce((s, l, k) => s + l * eps[k]!, 0) * rp.volMult * noise);
  shock[idx('GR')]! += rp.grDrift + (step?.drift ?? 0);
  for (const [f, v] of Object.entries(step?.shocks ?? {})) shock[idx(f as FactorCode)]! += v;
  const notices: GameEvent[] = [];

  // Central bank: decides at scheduled meetings from yesterday's conditions; a move is a policy-rate shock today.
  let policyRate = world.policyRate;
  let lastPolicy = world.lastPolicy;
  if (isPolicyMeeting(date)) {
    const p = policyPressure({ factors: world.factors, regime }) + (step?.policy ?? 0);
    const size = Math.abs(p) > 2 * HIKE_AT || regime === 'CRISIS' ? 0.5 : 0.25;
    const want = p > HIKE_AT ? size : p < -HIKE_AT ? -size : 0;
    const next = Math.min(opts.rateBounds.max, Math.max(opts.rateBounds.min, policyRate + want));
    const change = Math.round((next - policyRate) * 100) / 100;
    policyRate = next;
    lastPolicy = { date, change };
    shock[idx('PR')]! += change * 6; // a 0.25% hike ≈ a 1.5σ rate shock
    notices.push({
      kind: 'NOTICE',
      date,
      level: change ? 'WATCH' : 'INFO',
      desk: 'FIXED_INCOME',
      message: change > 0 ? `The central bank raised its policy rate by ${change.toFixed(2)}% to ${policyRate.toFixed(2)}%.` : change < 0 ? `The central bank cut its policy rate by ${Math.abs(change).toFixed(2)}% to ${policyRate.toFixed(2)}%.` : `The central bank held its policy rate at ${policyRate.toFixed(2)}%.`,
    });
  }

  const factors = world.factors.map((f, k) => f - KAPPA * f + shock[k]!);
  const inflation = BASE_INFLATION_PCT / 100 + factors[idx('INF')]! * 0.002;
  // Rupee drifts ~2% a year weaker, more when the FX factor (oil, risk-off) pushes it (~3–4%/yr all-in, like 2008–2024).
  const usdInr = Math.round(world.usdInr * Math.exp(0.002 * shock[idx('FX')]! + 0.02 / 365) * 10_000) / 10_000;
  const yields = opts.inOpen ? yieldsFor(policyRate, factors) : world.yields;

  // The crypto exchange can fail in a crypto bust (once per career).
  let exchange = world.exchange;
  const cr = stream(seed, 'world.crypto', `exchange|${date}`);
  const scriptedFreeze = Boolean(step?.freezeExchange && step.from === date);
  if (exchange.status === 'OK' && (scriptedFreeze || ((regime === 'CRISIS' || regime === 'STRESSED') && factors[idx('CRY')]! < -5 && cr.next() < EXCHANGE_FAIL_PROB * DIFFICULTY_RISK[difficulty]))) {
    exchange = { status: 'FROZEN', since: date, resolveDate: addDays(date, 60 + Math.floor(cr.next() * 90)), recoveryPct: Math.round((0.25 + cr.next() * 0.45) * 100) / 100 };
    notices.push({ kind: 'NOTICE', date, level: 'CRITICAL', desk: 'CRYPTO', message: 'Vaultex, the biggest crypto exchange, has frozen all withdrawals. Coins held on the exchange are stuck until administrators finish their work.' });
  } else if (exchange.status === 'FROZEN' && exchange.resolveDate && date >= exchange.resolveDate) {
    exchange = { ...exchange, status: 'RESOLVED' };
    notices.push({ kind: 'NOTICE', date, level: 'WARNING', desk: 'CRYPTO', message: `Vaultex administrators finished. Customers get back ${Math.round(exchange.recoveryPct! * 100)}% of what their frozen coins were worth, paid in rupees.` });
  }

  return {
    world: { ...world, regime, factors, cpiIndex: world.cpiIndex * (1 + inflation / 365), usdInr, policyRate, lastPolicy, yields, exchange },
    shock,
    notices,
  };
}
