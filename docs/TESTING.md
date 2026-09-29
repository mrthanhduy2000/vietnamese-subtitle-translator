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
| `segmenter.test.js` | 26 | Vietnamese segmentation and line breaking against `fixtures.js`, compared against the frozen `legacy/old-splitter.js` baseline |
| `context.test.js` | 14 | `context-engine.js` domain detection, sense and phrase hints, `ContextSession`, plus `vi-quality.js` |
| `integration.test.js` | 24 | Runs the **real** `content.js` and `background.js` in a `vm` with a fake `chrome`, fake DOM and fake Gemini |
| `dub.test.js` | 70 | Dub script, prosody, duration fitting, real WAV fixtures, sync under pause / seek / rate change |
| `cost.test.js` | 58 | The full LOCAL -> CACHE -> cheap -> strong -> TTS chain, plus `cst-cache`, `cost-policy`, `dub-planner`, `dub-engine` |
| `hardening.test.js` | 104 | Per-API-key model access, options opening, language auto-detect, no-clipping dubbing, budget caps, the version-scheme rule |
| `bridge.test.js` | 4 | `yt-bridge.js` recovering empty captions that are missing the `pot` token, and restoring the viewer's original caption track |
| `reload-fight.test.js` | 3 | Old and new content scripts coexisting after a reload must not loop forever recreating buttons. **The second case needs `OLD_YT=<path>` and skips without it** |
| `backlog.test.js` | 9 | Settings with one source of truth (no condense code anywhere, `dualMode` via `CST_STYLE.resolveDual`), the single YouTube bridge, glossary loads in Node, segmenter `explain()`, the `buildPhrases` memo, throttled body observers |
| `generic-site.test.js` | 5 | Unlisted sites: shortcut injects the ISOLATED group once through `activeTab` then delivers the command, `chrome://` left alone, no all-sites permission, generic track path, host-prefixed keys |
| `settings.test.js` | 6 | Backup build/parse (key optional, caches excluded, foreign files refused), the Settings wiring, `dubMaxRate` capping every rate, `skipSameLang` on all three sites |
| `voice-pauses.test.js` | 9 | `shapePauses` (unpunctuated stops closed, punctuation kept, a long unpunctuated run keeps its clause-opening stops and closes the one inside a phrase, tight cap), `joinGroups` segmenting, 48 kHz wiring, pause roles at punctuation |
| `spoken-lang.test.js` | 9 | `spokenLanguage` (audio > ASR > title, AI dubs, Vietsub titles), `ytChonTrack` with AI-dub ASR tracks, the gate before the cache |
| `quality.test.js` | 6 | Size scale (100% = old 70%), `lingerCues`, `denoise` (hiss down, voice kept, clean take skipped), FFT round trip, wiring |
| `audit.test.js` | 13 | 1.7.3 audit: popup "Tiếng Anh ở trên" live, dead popup switch gone, Coursera render-loop memo, YouTube does not save a Google-fallback video, daily storage sweep, parallel Google fallback, removed dead code. 1.7.4: leaving a Coursera lecture / a YouTube video mid-load (the only **flow** tests of the two start paths; `pageEnv({ timers, tracks, sendMessage, files, sync })` runs the real `content.js` + `youtube.js` with stubbed bridge and network). 1.7.5: Coursera progressive display (first line after 1 reply), playhead-first order, switch-off mid-run, button redrawn after `busy`, popup progress loop (runs the real `popup.js` on a stub DOM) |
| `voice-clean.test.js` | 9 | `highPass` (rumble cut, voice band kept), the corrected hiss estimate, clause openings as the strongest boundaries and sentence pauses by length (on `dub-prosody.js` since 1.7.6), `shapePauses` keeping a clause-opening stop, lead silence skipped, the 20 ms voiced onset, engine `gapAfter` wiring, no gate |
| `prosody.test.js` | 33 | 1.7.6 prosody model: syllables, graded levels and roles (lead, list, comma before a contrast, fronted clause, question, transition), no pause inside units / after "rằng" / before modal "nên", openers and long subjects as boundaries, the selection (budget, choppy and long runs, floor, tight), memo and determinism, breathing commas, cut values, `prosodicCut` for free voices only, engine `gapAfter` and `plainScript`, three real Mỹ Duyên takes in `tests/audio`, and two guards over the whole marked corpus (`prosody-corpus.js`): commas only at marked gaps, no unit ever chosen |
| `speech-context.test.js` | 13 | 1.8.0: the three-state name confidence (sentence start, titles, Vietnamese name words, the source line, names Vietnamese people carry), 5+ letter codes, `numberRole`, constituents (subject PP, short predicate, purpose clause), token map, subtitle lines bridged inside a phrase, golden paid-voice keys, translation key free of speech/prosody, speed |
| `context-package.test.js` | 16 | 1.8.3/1.8.4: what reaches Gemini, on `context-corpus.js`: a clause across cues is one group, the context package for pronoun / ellipsis / discourse / entity / terms, sense hints without the general fallback, Coursera and YouTube windows carrying the previous translation, short tail windows merged, the cache key's contents; 1.8.4 far antecedents, description cleaning, the realtime 20 s rule, a scaled-time playback check that windows stay ready ahead, the console summary |
| `speech.test.js` | 23 | 1.7.8 English in speech (`dub-speech.js`): what VieNeu is sent for unknown codes, word acronyms, camelCase and Vietnamese-syllable names, model numbers; what stays untouched (VieNeu's own tables, Vietnamese codes, A4, U23, shouting, "Con AI", a lone "Tom"); evidence from the English source; unchanged text = same string; 8-tag cap; consistency; the user's adversarial list; the version reading of `adaptForSpeech`; spans as prosody units; the backlog-16 pause rules; engine `speakScript` + the `speak` field; no network; speed; custom entries; the unseen split's fingerprint; three subtitle lines read as one take |
| `ui.test.js` | 37 | Shortcuts (Alt+S / Alt+D / Alt+Shift+V), no blocking `alert`/`confirm` on the user's page, focus rings and reduced-motion, `role=status` toasts, the YouTube quick menu built on a mini-DOM, light/dark theme wiring, the VieNeu autostart script, auto-switch back to VieNeu when the server appears, and the release-history data |
| `edits.test.js` | 7 | `subtitle-edits.js`: a viewer's correction is stored per video, reaches both the overlay and the voice text, re-voices only the edited sentence, and the transcript panel's edit box |
| `glossary.test.js` | 10 | `glossary.js` data and the protect -> restore round trip in `content.js`: settled renderings, plurals, sentence-start capitals, user rules, groups added after a saved list |

## The two harnesses that make offline testing possible

**`tests/bg-env.js`** runs the real `background.js` inside a `vm`, faking only `chrome.*` and
`fetch`. Options let a test reuse one `storage.local` object across simulated worker restarts (so you
can test "extension reloaded, data intact"), share a fake IndexedDB backend, and compress timeouts
(`fastTimeouts`, `timeScale`). Used by `hardening.test.js`, `ui.test.js` and `vieneu.live.js`.
**If you add a service-worker feature, test it here, not by hand in Chrome.**

**`tests/dub-sim.js`** gives a virtual `Clock` plus `FakeVideo`, `FakeAudio` and `makeFakeSpeech`, so
a 20-minute video simulates deterministically in milliseconds. Used by `dub.test.js` and
`cost.test.js`. `tools/playback-sim.js` builds on it with a model of the service worker and the
serial VieNeu server (slot held after an abort, translation arriving late) for delivery scenarios
(seek, rapid seek, pause, rate, cached); `dub.test.js` "playback delivery" asserts on its numbers.
Scenario options (1.9.9): `scale` < 1 speeds the lecture up (0.6 = a 1.67x talk, the Vietnamese
unchanged); `sps` sets the voice's pace; `unique: true` keys every line by its place. The lecture
repeats 22 sentences, so without `unique` everything after the first minute is a store hit and the
server's speed never shows. `maxHeld` is the most audio seconds the page held at once.
`tools/sim-matrix.js` runs many seeks per engine: judge an engine change there, never on one scenario.
Loading it replaces `CST_CACHE.hashKey` with Node's synchronous SHA-256 (same hex digest):
`crypto.subtle` answers from a worker thread, and on a busy machine a store key missed the one
`setImmediate` a simulated tick waits, so delivery tests failed about 1 run in 5 (1.9.3).

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

English in speech (1.7.8), corpus `tests/speech-corpus.js` (dev 88 / validation 40 / old unseen 24,
now seen; its fingerprint is pinned in `speech.test.js`). Blind splits are written by a separate agent
**before** the rules change, committed unread, scored once at the end, then their failures become dev
cases: `tests/blind-corpus.js` (1.8.0, seen) and `tests/blind-corpus-2.js` (1.8.2, seen). The next round
needs a new `blind-corpus-3.js`. `hold` = the word must be left as is (`pron-eval` kind).

```bash
node tools/pron-eval.js --split=dev,validation --old=HEAD --detail   # VieNeu phonemes, no server
node tools/syntax-eval.js --old=HEAD --detail                         # prosody text decisions, no server
node tools/syntax-eval.js --breath=0.35,18 --detail                   # breathing commas at other thresholds
node tools/pron-eval.js --corpus=tests/blind-corpus.js --old=<rev>    # blind split: once, at the end
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
The takes there predate 2.0.6: the lecture's second line is now cut "xem xét | mạng nơ-ron", so
`t7367` is missing (the line is skipped) until the prep runs again.

`live.html` + `live-server.js` (1.9.7): the real `DubEngine` and VieNeu provider in Chrome. The
page's messages are answered by the real `background.js` (through `bg-env.js`) in the Node server.
It talks to the real local VieNeu server; every other host is refused (`/seen.json` lists refusals),
so no paid API can be reached. A scripted viewer: seek forward, seek back, pause and resume, 2x, then
a 12 s ad that takes the clock to 0 and back. Launch configs `live` (8766) and `live-slow` (8767,
replies held to RTF 0.9). Click "run", poll `H.done` (45 s tool limit), read `summary()`: lines
spoken, late starts, overlap / voice-while-paused / voice-in-ad samples (every 50 ms), recovery per
seek. `?engine=smooth/old-dub-engine.js` runs an older engine copied into the git-ignored `smooth/`.
Restart the server between compared runs (its audio store is shared) and close the old tab (it keeps
posting to the same port). Other scripts: `?script=stress` (rapid seeks, seek while paused, 0.5x and
1.75x mid-line, rewinds inside the line being read, a pause during an ad), `?script=burst`, and
`?script=viewer2` (pre-roll ad, pause in the middle of a line, fast pause/play toggles, rewind and
rate change while paused, seek into a long line, a seek right after an ad). `?trace=1` logs every
request and take. Late starts use the engine's own `lag`: a line entered mid-way is not late.

Results:

| Run (one each) | Spoken | Late | Overlap | Errors | Estimated RTF |
|---|---|---|---|---|---|
| 1.9.7, healthy server | 33 | 1 (0.62 s at 2x) | 0 | 0 | 0.34 (fitted overhead 0.16 s) |
| RTF 0.9, 1.9.6 | 31 | 6 | 0 | 0 | 0.19 (wrong) |
| RTF 0.9, 1.9.7 | 30 | 5 | 0 | 0 | 1.2 |

Voice-while-paused counts only once the script's own pause is 100 ms old: a sample taken before
the clock's "pause" event reached the engine counted one per pause in the runs above (a harness
artefact, 2026-09-29). With that, viewer2 on 2.0.1: 0 voice while paused, 0 in ads, 0 errors,
0 overlaps; after a pause mid-line the same take went on from where it stopped.

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
New test names are English (CLAUDE.md, Language); the existing Vietnamese ones keep theirs.

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
- First ask the user for the quick menu's **"Chép chẩn đoán"** (1.9.9): one JSON text with the
  version, health line, settings, player state and the engine's snapshot. `engine.events` holds the
  last 150 drops (with why), skips, resets (with why), errors and late starts, with media time. It is
  always on, so the problem the user just saw is already in it.
- Dubbing diagnostics: set `localStorage.cstDubDebug = "1"` on youtube.com, reload; the engine writes
  a JSON snapshot to `<html data-cst-dub>` every 500 ms (`started` has due time, start, rate, overrun).
- Recording over minutes (1.9.9): Control_Chrome `execute_javascript` needs Chrome's "View >
  Developer > Allow JavaScript from Apple Events", which the user must switch on (and off afterwards).
  Always wrap the script in an IIFE: a second top-level `const` returns "missing value". A
  `setInterval` on the page can copy each `data-cst-dub` snapshot into `window.__cstRec` and later
  reads can collect it. Watch the server at the same time with `tail -F ~/VieNeu-TTS/server.log`
  (Monitor, filter `rtf=` >= 0.5).
  Remove `cstDubDebug` and clear the interval when done.
- `chrome://extensions` and `chrome-extension://` pages cannot be opened by the tools: only the user can Reload.
- Prefer a cached video (`ytcache4_*`): no Gemini cost.
