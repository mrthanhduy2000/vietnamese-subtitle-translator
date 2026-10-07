# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-08 · `2.5.0` friends' installs update themselves (`docs/MAP.md` "Share build").

## What changed
- `tools/dichphude-update.py`: every 6 h asks GitHub, stages a newer version in
  `<VieNeu>/.dpd-staged`, lays it over the extension only while Chrome is closed. macOS LaunchAgent
  `com.damduy.dichphude.update` (30 min), Windows via the `run-vieneu.pyw` supervisor.
- `tools/huong-dan-cai-dat.html` opens in Chrome after a first install (4 steps, copy buttons).
- Desktop updater only without VieNeu; the card is named as Chrome shows it; README one command.
- Share repo at 967f740; install test run 37688657002 **all 5 green**, including the new step
  "an install set back to 0.0.1 with a stale file is brought up to date" (Windows x64, Vietnamese
  path, macOS Apple chip).

## State
- Tests: 656 pass, 0 fail, 1 skip. No runtime change: no bump, no Reload.
- **A push to the share repo reaches every friend within ~6 h.** Publish only when the user says
  "cập nhật cho bạn bè", and only with the install test green.
- **User (2026-10-01):** every fix is a rule for all future videos; on a sound report dig yourself.

## Unfinished / in progress
- 2.5.0 Coursera start hold not yet seen live in the user's Chrome (only they can Reload).
- Not covered by CI: a missing VC++ runtime, the Chrome steps, a real Vietnamese user profile.
- Carried: the user has not tried the second voice since 2.4.8. Voice items for the user's ear
  ("có nghĩa là", DN, NHNN). Never ask about Apple Events JS.

## Traps hit this session
- `chrome.runtime.reload()` left the extension **blocked** in headless Chrome and Chrome for
  Testing (`--load-extension`, developer mode on), plain reload too: dropped, never add it back
  without a test on a UI-loaded extension. Fetching our own `manifest.json` does read the disk.
- Node `new URL("chrome-extension://id/x").origin` is `"null"`: split the string instead.
- Branded Chrome ignores `--load-extension`; Chrome for Testing needs
  `--disable-features=DisableLoadExtensionCommandLineSwitch`. CDP `Extensions.loadUnpacked` works.
- The author's LaunchAgent is also `com.damduy.vieneu`: test installers locally only with
  `DPD_NO_AUTOSTART=1`, outside the sandbox (it cannot reach 127.0.0.1).

## Suggested next step
- On "Đã có dữ liệu rà soát mới": `node tools/review.js`, read section 3, fix as rules, measure on
  all videos, `node tools/regress.js`, then `node tools/review.js --close` and bump the version.
