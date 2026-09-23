# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-23 · lane B + tests · `1.6.1`. User asked: make Kim Thanh adapt to whether the video speaks
fast or slow. User's setup: **voice Kim Thanh, dark theme**.

## What changed

- `dub-engine.js`: `videoPace` / `planNeed` / `paceLimits` (constants in `SYNC`: paceWindow,
  paceFloorShare, paceCeilingMax, paceCeilingPad, maxSpokenSps, lookAhead, lookAheadEarly) and a
  look-ahead ramp in `chooseRate`. Details and numbers in `docs/DUBBING.md` §SYNC "Video pace".
- `engine.health()` returns `pace`; `describeHealth` adds "người nói nhanh, đọc nhanh theo".
- Two old pacing tests in `tests/hardening.test.js` encoded the fixed 1.3/1.4 ceiling; updated to
  the new cap (pace-based, <= 1.55/1.65, <= 5.8 syl/s). Their "never ahead of the subtitle" check
  caught the first version of the look-ahead (a sentence ended 0.96 s early), hence lookAheadEarly.
- New test "slow voice on a fast speaker" compares with the old behaviour by toggling SYNC
  (fast timeline: max lag 4.21 -> 1.76 s; slow timeline identical).

## State

- `npm test`: 350 tests, 349 pass, 0 fail, 1 skip · Reload: **yes** (1.6.1 not yet loaded)

## Unfinished / in progress

- Not yet heard or measured live. Next: reload, open 4eY5DuqASQc at 8:25 with `cstDubDebug`, compare
  `started` with the 1.6.0 live numbers (peak lag 1.88 s, rate 1.4).
- The paceWindow median is recomputed every 2 s; a seek far ahead reads a fresh window at once
  (plans near t), but nothing clears `this.pace` on hardReset. Harmless for now, worth a look.
- A paraphrased leak on 4eY5DuqASQc (~8:40) still adds speech there.
- Plan stages 3 to 5 on hold (no new features). `docs/BACKLOG.md`: 8 open items.

## Traps hit this session

- Simulations need the sandbox off only for the VieNeu server, not for `sim-kim.js` (pure Node).
- `ytcache4_*` was re-extracted read-only from the LevelDB log and the copy deleted afterwards.

## Suggested next step
- User reloads; measure live as above, with Kim Thanh.
