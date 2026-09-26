# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-26 · lane A (`content.js`, `dubbing.js`) + C (`popup.js`, `options.js`) + D
(`background.js`, `manifest.json` description) · `1.6.5`. User: stage 5, multi-site support. User
has no Udemy/edX account and no sample pages: build for any site, not for named ones.

## What changed

- 1.6.5 generic video pages: any http(s) page, injected on demand only (popup Translate or a
  shortcut grants `activeTab`; `background.js` `injectGenericPage`). Runs the Coursera track path:
  biggest `<video>`, `<track>` elements plus script-added `textTracks`, floating button + frame over
  the picture when no control bar is found, native fullscreen shows the track. Full write-up:
  `docs/SUBTITLE.md` §Generic. Verified live on `tests/harness/generic.html` (both track kinds).
- 1.6.4 (same day): backlog 1-4 + 6 fixed, dub plan rebuild 13.1 -> 3.9 ms, throttled observers.

## State

- `npm test`: 368 tests, 367 pass, 0 fail, 1 skip · Reload: **yes** (1.6.5 not yet loaded)

## Unfinished / in progress

- Not verified in real Chrome: generic injection from the popup/shortcut, `ensureYtBridge` after a
  Reload, dubbing on a generic page, native fullscreen. Harness covered display + translation only.
- Udemy (DOM captions) and edX (cross-origin iframe) need site sources: `BACKLOG.md` item 9.
- Not measured live: jank on a long video while translating (`longtask`; costs a little Gemini).
- A paraphrased leak on 4eY5DuqASQc (~8:40) still adds speech there.
- Plan stages 3 and 4 on hold (`~/.claude/plans/jiggly-sparking-milner.md`; stage 4 needs no new
  permission, `activeTab` + `scripting` are in the manifest).

## Traps hit this session

- Harness pages need `chrome.runtime.id` set after `chrome-shim.js`, or the liveness poller marks
  the script dead and nothing is drawn. The hidden browser pane also stops rAF: call `csRender()`.
- Udemy course previews have no captions and no text tracks, so they cannot serve as samples.

## Suggested next step
- Reload, then on any page with a captioned `<video>` press Alt+S; check button, subtitle, dubbing.
