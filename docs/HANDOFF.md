# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched

2026-09-23 · lanes A + B, plus `player-ui.js` and tests · version `1.5.6`. User asked for a general
pass: "find the limitations in subtitles and text-to-audio and fix them". Earlier today: 1.4.7 to
1.5.5 (dubbing overload, icons, Coursera parity, transcript panel, line fitting).

## What changed

- **Bug**: `dubbing.js` read `dubDuck`/`dubVolume` with `Number(x) || default`, so the Settings
  slider's "original 0%" played at 20%. Now `CST_DUB.level()`.
- **Bug**: Coursera ignored a subtitle style change until the player resized (`csRender` compares
  only the box size). The storage listener now calls `csRestyle()`; a `dualMode` change repaints.
- Both quick menus: subtitle size stepper (A−/A+, 10%), voice volume + original-level sliders
  (shown only while dubbing), and a status line from `engine.health()` / `CST_DUB.describeHealth()`:
  seconds ready ahead, slow server with measured RTF, lines skipped to catch up.
- New shared builders in `player-ui.js`: `buildStepper`, `buildSlider`, `buildVolumeControls`. The
  range track is drawn by us (`--cst-fill`): the native one ignored `color-scheme` and was black in
  light mode (checked by rendering the menu in headless Chrome).
- Dub badge and the "Đang chuẩn bị…" card now use the dark product card instead of a bare black box.
- **Checked and dropped**: gap flicker between cues. Measured on a real Coursera track (201 cues,
  199 gaps of exactly 0 s) and the real YouTube timeline (0 gaps): not a real problem, not built.

## State

- `npm test`: 334 tests, 333 pass, 0 fail, 1 skip · committed by path · Reload at
  `chrome://extensions`: **yes** (1.5.6)

## Unfinished / in progress

- **Stages 2 to 5 of the approved plan are not started** (`~/.claude/plans/jiggly-sparking-milner.md`):
  subtitle editing with an override store, video summary (paid Gemini call, budget guard),
  read-aloud of selected text (needs `activeTab` + `scripting`), generic site adapter (edX first;
  the user has not named a site).
- Nothing from 1.5.1 to 1.5.6 has been seen running in the shipped build: tests, live DOM probes and
  headless renders only. Alt+S / Alt+D end to end and the voice picker are still unmeasured.
- `docs/BACKLOG.md` has 8 open items needing the user's go-ahead. Item 2 (`dualMode` stored twice)
  bit again: the Coursera size stepper writes `subStyle.mode` from `state.dualMode` to avoid a flip.

## Traps hit this session

- Control_Chrome `execute_javascript` answered "Chrome is not running" while `list_tabs` worked;
  claude-in-chrome worked. It cannot open `file://` (it prefixes https).
- Headless Chrome renders local previews but needs the sandbox off (ProcessSingleton socket) and
  never exits after `--screenshot`: poll for the PNG, then `pkill -f hl-profile`.

## Suggested next step

- Ask the user to reload and try the new menu controls, then pick the next plan stage.
