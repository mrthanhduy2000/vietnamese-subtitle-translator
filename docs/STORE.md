# Chrome Web Store submission kit

Everything the dashboard asks for, ready to paste. Package: `node tools/package-store.js` writes
`dist/dich-phu-de-<version>.zip` (manifest, root `.js/.html/.css`, `icons/`, `images/`; no tools, tests, docs).
Only the account owner can register, pay the one-time fee, enable 2-step verification and press Submit.

## Listing text (Vietnamese: it is what users read)

- **Name** (manifest `name` is English; the store shows it): see "Must change first" below.
- **Summary (max 132 chars):** Dịch phụ đề YouTube, Coursera, TED sang tiếng Việt bằng Gemini và lồng tiếng Việt bằng giọng chạy trên máy bạn.
- **Category:** Productivity (alternative: Accessibility). **Language:** Vietnamese.
- **Description:** start with one sentence of what it does (policy), then: translates subtitles with the user's own
  Gemini API key (free key from Google AI Studio), Google Translate as fallback; bilingual or Vietnamese-only display;
  editable transcript and `.srt` export; optional Vietnamese dubbing with the VieNeu voice running on the user's own computer
  (separate free install, link in the description). State plainly: needs a Gemini key; subtitle text is sent to Google;
  not affiliated with or endorsed by YouTube, Coursera, TED or Google. Do not repeat a keyword more than 5 times.

## Privacy practices tab

- **Single purpose:** "Translate the subtitles of online videos (YouTube, Coursera, TED) into Vietnamese and, optionally, read them aloud as a Vietnamese voice-over, so Vietnamese viewers can follow the video."
- **Remote code:** No. (Every script is in the package; `tests/security.test.js` guards the CSP.)
- **Data types to tick:** Website content (subtitle text sent for translation); Authentication information (the Gemini API key, stored in `chrome.storage.sync`). Not collected: browsing history, personal info, location, health, financial.
- **Certifications:** tick all three (no sale, no unrelated use, no creditworthiness use).
- **Privacy policy URL:** must be public. `docs/PRIVACY.md` sits in the private repo and is not in the share repo, so publish it at a public URL first.

### Permission justifications

| Permission | Justification to paste |
|---|---|
| `storage` | Saves the user's settings, Gemini API key, glossary and edited subtitle lines. |
| `unlimitedStorage` | Caches translations and generated voice audio in IndexedDB so a video is not translated or synthesised twice (saves the user's API quota). The 10 MB default is too small for audio. |
| `activeTab` | Lets the popup start translation on the tab the user is looking at, for video sites outside the fixed list. |
| `scripting` | Injects the subtitle/dubbing scripts into the active tab on that user click, and re-injects them into already open YouTube/Coursera/TED tabs after the extension updates. |
| Host `*.youtube.com`, `*.coursera.org` | Reads the video's caption track and draws the Vietnamese subtitle over the player. (TED is covered by its content-script match.) |
| Host `generativelanguage.googleapis.com` | Sends subtitle text to the Gemini API with the user's own key for translation, and for Gemini voice if chosen. |
| Host `translate.googleapis.com`, `translate.google.com`, `clients5.google.com` | Fallback translation when Gemini is off or fails. |
| Host `api.mymemory.translated.net` | Last-resort fallback translation. |
| Host `http://127.0.0.1:8000` | Talks to the optional VieNeu voice server the user runs on their own computer. Loopback only; nothing leaves the machine. |

## Test instructions tab (reviewers cannot guess these)

Say: a Gemini API key is required; paste a throwaway key with a low quota here (never commit it). Steps: open any
YouTube video with English captions, click the extension icon, Settings > paste key > Save, press Translate.
Dubbing needs a local server that reviewers need not run; without it the dubbing option shows "server not ready".

## Assets

- Icon 128x128: `icons/icon.png` (ready). Screenshots: 1-5, **1280x800** (640x400 allowed), full bleed; none exist yet
  (`images/example-image.png` is 1280x720). Suggested: bilingual subtitle on YouTube, Settings page, transcript panel,
  Coursera, dubbing controls. Small tile 440x280 and marquee 1400x560 are optional.

## Must change first (review risks found in this repo)

1. **Name** "Vietnamese Subtitle Translator (Coursera + YouTube)" lists third-party brands: keyword-spam and trademark risk.
   Use a neutral name, e.g. "Dịch Phụ Đề & Lồng Tiếng Việt AI".
2. **Public privacy policy.** `onboarding.html` links PRIVACY.md in the private repo, which gives users a 404. Host it publicly and use that URL in the dashboard and in `onboarding.html`.
3. **Prominent in-UI disclosure with consent** before the first send of subtitle text to Google (policy: a privacy policy or listing text alone is not enough; today onboarding has only a one-line note).
4. **Local voice setup text.** `options.js` tells the user to double-click `tools/vieneu-autostart.*` inside the extension folder; a store install has no such folder. Point to the public installer instead.
5. **Unofficial endpoints.** `translate.googleapis.com client=gtx` and `clients5 dict-chrome-ex` are undocumented Google endpoints. Not a store-policy item but a reviewer or Google may object; consider dropping them for the store build.
6. **New extension id.** The store assigns a new id, so `chrome.storage` (key, settings) is separate from the unpacked copy: export the settings backup first.
7. Optional: `storage.sync` for the API key (see `docs/PRIVACY.md`) is disclosed; keep the dashboard answer consistent with it.
