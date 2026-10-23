# Fuzz tests and the defects they found (no version bump)

`tests/fuzz.test.js` feeds the parsers and cleaners empty, huge, emoji, RTL, CJK, control-character
and non-finite-time input from a seeded generator (offline, ~2 s). Defect classes found and fixed:

- **Non-finite times** reaching the screen: `segmentGroupSafe` fallback and `buildTimeline` returned
  `NaN`/`Infinity` cue times; `srtClock` wrote `NaN:NaN:NaN,NaN` into exported .srt files
  (`vi-segmenter.js`, `transcript.js`). The YouTube json3 reader now treats a non-numeric time as 0 and
  skips `null` events or segments instead of dropping the whole track into the XML fallback (`youtube.js`).
- **Cut hint (`¦`) beside punctuation** left an orphaned `,` token and the line read "word ," or
  "“ word" (`cleanText` in `vi-segmenter.js`).
- **`__init__`, `__proto__`** lost one underscore to the italic-markdown stripper (`cleanText`).
- **Numbers of 16+ digits** were read wrongly or as "một" (`numberToVietnamese`, `dub-planner.js`);
  they are now said digit by digit.
- **Control characters** (NUL, ESC...) could reach the voice server (`vieneuText`, `dub-speech.js`).
- **Quadratic regex**: the address pattern in `vi-quality.js` took 1.2 s on a 30,000-letter word and
  5 s on `a.a.a.` x 50,000; labels and label count are now bounded. A 100,000-letter word also made
  `new RegExp` throw in `assess`.
