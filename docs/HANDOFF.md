# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `2.3.1` whole-product review, round 2 (lanes A and D, `dubbing.js` one line):
`vi-quality.js` sound notes, `content.js` `requestUnit` / `pageVideoTitle`, `youtube.js`
`ytTrimLeaks` + `yt.videoTitle`, `background.js` ledger load race, tests, docs.

## What changed
- Sound captions ("[Music]", "[Musik]", "[เพลง]"): translated from a list, always in square brackets,
  so the dub planner leaves them silent. On the user's cache the voice read a note aloud in 45 of
  531 groups, now 1; 50 notes-only groups need no request. `SUBTITLE.md` "Sound captions (2.3.1)".
- Cost ledger: a reset or a charge reaching a worker that just woke was replaced by the stored
  ledger loading after it. `track()` waits for `ledgerReady`; `DANGER.md` §4.
- One `pageVideoTitle()`: the ledger, popup, transcript panels and edits had four title variants,
  two of them raw ("(1) … - YouTube" on 4 of 5 real titles). YouTube prefers the player's title.
- No empty `ctxterms_*` key per channel (43 of 51 real ones); `TARGET_LANG`/`MAX_CHUNK_CHARS` removed.

## State
- Tests: 608 pass, 0 fail, 1 skip. Reload: **yes** (`chrome://extensions`). Round 3 follows.

## Unfinished / in progress
- Not verified live: the warm-up after a long idle and the "có nghĩa là" reading need the local
  server; the classifier blocks Claude there, so the user's next YouTube listen is the check (also
  DN, NHNN read Vietnamese, 2.2.4).
- Carried over: AI Studio vs cost card, compare one full Pacific day after a Reload; the live
  harness (`?script=stress`, `viewer2`) is the user's to run; "Chép chẩn đoán" right after a problem.
  Never ask about Apple Events JS or hand decisions back (memory).

## Traps hit this session
- `bg-env.js` answered `storage.local` synchronously, which hid the ledger race; use `asyncLocal`
  for anything that loads state at worker start.
- Cached translations: `node tools/ext-storage.js --prefix=ytcache4_ --out=$TMPDIR/yt` then replay a
  fix over `g[k][2]` against `g[k][3]`; that is how both 2.3.x rounds were measured.
- `tests/segmenter.test.js` "every translation path runs the leak trim" pins the call text of
  `trimTranslationLeaks`, `ytTrimLeaks` and now `fixSoundNotes`: change the call, change the pin.
- Paraphrased tail leaks still pass `trimContextLeak` (4eY5DuqASQc #27, 7ReQFzSndj4 #14).

## Suggested next step
- After a Reload, one YouTube listen of a video with music breaks (no "Âm nhạc" read aloud), one
  after the Mac idled 10+ min (first voice time), and a full Pacific day of the cost card.
