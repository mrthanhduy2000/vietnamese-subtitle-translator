# Backlog

Known defects and leftovers, **not yet decided on**. None of these is breaking anything the user has
reported. Do not fix one as a drive-by: each deserves its own change and its own version bump. The
user hands these decisions to Claude: decide, record the outcome here, never hand it back.

How this file works:
- Grouped by **area**, not by when it was found; *(found 1.x.y)* after a title says when.
- Numbers are permanent: code comments and `version-history.js` cite them. Never renumber. The next
  free number is **49**.
- Add an entry whenever you find something out of scope for your task. Once decided, delete it and
  add its number to "Closed" or "Declined" below. An entry that is only partly fixed keeps what is
  left, not the story of the fix (that is in git and `DUBBING.md`).
- Behaviour kept on purpose is documented where it lives (`DUBBING.md` "Known limits kept on
  purpose", `CLAUDE.md`, `TESTING.md`), not here.

Closed (story in git and `version-history.js`): 1-4 (1.6.4), 6, 10 and 12 (1.9.4), 17 (1.7.8),
25 (merged into 31), 32 and 34 (1.8.7), 35 (1.9.8), 38 (every lead checked, none kept; numbers in
`DUBBING.md` under the 1.9.9 buffer), 7 (two palettes, two designs), 24 (2.2.4: Vietnamese
abbreviations in `VI_CAPS`, a code the English source lacks reads Vietnamese), 37 the translation
timeout (0 late of 268 Gemini calls, Sep 28-29 ledger: the timeout stays), 42 friends' installs
pinned to the model release (published 2026-10-11; 2.5.2 on the share repo's main after a green
install test on staging and main, 2026-10-15).
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

- **46. Translation asks Gemini 3 below temperature 1** *(found 2.5.3, 2026-10-16)*. `translateUnit`
  uses 0.2 (0.35 for a refine) on 3.1 Flash-Lite; Google's Gemini 3 guide warns that below 1.0 the
  model may loop. The speaker reading's runaway (a turn on every line) came at 0, 0.5 and 1 alike, so
  temperature was not its cause; for translation nothing is measured. Measure first: cut-off answers
  and item-count mismatches ("Số mục không khớp") per 100 calls at 0.2 against 1.0, on saved videos.

## Dubbing

- **44. The AI reading misses turns inside a line on recognizer captions** *(found 2.5.3)*. Over 30
  news videos read from their plain track, 71 of 193 turns that start inside a caption line got no
  turn at all from the reading (77 placed right, 31 at the line start, 14 elsewhere): most of the
  2.5.3 gap between plain (90.2%) and clean captions (93.5%). Prompt changes tried did not close it
  (`DUBBING.md` "Who speaks").
  2.5.5 measure (`speaker-lab.js score --why`, the 29 plain readings of run v2): 10.1% of the words
  are in another voice than their person's. 3.3 points are whole turns that kept the voice before
  (13 turns the reading named nowhere near), 3.2 people with no voice of their own (the reading took
  two people for one; the 8-voice cap costs only 0.7), 1.8 whole turns in someone else's voice (a
  question that names the next speaker, "So Doug, ...", read as Doug's), 1.7 a switch early or late.
  Placement is not the problem: 978 of 987 quoted first words are found. Next step, needs paid
  readings: lines cut at sentence ends (`--sentences`, run `v2s` in `speaker-lab-runs.js`) start
  72.1% of the true turns at a line start against 44.2% for caption lines; read the 30 videos with
  `prepare --variants=plain --sentences` (about 0.05 USD, a day with budget left), then
  `score --tag=v2s --as=plains --sentences --why` against the 90.2% above. One video read so far
  (-9QQNgMxdPY, 23 people): 74.7 against 76, which says nothing alone. Tried and dropped, free: a
  ">>" with no AI turn within 2 s handed to the voice before (32 of its 38 cases are real turns, but
  the voice before is the wrong one on panels): 89.89 -> 89.72.
- **45. Long podcasts miss the turn back after a short interjection** *(found 2.5.3)*. UIy-WQCZd4M
  (3 hours, 2 people, read in parts of ~800 lines): 90.8% of the words in the right voice; most errors
  are a "Right." or "Yeah." by the host read as a turn with no turn back, so the guest's next answer
  stays in the host's voice until the next turn.
- **48. The voice falls silent while the speaker still talks** *(found 2026-10-23)*. Playback-sim on
  100 saved videos: 3,738 silences over 0.6 s (1,012 over 2 s, about 6,100 s in all) while the
  source speaks at 3 or more syllables a second, out of 12,500 lines. Cause: a Vietnamese line shorter
  than its slot is read at the floor (`minSps` 4.0 syl/s, the user found slower "quá chậm") and the
  next line may not start before its speaker. Idea not built, needs listening: hand the slack to the
  take's own pauses (`maxPause` 0.4 is trimmed for every line, also for one with time to spare)
  instead of one silence at its end. Expected gain is small: a take has a few pauses, a looser cap (0.7)
  gives back 0.2-0.6 s while the silences run 1-4 s; it would need its own audio key ("loose").
- **47. Cuts inside a phrase left after SEG_STRETCH** *(found 2.5.3)*. 17 of 7779 segment cuts over
  the user's 44 saved videos still fall inside a phrase, where a 2 s stretch reaches no better place. A 3 s
  stretch reached 11 but let segments grow past 13 s; cutting inside a line at its best phrase
  boundary made 49 more segments and more weak cuts. Not worth a change alone.

## Install and update

- **43. Edge's startup boost holds friends' updates** *(found 2.5.2, 2026-10-16)*. On Windows, Edge
  keeps `msedge.exe` running after its last window closes (startup boost, background apps on by
  default), and `dichphude-update.py` lays a staged version over the folder only while the browser
  holding it is closed, so a friend on Edge may wait until a restart or a sign-out. Not measured on a
  real Windows machine. A fix would need an Edge-specific signal that no window is open.

## No version control history before 2026-09-23

`git init` was run on 2026-09-23 with the whole 1.4.0 tree as the first commit. Everything from
v1.0.4 to v1.4.0 has no per-release history (`version-history.js` reconstructs it for the UI). The
original v1.0.4 zip sits at `~/Downloads/vietnamese-subtitle-translator-v1.0.4.zip` if you ever need
the true starting point. The old README changelog for that period was removed on 2026-09-27; read it
with `git show d0c46d5:README.md`.
