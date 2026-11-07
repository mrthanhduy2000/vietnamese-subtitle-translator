# Handoff (2026-11-07, lane A with D worker prompt, tests/tools and release integration)

## Current state
- Release 3.2.0 adds conservation evidence in vi-quality.js and shared content.js assessment.
- factualAnchors/assessPreservation compare supported numeric/unit/date/code facts, with explicit
  abstention for word numbers, ambiguous formats/conversions, shared ranges and fractions.
- Narrow negative predicates and numerical comparison inversions use local clause evidence.
  assessWindow adds reciprocal adjacent fact ownership to existing alignment heuristics.
- Five dimensions are exposed; no detected issue means unchecked, never a semantic pass.
  Complex causal/conditional/clause review requirements do not independently trigger paid calls.
- pickRefined vetoes new critical errors before fluency scoring. Existing bad facts require a
  positively matching replacement check; unparseable evidence cannot silently count as a repair.
  Alignment changes stay atomic; wrong cardinality and new shifted windows are rejected.
- The same one-refinement request prioritizes conservation issues and asks Gemini to recheck all
  content relations. No new API/model action, default model, budget policy or cache migration.
- Cached text gets local quality metadata without paid refinement. Accepted mixtures are reassessed.
- npm test: 1,140 total, 1,138 pass, 0 fail, 2 conditional skips. 53 new challenge/integration tests.
- 145 videos / 17,157 groups: three literal source/translation discrepancies, locally inspected;
  source truth is unverified. Potential refine flags 45 -> 48, not new measured API requests.
- Controlled injected challenges on all 145 contexts: 2,610 corruptions, 2,599 caught, 11 missed;
  2,610 correct controls, zero false flags. Misses are conservative ambiguous negation cases.
- Natural semantic recall is unknown. The eighteen reused templates are not independent blind data.
- Regression: 45 videos + 24 scenarios, zero changed/worse metrics; baseline saved for 3.2.0.
- Real Chrome verifies factual veto, equivalent units, atomic alignment and unchecked semantic status.
- docs/measurements/translation-preservation-2026-11-07.json stores methods, counts and limitations.

## Unfinished
- Complex clause completeness, causality, conditions, arbitrary names and pronouns are not locally
  verified; the refine checklist is not a measured live-Gemini judge verdict. No paid eval was run.
- Source-caption/content mismatch remains separate: Russian source/caption discrepancy flagged
  by independent ASR. Conservation compares supplied text; it does not repair bad captions.
- Speaker attribution, glossary loading/UI states and full-video/source-meaning listening remain.
- Documentary 9T1Nvtn3QOk: earlier inspection only 39-43 minutes, no complete ytcache4 record.
- Carry forward native fullscreen, real-page overlay fade, sparse notice on iYL-UuNE_9w,
  TED embed/hold issues, Mac auto-update install and old UI redesign-note reconciliation.

## Traps
- Preserve uncertainty: equality of some anchors does not prove whole-sentence meaning.
- Negation/comparison evidence must be local; unrelated earlier negatives or comparisons mislead.
- “ngâm 20” is not “âm 20”; regex boundaries around Vietnamese words must be Unicode-aware.
- Digits in fraction denominators, phone formatting, shorthand ranges and half-hours are not
  independent facts. Avoid paying for format differences or forcing a suspect ASR fact into text.
- The older multi-sentence pacing/session contracts are unchanged; retain full FIFO speech and caps.
- Reload at chrome://extensions and refresh video tabs; never remove/reinstall or overwrite settings.
