# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-23 · lanes A + B, one prompt line in `background.js` · `1.5.8`. User: no new features, only
improve subtitles and the voice. Everything below was measured on real data first.

## What changed

- `dub-planner.js` `adaptForSpeech`: numbers, money, K/M/B, versions, ordinals, decades, links, #,
  2x. Checked against VieNeu's own normalizer (how to run it: `docs/DUBBING.md` §Speech text).
  The old code turned 1.500.000 into 1500000, which the server reads digit by digit.
- `vi-quality.js` `trimContextLeak`: cuts a translation tail that repeats the next units (the model
  translated its context). Wired into Coursera, YouTube live and YouTube cache load. Prompt line added;
  `TR_PROMPT_VERSION` deliberately not bumped (would re-bill every cached translation).
- `vi-segmenter.js` `straddleCost` 45 + missing compounds (tủ đồ, trào lưu, bày biện, bất cứ...).
- Real data: two cached videos parsed read-only from Profile 42's `Local Extension Settings`
  LevelDB log. 347 cues: straddles 38 -> 7, >25 cps 16 -> 7, >30 cps 8 -> 1, duplicated text 257 -> 0.

## State

- `npm test`: 344 tests, 343 pass, 0 fail, 1 skip · `npm run compare`: 0 violations · Reload: **yes**

## Unfinished / in progress

- A paraphrased leak is not caught (one clause remains in the measured case). Not fixable without
  alignment to the source; do not loosen the thresholds, 0 false positives on 105 groups now.
- Reading speed: 7 cues still exceed 25 cps; the speech itself is that dense.
- Plan stages 3 to 5 on hold: the user asked for no new features.
- 1.5.1 to 1.5.8 not yet seen in the shipped build (tests, probes, headless renders only).
- `docs/BACKLOG.md`: 8 open items needing the user's go-ahead.

## Traps hit this session

- Storage LevelDB: only a `.log` file; parse 32 KB blocks, 7-byte record headers, write batches.
- Shell: generate test code from a file script, not `node -e` with Vietnamese quotes inline.
- Control_Chrome JS fails; claude-in-chrome works. Headless Chrome renders need the sandbox off.

## Suggested next step
- User reloads and rewatches video 4eY5DuqASQc around 8:30 (the leak) to hear the fix.
