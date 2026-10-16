# Handoff (2026-10-16, 2.5.6)

## State
- 2.5.6 (on top of 2.5.5's Settings redesign): the cost card's day table and month card use the
  local day like "Hôm nay" (were Google's Pacific day: the morning's 790 calls showed under
  yesterday). `historyToLocal` in `background.js` moved the old history once (`costHistoryTz`).
  Money always shows đồng with USD (currency picker gone, `costCurrency` ignored). New
  `costVideos`: spend per video per local day, ranked in a "Video tốn nhiều nhất" fold by today /
  week / month / quarter / year (records start 2.5.6). `SUBTITLE.md` storage keys.
- Removed for good: hand-corrected lines (`subtitle-edits.js`, transcript pencil, Settings card,
  backup `local`); old `edits:*` keys are deleted once (`editsRemoved256`).
  `tests/voice-refresh.test.js` replaces `edits.test.js`.
- Version history folds, newest open, 15 at first plus "Xem thêm"; custom text colour swatch is a
  colour wheel. `npm test` 705 pass, 0 fail, 1 skip; regress 0 moved, baseline saved at 2.5.6.
- Share repo: 2.5.6 on main after a green install test on staging.
- Who speaks: no runtime change since 2.5.3; `speaker-lab.js score --why` and `--sentences`,
  numbers and next step in BACKLOG 44. VieNeu model checked 2026-10-16: nothing newer.

## Traps
- Opening a page in the user's Chrome (Control_Chrome `open_url`) takes over the tab they are
  watching; they closed the lab tab within seconds and the run stopped after one video. Lab runs
  belong to a time the user is not watching.
- The user raised the daily budget to 200,000 đ (7.69 USD) on 2026-10-16; 1.11 USD spent that day,
  nearly all on measuring. Over budget, the speaker reading and the strong tier stop.
- `node -e` has no script argument: a flag pushed onto `process.argv` once is lost by `slice(2)`.
- The lab's 30 PBS videos are in `/tmp/claude-501/lab/data` (scratch); `tests/harness/lab-data/`
  is git-ignored. Readings are cached by lines, prompt version and model.
- Reloading the extension closes its pages (the harnesses).
- `~/.claude/projects/.../memory` is outside the Bash sandbox: write memory with Edit/Write.

## Unfinished
- BACKLOG 44 (next: read the 30 videos with `--sentences`, about 0.05 USD), 45, 46, 47.
- Carried over: joint-takes branches; the 2.5.0 Coursera start hold not yet seen live; CI gaps
  (VC++ runtime, browser steps, a Vietnamese Windows profile); voice items "có nghĩa là", DN, NHNN;
  BACKLOG 43; `ban-giao.md` does not mention the share repo.
- Never ask the user about Chrome's Apple Events setting.
