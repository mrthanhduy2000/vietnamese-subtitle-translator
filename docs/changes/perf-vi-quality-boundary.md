# assess() 19x faster per sentence (lane A, vi-quality.js, perf thread)

- `vre()` rewrote every `\b` into a lookbehind/lookahead alternation that V8 tries at every start position. It now uses a one-sided check (`(?<![\p{L}\p{N}])` / `(?![\p{L}\p{N}])`) where the neighbouring token is a plain letter (the shape of all 44 calque patterns), and keeps the full boundary otherwise.
- Four regexes inside `assess()` are built once instead of on every call.
- Offline, `assess()` on a 100-character sentence: 680 µs -> 35 µs per call. `vi-quality.js` load: 35 ms -> 19 ms.
- Same matches as before: `tests/vre-boundary.test.js` compares against the full boundary on 2,700 generated texts, and a 17,600-text random check over all 44 calque patterns (8,334 positives) had 0 differences.
- Vietnamese for version-history: "Kiểm tra chất lượng bản dịch nhanh hơn nhiều lần (khoảng 680 xuống 35 micro giây mỗi câu), kết quả không đổi."
