# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · cost card: `background.js`, `cost-policy.js`, `options.html` / `options.js`,
`popup.html` / `popup.js` (2.1.3); dubbing: `dub-prosody.js` `BREATH`, `tests/prosody.test.js`,
`dub-audio.js`, `dub-engine.js`, `background.js` (D, `breath` field), tests, docs (2.1.5-2.1.9) · `2.1.9`.

## What changed
- 2.1.0 to 2.1.1: ledger charges every billed request (`policy.onBilled`), `costHistory` by Pacific day.
- 2.1.3: currency (`FX`, `money`), late answers replace estimates (`policy.onLate`, 120 s), KPI tiles.
- 2.1.5 / 2.1.6: `BREATH` 0.35 / 18, `minSide` 6, `longRun` 26 / `longValue` 0.1. Takes by the user's
  Terminal (`$TMPDIR/br/ab2.js`, CUR / CAND json of texts from `$TMPDIR/br/texts.js <repo>`).
- 2.1.7: `breathText` fallback: a 15+ run with no comma takes its best boundary >= 0.35; all 184
  sentences as sent (920 takes): RAN-ON 39/365 -> 9/365, WRONG 1 -> 1, +0.2% length.
- 2.1.8: breathing commas shaped as breaths (`breathAdded`, request `breath`, `K.breathKeep`):
  same stops, mean kept 0.23 -> 0.21 s, -0.3% length. `LOCAL_STYLE_VERSION` not bumped.
  2.1.9: `fallbackRun` 14; all 184 as sent: RAN-ON 6/365 (the rest is left on purpose, DUBBING §3).
- Duck: 2.1.2 `duckAttackTicks` 4; 2.1.4 (code in 2.1.3) `nextVoiceAt` counts a take still being
  made (`next.pending`, bridge only): slow-matrix pumps 197 -> 8, delivery identical.

## State
- Tests: 580 pass, 0 fail, 1 skip. Reload: **yes** (`chrome://extensions`).
- Not heard by ear yet: duck changes 2.0.8 to 2.1.4, breath commas 2.1.5 to 2.1.9.
- `~/.cache/cst-prosody-takes` rebuilt by the user 13:55 (920 takes, plain text, no breath commas).

## Unfinished / in progress
- User to compare the card with AI Studio; still far off: key shared elsewhere, or BACKLOG 37.
- BACKLOG 16: verbs outside the list. BACKLOG 7: user's call.
- Carried over: the live harness (`?script=stress`, `viewer2`) needs the local server; the user
  said yes, but the classifier blocks it here, so the user runs it or adds a permission rule;
  "Chép chẩn đoán" right after a problem; BACKLOG 36; glossary keep-English per term not watched
  in Chrome; BACKLOG 30, 31, 14-15, 18-24, 26, 28; verdict on the 1.9.5 A/B WAVs; Udemy / edX
  (BACKLOG 9); a live YouTube check by the user (Apple Events JS: off again, 2026-09-29).

## Traps hit this session
- Two sessions in one tree: each commit swept in the other's files twice (cbcc311, 68d9ebd). Stage
  by path, and check `git status` and the manifest version just before a bump.

## Suggested next step
- Compare the card's Google-day table with AI Studio for one day; a YouTube listen of 2.1.5.
