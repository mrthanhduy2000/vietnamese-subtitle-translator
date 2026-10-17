# Handoff (2026-10-17, 2.5.9)

## State
- 2.5.9: the glossary went from ~1,700 to ~14,000 terms. `glossary-extra.js` (format + merge) and
  `glossary-data.js` (data, one `CST_GLOSSARY_EXTRA_ADD` block per domain, grep only) load right
  after `glossary.js` (manifest, options.html). 19 old groups grown, 16 new everyday groups
  (lifestyle, beauty, food, shopping, personalfinance, travel, home, entertainment, sports, gadgets,
  pets, parenting, science, history, automotive, fashion); new groups start ticked.
- `content.js` `buildMasterRegex` is an indexed matcher (first 3 chars -> small sticky regex),
  same results as the old alternation on 2,326 real windows, ~14x faster at this size.
  `qualityKeepSet` only excuses words of terms kept in English. `vi-segmenter.js` caches the
  term set per list. Startup: ~16 ms parse + 3 ms build.
- Measured on the user's 44 cached videos + 30 PBS videos: 1.47 protected terms per 12-line window.
- 2.5.8 (same day): all-caps brands said as a word (WHOOP), AI name respellings in `dub-speech.js`.
- `npm test` 710 pass, 0 fail, 1 skip; regress 0 moved, baseline saved at 2.5.9.

## Traps
- A lowercase entry matches any case: "whole foods" turned the store into "thực phẩm nguyên
  chất". Every new rendering must be checked against the capitalised names in other groups (the
  scan in this session found Stack Overflow, TOFU, Equinox, Goldfish, Monopoly, Outliers).
- Everyday words and idioms break lifestyle lines ("in the long run" -> "buổi chạy dài", "single",
  "mean", "woke", "depression" as economics). `tests/glossary.test.js` lists them; extend it.
- One lowercase key holds one rendering for all groups: first group wins (`EXTRA.dropped`).
- Appending to a file the session has Read/Written echoes the whole diff back: write data with Bash.
- Opening a page in the user's Chrome takes over the tab they are watching. Budget 200,000 đ/day.

## Unfinished
- Translation quality with the big glossary not measured on Gemini (needs a paid run): compare
  a few cached videos with the glossary on and off before trusting every rendering.
- 2.5.8 respellings checked on phonemes only, not heard in a real take.
- BACKLOG 44 (next: read the 30 videos with `--sentences`, about 0.05 USD), 45, 46, 47.
- Carried over: 2.5.7 shortcuts not tried on YouTube itself; share repo promotion of
  2.5.7-2.5.9 after a green install test; joint-takes branches; the 2.5.0 Coursera start hold not
  seen live; CI gaps (VC++ runtime, browser steps, a Vietnamese Windows profile); voice items
  "có nghĩa là", DN, NHNN; BACKLOG 43; `ban-giao.md` does not mention the share repo.
- Never ask the user about Chrome's Apple Events setting.
