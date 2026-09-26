# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-26 · lanes A + B + D (touched `background.js`, `options.js`, `cost-policy.js`) · `1.6.4`.
User: fix the backlog, then find and optimise more in audio + subtitles.

## What changed

- Backlog 1: condensing has one switch (`condense: null` in `dubbing.js`); `dubCondense` key and
  `MODES[*].condense` are gone. Backlog 2: `dualMode` is the source of truth,
  `CST_STYLE.resolveDual` reads it (subStyle.mode only as fallback). Real bug it fixed: popup wrote
  `dualMode` alone, Coursera then let a stale `subStyle.mode` win; YouTube OR-ed the two, so turning
  bilingual off in the popup did nothing. Backlog 3: inline bridge copy deleted; `ensureYtBridge`
  route executeScripts `yt-bridge.js` in MAIN; the list request re-posts every 600 ms. Backlog 4:
  glossary exports to globalThis/module. Backlog 6: `explain()` now has a test.
- Perf (measured, `planAll` output byte-identical on a 60-min lecture): plan rebuild of 80 groups
  13.1 -> 3.9 ms via memo of `isVietSyllable`, `tokenSyllables`, `buildPhrases` (copies out),
  incremental `markSpans`, opener/left phrase sets hoisted. Body-wide button observers in
  `youtube.js`/`content.js` throttled to 150 ms (leading + trailing). New `tests/backlog.test.js`.

## State

- `npm test`: 363 tests, 362 pass, 0 fail, 1 skip · Reload: **yes** (1.6.4 not yet loaded)

## Unfinished / in progress

- Not verified live: `ensureYtBridge` (open a video, Reload the extension, translate without F5).
- Not yet measured live: jank with a long video while it translates (PerformanceObserver
  `longtask`). Needs a new, long video, so it costs a little Gemini.
- A paraphrased leak on 4eY5DuqASQc (~8:40) still adds speech there.
- Plan stages 3 to 5 on hold (`~/.claude/plans/jiggly-sparking-milner.md`; stage 4 needs no new
  permission any more, `activeTab` + `scripting` are already in the manifest). BACKLOG: items 5, 7, 8 left (deliberate / cosmetic).

## Traps hit this session

- Benchmark old vs new with `git worktree add $TMPDIR/base HEAD`; remove it afterwards.
- `reload-fight.test.js` stubs `setTimeout`/`requestAnimationFrame` as no-ops: any throttle on the
  button observer must run on the leading edge or that test never sees the work.

## Suggested next step
- After reload: the bridge check above, then the long-task measurement on a long lecture.
