# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-26 · lane B (`dub-audio.js`, `dub-planner.js`, `dub-engine.js`) + D (`background.js`,
`cost-policy.js`) · `1.6.7`. User: VieNeu stops where there is no punctuation; Thục Đoan rough;
optimise Thục Đoan and Mỹ Duyên; make pausing smart.

## What changed

- 1.6.7: pauses follow the text's punctuation (`AUDIO.shapePauses`), no comma at source pauses in
  `plainScript`, `joinGroups` for free voices, `gateNoise` on gaps, VieNeu at 48 kHz,
  `LOCAL_STYLE_VERSION` 4 (all VieNeu audio re-renders once). Measurements: `docs/DUBBING.md`.
  A/B wavs were sent to the user (scratchpad, not in the repo).
- Same day: 1.6.6 settings backup + `dubMaxRate` + `skipSameLang`; 1.6.5 generic video pages;
  1.6.4 backlog fixes and faster planning.

## State

- `npm test`: 380 tests, 379 pass, 0 fail, 1 skip · Reload: **yes** (1.6.7 not yet loaded)

## Unfinished / in progress

- Waiting on the user's ear: are the A/B samples better, is 0.09 s joint / 0.26 s comma right?
  Knobs are the `shapePauses` options (`joinPause`, `commaPause`, `breathEvery`).
- Not verified in real Chrome: backup download, generic injection, `ensureYtBridge` after Reload,
  dubbing on a generic page, native fullscreen, and 1.6.7 end to end on a video.
- Udemy (DOM captions) and edX (cross-origin iframe) need site sources: `BACKLOG.md` item 9.
- Not measured live: jank on a long video while translating (`longtask`; costs a little Gemini).
- A paraphrased leak on 4eY5DuqASQc (~8:40) still adds speech there.
- Plan stages 3 and 4 on hold (`~/.claude/plans/jiggly-sparking-milner.md`).

## Traps hit this session

- The roughness proxy is harmonicity of the worst 10% of voiced frames (autocorrelation, 40 ms);
  compare stretch *drops* on the same take, never absolute values across takes or sample rates.
- Browser audio capture works in the hidden pane (`createMediaElementSource` + ScriptProcessor);
  keep each `javascript_exec` under ~40 s of playback.
- Loopback to the VieNeu server (127.0.0.1:8000) needs the sandbox off.

## Suggested next step
- Reload, play a lecture with Thục Đoan, listen at a fast passage and at unpunctuated clauses.
