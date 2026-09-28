# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `options.html` (lane C), `tests/harness/live.html`, docs · `2.0.3`.

## What changed
- BACKLOG 7 (CSS debt), 2.0.2 + 2.0.3: every dead rule and every early declaration a later
  same-selector rule overrides is gone from `options.html` (~110 lines). Each step checked: computed
  style of every element, committed page vs now in iframes, light and dark, 0 differ. What is left
  is not debt but a design call: popup `--claude-*` #D97757 vs options `--primary` #c96442.
- Live harness (committed earlier this session): `?script=viewer2` (pre-roll ad, mid-line pause,
  fast toggles, rewind while paused, seek after an ad); pause counted from the script's own pause;
  lag from the engine's `stats.started`. viewer2 on 2.0.1: 0 voice while paused or in ads, a
  mid-line pause resumes the same take.
- BACKLOG 38 closed: last lead (worker retrying a stuck take) checked on 8439 real takes, never
  fired; all refuted leads and their numbers moved to `DUBBING.md` (after the 1.9.9 buffer table).
- 2.0.1 (earlier): after an ad, a finished line whose subtitle is still up is not read again.

## State
- Tests: 566 pass, 0 fail, 1 skip. Reload: **yes**, at `chrome://extensions` (no visible change).

## Unfinished / in progress
- In progress: BACKLOG 16, verbs outside `PRED_VERBS`. New set `syntax5` (W1-W14) written
  before any code; real VieNeu takes rendering for all sets (`tools/prosody-eval.js`), baseline
  first, then a rule change judged on every set.
- BACKLOG 7: only the palette question, the user's to decide.
- Carried over: ask the user for "Chép chẩn đoán" right after a problem; BACKLOG 36; glossary
  keep-English per term not watched in Chrome; real Gemini output before/after 1.8.3/1.8.4 not
  compared; BACKLOG 30, 31, 14-15, 18-24, 26, 28 (20 outside); the user's verdict on the 1.9.5 A/B
  WAVs; 1.7.9 duck fix not confirmed; Udemy / edX (BACKLOG 9); a live YouTube check by the user.
- The user should turn Chrome's "Allow JavaScript from Apple Events" back off.
- A stray backup `~/VieNeu-TTS/apps/openai_speech.py.cst-before-fast-release` (harmless) may be
  deleted by the user.

## Traps hit this session
- Read `git log` before continuing after a break: another session may have recorded a decision.
- A sim test with 2.5 s takes cannot show a re-entered tail (entry drops tails under 0.8 s).
- CSS: "same selector later" is not enough; the media query and `!important` must match too.

## Suggested next step
- `?script=stress` and `?script=viewer2` on the live harness after any engine change.
