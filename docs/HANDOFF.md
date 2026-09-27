# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · lane B (`dub-prosody.js`, `dub-speech.js`) + D (`tools/build-speech-tables.js`, corpora,
tests) · `1.9.5`. User: "listen for real", fix backlog; VieNeu server started by this session.

## What changed
- BACKLOG 30 / 21 on real takes: 4 prosody rules (DUBBING.md "1.9.5"), syntax3 wrong stops 13 -> 1,
  other sets unchanged; RESPELL long/pi/ray/mae + identity may/bin/son/do; LEX Long Beach etc.
  Blind 2 no longer blind for its moved items. A/B WAVs were sent to the user in chat.
- Trap fixed in method: `prosody-eval` OLD= shares the new prosody module; compare versions in
  separate directories (`git archive HEAD | tar -x -C dir`, run the tool there).
- 1.9.4 backlog/debt, 1.9.3 ads, 1.9.2 duck owner, 1.9.1 liveStalled, 1.9.0 onPlayFailed.

## State
- Tests: 552 pass, 0 fail, 1 skip (run `scripts.test` directly; `npm test` in the sandbox pings the
  registry). Reload: **yes** + F5 video tabs. Audio keys change for lines whose pauses or English
  spans changed (re-rendered, free). Simulator output unchanged.

## Unfinished / in progress
- 1.8.6 to 1.9.5 not watched on a real YouTube video: seek back and forth, pause/resume, 2x.
  `localStorage.cstDubDebug = "1"` shows `delivery` in `<html data-cst-dub>`.
- `BACKLOG.md` 33 (server near real time still chases) is open.
- Carried over: glossary keep-English vs Vietnamese per term not yet watched in Chrome (ask the user
  after a lecture or two); nobody compared real Gemini output before/after 1.8.3/1.8.4;
  `BACKLOG.md` 30 (k5, Vinamilk, blind split 3), 31, 14-16, 18-24, 26-28 (20 lives outside);
  the user's verdict on the 1.9.5 A/B WAVs; 1.7.2 to 1.9.5 not verified end to end in real Chrome;
  1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- Another session may run in this folder (it swept a half-written file into b51c446, and its static
  server on :8765 disappears when it ends): commit your own paths, restart `static` if needed.
- The `bgEnv` fake fetch ignores abort signals: check `signal.aborted` yourself before a send.
- The bump carries at 9: 1.8.9 -> 1.9.0, not 1.8.10. Name versions in comments after bumping.

## Suggested next step
- Watch one video with dubbing on, seek into the middle of lines and rewind a few minutes; open
  one in a fresh tab without clicking (play-blocked badge?); sit through one ad (silent, no subs?).
