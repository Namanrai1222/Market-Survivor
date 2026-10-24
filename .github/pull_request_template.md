## What and why

<!-- Task ID(s) from docs/spec (e.g. P1-T09) and the user-visible change. -->

## Checks

- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass
- [ ] Money stays integer paise; every Treasury change goes through `treasury.ts` and keeps `checkInvariants` clean
- [ ] Engine stays pure: no `Math.random`, wall-clock time or I/O in `packages/engine/src`
- [ ] No hidden data reaches the client: seed, pending shocks, factor levels, future story/branch content (`view.ts` allowlist)
- [ ] New request bodies use strict Zod schemas; mutations need `Idempotency-Key` + `expectedVersion`
- [ ] Real company names move only on sector/macro factors (prd.md §4.1); fictional entities for story events
- [ ] Copy follows design.md §11; disclaimer still on every trading screen
- [ ] Test cases added or updated (testcases.md IDs listed below)

## Test cases

<!-- e.g. TC-ORD-03, TC-SEC-07 -->
