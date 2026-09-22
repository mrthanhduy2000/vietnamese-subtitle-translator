# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched

2026-09-23 · lane: extension features + UX · version `1.4.3`, now consistent across
`manifest.json`, `package.json`, `build-info.js` and entry 0 of `version-history.js`.
Those four must move together: `ui.test.js` fails if entry 0 drifts from `manifest.version`.

## What changed

- New `version-history.js`: release history, 35 entries (a merged 1.0.0-1.0.4 block up to 1.4.3),
  rendered by the new **Lịch sử phiên bản** tab in `options.html` / `options.js` (search box,
  before/after tables, built with DOM calls, not `innerHTML`).
- `tools/bump-version.js` prints a reminder when the bumped version has no history entry.
- `tests/ui.test.js` +2 tests pinning history to the manifest; `docs/MAP.md`, `docs/TESTING.md`.

## State

- `npm test`: 318 pass, 0 fail · committed by path (a second session shares this folder)
- Reload needed at `chrome://extensions`: **yes**, runtime files changed
- VieNeu: LaunchAgent `com.damduy.vieneu` installed and running on this machine

## Unfinished / in progress

- 1.0.1 to 1.0.4 are one merged entry: upstream kept no changelog, so it is reconstructed from the
  README feature list. Timestamps are exact only from 1.3.1 on; earlier ones are dates.
- Never measured in real Chrome: the Alt+S / Alt+D end-to-end path, and the quick menu voice picker.

## Traps hit this session

- Loading `youtube.js` in a `vm` hangs `node --test` forever (its bootstrap starts intervals). Use a
  `location.hostname` that is not `youtube.com`, and clear sandbox timers in `t.after`. Also `const`
  globals in a vm script are not sandbox properties: use `vm.runInContext`. See `docs/TESTING.md`.
- `stop()` inside `start()` (`dubbing.js`) also clears the VieNeu watch timer, so a watcher armed
  mid-`start()` dies silently. Arm watchers only after `dub.enabled = true`.
- Claude cannot install the LaunchAgent here (blocked as persistence); the user double-clicks
  `tools/vieneu-autostart.command` once.

## Suggested next step

- `docs/BACKLOG.md` has 9 audited defects, none fixed. Cheapest: item 2 (`popup.js` sends a
  `setOptions` message nobody handles).
