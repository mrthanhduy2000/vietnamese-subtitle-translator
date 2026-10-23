# Browser voice when VieNeu is not running

Lane B (touches options.html / options.js for one toggle). Runtime change: needs a version bump at release.

Vietnamese release note (for version-history.js):
- Khi máy chủ VieNeu không chạy (máy yếu, Chromebook, Linux ARM), lồng tiếng dùng giọng tiếng Việt có sẵn của trình duyệt thay vì im lặng, rồi tự chuyển lại VieNeu khi máy chủ sẵn sàng.
- Cài đặt > Lồng tiếng có công tắc để tắt, nếu bạn chỉ muốn giọng VieNeu.

Details: `dubSystemFallback` (default true) in `dubbing.js` `buildProviders`; off keeps the old VieNeu-only wait.
