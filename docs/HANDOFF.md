# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `dub-engine.js` (B), `tests/dub.test.js`, `tools/syntax-eval.js` (D), docs · `2.0.9`.

## What changed
- 2.0.9: the duck ramps in equal dB steps (`duckStep`, `SYNC.duckRampTicks` 9, replaces
  `duckRampPerTick`): largest one-tick change 3.23 -> 1.55 dB; the smoothness test now bounds dB.
- 2.0.8: `lineComing` / `nextVoiceAt` know when the next line starts: a gap under
  `SYNC.duckBridge` 2.0 wall s stays ducked, a longer one comes down ~0.45 s before the line, a
  pause mid-line holds the duck. Pumps 88/180 -> 2, loud line starts 163/265 -> 11, delivery
  identical. `DUBBING.md` "Ducking between lines (2.0.8)". Neither 2.0.8 nor 2.0.9 heard by ear.
- No bump: `syntax-eval --breath=` scores breathing commas, a lead is in BACKLOG 15 (needs real
  takes); a between-sentence pace hold was tried and not kept (`DUBBING.md`, Rate).
- 2.0.7: in-sentence pace step <= 0.03. 2.0.6: head cuts at a phrase boundary; the 24-run slow
  test guard is 275 / 140 s (paired 144-run evidence in its comment).

## State
- Tests: 572 pass, 0 fail, 1 skip. Reload: **yes**, at `chrome://extensions`.
- Takes cached: `~/.cache/cst-prosody-takes` (11 sets). `tests/harness/smooth/` predates 2.0.6
  (`t7367` missing): rerun `smooth-prep.js`.

## Unfinished / in progress
- BACKLOG 16: verbs outside the list; RAN-ON needs the BACKLOG 15 lead. BACKLOG 7: user's call.
- Carried over: ask the user for "Chép chẩn đoán" right after a problem; BACKLOG 36; glossary
  keep-English per term not watched in Chrome; real Gemini output before/after 1.8.3/1.8.4 not
  compared; BACKLOG 30, 31, 14-15, 18-24, 26, 28 (20 outside); the user's verdict on the 1.9.5 A/B
  WAVs; 1.7.9 duck fix not confirmed; Udemy / edX (BACKLOG 9); a live YouTube check by the user.
- The user: Chrome's "Allow JavaScript from Apple Events" back off; may delete the harmless backup
  `~/VieNeu-TTS/apps/openai_speech.py.cst-before-fast-release`.

## Traps hit this session
- Read `git log` before continuing after a break: another session may have recorded a decision.
- The user declined a sandbox-off command on 2026-09-29: `prosody-eval.js` scores cached takes
  inside the sandbox; a baseline module must sit in a repo copy (`git archive HEAD | tar -x`).
- Compare planners or engines in separate processes: `CST_DUB_PLAN` / `CST_DUB_PROSODY` are
  globals, so a second engine loaded in one process silently runs the first one's planner.

## Suggested next step
- `?script=stress` and `?script=viewer2` on the live harness after any engine change.
