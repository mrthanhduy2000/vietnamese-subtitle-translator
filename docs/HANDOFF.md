# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-23 · lanes B + C · `1.6.2`. User: add an on/off for the second voice (unsure viewers want a
second voice cutting in), keep fixing subtitles and voice. Setup: **Kim Thanh, dark theme**.

## What changed

- `dubSecondVoice` (default **false**): `DubEngine.oneVoice(script)` sets every speaker to S1 after
  `buildDubScript` (also in `audioKeysForVideo`). Settings checkbox in the dubbing card hides both
  "người nói thứ hai" pickers when off; a change restarts the engine (dubbing.js listener).
  Existing users who had two voices now get one until they tick the box: intended, per the user.
- Live measurement of 1.6.1 (video pace + look-ahead) on 4eY5DuqASQc, Kim Thanh: peak lag
  1.88 -> 0.43 s, overrun 1.76 -> 0.42 s, top rate unchanged ~1.4, none dropped.
- Looked at and kept: a chained continuation starting 0.8 s early then ending 2.8 s before its cue.
  Chaining avoids a pause mid-sentence; the silence moving to the sentence end is the intended trade.

## State

- `npm test`: 351 tests, 350 pass, 0 fail, 1 skip · Reload: **yes** (1.6.2 not yet loaded)

## Unfinished / in progress

- `this.pace` is not cleared on hardReset (re-read within 2 s anyway).
- A paraphrased leak on 4eY5DuqASQc (~8:40) still adds speech there.
- Plan stages 3 to 5 on hold (no new features beyond what the user asks). `docs/BACKLOG.md`: 8 items.

## Traps hit this session

- A long in-page `await` loop (> 45 s) times out the claude-in-chrome call: poll in 20 s chunks.
- Automation tabs play audio aloud in the user's Chrome; pause and close them when done, and remove
  the `cstDubDebug` flag from youtube.com localStorage.

## Suggested next step
- User reloads and ticks/unticks the new box once to confirm the Settings wiring in the real page.
