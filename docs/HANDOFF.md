# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched

2026-09-23 · lane B (`dub-engine.js`) plus one test · version `1.4.7`. The user reported the old
complaint again: subtitles run, the voice is silent for a stretch, then rushes or skips the line.

## What changed

- **Root cause found by simulation, not by reading**: the engine has no overload behaviour. When the
  TTS server is slower than real time, `nextSpeech` stood silent 4.5s per sentence before dropping
  it, and `schedule` kept spending the server on sentences already given up on. On the real caption
  timeline of the user's video (`H9yU-Y22vGI`, 61 cues, wall-to-wall speech) with the server at
  RTF 1.0: **12/61 sentences spoken, a 63-second silence**.
- **Fix, three parts in `dub-engine.js`**: `waitAudio(p)` estimates the remaining wait from a new
  measured `renderRtf` EMA; `skipAhead` jumps the queue to the first sentence whose audio can still
  arrive (`SYNC.skipAfter` 8, `skipAheadMax` 60); `inWindow` refuses plans at or behind
  `lastSpokenStart`. Plus: an empty buffer now asks for **one** short plan instead of a 4-plan batch.
- **Measured after**: RTF 1.0 → 30/61 spoken, sentences over 2s late 10 → 2. RTF 0.7 → 58/61 (same
  as before), RTF 0.45 → 60/61, RTF 0.23 → 61/61 (all unchanged, no regression when healthy).
- New test in `tests/hardening.test.js` ("máy chủ giọng chậm hơn thời gian thực") fails on the old
  engine, passes on the new one. `docs/DUBBING.md` §SYNC records the measured thresholds.

- Separately, a docs/infra session added a **`Language` section to `CLAUDE.md`**: comments, new
  function and test names, and commit messages are English; chat replies and every string the end
  user reads stay Vietnamese. Existing Vietnamese names and comments are left alone.

## State

- `npm test`: 322 tests, 321 pass, 0 fail, 1 skip · committed by path · Reload at
  `chrome://extensions`: **yes** (1.4.7)
- VieNeu: healthy, RTF ~0.23, `Interactive`, LaunchAgent loaded. The user's own server is **not**
  the slow case above; this fix is for when it becomes slow.

## Unfinished / in progress

- Never reproduced live in the user's Chrome: a YouTube tab driven through the extension bridge
  reports `document.hidden = true` and the player stays at `readyState 0`, so playback never starts.
  Whatever measurement needs a really playing video has to be run by the user.
- Alt+S / Alt+D end to end and the quick-menu voice picker are still unmeasured (user deferred).
- `docs/BACKLOG.md` has 8 open items, all needing the user's go-ahead first.

## Traps hit this session

- The sandbox blocks loopback TCP: `curl 127.0.0.1:8000` fails and a port probe says "closed" while
  the server is provably up. Read `~/VieNeu-TTS/server.log` and `launchctl print` instead.
- Two plausible-looking guards measured as worth **nothing** (a fresh-branch drop, a reachability
  filter at start) and one measured as actively harmful (capping the skip distance at 6 to 14s:
  29/61 → 14/61). Every constant here has to be swept, not reasoned about.
- `tests/dub-sim.js` has no slow-server helper; the scenario has to be built inline with a provider
  that resolves through the virtual clock and serialises itself (the real server is 1 stream).

## Suggested next step

- Ask the user to watch a video and report; or pick a `BACKLOG.md` item.
