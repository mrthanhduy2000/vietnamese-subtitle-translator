# Handoff (2026-10-23, 3.0.2 + unreleased)

## State
- Unreleased (lane B, BACKLOG 48, `docs/changes/loose-line-pauses.md`, DUBBING.md "Loose lines hand
  spare time"): a line that would end 1 s+ early at its floor pace asks for longer punctuation pauses
  (`looseSlack`, `pauseSlack`, `shapePauses opts.slack`, key `slack<step>`). 101 videos: silences
  >= 1.5 s while the source talks 1,439 -> 1,260, late > 0.5 s 1,603 -> 1,580. Not heard by ear.
- Unreleased (lane A/D): window cache key without protected terms; matcher buckets warm in idle slices
  (`SUBTITLE.md` "Protected glossary terms and the window cache"). Other PRs: `docs/changes/`.
- 3.0.2: `tools/glossary-filter.py <first-line> --names=<nltk names> --write` on every new glossary
  batch. 3.0.1: `CST_UI.explainError` notices; 3.0.0: Settings legibility hint; 2.9.9: overlay font
  floor 12 px; 2.9.8/2.9.7: contrast, `stripAddedFormatting`; 2.9.5: +34,700 unverified names;
  2.9.4: Coursera keeps lectures whole (`cscache1_`); 2.9.3: `ytFindUsableTrack`. See git log.
- Bare "4K"/"8K" stay Vietnamese on purpose (money). "401k" stays English.

## Traps
- `regress.js` has no SYNC override: for an off/on diff, set the value off in a scratch worktree,
  `--save` there (its own copy of `review-archive/`), restore, rerun. Never `--save` main's copy from a branch.
- A synthetic lecture repeats its sentences: a key that depends on the measured pace re-renders the
  repeat. Memoise such a decision by words, not by start (`looseSlack`).
- A plan object re-made by a refresh has `slackPauses`/`tightPauses` unset until it re-enters the
  window: the simulator asks `eng.looseSlack` for the key it was made under.
- VieNeu at 127.0.0.1:8000 is unreachable from the sandbox: hand the user a command that writes files.
- A name the writer cannot respell gets no reading: check `GLOSSARY_SAY` after `--write`.
- Write `glossary-data.js` with Bash `cat >>`, never Read/Write. A capitalised English word needs `~`.
- `pageEnv` (audit.test.js) objects come from another vm realm: spread before `deepEqual`.
- Driver pages: `yt-driver.html` in its own window; reloading the extension kills a run.
- `seekWhileSlow` gives 15/7 or 16/6; timing tests fail during a driver batch: rerun first.

## Unfinished
- BACKLOG 48: render the A/B takes (`node /private/tmp/claude-501/b48ab/render.js` on the Mac), shape
  them (`$TMPDIR/b48shape.js`), listen. After merge, `node tools/regress.js --save` on main.
- On the Mac: `regress.js` for 2.9.3 to 3.0.2; try a Coursera lecture twice; 14 VieNeu names
  (Temodar, Nissan Teana, Ram 1500...) need `MANUAL_SAY` + `glossary-pron.js --write`.
- Spot-check drafted names (esports, fitness, board games, supplements), ~181 residual Vietnamese readings.
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
