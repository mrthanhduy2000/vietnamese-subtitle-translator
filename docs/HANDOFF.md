# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lane A (`glossary.js`, `content.js`) + C (`options.js`, `options.html`,
`version-history.js`) + D (`tests/glossary.test.js`, `package.json`) · `1.8.5`. User asked:
improve, optimise and expand the terminology glossary.

## What changed
- Every glossary term used to come back in **English** (placeholder restored to the match), so
  "standard deviation", "interest rate", "side effect" stayed English in subtitles and dubbing.
  New `GLOSSARY_VI` in `glossary.js`: 526 lowercase keys -> settled Vietnamese, merged into each
  group as `group.vi` (keys also pushed into `group.terms`). `loadGlossary` seeds
  `state.glossaryTranslateAs` from it; user `userKeep` deletes a rendering, user `=>` overrides.
- `translateAsFor` (plural fold), `sentenceStartAt` + `capitalizeLowerTerm` in `restoreGlossary`.
- New groups `math`, `productivity`; new tools/acronyms in `tech`; possessive/digit normalize rules
  (prisoner's dilemma, Bayes' theorem, Porter's five forces, scope 1/2/3 emissions); removed
  "public good" (everyday sense). 19 groups, 1,611 terms (was 1,447).
- `knownGroups` storage key + `CST_resolveEnabledGroups`: a stored `enabledGroups` from before a
  group existed no longer hides it. `LEGACY_GROUP_KEYS` = the 17 pre-1.8.5 keys; add nothing there.

## State
- `npm test`: 514 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs. Windows containing a
  newly rendered term re-bill once (placeholder text is in `unitCacheKey`).

## Unfinished / in progress
- The keep-English vs Vietnamese choice per term is a judgment call; not yet watched in real
  Chrome. Marketing metrics deliberately stay English. Ask the user after a lecture or two.
- Carried over: nobody compared real Gemini output before/after 1.8.3/1.8.4 (console line shows
  context); `BACKLOG.md` 30, 31, 14, 15, 16, 18, 19, 20, 21-24, 26-28; 1.7.2 to 1.8.5 not verified
  end to end in real Chrome; 1.7.9 duck fix not confirmed; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- `protectGlossary` runs the exact-case pass before the lowercase pass: placeholder ids follow
  pass order, not text order. Tests must not assume text order.
- `state` in content.js is a top-level `const`: read it with `vm.runInContext("state", sb)`.
- A glossary key with an everyday second sense gets the rendering blindly ("exact match").

## Suggested next step
- Watch a statistics or economics lecture: terms like "độ lệch chuẩn", "lãi suất" should appear
  in Vietnamese; flag any rendering the user dislikes and move it out of `GLOSSARY_VI`.
