# Handoff (2026-11-07, lane B with C/D loader, tests and release integration)

## Current state
- Release 3.1.8 completes the shared speech-session coordinator begun after 3.1.7.
- dub-session.js owns lifecycle, FIFO entry/cursor, EOF clock, ad return and async leases.
  dub-engine.js retains provider/audio effects, using aliases for existing adapter/test fields.
- Production retains continuous video and complete FIFO speech; no condensing or lag-based drops.
- Playback tokens include the reset revision. Matching synthesis may survive same-source seeks;
  stop/restart or source/provider/text/voice/timing changes reject obsolete results.
- Old cache failures/timeouts and render failures cannot poison refined replacement plans.
  Old provider success cannot erase a new provider's errors. EOF reports pending translation.
- Source groups with invalid outer timing are reported and excluded from planning.
- Near-end uncached seeks use the same FIFO eligibility for synthesis and playback; the former
  0.3-second scheduler exclusion could leave the entry permanently waiting for unscheduled audio.
- Both manifest pipelines, Settings, VM loaders and browser harnesses load session before engine.
- tests/dub-session.test.js adds 19 contracts/races; existing complete-speech tests stay enabled.
- npm test: 1,073 total, 1,071 pass, 0 fail, 2 conditional skips.
- Regression: 45 videos + 24 scenarios, zero changed/worse metrics versus 3.1.7.
- Real Chrome/local worker: 150 s, 29 starts, zero errors/overlap/paused/ad sound.
  Targeted near-end seek resumes in 0.55 s; previously silent for the 16 s observation.
- Full archive + current Chrome: 145 videos, zero changed corpus metrics.
- Three real-source clips: 28/28 takes complete, zero overlap/errors/manual-paused sound.
- Validation results are recorded in docs/measurements/shared-session-2026-11-07.json.
- tools/session-corpus.js reproduces baseline/current comparison over archive plus Chrome exports.
  docs/DUBBING.md documents ownership, lease boundaries and pending-group producer obligations.

## Unfinished
- Source-caption/content mismatch remains separate: Russian source/caption discrepancy flagged
  by independent ASR. Complete speech preserves supplied text; it does not repair bad captions.
- Speaker attribution, glossary loading/UI states and full-video/source-meaning listening remain.
- Documentary 9T1Nvtn3QOk: earlier inspection only 39-43 minutes, no complete ytcache4 record.
- Carry forward native fullscreen, real-page overlay fade, sparse notice on iYL-UuNE_9w,
  TED embed/hold issues, Mac auto-update install and old UI redesign-note reconciliation.

## Traps
- Queue retention and render horizon are different; the latter must cross long source silences.
- Playback callbacks require revision tokens; synthesis leases intentionally allow matching seek reuse.
- Chrome can expose audio.ended before dispatching its ended event. The real-source harness records
  that flag before cleanup pause/load, so cleanup does not cancel evidence of a completed take.
- Simulations use full queue drain for word accounting; they do not prove semantic/listening quality.
- Seeks/change-video abandon the old queue; same-position ads preserve it. Translation producers
  still own navigation guards and must expose pending groups for ordering to be enforceable.
- Reload at chrome://extensions and refresh video tabs; never remove/reinstall or overwrite settings.
