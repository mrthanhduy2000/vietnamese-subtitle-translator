# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lane B (`dub-speech.js`, `dub-prosody.js`, `dub-planner.js`, `dub-engine.js` key) + D
(tests, tools) · `1.8.0`. User brief: context-aware pronunciation, constituent prosody, cache identity.

## What changed
- Three-state name confidence (`CONF`), 5+ letter codes (no vowel + evidence only), `numberRole`
  (unit after a number wins), `constituents` (subject PP, short predicate + adjunct), gap tiers,
  `tokenMap`, cross-subtitle bridging (free voice, < 1.2 s), `PROSODY.signature` in the VieNeu key
  (`LOCAL_STYLE_VERSION` 11). Paid key unchanged (golden hashes). All in `DUBBING.md` "Context,
  constituents and cache identity (1.8.0)", with every number.
- New: `tests/speech-context.test.js`, `tools/syntax-eval.js`, `tests/blind-corpus.js` (unseen split
  written by a separate agent, frozen at 2b6b2db, scored once). pron-eval: `src`, `hold`, `--corpus`,
  ɜ-tone scorer fix. speech-ab: 64 KB pipe truncation fixed. "sam" respelled ("samh").

## State
- `npm test`: 477 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs. VieNeu re-renders once.
- Nobody has listened to 1.8.0; all numbers are proxies (phonemes, marks, same-take A/B).

## Unfinished / in progress
- `BACKLOG.md` 29: blind failures (Kim/Ken/Ben names, "phần trăm | so với", list "ảnh thẻ | và",
  "sáng | nên", short purpose clause length). Move into dev next round, then a NEW blind split by a
  separate agent. The current blind file is seen now.
- `BACKLOG.md` 26-28 (conservative misses, "So" read English by VieNeu, paid voice keeps group cuts).
- Carried over: `BACKLOG.md` 14, 15, 16 (subject without a marker), 18, 19, 20, 21-24; not heard by
  the user: 1.8.0, 1.7.8, 1.7.6, 1.7.5, 1.7.2 audio; 1.7.2 to 1.8.0 not verified end to end in real
  Chrome; 1.7.9 duck fix not confirmed by the user; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- Bash sandbox: `curl 127.0.0.1:8000` returns nothing and `$TMPDIR` differs from the unsandboxed
  one. Renders and git worktrees for A/B: sandbox off, absolute paths in the scratchpad.
- `~/.cache/cst-prosody-takes` had lost 4 of 6 sets: `prosody-eval` re-rendered 350 takes (~25 min).
- Never grep `tests/` with content output while a blind split is live (`--exclude=blind-corpus.js`).
- A test that times a "memo" pass must fit the memo (600 lines, cleared when full).

## Suggested next step
- Reload, dub an English video with names (Sam Altman, Tim Cook) and a talk with long subjects;
  listen for wrong English names on Vietnamese people first.
