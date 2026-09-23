# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched

2026-09-23 · lanes B + D (said so in the commits) · version `1.4.6`. A performance audit, the
regression it found, the fix, and the measurement that confirms the fix.

## What changed

- **The regression** (ours, from 1.4.2): the LaunchAgent ran the VieNeu server with
  `ProcessType = Background`, so macOS gave it low QoS (`pri 4`, efficiency cores). Generating 1s of
  speech took 1.07s instead of ~0.23s and nothing reported it. Installer now asks for `Interactive`.
- **Confirmed fixed by measurement** after the user reinstalled: RTF 0.23, `pri 31`, live test
  25/25 lines spoken, first voice 2.6s, 3 segments rendered in 2.2s (was 10.3s).
- The installer also survives launchd's async `bootout` now (poll, then 5 bootstrap retries, and a
  real failure message instead of "Đã cài"); the first reinstall attempt left the server stopped.
- New watchers so this cannot go quiet again: rolling RTF in `background.js` returned by
  `localTtsStatus`, shown in the VieNeu card in `options.js`, one toast per page from `dubbing.js`
  at RTF >= 0.8, a hard fail in `tests/vieneu.live.js`, and `tools/vieneu-bench.js` on demand.

## State

- `npm test`: 321 pass, 0 fail · committed by path · Reload at `chrome://extensions`: **yes** (1.4.6)
- VieNeu: LaunchAgent loaded and healthy, `Interactive`, RTF ~0.23

## Unfinished / in progress

- Still unmeasured in real Chrome: Alt+S / Alt+D end to end, and the quick-menu voice picker. A
  shortcut fired through CDP never reaches `chrome.commands`; the user has to press the keys.
- `docs/BACKLOG.md` has 8 open items, all needing the user's go-ahead first.

## Traps hit this session

- Two performance hypotheses died on measurement: the per-tick `refresh()` signature costs 0.006 ms
  at 400 groups, and both per-frame cue lookups are binary searches. Latency here is network + TTS,
  never the loops. Measure first.
- `Math.max(...[])` is `-Infinity`, so an empty results array passed every threshold assert in
  `vieneu.live.js` and it printed ĐẠT with 0/24 lines spoken. Assert the count, not just the max.
- A `dangerouslyDisableSandbox` Bash call gets a different `$TMPDIR`, so `OLD_YT=$TMPDIR/...` points
  at nothing and `reload-fight.test.js` fails. Use an absolute path.

## Suggested next step

- Measure the shortcuts in Chrome (needs the user at the keyboard), or pick a `BACKLOG.md` item.
