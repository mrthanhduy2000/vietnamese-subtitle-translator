# Windows support (no runtime change, no version bump)

- `tools/platform-paths.js`: Chrome store, VieNeu interpreter and temp folder per OS, used by the maintainer tools.
- `tools/vieneu-runner.pyw`: CPU stays the default; `VIENEU_BACKEND` / `VIENEU_DEVICE` set in the user environment win (NVIDIA opt-in, `docs/WINDOWS.md`).
- CI: `npm-test-windows` job on `windows-latest`; `.gitattributes` forces LF.
- `tests/share.test.js`: Windows-safe (file URIs, CRLF, separators); macOS-only cases skip.
- Needs a real Windows machine: GPU path untested; updater browser detection (`holders`) on the Windows profile layout is not covered by a test (BACKLOG 43 still open).
