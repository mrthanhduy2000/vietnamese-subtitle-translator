# Backlog

Known defects and leftovers, **not yet decided on**. None of these is breaking anything the user has
reported. Do not fix one as a drive-by: each deserves its own change and its own version bump. The
user hands these decisions to Claude: decide, record the outcome here, never hand it back.

How this file works:
- Grouped by **area**, not by when it was found; *(found 1.x.y)* after a title says when.
- Numbers are permanent: code comments and `version-history.js` cite them. Never renumber. The next
  free number is **42**.
- Add an entry whenever you find something out of scope for your task. Once decided, delete it and
  add its number to "Closed" or "Declined" below. An entry that is only partly fixed keeps what is
  left, not the story of the fix (that is in git and `DUBBING.md`).
- Behaviour kept on purpose is documented where it lives (`DUBBING.md` "Known limits kept on
  purpose", `CLAUDE.md`, `TESTING.md`), not here.

Closed (story in git and `version-history.js`): 1-4 (1.6.4), 6, 10 and 12 (1.9.4), 17 (1.7.8),
25 (merged into 31), 32 and 34 (1.8.7), 35 (1.9.8), 38 (every lead checked, none kept; numbers in
`DUBBING.md` under the 1.9.9 buffer), 7 (two palettes, two designs), 24 (2.2.4: Vietnamese
abbreviations in `VI_CAPS`, a code the English source lacks reads Vietnamese), 37 the translation
timeout (0 late of 268 Gemini calls, Sep 28-29 ledger: the timeout stays).
Closed 2026-09-29 in the full backlog pass (2.2.6):
- Fixed: 20 (cold VieNeu warm-up, `handleLocalWarm`), 16 (explaining copulas; every eval set WRONG 0).
- Unreachable while the paid voice is off (`PAID_TTS` false; the service worker refuses every Gemini
  TTS call): 11, 13, 28. The comment on `PAID_TTS` in `cost-policy.js` names them for whoever turns
  the paid voice back on.
- Kept on purpose, documented where it lives: 5 folder name (`CLAUDE.md`: renaming loses the key),
  8 frozen splitter baseline (`TESTING.md`), 14 Coursera waits for a retranslation (showing first
  would voice the line twice), 15, 18, 19, 21, 22, 23, 26, 27, 29, 30, 31, 33, 36 (`DUBBING.md`
  "Known limits kept on purpose").

Declined, never re-add or re-propose:
- 37, the VieNeu "release the slot at once" server patch (2026-09-28: 27 slow releases in 7979
  takes, ~2 min a week; the full gain needed the fragile abort path in `DANGER.md` §15).
- 39, VieNeu reading faster at the source (2026-09-29): needs a server change in `~/VieNeu-TTS` and a
  model switch to v3nano (another timbre, unmeasured speed on the 16 GB Mac); the free voice works.
- 9, Udemy and edX caption sources (2026-09-29): both need a logged-in sample page to build against
  and none is available; any player with standard text tracks already works (`SUBTITLE.md` generic).
- 41, slowing the video a little while the voice cannot keep up with a fast talker (2026-10-06): the
  user decided against it; the lines that start late stay as they are (`DUBBING.md` known limits).
- 40, removing the sync key `dubCondense` left by the condensing taken out in 1.7.3 (2026-09-30): no
  code reads it, it is 5 bytes, and a removal costs a storage call at every service-worker start.

## Defects

none

## Subtitles and translation

none

## Dubbing

none

## No version control history before 2026-09-23

`git init` was run on 2026-09-23 with the whole 1.4.0 tree as the first commit. Everything from
v1.0.4 to v1.4.0 has no per-release history (`version-history.js` reconstructs it for the UI). The
original v1.0.4 zip sits at `~/Downloads/vietnamese-subtitle-translator-v1.0.4.zip` if you ever need
the true starting point. The old README changelog for that period was removed on 2026-09-27; read it
with `git show d0c46d5:README.md`.
