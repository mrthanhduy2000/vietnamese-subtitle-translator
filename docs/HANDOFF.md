# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lane B (`dub-engine.js`) + D (`background.js`, `tools/playback-sim.js`, tests) · `1.8.6`.
User asked: speech delivery / playback intelligence (seek, pause, gaps, reuse), no paid API, no
prosody or pronunciation work.

## What changed
- `background.js` `synthesizeLocalOnce`: a page abort no longer cuts a VieNeu request the server has
  started (`LOCAL_KEEP_RUNNING_S` 4; cold server still cut). VieNeu holds its only slot ~4-5 s after a
  client leaves; `server.log` showed 11 of 23 aborts blocking the seek target 3-5 s. `DANGER.md` 15.
- `dub-engine.js`: `hardReset` keeps the cut when audio at the landing point is held
  (`audioReadyAt`, `headPinned`); `unreachable` skips lines that cannot arrive in time after a
  start/seek (measured rtf only); pause no longer cancels (`prefetchAhead(true)`); `releaseAudio`
  frees elements after a line and on reset; `stop()` aborts queued jobs; `debugSnapshot().delivery`
  scorecard. Details and numbers: `DUBBING.md` "Delivery".
- `tools/playback-sim.js`: offline delivery simulator (real engine + provider, modelled SW + server).

## State
- Tests: 520 pass, 0 fail, 1 skip (run the `scripts.test` command directly; `npm test` in the sandbox
  pings the registry). Reload: **yes** + F5 video tabs. No cache key changed, nothing re-renders.
- Real Chrome (`tests/harness/smooth.html` on the other session's :8765 server): voice 15-27 ms after
  seeks onto held audio, 0 overlap, <= 2 elements with a source.

## Unfinished / in progress
- Not watched on a real YouTube video yet: seek back, seek into prefetched audio, pause/resume.
  `localStorage.cstDubDebug = "1"` shows `delivery` in `<html data-cst-dub>`.
- New backlog 32-34 (first line at 2x before rtf is known, RTF ~0.9 chase, proportional mid-line entry).
- Carried over: glossary keep-English vs Vietnamese per term not yet watched in Chrome (ask the user
  after a lecture or two); nobody compared real Gemini output before/after 1.8.3/1.8.4;
  `BACKLOG.md` 30, 31, 14, 15, 16, 18, 19, 20, 21-24, 26-28; 1.7.2 to 1.8.6 not verified end to end
  in real Chrome; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- Another session worked in this folder at the same time and its `git add -A` swept this session's
  half-written `tools/playback-sim.js` into b51c446. Commit your own paths.
- The simulator's gap metric must skip line pairs with a seek between them, or recoveries look like gaps.

## Suggested next step
- Watch one video with dubbing on and seek back and forth a few times; check `delivery.recoverMs`.
