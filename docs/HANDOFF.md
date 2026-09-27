# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lanes B + D (+ A: `vi-segmenter.js` exports `UNITS`) · `1.7.6`. User: deep redesign of
the pause / rhythm engine, measure, A/B on the same takes, listen, never condense, no API calls.

## What changed

- New `dub-prosody.js` (pure): gap values from the segmenter, roles and pause lengths, a dynamic
  program choosing which of the voice's stops to keep, breathing commas, cut values. Replaces
  `textBreaks` / keyword lists / the 4.5 s breath. `DUBBING.md` "Prosody model" has the numbers.
- `dub-audio.js`: `alignStops` (anchored interpolation) + `shapePauses` on the model. Engine:
  `plainScript` adds breathing commas (VieNeu only), `gapAfter(plan, next)`, `LOCAL_STYLE_VERSION` 9.
  Planner: `prosodicCut` (free voice only). Load order: after `dub-planner.js` everywhere.
- Tests: `prosody.test.js` (21), `prosody-corpus.js` (104 marked sentences), `tools/prosody-eval.js`.

## State

- `npm test`: 442 tests, 441 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs (not loaded)
- Unseen set (holdout3): WRONG 4 -> 6, both mild; severe (inside units) 11 -> 0 over all sets.

## Unfinished / in progress

- Not heard by the user: 1.7.6 A/B WAVs, 1.7.2 audio, 1.7.5 A/B (scratchpad, sent in chat).
- `BACKLOG.md` 14 (Coursera waits for a refine), 15 to 19 (prosody leftovers, alignment, no
  blind listening). All four marked sets are seen now: write new sentences before the next check.
- Not verified in real Chrome with the extension: 1.7.2 to 1.7.6 end to end, backup download,
  `ensureYtBridge`, 1.7.0 case. Fonts host permissions kept (need that check before removal).
- Prompts / context NOT trimmed. "Truyền cảm" not solved. Udemy / edX (`BACKLOG.md` 9). Long-video
  jank unmeasured. Leak on 4eY5DuqASQc ~8:40.

## Traps hit this session

- The voice is not deterministic: judge a pause rule on several takes, A/B on the **same** take.
- The sandbox blocks loopback: run VieNeu scripts unsandboxed. zsh does not word-split `$var`.
- A new test file is not in `npm test` until it is added to the list in `package.json`.
- Segmenter cost quirks ("kể cả | khi"): correct the cost in `dub-prosody.js`, never add a trigger.

## Suggested next step
- Reload; dub a lecture with Mỹ Duyên and listen to long sentences: pauses at clause joins only.
