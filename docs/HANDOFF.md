# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-26 · lane A (`youtube.js`, `yt-bridge.js`, `lang-detect.js`) · `1.6.9`. User (screenshot of
3lY0eRQhYkY, a Vietnamese news clip showing our translated line): recognise Vietnamese videos
better and do not subtitle them.

## What changed

- 1.6.9: cause measured on the live page: YouTube AI-dubbed the clip into English (audio "vi.4"
  original + "en-US.10" dubbed) and listed the dub's English ASR first; "first ASR" called it
  English. Bridge now reports audio tracks (`docAmThanh`), `CST_LANG.spokenLanguage` decides,
  spoken Vietnamese is never subtitled (gate before the cache, "Vẫn dịch" by hand), `ytChonTrack`
  skips AI-dub ASR tracks. Verified the audio read on the real page and on an English TEDx talk.
- Earlier today: 1.6.8 no robotic stutter (510 -> 0 rate changes), 1.6.7 pauses / 48 kHz,
  1.6.6 settings backup, 1.6.5 generic sites, 1.6.4 backlog.

## State

- `npm test`: 390 tests, 389 pass, 0 fail, 1 skip · Reload: **yes** (1.6.9 not yet loaded)

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
- YouTube player audio-track objects have minified keys: read them by value shape, never by name.

## Suggested next step
- Reload, open 3lY0eRQhYkY (must stay unsubtitled), then an English lecture (must translate).
