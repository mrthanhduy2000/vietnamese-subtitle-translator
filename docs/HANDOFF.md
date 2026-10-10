# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-11 · `2.5.0` (no bump yet) · IN PROGRESS: model in friends' installs, smoother voice, debt.

## What changed
- Merged `model-in-installers`: `tools/vieneu-pin.py --install` fetches the 15 pinned model files
  from a GitHub Release of the share repo (fallback: Hugging Face at the pinned revision), checks
  sha256, writes `models/hf/.pinned-ok`; start scripts go offline only behind that marker; the
  updater keeps the model current; CI steps; NOTICE + Apache license in the share build.
- The author's machine got its marker (`--install --no-hf`, 0 MB downloaded).
- Probe 2026-10-11: with developer mode ON, `chrome.runtime.reload()` keeps the extension enabled
  with its storage (2/2); the earlier "blocked" result was a developer-mode-off profile.

## State
- Tests: 665 pass, 0 fail, 1 skip on main. No runtime file changed yet.
- Measurements (agents, 2026-10-11): pace jumps come from line-to-line rate choices and each take's
  own pace; temperature 0.5-0.8 makes no difference; take edges/loudness clean; Chrome's stretch is
  fine, the amount of stretch is what Mỹ Duyên costs (floor 1.108, never 1.0).
- **A share repo push reaches every friend within ~6 h**: only with the install test green.

## Unfinished / in progress
- Workflow `wf_8790e534-b0a` builds 4 local branches: `installer-fixes` (15 review issues),
  `smooth-pace` (SYNC smoothing, lagRest, pre-warm, duckBridge 2.5, "--" as comma), `joint-takes`
  (a sentence split across two takes rendered in one request), `debt-sweep` (Windows hints, popup
  status, cache sweep, manifest permissions, docs). Then: review, merge, regress `--save`, bump,
  publish the model release, push the share repo, CI green on 5 machines.
- BACKLOG 42 is not done until the release exists and friends run it (the branch marked it closed).
- The user asked that every update reach Chrome (Reload) and both repos; writing that into
  `.claude/commands/ban-giao.md` was refused (classifier: self-modification); the user decides.
- Carried: 2.5.0 Coursera start hold not seen live; not covered by CI: missing VC++ runtime, the
  Chrome steps, a real Vietnamese profile; second voice untried since 2.4.8; voice items ("có nghĩa
  là", DN, NHNN). Never ask about Apple Events JS.

## Traps hit this session
- `launchctl kickstart -k` after editing a plist keeps the **old** environment: bootout + bootstrap.
- Workflow worktrees live in `.claude/worktrees/` (excluded in `.git/info/exclude`): never `git add` them.
- A fresh Chrome profile has developer mode off: any reload then disables an unpacked extension.

## Suggested next step
- Finish the list under "Unfinished" in that order.
