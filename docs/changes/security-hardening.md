# Security hardening

- `background.js`: message route lookup uses own keys only (`action: "constructor"` used to throw); non-object messages are ignored.
- `yt-bridge.js`: the credentialed caption fetch accepts only https `*.youtube.com/api/timedtext`.
- `manifest.json`: explicit `extension_pages` CSP (`script-src 'self'; object-src 'self'`).
- `options.js`: model ids, local-server replies and error text are HTML-escaped before `innerHTML`.
- Tests: `tests/security.test.js`, one case in `tests/bridge.test.js`.
- Left as is: Gemini key stays in `storage.sync` (design choice; moving it to local would lose it for current users).
- User-facing line for the release: "Củng cố bảo mật: bỏ qua tin nhắn lạ, chỉ tải phụ đề từ youtube.com, khai báo CSP, thoát HTML ở trang Cài đặt."
