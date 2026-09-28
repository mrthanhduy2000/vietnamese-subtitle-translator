# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · lanes B (`dub-engine.js`, `dubbing.js`) + A (`youtube.js`, one button) + C
(`version-history.js`) + D (tests, `tools/playback-sim.js`) · `1.9.9`.

## What changed
- User report: first view, subtitle shown, voice silent, then quicker, then lines skipped. Measured
  live in their Chrome: a fast talk plus VieNeu slowed by a busy Mac drained the 20 s buffer.
  DUBBING.md "1.9.9" has the numbers.
- `freeAheadMin` 60 / `freeAheadMax` 90 (media s, times the rate), `seekKeepAhead` 20. Orphan jobs
  feed `renderRtf`. A late page timer is no longer a seek (`tick`, `stats.lateTicks`).
- Always-on event ring (`note`, `engine.events`), `CST_DUB.diagnostics()`, and a "Chép chẩn đoán"
  button in the YouTube quick menu. A voice-speed hint in `describeHealth` (`fasterVoices`).
- `playback-sim.js`: `scale`, `sps`, `unique`, `maxHeld`; new scenario `fastSlowdown`.

## State
- Tests: 564 pass, 0 fail, 1 skip. Reload: **yes** + F5 video tabs. `cstDubDebug` removed from the
  user's youtube.com and the page recorder stopped. The user should turn Chrome's "Allow JavaScript
  from Apple Events" back off.

## Unfinished / in progress
- 1.9.9 not yet watched live. Next time, ask the user for "Chép chẩn đoán" right after a problem.
- Ask the user whether to apply `tools/vieneu-fast-release.patch` (BACKLOG 37). On a scratch harness
  of 828 hiccups, subtitle-without-voice time was halved. Then make `background.js` cut a running
  request at once when /health says `release_on_leave`.
- BACKLOG 36-38: a structurally slow server, seeks on a slow server, and review leads a usage limit
  cut off (service-worker CPU, `entered-too-late` not counted as dropped).
- Carried over: glossary keep-English per term not watched in Chrome; real Gemini output before/after
  1.8.3/1.8.4 not compared; `BACKLOG.md` 30, 31, 14-15, 18-24, 26, 28 (20 outside); the user's
  verdict on the 1.9.5 A/B WAVs; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- The sim lecture repeats 22 sentences: without `unique: true` the store answers everything and a
  slow server shows nothing. A 24-run gain (patch F6) reversed on the 144-run matrix: always check.
- Control_Chrome JS: wrap in an IIFE; a second top-level `const` returns "missing value".
- Workflow subagents hit the usage limit mid-run; their scratch is not in the repo.

## Suggested next step
- The VieNeu patch decision, then a live check of 1.9.9 on a fast talk with the diagnostics button.
