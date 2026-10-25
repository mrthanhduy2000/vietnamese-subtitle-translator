# Handoff (2026-10-25, 3.0.8)

## State
- Lane D: Windows CI reliability and Actions minute savings; no runtime/version change.
- The original Windows failure (runs 39981846482 and 39987644390) was already fixed by
  ae53ddf, merged in #11: `tools/publish-share.js` compares `fs.realpathSync.native` paths.
- `tests/publish-paths.test.js` adds real Git fixtures for rebuilt output reached through
  directory aliases, spaces, Unicode and Windows 8.3 names. The last case skips off Windows
  or when short names are disabled. Existing full publish/CLI tests remain in share.test.js.
- `.github/workflows/test.yml`: Node 24 actions (`checkout@v7`, `setup-node@v7`), Node 22 tests,
  Ubuntu 24.04, cancellation of superseded checks, one Linux suite run with coverage.
  The summary reads the saved log; test failures survive `tee` via explicit Bash pipefail.
- Validation: Node 22.23.4 `npm test` passed (950 pass, 0 fail, 2 skip); coverage and workflow
  validation are recorded in the PR. No extension Reload is needed for these tooling changes.

## Traps
- Rerunning an old run still uses the old commit. Use the checks for the fixed revision.
- Windows 8.3 aliases (`RUNNER~1`) can differ from Git's long path under non-native realpath;
  falling back to rebuilt disk bytes hides changes from the published HEAD.
- Carried live checks: sparse-caption notice, TED captions/hold and embed layouts need real-browser
  checks (docs/changes/sparse-caption-notice.md, ted-hold-and-faster-captions.md,
  youtube-embed-fallbacks.md). Do not replace these with offline-test claims.

## Unfinished
- Intel voice works in CI with `onnxruntime<1.24` (rtf 1.5-1.8, 4-core runner). Hear it on a real Intel Mac
  before making it the default.
- On the Mac: `node tools/regress.js` (then `--save`) for 2.9.3 to 3.0.7; try a Coursera lecture twice; 14 VieNeu names
  (Temodar, Nissan Teana, Ram 1500...) need `MANUAL_SAY` + `glossary-pron.js --write`.
- Spot-check the drafted names (esports, fitness, board games, supplements) and fix the ~181 residual
  Vietnamese readings via `MANUAL_SAY`. Not yet 100,000 terms.
- BACKLOG 48: render the A/B takes (`node /private/tmp/claude-501/b48ab/render.js` on the Mac), shape
  them (`$TMPDIR/b48shape.js`), listen. After merge, `node tools/regress.js --save` on main.
- Saved Coursera lectures are not in `tools/review.js` (reads `ytcache4_` only).
- Not heard: 2.6.9-2.8.9 by ear (tôi/mình mixing at video start).
- Uploaded Vietnamese tracks never saved by design: jFZksJqL1Vc XnQ7Py8D6v0 MebK9iEUzQA JwBuHx_3GOU
  rm_9cPXrv4A gN07gbipMoY nBN9zG1JNPg O_MQr4lHm0c c347oYQO57A PweksFQGzmI Bwe7zLSPtXA h0I4083Bm9s
  dGCdYtk9fHQ nDg7NumntYc E8UKIJ2rLjg RCPS2VC3lk4 MmQp4PkvXV4 w7kz2lI1IMw.
- Carried over: BACKLOG 43-47 and 44 (prompt 3, >> split); 2.6.5-2.6.8 not checked live;
  `screen-text.js` never ran; share repo promotion after a green install test; 2.5.7 shortcuts on
  YouTube; joint-takes branches; 2.5.0 Coursera start hold; coverage gaps (youtube.js, content.js,
  dubbing.js lowest); voice items "có nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo.
  Never ask about Chrome's Apple Events setting.
