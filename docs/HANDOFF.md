# Handoff (2026-10-22, 2.7.1)

## State
- Rule zero (CLAUDE.md): every fix is for the whole system; report by defect class with counts
  over all saved videos (`ext-storage.js --prefix=ytcache4_` + `review-archive/`, ~80 now).
- Today: 2.6.9 `chainLead` 0.3 (voice ahead of speaker 1371 -> 0); 2.7.0 `rateStepUpOverrun` 0.2
  (late > 0.5 s 1657 -> 1419); 2.7.1 `lingerCues` closes blanks < 0.15 s (blinks 678 -> 0 on 73
  videos) and the glossary refuses always-capitalized everyday words kept as written (the series
  "Wednesday" made "vào thứ Tư Wednesday", 8 in 2 videos; the entry is gone).
- Measured and not worth a rule: reading speed (94% of line changes are back to back, so speed is
  the speaker's); weak line breaks (~0.6%); English left in (long tail of names); late answers
  (2 in ~3,556 calls).
- `npm test` 735 pass, 0 fail, 1 skip.

## Unfinished (in order)
- A driver run is going (`yt-driver.html`, 14 ids; 5 saved so far: PO_Vw_j1OZY 7lECIsRif10
  zNG2a11mBrw VekkmCvdr7c tG1t7WiBKac). Reloading the extension closes it; its `ytDriverDub`
  key puts dubbing back when the page is opened again.
- `git stash list`: "wip: unpunctuated-source prompt hint". `context-engine.js isUnpunctuated`
  (whole talk < 2 sentence marks per 100 words: 18 of 58 saved videos, all others >= 3.9) sets
  `context.unpunctuated`; `background.js ASR_SOURCE_PROMPT` asks for sentence ends by meaning and
  spoken headings as headings; in the cache key only when set; test in context-package.test.js.
  Found on PO_Vw_j1OZY: "I don't really care the 90 rule" -> "Tôi không quan tâm đến quy tắc 90".
  To judge: pop it, Reload the extension (driver done first), open
  `tests/harness/tr-lab.html?ids=PO_Vw_j1OZY,bK44CfpP2DM,zNG2a11mBrw,VekkmCvdr7c,x7YDov3zlYA,dEjhCEUEtx8&max=6&tag=asr1`,
  read `trLab_asr1`, count sentence-join and heading errors in a vs b. Ship only if b is better
  (TR_PROMPT_VERSION stays; the key changes only for flagged requests).
- Not heard: 2.6.9-2.7.1 by ear after Reload + F5.
- Carried over: prompt 3 and the >> split on a real reading (BACKLOG 44, ~0.05 USD); 2.6.5-2.6.8
  not checked live; `screen-text.js` never ran; share repo promotion of 2.5.7-2.7.1 after a green
  install test; BACKLOG 43-47; 2.5.7 shortcuts on YouTube; joint-takes branches; 2.5.0 Coursera
  start hold; CI gaps; voice items "có nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo.
- Never ask the user about Chrome's Apple Events setting.

## Traps
- `yt-driver.html`: the element must stay unmuted (tab muted): a muted video in a covered window
  ran ~1x and long videos logged "NOT SAVED". Fixed in the harness 2026-10-22.
- Live probe without opening a tab: `list_tabs` + `execute_javascript`; quick menu "Đã dịch N/M".
- Scratch sim scripts: wrap `DubEngine` to read `stats.started`; `SYNC` is exported for overrides.
