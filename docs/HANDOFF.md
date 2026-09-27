# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · lane D (`background.js`, tests) + B (`dubbing.js`, one comment in `dub-engine.js`) ·
`1.8.9`. User asked again: deeper hardening, perf, adversarial review; no API change.

## What changed
- 1.8.9 service-worker races, each reproduced first (`hardening.test.js` "1.8.9", fail on 1.8.8): a
  queued job dropped answers at once; seek away and back re-asks the line instead of getting
  "aborted" (new flight waits for the dropped one, owner-checked cleanup); a stop arriving before
  registration is kept (`ttsRegistering`); VieNeu errors by stage (`local_unavailable` / `dropped` /
  `invalid`); `/health` poll follows the abort; `ttsRequestProblem` validates parts and jobId.
  Page cache: a corrupt record no longer drops the other hits; hits refresh recency.
  Details: `DUBBING.md` "1.8.9".
- 1.8.6 to 1.8.8 (27/09): delivery, seek entry at a word gap, lookup timeout, job watchdog.
- `cost.test.js` dedupe test: tab 1 may now get "aborted" when its own stop lands before
  registration (was timing-dependent); tab 2 served and one generation still asserted.

## State
- Tests: 535 pass, 0 fail, 1 skip (run `scripts.test` directly; `npm test` in the sandbox pings the
  registry). Reload: **yes** + F5 video tabs. No cache key changed. Simulator output unchanged (it
  models its own worker, not `background.js`).

## Unfinished / in progress
- 1.8.6 to 1.8.9 not watched on a real YouTube video: seek back and forth, pause/resume, 2x.
  `localStorage.cstDubDebug = "1"` shows `delivery` in `<html data-cst-dub>`.
- `BACKLOG.md` 33 (server near real time still chases) is open; 32 and 34 are fixed.
- Carried over: glossary keep-English vs Vietnamese per term not yet watched in Chrome (ask the user
  after a lecture or two); nobody compared real Gemini output before/after 1.8.3/1.8.4;
  `BACKLOG.md` 30, 31, 14, 15, 16, 18, 19, 20, 21-24, 26-28; 1.7.2 to 1.8.9 not verified end to end
  in real Chrome; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- Another session may run in this folder (it swept a half-written file into b51c446, and its static
  server on :8765 disappears when it ends): commit your own paths, restart `static` if needed.
- The `bgEnv` fake fetch ignores abort signals: check `signal.aborted` yourself before a send.

## Suggested next step
- Watch one video with dubbing on, seek into the middle of lines and rewind a few minutes.
