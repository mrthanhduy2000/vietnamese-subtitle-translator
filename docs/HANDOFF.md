# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-10 · `2.5.0` (no bump) · VieNeu model pinned on the author's machine.

## What changed
- **diskguard** deleted the `~/.cache` model on 10-06. Now pinned in `~/VieNeu-TTS/models/hf` (580 MB,
  sha256 = Hugging Face), server on `HF_HOME` + `HF_HUB_OFFLINE=1`: ready in 2.0 s, no network.
- Pin `tools/share/vieneu-model.json`, check `python3 tools/vieneu-pin.py`, guard `tests/share.test.js`,
  README VieNeu section, `docs/DUBBING.md` "Pinned model", BACKLOG 42.
- Undo: `~/VieNeu-Backups/2026-10-10-before-pinned-model/RESTORE.md`, tag `backup/before-pinned-model-2026-10-10`.
- `npm test` 40 -> 23 s: four late-answer tests in `hardening.test.js` run the worker at `LATE_SCALE`.
- `docs/DANGER.md` §3: how to click Reload for the user (`developerPrivate.reload`, probed headless).

## State
- Tests: 657 pass, 0 fail, 1 skip. No runtime file changed: no bump, no Reload.
- Perf 10-10: server RTF 0.23 (6 runs), first audio median 198 ms, 1.27 GB RAM; `regress.js` 0 moved;
  45 videos: 7748 lines, 0 dropped, 0 words lost, 23% late (BACKLOG 41, declined). Chrome was closed.
- Old PUBLIC repo `translator` (not this project) archived with a pointer; the user had mistaken it.
- **A share repo push reaches every friend within ~6 h**: only with the install test green.

## Unfinished / in progress
- The user asked that every update also reach Chrome (Reload) and both GitHub repos. Writing it
  into `.claude/commands/ban-giao.md` was refused (classifier: self-modification); the user decides.
- BACKLOG 42 (ship the pinned model to friends as Release assets): pros/cons given, user said
  "test first"; not approved yet. Do not touch the share repo until they say so.
- Carried: 2.5.0 Coursera start hold not yet seen live in the user's Chrome. Not covered by CI: a
  missing VC++ runtime, the Chrome steps, a real Vietnamese user profile. The user has not tried the
  second voice since 2.4.8. Voice items for the user's ear ("có nghĩa là", DN, NHNN). Never ask
  about Apple Events JS.

## Traps hit this session
- `launchctl kickstart -k` after editing a plist keeps the **old** environment (it re-downloaded
  into `~/.cache`). Use `launchctl bootout` + `bootstrap`; check with `launchctl print`.
- Download with `revision="main"`, then assert the sha: a sha revision writes no `refs/main`.
- Writes in `~/VieNeu-TTS` and `~/Library/LaunchAgents` need the sandbox off.
- Reload probe: a fresh profile has developer mode off, and reload then DISABLES the extension.

## Suggested next step
- If BACKLOG 42 is approved: Release assets + `vieneu-pin.py` checks in both installers, CI green.
