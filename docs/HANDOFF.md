# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · lane B (`dub-engine.js`, `dub-audio.js`, `dubbing.js` badge) · `1.9.0` (carry from
1.8.9). User asked again to go deeper; no API change.

## What changed
- 1.9.0 `onPlayFailed`: play() refusals by error name, reproduced first (`dub.test.js`, fail on
  1.8.9). AbortError not a provider error (8 -> 0 in 30 s); NotAllowedError retried each
  `SYNC.playRetryMs`, badge warns via `status().playBlocked` (282 -> 25 calls / 20 s); other errors
  drop the take and reschedule the line (51 calls -> 1, line made again). `decodeWav` refuses bad
  headers with `code: "wav_invalid"`. Details: `DUBBING.md` "1.9.0".
- 1.8.9 (same night): service-worker races (dropped queued job answers at once, seek-back re-asks,
  early stop kept, VieNeu errors by stage, request validation), page cache recency. "1.8.9".
- 1.8.6 to 1.8.8 (27/09): delivery, seek entry at a word gap, lookup timeout, job watchdog.

## State
- Tests: 539 pass, 0 fail, 1 skip (run `scripts.test` directly; `npm test` in the sandbox pings the
  registry). Reload: **yes** + F5 video tabs. No cache key changed. Simulator output unchanged.

## Unfinished / in progress
- 1.8.6 to 1.9.0 not watched on a real YouTube video: seek back and forth, pause/resume, 2x.
  `localStorage.cstDubDebug = "1"` shows `delivery` in `<html data-cst-dub>`.
- `BACKLOG.md` 33 (server near real time still chases) is open; 32 and 34 are fixed.
- Carried over: glossary keep-English vs Vietnamese per term not yet watched in Chrome (ask the user
  after a lecture or two); nobody compared real Gemini output before/after 1.8.3/1.8.4;
  `BACKLOG.md` 30, 31, 14, 15, 16, 18, 19, 20, 21-24, 26-28; 1.7.2 to 1.9.0 not verified end to end
  in real Chrome; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- Another session may run in this folder (it swept a half-written file into b51c446, and its static
  server on :8765 disappears when it ends): commit your own paths, restart `static` if needed.
- The `bgEnv` fake fetch ignores abort signals: check `signal.aborted` yourself before a send.

- The bump carries at 9: 1.8.9 -> 1.9.0, not 1.8.10. Name versions in comments after bumping.

## Suggested next step
- Watch one video with dubbing on, seek into the middle of lines and rewind a few minutes; open
  one in a fresh tab without clicking to see whether the play-blocked badge ever shows.
