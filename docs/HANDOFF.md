# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-30 · `2.3.7` review round 7 (lane A), from the user's two new videos on 2.3.6.

## What changed
- Live check of 2.3.6 on H6k6I__93JM (10 min, 05:51) and krPKW8J6JSM (35 min, 06:03-06:37): no
  line left whole at an inner sentence end, 0 quality flags / leaks / head repeats, windows within
  limits (max 768 chars, 45 s), VieNeu 349 renders (simulator: 348), 1 slow, no errors.
- `groupCuesIntoSentences`: a sentence's short last piece (<= 40 chars, <= 2 s) joins its group
  past the 24 s / 520 char / 12 cue limits (by up to 3 s / 40 chars); only a pause closes before
  it. The 24 s limit had closed a group 0.16 s before "mind." (krPKW8J6JSM, 1900.64 s): the model
  put 29 syllables there, the voice fell 6 s behind and dropped the next line. Changes 2 groups on
  the 16 videos, both crammed ones (the other: zPSs9a0MYGw, 15 syllables on 1.72 s).

## State
- Tests: 620 pass, 0 fail, 1 skip. Reload: **yes** for 2.3.7 (`chrome://extensions`).
- In progress: workflow `wf_d12e8ea3-347` (round 7 deep review: translation quality on the 3
  newest videos by 13 readers + pattern verification; dub timing causes, 2.3.6 code, long-video
  performance, storage growth, each finding verified by 3 skeptics). Its results are not acted on
  yet; if this session ends, rerun it or read its journal under the session's `subagents/workflows`.

## Unfinished / in progress
- Not verified live: the voice reading "...at home. I feel..." in one breath (the user's ear), "có
  nghĩa là", DN and NHNN read Vietnamese (2.2.4).
- Carried over: AI Studio vs cost card over one full Pacific day; the live harness (`?script=stress`,
  `viewer2`) is the user's to run; "Chép chẩn đoán" right after a problem. Never ask about Apple
  Events JS or hand decisions back (memory).
- Fast talkers with Mỹ Duyên: 24-30% of lines start >0.5 s late (known limit, quicker voices).

## Traps hit this session
- Stored cues carry no `midLine`; rebuild it from each `midLine` group's first source cue before
  regrouping cached lines (`/tmp` scripts `grpcmp.js`, `regroup.js` do this; not kept).
- zsh does not word-split `set -- $var`: loop over `a:b` pairs with `${p%%:*}` / `${p##*:}`.
- The simulator's render count matched the user's server log (348 vs 349): trust `--real` rows.

## Suggested next step
- Act on the verified findings of the round 7 workflow, then a new punctuated video with the voice.
