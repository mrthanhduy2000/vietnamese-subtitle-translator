# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-23 · lanes A + B + C, tests · `1.5.7`. Stage 2 of the approved plan (subtitle editing).

## What changed

- New `subtitle-edits.js` (`CST_EDITS`): corrections per video in `storage.local` `edits:<videoKey>`,
  matched back by cue start (60 ms tolerance). `sync(rec, { groups, display })` lays them over the
  overlay cues and the dub groups, parks the machine text on the cue (`cstOrig`,
  `g.cstOrigViText`) and rebuilds `viText` token by token so untouched cues keep their ¦ hints.
- Transcript rows are now `div role=button` with a pencil: edit box, Enter saves, Esc cancels, the
  video pauses while typing, "Dùng bản dịch máy" reverts. Our fields swallow keys (YouTube shortcuts).
- `ytApplyEdits` / `csApplyEdits` run after every translation, cache load and edit; both players
  listen for their `edits:` key. `CST_DUB.refreshText` -> `refresh(true)` re-renders only the lines
  whose text changed (tested). `ytGhiCache` stores the machine text, never the edits.
- Settings tab "Phụ đề đã sửa": list, edit, revert a line or a whole video (two-click, no dialog).
  `chrome-shim.js` gained `storage.remove` (the preview shim lacked it).

## State

- `npm test`: 340 tests, 339 pass, 0 fail, 1 skip (new `tests/edits.test.js`) · Reload: **yes**

## Unfinished / in progress

- **Plan stages 3 to 5 not started** (`~/.claude/plans/jiggly-sparking-milner.md`): video summary
  (paid, budget guard), read-aloud (`activeTab` + `scripting` are **already** in the manifest),
  site adapter (edX first; user has not named a site).
- Not done from stage 2: exporting .srt from Settings (Coursera keeps no per-video translation).
- 1.5.1 to 1.5.7 not yet seen in the shipped build (tests, probes, headless renders only).
- `docs/BACKLOG.md`: 8 open items. Item 2 (`dualMode` twice) worked around in the size stepper.

## Traps hit this session

- Control_Chrome JS fails ("Chrome is not running"): use claude-in-chrome, which cannot open `file://`.
- Headless Chrome renders local previews (sandbox off, never exits: poll the PNG, `pkill -f hl-profile`).
  For Settings, seed `localStorage["cst_extension_storage_v8"]` and add a `<base href>`.

## Suggested next step
- User tries an edit on a real video; then stage 3 or 4.
