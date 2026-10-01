# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-01 · `2.4.4` two more window-seam repairs in `fixRepeatedHeads` (after 2.4.2/2.4.3 batch fixes).

## What changed
- `retoldHead`: the source unit runs on, its translation closes the sentence anyway, the next unit
  opens by retelling that sentence's end in other words: that first sentence is dropped.
- `shiftedTail`: one unit >= 1.6x its source, the next <= 0.45x: the tail moves over at the clause
  end nearest the source share (words moved, never dropped).
- Both run wherever `fixRepeatedHeads` runs (live, on load of a saved video, Coursera). Need `src`.
- Measured on all 40 saved videos (6873 units): fire on 2 + 1 real seams, 0 of 45 lookalikes.
  Simulated words lost 173 -> 113, dropped 9 -> 8. Details: `docs/SUBTITLE.md` after the 2.3.0 note.

## State
- Tests: 633 pass, 0 fail, 1 skip. Reload: **yes** for 2.4.4 (`chrome://extensions`).
- `REVIEW_MARK` not moved: only 1 new video (679UtcE_k6c) since 39; it joins the next batch.
- **The user's view (2026-10-01):** they watch new videos, never old ones, so a fix must be a rule for
  every future video. Every fix so far is one; say so plainly, and do not dismiss a class as
  "too rare" when a safe rule exists: measure false positives on all saved videos and ship it.
- All-40 sweep, nothing general left: leftovers are names, URLs, gym jargon, loanwords ("than" in
  "chổi than" is a harmless severity-2 flag); omission flags are lines cut before 2.4.2 and saved.

## Unfinished / in progress
- The user's "bụp bụp, lúc được lúc không" on Q4JWEtq23h8 (2.4.1) is not explained: delivery was clean,
  the simulator shows the original up 11 times in 10 min (no pump). Their duck went 0.05 -> 0.3. Next
  report: read `delivery.reseeks / nudges / duckUps` in their "Chép chẩn đoán".
- Not seen in a real browser: the Settings counter and button, a 3-hour video's performance.
- Carried: voice items for the user's ear ("có nghĩa là", DN, NHNN); fast talkers start many lines
  late (yZfhCQwCWT4 116 of 190, rate at the 1.55 cap: known limit; the 8 drops left are all
  `lag` drops in such stretches). Never ask about Apple Events JS.

## Traps hit this session
- Cached `srcCues` are `[start, end, text]` arrays, not objects: `c[2]`, not `c.text`.
- Seam scans: most "same words across a seam" are the speaker repeating ("Meal prep." | "Meal
  prep."). The tell for a real repeat is a source unit with no sentence end.

## Suggested next step
- Next batch: `node tools/ext-storage.js --prefix=ytcache4_ --out=<dir>`, then
  `node tools/batch-review.js <dir> --since=1790822701723 --sim`, read `--show=omission,leftover`.
