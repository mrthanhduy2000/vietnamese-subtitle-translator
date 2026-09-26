# File map

Line numbers anywhere in `docs/` are anchors, not addresses. They drift. **Grep the symbol name
before you edit.** Symbol names are stable, line numbers are not.

## Manifest load order (matters: later files depend on earlier globals)

`yt-bridge.js` is injected separately, MAIN world, `document_start`, YouTube only.

Everything else is one content-script bundle at `document_idle`, in this order:

```
glossary.js -> cst-cache.js -> cost-policy.js -> lang-detect.js -> vi-segmenter.js ->
subtitle-style.js -> subtitle-edits.js -> player-ui.js -> transcript.js -> context-engine.js -> vi-quality.js -> dub-planner.js -> dub-audio.js ->
dub-engine.js -> dubbing.js -> content.js -> youtube.js
```

`background.js` is the MV3 service worker; it pulls in `cst-cache.js`, `cost-policy.js` and
`dub-audio.js` on its own. If you add a file, add it to `manifest.json` in dependency order.

## Source (30 files, 18,637 lines)

| File | Lines | Role | Global export |
|---|---|---|---|
| `youtube.js` | 1948 | YouTube engine: bridge handshake, track pick, timedtext parse, self-drawn overlay, prefetch pool, controls + quick menu | none (same-world sibling of `content.js`, reads its `state`) |
| `content.js` | 2161 | Coursera engine, also serving any other video page on demand ("generic", see `SUBTITLE.md`), **plus** the shared toast/messaging layer | `window.CST_UI`, `window.CST_LAST_AI_INFO` |
| `options.html` | 1560 | Settings page, 4 tabs. ~810 lines are inline `<style>`; markup is only the rest | n/a |
| `dub-engine.js` | 1521 | TTS providers + scheduler + video-clock sync + audio ducking | `CST_DUB_ENGINE` |
| `background.js` | 1308 | Service worker: the only place that talks to Gemini, does TTS, owns cache + cost ledger + per-key model access | n/a (message router) |
| `popup.css` | 995 | Popup styling only | n/a |
| `options.js` | 1155 | Settings logic. No Save button: debounced autosave every 350ms, flushed on `pagehide` | n/a |
| `settings-backup.js` | 76 | Pure build/parse of the settings backup file (all of `storage.sync` + `edits:*`, key optional) | `CST_BACKUP` (options page only) |
| `vi-segmenter.js` | 890 | Vietnamese cue segmentation + line breaking, two-stage dynamic programming over syllable gaps | `CST_VI_SEG` |
| `dub-planner.js` | 835 | Pure function: text -> speech script -> prosody and timing. No I/O | `CST_DUB_PLAN` |
| `glossary.js` | 669 | Pure data: 17 domain term groups, normalize rules, proper nouns never to translate | `CST_GLOSSARY_GROUPS` and friends (globalThis + module.exports) |
| `dubbing.js` | 481 | Thin page-level dubbing controller: settings, provider pick, badge, hold-video-while-preparing | `window.CST_DUB` |
| `context-engine.js` | 378 | Domain detection + per-video sliding-window context sent with each translation | `CST_CONTEXT` |
| `cst-cache.js` | 319 | Two-tier LRU cache (RAM -> IndexedDB) for translations and audio | `CST_CACHE` |
| `dub-audio.js` | 673 | Pure WAV/PCM work: decode, rumble cut, hiss removal, normalize, silence, split, pause shaping | `CST_DUB_AUDIO` |
| `cost-policy.js` | 294 | **Single source of truth** for the model catalog, cost modes, budgets, difficulty routing, local-TTS config | `CST_COST` |
| `popup.js` | 283 | Popup logic; re-injects content scripts if they are missing | n/a |
| `yt-bridge.js` | 299 | MAIN-world page bridge: reads YouTube's internal player response, fetches timedtext with the player's `pot` token | none (postMessage protocol only) |
| `subtitle-style.js` | 293 | Shared subtitle font/stroke/position styling and its defaults | `CST_STYLE` |
| `player-ui.js` | 424 | The product mark, the control-bar button and the quick-menu stylesheet, shared by both players | `CST_PLAYER_UI` |
| `subtitle-edits.js` | 166 | The viewer's corrections to translated lines, per video in `storage.local`; `sync` lays them over the overlay cues and the dubbing groups | `CST_EDITS` |
| `transcript.js` | 378 | Transcript panel beside the player: jump to a line, search, edit a line, export .srt | `CST_TRANSCRIPT` |
| `chrome-shim.js` | 174 | Fakes `chrome.*` so `popup.html` / `options.html` open outside the extension. Self-disables inside it | `window.chrome` |
| `popup.html` | 164 | Popup markup | n/a |
| `vi-quality.js` | 213 | Deterministic "machine-translation smell" detector; score above threshold triggers a retranslate | `CST_QUALITY` |
| `lang-detect.js` | 130 | Source-language decision without an API call | `CST_LANG` |
| `version-history.js` | 747 | Release history data (66 entries, Vietnamese) for the Settings > Lịch sử phiên bản tab. Single source; `ui.test.js` pins entry 0 to `manifest.version` | `CST_HISTORY` |
| `version-check.js` | 55 | Warns when the loaded extension version differs from the version on disk | `CST_VERSION_CHECK` |
| `theme.js` | 42 | Light/Dark theme for the popup and settings page. Applies instantly from `localStorage` to avoid a flash, then syncs from `storage.sync`. Loaded by `popup.html` and `options.html` only, not a content script | `window.CST_THEME` |
| `build-info.js` | 6 | **Generated** by `tools/bump-version.js`. Never edit | `CST_BUILD` |

## Who consumes what

- `CST_COST` -> `background.js`, `content.js`, `dubbing.js`, `options.js`
- `CST_CACHE` -> `background.js`, `dub-engine.js`
- `CST_DUB_PLAN`, `CST_DUB_AUDIO` -> `dub-engine.js` (and `dub-audio.js` also into `background.js`)
- `CST_DUB_ENGINE` -> `dubbing.js`, `options.js` (voice preview)
- `CST_DUB` -> `youtube.js`, `content.js`
- `CST_UI.toast` -> `dubbing.js`, `youtube.js`
- `CST_STYLE` -> `content.js`, `youtube.js`, `options.js`
- `CST_LANG` -> `content.js`, `youtube.js`
- `CST_THEME` -> `options.js` (the theme buttons)
- `glossary.js` exports like the others (globalThis, window, module.exports); `tests/backlog.test.js` loads it.

## Tests and tooling (22 files, 5,456 lines)

See `TESTING.md`. Short version: 18 files in `npm test` (listed in `package.json`), all offline; 3 manual scripts;
5 browser harness pages under `tests/harness/`; `tools/bump-version.js` owns the version number.

`tools/vieneu-autostart.command` (63 lines, zsh, executable) installs a macOS LaunchAgent
`com.damduy.vieneu` that starts the VieNeu TTS server at login and restarts it if it dies.
Double-click installs; `--uninstall` removes. It is a user-machine utility, not part of
the extension.

## Not source

`README.md` (354 lines, mostly a 25-release changelog, Vietnamese, user-facing) ·
`images/`, `icons/` · `tests/audio/*.wav` real voice fixtures · `.claude/launch.json` a static
file server for the harness pages.
