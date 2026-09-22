# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, stay under 40 lines, write `none` in an empty section.

## Last touched

2026-09-23 · version 1.4.0 · lane: docs + infra

## What changed

- The handoff system itself: `tools/handoff-check.sh` (Stop hook), `.claude/settings.json`,
  `.claude/commands/ban-giao.md`, this file, and the handoff rule in `CLAUDE.md`.
- Earlier the same day: `CLAUDE.md` and the six `docs/` files, `git init` plus the first commit.

## State

- `npm test`: 0 fail · version bumped: no (nothing Chrome loads was touched) · committed: yes
- user must click Reload at `chrome://extensions`: no

## Unfinished / in progress

none

## Traps hit this session

- Another session edited this folder at the same time: `theme.js` and
  `tools/vieneu-autostart.command` appeared mid-session and the test count went 312 to 316. When a
  doc disagrees with the code, check `git log` and file mtimes before assuming the doc is wrong.
- The sandbox blocks writes to `~/Downloads`, creating `.git`, and creating `.claude/`
  subdirectories. Those commands have to run outside it.

## Suggested next step

- `docs/BACKLOG.md` has 9 audited defects, none fixed. Cheapest two: item 2 (`popup.js` sends a
  `setOptions` message nobody handles) and item 1 (`dubCondense` has four contradictory sources and
  no UI control). One change and one version bump each.
