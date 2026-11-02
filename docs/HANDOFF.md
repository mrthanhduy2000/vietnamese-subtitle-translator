# Handoff (2026-11-02, lanes A/D with progress persistence)

## Current state
- Release 3.1.5: retain valid Gemini lines when aligned answers contain empty items;
  after the existing model chain, Google repairs only missing positions. No added paid retry.
- background.js returns fallbackIndexes; wrong-count answers never use positional salvage.
  content.js conservatively marks mixed windows pending after cross-item repairs.
- YouTube and Coursera/generic tracks checkpoint stable translations after completed windows.
  Revisit restores matching source/timing/grouping/glossary scope (plus YouTube track).
  Only missing groups are requested. This does not save the playback timestamp.
- Worker videoProgress queue merges complementary snapshots across tabs. Separate progress keys
  are bounded to 20 videos, 16 MiB estimated total, 2 MiB each and 30 days; cache clear includes them.
  A successful complete-video save removes the checkpoint; fallback lines remain pending.
- npm test: 1035 total, 1033 pass, 0 fail, 2 conditional skips. Ten new focused tests.
- Corpus: 145 unique archived/current Chrome videos, 17,306 groups, 2,229 windows.
  Blank injection: 15,584 partial answers preserved, 1,722 existing local rules, zero good lines lost.
  All 145 checkpoint round-trips passed; 8,683 restored groups, zero source/track false accepts.
- Regression: 45 archived videos plus 24 scenarios; zero metric changes / zero worse.
- Offline VM tests use real runtime handlers and mocked browser/storage/network boundaries.
  No fresh paid Gemini calls or live-profile playback checks; no user Chrome data was modified.
- tools/progress-eval.js accepts read-only saved-video export directories for repeatable checks.

## Unfinished
- Remaining audit: measure late voice starts and speaker attribution; profile glossary and UI states.
- Historical bounded fallback log: 37 empty-result / 3 timeout entries, not a current failure rate.
  Most empty entries were malformed ASR or sound notes, not proof of a new model-wide regression.
- Documentary 9T1Nvtn3QOk had no complete ytcache4 record; earlier inspection covered only
  rows near 39-43 minutes. Full documentary semantics/timing remain unverified.
- Earlier session left the video paused with transcript open; paid TTS was not enabled.
- Carry forward: native fullscreen, real-page overlay fade, sparse notice on iYL-UuNE_9w,
  TED embed/hold issues and Mac auto-update install. Reconcile old redesign notes with current UI.

## Traps
- Persist only stable lines; never promote Google fallback into a complete Gemini cache.
- Snapshot before navigation clears arrays. Keep checkpoint index mutations in the worker,
  not page Web Locks: different origins do not share those locks.
- Keep settingsPatch/delta-save and exact audio-cache accounting contracts from 3.1.4.
- Reload at chrome://extensions, then refresh open video tabs. Never remove/reinstall.
