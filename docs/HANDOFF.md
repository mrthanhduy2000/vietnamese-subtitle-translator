# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lanes A + B + D · `1.7.4`. User: full-system optimization pass on top of the 1.7.3
audit (do not redo it); fix only what evidence supports. Each fix has a test that fails on 1.7.3.

## What changed

- Coursera: leaving a lecture mid-translation (`state.navGen`) stops the old run's Gemini calls,
  never paints it over the new lecture; `courseraAutoTranslate` waits for the leftover `busy`.
- YouTube: `ytBatDauDich` checks `stale()` after every await (only the last one was checked);
  `ytTuDongDich` waits for a leftover `busy` instead of skipping the new video for good.
- Cost: `handleTranslateUnit` also looks up later chain models priced >= the first (a rate-limited
  first model left lines under the next model's key); dub engine looks up `batchSpill` segments
  before batching and never batches an unlooked-up one (revisit re-paid Gemini TTS).
- `dubbing.js` `start`: `dub.starting` handed back in a `finally`. Dead `localSerial` priority
  and stale condense comments gone. Docs: SUBTITLE, DUBBING, DANGER 12, TESTING, BACKLOG 10-13.

## State

- `npm test`: 418 tests, 417 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs (not loaded)

## Unfinished / in progress

- Not verified in real Chrome: 1.7.2 / 1.7.3 / 1.7.4 end to end (Coursera lecture change mid-
  translation is the one to try), backup download, generic injection, `ensureYtBridge`, 1.7.0 case.
- Kept on purpose, unverified: host permissions `fonts.googleapis.com` / `fonts.gstatic.com` look
  unneeded; remove only after a real-Chrome check of options + overlay fonts.
- Prompts / context NOT trimmed (quality risk). 1.7.2 audio not heard yet. "Truyền cảm" not solved.
  Udemy / edX (`BACKLOG.md` 9). Long-video jank unmeasured. Leak on 4eY5DuqASQc ~8:40.

## Traps hit this session

- `audit.test.js` `pageEnv({ timers: true })`: real timers at 1/100 speed, intervals recorded not
  run (`E.intervals`); stub `youtube.js` functions with `E.run("ytTaiBanChepLoi = ...")`.
- `bg-env.js` `send` never resolves for an unknown action: awaiting a removed route hangs `npm test`.
- The sandbox blocks loopback: `curl 127.0.0.1:8000` exits 7 while VieNeu is up. Retry unsandboxed.

## Suggested next step
- Reload; on Coursera click the next lecture within ~10 s: it translates, the old lines never show.
