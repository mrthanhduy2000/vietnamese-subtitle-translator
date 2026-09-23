# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched

2026-09-23 · lanes A and C, plus tests in lane D · version `1.5.3`. Earlier today: 1.4.7 the dubbing
overload fix, 1.4.8 the language cleanup, 1.4.9 to 1.5.2 the on-player and icon redesign.

## What changed

- **New file `player-ui.js`** (`CST_PLAYER_UI`, loaded before `content.js` and `youtube.js`): the
  product mark, the control-bar button builder and the quick-menu stylesheet. Both players draw from
  it, so they cannot drift apart again; `youtube.js` lost its private copies.
- **Coursera now works like YouTube.** The Vietnamese used to go to the browser's cue renderer, which
  Coursera paints over, so two boxes overlapped. `applyTranslation` now fills `cs.viCues` /
  `cs.origCues`, sets the track to `mode = "hidden"`, and `csStartRender` paints our own
  `.cst-cs-overlay` with `CST_STYLE`. The two circles floating over the picture are gone: one button
  sits in Coursera's own control bar and opens the same quick menu (subtitles, dubbing, voice,
  display mode, Settings).
- **`csPlayerParts` finds the control bar by geometry**, never by class name (Coursera's are hashed).
  Two traps measured live: searching the whole document catches the buttons of an open dialog, so it
  climbs the video's own ancestors, stops before `<body>` and needs 3+ controls; and the anchor is the
  **rightmost** button, not the last one in DOM order.
- Still true from earlier today: the control-bar icon is painted as a `background-image` because
  YouTube's CSS computes an inline `<svg>` in `.ytp-button` to width 0, and `icons/` holds four PNGs
  drawn per size by `tools/make-icon.py` (no SVG rasteriser on this machine).

## State

- `npm test`: 325 tests, 324 pass, 0 fail, 1 skip · committed by path · Reload at
  `chrome://extensions`: **yes** (1.5.3)
- VieNeu: healthy, RTF ~0.23, `Interactive`, LaunchAgent loaded.

## Unfinished / in progress

- **Coursera 1.5.3 has not been seen running.** Button placement and overlay geometry were verified
  by injecting copies into the live lecture page (48x48 before fullscreen; overlay centred, 64px
  above the bar), but the shipped code has not been loaded in Chrome yet. Dubbing on Coursera is
  untouched but also untested since the display rewrite.
- Nothing from 1.5.1 / 1.5.2 has been seen in place either (toolbar, popup and Settings marks).
- Alt+S / Alt+D end to end and the quick-menu voice picker are still unmeasured (user deferred).
- `docs/BACKLOG.md` has 8 open items, all needing the user's go-ahead first.

## Traps hit this session

- The Chrome bridge drops its tab group between calls: batch navigate + inspect in one
  `browser_batch`, and rebuild with `tabs_context_mcp{createIfEmpty:true}` when it errors.
- YouTube enforces Trusted Types, so `innerHTML` throws in page-world probes (content scripts are
  exempt). Build probe elements with DOM calls.
- The sandbox blocks loopback TCP and refuses to start a local static server, and the preview pane
  cannot screenshot a `file://` page: assert on the source, probe the live page, send the user a file.

## Suggested next step

- Ask the user to reload and watch a Coursera lecture, then fix whatever the overlay gets wrong.
