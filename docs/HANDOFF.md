# Handoff (2026-10-27, lanes B/D with A/C integration, VieNeu timing)

## Current state
- Release 3.1.2 generated; pending note collected. Main handover hooks remain installed.
- background.js returns local timing: queueMs/generationMs/processingMs/rawAudioSeconds/cold;
  status includes sample count. Cached replies do not invent generation samples.
- dub-engine.js forwards timing, estimates preparation from generation + processing excluding
  global queue wait, ignores cold or >=60-second synthesis samples, exposes timing in health/events.
  Providers without timing retain the old estimator. Audio cache identity and words are unchanged.
- dubbing.js distinguishes a queue wait from slow generation. Slow advice needs four useful takes;
  dub-hardware.js no longer infers weak hardware from latency. options.js reports insufficient samples.
- Initial prepareHold may wait up to SYNC.prepareColdMaxMs (20 s) only while the first local job is
  pending and no take exists. Readiness, explicit limits and manual Play still end it earlier.
- context-engine.js adds military-history detection/senses, including multiword institutional names.
  vi-quality.js requests refinement for partial English echoes after translated institutional names;
  full bilingual glosses and independent names remain valid. No destructive text repair.
- npm test: 1011 tests, 0 fail, 2 normal skips. New tests cover worker queue timing, scheduler samples,
  initial hold, measured warnings, context and name echoes (tests/vieneu-timing.test.js plus existing suites).
- Current Chrome store: 100 videos / 9273 groups. Archive+store dedup: 145 videos / 16786 groups;
  no newly flagged name echoes and no domain changes there. Reported live echo is a test fixture.
- Old/new delivery simulation: 100 current videos, no changed/worse metrics (legacy timing path).
- Standard regression: 45 archived videos + 24 scenarios; compare/save completed before handover.
- Real worker: a take queued 1258 ms, generated 963 ms, processed 296 ms for 2.58 s final speech.
- Real headless Chrome + local VieNeu: 9 starts, 0 drops/errors/overlaps/voice while paused;
  one start >0.5 s late (max 0.71 s), seek recovery 0.07 s, measured RTF 0.23.

## Unfinished
- Reported documentary 9T1Nvtn3QOk has no complete ytcache4 record. Cost ledger confirms visits;
  reopened it in a dedicated Chrome tab and inspected 43 translated transcript rows near 39-43 min.
  Found "Hồng quân Red". Full documentary semantics/timing from yesterday were not reconstructed.
- Test video left paused with transcript open. User must Reload for new code; paid TTS never enabled.
- Carried forward: native-fullscreen subtitle playback confirmation; real-page overlay fade;
  sparse caption notice on iYL-UuNE_9w; TED embed/hold issues and Mac auto-update install.
- Earlier redesign pending Gemini/disclosure/cost/workspace items need reconciliation with releases.

## Traps
- A high RTF from total request latency is not proof of weak hardware. Queue and cold/suspend stalls
  were conflated. Historical server logs contain hour-long suspended requests; exclude them from speed claims.
- Static tests in hardening.test.js pinned estimator variable names; worker-timing tests now cover behavior.
- build-stamp.js is ignored and generated after commit. Do not stage it or remove/reinstall the extension.
