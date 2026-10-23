# Bent glossary codes no longer force an unprotected resend

Runtime change (lane A/D: content.js, background.js). Needs a version bump.

Real log (Mac, 3.0.6): "Ma danh dau bi hong, dich lai khong bao ve thuat ngu" repeated on 5 YouTube videos.
The page asked Gemini again without protection (a second paid call, no glossary) whenever fewer than 40%
of the codes came back in the exact form `[[__T0__]]`. Causes fixed here, each a class:

- Bent codes were not recognised: `[__T0__]`, `[[T0]]`, `[[_T0_]]`, `[[**T0**]]`, escaped underscores,
  full-width brackets. `GLOSS_TOKEN_SRC` / `glossTokenRe()` (content.js) now read all of them in
  `restoreGlossary`, `glossaryIntact` and `finalizeTranslation`; background `PLACEHOLDER_RE` normalises
  them to `[[__T0__]]` and drops numbers it never sent.
- A code the model replaced by writing the term itself counted as lost. `glossaryIntact` now counts a
  code as present when it came back OR its term appears in the translation; the resend happens only when
  fewer than 40% of terms are present either way.
- A code with an unknown number is removed (was left on screen when bent).
- Tests: last three in `tests/glossary-cache.test.js`. Not measured on real Gemini output (none offline);
  watch the console warning count on the Mac after release.
