# Market Survivor

Single-player market life simulator (Next.js + a pure TypeScript engine). Specs live in `docs/spec/` — read `prd.md` first; it maps the other six files. Task log: `tasks.md` (sequential TASK-NNN, newest at top of the index).

## Setup

pnpm is not on PATH on this Mac. Use `npx -y pnpm@10.34.5 <cmd>` (or put `~/.npm/_npx/*/node_modules/.bin` on PATH after the first npx run).

```
pnpm install
pnpm dev          # http://localhost:3000/games/market-survivor (the Claude preview uses .claude/launch.json on a free port)
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`pnpm build` and a running `pnpm dev` share `apps/web/.next`: the build corrupts Turbopack's dev cache (dev then serves stale code or 500s). After a build, stop dev, `rm -rf apps/web/.next/dev`, start dev again.

Dev data: JSON files in `apps/web/.data/` (override with `MS_DATA_DIR`). No database yet — `apps/web/src/server/store.ts` is the only persistence layer and will be swapped for Postgres. Career seeds are sealed at rest with `MS_SEED_KEY` (required in production; see `.env.example`). Schema-1 saves are migrated on read (`server/migrate.ts`).

## Layout

- `packages/engine` — pure, deterministic game logic: config (Zod), calendars, seeded RNG streams, factor model (plus USD/INR, policy meetings, yields, exchange failure), price bars for India/US/crypto, Treasury ledger, invariants, public view, and `desks/*` (stocks, IPO, funds & SIP, fixed income, instant ETFs/bonds/US/crypto, crypto custody, forecasts). Careers are created with `createCareerWithHistory` (730 days of market before day one; `baseline` = day-one prices). No I/O, no `Math.random`, no wall clock (lint-enforced).
- `packages/content` — `universe.ts` (66 **fictional** companies; the 50 heaviest form the Survivor 50) and `desks.ts` (fictional funds, ETFs, bonds, US companies, coins, IPO pipeline), sectors, indices (Survivor 50 = breaker index). Public data only; never story/branch content. `LEGACY_IDS` maps the old real-company ids for save migration.
- `packages/ui` — design tokens (`tokens.css`), number/date formatting.
- `art/blender` — procedural Blender scripts for game art (run headless: `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/trading_desk.py -- --mood calm --frame wide --out …`). `desk_icons.py` renders the nine desk icons, `mode_art.py` the five mode-card objects, `desk_scenes.py` the eight desk hero banners (`public/art/scenes/`), and `bull_bear.py` the Exchange Square statues (`public/models/*.glb`, metaball sculpts) plus the landing hero cut-outs (`--cutout`, `public/art/hero/`) the same way. Every script runs `realism.py` before rendering (Cycles on Metal + denoise, Khronos PBR Neutral, material micro-detail); a full re-render of all art takes ~10 minutes. Outputs go to `apps/web/public/art/`.
- `apps/web/src/components/city` — the Market City (World desk): `cityModel.ts` (pure layout + data→tower mapping, tested), `MarketCity.tsx` (React Three Fiber scene, lazy-loaded), `WorldDesk.tsx` (inspector, 3D on/off, district list fallback). Design rules for it are in `DESIGN.md`.
- Modes (`apps/web/src/lib/modes.ts` for client-safe metadata; scripts live server-side):
  - Story — `server/story.ts`: per-chapter script (with optional central-bank `policy` bias), desk unlocks, objectives, checkpoints (pause the clock), Victor's replies, dated Market Hour news, grading. All 10 chapters are playable (1–3 in `story.ts`, 4–10 in `storyChapters.ts`, shared helpers in `storyKit.ts`); branch points are rolled from the career seed (`branchOf`, hidden); scripts can push factors (`shocks`), named stocks (`hits`) and freeze the exchange; `NEXT_CHAPTER` moves a finished chapter on; chapter 10 ends with one of five endings. The client sees the current chapter via `storyView()`.
  - Free Play — open-ended career, all desks.
  - Daily Challenge / Time Machine — `server/scenarios.ts`: regime scripts with drift; Daily seed is an HMAC of the date so every player gets the same market. Side runs use save slots 4 and 5.
  - Academy — `src/content/academy.ts` lessons, scored on the server.
- Legal surface: consent gate (18+ and Terms, `TERMS_VERSION` in `lib/modes.ts`) before any career call, footer on every page, `/terms` `/privacy` `/licences` `/contact` pages (drafts with `TODO` markers), grievances in `.data/grievances.jsonl`, Delete my data. Review and fixes: `docs/legal/`.
- Desk actions beyond stock orders go through `POST /api/ms/careers/[id]/actions` (`DeskActionBody` in `lib/schemas.ts`); screens live in `components/desks/`.
- `apps/web` — Next.js app: `/games/market-survivor` page, `/api/ms/*` route handlers, `src/server/*` (career service, file store, HTTP plumbing), `src/store/game.ts` (Zustand + BroadcastChannel cross-tab sync), `src/app/globals.css` (all component styles).

## Rules that must hold

- Money is integer paise. Every cash movement goes through `packages/engine/src/treasury.ts`; `checkInvariants` runs after every mutation and aborts the save on any violation.
- The server is authoritative. Mutations need an `Idempotency-Key` header and `expectedVersion` (409 + fresh state when stale). Request bodies are strict Zod schemas — unknown fields are 400.
- The client never sees hidden state: seed, pending shocks, factor levels, future story content. `toPublicView` in `engine/src/view.ts` is an explicit allowlist.
- All companies and indices are fictional (legal review L-01/L-02, supersedes prd.md §4.1's real-name universe). Time Machine borrows the *shape* of past episodes, never real historical prices.
- Disclaimer on every screen: `DISCLAIMER` in `apps/web/src/lib/modes.ts` (virtual coins, fictional companies, not advice, not SEBI-registered). Never use real company or index names.
- Design: Obsidian & Champagne (warm graphite + champagne accent, tokens in `packages/ui/src/tokens.css`), Bricolage Grotesque / IBM Plex, world state (`data-world-state` on `<html>`) reshapes the UI — see `docs/spec/design.md`.

## Tests

- Engine: `packages/engine/test` (unit + fast-check property tests). Test IDs map to `docs/spec/testcases.md`.
- Scenario realism: `apps/web/test/scenarios.realism.test.ts` checks each script actually produces its shape (falls fall, recoveries recover) over many seeds. Re-run after touching drifts or `SCRIPT_NOISE`.
- API: `apps/web/test/api.test.ts` drives the real route handlers against a temp data dir (TC-SEC-01..08, 19, seed-leak check, buy→sell→settle flow).
