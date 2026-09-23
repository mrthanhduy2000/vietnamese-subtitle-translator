# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched

2026-09-23 · lane A (`youtube.js`, `content.js`) plus a test in lane D · version `1.5.0`. Before
this: 1.4.7 the dubbing overload fix, 1.4.8 the language cleanup, 1.4.9 the on-player redesign.

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
- **1.5.0, the button was empty on the real page.** The inline mark carried no `width`/`height`, so
  it had no intrinsic size and the button rendered as a bare terracotta square. The button now has
  its own icon, `CST_BTN_ICON_SVG`: a speech bubble with the brand mark inside, which still reads at
  17px next to YouTube's own icons. Both SVG constants now declare `width="100%" height="100%"`.
- **New guards**: `tests/ui.test.js` "on-player button, menu and toast use the same palette as the
  popup" reads the tokens out of `popup.css` and fails if the on-player styles drift again (it fails
  on the pre-1.4.9 file, 4 purple literals), and it now also fails if either SVG constant loses its
  size, which is exactly the 1.4.9 bug.
- **1.4.7** measured on the real caption timeline of `H9yU-Y22vGI` at RTF 1.0: 12/61 sentences
  spoken before the overload fix, 30/61 after, sentences over 2s late 10 → 2, healthy server
  unchanged at 61/61. `docs/DUBBING.md` §SYNC holds the measured thresholds.

## State

- `npm test`: 323 tests, 322 pass, 0 fail, 1 skip · committed by path · Reload at
  `chrome://extensions`: **yes** (1.5.0)
- VieNeu: healthy, RTF ~0.23, `Interactive`, LaunchAgent loaded.

## Unfinished / in progress

- **The 1.5.0 button icon has not been seen on a real video.** The user confirmed the 1.4.9 menu
  looks right on YouTube but caught the empty button there; the replacement icon was only checked in
  a static preview built from the real code.
- Never reproduced live in the user's Chrome: a YouTube tab driven through the extension bridge
  reports `document.hidden = true` and the player stays at `readyState 0`, so playback never starts.
  Any measurement that needs a really playing video has to be run by the user.
- Alt+S / Alt+D end to end and the quick-menu voice picker are still unmeasured (user deferred).
- `docs/BACKLOG.md` has 8 open items, all needing the user's go-ahead first.

## Traps hit this session

- The sandbox blocks loopback TCP and refuses to start a local static server, and the preview pane
  cannot screenshot a `file://` page: there is no way from here to render a page for your own eyes.
  Assert on the CSS instead, and send the preview file to the user. That blind spot is what let the
  sizeless SVG ship: a static preview sized the icon with its own CSS, the real button did not.
- Sweep constants, do not reason about them: three plausible dubbing guards measured as worthless
  or harmful in 1.4.7.

## Suggested next step

- Ask the user how the new menu looks on a video, or pick a `docs/BACKLOG.md` item.
