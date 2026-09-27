# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · docs only (`README.md`, `images/extension.png` removed, `CLAUDE.md`, `docs/MAP.md`,
`docs/BACKLOG.md`) · version stays `1.8.5`. User asked: rewrite the GitHub description and README,
cut every trace of the upstream project (bombap/coursera-translator).

## What changed
- `README.md` rewritten from scratch in Vietnamese: features (subtitles, dubbing, cost), install
  from this repo, update via `git pull` + Reload, VieNeu setup, usage, known limits, dev pointers.
  The old 25-release changelog is gone (stale since 1.4.3); history lives in `version-history.js`,
  the old text in `git show d0c46d5:README.md`. No licence section: there is no LICENSE file.
- `images/extension.png` (upstream popup screenshot, used only by the old README) deleted.
  `images/example-image.png` stays: `options.html` preview background uses it.
- GitHub repo "About" description rewritten via `gh repo edit` (not in git).

## State
- `npm test`: 514 pass, 0 fail, 1 skip · Reload: no (no runtime file changed).

## Unfinished / in progress
- The keep-English vs Vietnamese choice per term is a judgment call; not yet watched in real
  Chrome. Marketing metrics deliberately stay English. Ask the user after a lecture or two.
- Carried over: nobody compared real Gemini output before/after 1.8.3/1.8.4 (console line shows
  context); `BACKLOG.md` 30, 31, 14, 15, 16, 18, 19, 20, 21-24, 26-28; 1.7.2 to 1.8.5 not verified
  end to end in real Chrome; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- `npm test` inside the sandbox tries registry.npmjs.org; run the `scripts.test` command directly.
- `protectGlossary` runs the exact-case pass before the lowercase pass: placeholder ids follow
  pass order, not text order. Tests must not assume text order.
- `state` in content.js is a top-level `const`: read it with `vm.runInContext("state", sb)`.
- A glossary key with an everyday second sense gets the rendering blindly ("exact match").

## Suggested next step
- Watch a statistics or economics lecture: terms like "độ lệch chuẩn", "lãi suất" should appear
  in Vietnamese; flag any rendering the user dislikes and move it out of `GLOSSARY_VI`.
