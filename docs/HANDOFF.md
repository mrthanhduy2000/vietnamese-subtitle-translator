# Handoff (2026-10-26, lane A, thread "Song ngữ: tiếng Anh ở trên thì chữ chính là tiếng Anh")

## Current state
- Branch `main`. Fix: `lineScales(s, dual, originalFirst)` in `subtitle-style.js` decides the font
  scale of each line in a bilingual view. With "Tiếng Anh ở trên" on, English is full size and
  Vietnamese drops to `origScale`; otherwise the old rule (Vietnamese full, English `origScale`).
- Used by `ytVePhuDe` (`youtube.js`) and `csPaint` (`content.js`, the Coursera overlay).
- Change note: `docs/changes/bilingual-line-size.md`. No version bump (feature PR rule).
- Tests: `npm test` 0 fail. New asserts in `tests/youtube-captions.test.js`,
  `tests/coursera-overlay.test.js`, and `lineScales` in `tests/backlog.test.js`.

## Unfinished
- Native fullscreen path not changed: `content.js` `placeCue` / cue CSS (`video::cue(.cst-orig)`) still
  shows the old sizes when the browser draws the cues itself. The `video::cue` rule is `!important`,
  so `.cst-orig` size may not apply at all there. Check in a real fullscreen before changing.
- Settings preview (`options.js` ~line 209) still uses `origScale` for the English line. It reads
  `s.originalFirst` from the sub-style, which the popup never writes, so the preview ignores the switch.
- Not verified in a real Chrome page (the change is only covered by unit-style tests).
- Carried over from the 2026-10-25 handover (still open): overlay line fade on a real YouTube or
  Coursera page; sparse caption notice on iYL-UuNE_9w after Reload; YouTube embed frames (TEDx:
  monica_fay, shuli_steele, michelle_zhang); TED hold on Chrome; Mac auto-update install.
- Carried over from the same handover, from the redesign thread (branch `redesign-ui-ia`, never
  pushed): Gemini status block in `options.js` (~line 598) is still the long "API Key hoạt động"
  box; dubbing and Gemini progressive disclosure not done; cost KPI cards and video workspace
  unchanged.

## Traps
- `bump-version.js` was NOT run: feature PRs do not bump the version (CLAUDE.md rule 2).
- Tests check `style.cssText` through a fake DOM that can return `undefined`: wrap it in
  `String(... || "")` before a `doesNotMatch`.
- Tell the user to click Reload at `chrome://extensions` after any runtime change.
