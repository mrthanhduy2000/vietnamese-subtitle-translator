# What leaves the machine

Audited 2026-10-23 from the source (hosts in `manifest.json` `host_permissions`, every `fetch(` in `background.js`).

| Destination | What is sent | When |
|---|---|---|
| `generativelanguage.googleapis.com` (Gemini) | Subtitle text and context for translation; text for Gemini TTS; a cropped caption image for on-screen text (`screen-text.js`). The API key travels only in the `x-goog-api-key` header, never in a URL. | Only when a Gemini key is set and the matching feature is on |
| `translate.googleapis.com`, `translate.google.com`, `clients5.google.com` | Subtitle text (fallback translator) | When Gemini is off, fails, or has no key |
| `api.mymemory.translated.net` | Subtitle text (last fallback) | When the Google fallbacks fail |
| `127.0.0.1:8000` (VieNeu) | Dubbing lines. Never leaves the computer. | When the local voice is chosen |
| youtube.com / coursera.org | Caption requests with the viewer's cookies, made by the page-world bridge, restricted to `https://*.youtube.com/api/timedtext` | While translating YouTube |

Not sent anywhere: viewing history, video titles/ids to any third party other than YouTube itself, the Gemini key (outside Google), glossary or cache contents.

Where the key lives: `chrome.storage.sync` (`geminiApiKey`). It syncs with the Google account and is readable by this extension's content scripts, not by page scripts. The settings backup excludes it unless "kèm API Key" is ticked. Moving it to `storage.local` would drop it for current users on update, so it was left (decision for Đàm if wanted).

Extension pages run under an explicit CSP (`script-src 'self'; object-src 'self'`); `tests/security.test.js` guards it and the absence of inline scripts.
