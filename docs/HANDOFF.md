# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lane A (`context-engine.js`, `content.js`, `youtube.js`) + D (`background.js` prompt line
and cache key, `tools/context-eval.js`, tests) · `1.8.4`. User asked: close every open item of the
1.8.3 context audit (old `BACKLOG.md` 32), deeper, zero API spend.

## What changed
- Far antecedents: `ContextSession.refSourceFor` -> `context.refSource`, prompt line
  `[NHẮC LẠI TỪ TRƯỚC, chỉ để hiểu đại từ]`, cache key extended only when non-empty.
- `cleanDescription` for the topic; `ytWaitForWindowBefore` shared by prefetch and the realtime +1/+2
  groups; console `contextSummary` on each "🤖 GEMINI" line. Details: `SUBTITLE.md` 1.8.4 paragraph.
- Old `BACKLOG.md` 32 removed: (a) far antecedent done, (b) realtime done, (c) measured no later than
  1.8.3 (scaled playback test), (d) prompt reviewed and kept, (e) replaced by the console summary.
- No API call of any kind this session.

## State
- `npm test`: 504 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs. Cached translations hit
  except windows that now carry a `refSource` (re-billed once).
- `node tools/context-eval.js` (`--root <git archive dir>` for before/after).

## Unfinished / in progress
- Nobody has compared real Gemini output before/after 1.8.3/1.8.4; the console line lets the user
  check the context while watching normally (no extra call).
- Carried over: `BACKLOG.md` 30 (blind 2 failures -> dev, then blind split 3), 31 (purpose clause
  feel, ask the user after listening), 14, 15, 16, 18, 19, 20, 21-24, 26-28; 1.7.2 to 1.8.4 not
  verified end to end in real Chrome; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- Names often open sentences ("Sam joined..."): a name test that skips the first word finds none;
  `OPENERS` is the fix. `\bsponsor\b` misses "sponsored".
- "the model" everywhere in an ML talk pulled noise until the 3-unit topic rule.
- Scaled-time tests: scale the sandbox `setTimeout` too, or the prefetch's 1 s idle wait is 50 s of video.
- A fake translator must echo `[[__T0__]]`, or `requestUnit` resends every window.

## Suggested next step
- Watch a Coursera lecture and a YouTube talk, DevTools console (extension context): every
  "🤖 GEMINI" line should show "bản dịch trước ✓" except the first window(s).
