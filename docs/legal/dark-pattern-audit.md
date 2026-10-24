# Dark-pattern self-audit (legal review L-17)

Checked against the 13 patterns in the CCPA *Guidelines for Prevention and Regulation of Dark Patterns, 2023*.
Audited build: TASK-004, 2026-10-17. Re-run this audit before launch and whenever money, ads, accounts or
notifications are added. Counsel should confirm the conclusions.

| # | Pattern | Where it could appear | Finding |
|---|---|---|---|
| 1 | False urgency | Daily Challenge, Time Machine | **None.** No countdowns or "only N left". The Daily card says when the next market opens; nothing expires early. |
| 2 | Basket sneaking | — | **N/A.** Nothing is sold. |
| 3 | Confirm shaming | Consent gate, Delete my data, tour | **None.** No guilt-tripping decline copy. "Skip tour" is a plain button; the delete confirm states facts only. |
| 4 | Forced action | Consent gate | **Acceptable.** Play is blocked until the player confirms 18+ and accepts the Terms. That is a legal precondition, not a push to buy or share extra data. Both boxes start unticked. |
| 5 | Subscription trap | — | **N/A.** No subscriptions. |
| 6 | Interface interference | Consent gate, delete flow | **None.** "Start playing" stays disabled until both boxes are ticked; "Delete my data" sits in every footer, not hidden. |
| 7 | Bait and switch | Mode cards | **Watch.** Story Mode shows 10 chapters but only Chapter 1 is playable; the others are labelled "Coming soon" on the chapter map. Keep that label visible. |
| 8 | Drip pricing | — | **N/A.** No prices. Simulated brokerage charges are shown before each order. |
| 9 | Disguised advertisement | Stock universe, Academy | **None.** All companies are fictional; no sponsored content, affiliate links or broker promotions. |
| 10 | Nagging | Tour, story briefing | **None.** The tour shows once (`ms-tour-done`), the briefing once per chapter; both replayable on request only. No push notifications. |
| 11 | Trick question | Consent checkboxes, Academy quiz | **None.** Checkbox copy is affirmative and single-meaning. Quiz answers are spread evenly across positions (9/9/9). |
| 12 | SaaS billing | — | **N/A.** No billing. |
| 13 | Rogue malware | — | **None.** No third-party scripts, trackers or downloads. |

## Things that would change this audit
- Adding in-app purchases, coins for cash, ads, rewarded video, leaderboards with prizes, referral rewards or
  email/push reminders. Each needs a fresh pass (and most would also reopen the SEBI and online-gaming items).
- Any streak or "don't lose your progress" messaging on the Daily Challenge.
