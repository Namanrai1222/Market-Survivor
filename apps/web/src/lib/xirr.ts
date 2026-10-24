// XIRR (prd.md P3-T01): the annual rate r with Σ amount / (1 + r)^(days/365) = 0, by Newton's method
// with a bisection fallback. Amounts: money in negative (you paid), money out positive (you got / hold).

export interface Flow {
  date: string;
  amount: number;
}

const years = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / (365 * 86_400_000);

export function xirr(flows: Flow[]): number | null {
  if (flows.length < 2 || !flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
  const t0 = flows[0]!.date;
  const npv = (r: number) => flows.reduce((s, f) => s + f.amount / (1 + r) ** years(t0, f.date), 0);
  const span = years(t0, flows.at(-1)!.date);
  if (span < 7 / 365) return null; // under a week, an annual rate means nothing
  let r = 0.1;
  for (let i = 0; i < 50; i++) {
    const f = npv(r);
    const d = (npv(r + 1e-6) - f) / 1e-6;
    if (!Number.isFinite(d) || d === 0) break;
    const next = r - f / d;
    if (!Number.isFinite(next) || next <= -0.999) break;
    if (Math.abs(next - r) < 1e-7) return next;
    r = next;
  }
  let lo = -0.99;
  let hi = 10;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
