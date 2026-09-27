# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · lane B (`dub-engine.js`) + D (tests, `tools/sim-matrix.js`, live harness) · `1.9.8`.
Session ended on the user's usage limit. VieNeu (8000) left running.

## What changed
- BACKLOG 35 closed: a line cut by an ad resumes where the voice was (`adCut`, `takeAdResume`).
- rtf sample of a queued take minus the predicted rest ahead (`job.ahead`, `serverBusy`);
  `SYNC.overFitPad` 0.3 (DUBBING.md "1.9.8" has the matrix numbers, mixed per cell, stated plainly).
- `tools/sim-matrix.js` (slow / rapid matrices, OLD engines as args). Live harness gains
  `?script=stress|burst`, `?trace=1`.
- `tools/vieneu-fast-release.patch`: a patch for `~/VieNeu-TTS/apps/openai_speech.py` (outside the
  repo) that frees the server's slot at once when a client leaves. Measured on the real server:
  after a cut the next line waits 4.8 s today (3 of 3). NOT applied: the permission system refused
  editing the user's server. A patched copy started on :8001 and answered /health; its effect was
  not measured. A backup `openai_speech.py.cst-before-fast-release` sits in `~/VieNeu-TTS/apps/`.

## State
- Tests: 558 pass, 0 fail, 1 skip. Reload: **yes** + F5 video tabs.

## Unfinished / in progress
- Ask the user whether to apply the VieNeu patch; then measure (cut, then a short line) and make
  `background.js` cut a running request at once when /health says `release_on_leave`.
- Real YouTube page in Chrome Profile 42 not tried: needs the user's OK to switch `useAi` off
  (free Google Translate) for the test, or a video with cached subtitles.
- Carried over: glossary keep-English per term not watched in Chrome; real Gemini output before/after
  1.8.3/1.8.4 not compared; `BACKLOG.md` 30, 31, 14-15, 18-24, 26, 28 (20 outside); the user's
  verdict on the 1.9.5 A/B WAVs; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- One sim scenario swings with one seek's timing: judge on `tools/sim-matrix.js`, not one run.
- Live harness: restart the server between compared runs (shared store) and close old tabs (they
  keep posting to the same port).
- With the sandbox off, `$TMPDIR` is a different directory: use absolute /private/tmp paths.

## Suggested next step
- The VieNeu patch decision above; it removes ~4.5 s of silence after most seeks.
