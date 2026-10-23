# Handoff (2026-10-23, 2.8.8)

## State
- Rule zero (CLAUDE.md): every fix is for the whole system; report by defect class with counts
  over all saved videos (`ext-storage.js --prefix=ytcache4_` + `review-archive/`, 100 kept).
- 2.7.4-2.8.4 (version-history.js has every measure): fallback heal, [XƯNG HÔ] / [VĂN PHONG],
  `keepMadeTakes`, `brokenTranscript`, bracket lines read, speech text for numbers, units, faces and
  symbols (passes over every saved line through VieNeu's normalizer, DUBBING.md). Confirmed live.
- 2.8.5: `rateMemory` 4 -> 1, a pause of 1 s frees the pace (DUBBING.md "A pause frees the pace"):
  rushed-then-silent lines 916 -> 687, late 751 -> 716, jumps 55 -> 46 on 100 videos. BACKLOG 48 left
  with the floor-read short lines only. `holdEarlyMax` tried and dropped (jumps 55 -> 418).
- 2.8.6: `saysI(text, lang)` (~30 languages) lets `[XƯNG HÔ]` reach non-English sources, `meta.lang`
  from the YouTube track; tr-lab `self2` (TESTING.md). A trailing ".." becomes "..." (sanitize).
- 2.8.7: playback-sim `wordsLost` fixed (text at the start, notes-only sources): only real loss left
  is 6QULfp2wdZI (broken ru track).
- 2.8.8: note words in 11 more languages + an empty bracketed-note item keeps its source (Persian
  "[موسیقی]" failed windows); a blank track (`cues.blank`) tries another, else is told, no retry.
- Multilingual batch 4 (20 ids, cs el fa he hu ro sv ta bn id it ms ur): 13 saved and reviewed, 2 bn
  blank-track videos found the class above; last 5 (id it ms ur) still running in the driver tab.
- Track choice checked, kept: 7 of 23 non-English saved videos use the spoken language's ASR over a
  human English track; those ASR read well, the one word-salad source (6QULfp2wdZI ru) is a manual track.
- `yt-driver` skips a video with an uploaded vi track up front (they were 5 of a 12 long-vlog batch).
- `npm test` 761 pass, 0 fail; regress saved at 2.8.5, 2.8.6 moved 0.

## Unfinished
- Not heard: 2.6.9-2.8.8 by ear. tôi/mình mixing left only before 4 uses settle it (video start).
- Uploaded Vietnamese tracks (shown as is, never saved by design, driver logs "NOT SAVED"):
  jFZksJqL1Vc XnQ7Py8D6v0 MebK9iEUzQA JwBuHx_3GOU rm_9cPXrv4A gN07gbipMoY nBN9zG1JNPg O_MQr4lHm0c
  c347oYQO57A PweksFQGzmI Bwe7zLSPtXA h0I4083Bm9s dGCdYtk9fHQ nDg7NumntYc E8UKIJ2rLjg RCPS2VC3lk4
  MmQp4PkvXV4.
- Coursera has no fallback heal (its unit cache keeps no fallback, a revisit asks again).
- Carried over: prompt 3 and the >> split on a real reading (BACKLOG 44); 2.6.5-2.6.8 not checked
  live; `screen-text.js` never ran; share repo promotion of 2.5.7-2.8.8 after a green install
  test; BACKLOG 43-47; 2.5.7 shortcuts on YouTube; joint-takes branches; 2.5.0 Coursera start hold;
  CI gaps; voice items "có nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo.
- Never ask the user about Chrome's Apple Events setting.

## Traps
- Open a driver page in a window of its own: one opened with `open_url` lands in the user's window
  and dies when they close it, leaving dubbing off (open `yt-driver.html` without ids to put it back).
- Reloading the extension closes every extension page: a driver run in progress dies with it.
- `playback-sim.js` `run(..., { keepStarted: true })` returns every start; hook
  `DubEngine.prototype.note` for drop reasons. An old engine must sit in the repo dir to load.
- Scenario `seekWhileSlow` gives 15/7 or 16/6 run to run; the two analysis timing tests fail while
  Chrome runs a driver batch: rerun before blaming a change.
- New YouTube ids: `curl` the results page (node fetch ignores the proxy), parse `ytInitialData`.
