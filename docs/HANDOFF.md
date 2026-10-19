# Handoff (2026-10-19, 2.6.4)

## State
- 2.6.4: on-screen subtitles. Some YouTube videos list caption tracks that ALL transcribe one of
  YouTube's AI dubs (qSlxe4hA66g, a Call of Duty walkthrough: original audio en-US, 21 ASR tracks in
  dubbed languages, no English one). `ytChonTrack` fell to `tracks[0]` (the Arabic dub's ASR) and
  the translation had nothing to do with the game's burned-in captions the user reads.
- Now `CST_SCREEN.onlyDubTranscripts` (new `screen-text.js`) sends `ytBatDauDich` to
  `ytBatDauDocChuTrenHinh` (`youtube.js`), before the saved copy. It samples the frame's caption
  band on a canvas every 250 ms, reads a caption once it settles, and the new service-worker route
  `readScreenText` (`background.js`) reads + translates one JPEG crop with Gemini (cheap tier,
  budget checked, spend tracked). 45 s of play with no caption -> falls back to the dub track.
- Canvas read of the YouTube `<video>` works (checked in the MAIN world on the user's tab:
  `getImageData` not tainted). The isolated world was not checked live.
- `npm test` 727 pass, 0 fail, 1 skip (5 new in `tests/screen-text.test.js`). No regress run:
  the translation and voice paths did not change.

## Traps
- `Control_Chrome execute_javascript` returning a frame as a data URL costs ~8k tokens; don't.
- `player.getPlayerResponse()` from `execute_javascript` returned nothing; ask the bridge instead
  (`postMessage({cstType:"YEU_CAU_PHU_DE"})`, read the answer from a window variable next call).
- Caption tracks of a video are visible offline: `curl` the watch page (allowed_domains
  www.youtube.com) and parse `captionTracks` / `audioTracks`.

## Unfinished
- Not run live end to end: no reload of the extension, no real Gemini read of a frame. Next: on
  qSlxe4hA66g check that captions appear, how late, that HUD does not trigger reads, and the spend.
- Screen mode has no voice, no transcript panel, no cache; a revisit reads again.
- The mask thresholds (BRIGHT 175 / DARK 100, 0.3% share) are guesses, tuned on synthetic bands.
- Carried over: subtitle measure on more reviewed videos (`--dir`); "l a times" heard in a real
  take; glossary keeps growing (Vietnamese brands, products, songs, players, legal jargon); 2.6.x
  readings not heard; glossary translation quality on Gemini; BACKLOG 43-47; 2.5.7 shortcuts on
  YouTube; share repo promotion of 2.5.7-2.6.4 after a green install test; joint-takes branches;
  2.5.0 Coursera start hold; CI gaps; voice items "có nghĩa là", DN, NHNN; `ban-giao.md` lacks the
  share repo.
- Never ask the user about Chrome's Apple Events setting.
