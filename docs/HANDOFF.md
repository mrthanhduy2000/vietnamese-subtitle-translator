# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-26 · lanes A + B + C + D · `1.7.1`. User: rename the old 70% subtitle size to 100% and
rescale the rest; Mỹ Duyên as default voice; better pausing, less noise and roughness, better
audio and subtitles.

## What changed

- 1.7.1: `CST_STYLE.sizeFactor` (x0.7) everywhere a size becomes pixels, picker list and steppers
  on the new scale, `fontScale170` migration (chained after `styleDefaults118`). `voiceMyDuyen170`
  sets Mỹ Duyên once. `AUDIO.denoise` (STFT Wiener, skips clean takes) before cutting VieNeu audio,
  `LOCAL_STYLE_VERSION` 6. `CST_STYLE.lingerCues` gives display lines up to 0.7 s of reading time.
  Pause shaping re-measured: 14/14 punctuation matched on 8 Mỹ Duyên sentences (unchanged code).
- Earlier today: 1.7.0 / 1.6.9 Vietnamese-video and AI-dub detection, 1.6.8 no stutter,
  1.6.7 pauses / 48 kHz, 1.6.6 backup, 1.6.5 generic sites.

## State

- `npm test`: 398 tests, 397 pass, 0 fail, 1 skip · Reload: **yes** + F5 YouTube tabs (1.7.1 not loaded)

## Unfinished / in progress

- "Truyền cảm" (expressiveness) is not solved: VieNeu takes no prosody control and ignores `speed`;
  temperature 0.4 to 0.8 measured no roughness difference, expressiveness was not measured.
  Options to discuss with the user: per-voice temperature, Gemini TTS for expressive passages.
- No English video with a Vietnamese AI dub found to test 1.7.0 end to end. Denoise A/B sent.
- Not verified in real Chrome with the extension loaded: backup download, generic injection,
  `ensureYtBridge` after Reload, 1.6.7/1.6.8 end to end on a real video.
- Udemy / edX sources: `BACKLOG.md` 9. Long-video jank unmeasured. Leak on 4eY5DuqASQc ~8:40.

## Traps hit this session

- The static server lets Chrome cache scripts: harness pages must load them with `?t=Date.now()`.
- Chrome pauses a muted `<video>` in the hidden pane; use a silent `<audio>` as the clock.
- YouTube player audio-track objects have minified keys: read them by value shape, never by name.

## Suggested next step
- Reload; check the subtitle looks the same size as before (now labelled 100%), listen to Mỹ Duyên.
