# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · lanes A (`youtube.js`), B (`dub-engine.js`, `cst-cache.js`), D (`tools/doc-sizes.js`,
tests), docs incl. `CLAUDE.md` · `1.9.4`. User asked: fix backlog and debt.

## What changed
- BACKLOG 10 fixed (`ytSaveAfterRefine`: a late refine reaches `ytcache4_`); 12 measured in real
  Chrome IndexedDB (1,000 meta records 5.4 ms) and closed; `evict`/`remove` no longer rescan. Stale
  fixed entries 17, 32, 34 deleted; 11, 13, 28 marked paid-voice-only.
- `stop()` / `forgetRendered()` release elements (`releaseAudio`), not just pause.
- Debt: `CLAUDE.md` sizes, SYNC anchor, lanes (+7 unlaned files), test-count note; `MAP.md` sizes via
  new `tools/doc-sizes.js` (`--check` exits 1 when off). Run it when a file grows a lot.
- 1.9.3 ads, 1.9.2 duck owner, 1.9.1 `liveStalled`, 1.9.0 `onPlayFailed`, 1.8.9 worker races.

## State
- Tests: 552 pass, 0 fail, 1 skip (run `scripts.test` directly; `npm test` in the sandbox pings the
  registry). Reload: **yes** + F5 video tabs. No cache key changed. Simulator output unchanged.

## Unfinished / in progress
- 1.8.6 to 1.9.4 not watched on a real YouTube video: seek back and forth, pause/resume, 2x.
  `localStorage.cstDubDebug = "1"` shows `delivery` in `<html data-cst-dub>`.
- `BACKLOG.md` 33 (server near real time still chases) is open; 32 and 34 are fixed.
- Carried over: glossary keep-English vs Vietnamese per term not yet watched in Chrome (ask the user
  after a lecture or two); nobody compared real Gemini output before/after 1.8.3/1.8.4;
  `BACKLOG.md` 30, 31, 14-16, 18-24, 26-28 (prosody/pronunciation need listening; 20 lives
  outside); 1.7.2 to 1.9.4 not verified end to end in real Chrome; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- Another session may run in this folder (it swept a half-written file into b51c446, and its static
  server on :8765 disappears when it ends): commit your own paths, restart `static` if needed.
- The `bgEnv` fake fetch ignores abort signals: check `signal.aborted` yourself before a send.
- The bump carries at 9: 1.8.9 -> 1.9.0, not 1.8.10. Name versions in comments after bumping.

## Suggested next step
- Watch one video with dubbing on, seek into the middle of lines and rewind a few minutes; open
  one in a fresh tab without clicking (play-blocked badge?); sit through one ad (silent, no subs?).
