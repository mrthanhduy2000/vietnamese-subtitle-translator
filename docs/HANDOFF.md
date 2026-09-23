# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-23 · lanes A + B, `player-ui.js`, tests · `1.5.6`. User: "find the limitations in subtitles
and text-to-audio and fix them". Earlier today 1.4.7 to 1.5.5.

## What changed

- **Bug**: `dubbing.js` read `dubDuck`/`dubVolume` with `Number(x) || default`, so the Settings
  slider's "original 0%" played at 20%. Now `CST_DUB.level()`.
- **Bug**: Coursera ignored a subtitle style change until the player resized (`csRender` compares
  only the box size). The storage listener now calls `csRestyle()`; a `dualMode` change repaints.
- Both quick menus: subtitle size stepper (A−/A+, 10%), voice volume + original-level sliders
  (shown only while dubbing), and a status line from `engine.health()` / `CST_DUB.describeHealth()`:
  seconds ready ahead, slow server with measured RTF, lines skipped to catch up.
- Shared builders in `player-ui.js` (`buildStepper`, `buildSlider`, `buildVolumeControls`); range
  track drawn by us (`--cst-fill`), the native one was black in light mode. Dub badge and the
  "Đang chuẩn bị…" card moved to the dark product card.
- **Dropped after measuring**: gap flicker. Real Coursera track: 199 of 200 gaps are 0 s.

## State

- `npm test`: 334 tests, 333 pass, 0 fail, 1 skip · Reload at `chrome://extensions`: **yes**

## Unfinished / in progress

- **Plan stages 2 to 5 not started** (`~/.claude/plans/jiggly-sparking-milner.md`): subtitle edits,
  video summary (paid, budget guard), read-aloud (needs `activeTab` + `scripting`), site adapter
  (edX first; user has not named a site).
- 1.5.1 to 1.5.6 not yet seen in the shipped build (tests, probes, headless renders only).
- `docs/BACKLOG.md`: 8 open items. Item 2 (`dualMode` twice) bit again, worked around in the stepper.

## Traps hit this session

- Control_Chrome JS says "Chrome is not running"; use claude-in-chrome (no `file://` there).
- Headless Chrome previews need the sandbox off and never exit: poll the PNG, `pkill -f hl-profile`.

## Suggested next step

- User reloads and tries the new menu controls, then picks the next plan stage.
