// market-config: every tunable market rule (prd.md §9). Zod-validated.
// `testConfig` mirrors testcases.md §0 exactly and must never change with real-world rates.
import { z } from 'zod';

const pct = z.number().min(0).max(100);
const paise = z.number().int().nonnegative();
const days = z.number().int().nonnegative();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const perRegime = z
  .object({ CALM: z.number().nonnegative(), EUPHORIA: z.number().nonnegative(), STRESSED: z.number().nonnegative(), CRISIS: z.number().nonnegative(), RECOVERY: z.number().nonnegative() })
  .strict();

const holidayRules = z
  .object({
    /** 'MM-DD' every year. */
    fixed: z.array(z.string().regex(/^\d{2}-\d{2}$/)),
    /** e.g. { month: 11, weekday: 4, n: 4 } = 4th Thursday of November; n = -1 means last. */
    nthWeekday: z.array(z.object({ month: z.number().int().min(1).max(12), weekday: z.number().int().min(0).max(6), n: z.number().int().min(-1).max(5) }).strict()),
    dates: z.array(isoDate),
  })
  .strict();

export const MarketConfigSchema = z
  .object({
    startingTreasuryPaise: paise,
    startDate: isoDate,
    maxAdvanceDays: z.number().int().min(1).max(366),
    calendars: z.object({ IN: holidayRules, US: holidayRules }).strict(),
    stocks: z
      .object({
        tickPaise: z.number().int().positive(),
        maxOrderQty: z.number().int().positive(),
        defaultBandPct: pct,
        settlementDays: days,
        /** Ascending; the last level closes the market for the day. */
        breakersPct: z.array(pct).min(1),
        lowerCircuitMaxFillPct: pct,
      })
      .strict(),
    charges: z
      .object({ brokeragePaise: paise, sttPct: pct, exchangePct: pct, regulatorPct: pct, stampBuyPct: pct, gstPct: pct })
      .strict(),
    liquidity: z
      .object({
        spreadBps: perRegime,
        /** Slippage = min(cap, bpsPerAdvPct × order value as % of ADV) × regime multiplier. */
        slippageBpsPerAdvPct: z.number().nonnegative(),
        slippageCapBps: z.number().nonnegative(),
        slippageMult: perRegime,
      })
      .strict(),
    tax: z.object({ stcgPct: pct, ltcgPct: pct, ltcgExemptionPaise: paise, ltcgHoldingDays: days }).strict(),
    funds: z.object({ navLagDays: days, redemptionDays: days }).strict(),
    fees: z
      .object({ fxConversionPct: pct, cryptoSelfCustodyTransferPaise: paise, cryptoSelfCustodyTransferDays: days, fdEarlyBreakPenaltyPct: pct })
      .strict(),
    prediction: z.object({ sharePayoutPaise: paise, lmsrB: z.number().positive(), maxSharesPerTrade: z.number().int().positive(), openMarkets: z.number().int().min(1).max(8) }).strict(),
    world: z.object({ usdInrStart: z.number().positive(), policyRateStart: pct, policyRateMin: pct, policyRateMax: pct }).strict(),
    /** ETFs, bonds, US stocks and crypto trade instantly at the last price ± half the spread. */
    instant: z
      .object({
        brokeragePaise: paise,
        spreadBps: z.object({ COMMODITIES: z.number().nonnegative(), FIXED_INCOME: z.number().nonnegative(), GLOBAL: z.number().nonnegative(), CRYPTO: z.number().nonnegative() }).strict(),
        /** Spread multiplier per regime (crypto spreads blow out in a crash). */
        spreadMult: perRegime,
        cryptoFeePct: pct,
        /** 1% tax deducted at source on crypto sales (India). */
        cryptoTdsPct: pct,
        maxOrderValuePaise: paise,
      })
      .strict(),
    ipo: z
      .object({
        retailMaxPaise: paise,
        firstAnnounceDays: days,
        gapDaysMin: days,
        gapDaysMax: days,
        /** Trading days between announcement and opening. */
        leadDays: days,
        bidDays: z.number().int().min(1),
        /** Listing day: the price can move this far either side of the listing open. */
        listingBandPct: pct,
      })
      .strict(),
    fixedIncome: z
      .object({
        fdMinPaise: paise,
        fdTenors: z.array(z.object({ id: z.string(), label: z.string(), days: z.number().int().positive(), spreadPct: z.number() }).strict()).min(1),
      })
      .strict(),
    sip: z.object({ minPaise: paise, maxActive: z.number().int().positive() }).strict(),
    timeMachine: z.object({ maxStakePctOfNetWorth: pct, gainCapPct: pct, cooldownDays: days }).strict(),
  })
  .strict();

export type MarketConfig = z.infer<typeof MarketConfigSchema>;
export type HolidayRules = z.infer<typeof holidayRules>;

// Fixed-date holidays only. Lunar festivals (Holi, Diwali) go in `dates` per year once the
// fictional 2030s calendar is written.
const calendars: MarketConfig['calendars'] = {
  IN: { fixed: ['01-26', '05-01', '08-15', '10-02', '12-25'], nthWeekday: [], dates: [] },
  US: {
    fixed: ['01-01', '06-19', '07-04', '12-25'],
    nthWeekday: [
      { month: 1, weekday: 1, n: 3 },
      { month: 2, weekday: 1, n: 3 },
      { month: 5, weekday: 1, n: -1 },
      { month: 9, weekday: 1, n: 1 },
      { month: 11, weekday: 4, n: 4 },
    ],
    dates: [],
  },
};

const common = {
  startingTreasuryPaise: 100_000_000, // ₹1,000,000
  startDate: '2030-01-01',
  maxAdvanceDays: 30,
  calendars,
  stocks: { tickPaise: 5, maxOrderQty: 10_000, defaultBandPct: 10, settlementDays: 1, breakersPct: [10, 15, 20], lowerCircuitMaxFillPct: 20 },
  charges: { brokeragePaise: 2000, sttPct: 0.1, exchangePct: 0.003, regulatorPct: 0.0001, stampBuyPct: 0.015, gstPct: 18 },
  tax: { stcgPct: 20, ltcgPct: 12.5, ltcgExemptionPaise: 12_500_000, ltcgHoldingDays: 365 },
  funds: { navLagDays: 1, redemptionDays: 2 },
  fees: { fxConversionPct: 0.5, cryptoSelfCustodyTransferPaise: 5000, cryptoSelfCustodyTransferDays: 1, fdEarlyBreakPenaltyPct: 1 },
  prediction: { sharePayoutPaise: 10_000, lmsrB: 100, maxSharesPerTrade: 1_000, openMarkets: 4 },
  world: { usdInrStart: 90, policyRateStart: 6, policyRateMin: 3, policyRateMax: 9 },
  instant: {
    brokeragePaise: 2000,
    spreadBps: { COMMODITIES: 10, FIXED_INCOME: 8, GLOBAL: 6, CRYPTO: 20 },
    spreadMult: { CALM: 1, EUPHORIA: 1, STRESSED: 2, CRISIS: 5, RECOVERY: 1.5 },
    cryptoFeePct: 0.1,
    cryptoTdsPct: 1,
    maxOrderValuePaise: 1_000_000_000, // ₹1 crore
  },
  ipo: { retailMaxPaise: 20_000_000, firstAnnounceDays: 12, gapDaysMin: 18, gapDaysMax: 40, leadDays: 3, bidDays: 3, listingBandPct: 20 },
  fixedIncome: {
    fdMinPaise: 100_000, // ₹1,000
    fdTenors: [
      { id: '91D', label: '3 months', days: 91, spreadPct: -0.5 },
      { id: '1Y', label: '1 year', days: 365, spreadPct: 0.5 },
      { id: '3Y', label: '3 years', days: 1095, spreadPct: 0.75 },
      { id: '5Y', label: '5 years', days: 1825, spreadPct: 0.5 },
    ],
  },
  sip: { minPaise: 50_000, maxActive: 10 },
  timeMachine: { maxStakePctOfNetWorth: 10, gainCapPct: 50, cooldownDays: 7 },
};

export const testConfig: MarketConfig = MarketConfigSchema.parse({
  ...common,
  liquidity: {
    spreadBps: { CALM: 0, EUPHORIA: 0, STRESSED: 0, CRISIS: 0, RECOVERY: 0 },
    slippageBpsPerAdvPct: 5,
    slippageCapBps: 100,
    slippageMult: { CALM: 1, EUPHORIA: 1, STRESSED: 2, CRISIS: 5, RECOVERY: 1.5 },
  },
});

export const defaultConfig: MarketConfig = MarketConfigSchema.parse({
  ...common,
  // Large caps trade in 20% daily bands, so a 10% index fall can trip the market-wide breaker; small caps set their own tighter band.
  stocks: { ...common.stocks, defaultBandPct: 20 },
  liquidity: {
    spreadBps: { CALM: 3, EUPHORIA: 3, STRESSED: 6, CRISIS: 15, RECOVERY: 5 },
    slippageBpsPerAdvPct: 5,
    slippageCapBps: 100,
    slippageMult: { CALM: 1, EUPHORIA: 1, STRESSED: 2, CRISIS: 5, RECOVERY: 1.5 },
  },
});
