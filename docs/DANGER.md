# Danger zones

Read this before editing `youtube.js`, `yt-bridge.js`, `background.js` or `dub-engine.js`. Each item
is something that already broke once and cost a release to fix. Line numbers drift; grep the symbol.

## 1. The YouTube `pot` token dance (`yt-bridge.js`)

Since September 2026 YouTube returns **200 with 0 bytes** for a `timedtext` URL containing `exp=xpe`
unless the request carries the player's own `pot`, `c` and `cver` parameters. Missing `c`/`cver`
alone is enough to get an empty body.

`yt-bridge.js` patches `XMLHttpRequest.open` and `fetch` to record the player's own requests, then
`layNoiDungPhuDe` tries three stages: an already-captured body, a direct fetch, then a fetch with
the captured `pot`.

If no request has been seen yet, `nhoTrinhPhatTai` **toggles the viewer's own closed captions on and
back off** to force the player to make one, polling about 25 times at 100ms, then unloading and
reloading the captions module and polling 40 more times. Roughly 7 seconds.

What breaks: it depends on YouTube's internal `getOption` / `setOption` / `loadModule` signatures.
If it throws halfway through, the viewer's caption setting is left changed. The captured-bodies map
is capped at 12 entries.

If YouTube captions go empty again, **measure the real page first** (browser pane, look at what
parameters the player's own `timedtext` request carries) before changing any code.

Never reuse a `pot` captured on one video for another one, to skip the toggle and show subtitles
sooner: it is YouTube's per-video attestation, and sending it elsewhere is working around its bot
detection (declined 2026-09-29).

**The player's own body is a fallback (2.6.7).** `layNoiDungPhuDe` fetches our json3 URL with the
captured pot first; the body the player fetched for itself (`bodies`) only when that comes back
empty. The player's body can be the display form: qSlxe4hA66g's Korean ASR came as 172 two-row
blocks of 7-11 s with no word times (our json3 fetch: 596 events with word times), and every
block's second row was shown and spoken 4-5 s early. If that fallback is still used,
`ytDocNoiDungPhuDe` (2.6.8) splits a block with no word times that runs past the next block's start
into one cue per row, timed by characters up to that start (an uploaded two-row cue that ends
before the next stays whole). Measured over the 69 saved videos: none had this form, 7 hold inner
">>" turns (117 lines, the 2.6.6 speaker split).

## 2. There is ONE bridge, injected two ways

`manifest.json` injects `yt-bridge.js` into the MAIN world at `document_start`. When the page predates
the extension (reload), `youtube.js` `ytDamBaoBridge` asks the service worker (`ensureYtBridge`) to
`executeScript` the **same file** into the MAIN world; `reinjectOpenTabs` also does it on update.
Never bring back an inline `<script>` copy: it drifted (it lacked the `pot` capture) and an inline
script on YouTube runs into Trusted Types. `yt-bridge.js` guards itself with `__cst_bridge_v2`, and
`ytHoiDanhSachPhuDe` re-posts its request every 600 ms, because a freshly injected bridge answers a
moment after the first ask.

## 3. The three-legged reload guard

When the user clicks Reload at `chrome://extensions`, the old content script keeps running in the
open tab while the new one is injected. Two copies then fight over the same DOM nodes. This once
pegged a CPU core and hung the tab.

Three mechanisms cooperate:

1. **Generation tags** `CS_GEN` (`content.js`), `YT_GEN` and `YT_BORN` (`youtube.js`) are stamped
   onto every node the instance creates (`data-cst-gen`, `data-cst-born`). A node whose `born` is
   newer than yours belongs to a newer script: leave it alone. A node with an older tag is an orphan
   you may sweep.
2. **Liveness pollers** every 1500ms check `chrome.runtime.id`; when it disappears the instance
   knows it is orphaned and sets `state.dead` / `yt.dead` and stops.
3. **`reinjectOpenTabs`** in `background.js` (on `onInstalled`) pushes the new code into tabs that
   are already open, so the user does not need F5.

Change one leg and you break the set. Also: `yt.dead` / `state.dead` must be set **before** removing
nodes, or the MutationObservers recreate what you just removed.

Regression test: `tests/reload-fight.test.js`. Its second case only runs with
`OLD_YT=<path-to-older-youtube.js>`; without it, it skips, which is the normal `npm test` result.

The dubbing engine has a fourth leg of its own (1.9.2): the `<video>` attributes
`data-cst-duck-owner` / `data-cst-duck-base` say which engine ducks the element and the user's level.
A new engine claims them at `start()`; an old one that sees another owner stops at its next tick and
never touches the volume again. Removing them brings back volume left at 0.01 after a Reload.

**Clicking Reload for the user (2026-10-10).** Do it from a `chrome://extensions` tab, with what the
button itself calls: `chrome.developerPrivate.reload("lpknjhmnlocilmkmooomffknibghibao", { failQuietly: true })`,
then `chrome.developerPrivate.getExtensionInfo(id)` must show the new version and `ENABLED`. Probed in
headless branded Chrome, throwaway profile, extension added with CDP `Extensions.loadUnpacked`:
with developer mode **on** it stayed `ENABLED`, its service worker came back and a `storage.sync`
value survived; with developer mode **off** it came back `DISABLED` (`unsupportedDeveloperExtension`),
which is the same trap as `chrome.runtime.reload()` (`MAP.md` "Share build"). Probed the same way on
2026-10-11 (CDP `Extensions.loadUnpacked`, developer mode **on**): `chrome.runtime.reload()`, which the
"Nạp lại tiện ích ngay" button (`version-check.js`) calls, kept the extension `ENABLED` with its
storage, 2/2; an unpacked install always has developer mode on, so the button stays. The user's Profile 42 has
developer mode on (the extension is unpacked). In their Chrome the only route is `Control_Chrome`
(AppleScript) on a Profile 42 window; when Chrome is closed nothing is needed (it reads the folder at
start); if that route fails, ask for the click in one line. Never remove and re-add: settings are lost.

## 4. The service worker forgets everything when it sleeps

In-memory only, reset on every wake: `keyBlock`, `modelCooldown`, `missingModels`,
`unitSchemaUnsupported`, `noThinkingCfg`, `ttsJobs`, `localBusy`. So every cooldown and every
"this model is unavailable" block evaporates unpredictably. Do not build logic that assumes a
cooldown survives.

Persisted: `accessMap` (`modelAccess`) and the cost `ledger`. But the ledger save is debounced, so a
worker kill can lose the most recent cost entries. The first message after a wake arrives before
the stored ledger has loaded (Chrome's storage always answers asynchronously): `track()` defers
itself on `ledgerReady` until `ledgerLoaded`, and `handleCostReset` awaits it first. Without that
the load replaced a reset or an early charge (2.3.1). Anything new that writes `ledger`,
`sessionStats` or `history` must do the same; `bg-env.js` `asyncLocal` reproduces the race.

## 5. Retry layers that multiply

`translateUnitMiss` walks the model chain (`COST.modelChain`, capped at the mode's price) and moves
to the next model on `NEXT_MODEL_ON` (404 / not for this key, rate limit, daily quota, overloaded,
bad output, blocked); a timeout, key, payment or request error goes straight to Google. Inside it
`callGeminiUnit` (up to 3 passes: drops the JSON schema or thinking config the model refuses,
doubles a truncated output once), inside that `geminiCall` (retries only 5xx / network, 2 for the
first model of the chain and 0 for the models after it, plus per-model cooldowns). The Google
fallback is `googleTranslateAll` (2.2.3): the whole window in one request, one sentence per line;
if the line count comes back wrong it asks per sentence through `translateWithRetry` (2 tries plus
MyMemory), all at once, and a sentence that still fails is "" (the window fails only if all do).

Adding one retry at the bottom multiplies latency and spend at the top. Change the count in one
place only, and check what the other layers do with it. Measured worst case with every model
overloaded: 5 Gemini calls, then Google.

## 6. YouTube DOM selectors

`#movie_player`, `.html5-video-player`, `.ytp-right-controls`, `ytp-caption-window-container`,
`#movie_player .ytp-chrome-bottom`, plus Coursera's cue and track selectors in `content.js`.
YouTube renames these routinely. When the overlay or the button disappears after a YouTube update,
this is the first place to look, and there is no test that can catch it.

## 7. Observers and timers must come down in the right order

MutationObservers in both `content.js` and `youtube.js`, plus `classObserver`, `resizeObserver`,
a 700ms menu repaint, 800 and 1000ms navigation polls, and a `requestVideoFrameCallback` loop.
Every one of them needs an explicit teardown in the disable path. Set the `dead` flag first, then
remove nodes, then disconnect. `content.js` keeps its polls in `state.intervals`; the dead path
clears them all (1.7.3: the navigation poll used to survive and rebuild a dead button).

## 8. Settings writes are patches, not form snapshots

`options.js` diffs against its last successfully saved form snapshot. `settingsPatch` in the
worker merges nested `subStyle` fields in a single queue shared by Settings and both players.
Never restore whole-object style writes in the players: concurrent color/size edits would overwrite
one another. `dualMode` remains authoritative over `subStyle.mode`. The form updates clean controls
from storage events, preserves dirty fields, and drains an in-flight save before importing a backup.
Keep the consumers' real-change guards: migrations and older loaded pages may still write snapshots.

## 9. Prefetch spend

`NUM_CONCURRENT_WORKERS` is 2 in `youtube.js`. The loop's only cancel signal is the `yt.groups`
array being swapped out (or `yt.huyDich`). Raising the worker count multiplies API spend against the
`translateAhead` horizon; it does not just make things faster.

## 10. A Gemini timeout still costs money

A timed-out TTS call may already have been billed, so a failed plan is not retried. The free VieNeu
provider does retry. Keep that asymmetry: it is intentional.

## 11. `chrome-shim.js` merges sync and local

In the web-demo path (opening `popup.html` or `options.html` outside the extension),
`storage.local` and `storage.sync` are **the same object**. Code that relies on the two areas being
separate will behave differently there than in the real extension.

## 12. Async runs that outlive their page

Coursera and YouTube are single-page apps: the viewer changes lecture or video while a run is still
awaiting. Each start flow therefore carries a validity check and must re-test it after **every**
await: `translateTrackSite` (`state.navGen`, bumped by `watchNavigation`), `ytBatDauDich`
(`stale()`: `yt.huyDich` / `yt.dead` / the video id), `dubbing.js` `start` (`startSeq`). A missing
check after one await was enough (1.7.4) for the old page's run to paint its subtitles over the new
page, keep sending its lines to Gemini, and hold `busy` so the new page's auto-translate gave up.
The auto-translate paths wait for a leftover `busy` instead of returning. What the UI calls
"translating" is `csTranslating()` (1.7.5): `busy` held by a run of the current `navGen`, never a run
that was turned off or left behind; and the button is redrawn after `busy` clears. `dub.starting` is handed
back in a `finally` for the same reason: left set by an early return, YouTube's auto-dub skipped
every later video on the page.

## 13. The subtitle line breaker now also decides where the voice pauses (1.7.6)

`dub-prosody.js` reads every gap's cost from `vi-segmenter.js` (`SEG.analyze`, `SEG._lex`
`OPENERS` / `LEFT_BIND` / `UNITS`). A lexicon change made for subtitle line breaks (lane A) moves
the VieNeu pauses and breathing commas too (lane B). After touching the segmenter's lexicon or
scoring, run `tests/prosody.test.js` and `node tools/prosody-eval.js`, not only the segmenter tests.
It also moves the free voice's head cuts after a start or seek (`dub-planner.js` `lineGapValues`,
2.0.6) and its forced segment cuts (`prosodicCut`).
The VieNeu audio key (`dub-engine.js` `audioKey`, 1.8.0) is `LOCAL_STYLE_VERSION`, model, sample
rate, voice, the spoken text (`speakScript`) and `PROSODY.signature(plainScript)`, so a segmenter
change that moves a gap's value re-renders exactly the lines it touches. The cached audio is already
shaped: after a change to the pause shaping code itself, bump `LOCAL_STYLE_VERSION` so every cached
VieNeu line re-renders once (free). Never extend
`breathText` or a cut change (`prosodicCut`) to paid voices: a changed text or a moved cut is a new
billed render of audio the user already paid for.

## 14. What VieNeu says is not the text its pauses are placed on (1.7.8)

A VieNeu request carries two texts: `text` (`plainScript`, plain Vietnamese with breathing commas)
and `speak` (`speakScript` = `dub-speech.js` `render`: `<en>` tags, respellings like `<en>tahm</en>`,
"RTX 5 0 9 0"). `background.js` sends `speak` as the server's `input`, and gives `text` to
`shapePauses`, the runaway check and the timeout. **Never hand the rendered text to the pause
shaping or the syllable count**: the tags and respellings shift every word position. The audio key
uses `speak` and `LOCAL_STYLE_VERSION`. Two server limits the renderer
works around, both measured: more than 10 `<en>` tags in one normalizer call corrupt the text
(`TAG_MAX` 8), and a word that is a Vietnamese syllable stays Vietnamese even inside `<en>`. The data
block of `dub-speech.js` describes sea_g2p 0.9.1: after a VieNeu update, rerun
`node tools/build-speech-tables.js`, then `node tools/pron-eval.js --old=HEAD`.

## 15. Cutting a VieNeu request costs the next one 4-5 s (1.8.6)

`background.js` `synthesizeLocalOnce` ignores a page abort once the POST is sent (unless the take
still needs more than `LOCAL_KEEP_RUNNING_S`, or the server is cold). The VieNeu server frees its
single stream slot only when its `_Lease` watchdog sees 4 s without progress, and `waitLocalIdle`
holds every later request until then. Forwarding the abort again looks harmless in tests (the fake
server frees at once) and brings back 3-5 s of silence after every seek. The engine side
(`hardReset` keeping the cut via `audioReadyAt`/`headPinned`) is the other half: a new head cut after
a seek re-renders audio the page already holds.

## 16. A voice element that is still starting is not drift (2.4.6)

`dub-engine.js` `driveSpeech` / `settleSpeech`. After `play()` or a seek, Chrome's `currentTime` stands
still while it starts the element (`paused` is already false): 0.16 to 0.96 s in the user's Chrome
while VieNeu worked. Any rule that compares that standing still with the line's timeline and seeks
(`driftCorrect`) restarts the wait and loops: 7 seeks in 1.1 s on one line, a pop each, the voice on
and off. Only compare once the element has moved (`S.moving`), absorb the wait into the timeline, and
keep `reseekSpacing`. Node fakes started at once until 2.4.6, so no test saw it: `FakeAudio` now takes
`startLatency`, `tools/playback-sim.js` `LATENCY=busy`, and `tests/dub.test.js` "a voice Chrome is
slow to start is never seeked" runs every scenario with it. A live check needs chrome://media-internals
(each voice is a `blob:` player: `seek_target` rows while it plays are seeks of a sounding voice).
