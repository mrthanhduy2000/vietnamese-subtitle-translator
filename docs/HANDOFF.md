# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched

2026-09-23 · lane: C (UI) · version `1.4.4`. The version lives in `manifest.json`, `package.json`,
`build-info.js` and entry 0 of `version-history.js`; `tests/ui.test.js` fails if entry 0 drifts.
No doc hardcodes a version number any more, on purpose.

## What changed

- `popup.js`: dropped the `{ method: "setOptions" }` message and the `notifyActiveTab` helper that
  only served it. Nothing handled that message; the dubbing toggle already travels through
  `storage.sync` -> `storage.onChanged`, which both `youtube.js` and `content.js` listen to.
  This closes old `BACKLOG.md` defect 2, so that entry is gone and 3-9 renumbered to 2-8.
- `tests/ui.test.js`: every `method:` string `popup.js` sends must have a
  `request.method === "..."` handler in `content.js` or `youtube.js`.
- `CLAUDE.md` and `docs/BACKLOG.md`: stale "1.4.0" replaced by a pointer to `manifest.json`.

## State

- `npm test`: 319 pass, 0 fail (0 skip when `OLD_YT=<older youtube.js>` is set)
- Reload needed at `chrome://extensions`: **yes**, `popup.js` changed
- Committed by path; a second session (docs + infra lane) shares this folder

## Unfinished / in progress

- Still never measured in real Chrome: Alt+S / Alt+D end to end, and the quick-menu voice picker.
  Note for whoever tries: a shortcut fired through CDP does **not** reach `chrome.commands`; the
  user has to press the keys, or you verify the two ends separately.
- `docs/BACKLOG.md` now has 8 open items, all unfixed and all needing the user's go-ahead first.

## Traps hit this session

- `grep -A16` around the `storage.onChanged` block in `content.js` cut off exactly the `dubEnabled`
  branch and made it look missing. The block runs to line ~1280; read it whole before concluding.
- Fixing a `BACKLOG.md` item as a drive-by is banned by that file's own header. Ask first, one fix
  per change, then delete the entry.

## Suggested next step

- Measure the shortcuts in Chrome (needs the user at the keyboard), or pick a `BACKLOG.md` item and
  ask before starting. Cheapest there: item 4 (`glossary.js` exports on `window.` only).
