# Handoff (2026-10-18, 2.6.1)

## State
- 2.6.1: English the translation keeps is said the international way by VieNeu. New measure on
  real subtitles, `tools/subtitle-pron.js` (50 videos, 2,041 English spans): read Vietnamese 64
  (3.1%) at 2.6.0 -> 21 (1.0%); the rest are mostly Vietnamese on purpose ("nhóm A", "750 W").
  Rules listed in docs/DUBBING.md, bullet "English the translation kept" (letters after English
  words, vitamin lists, R-E-V spellings, web addresses and "chấm com", source-backed codes and
  names, plural codes, + and (k) in names, merged `<en>` tags). RESPELL 58 -> 106.
- Glossary 24,911 -> 29,486 terms (52 groups): teams and leagues, games, companies and products,
  apps, every country and US state, books and podcasts, anime and films, musicians, drugs and
  supplements, food chains and drinks, markets and funds, gym, psychology and slang, breeds and
  plants, exams and agencies, travel, home, cars and EVs, AI models. `glossary-data.js` ~35,000
  lines, ~750 KB; load 32 ms, speech init 44 ms (Node).
- Glossary names kept in English: 13,962; read Vietnamese 516 without the bridge, 117 with it.
- `npm test` 722 pass, 0 fail, 1 skip; pron-eval unchanged (dev 128/131, validation 39/42);
  regress `late` 1712 -> 1718 (English letter names slightly longer), baseline saved at 2.6.1.

## Traps
- `$TMPDIR/fix.py` removes by core term in every block of the data file: removing a word for one
  block also removed "Geneva" (city) and "burnout|kiệt sức" (re-added); check the removed count.
- Every new block lets everyday words in (ate, cap, bet, mid, lore, crash, premium, recall,
  pickup, subway, mold...). They are now in the `tests/glossary.test.js` everyday list.
- A lowercase rendering hits capitalised names of other groups (Fossil, App Store, Calico,
  Firefly, Deadlock); scan for case collisions after each block.
- After appending names, run `node tools/glossary-pron.js --write` twice (the second pass finds
  spellings the first one's table enabled), then the audit.
- Write data with Bash `cat >>`, never Read/Write on `glossary-data.js`.

## Unfinished
- The user wants the glossary to keep growing ("không dừng"): next candidates are Vietnamese
  brands and places in English spelling, more product lines, songs, sports players, legal and
  government jargon with renderings.
- 2.6.x readings are checked on phonemes only, not heard in a real take.
- Translation quality with the big glossary not measured on Gemini (needs a paid run).
- BACKLOG 44 (next: read the 30 videos with `--sentences`, about 0.05 USD), 45, 46, 47.
- Carried over: 2.5.7 shortcuts not tried on YouTube itself; share repo promotion of
  2.5.7-2.6.1 after a green install test; joint-takes branches; the 2.5.0 Coursera start hold not
  seen live; CI gaps (VC++ runtime, browser steps, a Vietnamese Windows profile); voice items
  "có nghĩa là", DN, NHNN; BACKLOG 43; `ban-giao.md` does not mention the share repo.
- Never ask the user about Chrome's Apple Events setting.
