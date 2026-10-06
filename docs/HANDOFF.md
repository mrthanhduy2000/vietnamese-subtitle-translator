# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-06 · `2.4.9` sharing with friends on Mac and Windows (`docs/MAP.md` "Share build").

## What changed
- New **public** repo `mrthanhduy2000/dich-phu-de-long-tieng`, built by `node tools/publish-share.js
  --push` from `tools/share/` (README with the AI prompt, `install-mac.sh`, `install-windows.ps1`,
  patched VieNeu `openai_speech.py` + `.patch`) and the runtime files. Clone lives at
  `../dich-phu-de-long-tieng`. Publish only when the user asks.
- Windows autostart: `tools/vieneu-autostart.ps1` + `.cmd` (Startup shortcut, hidden restart loop,
  AboveNormal priority, logs overwritten per start). Mac autostart now takes `VIENEU_DIR`.
- Settings hint names the `.cmd` for Windows. `tests/share.test.js` (4 tests).

## State
- Tests: 653 pass, 0 fail, 1 skip. Reload: **yes** for 2.4.9 (only a Settings hint changed).
- Mac installer run end to end in a scratch folder: extension, VieNeu download, `uv sync`, patch.
- Windows scripts: parsed with PowerShell 7 on this Mac and the generated runner too; **never run on
  Windows**. The first friend on Windows is the real test.
- **The user's view (2026-10-01):** new videos only; every fix is a rule for all future videos; on a
  sound report dig yourself (`docs/TESTING.md` "Live measurement"), never ask them.

## Unfinished / in progress
- Windows untested in practice: Startup shortcut, hidden runner, VC++ runtime check, power
  throttling of a windowless process (Windows 11 may slow it; the Settings page shows the RTF).
- Carried: the user has not tried the second voice since 2.4.8, nor heard 2.4.6 / 2.4.7. Voice items
  for the user's ear ("có nghĩa là", DN, NHNN). Never ask about Apple Events JS.

## Traps hit this session
- macOS `unzip` mangles VieNeu's Vietnamese file names: the installer uses `ditto -x -k`.
- `curl | bash` reads the script from stdin: the Mac installer body is one `main` function.
- Sandbox: `mktemp -d` without a template ignores `TMPDIR`; HF model files come from
  `us.aws.cdn.hf.co` (allow `*.aws.cdn.hf.co`, `*.hf.co` is not enough).
- Windows PowerShell 5.1: ASCII-only scripts, no `exit` under `irm | iex`, `2>$null` on a native
  command with `ErrorActionPreference=Stop` is fatal.

## Suggested next step
- On "Đã có dữ liệu rà soát mới": `node tools/review.js`, read section 3, fix as rules, measure on
  all videos, `node tools/regress.js`, then `node tools/review.js --close` and bump the version.
