// Shared engine types. Money is always integer paise; dates are ISO 'YYYY-MM-DD' calendar days.

declare global {
  // Node ≥ 17 and all browsers; declared so the engine needs no DOM or Node typings.
  function structuredClone<T>(value: T): T;
}

export const FACTORS = ['GR', 'DG', 'PR', 'INF', 'OIL', 'FX', 'GPR', 'CRD', 'CRY', 'LIQ'] as const;
export type FactorCode = (typeof FACTORS)[number];
/** One value per factor, in FACTORS order. */
export type FactorVector = number[];

export const REGIMES = ['CALM', 'EUPHORIA', 'STRESSED', 'CRISIS', 'RECOVERY'] as const;
export type Regime = (typeof REGIMES)[number];

export const DESKS = ['STOCKS', 'IPO', 'FUNDS', 'FIXED_INCOME', 'COMMODITIES', 'GLOBAL', 'CRYPTO', 'PREDICTION'] as const;
export type Desk = (typeof DESKS)[number];

export type Market = 'IN' | 'US' | 'CRYPTO';
export type ISODate = string;
/** STORY and FREEPLAY use the three save slots; DAILY and TIMEMACHINE are short side runs with their own wallet. */
export type CareerType = 'STORY' | 'FREEPLAY' | 'DAILY' | 'TIMEMACHINE';

/** A scripted regime from a date on (story chapters, daily challenge, time machine). Hidden from the client. */
export interface ScriptStep {
  from: ISODate;
  regime: Regime;
  /** Extra daily push on global growth, in calm-σ units (negative = selling pressure). Makes scripted falls and rallies happen, not just volatility. */
  drift?: number;
  /** Added to the central bank's policy pressure at meetings (+ = hawkish). Lets a chapter script a hiking cycle. */
  policy?: number;
  /** Extra daily factor shocks while this step is in force (war: OIL/GPR up; bank run: CRD up). */
  shocks?: Partial<Record<FactorCode, number>>;
  /** Extra daily log-return for named instruments (a fraud, a rescue, a rug pull). Price bands still apply. */
  hits?: Record<string, number>;
  /** The crypto exchange freezes withdrawals on this step's first day (story beat). */
  freezeExchange?: boolean;
}

/** Story progress, managed by the server's story content. Hidden from the client except via the story view. */
export interface StoryProgress {
  chapter: number;
  /** Checkpoint id → chosen option id. */
  answered: Record<string, string>;
  /** Checkpoint waiting for an answer (the clock is paused). */
  pending: string | null;
  /** Where this chapter started, so it is graded on its own months (absent for chapter 1 = career start). */
  start?: { date: ISODate; netWorthPaise: number; index: number; cpi?: number };
  /** The index's own peak and worst fall this chapter (to compare your drawdown with the market's). */
  indexPeak?: number;
  indexMaxDrawdown?: number;
  /** Grades of finished chapters, by chapter number. */
  grades?: Record<string, string>;
}
export type Difficulty = 'CALM' | 'REALISTIC' | 'CHAOTIC';

// ---------- Content (universe) ----------

export interface Sector {
  id: string;
  name: string;
  loadings: FactorVector;
  /** Expected annual drift, percent. */
  alphaPct: number;
  /** Annual idiosyncratic volatility, percent. */
  idioVolPct: number;
}

/** How a non-stock instrument is priced each day (market-engine.md §5.2). */
export type Pricing =
  | { kind: 'FACTOR' }
  /** Tracks an index's return, less the expense ratio. */
  | { kind: 'INDEX'; indexId: string }
  /** Price follows yield moves through duration, plus carry. */
  | { kind: 'DURATION'; duration: number; curve: 'y3' | 'y10' }
  /** A dollar stablecoin: holds $1 (in INR it moves with USD/INR). */
  | { kind: 'PEGGED' };

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  desk: Desk;
  market: Market;
  sector: string;
  /** In the quote currency's minor unit: paise for INR, cents for USD. */
  startPricePaise: number;
  /** Currency the price is quoted in. Default INR. USD prices are converted at the world's USD/INR. */
  quote?: 'INR' | 'USD';
  /** Positions are held in 1/unitScale units (funds 1000 = 3 decimals, crypto 1e6). Default 1. */
  unitScale?: number;
  pricing?: Pricing;
  /** Annual expense ratio in percent, taken out of the price daily (funds and ETFs). */
  expensePct?: number;
  /** Funds: exit load charged on units redeemed within `exitLoadDays` of purchase. */
  exitLoadPct?: number;
  exitLoadDays?: number;
  /** One-line plain-language description for the desk. */
  blurb?: string;
  /** Daily chance the team behind a coin vanishes with the money (scam coins only). */
  rugPullRisk?: number;
  /** Relative weight in the broad index (normalised by the engine). */
  indexWeight: number;
  /** Average daily traded value, paise. */
  advPaise: number;
  bandPct?: number;
  real: boolean;
}

export interface IndexDef {
  id: string;
  name: string;
  startLevel: number;
  members: string[];
}

/** A fictional company that will come to market through the IPO desk. Its instrument has desk 'IPO'. */
export interface IpoDef {
  instrumentId: string;
  /** Upper end of the price band, paise (the lower end is ~5% below). */
  bandHiPaise: number;
  lotSize: number;
  /** How much the crowd wants it: scales subscription and listing pop (1 = average). */
  hype: number;
}

export interface ContentPack {
  sectors: Record<string, Sector>;
  instruments: Instrument[];
  indices: IndexDef[];
  /** Index whose daily move drives market-wide circuit breakers. */
  breakerIndexId: string;
  /** IPO pipeline, in the order they come to market (cycles if a career outlasts it). */
  ipos: IpoDef[];
}

// ---------- Market data ----------

export interface Bar {
  date: ISODate;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  prevClose: number;
  circuit: 'UPPER' | 'LOWER' | null;
}

export interface IndexQuote {
  level: number;
  prevLevel: number;
}

// ---------- Treasury ----------

export const BUCKETS = ['available', 'blocked', 'unsettled'] as const;
export type Bucket = (typeof BUCKETS)[number];
export type Account = Bucket | 'external';
export type EntryType = 'grant' | 'reserve' | 'release' | 'buy' | 'sell' | 'charge' | 'settle' | 'fee' | 'interest' | 'maturity' | 'payout' | 'recovery';

export interface LedgerEntry {
  id: number;
  date: ISODate;
  from: Account;
  to: Account;
  amountPaise: number;
  type: EntryType;
  desk: Desk | null;
  ref: string | null;
  memo: string;
}

export interface UnsettledItem {
  ref: string;
  desk: Desk;
  amountPaise: number;
  settleDate: ISODate;
  memo: string;
}

export interface Treasury {
  available: number;
  blocked: number;
  unsettled: number;
  /** Open reservations keyed by ref (order id). Sum always equals `blocked`. */
  reservations: Record<string, number>;
  unsettledItems: UnsettledItem[];
  ledger: LedgerEntry[];
}

// ---------- Orders ----------

export type Side = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type OrderStatus = 'OPEN' | 'FILLED' | 'CANCELLED';

export interface Order {
  id: string;
  desk: Desk;
  instrumentId: string;
  side: Side;
  type: OrderType;
  qty: number;
  filledQty: number;
  limitPaise: number | null;
  triggerPaise: number | null;
  triggered: boolean;
  status: OrderStatus;
  placedDate: ISODate;
  closedDate: ISODate | null;
  cancelReason: string | null;
}

export interface ChargeBreakdown {
  brokerage: number;
  stt: number;
  exchange: number;
  regulator: number;
  stamp: number;
  gst: number;
  total: number;
}

/** A fill is also the contract note shown to the player. */
export interface Fill {
  id: string;
  orderId: string;
  date: ISODate;
  instrumentId: string;
  side: Side;
  qty: number;
  pricePaise: number;
  valuePaise: number;
  charges: ChargeBreakdown;
  /** Buy: total paid. Sell: proceeds after charges (arrives on settle date). */
  netPaise: number;
  realizedPaise: number | null;
  settleDate: ISODate | null;
}

export interface Position {
  instrumentId: string;
  /** In 1/unitScale units of the instrument. */
  qty: number;
  /** Total cost including buy charges, paise. */
  costBasisPaise: number;
  /** Copied from the instrument so net worth needs no content lookup. Default 1 / INR. */
  unitScale?: number;
  quote?: 'INR' | 'USD';
  /** USD instruments: total cost in cents, to split price P&L from currency P&L. */
  costQuote?: number;
  /** USD instruments: fees inside `costBasisPaise` (conversion, exchange fees), for the same split. */
  feesPaise?: number;
  /** Crypto: where the coins sit. Self-custody positions are keyed `${id}@SELF`. */
  custody?: 'EXCHANGE' | 'SELF';
  /** Crypto stuck on a failed exchange: value when frozen (paise). Counted at the public estimate. */
  frozenValuePaise?: number;
  /** Funds: purchase lots, oldest first, for exit loads. */
  lots?: { date: ISODate; qty: number }[];
}

// ---------- Desks beyond stocks ----------

export type IpoStatus = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'LISTED';

export interface IpoState {
  id: string;
  status: IpoStatus;
  announceDate: ISODate;
  openDate: ISODate;
  closeDate: ISODate;
  allotDate: ISODate;
  listDate: ISODate;
  bandLoPaise: number;
  bandHiPaise: number;
  lotSize: number;
  /** Retail subscription, times the shares on offer (grows each bidding day). */
  subscription: number;
  application: { ref: string; lots: number; reservedPaise: number } | null;
  /** Filled on the allotment date. */
  allottedLots: number | null;
  listingOpenPaise: number | null;
}

export interface FundOrder {
  id: string;
  fundId: string;
  side: Side;
  /** Buy: rupees to invest (reserved). */
  amountPaise: number;
  /** Sell: units to redeem. */
  units: number;
  placedDate: ISODate;
  sipId: string | null;
  status: 'PENDING' | 'DONE' | 'CANCELLED';
  /** Filled on execution. */
  navPaise: number | null;
  doneDate: ISODate | null;
  exitLoadPaise: number;
}

export interface Sip {
  id: string;
  fundId: string;
  amountPaise: number;
  /** Raise the instalment by this percent every 12 instalments. */
  stepUpPct: number;
  dayOfMonth: number;
  nextDate: ISODate;
  installments: number;
  skipped: number;
  active: boolean;
}

export interface FixedDeposit {
  id: string;
  principalPaise: number;
  ratePct: number;
  startDate: ISODate;
  maturityDate: ISODate;
  status: 'ACTIVE' | 'MATURED' | 'BROKEN';
  /** Paid out at maturity or break. */
  paidPaise: number | null;
  closedDate: ISODate | null;
}

export type ForecastKind = 'INDEX_ABOVE' | 'RATE_HIKE' | 'GOLD_HIGHER' | 'COIN_ABOVE';

/** A coins-only forecast on an in-game outcome (legal review L-09). LMSR priced (market-engine.md §8). */
export interface Forecast {
  id: string;
  kind: ForecastKind;
  question: string;
  /** The instrument/index the question is about, and the level it must beat. */
  subject: string;
  threshold: number;
  openedDate: ISODate;
  /** Last day you can trade. */
  closeDate: ISODate;
  resolveDate: ISODate;
  qYes: number;
  qNo: number;
  /** LMSR liquidity and what one winning share pays (paise), fixed when the question opens. */
  b: number;
  sharePaise: number;
  status: 'OPEN' | 'CLOSED' | 'RESOLVED';
  outcome: 'YES' | 'NO' | null;
  /** Your shares and what you paid for them in total. */
  yes: number;
  no: number;
  costPaise: number;
  payoutPaise: number;
  /** Yes-price history, one point per trading day (for the sparkline). */
  history: number[];
}

/** Contract note for an instant trade (ETFs, bonds, US stocks, crypto). */
export interface DeskFill {
  id: string;
  date: ISODate;
  desk: Desk;
  instrumentId: string;
  side: Side;
  /** In 1/unitScale units. */
  qty: number;
  /** Execution price in the quote currency (paise or cents), after the spread. */
  priceQuote: number;
  /** USD trades: the rupees-per-dollar rate used. */
  usdInr: number | null;
  valuePaise: number;
  fees: { label: string; paise: number }[];
  /** Buy: total paid. Sell: what you receive. */
  netPaise: number;
  realizedPaise: number | null;
  /** Sale proceeds arrive in Available on this date (null = instantly). */
  settleDate: ISODate | null;
}

export interface CryptoTransfer {
  id: string;
  instrumentId: string;
  qty: number;
  costBasisPaise: number;
  costQuote: number;
  arriveDate: ISODate;
}

// ---------- World + career ----------

export interface Halt {
  levelPct: number;
  date: ISODate;
  indexMovePct: number;
}

export interface WorldState {
  regime: Regime;
  factors: FactorVector;
  /** Factor shocks accumulated while a market was closed. Hidden: reveals the next open's gap. */
  pending: { IN: FactorVector; US: FactorVector };
  cpiIndex: number;
  halt: Halt | null;
  /** Rupees per US dollar. */
  usdInr: number;
  /** Central bank policy rate, percent. Changes only at policy meetings. */
  policyRate: number;
  /** Government bond yields, percent. */
  yields: { y3: number; y10: number };
  /** Last policy decision (public). */
  lastPolicy: { date: ISODate; change: number } | null;
  /** The game's crypto exchange. `resolveDate` and `recoveryPct` are hidden until it resolves. */
  exchange: { status: 'OK' | 'FROZEN' | 'RESOLVED'; since: ISODate | null; resolveDate: ISODate | null; recoveryPct: number | null };
  /** Coins whose developers ran off with the money. */
  rugged: string[];
}

export interface CareerState {
  schema: 3;
  id: string;
  slot: number;
  type: CareerType;
  difficulty: Difficulty;
  /** Hidden. Never serialised to the client. */
  seed: string;
  startDate: ISODate;
  date: ISODate;
  stateVersion: number;
  chapter: number;
  unlockedDesks: Desk[];
  world: WorldState;
  prices: Record<string, Bar>;
  indices: Record<string, IndexQuote>;
  treasury: Treasury;
  positions: Record<string, Position>;
  orders: Order[];
  fills: Fill[];
  seq: number;
  netWorthPrevPaise: number;
  netWorthPeakPaise: number;
  /** Lowest point below the running peak, as a fraction (0.12 = 12% drawdown). */
  maxDrawdown: number;
  /** Scenario / chapter regime schedule; null = engine default for the career type. Hidden. */
  script: ScriptStep[] | null;
  /** The run stops on this date (side runs, story chapters). */
  endDate: ISODate | null;
  ended: boolean;
  /** Public title of the scenario or chapter. */
  label: string | null;
  story: StoryProgress | null;
  ipos: Record<string, IpoState>;
  /** Hidden: when the next IPO is announced and which content IPO is next. */
  ipoQueue: { next: number; announceDate: ISODate };
  fundOrders: FundOrder[];
  sips: Sip[];
  fds: FixedDeposit[];
  forecasts: Forecast[];
  transfers: CryptoTransfer[];
  deskFills: DeskFill[];
  /** Where the market stood on the player's first day (careers start after two years of history). */
  baseline: { date: ISODate; indices: Record<string, number>; prices: Record<string, number> };
}

export type GameEvent =
  | { kind: 'MARKET_HALT'; date: ISODate; levelPct: number; indexMovePct: number }
  | { kind: 'ORDER_CANCELLED'; date: ISODate; orderId: string; reason: string }
  /** Desk news with a ready-made message (IPOs, SIPs, FDs, forecasts, crypto, rate decisions). */
  | { kind: 'NOTICE'; date: ISODate; level: 'INFO' | 'WATCH' | 'WARNING' | 'CRITICAL'; desk: Desk | null; message: string };
