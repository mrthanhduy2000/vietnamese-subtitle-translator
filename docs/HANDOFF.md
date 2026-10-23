# Handoff (2026-10-23, 3.0.2)

## Perf thread (2.9.9)
- `glossary-extra.js` merge no longer quadratic; `loadGlossary` drops a 90k-entry Set. Bench:
  `node --expose-gc tools/bench-startup.js 7` (merge 159 -> 86 ms, loadGlossary 115 -> 95 ms, offline,
  Linux). Output digest identical. Left alone: first `protectGlossary` ~70 ms (lazy bucket compile,
  term-matching thread). Not measured: storage size, duplicate network calls, CPU during playback (Mac).
- Test-only change after 2.9.4 (no bump): GitHub Actions `test.yml`, `tests/units.test.js`, `npm run coverage`.

## Site adapters thread (TED)
- `site-adapters.js` + `site-ted.js` (docs/changes/site-adapters-ted.md). Offline tests pass. TRY ON CHROME:
  open a ted.com/talks page, click Translate in the popup. Unknown until then: whether the
  `fetch` to hls.ted.com from the content script passes CORS (if not, route through background.js and add
  the host permission) and whether `__NEXT_DATA__` still carries `playerData.resources.hls.stream`.
- Udemy, edX, Vimeo embeds still open (BACKLOG 9).

## State
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
- A name the writer cannot respell gets no reading: check `GLOSSARY_SAY` after `--write`. Merge keeps
  an old entry for any term still in the list, so remove a bad line from the generated block first.
- `$TMPDIR/fix.py` removes by core term in every block of `glossary-data.js`: check the removed count.
- New glossary blocks let everyday words in (list in `tests/glossary.test.js`). A capitalised English
  word ("Wired") needs the `~` prefix.
- Write `glossary-data.js` with Bash `cat >>`, never Read/Write.
- `pageEnv` (audit.test.js) objects come from another vm realm: spread into a local array before
  `deepEqual`.
- Driver pages: open `yt-driver.html` in its own window; reloading the extension kills a run.
- `seekWhileSlow` gives 15/7 or 16/6; timing tests fail during a driver batch: rerun first.

## Unfinished
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
  shortcuts on YouTube; joint-takes branches; 2.5.0 Coursera start hold; coverage gaps in TESTING.md (youtube.js, content.js, dubbing.js are lowest); voice items "có
  nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo. Never ask about Chrome's Apple Events setting.
