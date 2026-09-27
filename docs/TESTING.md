# Testing

No test framework, no dependencies: plain `node --test`. Everything in `npm test` is **fully
offline** - Gemini and Google are faked, timers are virtualised, no TTS server needed.

```bash
npm test          # ~14s. The bar is 0 fail; 1 skip is normal
                  # 442 tests / 441 pass as of 2026-09-27, and the count keeps growing
```

The one skip is intentional (see `reload-fight.test.js` below). **A fail is a regression, not noise.**
The per-file counts below were taken on 2026-09-23 and drift as tests are added; treat them as a
sense of weight, not an assertion.

## The files in `npm test` (the list lives in `package.json`: add a new file there)

| File | ~Tests | Covers |
|---|---|---|
| `segmenter.test.js` | 23 | Vietnamese segmentation and line breaking against `fixtures.js`, compared against the frozen `legacy/old-splitter.js` baseline |
| `context.test.js` | 13 | `context-engine.js` domain detection, sense and phrase hints, `ContextSession`, plus `vi-quality.js` |
| `integration.test.js` | 23 | Runs the **real** `content.js` and `background.js` in a `vm` with a fake `chrome`, fake DOM and fake Gemini |
| `dub.test.js` | 31 | Dub script, prosody, duration fitting, real WAV fixtures, sync under pause / seek / rate change |
| `cost.test.js` | 54 | The full LOCAL -> CACHE -> cheap -> strong -> TTS chain, plus `cst-cache`, `cost-policy`, `dub-planner`, `dub-engine` |
| `hardening.test.js` | 76 | Per-API-key model access, options opening, language auto-detect, no-clipping dubbing, budget caps, the version-scheme rule |
| `bridge.test.js` | 4 | `yt-bridge.js` recovering empty captions that are missing the `pot` token, and restoring the viewer's original caption track |
| `reload-fight.test.js` | 2 | Old and new content scripts coexisting after a reload must not loop forever recreating buttons. **The second case needs `OLD_YT=<path>` and skips without it** |
| `backlog.test.js` | 9 | Settings with one source of truth (no condense code anywhere, `dualMode` via `CST_STYLE.resolveDual`), the single YouTube bridge, glossary loads in Node, segmenter `explain()`, the `buildPhrases` memo, throttled body observers |
| `generic-site.test.js` | 5 | Unlisted sites: shortcut injects the ISOLATED group once through `activeTab` then delivers the command, `chrome://` left alone, no all-sites permission, generic track path, host-prefixed keys |
| `settings.test.js` | 6 | Backup build/parse (key optional, caches excluded, foreign files refused), the Settings wiring, `dubMaxRate` capping every rate, `skipSameLang` on all three sites |
| `voice-pauses.test.js` | 8 | `shapePauses` (unpunctuated stops closed, punctuation kept, a long unpunctuated run keeps its clause-opening stops and closes the one inside a phrase, tight cap), `joinGroups` segmenting, 48 kHz wiring, pause roles at punctuation |
| `spoken-lang.test.js` | 8 | `spokenLanguage` (audio > ASR > title, AI dubs, Vietsub titles), `ytChonTrack` with AI-dub ASR tracks, the gate before the cache |
| `quality.test.js` | 6 | Size scale (100% = old 70%), `lingerCues`, `denoise` (hiss down, voice kept, clean take skipped), FFT round trip, wiring |
| `audit.test.js` | 13 | 1.7.3 audit: popup "Tiếng Anh ở trên" live, dead popup switch gone, Coursera render-loop memo, YouTube does not save a Google-fallback video, daily storage sweep, parallel Google fallback, removed dead code. 1.7.4: leaving a Coursera lecture / a YouTube video mid-load (the only **flow** tests of the two start paths; `pageEnv({ timers, tracks, sendMessage, files, sync })` runs the real `content.js` + `youtube.js` with stubbed bridge and network). 1.7.5: Coursera progressive display (first line after 1 reply), playhead-first order, switch-off mid-run, button redrawn after `busy`, popup progress loop (runs the real `popup.js` on a stub DOM) |
| `voice-clean.test.js` | 9 | `highPass` (rumble cut, voice band kept), the corrected hiss estimate, clause openings as the strongest boundaries and sentence pauses by length (on `dub-prosody.js` since 1.7.6), `shapePauses` keeping a clause-opening stop, lead silence skipped, the 20 ms voiced onset, engine `gapAfter` wiring, no gate |
| `prosody.test.js` | 21 | 1.7.6 prosody model: syllables, graded levels and roles (lead, list, comma before a contrast, fronted clause, question, transition), no pause inside units / after "rằng" / before modal "nên", openers and long subjects as boundaries, the selection (budget, choppy and long runs, floor, tight), memo and determinism, breathing commas, cut values, `prosodicCut` for free voices only, engine `gapAfter` and `plainScript`, three real Mỹ Duyên takes in `tests/audio`, and two guards over the whole marked corpus (`prosody-corpus.js`): commas only at marked gaps, no unit ever chosen |
| `speech.test.js` | 22 | 1.7.8 English in speech (`dub-speech.js`): what VieNeu is sent for unknown codes, word acronyms, camelCase and Vietnamese-syllable names, model numbers; what stays untouched (VieNeu's own tables, Vietnamese codes, A4, U23, shouting, "Con AI", a lone "Tom"); evidence from the English source; unchanged text = same string; 8-tag cap; consistency; the user's adversarial list; the version reading of `adaptForSpeech`; spans as prosody units; the backlog-16 pause rules; engine `speakScript` + the `speak` field; no network; speed; custom entries; the unseen split's fingerprint; three subtitle lines read as one take |
| `ui.test.js` | 13 | Shortcuts (Alt+S / Alt+D / Alt+Shift+V), no blocking `alert`/`confirm` on the user's page, focus rings and reduced-motion, `role=status` toasts, the YouTube quick menu built on a mini-DOM, light/dark theme wiring, the VieNeu autostart script, auto-switch back to VieNeu when the server appears, and the release-history data |

## The two harnesses that make offline testing possible

**`tests/bg-env.js`** runs the real `background.js` inside a `vm`, faking only `chrome.*` and
`fetch`. Options let a test reuse one `storage.local` object across simulated worker restarts (so you
can test "extension reloaded, data intact"), share a fake IndexedDB backend, and compress timeouts
(`fastTimeouts`, `timeScale`). Used by `hardening.test.js`, `ui.test.js` and `vieneu.live.js`.
**If you add a service-worker feature, test it here, not by hand in Chrome.**

**`tests/dub-sim.js`** gives a virtual `Clock` plus `FakeVideo`, `FakeAudio` and `makeFakeSpeech`, so
a 20-minute video simulates deterministically in milliseconds. Used by `dub.test.js` and
`cost.test.js`.

Other helpers: `fixtures.js` real subtitle cases carrying `forbid` / `noLineEnd` / `noLineStart`
constraints · `quality.js` the shared violation scorer and `greedyWrap`, `LINE_MAX` 42 ·
`legacy/old-splitter.js` a frozen copy of the v1.0.4 splitter, kept only as a comparison baseline,
not dead code.

## Manual scripts, not in `npm test`

`speech-bench.live.js` (1.7.5, 1.7.6): 12 representative sentences through the real VieNeu path
(adaptForSpeech, breathing commas, server, cleanTake, shapePauses, prepareSpeech); prints the voice's
own stops with the word before each and what was kept, and the rate. `OUT=<dir>` writes WAVs,
`REPS=3` repeats (the voice is not deterministic: judge a pause rule on several takes, and A/B old
vs new shaping on the **same** take).

`../tools/prosody-eval.js` (1.7.6): the pause-shaping score on 104 marked sentences x 5 takes (see
`DUBBING.md` "Prosody model"). Renders missing takes (sandbox off), then scores; `OLD=<file>` A/Bs
an older `dub-audio.js` on the same takes. The marks are one reader's judgment: read WRONG as
"worth listening to", not as ground truth.

English in speech (1.7.8), corpus `tests/speech-corpus.js` (dev 62 / validation 24 / unseen 24; the
unseen split is scored once per release and its fingerprint is pinned in `speech.test.js`):

```bash
node tools/pron-eval.js --split=dev,validation --old=HEAD --detail   # VieNeu phonemes, no server
node tools/speech-ab.js --split=dev,validation --wav=$TMPDIR/ab        # real takes, sandbox off
node tools/build-speech-tables.js                                     # regenerate dub-speech.js data
```

`pron-eval` runs the server's front end offline (`tools/vieneu-g2p.py` with `~/VieNeu-TTS/.venv`) and
judges each marked entity: English reading, English letter names, "chấm" not "phẩy", no quantity for
a model number. It checks phonemes, not sound. `speech-ab` takes are cached by voice + exact text
(`TAKES=`), so texts that did not change share takes and only the decisions differ; its audio
numbers (clicks, level jumps, clipping) are proxies.

```bash
npm run compare              # old vs new segmenter over every fixture. Offline
node tests/vieneu.live.js    # REQUIRES the local TTS server at 127.0.0.1:8000
node tests/tools-fit-voice.js  # refits the speech-duration model to tests/audio/linh-calibration.json
```

`vieneu.live.js` allows only that one host and rejects every other request.
Start the server with `open ~/VieNeu-TTS/cst-start.command`, check it with
`curl 127.0.0.1:8000/health`.

## Browser harness pages (`tests/harness/`)

`smooth.html` + `smooth-prep.js`: real `DubEngine` in Chrome playing real VieNeu audio (prep
calls the local server, output in the git-ignored `smooth/`), counting `playbackRate` changes and
seeks on playing voices. The clock is a silent `<audio>`: Chrome pauses a muted `<video>` in a
hidden pane. Scripts load with a cache-busting query; `runSmooth(120)` then poll `summary()`. Prep
runs the VieNeu path of `background.js` (`cleanTake`, `shapePauses`, `prepareSpeech`); keep it in
step when that path changes. The browser tool times out at 45 s: poll `H.done`, do not await it.

`generic.html` (+ `generic.vtt`): a bare `<video controls>` in an article, canned translations in
place of the service worker. Default: a `<track>` element; `?mode=script`: `addTextTrack` only.
Serve with the `static` launch config. The pane's rAF stops while it is hidden: call `csRender()`
by hand after a seek.

For the things Node cannot fake. Open in a real Chrome tab; `.claude/launch.json` defines a static
server on port 8765 for this.

`sw.html` + `sw-worker.js` run the real `background.js` in a Web Worker with real `importScripts`,
real IndexedDB, real `crypto.subtle` and real `AbortController` · `cache.html` IndexedDB surviving a
reload · `e2e-model.html` model-picker persistence, real 404-for-a-new-key behaviour, the
extension-reload path · `dub.html` a real `HTMLAudioElement` not clipping 4.4s of audio under a cue
between 0.2 and 3.0s · `overlay.html` subtitle layer rendering.

## Adding a test

Put it in the file that already owns that area, and add nothing to `package.json` unless you create a
new file (then add it to the `test` script). Prefer `bg-env.js` or `dub-sim.js` over a new fake.
Test names are Vietnamese, matching the rest of the suite.

Two traps in `ui.test.js` that cost a session real time:

- Loading `youtube.js` in a `vm` runs its bootstrap, whose `setInterval`s keep the Node test runner
  alive forever. Give the sandbox a `location.hostname` that is **not** `youtube.com` so
  `ytKhoiDong()` returns early, and hand back a `donTimers()` that clears everything the sandbox
  created.
- `const` declarations inside a `vm` script (`yt`, `state`, ...) never become properties of the
  sandbox object. Reach them with `vm.runInContext("yt.active = true", sb)`, not `sb.yt`.

## Live measurement in the user's Chrome (claude-in-chrome)

- A tab opened by automation is often hidden (`document.hidden`): Chrome then does not load the video
  at all (readyState 0). Bring it to the front with Control_Chrome `switch_to_tab` first.
- Dubbing diagnostics: set `localStorage.cstDubDebug = "1"` on youtube.com, reload; the engine writes
  a JSON snapshot to `<html data-cst-dub>` every 500 ms (`started` has due time, start, rate, overrun).
- `chrome://extensions` and `chrome-extension://` pages cannot be opened by the tools: only the user can Reload.
- Prefer a cached video (`ytcache4_*`): no Gemini cost.
