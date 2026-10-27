# Handoff (2026-10-27, lanes C + D, release and Reload lifecycle)

## Current state
- Release 3.1.1 generated with release-changes.js; pending notes collected into history.
- tools/local-build.js installs managed Git hooks in the effective hooks directory.
  post-commit/post-merge/post-checkout/post-rewrite sync ignored build-stamp.js to HEAD;
  pre-push syncs/checks it and rejects main with unreleased notes or runtime changes without
  a version bump (compared with origin/main, even if the note was omitted).
- Hooks installed in this checkout. npm run local:setup installs them in another checkout;
  npm run local:verify is the post-commit handover check. Foreign hooks are never overwritten.
- version-check.js watch() reads disk stamp/manifest without cache every 15 seconds and on focus.
  Both popup.js and options.js use it; pagehide removes timers/listeners. One Reload banner only.
  Disk version is shown instead of Chrome's old loaded version; version mismatch still triggers
  Reload if a restarted worker happens to report the same stamp as disk.
- Tracked CLAUDE.md, .claude/commands/ban-giao.md, handoff Stop hook and release docs updated.
  Local ignored AGENTS.md and migrated ban-giao skill also updated. Main handovers release pending
  notes before final tests/commit; feature branches keep notes without bumping independently.
- npm test: 1004 tests, 0 fail, 2 normal skips. Lifecycle tests use actual temporary Git remotes.
- Headless Chrome: one Reload button, one runtime.reload call on click, correct 3.1.1 badge.
- Actual user Chrome options page was refreshed: 3.1.1 badge and Reload button visibly present;
  running extension still reported commit 8122f7e. Left Reload for the user.
- Regression net: 45 saved videos, 24 scenarios, 0 changed/worse metrics; baseline saved.

## Unfinished
- User must click Reload to activate the updated extension; settings/API key remain in place.
- Earlier subtitle work still needs actual playback confirmation, especially native fullscreen.
- Carried forward: real-page overlay fade; sparse caption notice on iYL-UuNE_9w after Reload;
  YouTube embed frames (TEDx: monica_fay, shuli_steele, michelle_zhang); TED hold on Chrome;
  Mac auto-update install.
- Earlier redesign handover listed pending Gemini status/disclosure, dubbing disclosure, cost KPIs,
  video workspace on redesign-ui-ia; reconcile against later releases before resuming.

## Traps
- build-stamp.js is ignored; generate AFTER commit, never hand-edit or stage it.
- Git hooks are local to each clone/worktree. Install once; docs alone cannot activate them.
- Reopening/refreshing an old settings page is needed once to load the new watcher.
- Native subtitle cue text contains WebVTT classes; overlay/dubbing consume plain groups.
- No public-share publication was requested; this release updates local and private origin/main.
