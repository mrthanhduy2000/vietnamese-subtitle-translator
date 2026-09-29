# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `2.3.5` whole-product review, rounds 4 and 5 (2.3.2 to 2.3.5, lanes A to D).

## What changed
- YouTube caption lines are cut at a sentence end inside them (`splitCuesAtSentenceEnds`): groups
  ending mid-sentence 112 -> 11 of 316, windows on a fragment 64 -> 1; window caps 8/12 groups (+6%
  requests). No window ends before a `midLine` group; the free voice reads across that cut as
  before (`dub-planner.js`, simulated late starts 87, 124 if closed). Cache: 6th group field.
- Quality check: no false severity-3 flags (6 -> 1 of 531 lines); `localFixes` before `assessAll`.
- `playback-sim.js`: `unplayedGen` fixed (241 of 882 real takes miscounted), `batch`, `realGroups`.
- 2.3.3: Settings polled `/health` + `/v1/models` every 5 s for hours (user's `~/VieNeu-TTS/server.log`,
  renders healthy), 30 s once running (2.3.4: first check in a background tab too); popup says
  "video" off Coursera; empty terms swept.
- 2.3.5: transcript rows and the bilingual .srt list each source line once (English was 45% longer
  than the video's). Measured, fine as is: segmenter cuts, main-thread costs, subtitle text.

## State
- Tests: 617 pass, 0 fail, 1 skip. Reload: **yes** for 2.3.5 (`chrome://extensions`).

## Unfinished / in progress
- Not verified live (the classifier blocks Claude on the local server; the user's next YouTube
  listen is the check): the 2.3.2 cut on a new video and its voice (cached videos keep their old
  groups; the simulation cut cached Vietnamese, not the English line), the warm-up after a long
  idle, "có nghĩa là", DN and NHNN read Vietnamese (2.2.4).
- Carried over: AI Studio vs cost card over one full Pacific day; the live harness (`?script=stress`,
  `viewer2`) is the user's to run; "Chép chẩn đoán" right after a problem. Never ask about Apple
  Events JS or hand decisions back (memory).
- Fast talkers with Mỹ Duyên: 24-30% of lines start >0.5 s late (known limit, quicker voices).

## Traps hit this session
- Judge a dub change on syllables lost to drops, not only lines: carrying every finished sentence
  cut late starts 17% but its drops lost 52 syllables instead of 29 (declined, `DUBBING.md`).
- Simulate from `realGroups` (repairs applied as on load): raw cached groups keep leaked text.
  Give groups `batch` for window-by-window arrival. The browser pane is a hidden tab.
- Never reuse a captured `pot` for another video: it is YouTube's per-video attestation.

## Suggested next step
- After a Reload: a new punctuated YouTube video, voice on ("...at home. I feel..." in one breath).
