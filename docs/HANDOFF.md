# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lane B (`dub-engine.js`) + D (`background.js`, tests) · `1.8.8`. User asked: harden
(errors, timeouts, races, validation), then performance, then an adversarial review; no API change.

## What changed
- 1.8.8 resilience, each reproduced first (`dub.test.js` "resilience", fail on 1.8.7): lookup
  timeout (`SYNC.lookupTimeout`), job watchdog (`orphanStallMs`, `jobStallMs`, `pending` Map owned
  by jobId), hits dropped after `stop()` or for a re-translated line, `audioLength` validation,
  `countError` kinds, VieNeu provider `no_response` / `invalid`. `background.js` store reads run
  together (wedged IndexedDB, 12 keys: 18 s -> 1.5 s). Details: `DUBBING.md` "1.8.8 resilience".
- Perf measured, not changed: tick 17 us on a 60-min lecture, max 6 ms on a plan rebuild.
- 1.8.6/1.8.7 (earlier today): seek entry at a word gap, store before re-cut, VieNeu request not
  cut once started, pause keeps work, elements released. `DUBBING.md` "Delivery".

## State
- Tests: 528 pass, 0 fail, 1 skip (run `scripts.test` directly; `npm test` in the sandbox pings the
  registry). Reload: **yes** + F5 video tabs. No cache key changed. Simulator: happy paths identical.

## Unfinished / in progress
- 1.8.6 to 1.8.8 not watched on a real YouTube video: seek back and forth, pause/resume, 2x.
  `localStorage.cstDubDebug = "1"` shows `delivery` in `<html data-cst-dub>`.
- `BACKLOG.md` 33 (server near real time still chases) is open; 32 and 34 are fixed.
- Carried over: glossary keep-English vs Vietnamese per term not yet watched in Chrome (ask the user
  after a lecture or two); nobody compared real Gemini output before/after 1.8.3/1.8.4;
  `BACKLOG.md` 30, 31, 14, 15, 16, 18, 19, 20, 21-24, 26-28; 1.7.2 to 1.8.8 not verified end to end
  in real Chrome; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- Another session may run in this folder (it swept a half-written file into b51c446, and its static
  server on :8765 disappears when it ends): commit your own paths, restart `static` if needed.
- The real takes for `smooth.html` live in the git-ignored `tests/harness/smooth/`; tests use the
  three Mỹ Duyên takes in `tests/audio/` instead.

## Suggested next step
- Watch one video with dubbing on, seek into the middle of lines and rewind a few minutes.
