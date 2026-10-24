---
name: Market Survivor
description: A trading desk at night above a city whose towers are the market.
colors:
  bg: "#0B0B0D"          # ink-900 obsidian; crash/halt shift to #150E0F
  surface: "#141417"     # ink-800 panels
  surface-2: "#1C1C21"   # ink-700 raised
  line: "#2A2A31"        # ink-600
  fg: "#F2EFE8"          # mist-100 ivory
  muted: "#A39E94"       # mist-400
  accent: "#E8CC8E"      # champagne-300: accent as text
  accent-fill: "#D9B26A" # champagne-500: CTAs, active desk, the lamp
  on-accent: "#0B0B0D"
  up: "#34C79A"
  down: "#F2645A"
typography:
  display: { fontFamily: "Bricolage Grotesque", fontSize: "clamp(2.5rem, 7vw, 4rem)", fontWeight: 800, lineHeight: 1.0 }
  headline: { fontFamily: "Bricolage Grotesque", fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 700, lineHeight: 1.15 }
  body: { fontFamily: "IBM Plex Sans", fontSize: "15px", fontWeight: 400, lineHeight: 1.5 }
  label: { fontFamily: "IBM Plex Sans", fontSize: "12px", fontWeight: 500, fontFeature: "tnum" }
rounded: { sm: "8px", md: "10px", lg: "14px", pill: "999px" }
motion: { ease: "cubic-bezier(.16, 1, .3, 1)", ease-in: "cubic-bezier(.55, 0, 1, .45)", ease-io: "cubic-bezier(.65, 0, .35, 1)", press: "150ms", panel: "300ms", reveal: "800ms", world: "600ms", flight: "1.2s" }
---

# Design System: Market Survivor

Source of truth for tokens and screens remains `docs/spec/design.md`; this file records the 3D direction, its references and the decisions made with the `design-library-pro` skill.

## Brief

- **Aesthetic:** cinematic night trading floor; restrained terminal UI over a living 3D city; obsidian and champagne (owner pick 2026-10-21; was ink-indigo + marigold), lit windows; data first, spectacle at the moments the market moves.
- **References:** DL-016 AMIX Game Gallery → the city you fly through and "3D ON" switch; DL-033 Intrepid → lights switching on/off as the narrative beat (crash = lights out); DL-043 Encrypto → one physical metaphor carried through, live prices on cards; DL-007 Poker Arena → learn-and-play game framing, colour-coded primary actions, keep colour to the "felt" (the city) so the UI stays calm. Match their feel, never their art or copy.
- **Intent:** make "one connected market" something you can *see*: every stock is a tower, sectors are districts, a shock ripples across the skyline, and any tower is one click from a trade.
- **Guardrails:** no casino cues, no hype words, no chrome-blob-only hero; 3D never hides prices (every number also lives in HTML); a 3D OFF switch and a plain list; phones get a lighter city; reduced motion = no flights, instant changes.

## Overview
**Creative North Star: "The Market City at Night."** You sit at a desk above a city whose skyline *is* the market. Calm nights are quiet windows; a crash turns the lights out street by street. It refuses the casino and the crypto-hype look: the drama comes from real moves, not glitter.

## Named Rules
**The Skyline Is The Market Rule.** Every visual quantity in the city maps to one real number: tower footprint = index weight, height = market value (weight × price), roof glow colour = today's move, lit windows = today's volume vs normal. Nothing decorative moves on its own except the idle camera drift.
**The Numbers Live In HTML Rule.** Prices, changes and actions are always real text (tooltip, side card, terminal), never only in the canvas.
**The One Accent Rule.** Marigold is for focus, selection and the lamp only; green/red only for direction.
**The Lights Out Rule.** World state changes the city's lighting the same way it changes the UI: Tension = amber haze, Crash/Halt = windows dim and the haze turns red, Recovery = teal dawn.

## Motion
- House ease `cubic-bezier(.16, 1, .3, 1)`; towers settle to new heights over 1.2 s after each day; camera flight to a tower 1.2 s with SKIP by clicking anywhere.
- Idle: very slow orbit drift; stops on interaction, never under reduced motion.
- Reduced motion: no drift, no flights (camera jumps), towers change instantly.

## Components
- **City (World desk):** full-width canvas card, drag to orbit, scroll/pinch to zoom (clamped), hover tower → HTML tooltip (symbol, price, move), click → camera flies in, side card shows quote + "Trade {SYMBOL}" (switches to Stocks with it selected). District labels in HTML. 3D OFF → the existing dashboard cards only.
- **Candlestick chart (Stocks):** daily candles + volume from the career's history, 1M / 3M / 6M / 1Y, crosshair readout; up/down from tokens.

## Decisions log
| Part | Status | Notes |
|---|---|---|
| Direction | Locked | Owner picked "Market City" over "Trading Floor" and "Living Ticker" (2026-10-12) |
| Night desk backdrop (Blender) | Shipped | Landing + in-play ambience, mood per world state |
| Desk icons (Blender) | Shipped | Tabs + not-built-yet panel |
| Market City (R3F) | Shipped | World desk is now the default desk. 60 fps (16.7 ms median, 0 frames > 33 ms) at 1440 px; three.js chunk 242 KB gz, lazy-loaded |
| District labels via drei `<Html>` | Tried, removed | One React root per label → "synchronously unmount a root" errors under React 19 StrictMode; replaced by plain HTML labels positioned each frame |
| All 19 district labels | Tried, removed | Cluttered the skyline; now the 8 heaviest districts + the district of the hovered/selected tower |
| Phone city | Shipped | DPR 1, no antialias, no labels, camera pulled back for portrait |
| Real candles (lightweight-charts) | Shipped | 1M/3M/6M/1Y, OHLC legend, volume; TradingView attribution logo kept (Apache-2.0 NOTICE) |
| Mode cards (Blender) | Shipped | `art/blender/mode_art.py`: one object per mode (book + candles, mini city, calendar, hourglass, books + cap), 11–18 KB WebP each |
| Consent gate | Shipped | Native `<dialog>` before any play: 18+ and Terms boxes start unticked, facts in plain words (virtual, fictional, not advice) |
| First-visit tour | Shipped | 8 spotlight steps on `data-tour` targets, switches desks itself, skips absent targets; once per browser, replay from "?" |
| Story chapter 1 | Shipped | Objectives pill, two Victor checkpoints that pause the clock, graded debrief + chapter map; chapters 2–10 shown as "Coming soon" |
| Scripted regimes only | Tried, removed | Regime alone didn't make the scripted falls happen; added per-step drift and halved market noise while a script runs (`SCRIPT_NOISE`), checked by `scenarios.realism.test.ts` |
| Desk hero banners (Blender) | Shipped | `art/blender/desk_scenes.py`: one product-shot set per desk, subject right, title left; pointer parallax, still on reduced motion; faded behind text on phones |
| Exchange Square | Shipped | Bronze bull and bear (`bull_bear.py` → GLB) in the free grid cell; light follows who leads today; LED ticker; locally generated environment map (no HDR download) |
| City life | Shipped | Streets, instanced traffic (density = world-state power), stars, moon, distant skyline ring |
| Markets strip | Shipped | World desk: one live quote per desk, coloured by asset class, opens the desk |
| Two years of history | Locked | Careers open on a moving market (owner request 2026-10-18); "since you started" uses the day-one baseline |
| Launcher home | Shipped | Owner: home "center focused, looks AI-designed" (2026-10-18). Now full-bleed and left-anchored: top rail with wordmark + mono tag, giant staggered title (second word steps in), one primary action = continue the latest save (or start Story), desk scene pushed right so copy and object never overlap |
| Five equal mode cards | Tried, removed | Replaced by an uneven grid: Story and Free Play big (Free Play uses the bull-and-bear render), Daily / Time Machine / Academy short; fixed metadata positions per tile |
| Three equal save cards | Tried, removed | Replaced by a ledger: slot · mode · net worth + return · world date · actions; empty slots offer Story / Free Play inline |
| "MS" badge + eyebrow/title/paragraph stack | Tried, removed | Template look; mono kickers numbered 01/02/03 carry the structure instead |
| Landing v3 "The Charge" | Shipped | design-library-pro: Gang DL-003 (wordmark behind the subject) + QuantumCoin DL-052 (object woven through type) + Credo DL-027 (one object owns the stage). Blender cut-outs (`bull_bear.py --cutout`, transparent + shadow catcher) of the bronze bull charging through a full-width SURVIVOR wordmark; studio stage (glow + perspective floor), mono corner readouts, real-number proof strip; a bear beat second. Replaces the desk-backdrop hero |
| Landing motion | Shipped | design-library-pro motion.md, native only: pinned scrubbed "charge" beat (SURVIVOR splits, bull exits ease-in, glow turns red), blur-to-sharp entrances, count-up facts, bronze breathe + sheen loop, scroll-read bear headline, staggered reveals, hover focus, View Transitions for entering a world and switching desks. All off under reduced motion |
| GSAP + Lenis | Tried, removed | Not installable over the v11 pnpm store; CSS scroll timelines do the same job with no JS |
| Obsidian & Champagne palette | Locked | Owner chose it over Midnight Platinum and Emerald Vault (2026-10-21) for a more premium look. Warm graphite grounds, ivory text, champagne as the one accent (fill `#D9B26A`, text `#E8CC8E`); green/red stay for prices; 3D city and charts retinted to graphite. Tokens renamed `--marigold-*` → `--champagne-*` |
| App motion v2 | Shipped | Cursor spotlight on panels/tiles/choices, panel cascade on every desk, net-worth tick flash, sparkline draw-on, fear-dial sweep, heatmap cascade, wire headlines drop in, story modals settle from blur with staggered lines, masked chapter titles, grade stamp, objective tick pop, button sheen, sliding desk-tab ink, lens-open transition into a world. Expo-out everywhere (`--ease`), all off under reduced motion |
| Interaction layer | Shipped | `Interactions.tsx`: 3D tilt + art parallax on tiles, magnetic CTAs, press ripples, lerped cursor halo (mouse only), Victor's lines typed with a block caret (click to finish), flip counters on the clock, worth-chart wipe, landing scroll-progress hairline |
| Desk-switch View Transition | Tried, removed | Snapshotting the whole page (WebGL city included) cost frames and opened a gap while the desk resized. Desks now swap instantly with a short panel rise from 55% opacity; the tab ink grows in |
| Dialog cleanup `close()` | Tried, removed | Under Strict Mode it fired `onClose` and shut the Time Machine picker as it opened |

## Do's and Don'ts
### Do:
- Keep panels opaque over 3D; scrim any text that sits on the scene.
- Lazy-load three.js only on the World desk; cap DPR at 1.75; render on demand.
### Don't:
- Put the order ticket or prices only inside the canvas.
- Animate towers without a market reason.
- Use `backdrop-filter` over the live canvas.
