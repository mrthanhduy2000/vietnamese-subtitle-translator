# Handoff (2026-10-18, 2.6.3)

## State
- 2.6.3: `tools/subtitle-pron.js` (50 videos, 1,668 English spans judged) reads 0 Vietnamese
  (0.0%). Three fixes made this version:
  - LA Times added to the glossary (`glossary-data.js`, block "press"); it is said "l a times".
  - `judge()` aligns the readings by LCS (`unmatched()`), not by prefix/suffix. "John" next to
    "Dan" was a false positive from that cut.
  - Lowercase non-English words anywhere in a span (chant "SEG mahaa") are excluded and counted:
    318 spans now, shown in the measure's "not judged" line.
- Honest note on the numbers: 2.6.2 said 7 -> 4 under the older measure. The measure changed, so
  HEAD now reads 1 and this version 0. Compare only within one measure version.
- `npm test` 722 pass, 0 fail, 1 skip. `regress.js` 0 numbers moved vs the 2.6.2 baseline.
- Glossary 13,925 kept English names; `glossary-pron.js --show=0` = 0 read Vietnamese.
- Not heard: all readings are checked on phonemes only, not in a real take.

## Traps
- `$TMPDIR/fix.py` removes by core term in every block of `glossary-data.js`: removing a word
  for one block also removed "Geneva" and "burnout|kiệt sức"; check the removed count.
- Every new glossary block lets everyday words in; they are in `tests/glossary.test.js`.
- Lowercase renderings hit capitalised names of other groups (Fossil, App Store, Calico);
  scan for case collisions after each block.
- After appending names run `node tools/glossary-pron.js --write` twice, then the audit.
- Write `glossary-data.js` with Bash `cat >>`, never Read/Write.
- `subtitle-pron.js` judges with base "cái": a name's replacement can change a neighbour's
  reading. Fixed in 2.6.3 with LCS alignment; a new measure must not go back to prefix/suffix.

## Unfinished
- The subtitle measure is 0 on this sample, not on every video. Next: run it on more reviewed
  videos (`--dir`) before calling the sample closed.
- "l a times" is the speech for LA Times; check it sounds right in a real take.
- The user wants the glossary to keep growing ("không dừng"): next candidates are Vietnamese
  brands and places in English spelling, more product lines, songs, sports players, legal and
  government jargon.
- 2.6.x readings are checked on phonemes only, not heard in a real take.
- Translation quality with the big glossary not measured on Gemini (needs a paid run).
- BACKLOG 44 (next: read the 30 videos with `--sentences`, about 0.05 USD), 45, 46, 47.
- Carried over: 2.5.7 shortcuts not tried on YouTube itself; share repo promotion of
  2.5.7-2.6.3 after a green install test; joint-takes branches; the 2.5.0 Coursera start hold not
  seen live; CI gaps (VC++ runtime, browser steps, a Vietnamese Windows profile); voice items
  "có nghĩa là", DN, NHNN; BACKLOG 43; `ban-giao.md` does not mention the share repo.
- Never ask the user about Chrome's Apple Events setting.
