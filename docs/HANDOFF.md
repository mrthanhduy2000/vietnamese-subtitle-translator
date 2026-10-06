# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-07 · `2.5.0` share installers proven on clean machines (`docs/MAP.md` "Share build").

## What changed
- Public repo `mrthanhduy2000/dich-phu-de-long-tieng` now at 2.5.0 (Coursera start hold included),
  with `.github/workflows/install-test.yml`: every push runs the one-line install on Windows x64,
  x64 with a Vietnamese path, Windows ARM, macOS Apple chip, macOS Intel (install, spoken line,
  restart after kill, update, uninstall). Run 37525271928: **all 5 green**.
- Windows autostart: HKCU Run value `DichPhuDe VieNeu` -> `pythonw.exe run-vieneu.pyw`
  (`tools/vieneu-runner.pyw`), no window; updater is a desktop `.cmd`. No WScript.Shell anywhere.
- Both installers: uninstall mode, port 8000 owner named, `/health` must be VieNeu's, VC++ runtime
  installed when missing, a foreign VieNeu folder or service never touched.
- 2.5.0 itself (previous turn): Coursera lecture's first play waits for its first voice.

## State
- Tests: 656 pass, 0 fail, 1 skip. No runtime change this turn: no bump, no Reload needed.
- CI timings: install 1-2 min; restart after kill 7-9 s; a 2 s line in 1.2-2.5 s (weak CI CPUs).
- **User (2026-10-01):** every fix is a rule for all future videos; on a sound report dig yourself.

## Unfinished / in progress
- 2.5.0 Coursera hold not yet seen live in the user's Chrome (only they can Reload).
- Not covered by CI: missing VC++ runtime (runners have it), the Chrome steps (manual by design),
  a real Vietnamese Windows user profile (CI fakes it with DPD_EXT_DIR / DPD_VIENEU_DIR).
- Carried: the user has not tried the second voice since 2.4.8, nor heard 2.4.6 / 2.4.7. Voice items
  for the user's ear ("có nghĩa là", DN, NHNN). Never ask about Apple Events JS.

## Traps hit this session
- **The author's own LaunchAgent is also `com.damduy.vieneu`**: a local test uninstall took it down
  (restored with `tools/vieneu-autostart.command`). Test locally only with `DPD_NO_AUTOSTART=1`;
  the installers now refuse a plist that runs another folder.
- The sandbox cannot reach 127.0.0.1: local installer tests run outside it.
- WScript.Shell `CreateShortcut` throws "Value does not fall within the expected range" on a
  non-ANSI target path (a Vietnamese user name).
- bash `-e` ignores a failing `! cmd`: CI negative checks use `if cmd; then exit 1; fi`.

## Suggested next step
- On "Đã có dữ liệu rà soát mới": `node tools/review.js`, read section 3, fix as rules, measure on
  all videos, `node tools/regress.js`, then `node tools/review.js --close` and bump the version.
