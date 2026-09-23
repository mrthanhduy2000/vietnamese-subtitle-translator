# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched

2026-09-23 · lane A, plus tests in lane D · version `1.5.5`. Stage 1 of the plan the user approved
after a feature comparison with youtube-dubbing.com (plan file:
`~/.claude/plans/jiggly-sparking-milner.md`). Earlier today: 1.4.7 dubbing overload, 1.4.8 language
cleanup, 1.4.9 to 1.5.2 icons and on-player identity, 1.5.3 Coursera parity.

## What changed

- **New `transcript.js`** (`CST_TRANSCRIPT`): the talk as text beside the picture, both languages,
  the playing line highlighted and auto-scrolled (following stops the moment the reader scrolls).
  Click a row to seek, search inside the talk, export `.srt`. `mergeLines(viCues, srcCues)` pairs the
  two cue lists, which are cut differently, and `buildSrt` writes the file.
- **No new data and no API call**: `ytTranscriptAdapter()` hands it `yt.viCues` + `yt.cues`,
  `csTranscriptAdapter()` hands it `cs.viCues` + `cs.origCues`. Opened from the quick menu on both
  sites ("Bản chép lời"), panel styling lives in `player-ui.js` so it follows the same theme.
- **Source-track label in both quick menus** (`ytNguonPhuDe`, `csSubtitleSource`): the subtitle row
  now says "phụ đề tác giả tải lên" or "phụ đề máy nghe tự động", the latter in the warning colour.
  `yt.trackInfo` records which track `ytBatDauDich` settled on.
- Geometry checked live on a Coursera lecture: panel 360x447 inside the picture, 20px clear of the
  control bar, leaving 596 of 968px for the video.
- **1.5.5, the line-break bug the user photographed.** Coursera drew a cue as
  "... mà bạn có thể thực / hiện,": the segmenter breaks by syntax, not by pixels, and the Coursera
  overlay let CSS wrap what did not fit. Measured on the page: at subtitle size 130% that sentence is
  1085px wide against 848px of room. Fitting now lives in `subtitle-style.js` `fitLines` (canvas
  measurement, falls back to an estimate in px), both players call it, and the Coursera overlay
  copies the YouTube box exactly (`white-space:pre`, `width:max-content`, `max-width:92%`). With the
  transcript panel open both overlays narrow to half width and shift left (`panelOpen`).

## State

- `npm test`: 329 tests, 328 pass, 0 fail, 1 skip · committed by path · Reload at
  `chrome://extensions`: **yes** (1.5.5)
- VieNeu: healthy, RTF ~0.23, `Interactive`, LaunchAgent loaded.

## Unfinished / in progress

- **Stages 2 to 5 of the approved plan are not started**: subtitle editing with an override store,
  video summary (a paid Gemini call, needs the budget guard), read-aloud of selected text on any page
  (needs `activeTab` + `scripting` permissions), and a generic site adapter with edX as the first new
  site. The user has not named a concrete site yet.
- Nothing from 1.5.1 to 1.5.5 has been seen running in Chrome: icons, Coursera overlay, the panel
  and this line-break fix were all verified by tests plus live DOM probes, not by using the build.
  The user's own subtitle size is unknown from here; the bug needs >100% to show.
- Alt+S / Alt+D end to end and the quick-menu voice picker are still unmeasured (user deferred).
- `docs/BACKLOG.md` has 8 open items, all needing the user's go-ahead first.

## Traps hit this session

- The mini DOM in `tests/ui.test.js` has no `isConnected`, so a `!panel.isConnected` guard closed the
  panel on its first tick. Compare against `=== false` for "really removed".
- `const` declarations inside a page script are not sandbox properties: reach them with
  `vm.runInContext`, or feed the unit its data directly.
- The Chrome bridge drops its tab group between calls: batch navigate + inspect in one call.

## Suggested next step

- Ask the user to reload and try the panel, then start stage 2 (editing) or whichever stage they pick.
