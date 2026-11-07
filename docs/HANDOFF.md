# Handoff (2026-11-07, lane A with D worker/cache prompt, tests/tools and release integration)

## Current state
- Release 3.2.2 adds local context/scoped terminology in context-engine.js, content.js, background.js.
- Local domain uses target text plus two neighbours each side, never the title as a forced sense.
  High/medium/low is keyword evidence; ties, weak targets and unsupported text abstain.
- Mixed windows carry numbered domains/sense hints. Names retained verbatim can have entity scope;
  ordinary learned terms cannot cross scopes. One-speaker selfRef persists through topic changes.
- Learned terms require source/output presence. Two distinct excerpts support agreed usage; retries
  do not add votes, conflicting forms stay advisory, refined output removes stale term/pronoun votes.
- ctxterms tuples add scope/provenance/bounded excerpts. Legacy entries are not trusted by counts.
  No purge, glossary expansion, full-video cache invalidation or new model action was added.
- Known SENSES ambiguity is deferred in builtin protection; user choices win. Only affected window
  keys include deferred matches; mixed domains join keys in order. Learned hints remain outside keys.
- Term output retains five-entry/one-in-three-window bounds, now scoped to current subject.
- docs/measurements/local-context-2026-11-07.json records corpus hashes, controls and limits.
- npm test: 1,187 pass, zero fail, two skips; 20 new context/provenance/cache cases.
- Chrome API probe passed; regression baseline 45 videos + 24 scenarios saved for 3.2.2.
- Previous 3.2.1 source integrity is not audio accuracy; legacy src is not actual fallback identity.
  New sourceTrack keeps actual language/kind. Automatic ASR remains off; no new paid evaluation.

## Unfinished
- Fresh ASR accuracy, CPU/latency/cost and full-video semantic truth remain unmeasured.
- Complex clause completeness, causality, conditions, arbitrary names and pronouns remain unverified;
  consistent term usage and refinement checklists are not independent semantic correctness labels.
- Natural local domains/senses have no human annotation; keyword evidence remains English-oriented.
  Current corpus measurements do not establish real-provider translation improvement or billed cost.
- Source/audio mismatch needs an independent reference; a structurally clean track may disagree.
  The saved Russian-source discrepancy remains unresolved (one prior ASR excerpt conflict).
- Multi-speaker attribution, glossary loading/UI states and full-video/source-meaning listening remain.
- Documentary 9T1Nvtn3QOk: earlier inspection only 39-43 minutes, no complete ytcache4 record.
- Carry forward native fullscreen, real-page overlay fade, sparse notice on iYL-UuNE_9w,
  TED embed/hold issues, Mac auto-update install and old UI redesign-note reconciliation.

## Traps
- Import before setUnits is normal. Do not discard imported term evidence when setting new units.
- Evidence counts are usage consistency, not votes for truth. Do not promote old tuples by counts.
- Refinement replaces a unit: counting both drafts inflated selfRef and terminology confidence.
- The same term in multiple item scopes must not enter one flat forced glossary hint.
- Deferred protection must join normal AND legacy window keys to avoid reviving old fixed meanings.
- Whole saved-video translations stay intact; new policy applies when translation is requested.
- Exact-source entity scope does not validate translated names or distinguish multiple speakers.
- Source structure and track disagreement still do not establish which text matches speech.
- Complete FIFO speech, speed caps, continuous playback and the auto model default are unchanged.
- Reload at chrome://extensions and refresh video tabs; never remove/reinstall or overwrite settings.
