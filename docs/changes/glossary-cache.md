# Glossary updates no longer re-bill cached windows

Runtime change (lane A/D: content.js, background.js). Needs a version bump by the release thread.

- Window cache key reads the original source text and `protectFp` (user's own glossary choices),
  not the `[[__T0__]]` codes and term list. Entries store `placeholders`; the page restores a cached
  window with those. Old-key windows are found once and copied. `noCache` skips the lookup when codes
  are lost. Details: `docs/SUBTITLE.md` "Protected glossary terms and the window cache".
- Matcher buckets are built in idle slices after the glossary loads (first window 50-80 ms -> ~2 ms).
- Vietnamese history entry for the release notes: "Cập nhật từ điển không làm dịch lại những đoạn đã
  dịch; đoạn đầu tiên của video không còn khựng khi bộ lọc thuật ngữ khởi động."
