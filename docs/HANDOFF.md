# Handoff (2026-10-16, cut off by the usage limit: committed as work in progress, NOT bumped)

## State
- Version is still 2.5.2: this work is committed unfinished and unbumped; bump to 2.5.3 when done. `npm test`: 707 pass,
  0 fail, 1 skip after the last edit. `tools/regress.js` not saved (14 worse numbers explained in
  the work: fewer segments from SEG_STRETCH, 2 tiny gaps, +2/+4 voice switches). Not bumped.
- Done in this work (dub-planner, dubbing, background, dub-engine, tests): prompt 2, cut-off
  answer salvage (`upTo`) and continuation, `last` speaker per part, labels with affiliation,
  `findAt` across lines, `afterSentenceTail`, label-position voice cuts, TURN_CUTS, SEG_STRETCH,
  8 voices, debug snapshot `speakers`/`speakerRead`. Harnesses: tests/harness/speaker-lab, yt-watch,
  yt-driver (never run; it toggles sync `dubEnabled`).
## Found live (yt-watch on JBvcMfa7K6E): the AI reading never reached the engine
- Cause 1: askSpeakers timeout 12 s + 0.4 ms/char = 22.5 s for a 900-line part; the call was
  dropped (billed anyway). Fixed: 15 s + 0.4 ms/char + 4 ms per output token of the cap (<=120 s).
- Cause 2 (open): on that 900-line part the model lists a turn on almost EVERY line: 16,368 output
  tokens (MAX_TOKENS) for 55-58 kept turns at temperature 0 and 1; 10,799 tokens for 104 kept at
  0.5. A 645-line part answered normally. readSpeakerAnswer drops same-speaker turns, so this is
  pure cost (~$0.025 a part). Parts are now even (1289 = 645 + 644, dubbing.js `size`).
- Next: run lab `p4jb` then `p4` (prompt forbidding same-speaker turns, in
  lab-data/speaker-lab-runs.js), score with /tmp/claude-501/lab/eval.js vs `v2`; adopt it as
  prompt 3 (bump SPEAKER_PROMPT_VERSION) only if quality holds. `SPEAKER_TEMPERATURE` stays 0
  unless a lab run shows 1.0 is better (Google advises 1.0 for Gemini 3; it did not stop this).
- The lab now mirrors production: debug answers carry `usage`, `finish`, `raw` (when capped);
  runs take `temperature` and `fixed` parts. The lab cost ledger is `lab:<id>`.
- Then: yt-watch JBvcMfa7K6E again (expect speakerRead "read", voices > 1), docs (DUBBING "Who
  speaks", SUBTITLE analyzeSpeakers `last`/`lab`/`upTo`, TESTING harnesses, MAP), BACKLOG leftovers
  (17 cuts inside a phrase; 71 mid-line turns missed on recognizer captions; long podcasts miss the
  turn back after short interjections; translation also runs Gemini 3 below temperature 1.0),
  version-history 2.5.3 entry, bump, regress --save, commit own paths, push, share --stage/--promote.
- Budget: today's extension spend ~0.97 of 1.15 USD at the cut.
## Carried over (still open)
- Joint-takes branches; the 2.5.0 Coursera start hold not yet seen live.
- CI gaps: VC++ runtime, browser steps, a Vietnamese Windows profile.
- Voice items: "có nghĩa là", DN, NHNN. BACKLOG 43. ban-giao.md does not mention the share repo.
- Never ask the user about Chrome's Apple Events setting.
