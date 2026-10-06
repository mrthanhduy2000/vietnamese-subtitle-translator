# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-06 · `2.4.8` the second voice knows a one-person video (`docs/DUBBING.md` "Who speaks").

## What changed
- `dub-planner.js` `speakerTurns(groups)` replaces `speakerStateBefore` and the per-group toggle:
  every ">>" / "- " / "NAME:" of the source with its time; a mark beside a sound note is none (one
  turn after a question); anonymous marks only in a conversation (4 within 12 s of another); a
  label only if 3+ and name-shaped (not "Translator:"); a 45 s stretch = main speaker = S1; named:
  longest talker S1, the rest S2. `buildDubScript` cuts a piece at a turn inside it.
- Engine: `speakerTurns` with the second voice on, `PLAN.NO_TURNS` off (one voice unchanged:
  45 videos late 1812 -> 1802, nothing dropped or lost).
- 46 videos: 10 one-person videos 0 switches (were 2-94% second voice); 5 conversations keep
  theirs. Two voices cost 1-4 points more late starts in conversations.
- `batch-review.js` columns `voiceSwitch`, `voice2`; `playback-sim.js` takes `sc.settings`.
- Settings hint for "Dùng giọng thứ hai" rewritten; real-Chrome Settings check still 0 errors.

## State
- Tests: 649 pass, 0 fail, 1 skip. Reload: **yes** for 2.4.8 (`chrome://extensions`), then F5.
- `regress.js` baseline saved after this change (labelled 2.4.7: saved just before the bump).
- 1 video after `REVIEW_MARK` (2bosouX_d8Y, music only): joins the next batch.
- **The user's view (2026-10-01):** new videos only; every fix is a rule for all future videos
  (false hits measured on all saved videos), no "small pinch" left; name what cannot be fixed, with
  numbers. On a sound report dig yourself (`docs/TESTING.md` "Live measurement"), never ask them.
- By design: lines > 0.5 s late are fast talkers; condensing is forbidden, slowing declined (41).

## Unfinished / in progress
- The user has not tried the second voice since 2.4.8, nor heard 2.4.6 / 2.4.7. Without names who
  is who is alternation only: 3 people share 2 voices, an unmarked turn is not seen.
- Carried: voice items for the user's ear ("có nghĩa là", DN, NHNN). Never ask about Apple Events JS.

## Traps hit this session
- `voiceSwitch` / `voice2` are neutral in `regress.js`: a one-person video showing a switch must be
  read by hand (`tools/review.js` section 3 lists them).
- `pieces[].t` is a cue's start: a run's end needs the last cue's `end` (the 45 s rule missed it).

## Suggested next step
- On "Đã có dữ liệu rà soát mới": `node tools/review.js`, read section 3, fix as rules, measure on
  all videos, `node tools/regress.js`, then `node tools/review.js --close` and bump the version.
