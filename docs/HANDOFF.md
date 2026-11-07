# Handoff (2026-11-07, lane A with D worker prompt, tests/tools and release integration)

## Current state
- Release 3.2.1 adds source evidence in lang-detect.js, YouTube and Coursera/generic pipelines.
- assessSource reports structural integrity, not audio accuracy. Status is unverified, limited,
  suspect or unusable; audioVerified remains false. Labels/scripts alone never prove words wrong.
- Signals cover speech timing, reversed order, density, sparsity, long repeats and fragmentation;
  overlap/word timings/short cues/choruses are not automatically rejected. Sound-note timing is ignored.
- compareSources uses common time/language and lexical evidence. Conflict alone never switches.
- YouTube compares at most one same-language alternate for a healthy source (1,200 ms wait cap);
  damaged sources retain the four-alternate bound. Invalid alternates cannot downgrade a healthy one.
  Generic pages rank already-loaded alternatives and recheck after cue load. All awaits keep guards.
- Cache src is still first-choice identity. New sourceTrack stores the actual selected language/kind.
  Legacy records stay intact; missing provenance is unknown, never inferred from src after fallback.
- Source risk is shown in quick menus/tooltips and attached to shared quality metadata. Unusable
  input skips extra refinement; other statuses retain mode/budget rules. No new AI/model action.
- No automatic ASR or audio capture was enabled. Three saved ASR references are compared offline:
  one conflict over 9.01 s, two lexical corroborations over 44.40/46.24 s; none certifies source truth.
- 145 cached videos / 42,960 cues: 137 unverified, eight limited; all legacy provenance unknown.
- Injected structural tests: 145 each for invalid timing/density/reversed order, all detected;
  145 normalized valid controls, zero heavy warnings. These are authored, not natural error labels.
- npm test: 1,167 pass, zero fail, two skips; 29 new cases cover selection/provenance/attribution.
- Regression: 45 videos + 24 scenarios, zero changes/worse; baseline saved for 3.2.1.
- docs/measurements/source-reliability-2026-11-07.json stores input hashes, methods and limitations.

## Unfinished
- Automatic independent speech verification remains disabled. Fresh ASR accuracy, CPU/latency/cost
  and full-video semantic truth were not measured; lexical agreement is not a model-quality score.
- Complex clause completeness, causality, conditions, arbitrary names and pronouns remain unverified;
  the refinement checklist is not an independent semantic judge. No paid evaluation was run.
- Source/audio mismatch is observable when an independent reference is supplied; a structurally
  clean track can still disagree with speech. The saved Russian-source discrepancy remains unresolved.
- Speaker attribution, glossary loading/UI states and full-video/source-meaning listening remain.
- Documentary 9T1Nvtn3QOk: earlier inspection only 39-43 minutes, no complete ytcache4 record.
- Carry forward native fullscreen, real-page overlay fade, sparse notice on iYL-UuNE_9w,
  TED embed/hold issues, Mac auto-update install and old UI redesign-note reconciliation.

## Traps
- Legacy src can name an unusable first choice while cached cues came from a correct fallback.
- Same-script language detection (uk/ru, fa/ar) is not language identity; label mismatch is uncertain.
- Sound-note zero lengths and per-word/overlapping captions are legitimate formats.
- A corrupt alternate is not evidence against a healthy primary. Different languages, partial
  coverage and short references must abstain; never call source/translation disagreement ground truth.
- New source metadata does not alter full FIFO speech, speed caps or video playback policy.
- Reload at chrome://extensions and refresh video tabs; never remove/reinstall or overwrite settings.
