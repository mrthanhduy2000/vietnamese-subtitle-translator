# Backlog

Known defects and leftovers, found by audit, **not yet decided on**. None of these are currently
breaking anything the user has reported. Do not fix one as a drive-by: they touch settings and state,
so each deserves its own change and its own version bump. Ask the user first.

Add to this file whenever you find something out of scope for your task. Delete entries you fix.

## Defects

**1. `dubCondense` has four contradictory sources and no control.** There is no `#dubCondense`
element in `options.html`, yet `options.js` looks it up, defaults it to `true`, and would restore it
(all unreachable), while also hard-coding `dubCondense: false` in `collectSettings`. Separately
`dubbing.js` hard-codes `false` and `cost-policy.js` `MODES` sets `condense` per mode. The setting is
therefore permanently off via four independent mechanisms. Given the "never condense" rule this is
the *correct* behaviour reached the wrong way. Cleanup: pick one source, delete the other three.

**2. `popup.js` sends a message nobody handles.** `{ method: "setOptions", dubEnabled }` is sent to
the active tab, but no listener in `content.js` or `youtube.js` handles `setOptions`. Toggling
dubbing in the popup therefore relies entirely on the `storage.sync` write plus the
`storage.onChanged` path. Either handle it or stop sending it.

**3. `dualMode` is written in two places.** Both as a top-level `storage.sync` key and as
`subStyle.mode`, by the same `collectSettings` call, and read back from both. Two writers for one
piece of state, so they can disagree.

**4. The two bridge copies can drift.** See `DANGER.md` item 2. The inline fallback in `youtube.js`
lacks the XHR/fetch `pot` capture that the real `yt-bridge.js` has. Unify them or make the
difference explicit and tested.

**5. `glossary.js` exports on `window.` only.** Every other module in its group also exports via
`globalThis` and `module.exports`. The consequence is that the service worker and Node tests cannot
load the glossary at all, and its two consumers guard with `typeof ... !== "undefined"`. Adding the
two standard export lines would make it testable.

## Cosmetic / housekeeping

**6. The folder name says `v1.0.4`, the extension is `1.4.0`.** Renaming the folder means
re-running Load unpacked in Chrome, which creates a new extension id and **loses the stored API key
and settings**, so this is deliberately not done. Just do not trust the folder name.

**7. `vi-segmenter.js` `explain()` has no callers**, not even in tests, though it is in the public
api. It is a debugging aid; either use it in a test or drop it.

**8. Two stylesheets, same design tokens.** `options.html` carries ~810 lines of inline CSS while
`popup.css` is a separate 923-line file, and they duplicate the same tokens with nothing shared.

**9. `legacy/old-splitter.js` duplicates a large Vietnamese compound-word lexicon** that
`vi-segmenter.js` also maintains. This one is intentional (frozen baseline) and should stay, but be
aware the lexicon exists twice and only one copy is live.

## No version control history before 2026-09-23

`git init` was run on 2026-09-23 with the whole 1.4.0 tree as the first commit. Everything from
v1.0.4 to v1.4.0 has no per-release history. The original v1.0.4 zip sits at
`~/Downloads/vietnamese-subtitle-translator-v1.0.4.zip` if you ever need the true starting point.
`README.md` is the closest thing to a changelog for that period; `grep -n '^#' README.md` gives the
index.
