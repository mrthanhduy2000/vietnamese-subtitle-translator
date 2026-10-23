# Coursera saved-index race, voice preview cleanup (content.js lane A, options.js lane C)

- `csWriteSaved` read-modified-wrote `cscacheIdx` unserialized: two saves at once lost an entry (the
  lecture stayed in storage but outside the index, so the sweep never removed it). Now a per-tab queue
  plus `navigator.locks` ("cst-cscache-index"). Test: audit.test.js "two lectures saved at the same moment".
- Settings voice preview: a second click stopped nothing (voices overlapped) and the blob URL was never
  revoked. `newPreviewAudio` stops the previous one and revokes on end. Not unit-tested (DOM page).
