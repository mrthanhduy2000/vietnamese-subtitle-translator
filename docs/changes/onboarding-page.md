# First-run onboarding page (lane C)

Added `onboarding.html`, `onboarding.js`, `tests/onboarding.test.js`; `background.js` `onInstalled` now opens
`onboarding.html` instead of `options.html#welcome` (the options welcome card stays and still works with the hash).
No version bump (release thread bumps). popup and options untouched.

Vietnamese line for the version history:
"Lần đầu cài đặt, tiện ích mở trang chào hướng dẫn từng bước: lấy và dán khóa Gemini (có nút kiểm tra khóa hoạt động), kiểm tra giọng VieNeu nếu muốn lồng tiếng, và một video mẫu để thử ngay."

Handoff note: the key is saved only after `testKey` passes. Sample video id is in `onboarding.html` (`sampleLink`); swap it if it ever loses captions. Not seen in real Chrome (headless/fake DOM only).
