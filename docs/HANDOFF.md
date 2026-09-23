# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched

2026-09-23 · lanes A and C plus a test in lane D · version `1.5.2`. Before this: 1.4.7 the dubbing
overload fix, 1.4.8 the language cleanup, 1.4.9 to 1.5.2 the on-player and icon redesign.

## What changed

- **1.4.9, the on-player surfaces now share one identity.** The control-bar button was a purple
  gradient with a speaker glyph and the quick menu had its own purple theme, so nothing on the video
  matched the popup or the Settings page. Both now use the extension's own mark (`CST_MARK_SVG`,
  one string feeding the button and the menu header) and the palette from `popup.css`: accent
  `#D97757`, cards with a border, 8/12/16 radii, the serif title face, and the popup's exact 36x20
  switch. The menu follows the `uiTheme` setting (light / dark / auto) through `data-cst-theme`,
  updated live from `storage.onChanged`. `cstToast` in `content.js` carries the same palette; it
  stays dark in both themes because it sits on a video. The status dot is down to two colours,
  amber while working and green while on, with the detail in the button title.
- **1.5.0 / 1.5.1, the button was empty on the real page.** Adding `width`/`height` to the inline
  SVG (1.5.0) did not help: measured in the page, YouTube's own stylesheet computes an inline `<svg>`
  inside `.ytp-button` to **width 0** while height stays 18px. The icon is now painted as a
  `background-image` data URI on the badge, which their CSS cannot reach, and the state code sets
  `backgroundColor` (the `background` shorthand would drop the image). Verified by injecting the
  badge into a live YouTube control bar and zooming in: icon visible next to the empty old one.
  The icon itself is a speech bubble with the brand mark inside; the menu header still inlines
  `CST_MARK_SVG`, which renders fine inside our own panel.
- **1.5.2, one mark for the whole product.** The toolbar icon, the popup header, the popup's primary
  button, the Settings header and the player menu were four different shapes. All of them now draw
  the same speech-bubble-with-spark, and `icons/` holds four PNGs drawn per size (16/32/48/128,
  smaller ones bolder) instead of one file scaled four ways. `tools/make-icon.py` draws them with
  PIL, since this machine has no SVG rasteriser; re-run it if the mark ever changes.
- **New guards**: `tests/ui.test.js` "on-player button, menu and toast use the same palette as the
  popup" reads the tokens out of `popup.css` and fails if the on-player styles drift again (it fails
  on the pre-1.4.9 file, 4 purple literals). It also fails if the button stops painting its icon as a
  background image or starts setting the `background` shorthand: it fails on the 1.5.0 file. A second
  test, "the product mark and the toolbar icons are the same everywhere", checks the shared path data
  in the three source files and reads each PNG's IHDR to confirm it is really the declared size.
- **1.4.7** measured on the real caption timeline of `H9yU-Y22vGI` at RTF 1.0: 12/61 sentences
  spoken before the overload fix, 30/61 after, sentences over 2s late 10 → 2, healthy server
  unchanged at 61/61. `docs/DUBBING.md` §SYNC holds the measured thresholds.

## State

- `npm test`: 324 tests, 323 pass, 0 fail, 1 skip · committed by path · Reload at
  `chrome://extensions`: **yes** (1.5.2)
- VieNeu: healthy, RTF ~0.23, `Interactive`, LaunchAgent loaded.

## Unfinished / in progress

- Nothing from 1.5.1 or 1.5.2 has been seen in place: the control-bar icon was proved as an injected
  element in a live page, and the toolbar / popup / Settings marks only as rendered PNGs and markup.
  The user has to reload the extension to confirm.
- Never reproduced live in the user's Chrome: a YouTube tab driven through the extension bridge
  reports `document.hidden = true` and the player stays at `readyState 0`, so playback never starts.
  Any measurement that needs a really playing video has to be run by the user.
- Alt+S / Alt+D end to end and the quick-menu voice picker are still unmeasured (user deferred).
- `docs/BACKLOG.md` has 8 open items, all needing the user's go-ahead first.

## Traps hit this session

- The sandbox blocks loopback TCP and refuses to start a local static server, and the preview pane
  cannot screenshot a `file://` page: there is no way from here to render a page for your own eyes.
  Assert on the CSS instead, and send the preview file to the user. That blind spot cost two
  releases: a static preview sized the icon with its own CSS, the real button did not.
- The way to check anything visual on YouTube: drive the page through the Chrome bridge, build the
  element with DOM calls (the page enforces Trusted Types, so `innerHTML` throws there), strip
  `ytp-autohide` from `#movie_player` to keep the control bar up, then `zoom` on its rectangle.
- Sweep constants, do not reason about them: three plausible dubbing guards measured as worthless
  or harmful in 1.4.7.

## Suggested next step

- Ask the user how the new menu looks on a video, or pick a `docs/BACKLOG.md` item.
