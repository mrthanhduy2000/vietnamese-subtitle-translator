# Handoff (2026-10-22, 2.7.4)

## State
- Rule zero (CLAUDE.md): every fix is for the whole system; report by defect class with counts
  over all saved videos (`ext-storage.js --prefix=ytcache4_` + `review-archive/`, 100 now).
- 2.7.4, all measured on real runs (22-video driver batch, tr-lab A/B):
  - `translateUnitMiss`: a model resting after its own timeout (`modelCooldown`, error `resting`)
    hands the window to the next model, not Google (4 of 5 fallbacks of the earlier run).
  - `ytFallbackToHeal` / `YT_HEAL`: Google-fallback groups are asked of Gemini again (3 tries,
    20/40/60 s, never a group due within 15 s), then the video is saved. Seen live: gR_f-iwUGY4,
    tHJ0yZuA1GE each had a timeout fallback and were saved.
  - `selfRef` ([XƯNG HÔ]) and `register: "talk"` ([VĂN PHONG], general domain, no course) in
    `ContextSession.buildRequest`; both in the cache key only when present. A/B `self1`: tôi/mình
    mixing 28 -> 6 (all 6 legit). `reg1` blind: 30 vs 2 for talk. SUBTITLE.md, TESTING.md.
  - `vi-quality.js` `SUBSTANCE` + "X acid": substance names are no English left in (refine flags
    29 -> 22, untranslated 16 -> 9 over 100 videos, 0 false catches seen).
- Measured, no change: dub lateness is all carry-over at the rate cap (829 of 983 late lines after
  a line at >= 1.38); English pronunciation 1 of 1695 spans; the 10 omissions are pre-2.4.2 saves;
  a 1-word glossary echo rule would break "trở thành thành viên", "kỹ năng năng suất" (declined).
- Spend today ~0.62 USD of the user's 100.000 đ allowance. `npm test` 746 pass; regress 0 moved.

## Unfinished
- Not heard: 2.6.9-2.7.4 by ear. Register "talk" not yet seen on a fresh real run (lab only).
- jFZksJqL1Vc, XnQ7Py8D6v0, MebK9iEUzQA have uploaded Vietnamese tracks: shown as is, never
  saved by design; the driver logs them "NOT SAVED".
- Coursera has no fallback heal (its unit cache keeps no fallback, a revisit asks again).
- Carried over: prompt 3 and the >> split on a real reading (BACKLOG 44); 2.6.5-2.6.8 not checked
  live; `screen-text.js` never ran; share repo promotion of 2.5.7-2.7.4 after a green install
  test; BACKLOG 43-47; 2.5.7 shortcuts on YouTube; joint-takes branches; 2.5.0 Coursera start hold;
  CI gaps; voice items "có nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo.
- Never ask the user about Chrome's Apple Events setting.

## Traps
- Reloading the extension closes every extension page: a driver run in progress dies with it.
- `tools/playback-sim.js` `run(..., { keepStarted: true })` returns every line's start for a
  breakdown; the words "speak"/"signature" may not appear in `unitCacheKey` (speech-context test).
- A harness page added since the last load is blocked until a Reload (`tests/harness/reload.html`).
- YouTube search for new ids: `curl` the results page (node fetch ignores the proxy), parse
  `ytInitialData` videoRenderer (`sp=EgQQASgB` = with captions).
