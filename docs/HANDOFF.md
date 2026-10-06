# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-06 · still `2.4.7` (tools, tests, docs only): the review loop got its own tools.

## What changed
- `node tools/review.js`: a whole batch review in one command (reads Chrome's storage, new videos
  after `REVIEW_MARK`, rows, rates per 100 groups against every reviewed video, flagged lines by
  class, the regression net). `--close` archives the batch, moves `REVIEW_MARK`, saves a baseline.
- `node tools/regress.js` (~75 s): every reviewed video + all sim scenarios against the local
  `review-archive/baseline.json`; fails on anything worse. Proven: the 2.4.6 engine shows 22 cuts.
- `tools/batch-review.js` is a module now; `mended` column; a run of "[Âm nhạc]" is no duplicate.
- Real Chrome (headless, `PRELOAD=` + page errors in `headless.js`): Settings counter and "Xóa video
  đã rà soát" work end to end (`options-preload.js`); a 186-min video costs 161 ms once at open,
  31 ms per planning window (`long-video.html`). Numbers in `docs/TESTING.md`.
- `tests/review.test.js`: the realign runs inside the real `content.js` / `youtube.js` (over a seam).
- Flaky VieNeu test fixed: the two requests raced to the queue under load (2 of 12 runs); 0 of 42.
- Declined by the user: slowing the video for fast talkers (`BACKLOG.md` 41).

## State
- Tests: 646 pass, 0 fail, 1 skip. No runtime file changed: no bump, no Reload needed.
- `regress.js`: baseline saved on this commit, 0 moved.
- 1 video saved after the mark (2bosouX_d8Y, music only, nothing flagged): not closed, joins next batch.
- **The user's view (2026-10-01):** new videos only; every fix is a rule for all future videos
  (false hits measured on all saved videos), no "small pinch" left; name what cannot be fixed, with
  numbers. On a sound report dig yourself (`docs/TESTING.md` "Live measurement"), never ask them.
- By design: lines > 0.5 s late are fast talkers; condensing is forbidden, slowing declined.
- `pickRefined` / the `misaligned` refine are still not seen against live Gemini.

## Unfinished / in progress
- 2.4.6 and 2.4.7 not heard by the user yet; if pops remain, read media-internals `seek_target` rows.
- Carried: voice items for the user's ear ("có nghĩa là", DN, NHNN). Never ask about Apple Events JS.

## Traps hit this session
- `headless.js` needs the sandbox off (loopback). The Settings counter sits on the Gemini tab:
  click `[data-tab="tab-gemini"]` before judging visibility.

## Suggested next step
- On "Đã có dữ liệu rà soát mới": `node tools/review.js`, read section 3, fix as rules, measure on
  all videos, `node tools/regress.js`, then `node tools/review.js --close` and bump the version.
