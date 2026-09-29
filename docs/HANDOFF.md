# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `2.2.3` general review pass: `background.js` (Google fallback), `youtube.js` (dead-copy
cleanup), `tests/cost.test.js` (+3 tests), `version-history.js`, `docs/DANGER.md` §layers.

## What changed
- 2.2.3 Google fallback (`googleTranslateAll`): one request per window, one sentence per line, split
  back by line (verified live: gtx keeps "\n" per segment); wrong line count -> per sentence as
  before. A sentence failing everywhere is "" instead of failing the window (page retries that line).
- `fetchSingleEndpoint`: clients5 answers `[[text, lang]]`; the old parser appended "en" to the line.
- `youtube.js` `ytTheoDoi`: the 800 ms nav poll and its listeners stop when the copy dies (`navUnwatch`).
- Earlier today (2.1.x-2.2.2): cost ledger exactness, breathing commas, duck, per-key model access.

## State
- Tests: 588 pass, 0 fail, 1 skip. Reload: **yes** (`chrome://extensions`).
- Reviewed and left as is: `geminiCall` retry/cooldown, popup, storage sweeps (`ytDonCache` daily),
  Coursera window workers. No defect found there.

## Unfinished / in progress
- Carried over: AI Studio vs cost card, compare one full Pacific day after a Reload (Chrome still
  ran 2.1.9 on 2026-09-29; Google's Sep 28 hour matched the card 4 = 4).
- BACKLOG 16: verbs outside the list. BACKLOG 7 closed, 39 decided (not now).
- Carried over: the live harness (`?script=stress`, `viewer2`) needs the local server; the user
  said yes, but the classifier blocks it here, so the user runs it or adds a permission rule;
  "Chép chẩn đoán" right after a problem; BACKLOG 36; glossary keep-English per term not watched
  in Chrome; BACKLOG 30, 31, 14-15, 18-24, 26, 28; verdict on the 1.9.5 A/B WAVs; Udemy / edX
  (BACKLOG 9); a live YouTube listen by the user. Never ask about Apple Events JS or hand decisions back (memory).
- Not done, low value: popup resets its button label to "Bắt đầu dịch bài giảng" after success even
  when the page is already translated.

## Traps hit this session
- Node's `fetch` in the sandbox fails on certificates; `curl` with `allowed_domains` works for a
  live check of an endpoint.
- Two sessions in one tree (earlier): stage by path, check `git status` and the manifest version
  just before a bump.

## Suggested next step
- After a Reload, compare one full Pacific day (card vs AI Studio Usage); a YouTube listen of 2.1.5.
