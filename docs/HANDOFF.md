# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `2.2.6` review passes 2.2.3-2.2.6: `background.js` (Google fallback, key test),
`youtube.js`, `dub-speech.js`, `popup.js`, `lang-detect.js`, `subtitle-edits.js`, `transcript.js`,
`vi-quality.js`, tests, `docs/BACKLOG.md`.

## What changed
- 2.2.3 `googleTranslateAll`: one Google request per window, split by line (gtx keeps "\n", checked
  live); a sentence failing everywhere is "" not a failed window; clients5 `[[text, lang]]` parsed.
- 2.2.4 `dub-speech.js`: `VI_CAPS` + Vietnamese abbreviations/tickers (DN, NHNN, SGK, HPG, ThS...);
  `englishCaps` reads an unknown code the English source lacks as Vietnamese; `EN_SPELLED` keeps
  PDF, URL, QA... English. Popup: `idleLabel` keeps "Dịch lại", `activationError` plain Vietnamese.
- 2.2.5 `handleTestKey` clears `keyBlock` for that key first (a real re-check after fixing billing).
- 2.2.6 `VI_ONLY` drops ã, ă (Portuguese was read as Vietnamese and skipped); `keyNear` in
  `subtitle-edits.js` (save/revert/remove find a moved line); `srtClock` carries ms; `fileName` đ.
- BACKLOG 24 and 37 closed (37 measured: 0 late of 268 calls, Sep 28-29 ledger).

## State
- Tests: 593 pass, 0 fail, 1 skip. Reload: **yes** (`chrome://extensions`).
- Ledger read-only at `~/Library/Application Support/Google/Chrome/Profile 42/Local Extension
  Settings/<id>/` with `strings | grep`: ~940 input tokens per call, 0 thinking, 0 cached (prompt
  under Gemini's implicit-cache minimum, nothing to gain there).

## Unfinished / in progress
- Carried over: AI Studio vs cost card, compare one full Pacific day after a Reload.
- Carried over: the live harness (`?script=stress`, `viewer2`) needs the local server; the
  classifier blocks it here, so the user runs it; "Chép chẩn đoán" right after a problem; BACKLOG
  36; glossary keep-English per term not watched in Chrome; BACKLOG 9, 14-16, 18-23, 26-31, 39; verdict
  on the 1.9.5 A/B WAVs; a live YouTube listen by the user (now also: DN, NHNN read Vietnamese).
  Never ask about Apple Events JS or hand decisions back (memory).
- Not fixable in this repo: 20, 33, 36, 39 (server / Mac), 9 (needs logged-in Udemy/edX), 11, 13, 28
  (paid voice, off), 5 and 8 (intentional).

## Traps hit this session
- Node `fetch` in the sandbox fails on certificates; `curl` with `allowed_domains` works.
- BACKLOG uses 37 twice (declined VieNeu patch, closed timeout): cite it with its title.

## Suggested next step
- After a Reload, compare one full Pacific day (card vs AI Studio Usage); a YouTube listen.
