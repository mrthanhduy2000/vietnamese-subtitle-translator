# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-02 · `2.4.6` a voice Chrome is slow to start is no longer seeked: the user's "bụp bụp" pops.

## What changed
- Cause (the user's `chrome://media-internals`, AF9Gnn2tVJw): Chrome holds a fresh or idle voice
  0.16 to 0.96 s after `play()` / a seek while VieNeu renders; `driveSpeech` took that for drift
  and reseeked, which restarts the start: up to 7 seeks in 1.1 s on one voice.
- `settleSpeech`: a voice not yet moving is not drift, the wait moves the line later (`startWaitMax`
  2.5 s; drift seeks `reseekSpacing` 2 s apart). Fade in when resumed inside a take, `quietPause`
  before a pause (40 ms squared steps); `onVolume` re-ducks YouTube's own volume write at once.
- Sim `startLatency` / `LATENCY=busy`, 34 videos busy: seeks 1599 -> 0, skipped 253 s -> 0, hard
  starts 213 -> 0, read / dropped 7165 / 0 both, > 0.5 s late 1689 -> 1715 (the wait is lateness).
- `startUp` in "Chép chẩn đoán". `tests/harness/headless.js` runs a harness page in headless Chrome.

## State
- Tests: 640 pass, 0 fail, 1 skip. Reload: **yes** for 2.4.6 (`chrome://extensions`), then F5 the tab.
- `REVIEW_MARK` not moved: 679UtcE_k6c and AF9Gnn2tVJw join the next batch.
- **The user's view (2026-10-01):** new videos only; every fix is a rule for all future videos
  (false hits measured on all saved videos), no "small pinch" left; name what cannot be fixed, with
  numbers. On a sound report dig yourself (`docs/TESTING.md` "Live measurement"), never ask them.
- By design: 13% of lines start > 1 s late, all fast talkers (yZfhCQwCWT4 100 of 191); the voice is
  at its ceiling, condensing is forbidden. Slowing the video was offered, not built.
- `pickRefined` / the `misaligned` refine are not seen against live Gemini (no refine data offline).

## Unfinished / in progress
- 2.4.6 not heard by the user yet; if pops remain, read media-internals `seek_target` rows first. A
  seek or stop still cuts a sounding voice at once (`releaseAudio` drops the fade): unmeasured.
- Not seen in a real browser: the Settings counter and button, a 3-hour video's performance.
- Carried: voice items for the user's ear ("có nghĩa là", DN, NHNN). Never ask about Apple Events JS.

## Traps hit this session
- Control_Chrome scripts run in an isolated world (no `yt`, no `CST_DUB`) and return nothing for a
  Promise: store in `window.__x`, read it in a second call. Headless Chrome needs the sandbox off.

## Suggested next step
- Next batch: `node tools/ext-storage.js --prefix=ytcache4_ --out=<dir>`, then
  `node tools/batch-review.js <dir> --since=1790822701723 --sim`, read `--show=omission,leftover`.
