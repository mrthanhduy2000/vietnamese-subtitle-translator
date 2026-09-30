# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-30 · `2.3.9` saved-video counter (lanes A, C, D), after the `2.3.8` full check.

## What changed
- 2.3.9: the video cache keeps 50 videos (was 15) and at most 8 MB (`youtube.js` `ytDonCache`).
  Settings, cache card: saved videos with size, and videos new since the last review
  (`background.js` `REVIEW_MARK { until, videos }`, now 21 videos up to 2026-09-30).
- 2.3.8: `fixSoundNotes` drops a `[Âm nhạc]` inside a sentence and ">>"; 51 everyday phrase hints
  lead `PHRASES`; YouTube channel term lists need `v: 2` (the 6 stored ones were learned wrongly).

## State
- Tests: 625 pass, 0 fail, 1 skip. Reload: **yes** for 2.3.9 (`chrome://extensions`).
- The user judges the extension saturated: **no more unasked fixes**. The agreed way of working: the
  user watches a batch of new videos (up to 50), then asks for a review of the batch. Review =
  report numbers against the thresholds first; change code only when the user says so.
- The session that finishes a batch review moves `REVIEW_MARK`: `until` = the newest reviewed
  video's `luc`, `videos` = the running total (`node tools/ext-storage.js --prefix=ytcache4_`).

## Unfinished / in progress
- Waiting for the user's batch. Then measure per video: words lost and late starts
  (`playback-sim --real`), empty lines, refine flags, music notes inside a sentence, ">>", cost,
  and whether the hinted phrases ("in my 20s", "dresser", "declutter") came out right.
- Not seen in a real browser: the counter in Settings; a 35-minute video's performance profile.
- Not verified live: the voice reading "...at home. I feel..." in one breath (the user's ear), "có
  nghĩa là", DN and NHNN read Vietnamese (2.2.4).
- Carried over: AI Studio vs cost card over one full Pacific day; the live harness (`?script=stress`,
  `viewer2`) is the user's to run; "Chép chẩn đoán" right after a problem. Never ask about Apple
  Events JS or hand decisions back (memory).
- Fast talkers with Mỹ Duyên: 24-30% of lines start >0.5 s late (known limit, quicker voices).

## Traps hit this session
- Decided against, do not redo: a system-prompt rule for dropped hedges and stiff register (no
  offline way to compare); segmenter changes for 3 compound splits in 444 groups.
- A video is saved only once fully translated, with no Google fallback (3 of 12 were not, 09-30).
- "Xóa bản dịch đã lưu" / "Xóa tất cả" in Settings also removes the saved videos of a batch.

## Suggested next step
- Nothing until the user asks. Then the batch review above, and move `REVIEW_MARK`.
