# Windows and other chips

What runs where, how to start the voice server by hand, and the GPU option. Nothing here was measured
on a real Windows machine; CI (`windows-latest`, `npm test`) is the only Windows check.

## What works

| Machine | Subtitles | VieNeu voice | Notes |
|---|---|---|---|
| Windows 10/11 x64 | yes | yes (CPU) | `tools/share/install-windows.ps1` installs everything, no admin |
| Windows ARM | yes | no | onnxruntime wheel missing |
| Mac Intel | yes | no | |
| Mac Apple chip | yes | yes | `cst-start.command`, LaunchAgent |

## Starting the voice server on Windows

- Install or update: run the one-line installer from `tools/share/README.md`, or double-click
  `tools\vieneu-autostart.cmd` from the extension folder.
- Stop: `powershell -ExecutionPolicy Bypass -File tools\vieneu-autostart.ps1 -Stop`.
- Remove: same with `-Uninstall`.
- By hand, without autostart (the twin of `cst-start.command`):
  `%USERPROFILE%\VieNeu-TTS\.venv\Scripts\pythonw.exe %USERPROFILE%\VieNeu-TTS\run-vieneu.pyw`
- Is it up: `curl http://127.0.0.1:8000/health` (Windows 10+ has curl.exe). Log: `VieNeu-TTS\server.log`,
  overwritten at each start; its first line says whether the pinned model is read offline.

## NVIDIA GPU (opt in, untested)

The runner sets CPU defaults (`onnx`, `cpu`, `fp32`) only when the variable is not already set, so a user
variable wins:

```
setx VIENEU_BACKEND pytorch
setx VIENEU_DEVICE cuda
```

Then sign out and in (or `-Stop`, then run `vieneu-autostart.ps1`). The server needs a CUDA build of
PyTorch inside `VieNeu-TTS\.venv`, which the installer does not add:
`.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cu124`
(about 2.5 GB). If `server.log` shows an error, remove both variables (`reg delete HKCU\Environment /v
VIENEU_DEVICE /f`, same for `VIENEU_BACKEND`) and the CPU path returns. The Settings page reports the
measured real-time factor: under 0.4 is comfortable.

## Maintainer tools on Windows

`tools/platform-paths.js` gives the Chrome profile store (`%LOCALAPPDATA%\Google\Chrome\User Data`), the VieNeu
interpreter (`.venv\Scripts\python.exe`) and a temp folder. Overrides: `CHROME_USER_DATA`, `VIENEU_DIR`,
`VIENEU_PY`, `--dir=`. `review.js`, `ext-storage.js`, `glossary-pron.js`, `pron-eval.js`,
`subtitle-pron.js` use it. The macOS-only parts of `tests/share.test.js` (plist, `stat -f`, zsh) skip on
other systems; `tests/vieneu.live.js` still assumes a started server.
