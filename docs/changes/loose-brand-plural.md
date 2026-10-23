# Loose brand matches take only a plain "s"

Runtime change (lane A: content.js), follow-up to `loose-brand-match.md`. Needs a version bump.

- Measured on 1.67M words of lowercased text (nltk Brown, inaugural, state_union, fetched from
  raw.githubusercontent.com/nltk/nltk_data): 31 loose-brand hits, 28 right names (McCormick, LaGuardia,
  McCain, DiMaggio...), 3 wrong: "unifies" caught as UniFi through the `(?:e?s)?` plural suffix.
- Case-insensitive brands now have their own matcher (`state.reBrand`, `brandToPattern`): suffix `s?`
  only. After the change: 28 hits, 28 right, 0 wrong. Possessives need nothing (word boundary).
- Test: the last test of `tests/glossary.test.js`.
