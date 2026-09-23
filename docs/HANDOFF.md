# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-23 · lanes A + B, `player-ui.js` · `1.6.3`. User: find and fix limitations and bugs, make the
system smoother, make the UX nicer and smoother. Setup: **Kim Thanh, dark theme**.

## What changed

- Jank: `refresh` planned the whole video on every new group (~90 ms main thread on 60 min). Now a
  planning window (`SYNC.planStep/planBehind/planAhead`), speaker parity via
  `PLAN.speakerStateBefore`. Worst tick 97 -> 16 ms, plans 668 -> 96. Test proves windowed plans equal
  whole-video plans (ids, text, speaker, continuesNext) with the second voice on.
- Leak: `releaseOld` skipped audio whose plan vanished; now frees it (test).
- `hardReset` clears `this.pace`.
- Motion: `kit.dismiss(el)` (exit animation, instant under reduced motion or without matchMedia);
  menu pop-in, panel slide-in, overlay transform/max-width transitions. Menu lookups skip an element
  marked `data-cst-leaving`, so a quick re-click opens a new menu.
- `CST_TRANSCRIPT.mergeLines` is memoised on (arrays, lengths, rev); `invalidate()` and an in-panel
  save bump rev.

## State

- `npm test`: 354 tests, 353 pass, 0 fail, 1 skip · Reload: **yes** (1.6.3 not yet loaded)

## Unfinished / in progress

- Not yet measured live: jank with a long video while it translates (PerformanceObserver
  `longtask` on a real page would show it). Needs a new, long video, so it costs a little Gemini.
- A paraphrased leak on 4eY5DuqASQc (~8:40) still adds speech there.
- Plan stages 3 to 5 on hold. `docs/BACKLOG.md`: 8 open items.

## Traps hit this session

- A memo keyed on array identity goes stale when cues are edited in place: every in-place edit
  path must call `CST_TRANSCRIPT.invalidate()` (CST_EDITS.notify does).
- Old tests with regex spans around `menu.remove()` break when the removal line changes; widen them.

## Suggested next step
- After reload: long-task measurement on a long lecture while translating, and a console error sweep.
