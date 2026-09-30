# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-30 · `2.4.0` larger stores (lanes A, C, D), after `2.3.9` (counter) and `2.3.8` (full check).

## What changed
- 2.4.0: the video cache keeps 100 videos (`unlimitedStorage` in the manifest, 64 MB guard), the
  dubbing audio store 3 GB (was 200 MB = 3 videos; 3 GB = ~50, the user's own ceiling).
- 2.3.9: Settings, cache card: saved videos with size, and videos new since the last review
  (`background.js` `REVIEW_MARK { until, videos }`, now 21 videos up to 2026-09-30).
- 2.3.8: `fixSoundNotes` drops a `[Âm nhạc]` inside a sentence and ">>"; 51 everyday phrase hints
  lead `PHRASES`; YouTube channel term lists need `v: 2` (the 6 stored ones were learned wrongly).

## State
- Tests: 625 pass, 0 fail, 1 skip. Reload: **yes** for 2.4.0 (`chrome://extensions`).
- The user judges the extension saturated: **no more unasked fixes**. The agreed way of working: the
  user watches a batch of new videos (up to 100), then asks for a review of the batch. Review =
  report numbers against the thresholds first; change code only when the user says so.
- The session that finishes a batch review moves `REVIEW_MARK`: `until` = the newest reviewed
  video's `luc`, `videos` = the running total (`node tools/ext-storage.js --prefix=ytcache4_`).

## Unfinished / in progress
- Waiting for the batch. Then per video: words lost, late starts (`playback-sim --real`), empty
  lines, refine flags, music notes inside a sentence, ">>", cost, the hinted phrases ("in my 20s").
- Not seen in a real browser: the counter in Settings; a 35-minute video's performance profile.
- Not verified live (the user's ear): one breath across "...at home. I feel...", "có nghĩa là", DN, NHNN.
- Carried over: AI Studio vs cost card over one full Pacific day; the live harness (`?script=stress`,
  `viewer2`) is the user's to run. Never ask about Apple Events JS (memory).
- Fast talkers with Mỹ Duyên: 24-30% of lines start >0.5 s late (known limit, quicker voices).

## Traps hit this session
- Decided against, do not redo: a system-prompt rule for dropped hedges and stiff register (no
  offline way to compare); segmenter changes for 3 compound splits in 444 groups.
- A review reads translations and simulates the voice; it has never read the saved audio itself
  (IndexedDB blobs; no tool for it).
- A video is saved only once fully translated with no Google fallback; "Xóa bản dịch đã lưu" and
  "Xóa tất cả" in Settings remove the saved videos of a batch.

## Suggested next step
- Nothing until the user asks. Then the batch review above, and move `REVIEW_MARK`.
