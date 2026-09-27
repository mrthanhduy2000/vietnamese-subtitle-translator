# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lane B (`dub-engine.js`) + D (`tools/playback-sim.js`, `tests/dub.test.js`) · `1.8.7`.
User asked: go deeper on speech delivery after 1.8.6 (no paid API, no prosody/pronunciation work).

## What changed
- Clean entry after a seek: `findStops` (gaps >= `SYNC.entryStopMs` 40 ms, at `addRendered`) and
  `entryPoint` (back <= 1.2 s, else ahead <= 0.8 s). 25 real takes, 1,509 landings: inside a
  syllable 1,277 -> 4. Real Chrome: 3 of 3 seeks entered at a gap.
- Store before re-cut: `headProbe` / `resolveHeadProbe` look the landing lines up under the current
  cut before the head cut. Simulated 3-min rewind 0.95 -> 0.1 s.
- `unreachable` has an optimistic prior before any measurement (`reachOverheadMin`, `reachRtfMin`):
  first voice at 2x 2.75 -> 1.75 s, 1x unchanged.
- 1.8.6 (previous turn): VieNeu request not cut once started (`background.js`), seek onto held audio
  keeps the cut, pause keeps work, elements released. All in `DUBBING.md` "Delivery".

## State
- Tests: 522 pass, 0 fail, 1 skip (run `scripts.test` directly; `npm test` in the sandbox pings the
  registry). Reload: **yes** + F5 video tabs. No cache key changed.

## Unfinished / in progress
- 1.8.6 / 1.8.7 not watched on a real YouTube video: seek back and forth, pause/resume, 2x.
  `localStorage.cstDubDebug = "1"` shows `delivery` in `<html data-cst-dub>`.
- `BACKLOG.md` 33 (server near real time still chases) is open; 32 and 34 are fixed.
- Carried over: glossary keep-English vs Vietnamese per term not yet watched in Chrome (ask the user
  after a lecture or two); nobody compared real Gemini output before/after 1.8.3/1.8.4;
  `BACKLOG.md` 30, 31, 14, 15, 16, 18, 19, 20, 21-24, 26-28; 1.7.2 to 1.8.7 not verified end to end
  in real Chrome; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- Another session may run in this folder (it swept a half-written file into b51c446, and its static
  server on :8765 disappears when it ends): commit your own paths, restart `static` if needed.
- The real takes for `smooth.html` live in the git-ignored `tests/harness/smooth/`; tests use the
  three Mỹ Duyên takes in `tests/audio/` instead.

## Suggested next step
- Watch one video with dubbing on, seek into the middle of lines and rewind a few minutes.
