# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lanes A + B + C + D · `1.7.3`. User: full codebase audit (dead code, API/token cost,
retries, leaks, performance) and fix what the evidence supports. Commit message lists everything.

## What changed

- Cost: YouTube translation windows are fixed by the text (`ytCanonicalWindows`), so a revisit hits
  the cache; `translateUnitMiss` moves to the next model on `NEXT_MODEL_ON` (price-capped chain);
  `engine: "google"` (chosen) vs `google_fallback` (failed; not saved into `ytcache4_`).
- Bugs: Coursera dead copy kept its navigation poll after Reload; popup "Tiếng Anh ở trên" was not
  live; popup "Làm mờ dòng tiếng Anh" (`styleOriginal`) was never read, removed.
- Perf: Coursera render loop memo (`csMemo`, 500 ms); YouTube full-storage sweep once a day
  (`ytSweptAt`); page audio L1 capped at 16 MB; Google fallback sentences in parallel.
- Removed (no caller, verified): condense machinery + `condenseSpeech`, `localTtsWarm`,
  `ytBatDauDOMCaptionObserver`, legacy floating icons, `pickVietnameseVoice`, `gateNoise`,
  `DEFAULT_MODELS.universal`. Docs updated (DANGER 5/7, DUBBING, SUBTITLE, TESTING, MAP, CLAUDE.md).

## State

- `npm test`: 413 tests, 412 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs (not loaded)

## Unfinished / in progress

- Kept on purpose, unverified: host permissions `fonts.googleapis.com` / `fonts.gstatic.com` look
  unneeded (fonts load by `<link>`); remove only after a real-Chrome check of options + overlay fonts.
- Prompts and context size were NOT trimmed (quality risk, no way to measure offline without spend).
- 1.7.2 audio not heard by the user yet. "Truyền cảm" not solved. Not verified in real Chrome:
  1.7.2/1.7.3 end to end, backup download, generic injection, `ensureYtBridge`, 1.7.0 AI-dub case.
- Udemy / edX: `BACKLOG.md` 9. Long-video jank unmeasured. Leak on 4eY5DuqASQc ~8:40.

## Traps hit this session

- `bg-env.js` `send` never resolves for an unknown action: awaiting a removed route hangs `npm test`.
- The sandbox blocks loopback: `curl 127.0.0.1:8000` exits 7 while VieNeu is up. Retry unsandboxed.
- `npm test` runs an explicit file list in `package.json`: a new test file must be added there.

## Suggested next step
- Reload; revisit a half-watched YouTube video: no new Gemini calls for the part already seen.
