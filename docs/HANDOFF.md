# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-01 · `2.4.5` no dubbed line dropped for lag, slid windows refined whole (after `2.4.4` seams).

## What changed
- 2.4.4: `fixRepeatedHeads` also drops a retold sentence end (`retoldHead`) and moves back a tail
  that took the next unit's content (`shiftedTail`). 3 real seams of 6873, 0 of 45 lookalikes.
- 2.4.5 `readsLate` replaces `absorbsLag`: a line with audio ready is read up to `maxQueueLagHard`
  8 s late. 40 videos: drops 8 -> 0, words lost 113 -> 0, latest start 6.68 -> 6.70 s. Matrices
  and the 14 scenarios identical. A line with no audio still drops at `maxQueueLag` (slow server).
- 2.4.5 `misalignedItems` (a window's answers slid by one item, length test) -> `misaligned`
  severity 3 in `assessAll`; `pickRefined` takes a slid window's refine whole, not item by item.
  1 run in 40 videos, 0 false hits at window sizes 4-12. `VI_PLAIN`: "than", "con"... not English.

## State
- Tests: 636 pass, 0 fail, 1 skip. Reload: **yes** for 2.4.5 (`chrome://extensions`).
- `REVIEW_MARK` not moved: only 1 new video (679UtcE_k6c) since 39; it joins the next batch.
- **The user's view (2026-10-01):** they watch new videos only; every fix must be a rule for all
  future videos, and they reject "leaving a small pinch". Fix every class a safe rule can catch
  (measure false hits on all saved videos); name what cannot be fixed and why, with numbers.
- Left, by design: 13% of lines start > 1 s late, all on fast talkers (yZfhCQwCWT4 100 of 191).
  The voice is at its ceiling and condensing is forbidden: only slowing the video would cut it.
  Offered to the user as an option, not built. Omission flags left are lines cut before 2.4.2.
- `pickRefined` / the `misaligned` refine are not seen against live Gemini (no refine data offline).

## Unfinished / in progress
- The user's "bụp bụp, lúc được lúc không" on Q4JWEtq23h8 (2.4.1) is not explained: delivery was clean,
  the simulator shows the original up 11 times in 10 min (no pump). Their duck went 0.05 -> 0.3. Next
  report: read `delivery.reseeks / nudges / duckUps` in their "Chép chẩn đoán".
- Not seen in a real browser: the Settings counter and button, a 3-hour video's performance.
- Carried: voice items for the user's ear ("có nghĩa là", DN, NHNN). Never ask about Apple Events JS.

## Traps hit this session
- Cached `srcCues` are `[start, end, text]` arrays, not objects: `c[2]`, not `c.text`.
- Seam scans: most "same words across a seam" are the speaker repeating ("Meal prep." twice).
- An old engine copy outside the repo loads only after the current one (globals stand in for its
  `require("./cost-policy.js")`); require `./dub-engine.js` first in ad-hoc comparisons.

## Suggested next step
- Next batch: `node tools/ext-storage.js --prefix=ytcache4_ --out=<dir>`, then
  `node tools/batch-review.js <dir> --since=1790822701723 --sim`, read `--show=omission,leftover`.
