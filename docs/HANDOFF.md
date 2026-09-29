# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · cost card: `background.js`, `cost-policy.js`, `options.html` / `options.js`,
`popup.html` / `popup.js` (2.1.3); dubbing: `dub-prosody.js` `BREATH`, `tests/prosody.test.js`,
`tests/dub.test.js`, `docs/DUBBING.md` / `BACKLOG.md`, `version-history.js` (2.1.5) · `2.1.5`.

## What changed
- 2.1.0 to 2.1.1: ledger charges every billed request (`policy.onBilled`), `costHistory` by Pacific day.
- 2.1.3: display currency. `cost-policy.js` owns `FX` (26,020 on 2026-09-29), `MONEY_DEFAULTS`
  (`costCurrency` both, `costUsdVnd`, `costExtraPct`), `moneyOpts`, `money`, `formatUsd/Vnd`.
  Budgets stay USD in storage (`budgetUsd`); the VND view shows and takes đồng; popup reads the same.
- 2.1.3: a timed-out translation is not aborted: `policy.onLate` + `LATE_WAIT_MS` 120 s; the
  late answer's real usage replaces the estimate (`trackText(meta, model, u, prev)`, `lateCalls`).
- 2.1.3: KPI tiles, daily budget meter; `.content-area { min-width: 0 }` stops table overflow.
- 2.1.5: `BREATH` 0.35 / 18 (was 0.6 / 20), judged on 100 real VieNeu takes each way: RAN-ON
  18/60 -> 0/60, WRONG 2 -> 0, +0.7% length. Rendered by the user in their Terminal (`$TMPDIR/br/ab.js`).
- Duck: 2.1.2 `duckAttackTicks` 4; 2.1.4 (code in 2.1.3) `nextVoiceAt` counts a take still being
  made (`next.pending`, bridge only): slow-matrix pumps 197 -> 8, delivery identical.

## State
- Tests: 577 pass, 0 fail, 1 skip. Reload: **yes** (`chrome://extensions`).
- Not heard by ear yet: duck changes 2.0.8 to 2.1.4, breath commas 2.1.5.

## Unfinished / in progress
- User to compare the card with AI Studio; still far off: key shared elsewhere, or BACKLOG 37.
- BACKLOG 16: verbs outside the list. BACKLOG 7: user's call.
- Carried over: the live harness (`?script=stress`, `viewer2`) needs the local server; the user
  said yes, but the classifier blocks it here, so the user runs it or adds a permission rule;
  "Chép chẩn đoán" right after a problem; BACKLOG 36; glossary keep-English per term not watched
  in Chrome; BACKLOG 30, 31, 14-15, 18-24, 26, 28; verdict on the 1.9.5 A/B WAVs; Udemy / edX
  (BACKLOG 9); a live YouTube check by the user; user: Apple Events JS off in Chrome.

## Traps hit this session
- Two sessions in one tree: each commit swept in the other's files twice (cbcc311, 68d9ebd). Stage
  by path, and check `git status` and the manifest version just before a bump.
- Live ledger offline: Chrome leveldb, `Profile 42/Local Extension Settings/<ext id>/*.log`.

## Suggested next step
- Compare the card's Google-day table with AI Studio for one day; a YouTube listen of 2.1.5.
