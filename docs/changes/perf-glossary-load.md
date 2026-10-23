# Faster glossary load (lane D/A, perf thread)

- `glossary-extra.js`: the merge was quadratic (`RISKY.includes` per line, per-group `have` Set rebuilt for every block). Sets are now kept across blocks. Merge of `glossary-data.js` 159 -> 86 ms (87,173 terms, offline).
- `content.js` `loadGlossary`: no 90k-argument spread, no second 90k-entry Set for `glossaryMultiTerms`. 115 -> 95 ms.
- New `tools/bench-startup.js` (offline benchmark). Glossary output unchanged (same sha256 over groups, risky list, merge report).
- Vietnamese for version-history: "Nạp từ điển nhanh hơn khi mở trang. Gộp danh sách tên riêng vào từ điển nhanh hơn rõ rệt (159 xuống 86 ms), không đổi kết quả dịch."
