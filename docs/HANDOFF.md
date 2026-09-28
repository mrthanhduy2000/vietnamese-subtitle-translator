# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `dub-engine.js` (lane B), `tests/dub.test.js`, docs · `2.0.8`.

## What changed
- 2.0.8: ducking between lines. `lineComing` / `nextVoiceAt` know when the next line starts (its
  take is in the page, or the system voice's next phrase): a gap under `SYNC.duckBridge` 2.0 wall s
  stays ducked, a longer one comes down ~0.45 s before the line; a pause mid-line holds the duck.
  Nine scenarios: pumps 88/180 -> 2, loud line starts 163/265 -> 11, delivery identical on both
  paths. `DUBBING.md` "Ducking between lines (2.0.8)". Not heard by ear.
- 2.0.7: the next part of a sentence changes pace by at most `SYNC.rateStepInSentence` 0.03.
- 2.0.6: head cuts go to a phrase boundary near the middle (`lineGapValues`, `HEAD_CUT`); the
  24-run slow test guard is 275 / 140 s, the paired 144-run evidence is in its comment.
- 2.0.4 / 2.0.5, BACKLOG 16: more predicate verbs, guards, `SUBJECT_PP` (`DUBBING.md` "2.0.4").

## State
- Tests: 572 pass, 0 fail, 1 skip. Reload: **yes**, at `chrome://extensions`.
- Takes cached: `~/.cache/cst-prosody-takes` (11 sets). `tests/harness/smooth/` predates 2.0.6
  (`t7367` missing): rerun `smooth-prep.js`.

## Unfinished / in progress
- BACKLOG 16 left: verbs outside the list; RAN-ON is out of reach. BACKLOG 7: palette, user's call.
- Carried over: ask the user for "Chép chẩn đoán" right after a problem; BACKLOG 36; glossary
  keep-English per term not watched in Chrome; real Gemini output before/after 1.8.3/1.8.4 not
  compared; BACKLOG 30, 31, 14-15, 18-24, 26, 28 (20 outside); the user's verdict on the 1.9.5 A/B
  WAVs; 1.7.9 duck fix not confirmed; Udemy / edX (BACKLOG 9); a live YouTube check by the user.
- The user should turn Chrome's "Allow JavaScript from Apple Events" back off.
- A stray backup `~/VieNeu-TTS/apps/openai_speech.py.cst-before-fast-release` (harmless) may be
  deleted by the user.

## Traps hit this session
- Read `git log` before continuing after a break: another session may have recorded a decision.
- The user declined a sandbox-off command on 2026-09-29: `prosody-eval.js` scores cached takes
  inside the sandbox; a baseline module must sit in a repo copy (`git archive HEAD | tar -x`).
- Compare planners or engines in separate processes: `CST_DUB_PLAN` / `CST_DUB_PROSODY` are
  globals, so a second engine loaded in one process silently runs the first one's planner.

## Suggested next step
- `?script=stress` and `?script=viewer2` on the live harness after any engine change.
