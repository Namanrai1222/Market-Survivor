# Market-Survivor

> **Educational game. Virtual coins only. Fictional companies and simulated prices. Not investment advice. Not registered with SEBI.**

Market Survivor is a single-player market life simulator. You start with ₹10,00,000 in **virtual coins** in a fictional market world that has already been running for two years, and you try to build and protect a portfolio through ten years of booms, rate shocks, wars, outbreaks, bank runs and circuit-breaker halts. The point is to learn *why* markets move together: how interest rates, the rupee, sectors and sentiment connect, and why risk control matters more than any single trade.

## What's in the game

- **Story Mode:** ten chapters, a mentor (Victor), checkpoints that pause the clock to ask you a question, branch points, chapter grades and five possible endings.
- **Free Play:** an open-ended world with every desk unlocked.
- **Daily Challenge:** the same market for every player that day.
- **Time Machine:** scenarios shaped like famous market episodes, using generated prices only.
- **Academy:** short lessons with quizzes.
- **Eight market desks:** stocks, IPOs, mutual funds and SIPs, fixed income, commodities, global, crypto and forecasts, plus a live World dashboard and a 3D "Market City" where every tower is a company.

All 66 companies, the funds, coins and the *Survivor 50* index are invented for the game.

## Tech

A Next.js web app on top of a pure, deterministic TypeScript engine (seeded randomness, integer-paise money, invariant checks after every mutation), with 3D art made in Blender. Setup, layout and the rules the code must hold are in [CLAUDE.md](CLAUDE.md); product and engine specs are in [`docs/spec/`](docs/spec).

```bash
pnpm install
pnpm dev        # http://localhost:3000/games/market-survivor
pnpm typecheck && pnpm lint && pnpm test
```

## DevOps: Docker and CI/CD

[![CI/CD](https://github.com/Namanrai1222/Market-Survivor/actions/workflows/ci.yml/badge.svg)](https://github.com/Namanrai1222/Market-Survivor/actions/workflows/ci.yml)

```
push / PR ──► check ──────────────────────► docker ──────────────────────────► publish (main only)
              typecheck · lint · tests       build image · run container ·       ghcr.io/namanrai1222/
              production build               wait for healthcheck · curl page     market-survivor:latest
                                             and API                              + :sha-<commit>
```

- **`Dockerfile`:** a multi-stage build. The build stage installs with pnpm (dependency layer cached on the lockfile) and runs the Next.js production build; the runtime stage ships only the standalone server, runs as a non-root user, has a container healthcheck and keeps game saves on a `/data` volume.
- **`docker-compose.yml`:** runs the published image (or builds it locally) on port 3000 with a named volume for saves.
- **`.github/workflows/ci.yml`:** the pipeline above. The image is only published after the checks and the container smoke test pass.

Run it with Docker:

```bash
echo "MS_SEED_KEY=$(openssl rand -hex 32)" > .env   # secret that seals career seeds; .env is gitignored
docker compose up -d --build                        # or without --build to pull the published image
open http://localhost:3000/games/market-survivor
docker compose logs -f web                          # logs; `docker compose down` to stop (saves stay in the volume)
```

## Disclaimer

Market Survivor is an educational game. Prices, events and performance in the game are **generated for a fictional world** and do not represent current, historical or predicted market prices. Time Machine scenarios borrow only the general shape of past market episodes, never real prices.

- **Not a broker, adviser or exchange.** The game does not execute securities transactions and is not a stock broker, investment adviser, research analyst or exchange.
- **Not investment advice.** Nothing in the game, its lessons or its debriefs is a recommendation to buy, sell or hold any security. For personalised advice, consult a SEBI-registered investment adviser.
- **Virtual coins have no value.** They cannot be bought, sold, transferred, redeemed or withdrawn, and no real-money or real-value prizes are offered.
- **Fictional names.** Every company, fund, coin and index is fictional. Any resemblance to a real entity is coincidental.
- **No affiliation.** The game and its makers are not affiliated with or endorsed by SEBI, any stock exchange, index provider, broker or listed company.
- **18+ only.** Play is limited to adults who accept the Terms (an age and Terms gate runs before any career is created).
- **No guarantees.** Results in the game say nothing about how you would do with real money. Real investing carries the risk of loss.

## Warnings for contributors

These rules keep the project on the safe side of securities, gaming and consumer-protection law (see [`docs/legal/`](docs/legal) and [`docs/legal-compliance-review-2026-10-15.md`](docs/legal-compliance-review-2026-10-15.md)). Do not merge changes that break them.

1. **No real company, index, exchange or broker names**, logos or tickers in the game world.
2. **No real or live market price data.** Prices come from the engine only.
3. **No real money anywhere.** No purchasable or redeemable coins, cash prizes, gift cards, paid entry, paid coin packs, or broker-funded or referral rewards.
4. **No advice.** No tips, signals or "buy/sell/hold" recommendations about real securities, and no language implying guaranteed returns or learning outcomes.
5. **Keep the disclaimer on every screen** (`DISCLAIMER` in `apps/web/src/lib/modes.ts`) and the 18+ / Terms gate in place.
6. **Never commit personal data or secrets:** player saves and grievances (`apps/web/.data/`), `.env` files, keys and tokens are gitignored for that reason.
7. **Get legal sign-off before a public launch.** The legal pages (`/terms`, `/privacy`, `/licences`, `/contact`) are drafts with `TODO` markers and need review by qualified counsel.

## Licence

No licence file has been added yet. Until one is, the code is not licensed for reuse. Third-party fonts and libraries keep their own licences (listed on the in-game `/licences` page).
