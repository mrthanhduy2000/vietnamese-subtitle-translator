# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-26 · lane B (`dub-engine.js`, `dub-audio.js`) · `1.6.8`. User: 1.6.7 was better; all
southern voices at 48 kHz (already true for every VieNeu voice); voice still stutters like a robot,
make it smoother and more expressive, smarter pausing v2.

## What changed

- 1.6.8: `driveSpeech` absorbs start-up latency, smooths drift, nudges with hysteresis: playbackRate
  changes on playing voices 510 -> 0 in 120 s (real Chrome, `tests/harness/smooth.html`).
  `snapToNatural`: 21/24 Thục Đoan sentences at exactly 1.0. Pause v2 in `punctuationBreaks`,
  floor-adaptive `gateNoise`, `FREE_SEGMENTS` (11 s), `LOCAL_STYLE_VERSION` 5. See `docs/DUBBING.md`.
- Earlier today: 1.6.7 punctuation pauses / 48 kHz, 1.6.6 settings backup, 1.6.5 generic sites.

## State

- `npm test`: 384 tests, 383 pass, 0 fail, 1 skip · Reload: **yes** (1.6.8 not yet loaded)

## Unfinished / in progress

- "Truyền cảm" (expressiveness) is not solved: VieNeu takes no prosody control and ignores `speed`;
  temperature 0.4 to 0.8 measured no roughness difference, expressiveness was not measured.
  Options to discuss with the user: per-voice temperature, Gemini TTS for expressive passages.
- Waiting on the user's ear for the v2 samples (sent, scratchpad only).
- Not verified in real Chrome with the extension loaded: backup download, generic injection,
  `ensureYtBridge` after Reload, 1.6.7/1.6.8 end to end on a real video.
- Udemy / edX site sources: `BACKLOG.md` item 9. Long-video jank not measured live.
- Paraphrased leak on 4eY5DuqASQc (~8:40). Plan stages 3-4 on hold.

## Traps hit this session

- The static server lets Chrome cache scripts: harness pages must load them with `?t=Date.now()`.
- Chrome pauses a muted `<video>` in the hidden pane; use a silent `<audio>` as the clock.
- Never put a "before" number in release notes that was not measured (Mỹ Duyên was only measured
  after the fix).

## Suggested next step
- Reload, play a lecture with Thục Đoan and with Mỹ Duyên, listen for stutter and pause placement.
