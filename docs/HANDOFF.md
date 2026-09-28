# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · `dub-engine.js` (lane B), `tests/dub.test.js`, `version-history.js`, docs · `2.0.0`.
Earlier the same session: BACKLOG 37 declined by the user (entry and patch removed, never re-add).

## What changed
- `nextSpeech` start/seek branch: `entryWait` remembers a line waited on for audio with more than
  `SYNC.entryWaitMin` (1 s) left. Lost -> `stats.dropped++` and a `drop` event `entry-no-audio`, so
  the quick menu's "đã bỏ N câu" no longer undercounts. A seek into a line's tail stays
  `entered-too-late`, not counted. `hardReset` clears it. Behaviour unchanged: slow and rapid
  matrices identical to 1.9.9.
- Two BACKLOG 38 leads tried and refuted on the matrix (numbers in BACKLOG 38): cancelling renders
  of passed lines (worse), a Theil-Sen overhead fit (noise). Neither is in the code.

## State
- Tests: 565 pass, 0 fail, 1 skip. Reload: **yes**, at `chrome://extensions`.

## Unfinished / in progress
- Carried over: 1.9.9 / 2.0.0 not yet watched live; ask the user for "Chép chẩn đoán" right after a
  problem.
- The user asked to keep working through BACKLOG and improving existing features. Left in 38:
  `jobRemain`'s 0.3 s floor, the worker retrying a stuck take. Low yield so far on sync tuning.
- Carried over: BACKLOG 36; glossary keep-English per term not watched in Chrome; real Gemini
  output before/after 1.8.3/1.8.4 not compared; BACKLOG 30, 31, 14-15, 18-24, 26, 28 (20 outside);
  the user's verdict on the 1.9.5 A/B WAVs; 1.7.9 duck fix not confirmed; Udemy / edX (BACKLOG 9).
- The user should turn Chrome's "Allow JavaScript from Apple Events" back off.

## Traps hit this session
- Measure any sync change with `node tools/sim-matrix.js slow <copy of old dub-engine.js>` and
  `rapid`; keep the old engine in the scratchpad (`git show HEAD:dub-engine.js > ...`).
- Anything that aborts a started VieNeu take more eagerly loses on the matrix (DANGER §15).
- A scratch-harness win can be large while real use is rare: check `~/VieNeu-TTS/server.log` first.

## Suggested next step
- A live check of 2.0.0 with the diagnostics button, then BACKLOG 24 (caps checked against the
  English source line) measured with `tools/pron-eval.js`.
