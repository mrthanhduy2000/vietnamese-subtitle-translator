# Handoff (2026-11-03, lane B with D tests/release integration)

## Current state
- Release 3.1.6: predecode the first/seek landing take, including paused startup without a hold.
  Do not repeatedly recreate idle elements while paused. Avoid an exact redundant seek to zero.
- dub-engine.js keeps speech text, rate ceilings, sentence rests and synthesis/cache policy intact.
- debugSnapshot adds playbackStart/playbackLag/startupMs and delivery playbackLate/playbackLagMax.
  Scheduling time remains separate; resume/drift correction never counts a line twice.
- npm test: 1039 total, 1037 pass, 0 fail, 2 conditional skips. Four new onset tests;
  all four fail against 3.1.5. Existing startup/drift/click/seek scenarios remain covered.
- 145 unique saved videos (45 archive + 100 current Chrome): 17,952 spoken plans, 2,181 minutes.
  LATENCY=busy old/new: gaps 126 -> 104, 21.68 -> 15.43 s; late starts 2246 -> 2243.
  No per-video loss/late/gap regression; requests unchanged. Existing loss: 1 drop / 16 words.
- Standard regression: 45 videos + 24 scenarios, 15 metrics improved, zero worse.
- Real-worker/local-VieNeu/Chrome 32 s: 9 starts, zero drops/errors/overlap/paused voice;
  max inferred playback lag 74 ms, max startup 86 ms, RTF 0.29. No paid network requests.
- Prepared PCM A/B, normal and CPU=6: no overlap/paused sound/drop/error; four lines at 1x,
  offset zero. Final run heard and completed all four. Both versions were prompt on this Mac;
  do not claim a perceptible speed improvement from these short clips alone.
- tests/harness/onset-prep.js and onset.html reproduce acoustic-onset checks; headless HARNESS_URL
  supports live-server.js. Local recordings/comparison page are ignored under harness/smooth/.
- No full live-video/source-speaker alignment or human listening judgment was established.

## Unfinished
- Dense speech can still exceed the hard lag bound: one baseline/current corpus case dropped
  16 words at 10.19 s lag. Track the defect class in BACKLOG; never shorten speech to hide it.
- Next audit items: speaker attribution, then glossary loading/UI states.
- Historical empty/timeout logs are bounded history, not a current failure rate.
- Documentary 9T1Nvtn3QOk had no full ytcache4 record; earlier inspection covered 39-43 minutes,
  not full semantics/timing. Earlier video was left paused with transcript; paid TTS stayed off.
- Carry forward: native fullscreen, real-page overlay fade, sparse notice on iYL-UuNE_9w,
  TED embed/hold issues, Mac auto-update install and reconciliation of old UI redesign notes.

## Traps
- A play() call is not audible onset. Media movement is a proxy; the harness checks PCM peaks.
- Keep prewarm bounded to the eligible take, never replace a playing/fading element.
- Audio-context timers/URL methods need bound wrappers when supplied as engine dependencies.
- Keep settingsPatch/delta saves, exact cache totals and partial checkpoint contracts from 3.1.4-5.
- Reload at chrome://extensions, then refresh video tabs. Never remove/reinstall.
