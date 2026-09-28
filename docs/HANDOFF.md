# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `dub-planner.js`, `dub-prosody.js` (lane B), `tests/`, docs · `2.0.6`.

## What changed
- 2.0.6: head cuts (the ~3.5 s pieces after a start or seek) go to a phrase boundary near the
  middle (`lineGapValues`, `HEAD_CUT`), not the syllable midpoint: inside a phrase 106 -> 30 of
  ~157 cuts. The 24-run slow test moved 282 -> 278 lines on one chaotic run; its guard is now 275 /
  140 s, with the 144-run paired evidence in the test comment. `DUBBING.md` "2.0.6 head cuts".
- 2.0.4 / 2.0.5, BACKLOG 16: 16 verbs of effect in `PRED_VERBS` with guards, and `SUBJECT_PP`;
  real takes syntax5 + held-out syntax6 WRONG 7 -> 0, MISSED 29 -> 0. `DUBBING.md` "2.0.4", "2.0.5".
- 2.0.2 / 2.0.3, BACKLOG 7: dead CSS gone from `options.html`; only the palette question is left.
- BACKLOG 38 closed: every lead checked or refuted, numbers in `DUBBING.md`.

## State
- Tests: 569 pass, 0 fail, 1 skip. Reload: **yes**, at `chrome://extensions`.
- Prosody takes for all 11 sets are cached in `~/.cache/cst-prosody-takes` (rendered 2026-09-29).
- `tests/harness/smooth/` takes predate 2.0.6 (one missing, `t7367`): rerun `smooth-prep.js`.

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
- CSS: "same selector later" is not enough; the media query and `!important` must match too.

## Suggested next step
- `?script=stress` and `?script=viewer2` on the live harness after any engine change.
