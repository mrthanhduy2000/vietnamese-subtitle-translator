# Handoff (2026-10-19, 2.6.7)

## State
- 2.6.7: subtitles and voice came 4-5 s early on qSlxe4hA66g. `yt-bridge.js` served the player's
  own caption body (display form: 172 two-row blocks, no word times) before our json3 fetch with
  the pot (596 events with word times). Now our fetch comes first; the player's body is the
  fallback (DANGER.md item 1). Saved copies from 2.6.5-2.6.6 retranslate once (`ytMaTrack` "|2").
  The MAIN-world bridge is only replaced by F5, not by Reload.
- 2.6.6: voices per speaker on qSlxe4hA66g (Modern Warfare 4, Korean recognizer captions). The
  user: the voice keeps switching to the wrong person. The cached reading (decoded from the
  extension's IndexedDB log) had 3 speakers all labelled "unknown"/"unknown" and turns only at
  line starts, while lines held 2-3 turns after inner ">>".
- `dub-planner.js` `splitAtMarks` (in `speakerLines`): an inner ">>" opens its own line, time by
  character share. `background.js` speaker prompt v3 (`SPEAKER_PROMPT_VERSION = 3`, every video's
  reading is redone once, paid): film/game scenes, any language, role labels, gender from role or
  address. DUBBING.md "Turns inside a line, prompt 3".
- 2.6.5 (same day): original speech's ASR told from dub transcripts by `variant=timing-optimized`
  (`CST_LANG.dubTranscripts`); saved copies carry `src`. 2.6.4: `screen-text.js` fallback.
- `npm test` 732 pass, 0 fail, 1 skip. `regress.js` 0 numbers moved (rules path unchanged).

## Traps
- The speaker reading cache lives in IndexedDB, not storage.local: `ext-storage.js` cannot see
  it. The recent writes sit uncompressed in `IndexedDB/chrome-extension_<id>_0.indexeddb.leveldb/
  *.log`; values are V8-serialized (tags o " c I A $ {). A 60-line Python reader did it; not kept.
- Never trust the audio track's language label; read the transcript text first.
- `Control_Chrome execute_javascript` returning a frame as a data URL costs ~8k tokens; don't.
- The user watches on the YouTube tab: read state with execute_javascript, never open tabs.
- `Control_Chrome execute_javascript` runs in an isolated world (no player methods). For the main
  world, append a <script> through a fresh `trustedTypes.createPolicy`; write results to an
  attribute on <html> and read it in the next call.

## Unfinished
- Not measured: prompt 3 and the split on a real reading. Next: after Reload, dub qSlxe4hA66g,
  decode the new reading from the IndexedDB log, and check labels, genders, turn times; then
  score prompt 3 on the speaker lab (BACKLOG 44, ~0.05 USD) to be sure news did not get worse.
- `screen-text.js` never run live. qSlxe4hA66g after 2.6.5 not checked live either.
- Carried over: subtitle measure on more reviewed videos (`--dir`); "l a times" heard in a real
  take; glossary growth; 2.6.x readings not heard; glossary quality on Gemini; BACKLOG 43-47;
  2.5.7 shortcuts on YouTube; share repo promotion of 2.5.7-2.6.6 after a green install test;
  joint-takes branches; 2.5.0 Coursera start hold; CI gaps; voice items "có nghĩa là", DN, NHNN;
  `ban-giao.md` lacks the share repo.
- Never ask the user about Chrome's Apple Events setting.
