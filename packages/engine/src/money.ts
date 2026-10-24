// Money is integer paise (₹1 = 100 paise). Rates are applied with exact integer maths.

export const toPaise = (rupees: number): number => Math.round(rupees * 100);

/** Percent (0.015 means 0.015%) → integer rate in units of 1e-7. */
export const pctToE7 = (pct: number): number => Math.round(pct * 1e5);

/** amount × rate, rounded half up. BigInt keeps it exact for any realistic amount. */
export function applyRate(amountPaise: number, rateE7: number): number {
  return Number((BigInt(amountPaise) * BigInt(rateE7) + 5_000_000n) / 10_000_000n);
}

export const roundToTick = (p: number, tick: number): number => Math.max(tick, Math.round(p / tick) * tick);
export const floorToTick = (p: number, tick: number): number => Math.max(tick, Math.floor(p / tick) * tick);
export const ceilToTick = (p: number, tick: number): number => Math.max(tick, Math.ceil(p / tick) * tick);

const INR = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
/** '₹12,400' or '₹40,071.06' — for engine error copy. */
export const inr = (paise: number): string => INR.format(paise / 100);

export const clamp =(x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
