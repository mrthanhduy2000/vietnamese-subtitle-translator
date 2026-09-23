# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched

2026-09-23 · lanes B + D (said so in the commit) · version `1.4.5`. A perf audit that found one real
regression, caused by this project's own `tools/vieneu-autostart.command` from 1.4.2.

## What changed (newest first)

- `tools/vieneu-autostart.command` reinstall failed with `Bootstrap failed: 5: Input/output error`
  and left the server **stopped**: `bootout` is async, so the immediately following `bootstrap` hits
  a label launchd has not released yet. It now polls until the job is gone, retries the bootstrap 5
  times, and on failure says to double-click `~/VieNeu-TTS/cst-start.command` and exits non-zero.
  `tests/ui.test.js` pins that order. No version bump: `tools/` and `tests/` are not runtime.

- **The bug**: the LaunchAgent set `ProcessType = Background`, so macOS ran the VieNeu server at
  low QoS (measured `pri 4`, E-cores). Generating 1s of speech took **1.07s** instead of ~0.23s, and
  nothing reported it - dubbing just fell behind. The installer now sets `Interactive`.
- `background.js` keeps a rolling RTF over the last 5 real generations and returns it from
  `localTtsStatus`; `options.js` shows it in the VieNeu card; `dubbing.js` toasts once per page when
  RTF >= 0.8.
- `tests/vieneu.live.js` now **fails** on a slow server and when fewer than 80% of lines are spoken
  (it printed ĐẠT with 0/24 spoken, because `Math.max(...[])` is `-Infinity`).
- New `tools/vieneu-bench.js` (`node tools/vieneu-bench.js 3`) prints RTF per run.

## State

- `npm test`: 321 pass, 0 fail · committed by path · Reload at `chrome://extensions`: **yes** (1.4.5)
- **The VieNeu server is DOWN right now** and the LaunchAgent is not loaded; the plist on disk is
  already correct (`Interactive`). The user must re-run `zsh tools/vieneu-autostart.command`
  (Claude is blocked from `launchctl bootstrap` here).
- After they do: `node tools/vieneu-bench.js 3` (expect ~0.25) and `node tests/vieneu.live.js`.

## Unfinished / in progress

- The before/after table for 1.4.5 in `version-history.js` still says "cần đo lại sau khi cài lại"
  for the two "after" cells. Fill them in once the service is reinstalled.
- Still unmeasured in real Chrome: Alt+S / Alt+D end to end, quick-menu voice picker.

## Traps hit this session

- Two performance hypotheses were wrong before measuring: the per-tick `refresh()` signature costs
  0.006 ms at 400 groups, and both per-frame cue lookups are binary searches. The cost is entirely
  in the network + TTS, not in the loops. Measure before optimising loops here.
- A `dangerouslyDisableSandbox` Bash call gets a **different `$TMPDIR`**, so `OLD_YT=$TMPDIR/...`
  silently points at nothing and `reload-fight.test.js` fails. Use an absolute path.

## Suggested next step

- Re-measure after the user reinstalls the service, then fill the 1.4.5 table.
