# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-10 · `2.5.0` (no bump) · VieNeu model pinned on the author's machine.

## What changed
- `~/.cache` model was deleted by **diskguard** on 10-06 (it cleans `~/.cache` daily under 40 GB
  free); the server lived only on open handles of deleted files. Now pinned: `~/VieNeu-TTS/models/hf`
  (580 MB, `61b85e3` + MOSS `ceff0d0`, 15/15 sha256 = Hugging Face LFS), LaunchAgent and
  `cst-start.command` set `HF_HOME` + `HF_HUB_OFFLINE=1`. Ready in 2.0 s, 0 network requests.
- `tools/share/vieneu-model.json`: the pin (files, sizes, hashes, voices file). `tools/vieneu-pin.py`
  checks it offline (exit 1 on any byte off; `--fetch` rebuilds). `tests/share.test.js` guards the pin
  and its VieNeu commit. README's VieNeu section rewritten (pinned commit, patch, pinned model).
  `docs/DUBBING.md` "Pinned model": Mỹ Duyên = 266 numbers in the VieNeu code. BACKLOG 42.
- Undo: `~/VieNeu-Backups/2026-10-10-before-pinned-model/RESTORE.md`, tag `backup/before-pinned-model-2026-10-10`.

## State
- Tests: 657 pass, 0 fail, 1 skip. No runtime file changed: no bump, no Reload.
- Proof: network cut, Mỹ Duyên 5 sentences RTF 0.22-0.34; real server 3.68 s speech in 1.04 s.
- The user mistook the old PUBLIC repo `translator` (09-18, not this project) for this one.
- **A push to the share repo reaches every friend within ~6 h.** Publish only when the user says
  "cập nhật cho bạn bè", and only with the install test green.

## Unfinished / in progress
- BACKLOG 42 (ship the pinned model to friends as Release assets): pros/cons given, user said
  "test first"; not approved yet. Do not touch the share repo until they say so.
- Carried: 2.5.0 Coursera start hold not yet seen live in the user's Chrome. Not covered by CI: a
  missing VC++ runtime, the Chrome steps, a real Vietnamese user profile. The user has not tried the
  second voice since 2.4.8. Voice items for the user's ear ("có nghĩa là", DN, NHNN). Never ask
  about Apple Events JS.

## Traps hit this session
- `launchctl kickstart -k` after editing a plist keeps the **old** environment (it re-downloaded
  into `~/.cache`). Use `launchctl bootout` + `bootstrap`; check with `launchctl print`.
- `ls ~/.cache/huggingface` empty while `lsof` shows the server reading it = files deleted under it.
- Download with `revision="main"`, then assert the sha: a sha revision writes no `refs/main`.
- Writes in `~/VieNeu-TTS` and `~/Library/LaunchAgents` need the sandbox off.

## Suggested next step
- If BACKLOG 42 is approved: Release assets + `vieneu-pin.py` checks in both installers, CI green.
