# Task History — Market Survivor

Sequential, never reused. Newest entry at the top of the log.

**Next task number: TASK-017**

Status values: `COMPLETED` · `PARTIAL` · `BLOCKED` · `CANCELLED`

## Index

| # | Date | Title | Status |
|---|---|---|---|
| TASK-016 | 2026-10-30 | Docker image, docker compose, CI/CD to GHCR | COMPLETED |
| TASK-015 | 2026-10-21 | Fix: stray box on every tap, gap when switching desks | COMPLETED |
| TASK-014 | 2026-10-21 | Interaction layer: tilt, magnetic CTAs, ripples, cursor halo, typed dialogue | COMPLETED |
| TASK-013 | 2026-10-21 | Obsidian & Champagne palette + app-wide motion v2 | COMPLETED |
| TASK-012 | 2026-10-21 | Landing motion pass (design-library-pro motion recipes, native CSS) | COMPLETED |
| TASK-011 | 2026-10-21 | Landing v3 "The Charge" (design-library-pro + Blender cut-outs) | COMPLETED |
| TASK-010 | 2026-10-21 | Live World desk dashboard | COMPLETED |
| TASK-009 | 2026-10-21 | Photographic graphics pass (Cycles), cast-bronze statues, city reflections | COMPLETED |
| TASK-008 | 2026-10-21 | Story chapters 4–10, branch points, Jake's line, endings | COMPLETED |
| TASK-007 | 2026-10-21 | Story chapters 2–3, chapter progression, news, 22 more companies | COMPLETED |
| TASK-006 | 2026-10-18 | Home screen redesign: launcher layout | COMPLETED |
| TASK-005 | 2026-10-18 | Every desk playable, 2 years of history, Blender desk scenes, Exchange Square | COMPLETED |
| TASK-004 | 2026-10-17 | Before-launch legal fixes, game modes, tour, mode art | PARTIAL |
| TASK-003 | 2026-10-12 | 3D Market City + real candlestick charts (design-library-pro) | COMPLETED |
| TASK-002 | 2026-10-12 | Finish Phase 1: styles, API tests, lint/CI, browser verification | PARTIAL |
| TASK-001 | 2026-09-28 | Read spec zip, start building (Phase 0 + Phase 1) | PARTIAL |

---

## TASK-016 — Docker image, docker compose, CI/CD to GHCR

- **Date:** 2026-10-30
- **Status:** COMPLETED

### User request
"I have to show this as my DevOps project: push to GitHub, make a CI/CD pipeline, host it on Docker and run it."

### Done
- `next.config.ts`: `output: 'standalone'`, with tracing from the monorepo root.
- `Dockerfile`: multi-stage on `node:24-slim`, pnpm via corepack, the manifests-first layer cached on the lockfile. The runtime runs only the standalone server as the non-root `app` user, with `MS_DATA_DIR=/data` on a volume and a Node `fetch` healthcheck.
- `.dockerignore`: excludes local state, `.env`, player data, `.git`, docs, art and design refs.
- `docker-compose.yml`: the published image (or a local build), port 3000, named volume `ms-data`; it refuses to start without `MS_SEED_KEY` (read from a gitignored `.env`).
- `.github/workflows/ci.yml` (now "CI/CD"):
  - `check` runs typecheck, lint, tests and build;
  - `docker` builds the image (GHA cache), runs it, waits for the healthcheck and curls the page and the API;
  - on pushes to `main`, it publishes `ghcr.io/namanrai1222/market-survivor:latest` and `:sha-<commit>`.
- README: a DevOps section with a pipeline diagram, a status badge and run commands.

### Testing
- Local `docker build` OK (415 MB image).
- `docker compose up` gives a healthy container: the page and `/api/ms/me` return 200, consent returns 200, and creating a Daily career returns 201. Save files appear under `/data/players/…`, written as user `app`.

---

## TASK-015 — Fix: stray box on every tap, gap when switching desks

- **Date:** 2026-10-21
- **Status:** COMPLETED

### User report
"When changing from IPO to Stocks or another module there is a lag, a gap appears." / "It happens on every tap, Next day or anywhere: a large box appears first."

### Cause
- **Stray box:** the press ripple (TASK-014) is appended inside the pressed control, but `.step-button` ("Next day", the most-pressed button) was `position: static; overflow: visible`. The ripple anchored to the whole treasury bar at full size, unclipped, so a big shape flashed on every press.
- **Desk-switch gap and lag:** each switch ran a View Transition (TASK-013). The browser snapshotted the whole page, including the WebGL city, and animated the desk's height separately from the page below it; desks differ a lot in height (IPO 1290 px, Stocks 2807 px, World 3990 px), so a gap opened. The old desk faded out (180 ms) faster than the new one faded in (420 ms), and the new panels then started from opacity 0 with up to 240 ms of stagger, so the desk area was briefly empty.

### Fix
- `.step-button` is positioned and clips. `Interactions.tsx` now refuses to ripple into any host that is static or unclipped, and starts each ripple at scale 0. Dropped `mix-blend-mode` on the ripple.
- Desk switches no longer use a View Transition (`pickDesk` is a plain state update). The tab ink grows in on the new tab instead of morphing. `withViewTransition` is kept only for entering a world.
- Panels enter from opacity 0.55 over 450 ms with ≤ 60 ms stagger, so a desk is readable the frame it appears.
- **Follow-up (owner screenshot, Brave):** every pressed button, "Next day" included, ballooned into a large block. That tab was running the new JS with an older stylesheet (a hot reload that only half-applied), so the ripple `<span>` had no `position: absolute`. Inside an inline-flex button it became a 118–150 px flex item and stretched the button. The ripple now carries its layout styles inline (`position`, `pointer-events`, `border-radius`). Verified: with every stylesheet disabled, a ripple leaves the button at 86×22.

### Testing
- typecheck, lint, tests green. In the browser: the ripple's offset parent is the button itself; no view-transition name on the desk content or tab ink; switching IPO → Stocks → World renders in the next frame with no transition running.

---

## TASK-014 — Interaction layer: tilt, magnetic CTAs, ripples, cursor halo, typed dialogue

- **Date:** 2026-10-21
- **Status:** COMPLETED

### User request
"Improve it more, add more animation, make it more interactive."

### Done
- `components/Interactions.tsx` (replaces `Spotlight.tsx`, mounted once in the root layout). It tracks the cursor on panels, tiles, choices, CTAs and save rows (`--mx/--my/--rx/--ry`), drops a champagne ripple wherever a control is pressed, and trails a lerped cursor halo that opens up over anything clickable (mouse only).
- **Tilt:** mode tiles and market tiles lean towards the cursor in 3D, and the mode art drifts the opposite way (parallax).
- **Magnetic CTAs:** the landing CTA and the "Next day" button follow the cursor, and the arrow on "Next day" nudges.
- **Story:** Victor's replies and checkpoint questions type themselves out with a blinking block caret (`Typed` in `StoryLayer.tsx`). A click finishes the line; the full text is laid out invisibly so nothing jumps, and screen readers get it whole.
- **Clock:** the treasury-bar date and net worth flip over when a day passes.
- **Dashboard:** the worth chart wipes in left to right; market tiles get their own spotlight.
- **Landing:** a champagne scroll-progress hairline at the top; nav links draw an underline; save-row slot numbers slide as the row floods.
- Reduced motion: no halo, ripple, tilt, typing or flips.

### Testing
- typecheck, lint, engine 46 + web 69 tests green. Browser at 1440: tile tilt, neighbour dimming, halo, progress line, lens transition into the world, date flip on "Next day", tab ink slide to Stocks; no console errors.
- Not seen live: the typed dialogue (it needs a story checkpoint to come up).

---

## TASK-013 — Obsidian & Champagne palette + app-wide motion v2

- **Date:** 2026-10-21
- **Status:** COMPLETED

### User request
"Make the dashboard animations better too, use design-library-pro, work on the modes and the story and everything, rebuild the whole animation, change the colour palette and make it more premium."

### Done
- **Palette** (owner picked Obsidian & Champagne out of three directions): tokens in `packages/ui/src/tokens.css`, `--marigold-*` renamed `--champagne-*`, every navy/indigo hex in `globals.css`, the 3D city (`MarketCity`, `CityLife`, `Plaza`, `cityModel` moods) and both charts retinted to graphite.
- **Motion tokens:** `--ease` is now expo-out `(.16,1,.3,1)`; added `--ease-in`, `--ease-io`, `--t-reveal`.
- **Transitions:** `withViewTransition(update, kind)` tags `<html data-vt>`. Entering a world opens a lens from the centre while the landing recedes; desk switches swap only the content, and the desk-tab ink line slides to the new tab.
- **Everywhere:** cursor spotlight on panels, mode tiles and story choices (`components/Interactions.tsx`, one listener in the root layout); a sheen across primary buttons on hover.
- **Dashboard:** panels cascade in; net worth flashes the day's direction; sparklines draw on; the fear dial sweeps to its reading (`@property --fear`); heatmap cells cascade; wire headlines drop in (stable keys, so only new ones animate).
- **Story / modes:** modals settle out of a blur with their lines staggered; chapter titles rise from a mask; checkpoint choices stagger in; the debrief grade stamps down; the chapter map steps in; met objectives pop and wash green.
- All motion sits under `prefers-reduced-motion: no-preference`.

### Testing
- typecheck, lint, engine 46 + web 69 tests green. Computed styles checked in the browser (palette, easing, tab ink, panel cascade, spotlight, view-transition kind).
- Not checked visually: the preview window was minimized during this task, so no screenshots were taken. The Blender renders (desk scenes, mode art, icons) still carry their old indigo lighting.

---

## TASK-012 — Landing motion pass (design-library-pro motion recipes, native CSS)

- **Date:** 2026-10-21
- **Status:** COMPLETED

### User request
"Go through the animations in the design library pro, find them and add them."

### Done
- Recipes from `references/motion.md`, built with CSS scroll-driven animations (`animation-timeline: view()` / named `--charge` timeline) and the View Transitions API. No GSAP or Lenis: pnpm here won't install over the existing v11 store, and the native features cover every effect.
- **Pinned scrubbed beat** (≥641 px): `.stage-pin` is an 80vh runway; the stage sticks while SURVIVOR splits into SURV / IVOR, the bull charges off accelerating (ease-in), the copy fades up, the glow turns red and "Then the market turns." blurs in.
- **Entrances:** blur-to-sharp on the staggered letters and the bull; hero facts count up (reuses `useCountUp`).
- **Ambient loop:** the bull breathes (`scale`, 6 s) and a warm sheen glides over the bronze (masked by the cut-out, every 7 s).
- **Scroll reveals:** the bear walks in out of a blur; the bear headline lights up word by word; storm tags, mode tiles and save rows rise blur-to-sharp, staggered.
- **Hover:** a hovered mode tile dims its neighbours; save rows flood marigold from the left.
- **Page transitions:** `lib/viewTransition.ts`. Entering or leaving a world crossfades blur-to-sharp; switching desks (tabs, number keys, tour) transitions only `.game-content`.
- Reduced motion turns all of it off (the scroll beats sit in `prefers-reduced-motion: no-preference`; transitions are skipped in JS and CSS). Browsers without scroll timelines get the static page.

### Testing
- typecheck, lint, engine 46 + web 69 tests green. Browser at 1440 / 768 / 375: beat scrubs as designed, no horizontal scroll, both view transitions fire, no console errors.
- Not checked: Safari/Firefox rendering (Firefox has no scroll timelines yet, so it gets the static page).

---

## TASK-011 — Landing v3 "The Charge" (design-library-pro + Blender cut-outs)

- **Date:** 2026-10-21
- **Status:** COMPLETED

### User request
"Use design-library-pro, use Blender and create a professional, outstanding landing page that looks designed by a professional UI/UX designer."

### Done
- References (one job each): Gang DL-003 — wordmark behind the subject; QuantumCoin DL-052 — object and type as one plate; Credo DL-027 — one object owns the stage; Zypsy-style light giant sentence for the second beat; mono corner readouts as texture.
- Blender: `bull_bear.py --cutout` renders the bronze bull and bear alone on transparent backgrounds (near-profile charge, warm key + cool rim, shadow catcher) → `public/art/hero/*.webp`. Sculpts slimmed (torso at drawn size, limbs fuller); city GLBs re-exported.
- `components/home/LandingHero.tsx`: full-bleed studio stage (marigold glow, perspective floor), giant SURVIVOR wordmark with a staggered letter rise, the bull charging in front of it with pointer parallax, one primary action (continue your latest save / start the story), real-number facts (10 chapters, 8 markets, 66 companies, 2 years of history). `BearBeat`: "Bulls make you rich. Bears decide if you keep it." with the bear and the storms of Story Mode.
- Removed the old hero's CSS (28 rules); landing no longer uses the desk backdrop.

### Testing
- typecheck, lint clean. Browser at 1440 / 1024 / 375: everything in the first viewport at 1440×900, no horizontal scroll, reduced motion disables the entrance and parallax; flat-return text on the marigold button fixed for contrast.

---

## TASK-010 — Live World desk dashboard

- **Date:** 2026-10-21
- **Status:** COMPLETED

### User request
"Improve the dashboard, make it dynamic; use the design libraries and skills; make it more interactive and more real."

### Done (design-library-pro: count-up from real values — Lume DL-024; live readout — Smooothy DL-001; asset rail with trails — Encrypto DL-043; hover focus — Lunoa DL-014; bento — Luma DL-023)
- `GET /api/ms/careers/[id]/dashboard`: one read of the day log → net worth since day one, the index (incl. pre-career history), 30-day trails for the market tiles. Public data only (no factors/regime/seed).
- `components/city/Dashboard.tsx` on the World desk: **net worth vs index** chart (% since day one, 1M/3M/6M/All, crosshair legend, re-frames on resize); **world readout** with a fear gauge from the index's real 20-day volatility, rates, rupee, inflation, next policy meeting and live market-open lights; **market tiles** with sparklines and count-up values; **sector heatmap** (size = index weight, colour = today's move, hover dims the rest, click trades the sector leader, cells flash in each new day); **market wire** of the latest news and alerts.
- Responsive at 1440 / 800 / 375 with no horizontal scroll; reduced motion skips count-ups, pulses and flashes.

### Testing
- typecheck, lint clean; API 32/32 (new: dashboard is private, starts at day one, leaks no hidden state).

---

## TASK-009 — Photographic graphics pass (Cycles), cast-bronze statues, city reflections

- **Date:** 2026-10-21
- **Status:** COMPLETED

### User request
"Work on the graphics, make it more realistic, use Blender and refine the designs."

### Done
- `art/blender/realism.py`: shared pass every art script opts into — Cycles on the Metal GPU with adaptive sampling + denoising, Khronos PBR Neutral view (photographic, brand colours stay true), and micro-detail on every material (roughness variation + fine bump; glass and emitters left clean).
- Re-rendered with it: 8 desk banners (the coin jar is now real refracting glass), 5 mode cards, the bull-and-bear hero, all 8 landing/game backdrops (4 moods × wide/tall).
- **Bull and bear rebuilt with metaballs** (`bull_bear.py`): blobs along each bone fuse into one seamless cast-bronze body (the skin-modifier version had creases; voxel remesh hollowed the bear). New GLBs for Exchange Square (~7k tris each).
- **Live city:** locally generated studio reflections (`Environment` from the plaza's RoomEnvironment map) so tower facades read as glass and the ground as wet asphalt; distant skyline kept out of the fog as dark night silhouettes.

### Testing
- typecheck, lint clean; city/desk tests pass. Browser: Exchange Square with the new statues, city reflections, landing backdrop.

---

## TASK-008 — Story chapters 4–10, branch points, Jake's line, endings

- **Date:** 2026-10-21
- **Status:** COMPLETED

### User request
"Continue."

### Done
- **Chapters 4–10** (`server/storyChapters.ts`, story.md §4): Crypto Summer/Winter (Crypto desk; Vaultex freezes on a scripted date; the Tipster's Rocketyield pump and rug), Drums of War (Global desk; weekend strike → Monday gap → circuit-breaker halt), The Silent Outbreak (two halts, emergency cut, stimulus), Cracks in the Banks (Northgate Bank run, Crescent Finance default), The Election (fictional, neutral parties), The Long Climb (over-trading, Solaris pump-and-dump, Brightline accounting fraud with daily lower circuits), The Perfect Storm (five-checkpoint final exam; Victor silent). 17 new checkpoints, ~40 news headlines, objectives per spec.
- **Branch points** (ceasefire, vaccine, bank rescue, election result, stimulus) rolled from a hash of the career seed (`branchOf`), never sent to the client; scripts and news follow the branch.
- **Engine script hooks:** `shocks` (per-factor daily push), `hits` (per-instrument daily move, bands still apply), `freezeExchange`. Default live band 20% (large caps) so a 10% index fall can trip the breaker; Brightline/Solaris/Apex Agro trade in 5% bands. Rupee drift calmed (~3–4%/yr); crypto long-run drift lowered.
- **Jake's ghost line** in the Story bar (You vs Jake since the story began), following his designed arc (+400% boom, −92% crash, rebuild if you helped him in ch 9).
- **Endings** (story.md §7): Market Legend, Steady Builder, Survivor, Gambler's Ruin, Sat It Out, from chapter grades, tip-chasing, panic sells and cash share; epilogue lines for Sam, Priya and Jake from your choices.
- Index drawdown tracked per chapter (`trackIndex`) for "fall less than the index" objectives; inflation captured at chapter start for the real-return objective.
- New fictional companies: Northgate Bank, Crescent Finance, Brightline Infra, Apex Agro, Solaris Green (66 stocks total).
- Calibration (4 seeds): war chapter worst index fall −29 to −37% with 1 halt; outbreak −37 to −45% with 1–2 halts; banks −17 to −26%; Perfect Storm −42 to −52% with a halt in most worlds.

### Testing
- engine 46/46; web 68/68 (story: full 10-chapter playthrough to an ending, hidden branches/scripts never in the client view, war and outbreak crashes in every seed tried). typecheck, lint, build clean.
- Browser: Story bar shows You vs Jake.

### Remaining
- New Game+ (story.md §7), achievements, a Jake line on the net-worth chart (currently a number in the Story bar).

---

## TASK-007 — Story chapters 2–3, chapter progression, news, 22 more companies

- **Date:** 2026-10-21
- **Status:** COMPLETED

### User request
"Continue building and make it full and final. Make Story Mode more interesting and add more companies, keeping the rules and regulations in mind."

### Done
- **Story Mode** (`server/story.ts`, story.md §4): Chapter 2 "Everyone's Getting Rich" (Jul 2030–Mar 2031; opens IPOs, Funds & SIP, Forecasts; main goal: start a SIP) and Chapter 3 "The Rate Shock" (Apr 2031–Mar 2032; opens Fixed income and Commodities; main goal: hold 2+ asset classes). Five new checkpoints: listing-day hype, the Tipster's pump-and-dump group (leave and report), Sam's all-in small-cap plan, a bond-duration quiz, deposits vs inflation. Victor replies to each.
- **Chapter progression:** `NEXT_CHAPTER` desk action (`startNextChapter`): new script and end date, desks unlocked, grading restarted from the chapter's own start (`story.start`), grade stored (`story.grades`, shown on the chapter map). Debrief offers "Start Chapter N". Briefing shows the real end date and checkpoint count.
- **Market Hour news:** dated headlines per chapter (Nina Brooks, Jake, Dr. Ward, Priya, Sam) arrive as alerts when the clock passes them; Sam's chapter-3 message depends on your chapter-2 advice.
- **Engine:** `ScriptStep.policy` biases the central bank at meetings so Chapter 3 hikes for real; the IPO pipeline waits while the IPO desk is locked and never re-announces a company.
- **Companies:** 22 more fictional stocks (61 total; the 50 heaviest form the Survivor 50, the rest trade as midcaps outside it) and 8 more fictional IPOs appended to the pipeline (20 total). Saves made before this get the new companies at their start price. Every name invented; no real company, index, person or event.
- **Rules kept:** fictional entities only (L-01/L-02/L-19); the Tipster beat teaches that sure-return tips are illegal pump-and-dumps; forecasts stay coins-only on in-game events (L-09); disclaimer unchanged on every screen.

### Testing
- engine 46/46; web 67/67 (new `story.test.ts`: chapters 1→2→3 with unlocks/grades/IPOs, rate hikes in ≥4/5 seeds in chapter 3, news and Sam's branch). typecheck, lint, build clean.
- All 11 real saves upgrade and keep trading with invariants intact.
- Browser: Story career played through Chapter 1 (news alerts arrive), debrief with grade on the map, "Start Chapter 2" → Chapter 2 briefing, correct desks unlocked.

### Remaining
- Chapters 4–10 (crypto winter, war, outbreak, banks, election, long climb, perfect storm); Jake's ghost line; endings.

---

## TASK-006 — Home screen redesign: launcher layout

- **Date:** 2026-10-18
- **Status:** COMPLETED

### User request
"Make the dashboard UI better — it is center focused and looks designed by AI" (screenshot of the home screen).

### Done (design-library-pro: anti-patterns "centred hero + uniform cards", patterns "copy bottom-left, object centre-right", "mixed tile sizes", "Swiss index of rows", "mono microcopy")
- `components/home/LandingHero.tsx`: full-bleed launcher hero — top rail (wordmark, mono tag, Modes/Saves/Academy), giant staggered title up to 164px, one primary action (continue the save furthest along, with its net worth and return; or start Story Mode), secondary links, world-date readout. Desk backdrop starts 20–32% in so title and monitors never collide.
- `components/home/ModeCards.tsx`: uneven grid (Story and Free Play 6/12 tall; Daily, Time Machine, Academy 4/12 short), numbered mono tags, status chips, per-mode accent, hover lift; Free Play tile uses the Blender bull-and-bear render.
- `components/career/CareerPicker.tsx`: saves as a ledger of rows; empty slots start Story or Free Play inline.
- Added IBM Plex Mono (`--font-mono`) for microcopy. Removed the dead landing, mode-card and save-card CSS (46 rules).

### Testing
- typecheck, lint clean; engine 46/46, web 64/64. Browser at 1440 / 768 / 375: no horizontal scroll, no text/object collisions, console clean (only HMR reconnect messages from the server restart).

---

## TASK-005 — Every desk playable, 2 years of history, Blender desk scenes, Exchange Square

- **Date:** 2026-10-18
- **Status:** COMPLETED

### User request
"Complete the rest of the modes (IPO and others available in Story and Free Play), use Blender to make the dashboard 3D and more realistic, use a bull and other things." Then: "Use Blender and make the dashboard and all the screens more realistic and 3D." Then: "Don't start from day 1 — start with at least 2 years of data so the market is interesting; make it responsive."

### Done: engine (career schema 3)
- **Markets:** one world clock prices India (stocks, funds, ETFs, bonds), the US (dollars, own holiday calendar, weekend gaps) and crypto (every day). World adds USD/INR, a central bank that meets on the first Wednesday on or after the 5th of every even month (hikes/cuts from inflation, growth, rupee, regime), 3y/10y yields, a crypto exchange that can freeze once in a crypto bust, and a scam coin that can rug-pull.
- **Desks** (`packages/engine/src/desks/*`): IPO (announce → 3-day bid with money blocked → retail lottery → listing pop/flop → trades on the stock engine), Funds & SIP (next-day NAV, FIFO exit loads, SIPs with yearly step-up that skip when cash is short), Fixed income (quarterly-compounding FDs with early-break penalty; bonds by duration), instant desks for commodities/bonds/US/crypto (spread by regime, fees, T+1 or instant settlement, contract notes, USD cost tracking), crypto custody (own wallet vs exchange, 1-day transfer back), Forecasts (renamed Prediction; coins only, in-game questions only, LMSR + informed/herd/noise bots; legal review L-09).
- **Two years of history:** `createCareerWithHistory` plays 730 days of calm-biased Free Play markets before the start date (no rug pulls or exchange failures), stores the day log, and opens the career on a moving market with a fresh wallet. `baseline` keeps day-one prices/index levels for "since you started" and "beat the index"; inflation starts at 1 on day one; scripted careers open in their script's first regime. ~90 ms and ~1.9 MB of candles per career.
- Invariants now cover fund and IPO reservations, FD principal, forecast shares and fund lots. Public view allowlist adds `macro` (rates, FX, exchange status — not its hidden outcome), IPOs, fund orders, SIPs, FDs, forecasts, transfers, desk fills, baseline. Schema 2 → 3 upgrade (`upgradeCareer`); all 8 real saves upgrade.

### Done: server and screens
- `POST /api/ms/careers/[id]/actions`: strict union of 12 desk actions, same idempotency/version/invariant pipeline as orders.
- Screens: `components/desks/*` — IPO, Funds & SIP (with XIRR), Fixed income, Commodities/Global/Crypto (watchlist, charts in ₹ or $, instant ticket with fee preview, holdings with price/rupee/fee split, custody), Forecasts. Locked desks explain which Story chapter opens them. World desk: live quote per desk and a stacked allocation across desks. Charts gain 2Y.
- Responsive at 1440/1024/768/375 with no horizontal scroll on any desk.

### Done: Blender and 3D
- `art/blender/desk_scenes.py`: eight product-shot sets (glass candlesticks, brass listing bell, coin jar, vault door, gold bars + barrel, night globe with trade routes, fictional coin + hardware wallet, armillary sphere) → `public/art/scenes/*.webp` (10–30 KB), used as desk hero banners with pointer parallax.
- `art/blender/bull_bear.py`: skin-modifier bronze bull and bear → `public/models/{bull,bear}.glb` (7k / 4k tris) + `public/art/bull-bear.webp`.
- Market City: **Exchange Square** in the free grid cell — statues on pedestals, lit by whoever leads today (index move tilted by regime), LED ticker of the index and top movers, lamp posts; streets with traffic that thins in a crash; stars, moon and a distant skyline; "Exchange Square" camera flight.

### Bugs found while verifying
- Inflation index carried the 2 years of history (real net worth would start 12% down) → reset on day one.
- Story careers inherited the history's regime → open in the chapter's scripted regime.
- Profit split attributed fees to the rupee → fees tracked per position.
- React lint: ticker texture mutated through an effect-bound ref → declarative map.

### Testing
- engine 46/46; web 64/64 (new: 19 desk/history tests incl. a year of Free Play touching every desk with invariants each day, 3 API tests, plaza layout). typecheck, lint, build clean.
- Browser: new Free Play career opens with 3M+ of candles on day one; every desk at 1440 and 375; crypto buy through the ticket; IPO subscription card; forecasts; Exchange Square close-up; console clean.

### Remaining
- Bull/bear are stylised bronze (skin-modifier) rather than sculpted; a small seam on the bull's flank.
- IPO pipeline holds 12 companies (≈1.5 years); add more for long careers.
- Story chapters 2–10 (which unlock the new desks in Story).

---

## TASK-004 — Before-launch legal fixes, game modes, tour, mode art

- **Date:** 2026-10-17
- **Status:** PARTIAL (all code fixes done and verified; operator/counsel items remain)

### User request
"Fix the before-launch issues in the game, also add more graphics and the rest modes which are required. Start building other modes with dummy names, disclaimer, a tour of the game and everything required." Then: "Continue with the whole plan." Issues refer to the legal review (`docs/legal/Market-Survivor-Legal-SEBI-Compliance-Review.pdf`, L-01..L-19).

### Done: legal review items
- **L-01 / L-02 / L-07 / L-19:** 39 fictional companies (same sectors, prices, weights) and fictional indices (Survivor 50 = breaker, Survivor Bank). Old saves migrate on read via `LEGACY_IDS` (`server/migrate.ts`, career schema 1 → 2); tested on copies of the real saves.
- **L-03:** fake market tape removed from the landing page.
- **L-04 / L-05:** consent gate (18+ and Terms, unticked by default, `TERMS_VERSION`) required by every career call (403 `CONSENT_REQUIRED`); Terms, Privacy, Contact pages (drafts with `TODO` markers); grievance form with reference numbers, 5 per 24 h.
- **L-06:** longer `DISCLAIMER` (virtual, fictional, unaffiliated, not advice, not SEBI-registered) in every footer and trading screen.
- **L-08:** Terms §3: coins can't be bought, sold, transferred or exchanged; no prizes.
- **L-10:** Time Machine uses fictional prices shaped like past episodes; no real historical data.
- **L-13 (partial):** seeds sealed at rest (AES-256-GCM, `MS_SEED_KEY`, required in production). Postgres and a breach runbook still to do.
- **L-14 (partial):** Delete my data in every footer (deletes careers, progress, consent, cookie). Retention job and India hosting region still to do.
- **L-17:** `docs/legal/dark-pattern-audit.md` (CCPA 2023, 13 patterns).
- **L-18:** `/licences` page with the TradingView NOTICE.

### Done: modes and UX
- **Engine:** career schema 2: `CareerType` STORY/FREEPLAY/DAILY/TIMEMACHINE, regime scripts with per-step drift (`ScriptStep`), `SCRIPT_NOISE`, end dates (`ENDED`), story checkpoints that pause the clock (`CHECKPOINT`), max drawdown.
- **Story Mode, Chapter 1:** objectives pill, two Victor checkpoints (the June prompt describes the actual run), graded debrief A–E, 10-chapter map (2–10 "Coming soon").
- **Daily Challenge:** same market for every player (HMAC of the IST date), 15 trading days, results card.
- **Time Machine:** 5 fictional replays (Sudden Stop, Boom and Bust, Credit Freeze, Rate Shock, War Weekend), picker, progress bar, results card.
- **Academy:** 9 lessons × 3 questions, scored on the server, XP; answer positions balanced 9/9/9.
- **Tour:** 8 spotlight steps on `data-tour` targets, once per browser, replay via "?".
- **Graphics:** `art/blender/mode_art.py`: five mode-card objects (WebP, 11–18 KB).

### Bugs found while verifying
- Time Machine picker closed as soon as it opened: dialog cleanup `close()` fired `onClose` under Strict Mode. Removed from all four dialogs.
- Tour finish updated the parent inside a state updater; now reads the step from a ref.
- Scripted regimes alone didn't produce the falls; added drift + `SCRIPT_NOISE`, guarded by `scenarios.realism.test.ts`.
- Run bar counted calendar days; now counts trading days.
- Academy: the right answer was the 2nd choice in 16/27 questions.

### Testing
- `pnpm typecheck`, `pnpm lint`, `pnpm build` clean. `pnpm test`: engine 46/46, web 41/41 (new: modes ×6, scenario realism ×7, consent, fictional universe, story checkpoints, daily/TM, grievances, academy, delete, seal, migration).
- Browser (1440 / 768 / 375): consent gate, landing + mode cards, tour (click, Enter, Esc; no console errors), Story briefing → both checkpoints → debrief, Daily run → results card, Time Machine picker → War Weekend → crash world state, Academy lesson + quiz + XP, legal pages, contact form (ref issued), Delete my data confirm (cancelled). No horizontal scroll at any width.
- Test data left on disk: one test grievance (`MS-82BB0B8B`) in `.data/grievances.jsonl`; the browser pane's test player has a finished Daily run, a War Weekend replay at day 11 and 30 XP.

### Remaining (operator / counsel)
- Fill every `TODO` on Terms, Privacy and Contact (legal entity, grievance officer, address, hosting region); counsel review.
- Postgres, retention job, breach runbook (L-13/L-14); set `MS_SEED_KEY` in production.
- Story chapters 2–10; desks other than Stocks.
- Not done: L-09 (Prediction desk design), L-11/L-12/L-15/L-16 (policies for prizes, crypto ads, tie-ups, influencers); these apply when those features or campaigns exist.

---

## TASK-003 — 3D Market City + real candlestick charts (design-library-pro)

- **Date:** 2026-10-12
- **Status:** COMPLETED

### User request
"Make it 3D, make it more interactive. Use the references with the skill, go through the designs and find better and more interactive 3D designs which give real stock market feel."

### Process (design-library-pro)
- Read the skill's process, 3D recipes, anti-patterns and the fintech/trading/game references; shortlisted DL-016 AMIX (fly-through city), DL-033 Intrepid (lights-on beat), DL-043 Encrypto (one physical metaphor), DL-007 Poker Arena (learn-and-play, calm UI). Thumbnails copied to `design/refs/`.
- Proposed three directions (Market City / Trading Floor / Living Ticker); owner picked **Market City**.
- Wrote `PRODUCT.md` and `DESIGN.md` (North Star "The Market City at Night", named rules, decisions log) before code.

### Done
- **History API** `GET /api/ms/careers/[id]/history?instrumentId=&days=` (≤400, only past days, player-scoped) + `readDays` in the store.
- **Candles:** `components/stocks/PriceChart.tsx` (lightweight-charts 5.2.1, lazy): daily candles + volume, 1M/3M/6M/1Y, OHLC legend, text summary for screen readers, token colours (colour-blind aware).
- **Market City:** `components/city/*`. Every stock a tower (footprint = index weight, height = market value, roof = today's move, lit windows = volume vs normal), sectors as districts; day change = towers grow/sink with a pulse rippling out from the centre; world state relights the city street by street (Crash/Halt = lights out, red haze); hover tooltip, click → camera flight (expo-out 1.2 s, any drag cancels) → inspector card with live numbers → "Trade X" opens the Stocks desk on that stock (`focusId` in the store). Idle auto-orbit; reduced motion = no drift/flights/pulses; 3D on/off toggle (localStorage) + district list fallback; no-WebGL → list. World desk is now the default desk.
- Store data dir no longer depends on the server's cwd (`apps/web/.data` from repo root or app dir). `.claude/launch.json` uses a free port (3000 is used by another project).
- Packages: three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9, lightweight-charts 5.2.1 (all ≥ 2 weeks old).

### Testing
- `pnpm test`: engine 40/40, web 23/23 (new: history API ×2, city model ×6: no overlaps, every stock in its district, heaviest district central, mappings). typecheck, lint, build clean.
- Browser at 1440 / 768 / 375: city renders, click-to-fly + inspector + Trade → Stocks with real candles; Next day animates; CRISIS (forced on a test career) dims the city and turns the haze red; no horizontal scroll; console clean after replacing drei `<Html>` (it threw 19 "synchronously unmount a root" errors).
- Frame times (1440 px): median 16.7 ms, p95 17.6 ms, 0 frames > 33 ms idle and during the day-change ripple. three.js chunk 242 KB gz, not in the first page load.
- Test data left on disk: a Free Play career (slot 2, player `731bd37e…`) advanced to 3 Apr 2030 with its regime forced to CRISIS for the lights-out check.

### Remaining
- Not measured yet: Lighthouse, real mid-range Android.
- Ideas from the references not built: "Insert coin"-style first-visit intro, sound toggle, sector shock ring on big index moves, Story-mode camera beats.

---

## TASK-002 — Finish Phase 1: styles, API tests, lint/CI, browser verification

- **Date:** 2026-10-12
- **Status:** PARTIAL (Phase 1 playable and tested; visual redesign pending)

### User request
"Continue building from where TASK-001 left off." Then: "Use design-library-pro for designing, and Blender for better graphics."

### Done
- Found that TASK-001's "remaining" API routes, Zustand store, BroadcastChannel sync and client screens already existed; type-checked them (clean after removing deprecated `baseUrl`).
- Wrote the missing `apps/web/src/app/globals.css` (app did not build without it): Tailwind v4 + tokens, every component style, world-state theming, siren band, mobile collapsed Treasury bar.
- UI gaps from design.md: "From available ₹X" on the ticket; keyboard B/S/`/`/→/A/1–9; contract notes (full charge breakdown, settle date) on fills; unsettled "arrives on" list; halt card as native `<dialog>` with net worth today, worst holding, Review holdings / Continue; halt banner; order controls disabled during halt; aria-live alert announcements; sticky mobile Buy/Sell bar; zero-safe `tone`/`arrow`/`direction` in `@ms/ui/format` (no more "▲ 0.00%" / "−0.00%").
- `apps/web/test/api.test.ts`: 15 tests — lifecycle, TC-SEC-01..08, TC-SEC-19, seed/pending/factors never in responses, buy→fill→sell→T+1 settle, cancel releases cash, readable 422s.
- Root `eslint.config.mjs` (engine purity rules: no Math.random / Date.now), `.github/workflows/ci.yml`, PR template, `.env.example`, `CLAUDE.md`, `.claude/launch.json` (dev server preview).

### Testing
- `pnpm test`: engine 40/40, web 15/15. `pnpm typecheck`, `pnpm lint`, `pnpm build` clean.
- Browser (desktop 1366px + mobile 375px): TC-E2E-01 flow (Story career → keyboard buy → next day fill → sell → T+1 settle; Treasury bar correct each step; contract-note maths checked by hand). TC-E2E-04 two tabs: tab B showed tab A's buy within 1 s. Halt card verified by injecting a halt into a throwaway local career (deleted after). No console or server errors; no horizontal scroll on mobile.

### Remaining (next session)
1. **Visual redesign with the `design-library-pro` skill** (created on claude.ai after this session started, so it must be loaded in a new session). Keep design.md tokens/world states unless the redesign deliberately changes them.
2. **Blender art** — trading-desk backdrop DONE: `art/blender/trading_desk.py` (procedural, re-runnable) → `apps/web/public/art/backdrop/desk-{calm,tension,crash,recovery}-{wide,tall}.webp` (2400×1350 / 1080×1440, 29–61 KB, all 8 in ~42 s). Wired in: `components/game/Backdrop.tsx` follows the world state (halt → crash), `<picture>` serves wide/tall at 640px, 600 ms cross-fade (instant with reduced motion); landing hero (text column left, desk right; phone: desk in its own band between hero and cards) and in-play ambience behind panels. Siren band moved inside the Treasury bar (it used to slip behind the sticky bar on scroll). Desk icons DONE: `art/blender/desk_icons.py` → `apps/web/public/art/desks/{world,stocks,ipo,funds,fixed_income,commodities,global,crypto,prediction}.webp` (256px transparent, auto-framed, 5–14 KB, all nine in ~3 s); used in desk tabs (24px, greyed when locked) and the not-built-yet desk panel (112px). Fixed that panel's copy for Free Play (it said "unlocked in a later Story chapter"). Still to do: Story character portraits (Phase 5; design.md wants painterly, not this low-poly look), keep every asset WebP and small for mid-range Android.
3. Not done from the spec: `Space` play/pause auto-advance (1d/s), unread-badge colour by highest alert level, allocation sheet on net-worth tap, chart is a placeholder until P2-T05 candles.
4. TC-SEC-03 note: `GET/POST /api/ms/careers` intentionally mint an anonymous session cookie instead of 401 until the main site's auth exists.
5. Then Phase 2 (world engine v1 + charts) per prd.md §16.

---

## TASK-001 — Read spec, build Phase 0 + Phase 1 (Treasury + Stocks desk)

- **Date:** 2026-09-28
- **Status:** PARTIAL

### User request
"Read all the files and start building the game" (files2.zip: prd, story, market-engine, techstack, design, security, testcases — copied to `docs/spec/`).

### Decisions (from user)
- Standalone Next.js app in this folder (routes `/games/market-survivor`, `/api/ms/*`), movable into main site later.
- **No database for now** — dev JSON file store in `apps/web/.data/` behind `apps/web/src/server/store.ts`; swap for Postgres later.
- Scope: Phase 0 + Phase 1, playable. Monorepo per spec (pnpm workspaces + Turborepo).

### Done
- Monorepo: `packages/engine`, `packages/content`, `packages/ui`, `apps/web`. TypeScript pinned to 6.0 (typescript-eslint needs < 6.1).
- Engine (pure, deterministic): Zod market-config + fixed test config (P0-T03), seeded RNG streams, calendars (IN/US/crypto), factor model + regimes (v0), asset/bar generation with bands, market-wide breakers (10/15/20, 20% closes day), Treasury double-entry ledger (reserve/capture/release/unsettled/settle), charges, orders (market/limit/SL/SL-M, next-day fills, slippage, lower-circuit queue), T+1 settlement, net worth, invariants, public view (seed/pending shocks/factors hidden).
- Content: 39 real stocks + 19 sectors (loadings from market-engine.md §5.1; 3 added rows flagged), Nifty 50 / Bank Nifty. Prices/weights illustrative — verify in P2-T04.
- UI package: design tokens incl. world states + colour-blind mode (P0-T05), formatting, `Delta`.
- Web server layer written (not yet type-checked or tested): `src/server/store.ts`, `http.ts`, `careers.ts`, `src/lib/schemas.ts`.

### Testing
`pnpm --filter @ms/engine test` → 5 files, **40/40 passed** (TC-CHG-01/02, TC-TRS-01/05/06/07/08/10/11, property test TC-TRS-02/03/04 over ~10k random actions, TC-ORD-01..09, TC-CIR-01..04, TC-WLD-01/02/03/04/08). Engine + content `tsc` clean.
5-year realism smoke (throwaway): CALM index vol ~16%/yr; Free Play crises give 40–45% drawdowns.

### Remaining (next session)
1. API route handlers: `app/api/ms/careers` (GET list w/ cookie, POST create), `careers/[id]` (GET, DELETE), `[id]/advance`, `[id]/orders`, `[id]/orders/[orderId]` — use `handle()`, `requirePlayer`, `idempotencyKey`, schemas.
2. `apps/web/vitest.config.ts` (alias `@` → src) + API tests TC-SEC-01..08 + seed-never-in-response.
3. Client: Zustand store + BroadcastChannel sync (P1-T10), `lib/api.ts`, pages (career slots, play screen), TreasuryBar, DeskTabs, Stocks terminal (watchlist, detail + factor strip, OrderPanel with charges preview via `@ms/engine/charges`, holdings/orders/fills/ledger), HaltCard (`<dialog>`), toasts, keyboard shortcuts, disclaimer.
4. `app/layout.tsx` (next/font: Bricolage Grotesque, IBM Plex Sans), `globals.css` (Tailwind v4 + `@theme inline` mapping tokens).
5. ESLint flat config, CI workflow, PR template (S0-T03), docs: CLAUDE.md, init.md, memory.md, logic.md, .env.example (`MS_DATA_DIR` only).
6. Run app in browser and verify TC-E2E-01 flow.
