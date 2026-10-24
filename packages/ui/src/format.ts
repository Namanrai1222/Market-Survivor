// Number formatting (techstack.md §2): international grouping, ₹ symbol, true minus sign.
const MINUS = '−';
const inr0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Paise → '₹1,000,000' (decimals 0) or '₹4,000.00' (decimals 2). */
export const formatINR = (paise: number, decimals: 0 | 2 = 2): string => {
  const s = (decimals ? inr2 : inr0).format(Math.abs(paise) / 100);
  return paise < 0 ? MINUS + s : s;
};

export const formatSignedINR = (paise: number, decimals: 0 | 2 = 2): string =>
  (paise > 0 ? '+' : '') + formatINR(paise, decimals);

/** 1 / −1 / 0 for a fraction as it will be displayed (−0.001% at 2 digits counts as 0). */
export const direction = (fraction: number, digits = 2): 1 | -1 | 0 => {
  const shown = Math.round(Math.abs(fraction * 100) * 10 ** digits);
  return shown === 0 ? 0 : fraction > 0 ? 1 : -1;
};

/** Fraction → '+1.20%' / '−0.45%' / '0.00%'. */
export const formatPct = (fraction: number, digits = 2): string => {
  const s = `${Math.abs(fraction * 100).toFixed(digits)}%`;
  const d = direction(fraction, digits);
  return d > 0 ? `+${s}` : d < 0 ? MINUS + s : s;
};

/** CSS tone for a move: 'up' / 'down' / 'flat'. */
export const tone = (fraction: number, digits = 2): 'up' | 'down' | 'flat' => {
  const d = direction(fraction, digits);
  return d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
};

/** '▲ ' / '▼ ' / '' — direction never relies on colour alone. */
export const arrow = (fraction: number, digits = 2): string => {
  const d = direction(fraction, digits);
  return d > 0 ? '▲ ' : d < 0 ? '▼ ' : '';
};

export const formatNumber = (n: number, digits = 0): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** '2030-01-01' → 'Tue 1 Jan 2030'. */
export const formatDate = (iso: string): string => dateFmt.format(new Date(`${iso}T00:00:00Z`)).replace(',', '');

/** Rupee text input → paise, or null if not a valid amount. */
export const parseRupees = (text: string): number | null => {
  const t = text.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
};

/** Cents → '$210.45', or more decimals for coins under a dollar ('$0.1834'). */
export const formatUSD = (cents: number): string => {
  const d = Math.abs(cents) / 100;
  const digits = d >= 1 ? 2 : d >= 0.01 ? 4 : 6;
  const s = `$${d.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  return cents < 0 ? MINUS + s : s;
};

/** A price in its quote currency: paise → ₹, cents → $. */
export const formatQuote = (price: number, quote: 'INR' | 'USD' = 'INR'): string => (quote === 'USD' ? formatUSD(price) : formatINR(price));

/** Units held in 1/scale steps → '12', '3.250', '0.012345'. Trailing zeros trimmed for coins. */
export const formatUnits = (qty: number, scale = 1): string => {
  if (scale === 1) return qty.toLocaleString('en-US');
  const digits = Math.round(Math.log10(scale));
  const s = (qty / scale).toLocaleString('en-US', { minimumFractionDigits: scale >= 1e6 ? 0 : digits, maximumFractionDigits: digits });
  return s;
};
