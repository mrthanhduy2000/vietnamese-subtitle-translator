# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `2.3.3` whole-product review, round 4 (2.3.2 and 2.3.3, lanes A to D).

## What changed
- YouTube caption lines are cut at a sentence end inside them (`splitCuesAtSentenceEnds`): groups
  ending mid-sentence 112 -> 11 of 316, windows on a fragment 64 -> 1; window caps 8/12 groups (+6%
  requests). No window ends before a `midLine` group; the free voice reads across that cut as
  before (`dub-planner.js`, simulated late starts 87, 124 if closed). Cache: 6th group field.
- Quality check: no false severity-3 flags for addresses, loanwords, sound notes, non-Latin sources
  (6 -> 1 of 531 cached lines, each a paid refine); `localFixes` runs before `assessAll`.
- `playback-sim.js`: `unplayedGen` fixed (241 of 882 real takes were miscounted), `batch` groups
  arrive together, `realGroups` exported. `SUBTITLE.md`, `DUBBING.md`, `TESTING.md` updated.
- 2.3.3: Settings polled `/health` + `/v1/models` every 5 s for hours (user's `~/VieNeu-TTS/server.log`,
  renders healthy there), now 30 s once running; popup says "video" off Coursera; empty terms swept.

## State
- Tests: 616 pass, 0 fail, 1 skip. Reload: **yes** for 2.3.3 (`chrome://extensions`).

## Unfinished / in progress
- Not verified live (the classifier blocks Claude on the local server; the user's next YouTube
  listen is the check): the 2.3.2 cut on a new video and its voice (cached videos keep their old
  groups; the simulation cut cached Vietnamese, not the English line), the warm-up after a long
  idle, "có nghĩa là", DN and NHNN read Vietnamese (2.2.4).
- Carried over: AI Studio vs cost card, compare one full Pacific day after a Reload; the live
  harness (`?script=stress`, `viewer2`) is the user's to run; "Chép chẩn đoán" right after a problem.
  Never ask about Apple Events JS or hand decisions back (memory).
- Fast talkers with Mỹ Duyên (3.8 syllables/s): 24-30% of lines start >0.5 s late (dSEZriz716g,
  zPSs9a0MYGw, simulated). Known limit; quicker voices are suggested.

## Traps hit this session
- Judge a dub change on syllables lost to drops, not only lines: carrying every finished sentence
  cut late starts 17% but its drops lost 52 syllables instead of 29 (declined, `DUBBING.md`).
- Simulate from `realGroups` (repairs applied as on load): raw cached groups keep leaked text, which
  invented drops. Give groups `batch` for window-by-window arrival.

## Suggested next step
- After a Reload, a new punctuated YouTube video with the voice on ("...at home. I feel..." reads
  as one breath), and a full Pacific day of the cost card.
