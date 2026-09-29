# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · two sessions: cost card (`background.js`, `cost-policy.js`, `options.*`, `popup.js`,
2.1.1) and the duck attack (`dub-engine.js`, `tests/dub.test.js`, 2.1.2) · `2.1.2`.

## What changed
- 2.1.0: the ledger undercounted (user: real bill much higher). `geminiCall` now calls
  `policy.onBilled(data)` for every answered request and `onBilled(null)` on our own timeout
  (Google still bills it); `usageOf()` -> tokens, `trackText()` -> ledger. Test-key calls count.
- 2.1.1: `usageOf` learns chars-per-token from real calls (`tokenRatio`) for the estimates;
  `estPrice.cache` + `estimateTextCost(..., cachedTok)` for implicit-cache tokens; stats gain
  `thoughtTok`, `cachedTok`, `byModel`; `costHistory` by Pacific day (31 days, survives Reset);
  `costStats` returns `model`, `history`, `pacificToday`. Settings: per-model table, token-kind
  table (only with one model), 7-day Google-day table. Popup: calls instead of "phút giọng AI".
- Prices checked 2026-09-29: 3.1 Flash-Lite 0.25 / 1.50 / cache 0.025; 3.8 Flash 0.75 / 3.75.
- 2.1.2: `SYNC.duckAttackTicks` 4: under a voice already sounding the original comes down in 0.2 s
  (lines not announced ahead: -6.1 -> -9.6 dB in their first 0.45 s); pre-duck and way up unchanged.

## State
- Tests: 574 pass, 0 fail, 1 skip. Reload: **yes** (`chrome://extensions`).
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
- Two sessions bumped at once: cbcc311 (2.1.1) carried the duck session's manifest 2.1.2 and its
  doc and history lines; the duck code followed in the next commit. Check `git status` before a bump.
- The live ledger can be read offline from Chrome's leveldb:
  `~/Library/Application Support/Google/Chrome/Profile 42/Local Extension Settings/<ext id>/*.log`.

## Suggested next step
- Compare the card's Google-day table with AI Studio for one day.
