# Product: Market Survivor

- **Platform:** web, desktop + mobile (mostly phones, 16–28 year olds). Module of the main games site.
- **Stack:** Next.js App Router + TypeScript + Tailwind v4 (custom CSS layer), Zustand; pure TS engine package; three.js via React Three Fiber for the Market City (lazy-loaded); lightweight-charts for candles; Blender (scripted) for pre-rendered art.
- **Users:** new investors who learn by losing real money in their first crash.
- **Purpose:** feel that markets are connected — a war, a rate hike or a bank failure moves every market at once — with virtual coins only.
- **Operating context:** short sessions on mid-range Android phones; long sessions on laptops. Must stay fast on 4G.
- **Constraints:** server-authoritative money; no real-time exchange data; real company names move only on sector/macro factors; disclaimer on every trading screen.
- **Evidence on hand:** full spec in `docs/spec/`; engine + API tests; playable Phase 1 (Stocks desk).

## Principles
1. **See the connection.** Every shock must be visible across the whole market, not just in one number.
2. **Numbers stay honest and readable.** 3D is a lens on the data, never a replacement for it.
3. **Calm by default, dramatic when the market is.** Restraint until the world state changes.
4. **Never a casino.** Learning cards for panic, no hype, no gambling cues.
