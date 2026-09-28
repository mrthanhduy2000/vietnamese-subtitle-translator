# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · `docs/BACKLOG.md`, `docs/HANDOFF.md`, deleted `tools/vieneu-fast-release.patch` ·
still `1.9.9`, no bump (no runtime file changed).

## What changed
- The user **declined** BACKLOG 37 (the VieNeu "release the slot at once" server patch). Entry
  removed, patch file deleted, a "Declined" line in BACKLOG says never to re-add or re-propose it.
- Why, for the record: `~/VieNeu-TTS/server.log` over 7 days showed 27 watchdog releases in 7979
  takes (~4 a day, each up to 4-5 s of wait, ~2 min a week). The 1787 -> 917 s figure came from an
  artificial 828-hiccup harness. The full gain also needed `background.js` to abort eagerly on seek,
  the fragile path in `DANGER.md` §15.

## State
- Tests: 0 fail (see the commit). Reload: not needed (docs only).
- `~/VieNeu-TTS` is untouched by this session: it still runs CST patch 1 only. Its untracked
  `apps/openai_speech.py.cst-before-fast-release` is an identical backup left by the 1.9.9 session.

## Unfinished / in progress
- Carried over from the 1.9.9 session: 1.9.9 not yet watched live; next time ask the user for
  "Chép chẩn đoán" right after a problem.
- Carried over: BACKLOG 36, 38; glossary keep-English per term not watched in Chrome; real Gemini
  output before/after 1.8.3/1.8.4 not compared; BACKLOG 30, 31, 14-15, 18-24, 26, 28 (20 outside);
  the user's verdict on the 1.9.5 A/B WAVs; 1.7.9 duck fix not confirmed; Udemy / edX (BACKLOG 9).
- The user should turn Chrome's "Allow JavaScript from Apple Events" back off.

## Traps hit this session
- A scratch-harness win can look large; check `server.log` for how often the case really happens
  before proposing a change (`grep -c "released a stream slot idle" ~/VieNeu-TTS/server.log`).

## Suggested next step
- A live check of 1.9.9 on a fast talk with the diagnostics button. Small safe fix if wanted:
  BACKLOG 38, count "entered too late" drops in `stats.dropped`.
