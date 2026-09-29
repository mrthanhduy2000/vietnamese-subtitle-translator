# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `background.js` (D), `cost-policy.js` (D), `options.html` / `options.js` /
`version-history.js` (C, the cost card), `tests/hardening.test.js` · `2.1.0`.

## What changed
- 2.1.0: the cost ledger undercounted (user: the real Google bill is much higher). Only the last,
  kept pass of a translation was charged. Now `geminiCall` calls `policy.onBilled(data)` for every
  answered request and `onBilled(null)` on our own timeout (Google still bills it); `usageOf()`
  turns that into tokens (estimate ~3 chars/token when usage is missing). `trackText()` adds
  `inTok`, `outTok` (thinking included), `estCalls`. Test-key calls are charged too.
- `costStats` now returns `model` (what "auto" resolves to for the key, with `estPrice`).
- Settings card: model + price, token totals for AI Studio, no paid-voice text, Pacific-day note.
- Prices re-checked on the Pricing page 2026-09-29: 3.1 Flash-Lite 0.25 / 1.50 (unchanged);
  3.8 Flash was wrong, now 0.75 / 3.75.

## State
- Tests: 573 pass, 0 fail, 1 skip. Reload: **yes**, at `chrome://extensions`.
- 2026-09-28, old ledger: 254 calls, 0.1127 USD. 2.0.8 / 2.0.9 duck ramps not heard by ear yet.

## Unfinished / in progress
- Ask the user to compare the card's token totals with AI Studio after a day. If still far off:
  other apps on the same key, or BACKLOG 37 (tight timeout, wasted billed calls).
- BACKLOG 16: verbs outside the list; RAN-ON needs the BACKLOG 15 lead. BACKLOG 7: user's call.
- Carried over: VieNeu renders (BACKLOG 15 breath lead) and the live harness (`?script=stress`,
  `viewer2`) need the local server, i.e. the user's yes for work outside the sandbox;
  "Chép chẩn đoán" right after a problem; BACKLOG 36; glossary keep-English per term not watched
  in Chrome; BACKLOG 30, 31, 14-15, 18-24, 26, 28; verdict on the 1.9.5 A/B WAVs; Udemy / edX
  (BACKLOG 9); a live YouTube check by the user (also confirms the 1.7.9 duck fix).
- The user: Chrome's "Allow JavaScript from Apple Events" back off; may delete
  `~/VieNeu-TTS/apps/openai_speech.py.cst-before-fast-release`.

## Traps hit this session
- Inserting a statement between `if (timedOut) ...;` and its `else if` in `geminiCall` re-bound
  the `else` and turned TTS timeouts into "aborted". Use braces there.
- The live ledger can be read offline from Chrome's leveldb:
  `~/Library/Application Support/Google/Chrome/Profile 42/Local Extension Settings/<ext id>/*.log`.

## Suggested next step
- Get the user's AI Studio token figures for one day and compare with the card (see Unfinished).
