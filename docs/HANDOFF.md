# Handoff (2026-10-19, 2.6.5)

## State
- 2.6.5 fixes a wrong diagnosis made in 2.6.4. qSlxe4hA66g (Modern Warfare 4) is labelled en-US
  but spoken in Korean up to 17:30, then English. YouTube lists 21 ASR tracks: 20 transcribe its AI
  dubs and carry `variant=timing-optimized` in the URL; one `ko` track without the mark is the
  original speech (its text matches the game's burned-in captions, and it turns to English text
  at 17:30). `ytChonTrack` dropped every `ko` ASR because a Korean dub exists, and translated the
  Arabic dub's transcript.
- Now `CST_LANG.dubTranscripts` (`lang-detect.js`) decides by the URL mark when any track has it,
  else by dubbed language as before. `ytChonTrack`, `spokenLanguage` (unmarked ASR language beats
  the audio label) and `CST_SCREEN.onlyDubTranscripts` use it.
- Saved copies now carry `src` (`ytMaTrack` in `youtube.js`). A copy from another track, or one
  without `src` on a video with dub transcripts, is dropped and retranslated (one paid run each).
- 2.6.4's on-screen reader (`screen-text.js`, route `readScreenText`) stays as the fallback when
  every track is a dub transcript. It never triggers on qSlxe4hA66g now, and has NEVER run live.
- `npm test` 729 pass, 0 fail, 1 skip. No regress run: translation code did not change.

## Traps
- Never trust the audio track's language label: read the transcript text first. The user caught
  2.6.4's "original is English" from the label alone.
- Before 2.6.5 the bridge cached bodies by `v|lang|kind` without `variant`, so both `ko` tracks
  came back as one body. Fixed (`khoa` in `yt-bridge.js` takes the variant).
- `Control_Chrome execute_javascript` returning a frame as a data URL costs ~8k tokens; don't.
- Caption track lists are visible offline: `curl` the watch page (allowed_domains
  www.youtube.com) and parse `captionTracks` / `audioTracks`.

## Unfinished
- Not checked live after reload: that qSlxe4hA66g now picks the unmarked `ko` track and the
  Vietnamese matches the burned-in captions.
- `nhoTrinhPhatTai` still picks the player's first track of that language and kind (maybe the
  dub's) just to capture the pot; the body is then fetched by our own URL, so it is right.
- `screen-text.js`: never run live; mask thresholds tuned on synthetic bands only.
- Carried over: subtitle measure on more reviewed videos (`--dir`); "l a times" heard in a real
  take; glossary growth; 2.6.x readings not heard; glossary quality on Gemini; BACKLOG 43-47;
  2.5.7 shortcuts on YouTube; share repo promotion of 2.5.7-2.6.5 after a green install test;
  joint-takes branches; 2.5.0 Coursera start hold; CI gaps; voice items "có nghĩa là", DN, NHNN;
  `ban-giao.md` lacks the share repo.
- Never ask the user about Chrome's Apple Events setting.
