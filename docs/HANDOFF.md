# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · lane B (`dub-engine.js`) · `1.9.2`. User asked again to go deeper; no API change.

## What changed
- 1.9.2 duck across a Reload: old and new content scripts ducked the same `<video>` and took each
  other's ducked level as the user's (YouTube left at 0.01 of 0.80). `<video>` attributes
  `data-cst-duck-owner` / `-base` (`claimVolume`, `ownsVolume`, `releaseVolume`); a superseded engine
  stops at its next tick. 4 tests fail on 1.9.1; checked in real Chrome (smooth.html page, two
  engines, one element). `DUBBING.md` "1.9.2", `DANGER.md` §3.
- 1.9.1 `liveStalled` (system voice), 1.9.0 `onPlayFailed` + `decodeWav` checks, 1.8.9
  service-worker races, 1.8.6 to 1.8.8 delivery and resilience. All in `DUBBING.md`.

## State
- Tests: 547 pass, 0 fail, 1 skip (run `scripts.test` directly; `npm test` in the sandbox pings the
  registry). Reload: **yes** + F5 video tabs. No cache key changed. Simulator output unchanged.

## Unfinished / in progress
- 1.8.6 to 1.9.2 not watched on a real YouTube video: seek back and forth, pause/resume, 2x.
  `localStorage.cstDubDebug = "1"` shows `delivery` in `<html data-cst-dub>`.
- `BACKLOG.md` 33 (server near real time still chases) is open; 32 and 34 are fixed.
- Carried over: glossary keep-English vs Vietnamese per term not yet watched in Chrome (ask the user
  after a lecture or two); nobody compared real Gemini output before/after 1.8.3/1.8.4;
  `BACKLOG.md` 30, 31, 14, 15, 16, 18, 19, 20, 21-24, 26-28; 1.7.2 to 1.9.2 not verified end to end
  in real Chrome; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- Another session may run in this folder (it swept a half-written file into b51c446, and its static
  server on :8765 disappears when it ends): commit your own paths, restart `static` if needed.
- The `bgEnv` fake fetch ignores abort signals: check `signal.aborted` yourself before a send.
- The bump carries at 9: 1.8.9 -> 1.9.0, not 1.8.10. Name versions in comments after bumping.

## Suggested next step
- Watch one video with dubbing on, seek into the middle of lines and rewind a few minutes; open
  one in a fresh tab without clicking to see whether the play-blocked badge ever shows.
