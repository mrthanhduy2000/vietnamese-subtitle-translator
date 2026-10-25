# Handoff (2026-10-25, lane C, thread "Redesign giao diện Dịch Phụ Đề & Lồng Tiếng AI")

## Current state
- Branch `redesign-ui-ia`, local only, not pushed. Commits on top of `0944420`: `1520a1a`, `f5c0f5f`, `81f1c0d`.
- Options page (`options.html`, `options.js`): the tab row is four work tabs in a `role="tablist"`
  wrapper (`.nav-tabs`, `display: contents`). "Giới thiệu & lịch sử phiên bản" (`.nav-about`,
  `data-tab="tab-history"`) sits under it and is a plain button, not a tab. `selectPanel(panelId)`
  is the single switch; keyboard arrows still move between the four tabs.
- Cost tab: `dailyCostChart` draws one bar per saved day from `r.history` (last 14 days). Same data
  as the 7-day table; no new storage. Not yet seen with real data on screen.
- VieNeu status line shortened to one sentence.
- Popup (`popup.css`, `popup.html`): rewritten below the token block. Duplicate and dead rules gone,
  no nested borders, 360px wide, 44px primary button. Checked dark only in headless Chrome (light not captured).
- Colours: `theme-colors.css` holds the semantic status and focus tokens (`--tc-*`), light default, dark
  on the OS setting or `data-theme`. Linked by popup and options. `ui-tokens.css` stays colour-free.
- `ui-tokens.css`: added spacing, radius, shadow and motion aliases (values unchanged).
- Tests: `npm test` 986 pass, 0 fail, 1 skip. New tests: `tests/options-redesign.test.js`. The old
  test `options tabs` now expects four `role="tab"` buttons.

## Unfinished
- Redesign brief still open: Gemini status block (`options.js` ~line 598) is still the long
  "API Key hoạt động" box; dubbing and Gemini progressive disclosure not done; cost KPI cards
  unchanged; video workspace unchanged.
- Chart: verify with real history in a Chrome profile that has the extension loaded and sample
  cost history seeded (sample only).
- Screenshots: `options-before.png` (main) vs `options-after.png` (branch) were taken with
  `file://` headless Chrome; they show the nav change only. The banner "nạp lại tiện ích" in the
  after shot is an artefact of running without the extension.
- Carried over from the 2026-10-25 handover by "Sửa song ngữ hiện hai dòng tiếng Việt" (still open,
  not this thread's work): Overlay line fade not checked on a real YouTube or Coursera page; sparse
  caption notice on iYL-UuNE_9w after Reload; YouTube embed frames (TEDx: monica_fay, shuli_steele,
  michelle_zhang); TED hold on Chrome; Mac auto-update install.

## Traps
- `git push` is held: the user's coordinator asked for local-first work. `0944420` (not this thread's)
  is still unpushed on `main`; the Stop hook keeps reporting it until Đàm decides.
- `bump-version.js` was NOT run: feature PRs do not bump the version (CLAUDE.md rule 2). The hook's
  "run bump-version if runtime changed" line conflicts with that rule; CLAUDE.md wins.
- `tests/ui.test.js` asserts `role="tablist"` exists; keep the wrapper when editing the sidebar.
- Headless Chrome needs `--no-sandbox` and a `--user-data-dir` under the scratchpad; the sandbox
  blocks it otherwise. The user allowed all commands in this thread.
