# Security — Market Survivor

A connected world with one wallet creates new attack surfaces: racing two desks against the same cash, peeking at hidden branch outcomes, exploiting known history in Time Machine, and desyncing tabs. The game also serves teenagers and must remain legally a social game.

Priority: **P0** = before any external user, **P1** = before public launch, **P2** = after launch.

---

## 1. Principles

1. **Server-authoritative everything:** clock, prices, fills, Treasury, branches, prediction resolution, scores, rewards.
2. **One Treasury, one lock:** every desk's money movement goes through the Treasury service under a row lock in one transaction.
3. **Hidden stays hidden:** future prices, branch outcomes, prediction true probabilities, seeds and story content beyond the current beat never leave the server.
4. **Append-only history:** world days, prices, ledger and events are never rewritten; no rewind.
5. **Integer money:** paise and crypto base units as integers.
6. **Coins have no value:** no purchase, no transfer, no cash-out, so there is no financial incentive for fraud and the game stays a social game.
7. **Defence in depth:** client validation (UX) → Zod strict (API) → engine rules → DB constraints.

## 2. Threat model

| ID | Threat | Example | Control | Pri |
|---|---|---|---|---|
| T-01 | Balance tampering | Send `available: 99999999` in request | Client-sent amounts ignored; Treasury computed server-side; strict schemas reject unknown fields | P0 |
| T-02 | Price/fill tampering | Send fill price or NAV | Server derives all prices from engine state | P0 |
| T-03 | Cross-desk double spend | Parallel "buy crypto" and "apply IPO" with same ₹100,000 | Single Treasury row lock; all desk ops in one transaction; DB `CHECK (available_paise >= 0)` | P0 |
| T-04 | Replay / double submit | Resend sell or payout request | Idempotency key per mutation; unique `(career_id, idempotency_key)` | P0 |
| T-05 | Stale-tab overwrite | Tab A (old state) places order after Tab B spent the cash | `expectedVersion` check; stale → 409 with fresh state; BroadcastChannel sync | P0 |
| T-06 | Future price leakage | Request prices past sim date | All price/world queries clamped to career `sim_date` server-side | P0 |
| T-07 | Branch outcome leakage | Inspect API/bundle for "ceasefire: true" | Outcomes stored server-side, null until resolved; not included in any response or client bundle; story content served beat by beat | P0 |
| T-08 | Prediction true-probability leakage | Read bot belief from API | Only LMSR price and public news exposed; bot internals never serialized | P0 |
| T-09 | Rewind / save-scumming | Restore earlier state after bad event | No manual saves; no rewind endpoint; world/ledger append-only; career restart creates new seed and resets Treasury | P0 |
| T-10 | Seed prediction | Derive RNG seed to precompute world | Seeds from CSPRNG, stored hashed + encrypted; streams derived server-side; never exposed | P1 |
| T-11 | Time Machine exploitation | Player knows COVID recovered, stakes max every time | Stake ≤ 10% of career net worth; gains capped +50%; one paid run per scenario per 7 real days; Blind mode for bonus XP only; settlement server-computed | P0 |
| T-12 | Reward farming | Script quizzes, daily challenge, rewarded ads | Per-type daily caps; one quiz reward per lesson; shuffled answers; rate limits; bot heuristics | P1 |
| T-13 | Leaderboard cheating (if enabled) | Fake Daily Challenge score | Score from server run state only; anomaly checks vs theoretical max for seed | P1 |
| T-14 | IDOR | Use another player's `careerId` | Every query scoped by `player_id` from session | P0 |
| T-15 | Session attacks / CSRF | Stolen cookie, cross-site POST | Main-site auth; HttpOnly, Secure, SameSite=Lax; CSRF tokens on mutations; session rotation | P0 |
| T-16 | Injection | SQL via instrument param | ORM parameterized queries; instrument ids validated against `instruments` | P0 |
| T-17 | XSS | Script in display name on share card | React escaping; no `dangerouslySetInnerHTML`; strict CSP; display-name allowlist + filter | P0 |
| T-18 | DoS / cost abuse | Hammer `advance` with max days | Rate limits; max days per call; per-career advance throttle; cached world days | P0 |
| T-19 | Prediction market manipulation | Rapid buy/sell to exploit rounding | Integer share units; LMSR cost computed with high-precision decimal then rounded against the player; min trade size; rate limit | P1 |
| T-20 | Frozen-asset bypass | Sell crypto frozen on failed exchange | Frozen flag enforced in engine and DB (`frozen = true` blocks sells) | P0 |
| T-21 | Secrets leak | DB URL, data vendor key in bundle | Env vars only; no secret in `NEXT_PUBLIC_*`; bundle scan in CI | P0 |
| T-22 | Data license breach | Scraping Time Machine data via API | Serve only current-window data; rate limits; no bulk endpoints; terms of use | P1 |
| T-23 | Supply chain | Malicious package | Lockfiles, Renovate/Dependabot, audit in CI, review new deps | P1 |
| T-24 | Minors' data | Over-collection from under-18 users | Age band only; parental consent per DPDP rules; no targeted ads to minors | P0 |
| T-25 | Losing social-game status | Future feature sells coins or offers prizes | PR template rule; code owner review on any payment or reward code; legal review before monetization changes | P0 |
| T-26 | Harmful/defamatory content | Real company given a fictional fraud; insensitive war content | Real-vs-fictional audit (ST-T09); sensitivity and neutrality reviews; content lint rule blocks `directHits` on real instruments for negative corporate events | P0 |
| T-27 | Advice perception | Players treat story events as signals about real stocks | Disclaimers; real names move only on sector/macro; no live-market references | P1 |

## 3. Controls in detail

### 3.1 Treasury integrity
- All desk services call `treasury.withLock(careerId, expectedVersion, fn)`:
  1. `SELECT ... FROM treasury WHERE career_id = $1 FOR UPDATE`
  2. Compare `state_version` with `expectedVersion` (409 if stale)
  3. Run `fn` (reserve/capture/release/credit/debit) writing ledger entries
  4. Verify invariants inside the transaction; abort on violation
  5. Increment `state_version`, commit
- Nightly reconciliation: `sum(ledger) == available + blocked + unsettled` and `blocked == sum(open reservations)` per career; alert on mismatch.
- `advance` holds the same lock, so trades and ticks never interleave.

### 3.2 Hidden information
| Data | Where it lives | What client gets |
|---|---|---|
| Future prices | Generated on demand per day, stored after the day passes | Only days ≤ sim date |
| Branch outcomes | `branches.outcome` (null until resolve date) | Resolved outcomes only, as fired events |
| Story content | `packages/content` on server | Current beat's text/choices only |
| Prediction bot beliefs | Engine memory per tick | LMSR price, volume |
| Seeds | Encrypted column | Never |
| Time Machine data | `hist_prices` | Window up to current replay date |

Build check: the client bundle must not import `packages/content/story` or `packages/engine/events/branches` (ESLint boundary rule + bundle analysis in CI).

### 3.3 Input validation
- Zod `.strict()` on all bodies. Common rules: positive integer quantities (base units), prices on tick size and within band, `desk` enum, instrument must belong to desk and be unlocked for this career, `advance.days` 1–config max and not beyond chapter pause points.

### 3.4 Rate limits (Redis sliding window)
| Endpoint | Limit |
|---|---|
| Orders (all desks) | 30/min per career |
| Prediction trades | 30/min per career |
| Advance | 60/min per career |
| Price/world reads | 180/min per player |
| Rewards | Daily cap per type |
| Time Machine settle | 1 per run, 1 paid run per scenario per 7 days |

### 3.5 HTTP headers
CSP (`default-src 'self'`, script nonce, `frame-ancestors` main site only), HSTS preload, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera/mic/geolocation.

### 3.6 Privacy
- Stored: auth id, display name, age band, game state, anonymous analytics.
- Never collected: PAN, bank, UPI, phone, real portfolio. Warn if a PAN-like string is typed into display name.
- Analytics events carry no PII; IPs hashed.
- Account deletion removes all careers and game data within 30 days.

### 3.7 Content safety
- Content lint in CI: negative corporate `directHits` (fraud, default, bankruptcy) only allowed on instruments with `real_or_fictional = FICTIONAL`.
- War/pandemic/election content requires sign-off tasks ST-T05 and ST-T07 before feature flags enable those chapters.

### 3.8 Monitoring
- Audit log: orders, advances, payouts, rewards, Time Machine settlements (payload hash).
- Alerts: ledger mismatch, 409 spike (sync bugs), reward volume anomalies, 5xx spike, unusual Time Machine win rates.

### 3.9 Secure development
- PR template: "Touches money, rewards, payments, hidden data, or story content?" → second reviewer.
- CI: lint, typecheck, tests, calibration smoke, `npm audit --audit-level=high`, secret scan, bundle boundary check.
- Separate dev/staging/prod databases.

## 4. Security tasks

| ID | Phase | Task | Pri | Done when |
|---|---|---|---|---|
| S0-T01 | P0 | Secrets in env, secret scanning | P0 | CI passes |
| S0-T02 | P0 | DB constraints (buckets ≥ 0, qty ≥ 0, idempotency, append-only triggers) | P0 | Constraint tests pass |
| S0-T03 | P0 | Social-game rule in README + PR template + code owners | P0 | Present |
| S1-T01 | P1 | `requirePlayer` + career ownership checks | P0 | TC-SEC-01..03 pass |
| S1-T02 | P1 | Treasury `withLock` + version checks | P0 | TC-SEC-05..08 pass |
| S1-T03 | P1 | Idempotency on all mutations | P0 | TC-SEC-04 passes |
| S1-T04 | P1 | Ledger reconciliation job | P0 | Detects injected mismatch |
| S2-T01 | P2 | Sim-date clamping on all reads | P0 | TC-SEC-09 passes |
| S2-T02 | P2 | Rate limiting | P0 | 429 above limits |
| S2-T03 | P2 | `DATA_SOURCES.md` | P1 | Complete |
| S3-T01 | P3 | Frozen-asset enforcement | P0 | TC-SEC-14 passes |
| S3-T02 | P3 | LMSR precision + rounding against player | P1 | TC-SEC-15 passes |
| S3-T03 | P3 | Prediction resolution server-only | P0 | TC-SEC-13 passes |
| S5-T01 | P5 | Branch/story content boundary (bundle rule, beat-by-beat serving) | P0 | TC-SEC-10/11 pass |
| S5-T02 | P5 | No rewind, autosave only | P0 | TC-SEC-12 passes |
| S5-T03 | P5 | Content lint for real-vs-fictional | P0 | CI blocks violations |
| S8-T01 | P8 | Time Machine caps, cooldowns, server settlement | P0 | TC-SEC-16/17 pass |
| S8-T02 | P8 | Reward caps + bot heuristics | P1 | Farming script capped |
| S9-T01 | P9 | Headers + CSP | P0 | Grade A |
| S9-T02 | P9 | OWASP ASVS L1 checklist + dependency audit | P0 | No high/critical open |
| S9-T03 | P9 | Privacy policy, DPDP/minors, legal sign-off | P0 | Done |
| S9-T04 | P9 | k6 load with reconciliation after | P1 | No drift |
