# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lanes B + D · `1.7.7`. User report: Mỹ Duyên, "máy chủ giọng chậm (1 giây lời mất
3,5 giây), đã bỏ 7 câu để bắt kịp".

## What changed

- Cause: VieNeu idle 4 days, model swapped out by macOS (24 MB of 1.2 GB resident); warm it is 0.23x.
- `dub-engine.js`: rtf sample excludes `SYNC.renderOverhead` (was counted twice), first sample capped
  at `SYNC.firstRtfCap` (1.0), `dropRtf()` = min(EMA, latest) feeds `waitAudio` / skip-ahead.
- `background.js`: `localIsCold()` / `localMarkWarm()`; first line after >10 min idle gets a 60 s
  limit (not 8 s, which cut the page-in and redid it) and is not written to the speed log.
- Test: `tests/hardening.test.js` "render speed: first sample capped..." (fails on 1.7.6 code).
- `DUBBING.md` "Render speed", `BACKLOG.md` 20, `version-history.js` 1.7.7.

## State

- `npm test`: 443 tests, 442 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs (not loaded)

## Unfinished / in progress

- The 7-drop case was not reproduced in simulation (old and new code behave the same in the
  hardening harness); the fix is reasoned, not measured. `BACKLOG.md` 20: keep the model resident.
- Not heard by the user: 1.7.6 A/B WAVs, 1.7.2 audio, 1.7.5 A/B (sent in chat).
- `BACKLOG.md` 14 (Coursera waits for a refine), 15 to 19 (prosody leftovers, alignment, no
  blind listening). All four marked sets are seen now: write new sentences before the next check.
- Not verified in real Chrome with the extension: 1.7.2 to 1.7.7 end to end, backup download,
  `ensureYtBridge`, 1.7.0 case. Fonts host permissions kept (need that check before removal).
- Prompts / context NOT trimmed. "Truyền cảm" not solved. Udemy / edX (`BACKLOG.md` 9). Long-video
  jank unmeasured. Leak on 4eY5DuqASQc ~8:40.

## Traps hit this session

- A voice warm-up line is forbidden by a test ("không làm nóng giọng", 1.2.6): do not add one.
- The sandbox blocks loopback: `curl 127.0.0.1:8000` needs the sandbox off. Check server RSS with
  `ps -o rss= -p <pid>`: tiny RSS = swapped out, expect a slow first minute.

## Suggested next step
- Reload; dub with Mỹ Duyên after >10 min server idle, watch the quick-menu line.
