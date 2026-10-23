# Faster first dubbing analysis (lane B, perf thread)

- `dub-speech.js` `loadGlossaryNames` (runs once, at the first voice analysis): no regex whitespace collapse unless a term has odd whitespace, no `split` just to count words. First `vieneuText` call after load: median 390 ms -> 295 ms offline (72,869 lexicon entries). Lexicon and rendered text byte-identical (sha256 over `LEX` and three sample renders).
- Tried and dropped: memoising `isVietWord` per word (no measurable gain).
- Left: the lexicon still builds 72k objects at once; making it lazy per first letter would change lookup order, so it is not done here.
