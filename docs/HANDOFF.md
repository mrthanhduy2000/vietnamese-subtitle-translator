# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · docs only (`docs/DUBBING.md`, `BACKLOG.md`, `MAP.md`, `TESTING.md`, `CLAUDE.md`) ·
still `1.9.9`, no bump (no runtime file changed).

## What changed
- User asked for a structure review. `DUBBING.md` sections are now by topic in three parts (what is
  said / when / who and where), with a "How this file is laid out" note. The 1.9.5 / 1.9.6 prosody
  notes that sat inside "Delivery" moved to "Later prosody and name rules". Delivery has 5 `###`
  subsections. Text moved verbatim; version labels like "1.9.9" still grep.
- `BACKLOG.md` grouped by area, numbers kept (next free: 39), a "Closed" list for cited numbers,
  25 merged into 31, 35 removed (closed).
- Stale numbers fixed; `TESTING.md` gained `edits.test.js` and `glossary.test.js`.

## State
- Tests: 564 pass, 0 fail, 1 skip. Reload: not needed (docs only).

## Unfinished / in progress
- Carried over from the 1.9.9 session: 1.9.9 not yet watched live; next time ask the user for
  "Chép chẩn đoán" right after a problem.
- Carried over: ask whether to apply `tools/vieneu-fast-release.patch` (BACKLOG 37); then make
  `background.js` cut a running request at once when /health says `release_on_leave`.
- Carried over: BACKLOG 36-38; glossary keep-English per term not watched in Chrome; real Gemini
  output before/after 1.8.3/1.8.4 not compared; BACKLOG 30, 31, 14-15, 18-24, 26, 28 (20 outside);
  the user's verdict on the 1.9.5 A/B WAVs; 1.7.9 duck fix not confirmed; Udemy / edX (BACKLOG 9).
- The user should turn Chrome's "Allow JavaScript from Apple Events" back off.

## Traps hit this session
- `npm test` is blocked by the sandbox (npm calls registry.npmjs.org). Run the script directly:
  `eval "$(node -p 'require("./package.json").scripts.test')"`.
- BACKLOG numbers 6, 17, 32, 34 looked unused; git shows they were fixed and deleted. Check
  `git log -p -- docs/BACKLOG.md` before claiming a number was never used.

## Suggested next step
- The VieNeu patch decision, then a live check of 1.9.9 on a fast talk with the diagnostics button.
