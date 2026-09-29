# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `background.js` (D), `cost-policy.js` (D), `options.html` / `options.js` / `popup.js`
/ `version-history.js` (C, cost card), `tests/hardening.test.js` · `2.1.1`.

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

## State
- Tests: my paths 574 pass, 0 fail, 1 skip (checked in a clean copy). In the shared tree one
  dub test fails from another session's uncommitted `dub-engine.js` / `tests/dub.test.js` work,
  which this commit leaves out. Reload: **yes** (`chrome://extensions`).
- 2.0.8 / 2.0.9 duck ramps not heard by ear yet.

## Unfinished / in progress
- Ask the user to compare the card's token totals with AI Studio after a day. If still far off:
  other apps on the same key, or BACKLOG 37 (tight timeout, wasted billed calls).
- BACKLOG 16: verbs outside the list; RAN-ON needs the BACKLOG 15 lead. BACKLOG 7: user's call.
- Carried over: VieNeu renders (BACKLOG 15 breath lead) and the live harness (`?script=stress`,
  `viewer2`) need the local server, i.e. the user's yes for work outside the sandbox;
  "Chép chẩn đoán" right after a problem; BACKLOG 36; glossary keep-English per term not watched
  in Chrome; BACKLOG 30, 31, 14-15, 18-24, 26, 28; verdict on the 1.9.5 A/B WAVs; Udemy / edX
  (BACKLOG 9); a live YouTube check by the user; user: Apple Events JS off in Chrome.

## Traps hit this session
- Another session edits `dub-engine.js` in this folder at the same time: commit your own paths.
- Options preview on the `static` server caches old JS: `fetch(url, {cache: "reload"})` first.
- The live ledger can be read offline from Chrome's leveldb:
  `~/Library/Application Support/Google/Chrome/Profile 42/Local Extension Settings/<ext id>/*.log`.

## Suggested next step
- Compare the card's Google-day table with AI Studio for one day (see Unfinished).
