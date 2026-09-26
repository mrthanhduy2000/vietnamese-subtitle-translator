# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lane B (+ `background.js`, `cost-policy.js`) · `1.7.2`. User: Mỹ Duyên cleaner and
steadier (noise, rumble, clicks, loudness) and smarter pauses (clauses, sentence length, joins).

## What changed

- 1.7.2 (details and numbers: `DUBBING.md` "Cleanup and pauses v3"): `AUDIO.cleanTake` = 4th-order
  high-pass (`LOCAL_TTS.highPassHz` 80 female / 60 male via `localHighPass`) + `denoise` with a
  corrected noise estimate (mean over pure-hiss frames, bias 1.3); `gateNoise` off the VieNeu path;
  `textBreaks` soft breaks before clause openings of long sentences, sentence pause by length;
  positions in spoken syllables from first to last sound; 20 ms onset for voiced starts;
  engine `gapAfter` / `SYNC.joinGapClause` 0.15 after a part ending on , ; :. Style version 7.
- Measured, left alone: per-take loudness (LUFS sd 0.2 to 0.3 dB), soft clipper, DC, 48 kHz, EQ.

## State

- `npm test`: 408 tests, 407 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs (not loaded)
- Harness `smooth.html`, same takes, 120 s Mỹ Duyên, old -> new: 24/24 spoken, 0 rate changes,
  0 overlaps both; median rate 1.11 -> 1.08; start lag p50 -0.04 both, max 0.68 -> 0.81 s.

## Unfinished / in progress

- The user has not listened yet: A/B files `MyDuyen-1.7.1.wav` / `MyDuyen-1.7.2.wav` were sent.
- A subordinate clause with no comma and no connective ("Khi ... lên | mô hình ...") still has its
  stop closed; only connectives in `STARTERS*` are detected. Watch for false soft breaks.
- "Truyền cảm" (expressiveness) not solved: VieNeu takes no prosody control, ignores `speed`.
- Not verified in real Chrome with the extension loaded: 1.7.2 end to end, backup download,
  generic injection, `ensureYtBridge` after Reload, 1.7.0 AI-dub case (no sample video found).
- Udemy / edX: `BACKLOG.md` 9. Long-video jank unmeasured. Leak on 4eY5DuqASQc ~8:40.

## Traps hit this session

- The sandbox blocks loopback: `curl 127.0.0.1:8000` exits 7 while VieNeu is up. Retry unsandboxed.
- `npm test` runs an explicit file list in `package.json`: a new test file must be added there.
- The browser JS tool times out after 45 s: poll `H.done` in the harness, never await the run.

## Suggested next step
- Reload; listen to a long Mỹ Duyên lecture: clause pauses natural? any pause in a wrong place?
