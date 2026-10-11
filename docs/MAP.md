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

## Source (32 files, ~24,700 lines)

| File | Lines | Role | Global export |
|---|---|---|---|
| `youtube.js` | 2104 | YouTube engine: bridge handshake, track pick, timedtext parse, self-drawn overlay, prefetch pool, controls + quick menu | none (same-world sibling of `content.js`, reads its `state`) |
| `content.js` | 2506 | Coursera engine, also serving any other video page on demand ("generic", see `SUBTITLE.md`), **plus** the shared toast/messaging layer | `window.CST_UI`, `window.CST_LAST_AI_INFO` |
| `options.html` | 1499 | Settings page, 4 tabs. ~850 lines are inline `<style>`; markup is only the rest | n/a |
| `dub-engine.js` | 2424 | TTS providers + scheduler + video-clock sync + audio ducking | `CST_DUB_ENGINE` |
| `background.js` | 1801 | Service worker: the only place that talks to Gemini, does TTS, owns cache + cost ledger + per-key model access | n/a (message router) |
| `popup.css` | 995 | Popup styling only | n/a |
| `options.js` | 1356 | Settings logic. No Save button: debounced autosave every 350ms, flushed on `pagehide` | n/a |
| `settings-backup.js` | 76 | Pure build/parse of the settings backup file (all of `storage.sync` + `edits:*`, key optional) | `CST_BACKUP` (options page only) |
| `vi-segmenter.js` | 890 | Vietnamese cue segmentation + line breaking, two-stage dynamic programming over syllable gaps | `CST_VI_SEG` |
| `dub-planner.js` | 1086 | Pure function: text -> speech script -> prosody and timing. No I/O | `CST_DUB_PLAN` |
| `glossary.js` | 1338 | Pure data: 19 domain term groups, `GLOSSARY_VI` settled Vietnamese renderings, normalize rules, proper nouns never to translate, `resolveEnabledGroups` | `CST_GLOSSARY_GROUPS` and friends (globalThis + module.exports) |
| `dubbing.js` | 561 | Thin page-level dubbing controller: settings, provider pick, badge, hold-video-while-preparing, health line and diagnostics text (`describeHealth`, `diagnostics`) | `window.CST_DUB` |
| `context-engine.js` | 536 | Domain detection + per-video sliding-window context sent with each translation | `CST_CONTEXT` |
| `cst-cache.js` | 322 | Two-tier LRU cache (RAM -> IndexedDB) for translations and audio | `CST_CACHE` |
| `dub-audio.js` | 609 | Pure WAV/PCM work: decode, rumble cut, hiss removal, normalize, silence, split; pause shaping (`alignStops` places the voice's stops on the text, `shapePauses` applies the prosody model's decisions) | `CST_DUB_AUDIO` |
| `dub-prosody.js` | 831 | Pure prosody model (1.7.6): boundary value of every gap between words, pause roles and lengths, which of a take's stops to keep (dynamic program), breathing commas, the value of a segment cut; 1.8.0 clause frames (`constituents`), gap tiers, `signature` (VieNeu cache key), `tokenMap`. See `DUBBING.md` "Prosody model" | `CST_DUB_PROSODY` |
| `dub-speech.js` | 567 | Pure (1.7.8): English spans inside Vietnamese speech (lexicon, token shapes, evidence; 1.8.0 a three-state confidence score, 5+ letter codes) and the text VieNeu is sent for them (`render`: `<en>` tags, respellings, model numbers, at most 8 tags); `spanGaps` for the prosody model. Holds a generated block (`tools/build-speech-tables.js`). See `DUBBING.md` "English inside Vietnamese speech" | `CST_DUB_SPEECH` |
| `cost-policy.js` | 369 | **Single source of truth** for the model catalog, cost modes, budgets, difficulty routing, local-TTS config | `CST_COST` |
| `popup.js` | 324 | Popup logic; re-injects content scripts if they are missing | n/a |
| `yt-bridge.js` | 299 | MAIN-world page bridge: reads YouTube's internal player response, fetches timedtext with the player's `pot` token | none (postMessage protocol only) |
| `subtitle-style.js` | 293 | Shared subtitle font/stroke/position styling and its defaults | `CST_STYLE` |
| `player-ui.js` | 440 | The product mark, the control-bar button and the quick-menu stylesheet, shared by both players | `CST_PLAYER_UI` |
| `subtitle-edits.js` | 180 | The viewer's corrections to translated lines, per video in `storage.local`; `sync` lays them over the overlay cues and the dubbing groups | `CST_EDITS` |
| `transcript.js` | 391 | Transcript panel beside the player: jump to a line, search, edit a line, export .srt | `CST_TRANSCRIPT` |
| `chrome-shim.js` | 174 | Fakes `chrome.*` so `popup.html` / `options.html` open outside the extension. Self-disables inside it | `window.chrome` |
| `popup.html` | 165 | Popup markup | n/a |
| `vi-quality.js` | 671 | Deterministic "machine-translation smell" detector; score above threshold triggers a retranslate | `CST_QUALITY` |
| `lang-detect.js` | 132 | Source-language decision without an API call | `CST_LANG` |
| `version-history.js` | 1614 | Release history data (one entry per version, Vietnamese) for the Settings > Lịch sử phiên bản tab. Single source; `ui.test.js` pins entry 0 to `manifest.version` | `CST_HISTORY` |
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

## Tests and tooling (`tests/*.js`: 38 files, ~13,200 lines)

See `TESTING.md`. Short version: 25 files in `npm test` (listed in `package.json`: a new test file must be added there), all offline; 4 manual scripts;
9 browser harness pages under `tests/harness/` (`live.html` has its own server, `live-server.js`; `headless.js` runs any of them in a headless Chrome); `tests/pin-cases.py` holds the Python scenarios `share.test.js` runs (`vieneu-pin.py` and the updater in-process, the network scripted, sleeps recorded); `tools/bump-version.js` owns the version number;
`tools/doc-sizes.js` (1.9.4) rewrites the Lines column and the counts above, the "~Tests" column of
`TESTING.md`, and reports what it cannot write: a test file with no row in `TESTING.md`, stale sizes
in `CLAUDE.md` (`--check` changes nothing, exits 1 when off). `/ban-giao` runs it.

`tools/vieneu-autostart.command` (zsh, executable) installs a macOS LaunchAgent
`com.damduy.vieneu` that starts the VieNeu TTS server at login and restarts it if it dies; the plist
runs a `/bin/sh -c` line that reads the pinned model offline when its marker exists (below).
Double-click installs; `--uninstall` removes; `--write-only` rewrites the plist without reloading it
(the updater's migration). It is a user-machine utility, not part of the extension.
`tools/vieneu-autostart.ps1` + `.cmd` are its Windows twin: a value `DichPhuDe VieNeu` under
HKCU `...\CurrentVersion\Run` (not a Startup `.lnk`: WScript.Shell rejects non-ANSI paths, and a
Vietnamese user name failed in CI) runs `.venv\Scripts\pythonw.exe run-vieneu.pyw` (copied from
`tools/vieneu-runner.pyw`): no window, no
hidden PowerShell for an antivirus to flag; a supervisor (one per user, mutex) restarts
`run-vieneu.pyw --serve`, which sets AboveNormal priority, leaves power throttling and runs
`apps.openai_speech` in-process with its log in `server.log`; it also runs the updater below every
30 min. `-Stop`, `-Uninstall` stop the supervisor, then the helpers it started (`dichphude-update.py`,
the `vieneu-pin.py` download, whose lock goes with them), then the server; only processes
whose command line holds that VieNeu folder are touched. ASCII only (5.1 reads BOM-less as ANSI).

**Share build.** Friends install from a separate **public** repo,
`github.com/mrthanhduy2000/dich-phu-de-long-tieng`, cloned next to this one as
`../dich-phu-de-long-tieng`. `node tools/publish-share.js --push` rebuilds it from here (refused, with
"bump the version first", while any shipped file differs from that repo's last commit and
`extension/manifest.json` is not higher than the version it holds: friends' updaters only take a
higher version, and `tools/` changes earn no bump by the repo rule, so bump in the release): the runtime
files under `extension/` (plus the autostart helpers and the runner in `extension/tools/`), and from
`tools/share/` the Vietnamese `README.md` (the prompt friends give their AI, an error table),
`install-mac.sh`, `install-windows.ps1`, `vieneu/openai_speech.py` (our patched VieNeu server file;
`.patch` is the diff), `LICENSE-Apache-2.0.txt`, a `NOTICE` built from the pin (attribution for
VieNeu-TTS and MOSS, both Apache 2.0) and `.github/workflows/install-test.yml`. The installers need no
git and no admin: they download zips, keep the extension in a fixed `~/DichPhuDe` (Chrome keys
settings to the path), pin VieNeu to one commit, run `uv sync`, install the pinned voice model with
VieNeu's own Python (`extension/tools/vieneu-pin.py --install`, below; a failure only warns), install
the autostart and wait until `/health` answers with a `sample_rate`; re-running one is the update,
`--uninstall` (Mac) / `DPD_UNINSTALL=1` (Windows) removes (the model goes with the VieNeu folder).
`DPD_REF=<commit>` makes the installers and the updater download that commit instead of `main`. Guards: a port 8000 owner that is not VieNeu is named and stops the install; a
`VieNeu-TTS` folder without `.dichphude-vieneu` is never overwritten; on the Mac the
`com.damduy.vieneu` service is touched only when its plist runs that folder (the author's machine has
its own: a test uninstall once took it down). **Every push runs the install test** on clean GitHub
machines (Windows x64, x64 with a Vietnamese path, Windows ARM, macOS Apple chip, macOS Intel), at
`DPD_REF` = the pushed commit (the macOS updater LaunchAgent carries it too): the one-line install,
the pinned model (all its files from the GitHub release, read from the first install's summary, none
from Hugging Face; marker, every byte, the server started offline: its first log line on Windows, its
own environment via `ps eww` on macOS, nothing in `~/.cache`), a spoken line, restart after a kill,
update (downloads 0 MB of model), uninstall; a sixth job downloads every release asset with no
fallback and **fails when the release is missing**. So the order is: publish the model release first
(`--release-model`), then push. Check it after publishing
(`gh run list -R mrthanhduy2000/dich-phu-de-long-tieng`). **Friends' installs update themselves**:
`tools/dichphude-update.py` (copied to `<VieNeu>/dichphude-update.py`, the extension path in
`<VieNeu>/.dichphude-ext`) asks GitHub every 6 h, stages a newer version in `<VieNeu>/.dpd-staged`,
and lays it over the extension folder only while Chrome is closed (Chrome reads an unpacked
extension from disk at start); macOS runs it from LaunchAgent `com.damduy.dichphude.update` every
30 min, Windows from the supervisor. Every run it also keeps the pinned model current: a stat-only
`quick_ok` (marker names this pin, every file at its pinned size, `refs/main` on the revision); on any
mismatch `vieneu-pin.py --install`, which repairs the copy or withdraws the marker (a failed pin is
retried after 6 h, a success or a held lock clears that wait). Once the copy passes and the server's
last `VieNeu model:` log line says offline, an install our installer made (`.dichphude-vieneu`)
drops the copy older versions left in `~/.cache/huggingface` (logged once; never on the author's
machine). On macOS a service plist without the size-checked start line (`pinned_ok`) is rewritten
once (`vieneu-autostart.command --write-only`, read at the next login). Applying only while Chrome is
closed, not `chrome.runtime.reload()`: a probe on 2026-10-11 (headless branded Chrome, throwaway
profile, developer mode ON) kept the extension enabled with its storage after a reload from the
service worker (2 of 2 runs); with developer mode OFF the reload brings it back DISABLED
(`unsupportedDeveloperExtension`), and the "blocked" result of 2026-10-08 was such a profile. A
friend may turn developer mode off; the restart path needs neither, and never mixes two versions'
files in a running Chrome. So a
**push to the share repo reaches every friend within hours**: only publish when the user asks
("cập nhật cho bạn bè"), and only with the install test green. After a first install the
installers open `extension/tools/huong-dan-cai-dat.html` in Chrome (the one manual step, with copy
buttons); the desktop updater exists only where there is no VieNeu (no updater). If `~/VieNeu-TTS` moves to a new upstream commit, update the pin in both
installers and copy the patched file again. `tests/share.test.js` guards the file list, the ASCII
rule and the pin, and runs the start lines, the downloads, the updater and the push guard offline.
Test the Mac installer locally only with `DPD_NO_AUTOSTART=1` and outside the
sandbox (it cannot reach 127.0.0.1).

**Pinned model** (2026-10-10; friends' installs built 2026-10-11, live once the release is published
and pushed: BACKLOG 42). `tools/share/vieneu-model.json` lists every
model file the VieNeu server loads (two Hugging Face repos at fixed revisions, size + sha256, the flat
`asset` name), the GitHub release that mirrors them (`release`: share repo, tag
`vieneu-model-<turbo7>-<moss7>`) and the voices file inside the VieNeu code. `tools/vieneu-pin.py`
(stdlib only, ASCII; ships in `extension/tools/` with the JSON beside it): no flag checks a copy
offline by hash (exit 1 on any difference); `--quick` the same by size (`quick_ok`); `--install`
downloads what is missing or wrong (release asset, else Hugging Face at the pinned revision, never
`main`), resumes a cut `.part`, checks size + sha256, then writes `refs/main` and the marker
`<VieNeu>/models/hf/.pinned-ok` (exit 0 ok, 1 not, 2 another install holds `.pin-lock`, taken over
from a dead run by one run only); `--if-changed` returns at once when `quick_ok` passes; `--fetch` is
the author's rebuild through huggingface_hub at the pinned revision (it writes `refs/main` itself and
only reports a moved `main`). The marker is the pin's identity (both revisions, the VieNeu commit, a
digest of the file list), a blank line, then `ref <revision> <path>` and `size <bytes> <path>` lines
(paths relative to HF_HOME). Every start script reads the copy with `HF_HOME` + `HF_HUB_OFFLINE=1`
only while the marker exists **and** every line holds (a stat per file, no Python, no pin needed),
decided at each start: the macOS plist runs a `/bin/sh -c` line (`pinned_ok`), the installer's
`cst-start.command` the same, `vieneu-runner.pyw` checks before it imports the server; otherwise VieNeu
fetches the model itself as before and the log says `pinned copy incomplete`. Downloads: a source is
given up after 3 attempts in a row that received nothing (a cut with progress resets the count) or 2 h
on one file; 404/410 = the source lacks the file, 401/403/407 = a network or proxy block, 408/425/429/5xx
retried after `Retry-After` (30 s at most); a resumed `.part` that fails its hash is fetched once more
from zero, and a server that ignores `Range` writes to a fresh file swapped in only after its hash.
`node tools/publish-share.js --release-model` (verify, then `gh release create/upload --clobber`, then
every asset's size and GitHub `digest` against the pin, staging removed even on failure) publishes the
release from the author's copy. Why and how: `DUBBING.md` "Pinned model".

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
where the free voice's segments are cut for sentences given as subtitle lines, and (2.0.8) where
`breathText` forces a stop with a comma (`--breath=` tries other thresholds); no server.
`tests/blind-corpus.js` (1.8.0) and `tests/blind-corpus-2.js` (1.8.2) are blind splits written by a
separate agent that never read the rules, each scored once (`pron-eval --corpus=`, `syntax-eval
--corpus=`); both are seen now, a new one is needed per round.
`tools/ext-storage.js` (2.3.0) reads the extension's `storage.local` straight from Chrome's LevelDB folder
(Snappy tables + write-ahead log, newest sequence wins), read-only: list keys, `--key=costLedger`,
`--prefix=ytcache4_ --out=<dir>` for the user's real translations (source lines against Vietnamese per
group) to score a quality change offline; skips any key named like an API key.
`tools/batch-review.js` (2.4.2) is the first pass of a batch review over such a dump: per video the
quality flags and, with `--sim`, the dubbing simulation (`docs/TESTING.md`). `tools/review.js` (2.4.7)
runs a whole batch review in one command (`--close` archives the batch and moves `REVIEW_MARK`);
`tools/regress.js` (2.4.7) is the regression net over every reviewed video and the simulator
scenarios, against the local `review-archive/baseline.json`.
`tools/vieneu-bench.js [n]` renders one sentence n times (default 3) on the local VieNeu server and
prints its render speed (RTF: render time / audio length; under 0.4 is comfortable); sandbox off.

## Not source

`README.md` (~110 lines, Vietnamese, user-facing: features, install, VieNeu setup, limits; no changelog, that is `version-history.js`) ·
`images/`, `icons/` · `tests/audio/*.wav` real voice fixtures · `.claude/launch.json` a static
file server for the harness pages, plus `live` / `live-slow` for `live.html`.
