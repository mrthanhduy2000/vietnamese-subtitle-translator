# Handoff (2026-10-25, lane A, thread "Làm đẹp phụ đề trên video")

## Current state
- Overlay line fade (docs/changes/overlay-line-fade.md): `CST_STYLE.fadeInCue` in subtitle-style.js
  fades a changed line in over 160 ms. Called from `ytVePhuDe` (youtube.js) and `csPaint`
  (content.js). Offline tests: tests/cue-fade.test.js. `npm test`: 952 pass, 0 fail.
- The overlay already had: reduced-motion transitions (`overlayTransition`), legibility warnings,
  side-room shift for the transcript panel and quick menu, font size floor 12 px for small players.
  Those were left as they are.
- Not checked live: the fade on a real YouTube page or Coursera lecture. Headless Chrome on the Mac
  is the place for it (see the note below).

## Unfinished (carried over from the 2026-10-24 handover, still open)
- Sparse caption notice: open iYL-UuNE_9w (Taliban courtroom, only "ar (auto)") after Reload.
- YouTube embed frames (TEDx): try monica_fay (6Cq4UGibpQY), shuli_steele (JNVjPM1cIbg),
  michelle_zhang (1mCfjO2f2dI) on Chrome. Open question: does the embed's small player fit the
  control-bar button and the overlay?
- TED hold: confirm on Chrome that a TED talk shows "Đang chuẩn bị" and starts with subtitles.
  Console line: `[Lồng tiếng] Chờ chuẩn bị`.
- Mac only: `node tools/git-autoupdate.js --install`, then check the log once git auth works from
  launchd.

## Traps
- `docs/MAP.md` and `docs/TESTING.md` counts change on every test or file added: run
  `node tools/doc-sizes.js` and commit its output with the change.
- `fadeInCue` checks each child's `animate`, not the overlay's. Tests stub children only.
- A repaint with the same text must not animate (resize calls `yt.renderKey = ""`), so the key is
  the text on screen, not the cue object.
- Parallel UI threads all touch this file: keep HANDOFF edits short when rebasing.
