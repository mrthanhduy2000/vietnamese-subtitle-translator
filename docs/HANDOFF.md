# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched

2026-09-23 · lane: docs + infra · **version is contested**: the working tree says `1.4.3`, the
commits on this branch contain `1.4.2`. A second Claude session was bumping it in this same folder
while these commits were made. Trust `manifest.json`, not a commit message.

## What changed

- The handoff system: `tools/handoff-check.sh` (Stop hook), `.claude/settings.json`,
  `.claude/commands/ban-giao.md`, this file, and the handoff rule in `CLAUDE.md`.
- Earlier the same day: `CLAUDE.md` and the six other `docs/` files, `git init`, first commit.

## State

- `npm test`: 0 fail · committed: yes, by path · Reload needed at `chrome://extensions`: no
- Uncommitted and **not mine**: `version-history.js` plus `options.*`, `popup.html`,
  `manifest.json`, `package.json`, `build-info.js`, `tools/bump-version.js`, `tests/ui.test.js` -
  the other session's version-history feature, mid-flight. Leave it alone.

## Unfinished / in progress

none of mine

## Traps hit this session

- **Do not trust the first two commit messages.** `0653fa3` says "Snapshot v1.4.0" but its tree
  holds `1.4.2`, because it used `git add -A` while the parallel session had already bumped twice,
  so it also carries some of that session's edits. This is exactly why `CLAUDE.md` now says to
  commit by path when the folder is shared.
- The sandbox blocks writes to `~/Downloads`, `.git` creation, and `.claude/` subdirectories.

## Suggested next step

- `docs/BACKLOG.md` has 9 audited defects, none fixed. Cheapest: item 2 (`popup.js` sends a
  `setOptions` message nobody handles).
