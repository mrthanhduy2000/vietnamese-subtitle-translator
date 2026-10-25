# Handoff (2026-10-25, lane A, thread "Sửa song ngữ hiện hai dòng tiếng Việt")

## Current state
- Bilingual fix (docs/changes/youtube-source-not-vietnamese.md): `ytChonTrack` (youtube.js) no longer
  takes a Vietnamese caption track as the source when the spoken language is known and another
  language. The speech's own track (or any other non-Vietnamese track) is used. A Vietnamese-only
  video, Vietnamese speech and unknown speech keep the old shortcut.
- Tests: tests/source-track-not-vietnamese.test.js (6 cases). `npm test`: 974 pass, 0 fail.
- Not checked live on the Study Buddhism video (Roger Kunsang). Check on Chrome after Reload.

## Unfinished (carried over from the 2026-10-25 handover by the thread "Làm đẹp phụ đề trên video", still open)
- Overlay line fade: not checked on a real YouTube page or Coursera lecture (headless Chrome on the Mac).
- Sparse caption notice: open iYL-UuNE_9w (Taliban courtroom, only "ar (auto)") after Reload.
- YouTube embed frames (TEDx): try monica_fay (6Cq4UGibpQY), shuli_steele (JNVjPM1cIbg),
  michelle_zhang (1mCfjO2f2dI) on Chrome. Open: does the embed's small player fit the control-bar button and the overlay?
- TED hold: confirm on Chrome that a TED talk shows "Đang chuẩn bị" and starts with subtitles.
- Mac only: `node tools/git-autoupdate.js --install`, then check the log once git auth works from launchd.

## Traps
- Coursera (`content.js`, ~line 1083) has the same Vietnamese shortcut (`skipSameLang`). It has no
  spoken-language signal there, so it is not changed. A Coursera video with English speech and a
  Vietnamese track can still show Vietnamese on both lines. Open defect for lane A.
- `spokenLanguage` (lang-detect.js) falls back to the page title when no audio track is known. A
  localized title in Vietnamese can then make English speech look Vietnamese. Not verified live.
- `docs/MAP.md` and `docs/TESTING.md` counts change on every test or file added: run
  `node tools/doc-sizes.js` and commit its output with the change.
