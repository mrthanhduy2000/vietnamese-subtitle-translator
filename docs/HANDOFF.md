# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-23 · lanes A + C · `1.6.0`. First live measurement in the user's Chrome after a Reload
(1.5.9 confirmed running). User's setup: **voice Kim Thanh, dark theme**.

## What changed

- Open quick menu hid the subtitle's line ends: `ytSideRoom` / `csSideRoom` (panel 404, menu 352)
  shift and narrow the overlay; `yt.menuOpen` / `cs.menuOpen` set on open and close.
- Transcript did not follow (list stuck at 0:02 at 8:20): row offset was measured from the panel,
  and the smooth scroll ran once. Now rechecked each tick, instant jump when far.
- Compounds: gần bằng, gần giống, xấp xỉ, tương đương với.
- Measured live, Kim Thanh, 8:25 to end, 13 sentences: 0 dropped; dense stretch peaks at rate 1.4 and
  1.9 s lag, recovered in ~10 s. Server has no speed knob (turbo ignores `speed`). Her 60 to 110 ms
  gaps between words were NOT cut: that is the closure of final stops, cutting would slur.
- Coursera seen live: button in the control bar, track hidden, own overlay, no floating circles.
- `docs/TESTING.md`: how to measure live (hidden tabs, `cstDubDebug`, Reload limits).

## State

- `npm test`: 349 tests, 348 pass, 0 fail, 1 skip · Reload: **yes** (1.6.0 not yet loaded)

## Unfinished / in progress

- Kim Thanh lags ~2 s at dense stretches; raising the rate caps is the only lever left and the user
  once complained about rushed speech. Needs their call, not a silent tweak.
- The remaining paraphrased leak on 4eY5DuqASQc around 8:40 adds to that lag.
- Plan stages 3 to 5 on hold (no new features). `docs/BACKLOG.md`: 8 open items.

## Traps hit this session

- claude-in-chrome tabs go hidden between calls; re-run `switch_to_tab` before every measurement.
- `requestVideoFrameCallback` stops in hidden tabs, so overlay reads there are stale, not a bug.

## Suggested next step
- User reloads; re-check the menu over a subtitle and transcript following at 8:20 on 4eY5DuqASQc.
