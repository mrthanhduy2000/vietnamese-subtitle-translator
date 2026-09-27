# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lane B (+ D: `background.js` `speak` field, `manifest.json`, tests, tools) · `1.7.8`.
User asked for a deep speech / prosody / pronunciation upgrade, validated without manual listening.

## What changed
- New `dub-speech.js` (`CST_DUB_SPEECH`): English spans in Vietnamese text + what VieNeu is sent for
  them (`<en>` tags, respellings, "RTX 5 0 9 0", max 8 tags). Data block generated offline by
  `tools/build-speech-tables.js` from sea_g2p 0.9.1. `DUBBING.md` "English inside Vietnamese speech".
- VieNeu request has `text` (pauses) + `speak` (voice input); `speakScript` keys the cache;
  `LOCAL_STYLE_VERSION` 10 (every cached VieNeu line re-renders once). `DANGER.md` 14.
- `adaptForSpeech`: hyphenated identifiers with digits, versions after "iOS" read "chấm" (all voices).
- `dub-prosody.js`: spans are units; backlog-16 rules; "và" between two names bound.
- Tools: `vieneu-g2p.py`, `pron-eval.js`, `speech-ab.js`, `build-speech-tables.js`. Corpus
  `tests/speech-corpus.js` (dev 62 / validation 24 / unseen 24, fingerprint pinned). `speech.test.js`.

## State
- `npm test`: 465 tests, 464 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs
- Phonemes (pron-eval, vs 1.7.7): dev 68 -> 79/79, validation 18 -> 23/24, unseen 23 -> 28/29 (once).
- Real takes (speech-ab, same takes where text unchanged): forbidden pauses dev 14 -> 7, validation
  6 -> 1, unseen 1 -> 0; inside a span 0; clicks / clipping / runaway 0. Old prosody sets 26 -> 5.

## Unfinished / in progress
- `BACKLOG.md` 21-25 (respellings 44/66, phonemes not sound, RAM label, caps default, "để" pauses).
- "sam" held out of RESPELL until a new unseen split exists (u4 Sam Altman is the one unseen miss).
- Not heard by the user: 1.7.8 A/B WAVs (sent in chat), 1.7.6, 1.7.5, 1.7.2 audio.
- Carried over: `BACKLOG.md` 14, 15, 16 (PP inside a long subject), 18, 19, 20 (keep VieNeu resident).
- Not verified in real Chrome with the extension: 1.7.2 to 1.7.8 end to end, backup download,
  `ensureYtBridge`, 1.7.0 case. Prompts / context NOT trimmed. Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- The scratchpad take folders can vanish between runs: `tools/prosody-eval.js` then re-renders all
  520 takes (~10 min, sandbox off). `~/.cache` is not writable from the sandbox.
- A comment naming a Gemini model id fails `cost.test.js` (only `cost-policy.js` may).
- sea_g2p: 11+ `<en>` tags in one sentence corrupt it; `<en>` cannot make a Vietnamese syllable English.

## Suggested next step
- Reload; dub a video with brand names / acronyms (Mỹ Duyên), listen for IKEA, CPC, Tom Hanks.
