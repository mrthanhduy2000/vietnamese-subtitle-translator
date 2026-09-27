# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lane C (`options.*`) + B (`dubbing.js`) + D (`cost-policy.js`, `background.js`, tests)
· `1.8.1`. User asked: switch off the paid Gemini voice, VieNeu only.

## What changed
- `cost-policy.js` `PAID_TTS = false`; `dubbing.js` VieNeu only, no fallback, waits for the server;
  service worker refuses non-local TTS (`errorType: "disabled"`); Settings lists VieNeu only;
  `dubProvider` forced to "vieneu" once (`dubProvider181`). `DUBBING.md` "The three TTS providers".
- Gemini TTS code and tests kept: harnesses set `PAID_TTS = true`; 2 new tests check the shipped state.
- 1.8.0 (same day, previous commit): context-aware names, constituent pauses, see `DUBBING.md`.

## State
- `npm test`: 479 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs. VieNeu re-renders once.
- If the VieNeu server is down there is now no voice at all until it starts (by design).
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
