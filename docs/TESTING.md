# Testing

No test framework, no dependencies: plain `node --test`. Everything in `npm test` is **fully
offline** - Gemini and Google are faked, timers are virtualised, no TTS server needed.

```bash
npm test          # 312 tests, ~14s. Baseline: 311 pass, 0 fail, 1 skip
```

The one skip is intentional (see `reload-fight.test.js` below). **A fail is a regression, not noise.**

## The 9 files in `npm test`

| File | ~Tests | Covers |
|---|---|---|
| `segmenter.test.js` | 23 | Vietnamese segmentation and line breaking against `fixtures.js`, compared against the frozen `legacy/old-splitter.js` baseline |
| `context.test.js` | 13 | `context-engine.js` domain detection, sense and phrase hints, `ContextSession`, plus `vi-quality.js` |
| `integration.test.js` | 23 | Runs the **real** `content.js` and `background.js` in a `vm` with a fake `chrome`, fake DOM and fake Gemini |
| `dub.test.js` | 31 | Dub script, prosody, duration fitting, real WAV fixtures, sync under pause / seek / rate change |
| `cost.test.js` | 51 | The full LOCAL -> CACHE -> cheap -> strong -> TTS chain, plus `cst-cache`, `cost-policy`, `dub-planner`, `dub-engine` |
| `hardening.test.js` | 76 | Per-API-key model access, options opening, language auto-detect, no-clipping dubbing, budget caps, the version-scheme rule |
| `bridge.test.js` | 4 | `yt-bridge.js` recovering empty captions that are missing the `pot` token, and restoring the viewer's original caption track |
| `reload-fight.test.js` | 2 | Old and new content scripts coexisting after a reload must not loop forever recreating buttons. **The second case needs `OLD_YT=<path>` and skips without it** |
| `ui.test.js` | 7 | Alt+S / Alt+D shortcuts, no blocking `alert`/`confirm` on the user's page, focus rings and reduced-motion, YouTube control-bar toggle and menu, `role=status` toasts |

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

```bash
npm run compare              # old vs new segmenter over every fixture. Offline
node tests/vieneu.live.js    # REQUIRES the local TTS server at 127.0.0.1:8000
node tests/tools-fit-voice.js  # refits the speech-duration model to tests/audio/linh-calibration.json
```

`vieneu.live.js` allows only that one host and rejects every other request.
Start the server with `open ~/VieNeu-TTS/cst-start.command`, check it with
`curl 127.0.0.1:8000/health`.

## Browser harness pages (`tests/harness/`)

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
