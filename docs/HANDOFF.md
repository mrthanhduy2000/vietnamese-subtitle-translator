# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `2.3.0` whole-product review, round 1 (lane A, plus `tools/ext-storage.js`):
`context-engine.js` `detectDomain`, `vi-quality.js` `fixRepeatedHeads` + doubled-word rule,
`content.js` `trimTranslationLeaks(…, sources)`, `youtube.js` `ytTrimLeaks` head pass, tests, docs.

## What changed
- Measured on the user's real cache (`tools/ext-storage.js`, 15 videos, 531 groups): prefix matching
  gave 6 of 13 everyday videos a technical domain ("important" = import) and every sense hint sent
  with them was wrong. Now whole words, 3 distinct keywords, score >= words/150: 13/13 general,
  11/11 lecture samples still right (11-21 points against 3). `SUBTITLE.md` "Domain (2.3.0)".
- Head repeat: inside one window item k came back as its first words, item k+1 as those words plus
  the rest, so it was shown and spoken twice. `fixRepeatedHeads` drops it and re-splits by source
  share; a source that repeats itself (mantra, chorus: a shared 3-word run) is left alone.
- Doubled word only for grammar words, never across punctuation: false severity-3 flags 9 -> 0,
  refine-triggering lines 15 -> 6 of 531 (each was a paid refine in Balanced mode).

## State
- Tests: 603 pass, 0 fail, 1 skip. Reload: **yes** (`chrome://extensions`). Round 2 follows.

## Unfinished / in progress
- Not verified live: the warm-up after a long idle and the "có nghĩa là" reading need the local
  server; the classifier blocks Claude there, so the user's next YouTube listen is the check (also
  DN, NHNN read Vietnamese, 2.2.4).
- Carried over: AI Studio vs cost card, compare one full Pacific day after a Reload; the live
  harness (`?script=stress`, `viewer2`) is the user's to run; "Chép chẩn đoán" right after a problem.
  Never ask about Apple Events JS or hand decisions back (memory).

## Traps hit this session
- Chrome's `.ldb` tables are Snappy-compressed (`strings` shows fragments); the newest values sit in
  the `.log`. Use `tools/ext-storage.js`, never `strings | grep` on a ledger.
- `tests/segmenter.test.js` "every translation path runs the leak trim" pins the exact call text of
  `trimTranslationLeaks` / `ytTrimLeaks`: change the call, change the pin.
- Paraphrased tail leaks (the model's own wording of the next line) still pass `trimContextLeak`:
  2 seen in 531 groups (4eY5DuqASQc #27, 7ReQFzSndj4 #14); word-pair matching cannot see them.

## Suggested next step
- After a Reload, one YouTube listen after the Mac idled 10+ min (first voice time), and one full
  Pacific day of the cost card against AI Studio Usage.
