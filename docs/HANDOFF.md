# Handoff (2026-10-27, lanes A + C, bilingual visual roles)

## Current state
- Branch `main`. `lineAppearance(style, secondary)` in `subtitle-style.js` assigns scale,
  color and weight together; both overlays now swap complete primary/secondary styles.
- Primary uses fontColor/fontWeight/full size. Secondary uses origColor/400/origScale.
  Roles depend on order, never scale equality. Source-only fallback stays full size.
- Native fullscreen Coursera cues have cst-vi/cst-orig classes and matching important CSS;
  order and bilingual storage changes refresh native cue styling and positioning immediately.
- Settings reads top-level originalFirst and follows live changes. Preview removes the
  source-only opacity, shares line spacing, and swaps the complete visual roles.
- UI labels now say secondary line; storage keys remain origScale/origColor.
- Cross-lane work: options.js/options.html needed to match the subtitle renderer.
- No version bump; change note: docs/changes/bilingual-role-appearance.md.
- npm test: 1000 tests, 0 fail, 2 skips (including the corpus appearance test).
- Corpus appearance check: 45 saved videos, 90 swaps (80% and equal 100% sizes), no mismatch.
- node tools/regress.js: 45 videos, 24 scenarios, no changed/worse metrics; baseline saved.
- Real headless Chrome checks Settings computed styles; this is harness evidence, not live playback.

## Unfinished
- Confirm on actual YouTube/Coursera playback, especially browser-native fullscreen cue rendering.
- Carried forward: real-page overlay fade; sparse caption notice on iYL-UuNE_9w after Reload;
  YouTube embed frames (TEDx: monica_fay, shuli_steele, michelle_zhang); TED hold on Chrome;
  Mac auto-update install.
- Earlier redesign handover listed pending Gemini status, dubbing/Gemini disclosure, cost KPIs,
  video workspace on redesign-ui-ia; reconcile with later releases before resuming that work.

## Traps
- Feature work adds a change note, not a version bump, despite the older ban-giao skill template.
- Native cue text now includes WebVTT class markup; overlay/dubbing still consume plain groups.
- Fake DOM does not normalize cssText after setting marginTop separately.
- doc-sizes reports several older CLAUDE.md size estimates as stale; not rewritten here.
- Click Reload at chrome://extensions after pulling runtime updates. Never remove/reinstall.
