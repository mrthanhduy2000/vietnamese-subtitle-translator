# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `dub-prosody.js` (lane B), `tests/prosody*.js`, docs · `2.0.4`.

## What changed
- 2.0.4, BACKLOG 16: 16 verbs of effect in `PRED_VERBS` plus three guards (`NOUN_BEFORE`, first
  predicate only, `KIN_NOUNS`) and `constituents` finding a two-syllable predicate verb. Real
  VieNeu takes: syntax5 (dev) WRONG 4 -> 0, MISSED 14 -> 0; syntax6 (held out, scored once) WRONG
  3 -> 0, MISSED 15 -> 0; the nine older sets identical. Details: `DUBBING.md` "2.0.4".
- 2.0.2 + 2.0.3, BACKLOG 7: dead CSS gone from `options.html`, 0 computed-style differences.
  Only the palette question is left (the user's call).
- BACKLOG 38 closed: every lead checked or refuted, numbers in `DUBBING.md`; service-worker CPU per
  take measured (~11 ms per audio second).
- Live harness: `?script=viewer2`; 2.0.1: after an ad a finished line is not read again.

## State
- Tests: 567 pass, 0 fail, 1 skip. Reload: **yes**, at `chrome://extensions`.
- Prosody takes for all 11 sets are cached in `~/.cache/cst-prosody-takes` (rendered 2026-09-29).

## Unfinished / in progress
- BACKLOG 16 left: verbs outside the list; RAN-ON (the voice not stopping) is out of reach.
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
- A copy made with the sandbox off lands in another `$TMPDIR`; use `git show HEAD:file` as the
  baseline instead.
- CSS: "same selector later" is not enough; the media query and `!important` must match too.

## Suggested next step
- `?script=stress` and `?script=viewer2` on the live harness after any engine change.
