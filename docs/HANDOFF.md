# Handoff (2026-11-07, lane B with D tests/tools and harness integration)

## Current state
- Release 3.1.9 adds bounded multi-sentence pacing in dub-planner.js / dub-engine.js.
- planParagraph searches six plans with an eight-state beam, propagating speech completion and
  legal rests. Only the first rate/rest is committed, then recalculated for the next take.
- The existing controller supplies first-rate lower/upper bounds. The horizon cannot lower that
  incumbent rate; it anticipates density without sacrificing prior delivery performance.
- Long source silences and pending translations end the horizon. Clause/phrase rests and tighter
  in-sentence rate steps remain protected; a full stop can borrow its existing 0.18 -> 0.12 s.
- DurationEstimator learns per voice/text class (31 takes), robust inverse-ratio EMA and MAD
  uncertainty. Stable real samples guard SPS/calibration updates against isolated abnormal takes.
- Actual audio duration wins; forecasts convert base tempo/slack once. User caps, FIFO, full
  speech and continuous video remain binding. No text, segmentation or internal pause changes.
- debugSnapshot().paragraph exposes the horizon. No new loader or persisted setting is needed.
- npm test: 1,087 total, 1,085 pass, 0 fail, 2 conditional skips; 14 new paragraph tests.
- tools/session-corpus.js adds per-video lag P95/sum and playback-rate jumps above 15%.
  Never interpret the sum of per-video P95 values as a corpus P95 or rate jumps as heard pace.
- tools/paragraph-audio-eval.js predicts real saved takes before learning each one.
  Kim Thanh 28 takes: duration MAE 0.351 -> 0.328 s; bounded one-voice evidence, not a blind corpus.
- Real-source auto A/B: same 17 takes complete on both, zero overlap/errors/manual-paused sound;
  tail 1.63 -> 1.59 s is too small to claim audible improvement. A capped 1x run completes 7/7.
- Live worker/Chrome 32 s: zero errors/overlap/paused speech; one ad-boundary sample 2 ms after
  the ad gate changed, inside the existing fade/50 ms tick window (no sustained ad speech).
- Archived regression: 45 videos, late 1,486 -> 1,339, gaps 4.50 -> 2.98 s, zero word losses.
  24 scenarios: late 138 -> 134; one worse metric, slowTts@busy gapSum 2.21 -> 2.23 s.
  The 20 ms change is within the simulator's 25 ms advancement step; counts/safety unchanged.
- Full 145-video corpus: late 2,344 -> 2,110; lag sum 3,717.568 -> 3,366.419 s; rate jumps 1,150 -> 964.
- Full results, bounded local regressions and limitations: docs/measurements/paragraph-pace-2026-11-07*.json.

## Unfinished
- Source-caption/content mismatch remains separate: Russian source/caption discrepancy flagged
  by independent ASR. Complete speech preserves supplied text; it does not repair bad captions.
- Speaker attribution, glossary loading/UI states and full-video/source-meaning listening remain.
- Documentary 9T1Nvtn3QOk: earlier inspection only 39-43 minutes, no complete ytcache4 record.
- Carry forward native fullscreen, real-page overlay fade, sparse notice on iYL-UuNE_9w,
  TED embed/hold issues, Mac auto-update install and old UI redesign-note reconciliation.

## Traps
- An unconstrained natural-speed objective nearly doubled archived late starts; retain incumbent bounds.
- The audio evaluator excludes tempo/slack shaping; it measures the predictor, not total playback fit.
- Real-source harness defaults to 1x; ?auto tests automatic rates, &baseline uses the ignored
  smooth/paragraph-baseline-engine.js copied from the baseline commit. Compare identical takes.
- The long-gap duck test now includes an explicit eight-second source gap, outside bridge/ramp edges.
- Reload at chrome://extensions and refresh video tabs; never remove/reinstall or overwrite settings.
