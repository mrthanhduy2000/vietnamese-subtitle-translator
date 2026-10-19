# Handoff (2026-10-19, 2.6.8)

## State
- The user (19/10): every fix is for the whole system, not one video. Report by class of defect
  with counts over all saved videos (`ext-storage.js --prefix=ytcache4_` + `review-archive/`, 69).
- Today's classes, all found on one Korean game video (qSlxe4hA66g), fixed as general rules:
  - 2.6.5: ASR tracks of AI dubs told from the original speech's ASR by `variant=timing-optimized`
    (`CST_LANG.dubTranscripts`); saved copies carry `src` (`ytMaTrack`). 2.6.4: `screen-text.js`,
    on-screen caption reading when every track is a dub transcript.
  - 2.6.6: `splitAtMarks` in `speakerLines` (an inner ">>" opens its own line for the speaker
    reading; 7 of 69 saved videos, 117 lines) and speaker prompt v3 (film/game scenes, any
    language, role labels, gender from role or address; every reading redone once, paid).
  - 2.6.7: `yt-bridge.js` fetches json3 with the player's pot before using the player's own body,
    which can be the display form (two-row blocks, no word times: lines 4-5 s early).
  - 2.6.8: if that display form is still used, `ytDocNoiDungPhuDe` gives each row of an
    overlapping block its own cue, timed by characters. 0 of 69 saved videos had that form.
- The MAIN-world bridge is only replaced by F5, not by Reload.
- `npm test` 733 pass, 0 fail, 1 skip. `regress.js` 0 numbers moved (2.6.6).

## Traps
- The speaker reading cache lives in IndexedDB, not storage.local. Recent writes sit
  uncompressed in `IndexedDB/chrome-extension_<id>_0.indexeddb.leveldb/*.log`, V8-serialized
  (tags o " c I A $ {); a 60-line Python reader decoded it; not kept.
- Never trust the audio track's language label; read the transcript text first.
- The user watches on the YouTube tab: never open tabs; a frame as a data URL costs ~8k tokens.
- `Control_Chrome execute_javascript` runs in an isolated world (no player methods). For the main
  world, append a <script> through a fresh `trustedTypes.createPolicy`; write results to an
  attribute on <html> and read it in the next call.

## Unfinished
- Not measured on a real reading: prompt 3 and the split. Next: after Reload + F5, decode a new
  reading from the IndexedDB log (labels, genders, turn times); score prompt 3 on the speaker lab
  (BACKLOG 44, ~0.05 USD) so news does not get worse.
- Not checked live: 2.6.5-2.6.8 after Reload; `screen-text.js` never ran.
- Carried over: subtitle measure on more reviewed videos (`--dir`); "l a times" heard in a real
  take; glossary growth; 2.6.x readings not heard; glossary quality on Gemini; BACKLOG 43-47;
  2.5.7 shortcuts on YouTube; share repo promotion of 2.5.7-2.6.8 after a green install test;
  joint-takes branches; 2.5.0 Coursera start hold; CI gaps; voice items "có nghĩa là", DN, NHNN;
  `ban-giao.md` lacks the share repo.
- Never ask the user about Chrome's Apple Events setting.
