# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched

2026-09-23 · lane B (`dub-engine.js`) plus one test · version `1.4.8`. Two turns: the overload fix
for the user's "subtitles run, voice goes silent, then rushes" report, then a language cleanup.

## What changed

- **1.4.7, the fix.** The engine had no overload behaviour. With a TTS server slower than real time,
  `nextSpeech` stood silent 4.5s per sentence before dropping it, and `schedule` kept spending the
  server on sentences already given up on. Measured on the real caption timeline of the user's video
  (`H9yU-Y22vGI`, 61 cues, wall-to-wall speech) at RTF 1.0: **12/61 sentences spoken, 63s silence**.
  Now `waitAudio(p)` estimates the remaining wait from a measured `renderRtf` EMA, `skipAhead` jumps
  the queue to the first sentence whose audio can still arrive (`SYNC.skipAfter` 8, `skipAheadMax`
  60), `inWindow` refuses plans at or behind `lastSpokenStart`, and an empty buffer asks for one
  short plan instead of a 4-plan batch. After: **30/61 spoken**, sentences over 2s late 10 → 2.
  RTF 0.7 / 0.45 / 0.23 unchanged at 58 / 60 / 61 of 61, so a healthy server sees no difference.
- **1.4.8, no behaviour change.** The comments and the test name added in 1.4.7 are now English, per
  the `Language` section a docs session added to `CLAUDE.md`. Pre-existing Vietnamese comments,
  function names and test names were left alone, and every end-user string stays Vietnamese.

## State

- `npm test`: 322 tests, 321 pass, 0 fail, 1 skip · committed by path · Reload at
  `chrome://extensions`: **yes** (1.4.8)
- VieNeu: healthy, RTF ~0.23, `Interactive`, LaunchAgent loaded. The user's own server is **not**
  the slow case above; the fix matters when the machine gets busy.

## Unfinished / in progress

- Never reproduced live in the user's Chrome: a YouTube tab driven through the extension bridge
  reports `document.hidden = true` and the player stays at `readyState 0`, so playback never starts.
  Any measurement that needs a really playing video has to be run by the user.
- Alt+S / Alt+D end to end and the quick-menu voice picker are still unmeasured (user deferred).
- `docs/BACKLOG.md` has 8 open items, all needing the user's go-ahead first.

## Traps hit this session

- The sandbox blocks loopback TCP: `curl 127.0.0.1:8000` fails and a port probe says "closed" while
  the server is provably up. Read `~/VieNeu-TTS/server.log` and `launchctl print` instead.
- Two plausible guards measured as worth **nothing** (a fresh-branch drop, a reachability filter at
  start) and one as actively harmful (capping the skip distance: 29/61 → 14/61). Sweep, do not reason.
- `tests/dub-sim.js` has no slow-server helper; build the scenario inline with a provider that
  resolves through the virtual clock and serialises itself (the real server is 1 stream).

## Suggested next step

- Ask the user to watch a video and report, or pick a `BACKLOG.md` item.
