# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `2.3.1` whole-product review, rounds 2 and 3. Round 3 changed only
`tools/playback-sim.js` (`--real=<dir>`) and docs; round 2 is the 2.3.1 code (see git log).

## What changed
- 2.3.1: sound captions ("[Music]", "[Musik]", "[เพลง]") translated from a list and bracketed, so
  the voice skips them (read aloud 45 -> 1 of 531 groups, 50 groups need no request); the cost
  reset and early charges survive a waking worker; one `pageVideoTitle()`; no empty `ctxterms_*`.
- Round 3 reviewed with no defect found: `yt-bridge.js` (the caption restore runs even after a
  throw; JSON3 and XML both parse), cache caps (15 videos = 0.8 MB, the 30 MB unit cache makes a
  revisit free), dubbing on the user's 15 real videos (1 drop in all, no delivery gaps), subject
  pronoun consistency ("Tôi" throughout), the Settings cost card.
- The paraphrased-leak remainder is now "kept on purpose" in `SUBTITLE.md` with numbers.

## State
- Tests: 608 pass, 0 fail, 1 skip. Reload: **yes** for 2.3.1 (`chrome://extensions`).

## Unfinished / in progress
- Not verified live: the warm-up after a long idle and the "có nghĩa là" reading need the local
  server; the classifier blocks Claude there, so the user's next YouTube listen is the check (also
  DN, NHNN read Vietnamese, 2.2.4).
- Carried over: AI Studio vs cost card, compare one full Pacific day after a Reload; the live
  harness (`?script=stress`, `viewer2`) is the user's to run; "Chép chẩn đoán" right after a problem.
  Never ask about Apple Events JS or hand decisions back (memory).
- Fast talkers with Mỹ Duyên (3.8 syllables/s): 24-30% of lines start >0.5 s late at a median rate
  of 1.33-1.44 (dSEZriz716g, zPSs9a0MYGw, simulated). Known limit; quicker voices are suggested.

## Traps hit this session
- `bg-env.js` answered `storage.local` synchronously, which hid the ledger race; use `asyncLocal`
  for anything that loads state at worker start.
- Measure on real data first: `node tools/ext-storage.js --prefix=ytcache4_ --out=$TMPDIR/yt`, then
  replay a text fix over `g[k][2]` against `g[k][3]`, or `node tools/playback-sim.js --real=$TMPDIR/yt`.
- `tests/segmenter.test.js` "every translation path runs the leak trim" pins the call text of
  `trimTranslationLeaks`, `ytTrimLeaks` and `fixSoundNotes`: change the call, change the pin.

## Suggested next step
- After a Reload, one YouTube listen of a video with music breaks (no "Âm nhạc" read aloud), one
  after the Mac idled 10+ min (first voice time), and a full Pacific day of the cost card.
