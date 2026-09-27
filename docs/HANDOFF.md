# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lane B (`dub-engine.js`, `dubbing.js`) + D (tests) · `1.7.9`.
User report: on YouTube the original track was not ducked to 10% while VieNeu spoke.

## What changed
- Root cause: `onVolume` treated any foreign volume write as a user change, set
  `baseVolume = v.volume / duckFactor` (0.75 / 0.1 -> clamped 1) and `updateDuck` returned early
  because `duckFactor` already sat at its target, so nothing re-ducked until the voice paused.
  YouTube's player writes its own level itself (Stable Volume; measured in the in-app browser: after
  a seek 0.1 -> 0.893, player `getVolume()` stays 100). Continuous speech never paused -> never ducked.
- Fix: `duckDirty` forces `updateDuck` to re-apply next tick after any foreign write.
  `settings.playerOwnsVolume` (YouTube, from `dubbing.js`) takes the written value as the base
  as is; other sites keep the divide-by-duck-factor rule. `DUBBING.md` Ducking bullet updated.
- New test in `tests/dub.test.js` ("YouTube re-applying its own volume..."): fails on 1.7.8 (0.75).

## State
- `npm test`: 466 tests, 465 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs
- Not verified in the user's real Chrome (Claude in Chrome was not connected). Which YouTube event
  wrote the volume in the user's session is not known; only the seek case was reproduced.

## Unfinished / in progress
- Carried over from 1.7.8: `BACKLOG.md` 21-25 (respellings 44/66, phonemes not sound, RAM label,
  caps default, "để" pauses); "sam" held out of RESPELL until a new unseen split exists.
- Not heard by the user: 1.7.8 A/B WAVs, 1.7.6, 1.7.5, 1.7.2 audio.
- Carried over: `BACKLOG.md` 14, 15, 16 (PP inside a long subject), 18, 19, 20 (keep VieNeu resident).
- Not verified in real Chrome with the extension: 1.7.2 to 1.7.9 end to end, backup download,
  `ensureYtBridge`, 1.7.0 case. Prompts / context NOT trimmed. Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- If YouTube ever writes its volume continuously, the engine will re-duck every 50 ms tick: a
  short blip each time. Not seen in 30 s of playback; watch for "pumping" reports.
- The scratchpad take folders can vanish between runs (`tools/prosody-eval.js` re-renders ~10 min).
- A comment naming a Gemini model id fails `cost.test.js` (only `cost-policy.js` may).

## Suggested next step
- Reload; dub a YouTube video at "Tiếng gốc khi đọc" 10%, seek a few times, confirm the duck holds.
