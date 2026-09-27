# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-28 · lane B (`dub-engine.js`) + D (tests, `tools/playback-sim.js`, harness, `.claude/launch.json`)
· `1.9.7`. User: "fix" the two open items (real-player check, BACKLOG 33). VieNeu left running.

## What changed
- BACKLOG 33: speed estimate fixed (overhead fitted, store answers and seek leftovers counted right)
  + `crowdsNext` (DUBBING.md "1.9.7"). Sim matrix 144 runs: spoken 2025 -> 2141, worst recovery 34
  -> 24.6 s; every standard scenario but seekWhileSlow identical. 5 new tests, all fail on 1.9.6.
- New live harness `tests/harness/live.html` + `live-server.js` (TESTING.md): real engine, real
  background.js, real VieNeu, scripted seek/pause/2x/ad. Healthy server: 33 lines, 0 errors, 0 overlap.
- 1.9.6 predicate verbs, 1.9.5 prosody/names, 1.9.4 debt, 1.9.3 ads, 1.9.2 duck owner.

## State
- Tests: 556 pass, 0 fail, 1 skip (run `scripts.test` directly; `npm test` in the sandbox pings the
  registry). Reload: **yes** + F5 video tabs. Audio keys unchanged.

## Unfinished / in progress
- Not yet on a real YouTube page in Chrome Profile 42: the live harness covers the engine + worker,
  not `dubbing.js` / `youtube.js` wiring (badge, ad class, player volume). Needs subtitles already
  translated or cached: a new video calls Gemini, which the user forbids in these sessions.
- New `BACKLOG.md` 35: a line cut by an ad resumes at the video's place (skips unheard words).
- Carried over: glossary keep-English vs Vietnamese per term not yet watched in Chrome (ask the user
  after a lecture or two); nobody compared real Gemini output before/after 1.8.3/1.8.4;
  `BACKLOG.md` 30 (k5, Vinamilk, blind split 3), 31, 14-15, 18-24, 26, 28 (20 lives outside);
  the user's verdict on the 1.9.5 A/B WAVs; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- A "fix" can win on one scenario and lose elsewhere: run the matrix (DUBBING.md "1.9.7"), not one
  sim. Skipping queued rtf samples looked right in a trace and cost 25 s recovery in the matrix.
- The VieNeu server has no CORS: a page cannot call it; `live-server.js` proxies through background.js.
- `.claude/launch.json` is write-protected from Bash in the sandbox: use the Edit tool.
- `prosody-eval` OLD= shares the new prosody module: compare versions in separate directories.

## Suggested next step
- On a video whose subtitles are cached: dubbing on, seek, pause, 2x, sit through an ad.
