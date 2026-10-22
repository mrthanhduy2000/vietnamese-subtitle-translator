# Handoff (2026-10-23, 2.8.0)

## State
- Rule zero (CLAUDE.md): every fix is for the whole system; report by defect class with counts
  over all saved videos (`ext-storage.js --prefix=ytcache4_` + `review-archive/`, 100 kept).
- 2.7.4-2.7.9 (version-history.js has the measures): slow model hands over; fallback heal;
  [XƯNG HÔ] / [VĂN PHONG]; substance names; "foreign" as a note; `keepMadeTakes` (no first line
  dropped); short empty items keep their source; `fallbackDetail` in `cstFallbackLog`;
  `brokenTranscript` sends a junk machine track to the next best one. Each confirmed live.
- 2.8.0: speech text for fractions, mph, "15$", 4K near a screen word; a digit-led kept term no
  longer matches inside a number ("65g"). Checked on VieNeu's normalizer; 10 of 23,274 lines change.
- Speed ceiling swept, not changed (DUBBING.md): each line of lag bought back costs ~2 rushed lines.
- `npm test` 752 pass, 0 fail; regress 0 moved.

## Unfinished
- Multilingual batch of 19 running on 2.7.9 (ko ja zh es fr de pt hi ru it he): 9/9 saved so
  far. After it: reload to 2.8.0, review the non-English ids (source language left in, names).
- Not heard: 2.6.9-2.8.0 by ear. tôi/mình mixing left only before 4 uses settle it (video start).
- Uploaded Vietnamese tracks (shown as is, never saved by design, driver logs "NOT SAVED"):
  jFZksJqL1Vc XnQ7Py8D6v0 MebK9iEUzQA JwBuHx_3GOU rm_9cPXrv4A gN07gbipMoY nBN9zG1JNPg O_MQr4lHm0c
  c347oYQO57A.
- Coursera has no fallback heal (its unit cache keeps no fallback, a revisit asks again).
- Carried over: prompt 3 and the >> split on a real reading (BACKLOG 44); 2.6.5-2.6.8 not checked
  live; `screen-text.js` never ran; share repo promotion of 2.5.7-2.8.0 after a green install
  test; BACKLOG 43-47; 2.5.7 shortcuts on YouTube; joint-takes branches; 2.5.0 Coursera start hold;
  CI gaps; voice items "có nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo.
- Never ask the user about Chrome's Apple Events setting.

## Traps
- Reloading the extension closes every extension page: a driver run in progress dies with it.
- `playback-sim.js` `run(..., { keepStarted: true })` returns every start; hook
  `DubEngine.prototype.note` for drop reasons. An old engine must sit in the repo dir to load.
- Scenario `seekWhileSlow` gives 15/7 or 16/6 run to run; the two analysis timing tests fail while
  Chrome runs a driver batch: rerun before blaming a change.
- The words "speak"/"signature" may not appear in `unitCacheKey` (speech-context test).
- New YouTube ids: `curl` the results page (node fetch ignores the proxy), parse `ytInitialData`.
