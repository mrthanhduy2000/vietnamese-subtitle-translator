# Handoff (2026-11-03, lane B with D tests/release integration)

## Current state
- Release 3.1.7 implements the user's selected policy: continuous video with complete delayed speech.
- dubbing.js enables keepAllSpeech. The bare engine compatibility default keeps legacy skipping;
  production simulator/live/listening harnesses explicitly enable the shipped complete-speech mode.
- No lag-based skipping, no advancing the entry while synthesis waits. Unspoken plans/audio/jobs
  survive window moves and eviction. Explicit pending translations block later speech.
- Rendering follows the next speech span and advances across long source silences; it does not
  generate an ever-growing WAV backlog near the distant source playhead.
- Natural EOF drains speech on an incremental clock; rate changes remain continuous. Manual
  pause silences speech; seeks/navigation/dubbing off reset the queue. Ads preserve source entry.
- Health reports waiting translation, complete-speech delay, actual errors and final-tail playback.
- npm test: 1054 total, 1052 pass, 0 fail, 2 conditional skips. Fourteen new FIFO/EOF/ads/live tests
  plus production-policy integration; legacy recovery-budget tests explicitly select old policy.
- 145 saved videos, LATENCY=busy with queue drained: missing words 16 -> 0, repeated words 0,
  lag drops 1 -> 0. Late starts 2243 -> 2281 are accepted; no cuts or hard starts introduced.
- Standard regression: 45 videos + 24 scenarios, 141 changed metrics / 61 worse tradeoff metrics.
  Every worse metric is explained in docs/measurements/complete-speech-regression-2026-11-03.json.
  Scenario drops 19 -> 0, late 76 -> 138, gaps 20.34 -> 39.62 s. Baseline 3.1.7 saved.
- Real original-audio A/B: same 28 Kim Thanh takes, both capped at 1x, source ends at 50 s.
  Whole takes completed: 20/28 -> 28/28; zero overlap/errors. New tails ~13.11/23.75 s on two
  dense clips; increased lag is the selected policy. No subjective listening judgment claimed.
- docs/COMPLETE_SPEECH.md and complete-speech*.json retain methods, hashes and exact results.
  Local source/voice/mixed recordings: ignored tests/harness/smooth/real-video/, served on 8768.
  Prior default-rate study preserved under history-3.1.5-3.1.6/. No paid calls in validation.

## Unfinished
- Source-caption/content mismatch remains separate: Russian source/caption discrepancy flagged
  by independent ASR. Complete speech preserves supplied text; it does not repair bad captions.
- Speaker attribution, glossary loading/UI states and full-video/source-meaning listening remain.
- Documentary 9T1Nvtn3QOk: earlier inspection only 39-43 minutes, no complete ytcache4 record.
- Carry forward native fullscreen, real-page overlay fade, sparse notice on iYL-UuNE_9w,
  TED embed/hold issues, Mac auto-update install and old UI redesign-note reconciliation.

## Traps
- Separate queue retention cursor from render horizon; a fixed cursor otherwise stalls after gaps.
- Simulated fixed end+5 s is not full-word accounting: drain before counting; physical EOF is tested
  separately in Chrome. Real recordings' raw paused counter includes intentional natural-EOF tails.
- Do not compare the earlier automatic-rate clips with the new 1x stress protocol as speed gains.
- Changing videos, including autoplay navigation, intentionally abandons the previous speech queue.
- Reload at chrome://extensions and refresh video tabs; never remove/reinstall or overwrite settings.
