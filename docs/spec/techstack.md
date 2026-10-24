# Tech Stack — Market Survivor

> Assumes the main games website is Next.js on Vercel. If not, keep `packages/engine`, `packages/content` and `pipeline/` unchanged and swap only the web layer.

---

## 1. Architecture

```
┌──────────────────────────── Main games website (Next.js) ─────────────────────────────┐
│  /games/market-survivor                                                               │
│   ├── World Dashboard · Desks (Stocks, IPO, Funds, Fixed Income, Commodities,         │
│   │   Global, Crypto, Prediction) · Story · Time Machine · Academy · Profile          │
│   ├── Treasury store (single client source of truth, synced across tabs)              │
│   ├── Charts: Lightweight Charts (candles) + Recharts (allocation, debrief)           │
│   └── Story runtime UI (cutscenes, checkpoints)                                       │
│                     │ HTTPS JSON (every response returns treasury + stateVersion)     │
│                     ▼                                                                 │
│  /api/ms/* route handlers                                                             │
│   ├── Career service ── World service ── Treasury service ── Desk services            │
│   └── Story service ── Alert service ── Prediction service                            │
│                     │ calls                                                           │
│                     ▼                                                                 │
│  packages/engine (pure TS, deterministic)   packages/content (story + events JSON)    │
└─────────────────────┬─────────────────────────────────────────────────────────────────┘
                      │
     ┌────────────────┼──────────────────┬──────────────────────┐
     ▼                ▼                  ▼                      ▼
 PostgreSQL        Redis (Upstash)    Object storage (R2)    Sentry · PostHog
 careers, world,   rate limits,       Time Machine datasets,
 treasury, ledger, world-day cache    calibration reports
 positions, alerts
                      ▲
                      │ offline
        ┌─────────────┴──────────────┐
        │ Python pipeline             │ licensed historical data → adjust → calibrate
        │ (pandas, numpy, scipy)      │ factor loadings, vol, correlations, event targets
        └─────────────────────────────┘
```

**Rules**
1. Server-authoritative: the server runs the engine, owns the clock, prices, fills, Treasury, branches and scores.
2. The engine is pure: `(worldState, contentPack, seedStreams, action) → (newState, events, alerts)`. No I/O inside.
3. One Treasury per Career; every desk service calls the Treasury service inside the same DB transaction.
4. Hidden data (future prices, branch outcomes, prediction true probabilities, seeds) never leaves the server.

## 2. Frontend

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + React + TypeScript | Matches main site |
| Styling | Tailwind + CSS custom properties | Dark theme tokens, crisis visual states via `data-world-state` |
| Candles | TradingView Lightweight Charts | Fast canvas candles, mobile friendly (keep required attribution) |
| Other charts | Recharts | Allocation, SIP growth, debrief lines, net worth |
| Client state | Zustand | One `useTreasury` store + `useWorld` store read by every desk |
| Server state | TanStack Query | Fetch/caching; mutations return fresh treasury → store update |
| Cross-tab sync | BroadcastChannel API | Tabs share `stateVersion`; stale tabs refetch |
| Forms | React Hook Form + Zod | Shared schemas with server |
| Motion | Framer Motion (limited) | Halt card, breaking news, allotment reveal, cutscene transitions |
| Cutscenes | Custom panel player (JSON-driven) | Portraits, dialogue, choices; skippable |
| Audio (optional) | Howler.js | Alert tones, off by default |
| Number formatting | `Intl.NumberFormat('en-US', { style: 'currency', currency: 'INR' })` | International grouping (₹1,000,000) |
| Icons | Lucide | — |

## 3. Backend

| Concern | Choice | Why |
|---|---|---|
| API | Next.js route handlers | One deploy; split to Fastify service if needed |
| DB | PostgreSQL (Neon or Supabase) | Transactions, row locks, constraints |
| ORM | Drizzle ORM | Typed schema, SQL control for `FOR UPDATE` |
| Cache / rate limit | Redis (Upstash) | Rate limiting, cached world days |
| Auth | Main site auth (Auth.js / Supabase Auth) | Single account |
| Jobs | Vercel Cron / QStash | Daily challenge, streak resets, ledger reconciliation |
| Money | Integer paise (`bigint`); crypto quantities as integer base units (e.g. 1e-8) | No float drift |
| RNG | Seeded PRNG streams (xoshiro128**) derived via `hash(seed, stream, date)` | Determinism independent of player actions |
| Validation | Zod (strict) | Shared with client |

## 4. Packages

```
apps/web/                       # Next.js app (main site)
  app/games/market-survivor/    # routes
  app/api/ms/                   # route handlers
packages/engine/
  src/
    world/        # state, regimes, factors (Cholesky), cpi, yields, fx
    assets/       # return model, loadings, bands, OHLC, volume, liquidity
    events/       # definitions, profiles, chains, branches, pre-signals
    treasury/     # buckets, operations, invariants
    desks/
      stocks/     # orders, fills, charges, settlement, circuits
      ipo/        # subscription, lottery, listing
      funds/      # NAV, SIP, step-up, exit load, XIRR
      fixedIncome/# FD, bonds, duration
      commodities/
      global/     # US calendar, FX conversion
      crypto/     # 24/7, custody, freeze
      prediction/ # LMSR, bots, lifecycle
    alerts/       # triggers, dedupe, escalation
    story/        # runtime: beats, objectives, checkpoints, scoring, endings
    scoring/      # real return, drawdown, sharpe-style, behaviour
    timeMachine/  # replay, stake settlement
    rng/          # streams
    config/       # market-config schema + defaults
packages/content/
  story/ch01..ch10/   # chapter.json, events.json, dialogue.json, checkpoints.json
  events/library/     # Free Play event templates
  academy/            # lessons + quizzes
  universe/           # symbols, sectors, loadings, fictional entities
packages/ui/          # shared components (Treasury bar, PriceTag, AlertBanner...)
pipeline/             # Python: ingest, adjust, calibrate, export
```

## 5. Database schema v2 (core)

| Table | Key columns |
|---|---|
| `players` | id, auth_user_id, display_name, age_band, xp, level |
| `careers` | id, player_id, slot (1–3), type (STORY/FREEPLAY), seed_hash, difficulty, chapter, sim_date, regime, state_version, status |
| `treasury` | career_id (PK), available_paise, blocked_paise, unsettled_paise, state_version |
| `ledger_entries` | id, career_id, bucket_from, bucket_to, amount_paise, type (buy/sell/charge/tax/fee/fx/dividend/interest/payout/reward/stake/refund/freeze), desk, ref_id, sim_date |
| `reservations` | id, career_id, amount_paise, desk, ref_id, status |
| `unsettled_items` | id, career_id, amount_paise, settle_date, ref_id |
| `positions` | id, career_id, desk, instrument_id, qty_base_units, avg_cost_paise, custody, frozen, meta_json |
| `orders` | id, career_id, desk, instrument_id, side, type, qty, limit_paise, trigger_paise, status, idempotency_key, placed_sim_date |
| `fills` | id, order_id, qty, price_paise, charges_json, sim_date |
| `ipo_applications` | id, career_id, ipo_id, lots, status, allotted_lots |
| `sip_plans` | id, career_id, fund_id, amount_paise, day, step_up_pct, active |
| `fixed_deposits` | id, career_id, principal_paise, rate_bps, start_date, maturity_date, status |
| `prediction_markets` | id, career_id, linked_event_id, question, q_yes, q_no, b, status, outcome |
| `prediction_positions` | id, market_id, career_id, side, shares, cost_paise |
| `world_days` | career_id, date, regime, factors_json, fx, cpi, policy_rate, fear_index (append-only) |
| `prices_daily` | career_id, instrument_id, date, o, h, l, c, v (append-only; generated) |
| `events_fired` | career_id, event_id, sim_time, severity |
| `branches` | career_id, branch_id, resolve_date, outcome (null until resolved) |
| `alerts` | id, career_id, level, category, ref, sim_date, read |
| `story_progress` | career_id, chapter, beat, objectives_json, checkpoint_choices_json |
| `net_worth_snapshots` | career_id, date, net_worth_paise, real_net_worth_paise, by_class_json |
| `time_machine_runs` | id, player_id, scenario_id, source_career_id, stake_paise, result_pct, settled |
| `instruments` | id, desk, symbol, name, sector, currency, real_or_fictional, band_pct, loadings_json |
| `hist_prices` | symbol, date, o, h, l, c, v (licensed, adjusted; Time Machine only) |
| `achievements`, `player_achievements`, `daily_challenges`, `audit_log` | — |

Constraints: non-negative buckets and quantities, unique `(career_id, idempotency_key)`, unique `(player_id, slot)`, `world_days` and `prices_daily` append-only (no updates, no deletes except career deletion).

## 6. API

All mutating calls require `Idempotency-Key` and `expectedVersion`; all responses include `{ treasury, netWorth, stateVersion, newAlerts[] }`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ms/careers` | Create career (slot, type, difficulty) |
| GET | `/api/ms/careers/:id` | Full state snapshot |
| POST | `/api/ms/careers/:id/advance` | Advance N days (server-capped); returns world delta, events, alerts |
| GET | `/api/ms/careers/:id/world` | Factors, regime, fear index, FX, rates (current + history to date) |
| GET | `/api/ms/careers/:id/prices?instrument=&from=` | Prices up to current sim date only |
| POST | `/api/ms/careers/:id/orders` | Place order on any desk (`desk` field) |
| DELETE | `/api/ms/careers/:id/orders/:orderId` | Cancel |
| POST | `/api/ms/careers/:id/ipo/:ipoId/apply` | Apply |
| POST | `/api/ms/careers/:id/sip` | Create/update/stop SIP |
| POST | `/api/ms/careers/:id/fd` | Book/break FD |
| POST | `/api/ms/careers/:id/crypto/custody` | Move between exchange and self-custody |
| POST | `/api/ms/careers/:id/prediction/:marketId/trade` | Buy/sell YES/NO |
| GET | `/api/ms/careers/:id/portfolio` | Positions across all desks, allocation |
| GET | `/api/ms/careers/:id/ledger` | Unified transaction feed (paginated) |
| GET | `/api/ms/careers/:id/alerts` | Alert center |
| GET | `/api/ms/careers/:id/story` | Chapter, beat, objectives, pending checkpoint |
| POST | `/api/ms/careers/:id/story/checkpoints/:cpId` | Submit choice |
| GET | `/api/ms/careers/:id/debrief/:chapter` | Chapter debrief |
| POST | `/api/ms/time-machine/runs` | Start run with stake from a career |
| POST | `/api/ms/time-machine/runs/:id/advance` · `/orders` | Play run |
| POST | `/api/ms/time-machine/runs/:id/settle` | Settle stake back to career |
| GET | `/api/ms/daily` | Today's challenge |
| GET | `/api/ms/profile` | Level, XP, achievements |

## 7. World tick pipeline (inside `advance`)

For each simulated day, in one DB transaction per call:

1. Lock `treasury` row and `careers` row; check `expectedVersion`.
2. Engine: fire scheduled events and resolve due branches → update factors → set regime.
3. Engine: generate prices for markets open that day (India, US, crypto every day).
4. Check circuit breakers → halt state (clock stops mid-day in story if configured).
5. Process desks: order fills, IPO allotments/listings, SIP buys, fund NAV orders, FD maturities, bond coupons, dividends, prediction bot trades, prediction resolutions.
6. Treasury: settle due unsettled items, apply all captures/credits/debits.
7. Story runtime: advance beats, check objectives, open checkpoints (pause if needed).
8. Alert engine → new alerts.
9. Write `world_days`, `prices_daily`, `net_worth_snapshots`, `events_fired`.
10. Increment `state_version`; commit; return delta.

Performance target: ~120 instruments × 1 day tick in < 30 ms engine time; `advance` of 7 days < 250 ms p95.

## 8. Data pipeline (Python)

| Step | Tool | Output |
|---|---|---|
| Ingest licensed historical EOD (Time Machine + calibration) | pandas | Raw OHLCV |
| Corporate actions adjustment | pandas | Adjusted series |
| Validation | pandera | Gap/spike reports |
| Calibration: sector betas to proxy factors (index, oil, USD/INR, yields, gold) | statsmodels, numpy | `loadings.json` |
| Volatility, correlation, jump parameters | numpy, scipy | `assets-params.json` |
| Event analog measurement (e.g. index drawdown in 2020) | pandas | `calibration-targets.json` |
| Export | pyarrow | Parquet to R2, seed scripts to Postgres |

Licensing: production datasets only from sources whose license allows use in a public app. Free/unofficial sources only for local prototyping. Every dataset listed in `DATA_SOURCES.md`.

## 9. Testing

| Layer | Tool |
|---|---|
| Engine unit + property tests | Vitest + fast-check |
| Calibration harness (1,000 runs/chapter) | Node script, report to R2 |
| API integration | Vitest + Dockerized Postgres |
| Concurrency | Parallel request tests against test DB |
| E2E | Playwright (desktop + mobile) |
| Visual regression | Playwright screenshots (normal + crisis states) |
| Load | k6 |
| Pipeline | pytest + pandera |

## 10. DevOps

| Concern | Choice |
|---|---|
| Repo | pnpm workspaces + Turborepo |
| CI | GitHub Actions: lint, typecheck, unit, calibration smoke (50 runs), integration, e2e on main |
| Hosting | Vercel · Neon/Supabase · Upstash · Cloudflare R2 |
| Secrets | Env vars only; secret scanning |
| Monitoring | Sentry, PostHog (funnels per chapter), Vercel Analytics |
| Feature flags | PostHog flags per desk and per chapter (ship Story Act I first) |
| Content pipeline | Story JSON validated in CI; content changes require calibration smoke pass |

## 11. Stack by phase

| Phase | Additions |
|---|---|
| P0 | Monorepo, route, tokens, Postgres + Drizzle, CI |
| P1 | Treasury service, clock, stocks desk, Zustand stores, BroadcastChannel sync |
| P2 | Factor/regime engine, event system, Lightweight Charts, pipeline v1, World Dashboard |
| P3 | All desks, LMSR, custody, unified portfolio |
| P4 | Alert engine, crisis visual states, Framer Motion moments |
| P5–P7 | Story runtime, cutscene player, content packs, calibration harness |
| P8 | Free Play scheduler, Time Machine data + replay, Daily Challenge, Academy |
| P9 | k6, visual regression, dashboards, launch |
