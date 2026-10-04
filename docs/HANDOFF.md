# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-05 · `2.4.7` batch review of 6 new videos (64 min): a slid run is realigned, seeks fade.

## What changed
- `CST_QUALITY.realignSentences` (vi-quality.js): a run of answers slid by one item (a 20 s item with
  three speaker turns, rtAi3qa8UtQ 841 s) gets its sentences dealt back by a DP on length + kept words.
  45 saved videos: 2 runs moved, 0 of 10 lookalikes. Runs in `localFixes`, `trimTranslationLeaks`,
  `ytTrimLeaks` (6 groups around the window; whole video on cache load). `docs/SUBTITLE.md` 2.4.7.
- `englishLeftovers`: inner capital = brand (iPad, eGFR); 29 substances/foods in `LOANWORDS`.
- `releaseAudio(r, true, after)`: a seek, an ad, dubbing off fade the sounding voice (`quietPause(el,
  then)`). Sim: loud cuts 18 -> 0, delivery unchanged; 45 videos unchanged (`docs/DUBBING.md`).
- `batch-review.js` now judges the mended text (`realGroups`); the sim runs the stop fade.
- `REVIEW_MARK` moved to 45 videos; batch archived in `review-archive/2026-10-05-videos-40-45`.

## State
- Tests: 643 pass, 0 fail, 1 skip. Reload: **yes** for 2.4.7 (`chrome://extensions`), then F5 the tab.
- Batch after the fixes: omission 0, untranslated 0, refine 0, dropped 0, words lost 0; leftover 3
  (a quoted label "NSF certified for sport", "deli", "model G1"), all right as kept.
- **The user's view (2026-10-01):** new videos only; every fix is a rule for all future videos
  (false hits measured on all saved videos), no "small pinch" left; name what cannot be fixed, with
  numbers. On a sound report dig yourself (`docs/TESTING.md` "Live measurement"), never ask them.
- By design: lines > 0.5 s late are fast talkers (87 of 548 this batch); condensing is forbidden.
- `pickRefined` / the `misaligned` refine are still not seen against live Gemini.

## Unfinished / in progress
- 2.4.6 and 2.4.7 not heard by the user yet; if pops remain, read media-internals `seek_target` rows.
- Not seen in a real browser: the Settings counter and button, a 3-hour video's performance, the
  `ytTrimLeaks` realign on a live window (covered by a static test and the cache-path sim only).
- Carried: voice items for the user's ear ("có nghĩa là", DN, NHNN). Never ask about Apple Events JS.

## Traps hit this session
- `tests/hardening.test.js` "a dropped request the server has started finishes" failed once under a
  full `npm test` and passes alone (timing): rerun before chasing it.
- The sim did not advance the clock after `stop()`, so stop-time fades never finished: now 100 ms.

## Suggested next step
- Next batch: `node tools/ext-storage.js --prefix=ytcache4_ --out=<dir>`, then
  `node tools/batch-review.js <dir> --since=1791127534084 --sim`, read `--show=omission,leftover`.
