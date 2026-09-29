# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · cost card: `background.js`, `cost-policy.js`, `options.html` / `options.js`,
`popup.html` / `popup.js`, `version-history.js`, `tests/hardening.test.js` · `2.1.3`.

## What changed
- 2.1.0 to 2.1.1: the ledger charges every billed request (`geminiCall` `policy.onBilled`,
  `usageOf`, `trackText`), tokens by kind and `byModel`, `costHistory` by Google's Pacific day.
- 2.1.3: display currency. `cost-policy.js` owns `FX` (26,020 on 2026-09-29), `MONEY_DEFAULTS`
  (`costCurrency` both, `costUsdVnd`, `costExtraPct`), `moneyOpts`, `money`, `formatUsd/Vnd`.
  Budgets stay USD in storage; in the VND view `options.js` shows and takes đồng (`budgetUsd` is
  the state). Popup loads `cost-policy.js` and reads the same keys.
- 2.1.3: a timed-out translation is not aborted: `policy.onLate` + `LATE_WAIT_MS` 120 s; the
  late answer's real usage replaces the estimate (`trackText(meta, model, u, prev)`, `lateCalls`).
- 2.1.3: KPI tiles (today, month by Google day, projection from 3 recorded days, per call), a
  daily budget meter; `.content-area { min-width: 0 }` stops wide tables overflowing the page.
- 2.1.2 (other session): `SYNC.duckAttackTicks` 4, duck under a voice already sounding.

## State
- Tests: 576 pass, 0 fail, 1 skip. Reload: **yes** (`chrome://extensions`).
- 2.0.8 / 2.0.9 / 2.1.2 duck changes not heard by ear yet.

## Unfinished / in progress
- User to compare the card with AI Studio; still far off: key shared elsewhere, or BACKLOG 37.
- BACKLOG 16: verbs outside the list; RAN-ON needs the BACKLOG 15 lead. BACKLOG 7: user's call.
- Carried over: VieNeu renders (BACKLOG 15 breath lead) and the live harness (`?script=stress`,
  `viewer2`) need the local server, i.e. the user's yes for work outside the sandbox;
  "Chép chẩn đoán" right after a problem; BACKLOG 36; glossary keep-English per term not watched
  in Chrome; BACKLOG 30, 31, 14-15, 18-24, 26, 28; verdict on the 1.9.5 A/B WAVs; Udemy / edX
  (BACKLOG 9); a live YouTube check by the user; user: Apple Events JS off in Chrome.

## Traps hit this session
- 68d9ebd (2.1.3, cost) swept in the duck session's unfinished `dub-engine.js` bridge change
  (`next.pending`, "2.1.3" comment): tests passed with it; that session must renumber. Stage by path.
- The live ledger can be read offline from Chrome's leveldb:
  `~/Library/Application Support/Google/Chrome/Profile 42/Local Extension Settings/<ext id>/*.log`.

## Suggested next step
- Compare the card's Google-day table with AI Studio for one day.
