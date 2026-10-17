# Handoff (2026-10-18, 2.6.2)

## State
- 2.6.2: a dotted initial next to an English name ("C.S. Lewis") is said as English letters when
  the source writes the letters before the name, even if the source splits them across two cues
  ("CS Lewis"). Rule in `dub-speech.js` `renderUncached`, `srcHas`.
- Measure `tools/subtitle-pron.js` (50 videos, 1,670 English spans judged): read Vietnamese
  HEAD 7 (0.4%) -> now 4 (0.2%). Window widened from ±0.5 s to ±4 s for source evidence.
- Not 0% yet. The 4 left: "LA Times" (real: VieNeu reads "LA" as Vietnamese "la", no glossary
  reading yet); "SEG mahaa" (chant, lowercase non-English words; the exclusion rule only checks
  words that start lowercase, so this one passes it); "John" x2 (measurement artifact: replacing
  "John" with "cái" changes Dan's reading, so "và" enters the diff; `judge()` needs better alignment).
- `npm test` 722 pass, 0 fail, 1 skip. `regress.js` `late` 1718 -> 1722 (+4, 3 videos), explained
  by English letter names being longer than the old Vietnamese readings. Baseline saved at 2.6.2.
- Glossary 29,486 terms (52 groups), unchanged this version. `glossary-pron.js --show=0` = 0.

## Traps
- `$TMPDIR/fix.py` removes by core term in every block of `glossary-data.js`: removing a word
  for one block also removed "Geneva" and "burnout|kiệt sức"; check the removed count.
- Every new glossary block lets everyday words in; they are in `tests/glossary.test.js`.
- Lowercase renderings hit capitalised names of other groups (Fossil, App Store, Calico);
  scan for case collisions after each block.
- After appending names run `node tools/glossary-pron.js --write` twice, then the audit.
- Write `glossary-data.js` with Bash `cat >>`, never Read/Write.
- `subtitle-pron.js` judges with base "cái": a name whose replacement changes a neighbour's
  reading shows up as a false positive (the "John" case).

## Unfinished
- 0% on subtitles: the 4 items above. Fix "LA Times" in the glossary (a reading, then
  `pron-eval`); fix the chant exclusion and the `judge()` alignment in the measure, and report
  how many spans each rule excludes.
- The user wants the glossary to keep growing ("không dừng"): next candidates are Vietnamese
  brands and places in English spelling, more product lines, songs, sports players, legal and
  government jargon.
- 2.6.x readings are checked on phonemes only, not heard in a real take.
- Translation quality with the big glossary not measured on Gemini (needs a paid run).
- BACKLOG 44 (next: read the 30 videos with `--sentences`, about 0.05 USD), 45, 46, 47.
- Carried over: 2.5.7 shortcuts not tried on YouTube itself; share repo promotion of
  2.5.7-2.6.2 after a green install test; joint-takes branches; the 2.5.0 Coursera start hold not
  seen live; CI gaps (VC++ runtime, browser steps, a Vietnamese Windows profile); voice items
  "có nghĩa là", DN, NHNN; BACKLOG 43; `ban-giao.md` does not mention the share repo.
- Never ask the user about Chrome's Apple Events setting.
