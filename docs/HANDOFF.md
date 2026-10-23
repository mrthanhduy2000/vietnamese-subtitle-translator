# Handoff (2026-10-23, performance thread)

## State
- Startup perf (lane D/A): `glossary-extra.js` merge was quadratic (`RISKY.includes` per line, the
  per-group `have` Set rebuilt for every block). Now sets are kept across blocks. `loadGlossary`
  in `content.js` no longer builds a second 90,000-entry Set for `glossaryMultiTerms`.
- Measured with `node --expose-gc tools/bench-startup.js` (medians of 7, offline, 87,000 terms):
  glossary-data.js run 159 ms -> 86 ms, loadGlossary 115 ms -> 95 ms, heap after load 12 MB.
  Output is byte-identical: sha256 over `CST_GLOSSARY_GROUPS`, `CST_RISKY_PROPER` and the merge report.
- Still on the table: first `protectGlossary` call ~70 ms (lazy bucket regex compile in
  `buildMasterRegex`; term matching belongs to the term-protection thread, not touched);
  `buildMasterRegex` bucketing at load ~40 ms.

## Traps
- Numbers are from a Linux cloud container, not Chrome on the Mac: compare before/after only.
- `bench-startup.js` shares a stubbed sandbox with `tests/audit.test.js` `pageEnv`; keep them alike.

## Unfinished
- Not measured: storage size, duplicate network calls, CPU while a video plays (needs the Mac).
- On the Mac: `node tools/regress.js` (then `--save`) for 2.9.3 to 2.9.5; try a Coursera lecture twice.
- Spot-check the drafted names (esports, fitness, board games, supplements) and fix the ~181 residual
  Vietnamese readings via `MANUAL_SAY`. Not yet 100,000 terms.
- Saved Coursera lectures are not in `tools/review.js` (reads `ytcache4_` only).
- Not heard: 2.6.9-2.8.9 by ear (tôi/mình mixing at video start).
- Uploaded Vietnamese tracks never saved by design (driver logs "NOT SAVED"): jFZksJqL1Vc XnQ7Py8D6v0
  MebK9iEUzQA JwBuHx_3GOU rm_9cPXrv4A gN07gbipMoY nBN9zG1JNPg O_MQr4lHm0c c347oYQO57A PweksFQGzmI
  Bwe7zLSPtXA h0I4083Bm9s dGCdYtk9fHQ nDg7NumntYc E8UKIJ2rLjg RCPS2VC3lk4 MmQp4PkvXV4 w7kz2lI1IMw.
- Carried over: prompt 3 and the >> split (BACKLOG 44); 2.6.5-2.6.8 not checked live; `screen-text.js`
  never ran; share repo promotion of 2.5.7-2.8.8 after a green install test; BACKLOG 43-47; 2.5.7
  shortcuts on YouTube; joint-takes branches; 2.5.0 Coursera start hold; voice items "có
  nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo. Never ask about Chrome's Apple Events setting.
