# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-16 · `2.5.2` · voices per speaker by default, any Chromium browser, staged share publish.

## What changed
- Who speaks (`DUBBING.md` "Who speaks"): `dubSpeakers` "auto" (default) / "one" replaces
  `dubSecondVoice`; up to 5 voices (named speakers ranked by talk); `nameOf` fix ("Yeah. NAME:");
  Gemini reading on YouTube (`analyzeSpeakers`, `dubSpeakerAi`, cheapest callable model, cached);
  `castVoices` S1..S5 by gender; takes carry `voiceTag` and are remade when a line changes voice.
- Installs: guide page and installers pick any Chromium browser (Chrome, Cốc Cốc, Edge, Brave, Opera,
  Vivaldi, Arc); updater waits for the browser that holds the extension; Settings opens at
  `#welcome` after a first install; VieNeu patch listens on 127.0.0.1 unless `HOST` is set.
- `publish-share.js --stage` (push to `staging`, install test runs) then `--promote` (to `main` only
  when that run passed). READMEs rewritten (both repos).
- `playback-sim.js` no longer trims groups 200 s behind playback (real drivers pass the whole list).

## State
- Tests: 701, 700 pass, 0 fail, 1 skip. Regress baseline saved at 2.5.2; `simulate` now runs voices
  per speaker: only the 5 conversations moved vs one voice (late +3 to +29, yZfh median lag
  0.85 -> 1.18 s), nothing dropped or lost.
- Share repo: see "Unfinished" for the publish step.
- **A share repo push reaches every friend within ~6 h**: only `--promote` after a green staging run.

## Unfinished / in progress
- Share publish of 2.5.2: `--stage` then `--promote` (BACKLOG 42 closes when it is on `main`).
- Not seen live: the Gemini speaker reading (try JBvcMfa7K6E, X4gL2OWg3V4 with the user's key and
  read the cost ledger); a 3+ speaker video by ear; the extension in Cốc Cốc / Edge / Brave.
- Branches `joint-takes` and `joint-takes-2` (worktrees in `.claude/worktrees/`) built, never
  reviewed or merged.
- Carried: 2.5.0 Coursera start hold not seen live; not covered by CI: missing VC++ runtime, the
  browser steps, a real Vietnamese profile; voice items ("có nghĩa là", DN, NHNN); BACKLOG 43 (Edge
  startup boost holds updates). `ban-giao.md` does not mention the share repo (self-edit refused;
  the user decides). Never ask about Apple Events JS.

## Traps hit this session
- A group list cut from the front swaps anonymous turns back and forth; with `voiceTag` every swap
  remakes takes (yZfh: 108 unplayed). Never pass the engine a windowed `getGroups()`.
- `gh` inside the sandbox fails TLS (OSStatus -26276): run it with the sandbox off.
- zsh does not split an unquoted `$VAR` of paths: use an array.

## Suggested next step
- Promote the share build if not done, then the live checks above.
