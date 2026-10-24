# Design — Market Survivor (Dark Theme)

## 1. Direction

**Subject:** a trading desk at night, lit by screens and a desk lamp, while the world outside changes: calm nights, tense nights, nights when the market breaks.
**Audience:** 16–28 year olds, mostly on phones.
**Primary job:** make a connected, multi-market world feel understandable and dramatic without looking like a casino.

**The one memorable thing: the world state changes the whole interface.** Calm play is quiet and disciplined. As a crisis builds, the UI shifts through **Tension → Crash → Halt → Recovery**. Everything else stays restrained so these moments land.

### Choices made against defaults
- Base is **warm obsidian graphite**, not flat black; accent is **champagne**, not neon green. (Changed from ink-indigo + marigold on 2026-10-21; see DESIGN.md.)
- Numbers use a sans with **tabular figures**, not monospace.
- Hierarchy through radius and elevation, not identical cards.
- Sentence case everywhere; no all-caps eyebrow labels.
- Story art is **illustrated panels with muted, painterly colour**, framed like a graphic novel, so story moments look clearly different from the trading terminal.

## 2. Colour tokens

### 2.1 Base
| Token | Hex | Use |
|---|---|---|
| `--ink-900` | `#0B0B0D` | App background |
| `--ink-800` | `#141417` | Panels |
| `--ink-700` | `#1C1C21` | Raised surfaces, modals |
| `--ink-600` | `#2A2A31` | Borders, grid lines |
| `--mist-100` | `#F2EFE8` | Primary text |
| `--mist-400` | `#A39E94` | Secondary text |
| `--champagne-500` | `#D9B26A` | Primary accent (fill), focus ring, XP, active desk |
| `--champagne-300` | `#E8CC8E` | Accent as text, hover |

### 2.2 Market semantics
| Token | Hex | Use |
|---|---|---|
| `--up` | `#34C79A` | Gains, bullish candles, buy |
| `--down` | `#F2645A` | Losses, bearish candles, sell |
| `--up-dim` / `--down-dim` | `#1D4A40` / `#4D2330` | Row tints, flashes |
| `--info` | `#6FA8FF` | Info alerts, news tags |
| `--watch` | `#E8C547` | Watch alerts |
| `--warning` | `#F28C38` | Warning alerts |
| `--critical` | `#FF4D4D` | Critical alerts, halt |

Colour-blind mode: `--up #4EA4F5`, `--down #F29A38`. Every value also carries `+`/`▲` or `−`/`▼`.

### 2.3 Asset class colours (allocation charts, desk tabs)
| Class | Hex |
|---|---|
| Stocks | `#7C8CF8` |
| Funds | `#5CC8E6` |
| Fixed income | `#9AD18B` |
| Gold / commodities | `#E3B341` |
| Global | `#C58AF0` |
| Crypto | `#F07FB1` |
| Prediction | `#6FD6C4` |
| Cash | `#98A1BC` |

### 2.4 World states (set via `data-world-state` on root)
| State | Trigger | Changes |
|---|---|---|
| Calm | CALM / EUPHORIA regime | Base palette |
| Tension | STRESSED regime or Warning-level world event | Top edge gets a thin `--warning` line; Fear Index gauge pulses once; panels unchanged |
| Crash | CRISIS regime | Background `#1A1220`, panels `#241828`, siren band under Treasury bar |
| Halt | Market-wide circuit breaker | Crash palette + full-screen Halt card, trading controls disabled |
| Recovery | RECOVERY regime | Base palette with a soft `--up` edge line for the first 10 days, then normal |

All state changes over 600 ms; instant with reduced motion.

## 3. Typography

| Role | Family |
|---|---|
| Display: chapter titles, halt card, debrief headline, endings | **Bricolage Grotesque** 600–800 |
| UI, body, all numbers | **IBM Plex Sans** 400/500/600, `font-variant-numeric: tabular-nums` on prices, quantities, P&L |
| Story dialogue | **IBM Plex Serif** 400 italic for character speech (distinct voice from UI) |

Scale (1.25, base 16): 12 / 14 / 16 / 20 / 25 / 31 / 39 / 49 px. Lesson and dialogue lines ≤ 70ch.

## 4. Global layout

### 4.1 Treasury bar (on every screen)
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ◀ Games  Market Survivor   Mon 9 May 2033   Regime: Crisis   Fear 42 ▲           │
│ Net worth ₹1,184,220 ▼6.4% today   Available ₹212,400   Blocked ₹30,000          │
│ Unsettled ₹18,300   [▶ 1d/s ▾] [⏸]   🔔 3                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```
- Net worth and today's change are the largest numbers.
- Tapping net worth opens the allocation sheet.
- Bell opens the Alert Center; badge shows unread count coloured by highest level.
- On mobile the bar collapses to: date · net worth · change · play/pause · bell.

### 4.2 Desk switcher
Horizontal tabs under the Treasury bar (scrollable on mobile), each with its asset-class dot and today's move for that class:
`Dashboard · Stocks · IPO · Funds · Fixed income · Commodities · Global · Crypto · Prediction`
Locked desks (Story) show a lock and "Unlocks in Chapter 4".

### 4.3 World Dashboard
```
┌─────────────────────────────── World Dashboard ──────────────────────────────────┐
│ Regime: Stressed        Fear Index 28 ▲        Policy rate 6.25%   CPI 5.8%      │
├──────────────────────────────┬───────────────────────────────────────────────────┤
│ Markets today                │ Macro gauges                                      │
│ Nifty 50     22,410  ▼1.8%   │ Oil  $96  ▲4.1%   USD/INR 86.2 ▲0.6%              │
│ Bank Nifty   48,120  ▼2.4%   │ Gold ₹98,400/10g ▲1.9%   10Y yield 7.3% ▲0.1     │
│ US 500        5,820  ▼0.9%   │ Geopolitical risk ████████░░ high                 │
│ BTC      $71,200     ▼5.2%   │ Credit stress     ███░░░░░░░ low                  │
├──────────────────────────────┴───────────────────────────────────────────────────┤
│ Sector heat map (tiles sized by weight, coloured by % move)                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Why markets moved today: "Oil rose after talks failed → airlines, paints fell,    │
│ upstream oil and defence rose, rupee weakened"  (links to event)                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Your portfolio by class (bar)  ·  Top movers in your portfolio  ·  Open alerts    │
└──────────────────────────────────────────────────────────────────────────────────┘
```
The **"Why markets moved"** line is generated from the event → factor → asset trace. It is the main teaching surface for connected markets.

### 4.4 Stocks terminal (desktop ≥ 1200px)
```
┌──────────────┬────────────────────────────────────────────┬───────────────────┐
│ Watchlist    │  INDIGO  InterGlobe Aviation               │ Order             │
│ NIFTY 50  ▼  │  ₹3,840.50  ▼ 7.9%     [1M 3M 6M 1Y 5Y]     │ ( Buy )( Sell )   │
│ ONGC      ▲  │ ┌────────────────────────────────────────┐ │ Type [Limit ▾]    │
│ HAL       ▲  │ │   daily candles + volume + event pins   │ │ Qty  [   10 ]     │
│ INDIGO    ▼  │ │   (pins mark news events on the chart)  │ │ Price[3,800.00]   │
│ ASIANPAINT▼  │ └────────────────────────────────────────┘ │ Charges ₹ 64.10   │
│ ...          │  Factor exposure: Oil −1.8 · GPR −0.9      │ From available    │
│              │  SMA · RSI · Vol                           │ ₹212,400          │
│              │                                            │ [ Place buy ]     │
├──────────────┴────────────────────────────────────────────┼───────────────────┤
│ Holdings | Orders | Ledger                                 │ News              │
└────────────────────────────────────────────────────────────┴───────────────────┘
```
- **Event pins** on charts: small markers on dates with news; tap to read.
- **Factor exposure strip** shows what moves this stock, in words ("Falls when oil rises").
- Order panel always shows "From available ₹X" so the shared wallet is obvious.

### 4.5 Mobile (≤ 640px)
```
┌─────────────────────────┐
│ 9 May 2033  ₹1.18M ▼6.4%│ Treasury bar (collapsed)
│ ▶ ⏸   🔔3               │
├─────────────────────────┤
│ Dash Stocks IPO Funds ▸ │ desk tabs
├─────────────────────────┤
│ INDIGO ₹3,840 ▼7.9%     │
│ ┌─────────────────────┐ │
│ │ candles + pins      │ │
│ └─────────────────────┘ │
│ News ticker (1 line)    │
│ Holdings                │
├─────────────────────────┤
│ [  Buy  ]   [  Sell  ]  │ sticky
└─────────────────────────┘
Bottom nav: Play · Portfolio · Story · Learn · Profile
```

## 5. Desk-specific screens

| Desk | Key elements |
|---|---|
| IPO | Calendar list; IPO detail with price band, lot size, subscription bars by category (retail, NII, QIB) updating daily; GMP hype meter labelled "Unofficial, often wrong"; my applications with blocked amount; allotment reveal (single flip motion); listing day panel |
| Funds | Fund cards (category, 1Y/3Y returns to date, risk level, exit load); SIP setup (amount, day, step-up); SIP timeline with crash periods shaded; lumpsum vs SIP comparison |
| Fixed income | FD booking (rate locked, maturity, early-break penalty shown before booking); bond list with duration and "If rates rise 1%, this falls about X%" line |
| Commodities | Gold, silver, oil fund charts; drivers shown: "Gold rises with fear and a weaker rupee" |
| Global | US stocks with price in USD and INR; P&L split "Price" vs "Currency"; conversion fee in order panel; US market clock |
| Crypto | 24/7 clock badge; custody switch per holding (Exchange / Self-custody) with risk note; exchange health meter in Chapter 4; frozen positions shown greyed with "Recovery estimate" |
| Prediction | Question list grouped by linked story event; each market: probability bar ("62% Yes"), 7-day probability chart, buy YES/NO with cost preview from LMSR, "pays ₹100 per share if correct"; positions and potential payout; hedge hint: "This market pays if the conflict continues — which would hurt your airline holdings" |

## 6. Portfolio and Treasury screens
- **Net worth chart**: net worth vs Nifty vs FD vs inflation-adjusted line; event pins.
- **Allocation**: donut by asset class, bars by sector, currency split (INR vs USD exposure), risk split.
- **Cash buckets**: Available / Blocked / Unsettled / Frozen with each item listed (e.g. "₹18,300 from TCS sale, arrives Tue").
- **Unified ledger**: filter by desk, type, date.

## 7. Alerts and crisis components

| Component | Behaviour |
|---|---|
| `AlertBanner` | Info (feed only), Watch (5 s), Warning (sticky) under Treasury bar; one at a time, highest level wins |
| `AlertCenter` | Drawer; grouped by day; each alert links to event, affected assets, lesson |
| `BreakingNews` | Critical world event: full-width takeover with Nina Brooks portrait, headline, 2-line explanation, "What's affected" chips (e.g. Oil ▲, Airlines ▼, Rupee ▼), buttons "See affected holdings" / "Continue" |
| `HaltCard` | Market Halt: display-font "Market halted", reason and duration, your portfolio today, worst holding, three actions: "Review holdings", "Open crash playbook", "Continue when market reopens" |
| `SirenBand` | 4px `--critical` band under Treasury bar in Crash/Halt; slow pulse (static on reduced motion) |
| `FearGauge` | Semi-circle 0–100 with regime label |
| `CrashPlaybook` | Sheet with 6 steps (check sizing, don't panic-sell, rebalance, keep SIPs, keep emergency cash, avoid money you need soon), each linking to action |
| `PortfolioAlertCard` | For drawdown/concentration/idle cash/custody; shows the number and one suggested next step as a principle, never a specific stock |

Alert copy examples:
- Watch: "Oil up 11% this week. Airlines and paint makers usually fall when oil rises."
- Warning: "Nifty is down 10% from its peak. This is a correction."
- Critical: "Solvane launched strikes on Qarath. Oil, gold and the dollar are rising."
- Halt: "Nifty fell 10% today. Trading is paused for 45 minutes."
- Portfolio: "Crypto is 38% of your net worth. A 50% crypto fall would cut your net worth by about 19%."

## 8. Story Mode screens

| Screen | Elements |
|---|---|
| Chapter map | Ten chapters on a timeline 2030–2039; each node shows title, grade (A–E), achievements; locked nodes show only year |
| Cutscene player | 16:9 illustrated panels (mobile: 4:5), portrait + name + dialogue in Plex Serif italic, tap to advance, "Skip" always visible, auto-advance option |
| Briefing | Chapter title (display font), 3-line setup, objectives list (primary marked), new desk unlocked callout |
| Checkpoint modal | Clock paused indicator, question, 3–4 choices; trade choices show a pre-filled order ticket to confirm; Victor's reply after choice |
| Objective tracker | Collapsible pill in Treasury bar: "2 of 3 objectives" |
| Chapter debrief | Headline in display font ("You held through the war"), four-line chart (You, Calm investor, Panic seller, SIP investor) with event pins, grade, what went well / what to learn (2–3 each), achievements, rewards, cliffhanger |
| Ending | Full-screen illustrated epilogue, final score breakdown (real return, risk, behaviour, objectives), ending title, New Game+ |

Character portraits: painterly, muted palette, consistent lighting. Victor (grey beard, cardigan), Jake (hoodie, ring light), Nina (studio backdrop), Dr. Ward (glasses, whiteboard), Sam (casual), Priya (scrubs in Ch 6). Art briefs in task D5-T03.

## 9. Time Machine screens
- Scenario list with real dates (or "Blind mode" hiding dates/names).
- Stake picker: slider from the chosen career (max 10% of net worth), shows cap "Max gain +50%".
- Same terminal as desks with a sepia-toned date badge "Historical".
- Settlement screen: stake, return, amount returned to career.

## 10. Motion rules
- Motion only for: world-state changes, Breaking News, Halt card, allotment reveal, cutscene transitions, order confirmation.
- 150 ms press, 250 ms panels, 600 ms world-state shift; easing `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- `prefers-reduced-motion`: no pulses, flashes or slides; instant state changes.

## 11. Copy guidelines
- Actions name what happens: "Place buy", "Apply for IPO", "Start SIP", "Book FD", "Move to self-custody", "Buy YES".
- Same word through a flow: "Place buy" → toast "Buy order placed" → status "Filled".
- Errors say what and how: "Not enough available cash. You have ₹12,400 available; this order needs ₹38,560. Cancel an open order or sell something first."
- Empty states invite action: "No prediction positions yet. Pick a question tied to this chapter's events."
- Never mock the player; panic sells get a learning card, not a joke.
- No hype words ("to the moon", "guaranteed").
- Disclaimer line on every trading screen: "Virtual coins only. Educational simulation, not investment advice."

## 12. Accessibility
- Full keyboard play: `B` buy, `S` sell, `Space` play/pause, `→` step day, `/` search, `1–9` switch desks, `A` open alerts.
- Focus ring 2px `--champagne-500`, 2px offset.
- Charts have text summaries; alerts announced via `aria-live` (polite for Watch, assertive for Critical/Halt).
- Touch targets ≥ 44×44 px. Colour-blind mode. WCAG AA contrast in every world state (check crash palette specifically).
- Cutscenes: captions always on (they are text), skip available, no flashing.

## 13. Design tasks

| ID | Phase | Task | Done when |
|---|---|---|---|
| D0-T01 | P0 | Tokens (base, semantic, asset class, world states) | CSS variables in use |
| D0-T02 | P0 | Fonts loaded with swap, subset | CLS < 0.05 |
| D1-T01 | P1 | Treasury bar (desktop + collapsed mobile) | Updates live on trade |
| D1-T02 | P1 | Stocks terminal + order panel + contract note | Storybook states |
| D2-T01 | P2 | Chart theme + event pins + factor exposure strip | Works in all world states |
| D2-T02 | P2 | World Dashboard + "Why markets moved" | Readable at 360px |
| D3-T01 | P3 | IPO, Funds, Fixed income, Commodities, Global, Crypto, Prediction screens | Storybook states for each |
| D3-T02 | P3 | Portfolio: net worth chart, allocation, cash buckets, ledger | Buckets match API |
| D4-T01 | P4 | Alert banner, Alert Center, Breaking News, Halt card, siren band, Fear gauge | Reduced-motion variants |
| D4-T02 | P4 | World-state themes (Tension, Crash, Halt, Recovery) | Contrast AA in each |
| D5-T01 | P5 | Chapter map, briefing, checkpoint, debrief | Debrief readable without colour |
| D5-T02 | P5 | Cutscene player | Keyboard + skip |
| D5-T03 | P5 | Character portrait art briefs + first 3 portraits | Approved |
| D6-T01 | P6 | Remaining portraits + Ch 4–7 panel art | Approved |
| D7-T01 | P7 | Ending screens + epilogue art | All 5 endings |
| D8-T01 | P8 | Time Machine + Academy screens | Done |
| D9-T01 | P9 | Accessibility + colour-blind audit across world states | WCAG AA |
