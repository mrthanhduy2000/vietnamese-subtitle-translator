# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-10-01 · `2.4.3` speaker labels restored in subtitles, after `2.4.2` (second batch review).

## What changed
- `trimContextLeak(text, next, { src })`: refused when the translation is under 1.3x its source
  (parallel clauses were cut as leaks: 9 lines when translated, 7 saved lines at every load).
- Speaker labels ("ANDREW HUBERMAN:") stay in the subtitle, are not read (`dub-planner.js`).
- `absorbsLag`: a line past `maxQueueLag` that gives time back is read, up to `maxQueueLagHard` 8.
- `assess`: substance and sport loanwords, "(Laughter)" lines, labels out of the length ratio.
- Diagnostics gain `reseeks`, `nudges`, `duckUps`, `settings.duck`. New `tools/batch-review.js`.
- 2.4.3: `fixSoundNotes` puts a dropped leading label back (`restoreLabel`): 239 -> 311 of 311.
- `REVIEW_MARK` = 39 videos to 2026-10-01 02:45 UTC; dumps in `review-archive/2026-10-01-videos-22-39`.

## State
- Tests: 630 pass, 0 fail, 1 skip. Reload: **yes** for 2.4.3 (`chrome://extensions`).
- 18 new videos, simulated: dropped 65 -> 8, words lost 1015 -> 153, late 1548 -> 1396; refine
  flags 36 -> 13. Scenarios and rapid matrix identical; slow matrix +3 spoken, +12 s gaps / 144 runs.
- The user pasted "keep improving, fix all backlog" twice. BACKLOG is empty; the second pass found
  only micro items (below). Default stays: report numbers first, change code when asked.

## Unfinished / in progress
- The user's "bụp bụp, lúc được lúc không" on Q4JWEtq23h8 (2.4.1) is not explained: delivery was clean,
  the simulator shows the original up 11 times in 10 min (no pump). Their duck went 0.05 -> 0.3. Next
  report: read `delivery.reseeks / nudges / duckUps` in their "Chép chẩn đoán".
- 9 saved lines stay cut (the cache holds only the cut text); a re-watch after "Xóa video đã rà soát"
  re-translates them from the unit cache with the new guard.
- Not seen in a real browser: the Settings counter and button, a 3-hour video's performance.
- Carried: voice items for the user's ear ("có nghĩa là", DN, NHNN); fast talkers start many lines
  late (yZfhCQwCWT4 61%, rate at the 1.55 cap: known limit). Never ask about Apple Events JS.

## Traps hit this session
- The planner returns segments with `subtitleText`, not `texts`: a check on `texts` reads nothing.
- `trimContextLeak` also runs on load (`ytRepairCachedLeaks`): a false cut there repeats every load.
- Checked and left (too rare): a unit translating into the one before (3 of 6845), "tăng tăng" slips
  (most doubled words are real: vân vân, dần dần), per-frame lookups are binary searches.

## Suggested next step
- Next batch: `node tools/ext-storage.js --prefix=ytcache4_ --out=<dir>`, then
  `node tools/batch-review.js <dir> --since=1790822701723 --sim`, read `--show=omission,leftover`.
