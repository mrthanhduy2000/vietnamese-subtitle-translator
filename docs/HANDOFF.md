# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-30 · `2.3.8` full check (lane A, plus `content.js` term storage), acting on round 7.

## What changed
- Round 7 workflow `wf_d12e8ea3-347` died at the session limit (241 raw translation findings, no
  synthesis, no engineering lens): synthesized by hand from its result file.
- `fixSoundNotes`: a `[Âm nhạc]` inside a sentence is removed (10 lines in 5 of 21 cached videos),
  so is ">>" when the source has it (kept in 5 of 27). Cached videos are repaired on load.
- `context-engine.js` `PHRASES`: 51 everyday hints first ("in my 20s", "dresser", "go viral",
  "declutter", "let go of"...), 74 fires on the cached videos, at most 6 in a window.
- YouTube channel term lists need `v: 2` (`YT_TERMS_STAMP`): the 6 stored ones were learned before
  2.3.0 ("Whole Foods = thực phẩm hữu cơ") and re-saved by every later video. A term whose
  Vietnamese is a glossary placeholder is never stored.

## State
- Tests: 623 pass, 0 fail, 1 skip. Reload: **yes** for 2.3.8 (`chrome://extensions`).
- Checked and clean: the 2.3.6/2.3.7 diff; the 6 videos watched after 2.3.7 (0 refine flags, 0
  words lost in `playback-sim --real`, 1-8 late starts each); storage 1.4 MB of the 10 MB quota.

## Unfinished / in progress
- Not measured live: whether Gemini follows the new hints. Not done: a performance profile of a
  35-minute video (needs the browser, not the simulator).
- Not verified live: the voice reading "...at home. I feel..." in one breath (the user's ear), "có
  nghĩa là", DN and NHNN read Vietnamese (2.2.4).
- Carried over: AI Studio vs cost card over one full Pacific day; the live harness (`?script=stress`,
  `viewer2`) is the user's to run; "Chép chẩn đoán" right after a problem. Never ask about Apple
  Events JS or hand decisions back (memory).
- Fast talkers with Mỹ Duyên: 24-30% of lines start >0.5 s late (known limit, quicker voices).

## Traps hit this session
- Decided against, do not redo: a system-prompt rule for dropped hedges and stiff register (no
  offline way to compare, and a longer answer costs the voice time); segmenter changes for 3
  compound splits in 444 groups ("dây | thần kinh"); "no." as an abbreviation (0 cases in the cache).
- `$TMPDIR/yt` keeps dumps of videos already swept from storage: 21 files, 15 live keys.
- krPKW8J6JSM, zPSs9a0MYGw: 1 dropped line each in the simulator, cached groups predate 2.3.7.

## Suggested next step
- One new everyday video on 2.3.8, then dump the cache and read the hinted phrases ("in my 20s").
