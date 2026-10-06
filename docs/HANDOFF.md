# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-06 · `2.5.0` Coursera start hold (`docs/DUBBING.md` "The start hold on each site").

## What changed
- 2.5.0: `content.js` `courseraHoldFirstPlay`: a lecture's first play waits up to 5 s for the voice
  of its line (`prepareHold` initial, setting `dubPrepareWait`), released when no voice comes up.
  Measured live before the fix: Coursera autoplays at 2.8 s, engine up with the video at 1.7 s, the
  greeting never voiced. 3 tests in `tests/dub.test.js`. `regress.js` unchanged, baseline saved.
- 2.4.9 (same day): public share repo `mrthanhduy2000/dich-phu-de-long-tieng`, built by
  `node tools/publish-share.js --push` (`docs/MAP.md` "Share build"). Publish only when asked;
  it still holds 2.4.9, so friends do not have the Coursera fix yet.

## State
- Tests: 656 pass, 0 fail, 1 skip. Reload: **yes** for 2.5.0, then F5 the Coursera tab.
- The fix is not yet seen live (only the user can Reload). To check: `localStorage.cstDubDebug="1"`
  on coursera.org, open a lecture in-page (SPA link click keeps a recorder alive), read
  `data-cst-dub` + `.cst-cs-overlay` + `.cst-prepare-note` every 100 ms; remove the flag after.
- Windows installer never run on Windows: the first friend on Windows is the real test.
- **User (2026-10-01):** every fix is a rule for all future videos; on a sound report dig yourself.

## Unfinished / in progress
- Verify 2.5.0 live on Coursera after the user's Reload (expected: hold note, voice on line one).
- Windows untested in practice: Startup shortcut, hidden runner, VC++ check, power throttling.
- Carried: the user has not tried the second voice since 2.4.8, nor heard 2.4.6 / 2.4.7. Voice items
  for the user's ear ("có nghĩa là", DN, NHNN). Never ask about Apple Events JS.

## Traps hit this session
- Coursera resumes a lecture where it was left (332 s): a "start" measurement needs a lecture opened
  fresh, or the next lecture by an in-page link. `data-cst-dub` updates every 500 ms only.
- A full navigation drops a recorder installed by Control_Chrome; it lands on the old page if run
  too early (check `location.href` first). A hidden tab does not navigate: `switch_to_tab` first.
- macOS `unzip` mangles Vietnamese file names (installer uses `ditto`); `curl | bash` needs `main`.
- Windows PowerShell 5.1: ASCII-only scripts, no `exit` under `irm | iex`, `2>$null` + `Stop` fatal.

## Suggested next step
- On "Đã có dữ liệu rà soát mới": `node tools/review.js`, read section 3, fix as rules, measure on
  all videos, `node tools/regress.js`, then `node tools/review.js --close` and bump the version.
