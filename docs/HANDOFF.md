# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `options.html` (lane C), `tests/harness/live.html`, docs · `2.0.2`.

## What changed
- BACKLOG 7 (CSS debt): the two pages are two palettes, not duplicated tokens (popup `--claude-*`
  #D97757, options `--primary` #c96442), so unifying them is the user's design call. Removed from
  `options.html` only what is provably dead: the legacy purple `:root` block and 9 rules a later rule
  with the same selector fully overrides. Checked: computed style of every element, HEAD vs now, in
  light and dark, 5188 values, 0 differ. `popup.css` has no such dead rules.
- Live harness (committed earlier this session): `?script=viewer2` (pre-roll ad, mid-line pause,
  fast toggles, rewind while paused, seek after an ad); pause counted from the script's own pause;
  lag from the engine's `stats.started`. viewer2 on 2.0.1: 0 voice while paused or in ads, a
  mid-line pause resumes the same take.
- BACKLOG 38: `jobRemain` floor experiment refuted (noise), written up there.
- 2.0.1 (earlier): after an ad, a finished line whose subtitle is still up is not read again.

## State
- Tests: 566 pass, 0 fail, 1 skip. Reload: **yes**, at `chrome://extensions` (no visible change).

## Unfinished / in progress
- BACKLOG 7 left: 19 early rules in `options.html` that later ones override in part; merge only with
  the same computed-style check (iframe HEAD copy vs now on the static preview, light and dark).
- Carried over: ask the user for "Chép chẩn đoán" right after a problem; BACKLOG 38 last lead (the
  worker retrying a stuck take); BACKLOG 36; glossary keep-English per term not watched in Chrome;
  real Gemini output before/after 1.8.3/1.8.4 not compared; BACKLOG 30, 31, 14-15, 18-24, 26, 28
  (20 outside); the user's verdict on the 1.9.5 A/B WAVs; 1.7.9 duck fix not confirmed; Udemy /
  edX (BACKLOG 9); a live YouTube check by the user.
- The user should turn Chrome's "Allow JavaScript from Apple Events" back off.
- A stray backup `~/VieNeu-TTS/apps/openai_speech.py.cst-before-fast-release` (harmless) may be
  deleted by the user.

## Traps hit this session
- Read `git log` before continuing after a break: another session may have recorded a decision.
- A sim test with 2.5 s takes cannot show a re-entered tail (entry drops tails under 0.8 s).
- CSS: "same selector later" is not enough; the media query and `!important` must match too.

## Suggested next step
- `?script=stress` and `?script=viewer2` on the live harness after any engine change.
