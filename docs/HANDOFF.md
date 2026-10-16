# Handoff (2026-10-16, 2.5.3)

## State
- 2.5.3: `npm test` 709 pass, 0 fail, 1 skip. `tools/regress.js` baseline saved at 2.5.3; its moves
  are explained in `DUBBING.md` "Who speaks" (segments 7850 -> 7845, late 1702 -> 1711, gaps
  56 -> 59, words lost 0).
- Who speaks, all in `DUBBING.md` "Who speaks": the AI reading now reaches the voices (it timed out
  on long videos; the timeout covers the longest answer, a late answer is charged at its real counts
  and kept); recognizer captions cut in short pieces are joined into sentences before the reading
  (`JOIN_SHORT` 40; the model wrote a turn for nearly every piece otherwise); parts of one size;
  8 voices; prompt 2; labels on every turn need no reading; voice cuts at labels and sentence ends
  (`TURN_CUTS`); fewer cuts inside a phrase (`SEG_STRETCH`).
- Live (`tests/harness/yt-watch.html`): JBvcMfa7K6E 3 voices (was 1), Aj_UWp8Y5D4 two voices in
  its first 75 s, nothing dropped. `yt-driver.html` ran once (Aj_UWp8Y5D4 saved in 36 s).
- New: `tools/speaker-lab.js` (extract, prepare, score), `tests/harness/speaker-grab.js`,
  `speaker-lab.html`, `yt-watch.html`, `yt-driver.html`; how to use them: `TESTING.md` "Extension
  pages that drive YouTube, and the speaker lab".

## Traps
- The lab's 30 PBS videos (caption tracks) are in `/tmp/claude-501/lab/data`, scratch that may be
  gone: re-grab with `speaker-grab.js` in the built-in browser. `tests/harness/lab-data/` is
  git-ignored. The grabbed lines are not always the extension's own (Aj_UWp8Y5D4): build an item
  from `ytcache4_<id>` when the video is saved.
- Lab runs and live checks go through the extension's own budget and ledger. 2026-10-16 spent
  1.09 of the 1.15 USD daily budget, nearly all of it measuring. Readings are cached by lines,
  prompt version and model: rerunning a run is free, changing any of them is not.
- Reloading the extension closes its pages (the harnesses).
- One reading per video: single videos moved 10 to 26 points between line shapes while the mean
  moved 3. Judge a change by the mean over many videos.
- `~/.claude/projects/.../memory` is outside the Bash sandbox: write memory with Edit/Write.

## Unfinished
- BACKLOG 44 (turns inside a line missed on recognizer captions), 45 (no turn back after a short
  interjection on long podcasts), 46 (translation runs Gemini 3 below temperature 1, unmeasured),
  47 (17 cuts still inside a phrase).
- Carried over: joint-takes branches; the 2.5.0 Coursera start hold not yet seen live; CI gaps
  (VC++ runtime, browser steps, a Vietnamese Windows profile); voice items "có nghĩa là", DN, NHNN;
  BACKLOG 43; `ban-giao.md` does not mention the share repo.
- Never ask the user about Chrome's Apple Events setting.
