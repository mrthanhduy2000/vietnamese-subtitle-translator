# Handoff (2026-10-23, 3.0.2 + unreleased)

## Site adapters thread (TED)
- `site-adapters.js` + `site-ted.js` (docs/changes/site-adapters-ted.md). Offline tests pass. TRY ON CHROME:
  open a ted.com/talks page, click Translate in the popup. Unknown until then: whether the
  `fetch` to hls.ted.com from the content script passes CORS (if not, route through background.js and add
  the host permission) and whether `__NEXT_DATA__` still carries `playerData.resources.hls.stream`.
- Udemy, edX, Vimeo embeds still open (BACKLOG 9).

## State
- Unreleased (lane B, BACKLOG 48, `docs/changes/loose-line-pauses.md`, DUBBING.md "Loose lines hand
  spare time"): a line that would end 1 s+ early at its floor pace asks for longer punctuation pauses
  (`looseSlack`, `pauseSlack`, `shapePauses opts.slack`, key `slack<step>`). 101 videos: silences
  >= 1.5 s while the source talks 1,439 -> 1,260, late > 0.5 s 1,603 -> 1,580. Not heard by ear.
- unreleased (lane A, loose brand match): inner-capital brands match in lower case, minus 49 English-word
  collisions (`docs/changes/loose-brand-match.md`). Regenerate the skip list after big glossary releases.
- unreleased (lane A/D, glossary protection): the window cache key no longer holds protected terms or codes
  (`SUBTITLE.md` "Protected glossary terms and the window cache"); matcher buckets warm up in idle slices
  (first `protectGlossary` 50-80 ms -> ~2 ms). `tests/glossary-cache.test.js`. `regress.js` not run.
  Lowercase-brand gap, not loosened: `BACKLOG.md`.
- 3.0.2 (glossary, cloud): `tools/glossary-filter.py <first-line> --names=<nltk names> --write` dropped ~660
  everyday words and history names that hid Vietnamese renderings from the 2.9.2 and 2.9.5 batches
  (~2,300 false hits gone on 3.2M words). Run it on every new batch before merging. 14 VieNeu names
  (Temodar, Nissan Teana, Ram 1500...) still need `MANUAL_SAY` + `glossary-pron.js --write` on the Mac.
- 3.0.1 (lane A/C, notices): `CST_UI.explainError` (content.js) maps a raw failure to one Vietnamese
  sentence plus an optional action button (reload / open Settings); Coursera "Dịch thất bại" and
  YouTube "Không dịch được" use it (YouTube auto mode still only logs). Progress "Đang dịch x/y đoạn"
  now shows in the popup and both on-player menus. Toasts replace each other, so no stacking.
  Not done: dubbing.js toasts and VieNeu messages were not reworded; "Thread Rà lỗi tiềm ẩn" owns error handling.
- 3.0.0 (lane A/C): `CST_STYLE.legibilityIssue` + `#legibilityHint` in Settings preview warns on same-colour
  box or no box and no outline. Warning only. Not seen live.
- 2.9.9 (lane A, overlay UX): `CST_STYLE.overlayFontPx` (12 px floor, one size formula for YouTube and
  Coursera), `overlayTransition` (honours prefers-reduced-motion; Coursera now animates `top` too).
  Not seen on a live page; click Reload and check a narrow/mini player.
- 2.9.8 (UI contrast) and 2.9.7 (`stripAddedFormatting`, `sanitizeModelOutput`): see git log.
- 2.9.5 (lane B/D, glossary): +34,700 names from 50 topic drafts (`scratchpad/cands3`), 73,270
  candidates in total, mostly unverified. About 181 still read Vietnamese by VieNeu. Spot-check short
  source files: esports 86 lines, fitness 125, board games 352, supplements 515.
- 2.9.4 (other session, lane A, content.js): Coursera and generic pages keep each translated lecture
  whole (`cscache1_<host><path>`, index `cscacheIdx`, newest 200). Google-fallback windows are healed
  like YouTube (`csHealFallbacks`). `SUBTITLE.md` item 11.
- 2.9.3 (other session, youtube.js): `ytFindUsableTrack` walks up to 4 other tracks when the first is
  blank or a broken ASR. The 2 bn vlogs stay untranslatable.
- Bare "4K"/"8K" stay Vietnamese on purpose (in Vietnamese they are money). "401k" stays English.
- 2.9.4 (glossary) and 2.9.5 were done in a cloud session: `regress.js` NOT run here.

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
