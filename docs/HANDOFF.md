# Handoff (2026-10-22, 2.7.0)

## State
- Rule zero (CLAUDE.md): every fix is for the whole system; report by defect class with counts
  over all saved videos (`ext-storage.js --prefix=ytcache4_` + `review-archive/`, 72 now).
- 2.6.9: `SYNC.chainLead` 0.8 -> 0.3 (voice ahead of the speaker on chained parts: 1371 -> 0).
- 2.7.0: late starts split by cause on 70 videos: 1344 of 1657 follow a line at the rate ceiling
  (kept: no condensing, no slowing the video), 313 a line held below it by `rateStepUp`. A line
  that would overrun by > `overrunStepAt` 0.4 s may climb `rateStepUpOverrun` 0.2: late 1657 ->
  1419, rate pairs > 15% 5 -> 77 of ~5900 (new sentences only). DUBBING.md has the table.
  `regress.js` saved (late 1629 -> 1431, scenarios 78 -> 74, gaps +2).
- Translation flags over 72 videos are near 0 (refine 13, omission 10 of 9008 groups); English
  left in is a long tail of names and narrow terms (top word 9 times): not worth a rule.
- `npm test` 734 pass, 0 fail, 1 skip.

## Traps
- `yt-driver.html` needs its window VISIBLE. When the user works in another Chrome window the
  driver's tab is `document.hidden`, Chrome slows the muted video (~70 s of video in 3 min), the
  pass times out and the page logs "NOT SAVED". That is the harness, not a save defect. Do not
  steal focus while the user uses Chrome. Run 2026-10-22 (9 ids, lifestyle talk, all new):
  1QgC0xhSIF8 saved; ifY2yk88bSg not saved (hidden); the rest were still running.
- Per-video spend sits in `costLedger.videos` (today 0.033 USD, 67 calls, 2 late answers).
- Live tab probe without opening a tab: `Control_Chrome list_tabs` + `execute_javascript`; the
  quick menu's "Đã dịch N/M đoạn" is the translation progress (click `.cst-ytp-btn`, read, close).
- Scratch sim scripts (not kept): wrap `DubEngine` to read `stats.started`; `SYNC` is exported, so
  env overrides per run work; run several values in parallel (each 70-video pass ~2 min).

## Unfinished
- Not heard: 2.6.9 and 2.7.0 by ear after Reload + F5.
- The driver run: after it ends, `ext-storage.js --prefix=ytcache4_`, review the new ids with
  `batch-review.js`; rerun the unsaved ones (`yt-driver.html?ids=...`) while Chrome is idle.
- Carried over: prompt 3 and the >> split not measured on a real reading (BACKLOG 44, ~0.05 USD);
  2.6.5-2.6.8 not checked live; `screen-text.js` never ran; subtitle measure on more reviewed
  videos (`--dir`); "l a times" heard; glossary growth and quality; BACKLOG 43-47; 2.5.7 shortcuts
  on YouTube; share repo promotion of 2.5.7-2.7.0 after a green install test; joint-takes
  branches; 2.5.0 Coursera start hold; CI gaps; voice items "có nghĩa là", DN, NHNN;
  `ban-giao.md` lacks the share repo.
- Never ask the user about Chrome's Apple Events setting.
