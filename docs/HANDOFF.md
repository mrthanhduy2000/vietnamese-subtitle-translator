# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · AI Studio check (docs only) · cost: `background.js`, `cost-policy.js`, `options.js`, `tests/hardening.test.js`
(2.2.0-2.2.1); dubbing: `dub-prosody.js` `BREATH`, `tests/prosody.test.js`,
`dub-audio.js`, `dub-engine.js`, `background.js` (D, `breath` field), tests, docs (2.1.5-2.1.9) · `2.2.1`.

## What changed
- Cost 2.1.0-2.2.0: every billed request charged (`onBilled`/`onLate`), Pacific-day history,
  currency, late answers cached (`lateAnswerKeeper`). 2.2.1: `countPromptTokens` (countTokens) makes a lost answer's prompt exact (`countedCalls`);
  `lateOpened` keep-alive; `COST.priceOf` for typed ids (`how` exact/variant/family/unknown).
- 2.1.5-2.1.9 breathing commas (`BREATH`, `breathText` fallback, `fallbackRun` 14): all 184 as sent
  RAN-ON 39/365 -> 6/365 (rest on purpose, DUBBING §3). Takes via `$TMPDIR/br/ab2.js` in the user's Terminal.
- Duck 2.1.2-2.1.4: `duckAttackTicks` 4; `nextVoiceAt` counts a take still being made (slow pumps 197 -> 8).

## State
- Tests: 583 pass, 0 fail, 1 skip. Reload: **yes** (`chrome://extensions`).
- Live check 2.1.9 done (DUBBING.md "Live check"): no defect found. Not heard by ear yet.

## Unfinished / in progress
- AI Studio checked 2026-09-29 (Usage + Spend, 28 days): only the extension's models appear (3.1
  Flash Lite, 3.5 Flash Lite, 2.5 Flash TTS), one key. The one hour both cover matches: Google
  Sep 28 12:00 PT 4 requests = card's 28/09 row, 4 calls. Google's Sep 28 total (256 req) is larger
  because the card's history began mid-day. Net charges only Sep 18-19 (paid TTS, pre-1.8.1). Next
  real check: a full Pacific day recorded after Chrome is reloaded (Chrome still ran 2.1.9).
- Card says "Model đang dịch: 2.5 Flash-Lite" when the key's 404 mark (`ACCESS_TTL_MS`, 3 days)
  has lapsed; the next call pays one 404 round trip, then 3.1. Cosmetic; not fixed, ask the user.
- BACKLOG 16: verbs outside the list. BACKLOG 7: user's call.
- Carried over: the live harness (`?script=stress`, `viewer2`) needs the local server; the user
  said yes, but the classifier blocks it here, so the user runs it or adds a permission rule;
  "Chép chẩn đoán" right after a problem; BACKLOG 36; glossary keep-English per term not watched
  in Chrome; BACKLOG 30, 31, 14-15, 18-24, 26, 28; verdict on the 1.9.5 A/B WAVs; Udemy / edX
  (BACKLOG 9); a live YouTube check by the user (user: switch Apple Events JS off again after the live check).

## Traps hit this session
- Two sessions in one tree: each commit swept in the other's files twice (cbcc311, 68d9ebd). Stage
  by path, and check `git status` and the manifest version just before a bump.

## Suggested next step
- After a Reload, compare one full Pacific day (card vs AI Studio Usage); a YouTube listen of 2.1.5.
