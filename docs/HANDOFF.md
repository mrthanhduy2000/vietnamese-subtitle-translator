# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-30 · `2.3.6` review round 6, from the user's first live video on 2.3.2+ (lanes A, B, D).

## What changed
- Live check of 2.3.2-2.3.5 on AF6MSemog7Y (00:09-00:18): cut lines worked (43 `midLine` groups,
  0 quality flags, 0 leaks, 0 head repeats), empty term lists swept, VieNeu log clean (84 renders,
  warm first line 254 ms after 8 h 47 min idle), 15 Gemini calls, 0.0073 USD.
- `splitCuesAtSentenceEnds`: a sentence start in a line's last word or two (word times give it
  under 0.3 s: 13 of 56 lines kept whole live) moves to the next line (within 1 s, no `>>`), `midLine`.
- `ytCanonicalWindows`: hard limits hold before `midLine` groups too. Runs of them (up to 26) had
  made windows of 3,075 chars / 142 s, past the prefetch horizon (49 of 105 over, 0 of 150 now).
- `buildDubScript` `opts.spoken` (engine passes its last spoken segment): a segment that played
  never grows. A group arriving while the segment before it played was carried into it and never
  read, a bug since 1.6.7 (late windows on AF6: 18-38 words lost on 2.3.5, 4-24 now, 0 twice).
- `playback-sim.js`: a batch arrives when its last group is in reach (as the prefetch sends);
  `wordsLost` / `wordsTwice` columns. Backlog 40 declined; the `pot` reuse decline is in `DANGER.md` §1.

## State
- Tests: 619 pass, 0 fail, 1 skip. Reload: **yes** for 2.3.6 (`chrome://extensions`).

## Unfinished / in progress
- Not verified live: the voice reading "...at home. I feel..." in one breath (the user's ear), "có
  nghĩa là", DN and NHNN read Vietnamese (2.2.4); the 2.3.6 cut and windows on a new video.
- Carried over: AI Studio vs cost card over one full Pacific day; the live harness (`?script=stress`,
  `viewer2`) is the user's to run; "Chép chẩn đoán" right after a problem. Never ask about Apple
  Events JS or hand decisions back (memory).
- Fast talkers with Mỹ Duyên: 24-30% of lines start >0.5 s late (known limit, quicker voices).

## Traps hit this session
- The simulator counted lines, so a line that grew after playing hid a word loss for months: judge
  voice changes on `wordsLost` too. Arrival must follow the prefetch (a window's last group).
- Freezing a played segment must keep pieces up to its end, or a carry made before it played comes
  apart and is read twice (`pastSpoken` checks start and end).
- Word times are not in the cache: model them (last word ~0.2 s) to measure cuts. Price is 0.25 /
  1.50 USD per M tokens in / out (ledger), not 0.10.

## Suggested next step
- After a Reload: a new punctuated YouTube video with the voice on; then dump it and compare.
