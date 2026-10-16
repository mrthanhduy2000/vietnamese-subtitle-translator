# Handoff (2026-10-16, 2.5.5)

## State
- 2.5.5, UI: the Settings page has 5 tabs (Phụ đề, Lồng tiếng, Dịch & AI, Chi phí & dữ liệu, Phiên
  bản), switches instead of checkboxes, rare options folded in `details.more`. Controls removed:
  `dubProvider`, both Gemini voices, `dubVoice`, `dubTtsModel`, `perCueMode` (their keys and what a
  save writes: `SUBTITLE.md` storage keys). The YouTube quick menu keeps subtitles, mode, size,
  dubbing, voice, volume; "Chép chẩn đoán" is gone (`CST_DUB.diagnostics()` stays, `DUBBING.md`).
  Cost mode names rewritten (`cost-policy.js` MODES). `npm test` 710 pass, 0 fail, 1 skip;
  `tools/regress.js` 0 numbers moved, baseline saved at 2.5.5.
- Who speaks: no runtime change. `speaker-lab.js score --why` splits the words in a wrong voice by
  cause; `--sentences` is the line shape to measure next. Numbers and the next step: BACKLOG 44.
- The user's "mô hình ngôn ngữ nằm trong máy" was read as the VieNeu model (its backbone is a
  language model). Checked 2026-10-16: model `61b85e3` is still the newest on Hugging Face (pinned);
  upstream code 3.8.3 against our `d350c63` changes dependencies and hardening only; its int8 needs
  an x86 CPU with VNNI (the M3 is ARM); server log, 21,500 renders: RTF p50 0.24, p90 0.29, the slow
  ones come right after another render. Nothing changed.
- Share repo: 2.5.5 is on main (`e79e8bb`), promoted after a green install test on staging.

## Traps
- Opening a page in the user's Chrome (Control_Chrome `open_url`) takes over the tab they are
  watching; they closed the lab tab within seconds and the run stopped after one video. Lab runs
  belong to a time the user is not watching.
- 2026-10-16: 1.105 of the 1.154 USD daily budget spent, nearly all on measuring. Over budget, the
  speaker reading and the strong tier stop; subtitles go on with the cheap model.
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
