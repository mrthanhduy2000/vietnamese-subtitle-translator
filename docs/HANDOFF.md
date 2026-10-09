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
- Backup + undo: `~/VieNeu-Backups/2026-10-10-before-pinned-model/RESTORE.md`, git tag
  `backup/before-pinned-model-2026-10-10` (local).

## State
- Tests: 657 pass, 0 fail, 1 skip. No runtime file changed: no bump, no Reload.
- Offline proof: sandbox, network cut, Mỹ Duyên 5 sentences, RTF 0.22 to 0.34; real server
  `POST /v1/audio/speech` 3.68 s of speech in 1.04 s.
- The user looked at the old PUBLIC repo `mrthanhduy2000/translator` (09-18, MIT, not this project)
  and thought GitHub was not updated. This project = PRIVATE `vietnamese-subtitle-translator`.
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
- `snapshot_download(revision="main")` then assert the sha: a sha revision writes no `refs/main`,
  and offline lookups of `main` then fail.
- Writes in `~/VieNeu-TTS` and `~/Library/LaunchAgents` need the sandbox off.

## Suggested next step
- If the user approves BACKLOG 42: Release assets + sha check in both installers, then the CI
  install test on all 5 machines before `publish-share.js --push`.
