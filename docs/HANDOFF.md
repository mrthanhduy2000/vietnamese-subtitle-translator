# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · `dub-engine.js` (lane B), `tests/dub.test.js`, `version-history.js`, docs · `2.0.1`.

## What changed
- Found live (`tests/harness/live.html`, real VieNeu): an ad that comes while the voice rests
  after a finished line, its subtitle still up, made the engine read that line's tail again after
  the ad (from 4.63 s of the take). `adGate` now keeps `adCut = { done: true }` and `takeAdResume`
  restores `lastSpokenStart` / `lastSpokenId` (`stats.adKeptPlace`). New test fails on 2.0.0.
  Live rerun: no replay, next line on time, worst lag 0.61 s (2.0.0 run: 5.96 s).
- Live check of 2.0.0 otherwise clean: 0 errors, 0 overlapping voices, voice 0.07-1.3 s after seeks.
- Not done, on purpose: BACKLOG 24 (caps against the English source line). There is no paired
  English/Vietnamese data with caps to measure it on (speech corpus has no source lines for those
  items, server.log holds no text), and the rule could break "ML" written for "machine learning".
- A mid-session mistake, undone: work supporting the VieNeu fast-release patch was started before
  reading the user's decline (BACKLOG 37). It was reverted uncommitted; nothing of it is in git.

## State
- Tests: 566 pass, 0 fail, 1 skip. Reload: **yes**, at `chrome://extensions`.

## Unfinished / in progress
- Carried over: ask the user for "Chép chẩn đoán" right after a problem; BACKLOG 38 leads left
  (`jobRemain`'s 0.3 s floor, the worker retrying a stuck take), low yield so far; BACKLOG 36;
  glossary keep-English per term not watched in Chrome; real Gemini output before/after 1.8.3/1.8.4
  not compared; BACKLOG 30, 31, 14-15, 18-24, 26, 28 (20 outside); the user's verdict on the 1.9.5
  A/B WAVs; 1.7.9 duck fix not confirmed; Udemy / edX (BACKLOG 9).
- The user should turn Chrome's "Allow JavaScript from Apple Events" back off.
- A stray backup `~/VieNeu-TTS/apps/openai_speech.py.cst-before-fast-release` (identical to the
  server file, harmless) was left by an earlier session of this one; the user may delete it.

## Traps hit this session
- Read `git log` again before continuing after a break: another session may have committed (here it
  recorded a user decision that made the work in hand wrong).
- A sim test with 2.5 s takes cannot show a re-entered tail: entry drops a tail under 0.8 s. Use
  takes near real length (5 s) when testing entry after a reset.
- Live harness: restart the server between compared runs and close old tabs.

## Suggested next step
- `?script=stress` on the live harness after any engine change; a live YouTube check by the user.
