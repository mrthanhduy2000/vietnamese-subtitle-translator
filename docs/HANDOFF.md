# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lane A (`content.js`, `youtube.js`, `context-engine.js`) + D (`tools/context-eval.js`,
tests) · `1.8.3`. User asked: audit what context Gemini 3.1 Flash-Lite gets, fix losses, zero API spend.

## What changed
- Coursera `translateAllGroups`: two workers walk contiguous halves (was turn about, so no request
  ever carried `prevTranslation`: 6/6 missing -> 1/5). Short tail window merged (7 -> 6 calls).
- YouTube prefetch waits for the previous window unless the window starts within 20 s; short tail
  merged in `ytCanonicalWindows`. Missing previous translation 3 -> 1 on the corpus.
- `senseHintsFor`: no `general` fallback ("point" misled on "at this point"), duplicate values dropped.
- Prompt, model policy, cache key, retry, TTS untouched. `SUBTITLE.md` "Previous translation in context".
- No API call of any kind this session.

## State
- `npm test`: 497 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs. Cached translations still hit
  (key unchanged) except a lecture's last window where a short tail now merges.
- Measure: `node tools/context-eval.js` (`--root <git archive dir>` for before/after).

## Unfinished / in progress
- `BACKLOG.md` 32: context gaps left on purpose, nothing checked against real Gemini output.
- Carried over: `BACKLOG.md` 30 (blind 2 failures -> dev, then blind split 3), 31 (purpose clause
  feel, ask the user after listening), 14, 15, 16, 18, 19, 20, 21-24, 26-28; 1.7.2 to 1.8.3 not
  verified end to end in real Chrome; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- A fake translator must echo `[[__T0__]]` placeholders, or `requestUnit` resends every window
  unprotected and request counts double. A fake text in "balanced" mode also triggers refine passes.
- Arrays from a `vm` context fail `deepEqual` (other realm): `JSON.stringify` inside the context.
- `npm test` prints a sandbox registry warning; harmless, tests run offline.

## Suggested next step
- Reload, open a Coursera lecture and a YouTube talk with names and pronouns; in the console
  (`CST_LAST_AI_INFO`) or by reading, check pronouns and terms stay consistent across window edges.
