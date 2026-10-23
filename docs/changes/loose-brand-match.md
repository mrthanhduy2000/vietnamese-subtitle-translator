# Brands in lower-case captions are protected

Runtime change (lane A: content.js, glossary.js). Needs a version bump by the release thread.

- Single- and multi-word brands with an inner capital (`ChatGPT`, `PyTorch`, `GitHub`: 3,289 terms) now
  match case-insensitively, because automatic captions are lower case ("chatgpt"). Restored in the
  canonical spelling (`state.glossaryCanon`, `canonicalFor`).
- Not for single words under 4 letters or whose lower-case form is an English word (`palm`, `rope`,
  `ideal`, `putty`, `insight`...): `CST_LOOSE_BRAND_SKIP` in `glossary.js`, 49 words, generated from a
  word list by `tools/brand-loose-skip.js <wordlist> --write` (`npm pack word-list`). Rerun it after a
  glossary release that adds many names; a new colliding brand otherwise matches loosely.
- Tests: `tests/glossary.test.js` (three tests at the end).
- Vietnamese for version-history: "Tên thương hiệu như ChatGPT, GitHub, PyTorch được giữ nguyên cả khi phụ đề tự động viết thường toàn bộ."
