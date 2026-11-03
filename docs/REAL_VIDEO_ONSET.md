# Real-video onset validation (2026-11-03)

This follow-up replaces synthetic sentences as the primary listening evidence. It validates the
3.1.5/3.1.6 delivery comparison against downloaded original audio, not invented speech content.
It does not establish a human listening judgment or full-video semantic alignment.

## Sources and inputs

| Source | Original interval | Input class |
|---|---|---|
| https://www.youtube.com/watch?v=6QULfp2wdZI | 465–515 s | Caption/content mismatch and dense translated group |
| https://www.youtube.com/watch?v=JBvcMfa7K6E | 90–140 s | English commentary with short dialogue |
| https://www.youtube.com/watch?v=yZfhCQwCWT4 | 120–170 s | Rapid English conversation/interjections |

- Downloaded original-language audio with yt-dlp 2026.10.26. Decoded the complete downloaded
  track before sample-exact cropping with ffmpeg 9.0; each clip is exactly 50.000 s / 48 kHz mono.
  Partial stream-copy downloads can include preroll, so those were not used as final sources.
- Re-fetched current captions: manual Russian and original English ASR tracks. Select language
  from the downloaded source metadata; a multi-audio video can otherwise select another dub.
- Vietnamese groups come from the user's saved cache through playback-sim.js realGroups repairs.
  Include only complete groups within the interval; exclude boundary-straddling groups.
- real-onset-prep.js builds the actual speech plans and renders them through the real local
  worker/VieNeu provider, voice Kim Thanh. No new paid translation or paid voice calls.
- Both engines use the same 28 WAV takes, timing, speech text and voice. The page rejects a plan
  count/text mismatch. All speech is prepared before play, isolating delivery from generation.
- Original source sound and Vietnamese speech are recorded together in real Chrome/WebAudio.
  Audio peaks >0.003 sampled every 10 ms mark acoustic onset; ended events verify whole-take
  completion. Rates are the engine's existing choices, with no ceiling increase.

## Reproduction

Keep source metadata, original WAVs, caches, generated speech and recordings local under ignored
`tests/harness/smooth/real-video/`. Source metadata requires id/title/language/start/end/webpage_url.
Run `node tests/harness/real-onset-prep.js <saved-cache-dump> "Kim Thanh"`.
Copy 3.1.5 dub-engine.js to ignored `smooth/onset-old-engine.js` for the baseline.
Run `PAGE='tests/harness/real-onset.html?case=<id>&old&record'` and then the same without `&old`,
with `EXPR='runReal().catch(e=>{result={done:true,error:e.stack}}); "running"' POLL=result
through `node tests/harness/headless.js`. Check process/page errors and result.error explicitly.
Decode the recording data URL into `<id>-before.webm` / `<id>-after.webm`; retain numeric results
separately. The listening page exposes original source links, source audio, both recordings and
all input source/Vietnamese groups. Shared media is not committed to Git.

## Interpretation and limits

The Russian source has a substantial content mismatch: local Whisper base recognition of the
original sound describes bank-card benefits, while current manual captions interleave unrelated
subjects. This is a diagnostic cross-check, not a human-verified transcription. The two English
clips agree much more closely with independent recognition. Playback delay relative to bad
caption timestamps is not a valid measure of delay relative to the actual speaker's meaning.

Whisper base ran locally on all three original clips for cross-checking, not as a replacement
translation. The page preserves the original audio so the user can hear the evidence directly.
Prepared-take A/B does not measure first-request cold-start waiting, full-page YouTube behavior,
or carry-over from earlier minutes. Conclusions about improvement must be limited to these clips.

## Measured results

| Source | Completed before / after | Late >0.5 s before / after | Max acoustic lag before / after |
|---|---|---|---|
| 6QULfp2wdZI | 4/4 / 4/4 | 2 / 2 | 4.997 / 4.988 s |
| JBvcMfa7K6E | 7/7 / 7/7 | 0 / 0 | 0.250 / 0.247 s |
| yZfhCQwCWT4 | 17/17 / 17/17 | 11 / 11 | 4.289 / 4.287 s |

All six runs: zero overlap, paused sound, engine errors or dropped plans. Acoustic lag here is
relative to the saved caption plan, not verified source-phoneme/meaning alignment. Differences
are small and browser scheduling varies between runs; these samples do not demonstrate a
perceptible improvement from 3.1.6. They do reveal a remaining source-quality problem.

[Machine-readable measurements and input hashes](measurements/real-onset-2026-11-03.json).
