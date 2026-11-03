# Handoff (2026-11-03, lane D real-source validation)

## Current state
- Runtime remains 3.1.6. This follow-up replaces invented sentences as primary listening evidence
  with three downloaded original-language YouTube clips and their saved Vietnamese translations.
- Sources/intervals: 6QULfp2wdZI 465-515 s, JBvcMfa7K6E 90-140 s, yZfhCQwCWT4 120-170 s.
  Each original is exactly 50.000 s after decoding the full track and sample-exact cropping.
- tests/harness/real-onset-prep.js renders actual plans through the local worker/VieNeu,
  Kim Thanh: 28 takes. real-onset.html compares 3.1.5/3.1.6 using identical WAVs and verifies plans.
- All six real-Chrome runs: 56/56 planned takes heard and ended, zero drops/errors/overlap.
  Max acoustic lag old/new: Russian 4.997/4.988 s; commentary 0.250/0.247 s;
  dense conversation 4.289/4.287 s. Differences do not demonstrate perceptible improvement.
- Fresh original-language captions and local Whisper base recognition cross-check the source.
  Russian audio discusses card benefits while its current manual captions mix unrelated subjects.
  This flags source-content mismatch; ASR is not human-verified ground truth.
- docs/REAL_VIDEO_ONSET.md records methods/limits; docs/measurements/real-onset-2026-11-03.json
  retains numeric results and source/take hashes. No copyrighted source media is committed.
- Local originals, captions, ASR, fixtures and six mixed recordings live under ignored
  tests/harness/smooth/real-video/. The listening page is served by live-server.js on port 8768.
- npm test: 1039 total, 1037 pass, zero fail, two conditional skips.
  Root runtime is unchanged, so no version bump or new runtime regression baseline was needed.
- Prior 145-video simulation / 45-video+24-scenario regression remain the 3.1.6 evidence;
  do not substitute those or the old four synthetic sentences for real-source listening evidence.

## Unfinished
- Asked user to choose the dense-speech tradeoff: short video waits for complete natural speech,
  or continuous video with lag. No new pause policy implemented without that product preference.
- Dense speech still lags ~4.3 s with prepared audio. Full-corpus baseline/current hard-lag drop
  remains one case / 16 words at 10.19 s. Source-content mismatch is a separate defect class.
- Speaker attribution, glossary loading/UI states; full live-page/source-meaning alignment and
  subjective listening across full videos remain open. No claim of a completed listening fix.
- Documentary 9T1Nvtn3QOk: earlier inspection only 39-43 minutes, no complete ytcache4 record.
- Carry forward native fullscreen, real-page overlay fade, sparse notice on iYL-UuNE_9w,
  TED embed/hold issues, Mac auto-update install and reconciliation of old UI redesign notes.

## Traps
- Compare identical prepared takes; never regenerate speech independently for A/B.
- Multi-audio sources can select another dubbed language. Pin captions to downloaded audio language.
- Partial stream-copy cuts can include preroll; decode full source then crop exactly.
- Acoustic lag is measured against caption plans, not verified source-phoneme/meaning alignment.
- Reload at chrome://extensions after runtime changes; never remove/reinstall. No reload needed here.
