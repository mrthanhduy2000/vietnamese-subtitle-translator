# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · lane B (`dub-prosody.js`) + D (corpora, tests, docs) · `1.9.6`. User: "listen for real",
fix backlog; VieNeu server started by this session and left running.

## What changed
- 1.9.6 BACKLOG 16: `PRED_VERBS` + `predVerbAt` (DUBBING.md "1.9.6"). syntax4 real takes: WRONG
  9 -> 3, MISSED 6/20 -> 0/20; all eight other sets identical. New test fails on 1.9.5, passes now.
- BACKLOG 27 probed with 8 separators on the real voice: VieNeu limitation, written down, not fixable
  without changing words (forbidden).
- 1.9.5 prosody/names, 1.9.4 backlog/debt, 1.9.3 ads, 1.9.2 duck owner, 1.9.1 liveStalled.

## State
- Tests: 553 pass, 0 fail, 1 skip (run `scripts.test` directly; `npm test` in the sandbox pings the
  registry). Reload: **yes** + F5 video tabs. Audio keys change for lines whose pauses changed
  (re-rendered, free). Simulator output unchanged.

## Unfinished / in progress
- 1.8.6 to 1.9.6 not watched on a real YouTube video: seek back and forth, pause/resume, 2x.
  `localStorage.cstDubDebug = "1"` shows `delivery` in `<html data-cst-dub>`.
- `BACKLOG.md` 33 (server near real time still chases) is open.
- Carried over: glossary keep-English vs Vietnamese per term not yet watched in Chrome (ask the user
  after a lecture or two); nobody compared real Gemini output before/after 1.8.3/1.8.4;
  `BACKLOG.md` 30 (k5, Vinamilk, blind split 3), 31, 14-15, 18-24, 26, 28 (20 lives outside);
  the user's verdict on the 1.9.5 A/B WAVs; 1.7.2 to 1.9.6 not verified end to end in real Chrome;
  1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- `prosody-eval` OLD= shares the new prosody module: compare versions in separate directories
  (`git archive HEAD | tar -x -C dir`, copy the new corpus in, run the tool there).
- Another session may run in this folder: commit your own paths, restart `static` if needed.
- The bump carries at 9: 1.8.9 -> 1.9.0, not 1.8.10. Name versions in comments after bumping.

## Suggested next step
- Watch one video with dubbing on, seek into the middle of lines and rewind a few minutes; open
  one in a fresh tab without clicking (play-blocked badge?); sit through one ad (silent, no subs?).
