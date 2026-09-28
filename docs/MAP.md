# File map

Line numbers anywhere in `docs/` are anchors, not addresses. They drift. **Grep the symbol name
before you edit.** Symbol names are stable, line numbers are not.

## Manifest load order (matters: later files depend on earlier globals)

`yt-bridge.js` is injected separately, MAIN world, `document_start`, YouTube only.

Everything else is one content-script bundle at `document_idle`, in this order:

```
glossary.js -> cst-cache.js -> cost-policy.js -> lang-detect.js -> vi-segmenter.js ->
subtitle-style.js -> subtitle-edits.js -> player-ui.js -> transcript.js -> context-engine.js -> vi-quality.js ->
dub-planner.js -> dub-prosody.js -> dub-speech.js -> dub-audio.js -> dub-engine.js -> dubbing.js -> content.js -> youtube.js
```

`background.js` is the MV3 service worker; it pulls in `cst-cache.js`, `cost-policy.js`,
`vi-segmenter.js`, `dub-planner.js`, `dub-prosody.js`, `dub-speech.js` and `dub-audio.js` on its own
(`importScripts`, that order: the pause shaping reads the text through the segmenter, the planner's
syllable count and, 1.7.8, the English spans).
`options.html` loads the dubbing files with plain `<script>` tags, same order. If you add a file, add
it to `manifest.json` in dependency order (and to `importScripts`, `options.html`, the harness pages
under `tests/harness/` and the vm file lists in `cost`, `hardening` and `ui` tests if it is a dubbing file).

## Source (32 files, ~22,200 lines)

| File | Lines | Role | Global export |
|---|---|---|---|
| `youtube.js` | 2017 | YouTube engine: bridge handshake, track pick, timedtext parse, self-drawn overlay, prefetch pool, controls + quick menu | none (same-world sibling of `content.js`, reads its `state`) |
| `content.js` | 2311 | Coursera engine, also serving any other video page on demand ("generic", see `SUBTITLE.md`), **plus** the shared toast/messaging layer | `window.CST_UI`, `window.CST_LAST_AI_INFO` |
| `options.html` | 1451 | Settings page, 4 tabs. ~850 lines are inline `<style>`; markup is only the rest | n/a |
| `dub-engine.js` | 2201 | TTS providers + scheduler + video-clock sync + audio ducking | `CST_DUB_ENGINE` |
| `background.js` | 1452 | Service worker: the only place that talks to Gemini, does TTS, owns cache + cost ledger + per-key model access | n/a (message router) |
| `popup.css` | 995 | Popup styling only | n/a |
| `options.js` | 1165 | Settings logic. No Save button: debounced autosave every 350ms, flushed on `pagehide` | n/a |
| `settings-backup.js` | 76 | Pure build/parse of the settings backup file (all of `storage.sync` + `edits:*`, key optional) | `CST_BACKUP` (options page only) |
| `vi-segmenter.js` | 890 | Vietnamese cue segmentation + line breaking, two-stage dynamic programming over syllable gaps | `CST_VI_SEG` |
| `dub-planner.js` | 929 | Pure function: text -> speech script -> prosody and timing. No I/O | `CST_DUB_PLAN` |
| `glossary.js` | 1338 | Pure data: 19 domain term groups, `GLOSSARY_VI` settled Vietnamese renderings, normalize rules, proper nouns never to translate, `resolveEnabledGroups` | `CST_GLOSSARY_GROUPS` and friends (globalThis + module.exports) |
| `dubbing.js` | 557 | Thin page-level dubbing controller: settings, provider pick, badge, hold-video-while-preparing, health line and diagnostics text (`describeHealth`, `diagnostics`) | `window.CST_DUB` |
| `context-engine.js` | 471 | Domain detection + per-video sliding-window context sent with each translation | `CST_CONTEXT` |
| `cst-cache.js` | 322 | Two-tier LRU cache (RAM -> IndexedDB) for translations and audio | `CST_CACHE` |
| `dub-audio.js` | 607 | Pure WAV/PCM work: decode, rumble cut, hiss removal, normalize, silence, split; pause shaping (`alignStops` places the voice's stops on the text, `shapePauses` applies the prosody model's decisions) | `CST_DUB_AUDIO` |
| `dub-prosody.js` | 781 | Pure prosody model (1.7.6): boundary value of every gap between words, pause roles and lengths, which of a take's stops to keep (dynamic program), breathing commas, the value of a segment cut; 1.8.0 clause frames (`constituents`), gap tiers, `signature` (VieNeu cache key), `tokenMap`. See `DUBBING.md` "Prosody model" | `CST_DUB_PROSODY` |
| `dub-speech.js` | 555 | Pure (1.7.8): English spans inside Vietnamese speech (lexicon, token shapes, evidence; 1.8.0 a three-state confidence score, 5+ letter codes) and the text VieNeu is sent for them (`render`: `<en>` tags, respellings, model numbers, at most 8 tags); `spanGaps` for the prosody model. Holds a generated block (`tools/build-speech-tables.js`). See `DUBBING.md` "English inside Vietnamese speech" | `CST_DUB_SPEECH` |
| `cost-policy.js` | 300 | **Single source of truth** for the model catalog, cost modes, budgets, difficulty routing, local-TTS config | `CST_COST` |
| `popup.js` | 295 | Popup logic; re-injects content scripts if they are missing | n/a |
| `yt-bridge.js` | 299 | MAIN-world page bridge: reads YouTube's internal player response, fetches timedtext with the player's `pot` token | none (postMessage protocol only) |
| `subtitle-style.js` | 293 | Shared subtitle font/stroke/position styling and its defaults | `CST_STYLE` |
| `player-ui.js` | 424 | The product mark, the control-bar button and the quick-menu stylesheet, shared by both players | `CST_PLAYER_UI` |
| `subtitle-edits.js` | 166 | The viewer's corrections to translated lines, per video in `storage.local`; `sync` lays them over the overlay cues and the dubbing groups | `CST_EDITS` |
| `transcript.js` | 378 | Transcript panel beside the player: jump to a line, search, edit a line, export .srt | `CST_TRANSCRIPT` |
| `chrome-shim.js` | 174 | Fakes `chrome.*` so `popup.html` / `options.html` open outside the extension. Self-disables inside it | `window.chrome` |
| `popup.html` | 164 | Popup markup | n/a |
| `vi-quality.js` | 213 | Deterministic "machine-translation smell" detector; score above threshold triggers a retranslate | `CST_QUALITY` |
| `lang-detect.js` | 130 | Source-language decision without an API call | `CST_LANG` |
| `version-history.js` | 1162 | Release history data (one entry per version, Vietnamese) for the Settings > Lịch sử phiên bản tab. Single source; `ui.test.js` pins entry 0 to `manifest.version` | `CST_HISTORY` |
| `version-check.js` | 55 | Warns when the loaded extension version differs from the version on disk | `CST_VERSION_CHECK` |
| `theme.js` | 42 | Light/Dark theme for the popup and settings page. Applies instantly from `localStorage` to avoid a flash, then syncs from `storage.sync`. Loaded by `popup.html` and `options.html` only, not a content script | `window.CST_THEME` |
| `build-info.js` | 6 | **Generated** by `tools/bump-version.js`. Never edit | `CST_BUILD` |

## Who consumes what

Uses in code, not comments. `background.js` names `CST_UI` and `CST_STYLE` only inside its
`executeScript` probe (are the content scripts already in this tab?), not as a dependency.

Subtitle side:
- `CST_VI_SEG` -> `content.js`, `youtube.js`, `subtitle-style.js`, `subtitle-edits.js`, `options.js`, and the dubbing trio `dub-planner.js`, `dub-prosody.js`, `dub-speech.js`
- `CST_STYLE` -> `content.js`, `youtube.js`, `options.js`
- `CST_LANG` -> `content.js`, `youtube.js`
- `CST_QUALITY` -> `content.js`, `youtube.js`
- `CST_CONTEXT` -> `content.js`
- `CST_GLOSSARY_GROUPS` and friends -> `content.js`, `options.js`; `glossary.js` exports like the others (globalThis, window, module.exports), `tests/backlog.test.js` loads it
- `CST_EDITS` -> `content.js`, `youtube.js`, `options.js`
- `CST_TRANSCRIPT` -> `content.js`, `youtube.js`, `subtitle-edits.js`
- `CST_PLAYER_UI` -> `content.js`, `youtube.js`, `transcript.js`
- `CST_UI` (`content.js`) -> `youtube.js`, `dubbing.js`, `transcript.js` (all for `toast`); `CST_LAST_AI_INFO` (`content.js`) -> `youtube.js`

Dubbing side:
- `CST_DUB_PLAN` -> `dub-engine.js`, `options.js` (voice preview); `dub-prosody.js`, `dub-speech.js` (lazily)
- `CST_DUB_PROSODY` -> `dub-audio.js` (`alignStops`, `shapePauses`), `dub-engine.js` (`plainScript`, `gapAfter`), `dub-planner.js` (`prosodicCut`, lazily), `dub-speech.js` (`vieneuText`, lazily)
- `CST_DUB_SPEECH` -> `dub-engine.js` (`speakScript`), `dub-prosody.js` (`spanGaps`, lazily)
- `CST_DUB_AUDIO` -> `dub-engine.js`, `background.js` (pause shaping, cleanup), `dubbing.js` (`base64ToBytes` for page-cache hits), `options.js` (voice preview)
- `CST_DUB_ENGINE` -> `dubbing.js`, `options.js` (voice preview)
- `CST_DUB` (`dubbing.js`) -> `youtube.js`, `content.js`, `player-ui.js` (`level`), `subtitle-edits.js` (`refreshText`)
- `CST_SPEECH_LEXICON`: read by `dub-speech.js` if a page defines it (local lexicon entries, no UI); nothing sets it today

Shared and settings pages:
- `CST_COST` -> `background.js`, `content.js`, `youtube.js`, `dubbing.js`, `dub-engine.js`, `options.js`
- `CST_CACHE` -> `background.js`, `dub-engine.js`
- `CST_THEME`, `CST_HISTORY`, `CST_BACKUP` -> `options.js`; `CST_VERSION_CHECK` -> `options.js`, `popup.js`

## Tests and tooling (`tests/*.js`: 36 files, ~10,700 lines)

See `TESTING.md`. Short version: 23 files in `npm test` (listed in `package.json`: a new test file must be added there), all offline; 4 manual scripts;
8 browser harness pages under `tests/harness/` (`live.html` has its own server, `live-server.js`); `tools/bump-version.js` owns the version number;
`tools/doc-sizes.js` (1.9.4) rewrites the Lines column and the counts above, the "~Tests" column of
`TESTING.md`, and reports what it cannot write: a test file with no row in `TESTING.md`, stale sizes
in `CLAUDE.md` (`--check` changes nothing, exits 1 when off). `/ban-giao` runs it.

`tools/vieneu-autostart.command` (63 lines, zsh, executable) installs a macOS LaunchAgent
`com.damduy.vieneu` that starts the VieNeu TTS server at login and restarts it if it dies.
Double-click installs; `--uninstall` removes. It is a user-machine utility, not part of
the extension.

`tools/prosody-eval.js` renders the marked sentences of `tests/prosody-corpus.js` on the VieNeu
server once (cached outside the repo) and scores the pause shaping against the marks; `OLD=` scores
an older `dub-audio.js` on the same takes. See `DUBBING.md` "Prosody model".

English in speech (1.7.8), all need `~/VieNeu-TTS`: `tools/vieneu-g2p.py` is the server's exact text
front end (chunks, phonemes; `{"words"}` / `{"normalize"}` modes), run with its own Python.
`tools/pron-eval.js` scores `tests/speech-corpus.js` on those phonemes (`--old=<rev>` for A/B, no
server needed). `tools/speech-ab.js` renders the same corpus with the real voice for an old and the
current version and measures pauses, spans, duration, clicks (sandbox off). `tools/build-speech-tables.js`
regenerates the data block of `dub-speech.js` (rerun after a VieNeu / sea_g2p update).
`tools/playback-sim.js` (1.8.6) runs the real dubbing engine and VieNeu provider against a model of
the service worker queue and the serial VieNeu server on a virtual clock: seeks, pauses, rates,
slow translation or TTS, cached / mixed stores; `OLD=<engine.js>` compares; also used by
`dub.test.js`. No server, no API. See `DUBBING.md` "Delivery".
`tools/context-eval.js` (1.8.3) prints, offline, the average size of every part of the translation
request over `tests/context-corpus.js`. `tools/syntax-eval.js` (1.8.0) scores the prosody model's text-only decisions against the marks, and
where the free voice's segments are cut for sentences given as subtitle lines; no server.
`tests/blind-corpus.js` (1.8.0) and `tests/blind-corpus-2.js` (1.8.2) are blind splits written by a
separate agent that never read the rules, each scored once (`pron-eval --corpus=`, `syntax-eval
--corpus=`); both are seen now, a new one is needed per round.

## Not source

`README.md` (~110 lines, Vietnamese, user-facing: features, install, VieNeu setup, limits; no changelog, that is `version-history.js`) ·
`images/`, `icons/` · `tests/audio/*.wav` real voice fixtures · `.claude/launch.json` a static
file server for the harness pages, plus `live` / `live-slow` for `live.html`.
