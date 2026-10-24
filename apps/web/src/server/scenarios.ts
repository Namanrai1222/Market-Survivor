// Server-only regime scripts for the side modes. Kept off the client: the script is the scenario's future.
import { createHmac } from 'node:crypto';
import { addDays, type ISODate, type Regime, type ScriptStep } from '@ms/engine';
import { DAILY_DAYS, TIME_MACHINE } from '../lib/modes';

const START: ISODate = '2030-01-01';
/** [day offset, regime, daily drift in σ (negative = selling pressure)] */
type Plan = [number, Regime, number?][];
const steps = (start: ISODate, plan: Plan): ScriptStep[] => plan.map(([day, regime, drift]) => ({ from: addDays(start, day), regime, ...(drift ? { drift } : {}) }));

/** Time Machine: fictional replays shaped like past episodes (legal review L-10: no real historical prices). */
export const TM_SCRIPTS: Record<string, Plan> = {
  'TM-SUDDEN-STOP': [[0, 'CALM'], [20, 'STRESSED', -0.5], [27, 'CRISIS', -2.4], [48, 'RECOVERY', 1.3], [80, 'CALM']],
  'TM-BOOM-BUST': [[0, 'EUPHORIA', 0.35], [45, 'STRESSED', -0.4], [62, 'CRISIS', -1.7], [88, 'STRESSED', -0.3], [105, 'RECOVERY', 0.5]],
  'TM-CREDIT-FREEZE': [[0, 'STRESSED', -0.35], [40, 'CRISIS', -1.2], [70, 'STRESSED', -0.2], [85, 'CRISIS', -1.2], [110, 'RECOVERY', 0.6]],
  'TM-RATE-SHOCK': [[0, 'STRESSED', -0.35], [55, 'CALM'], [65, 'STRESSED', -0.35], [100, 'RECOVERY', 0.4]],
  'TM-WAR-WEEKEND': [[0, 'CALM'], [11, 'CRISIS', -1.8], [19, 'STRESSED', -0.3], [34, 'RECOVERY', 0.6]],
};

export function timeMachineSetup(scenarioId: string) {
  const meta = TIME_MACHINE.find((t) => t.id === scenarioId);
  const plan = TM_SCRIPTS[scenarioId];
  if (!meta || !plan) return null;
  return { script: steps(START, plan), endDate: addDays(START, meta.days), label: `Time Machine · ${meta.title}` };
}

/** Daily Challenge: a few short shapes; the date picks one, so every player gets the same market. */
export const DAILY_PLANS: Plan[] = [
  [[0, 'CALM'], [8, 'EUPHORIA', 0.3]],
  [[0, 'CALM'], [6, 'STRESSED', -0.5], [10, 'CRISIS', -1.5], [15, 'RECOVERY', 0.8]],
  [[0, 'STRESSED', -0.4], [9, 'CALM']],
  [[0, 'EUPHORIA', 0.4], [12, 'STRESSED', -0.5]],
  [[0, 'CALM'], [13, 'CRISIS', -1.5]],
];

/** Today's date in India (the challenge rolls over at midnight IST). */
export const todayIST = (now = new Date()): ISODate => new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

function dailySecret(): string {
  return process.env.MS_SEED_KEY ?? 'market-survivor-dev-daily';
}

export function dailySetup(day: ISODate) {
  const h = createHmac('sha256', dailySecret()).update(`daily|${day}`).digest();
  const plan = DAILY_PLANS[h.readUInt32BE(0) % DAILY_PLANS.length]!;
  const [, m, d] = day.split('-');
  const pretty = `${Number(d)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].at(Number(m) - 1)}`;
  return {
    // Same seed for every player on that day = the same prices for everyone.
    seed: h.toString('hex').slice(0, 32),
    script: steps(START, plan),
    endDate: addDays(START, DAILY_DAYS),
    label: `Daily Challenge · ${pretty}`,
  };
}
