# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lanes A + B + C · `1.7.5`. User: "Architecture 2.0" pass: only changes a viewer or
the bill would notice, keep working code. Each fix has a test that fails on 1.7.4.

## What changed

- Coursera progressive display: playhead window first, lines shown per window (`csShowTranslated`),
  voice starts with the first window (`opts.onShown`). Replies waited for before the first
  Vietnamese line, simulated 10-min lecture: 25 -> 1. Checked in Chrome on `generic.html`.
- UI state: `csTranslating()` (run of the current `navGen`); button redrawn after `busy` clears
  (1.7.4 left it spinning); popup progress re-read each second, Coursera total = `groupTotal`.
- VieNeu pauses: `ADJUNCTS2` (bằng cách, thông qua, dựa trên...) soft breaks; A/B on identical real
  takes 0/10 -> 10/10 kept; `LOCAL_STYLE_VERSION` 8. New manual `tests/speech-bench.live.js`.

## State

- `npm test`: 423 tests, 422 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs (not loaded)

## Unfinished / in progress

- Not heard by the user: 1.7.2 audio and the 1.7.5 A/B files (scratchpad, sent in chat).
- `BACKLOG.md` 14 (Coursera waits for a refine), 15 (long sentence with no opener: one run).
- Not verified in real Chrome with the extension: 1.7.2 to 1.7.5 end to end, backup download,
  `ensureYtBridge`, 1.7.0 case. Fonts host permissions kept (need that check before removal).
- Prompts / context NOT trimmed (quality risk). "Truyền cảm" not solved. Udemy / edX
  (`BACKLOG.md` 9). Long-video jank unmeasured. Leak on 4eY5DuqASQc ~8:40.

## Traps hit this session

- The voice is not deterministic: judge a pause rule on several takes, A/B on the **same** take.
- The sandbox blocks loopback and its `$TMPDIR` differs from the unsandboxed one: run VieNeu scripts
  unsandboxed, with files in the session scratchpad.
- Python `"""` strings eat `\"`: a history entry came out with bare quotes (syntax error).
- A failed Write in the same batch as `git commit` still lets the commit run: write, then commit.

## Suggested next step
- Reload; open a Coursera lecture: Vietnamese lines from the first seconds, button says "on".
