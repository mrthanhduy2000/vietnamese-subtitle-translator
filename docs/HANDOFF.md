# Handoff (2026-10-23, 2.7.7)

## State
- Rule zero (CLAUDE.md): every fix is for the whole system; report by defect class with counts
  over all saved videos (`ext-storage.js --prefix=ytcache4_` + `review-archive/`, 100 kept).
- 2.7.4: a model resting after its timeout hands over to the next model; `ytFallbackToHeal` asks
  Gemini again for Google-fallback groups (seen saving 2 videos live); `selfRef` [XƯNG HÔ] and
  `register: "talk"` [VĂN PHONG] (A/B `self1` mixing 28 -> 6, `reg1` blind 30 vs 2); `SUBSTANCE`
  names are no English leftover (refine flags 29 -> 22).
- 2.7.5: a bare "foreign" + notes line is "[Tiếng nước ngoài]" (`BARE_FOREIGN`); confirmed live on
  nzAmF9brAW0 (saved, no fallback).
- 2.7.6: `keepMadeTakes` in `refresh`: a rebuild that only cuts a line with a made (or pending)
  take elsewhere keeps it. Sim on 100 videos: dropped 2 -> 0, words lost 23 -> 0 (both were the
  video's first line). Regress baseline saved (spoken -1 on 2 videos = one take, not two parts).
- 2.7.7: `readUnitAnswer` keeps the source of an empty item of <= 3 words (`EMPTY_KEEP_WORDS`) when
  at most a quarter of the window is empty; found on vvFnjnVwhAE (street interview, names alone).
- `yt-driver.js`: duration read again after `drive` starts (first window after a reload logged
  "0 s of video, NOT SAVED").
- `npm test` 749 pass, 0 fail; regress 0 moved after the save.

## Unfinished
- Chrome still runs 2.7.5: a 16-video driver run was going (O_MQr4lHm0c ... iN2CkqVc0Rs). After it:
  reload (`tests/harness/reload.html`), rerun O_MQr4lHm0c and vvFnjnVwhAE, review the new ids
  (`batch-review.js --since`), read `cstFallbackLog` / `ytSaveSkip`.
- Not heard: 2.6.9-2.7.7 by ear. tôi/mình mixing left only before 4 uses settle it (video start).
- Uploaded Vietnamese tracks (shown as is, never saved by design, driver logs "NOT SAVED"):
  jFZksJqL1Vc, XnQ7Py8D6v0, MebK9iEUzQA, JwBuHx_3GOU, rm_9cPXrv4A, gN07gbipMoY, nBN9zG1JNPg.
- Coursera has no fallback heal (its unit cache keeps no fallback, a revisit asks again).
- Carried over: prompt 3 and the >> split on a real reading (BACKLOG 44); 2.6.5-2.6.8 not checked
  live; `screen-text.js` never ran; share repo promotion of 2.5.7-2.7.7 after a green install
  test; BACKLOG 43-47; 2.5.7 shortcuts on YouTube; joint-takes branches; 2.5.0 Coursera start hold;
  CI gaps; voice items "có nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo.
- Never ask the user about Chrome's Apple Events setting.

## Traps
- Reloading the extension closes every extension page: a driver run in progress dies with it.
- `playback-sim.js` `run(..., { keepStarted: true })` returns every start; hook
  `DubEngine.prototype.note` for drop reasons. An old engine must sit in the repo dir to load.
- Scenario `seekWhileSlow` gives 15/7 or 16/6 run to run: not a regression signal.
- The words "speak"/"signature" may not appear in `unitCacheKey` (speech-context test).
- New YouTube ids: `curl` the results page (node fetch ignores the proxy), parse `ytInitialData`.
