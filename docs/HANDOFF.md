# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · docs + `tools/doc-sizes.js` + `.claude/commands/ban-giao.md` · still `1.9.9`, no bump
(no runtime file changed). Two commits: structure, then a fact-check pass.

## What changed
- `DUBBING.md` by topic in three parts (what is said / when / who and where), a layout note on top;
  1.9.5 / 1.9.6 prosody notes moved out of "Delivery", which now has 5 `###` subsections.
- `BACKLOG.md` grouped by area, numbers kept (next free: 39), a "Closed" list for cited numbers.
- Fact-checked every doc against the code (names, SYNC values, routes, storage keys, load order,
  globals, README counts). Fixed: storage.sync is 30 keys + `originalFirst` (popup) + `uiTheme`;
  storage.session also holds `localTtsLastOk`; `setOptions` note (gone since 1.4.4); DANGER §13
  audio key (speakScript + prosody signature); MAP "Who consumes what" regenerated from code.
- `tools/doc-sizes.js` now also rewrites the "~Tests" column of `TESTING.md` and MAP's test counts,
  and names a test file with no row; `/ban-giao` step 5 runs it.

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
- `npm test` works in the sandbox (exit 0). It prints certificate errors and a denied
  registry.npmjs.org line: npm's own update check, harmless. Summary lines start with `ℹ`, not `#`.
- BACKLOG numbers 6, 17, 32, 34 looked unused; git shows they were fixed and deleted. Check
  `git log -p -- docs/BACKLOG.md` before claiming a number was never used.

## Suggested next step
- The VieNeu patch decision, then a live check of 1.9.9 on a fast talk with the diagnostics button.
