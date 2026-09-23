# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-23 · lanes A + C, `cost-policy.js` · `1.5.9`. User: keep fixing subtitles and voice, make
the UI practical, beautiful, academic and spacious; may open and measure any video.

## What changed

- All 25 VieNeu voices have a measured `sps` (method in `docs/DUBBING.md` §VieNeu). 21 used a
  shared guess of 4.8 before, off by up to 24%. `CST_COST.voiceLabel` shows chậm/vừa/nhanh.
- Checked and left alone: VieNeu pronounces English words (prompt, token, workflow) with an English
  G2P, correctly. No action needed there.
- Quick menus (both sites): two sections via `kit.buildSection`, roomier, shorter labels.
- Transcript panel: front-matter line, hairline rows, italic serif source line, accent rule on the
  playing row, 392 px wide (overlay shift updated in both players).
- Popup: "Đang xem" card (title, progress bar, voice health) from `getStatus` (now sends `title`,
  `dub.health`). Settings: duck hint says 0% mutes.
- Renders: `scratchpad/shot.sh` + harness pages that load the real content scripts with
  `chrome-shim.js` and call `ytMoMenuNhanh` / `CST_TRANSCRIPT.toggle` directly.

## State

- `npm test`: 347 tests, 346 pass, 0 fail, 1 skip · Reload: **yes**

## Unfinished / in progress

- **The user's Chrome still runs an old build** (seen live on 4eY5DuqASQc: no size stepper, log lines
  at old positions). 1.5.6 to 1.5.9 have never run there. Automation cannot reach
  `chrome://extensions` or extension pages (claude-in-chrome prefixes https), so only the user can Reload.
- A paraphrased context leak is not caught; 7 cues still exceed 25 cps (dense speech).
- Plan stages 3 to 5 on hold: the user asked for no new features.
- `docs/BACKLOG.md`: 8 open items needing the user's go-ahead.

## Traps hit this session

- A harness page must set `ytSettings.uiTheme` itself: `ytKhoiDong` exits off youtube.com.
- `sed` edits of generated HTML with `&` and quotes fail silently; generate harnesses in Python.

## Suggested next step
- After the user reloads: open 4eY5DuqASQc at 8:25 with claude-in-chrome, measure overlay and dubbing.
