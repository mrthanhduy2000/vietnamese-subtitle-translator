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

## 4. The service worker forgets everything when it sleeps

In-memory only, reset on every wake: `keyBlock`, `modelCooldown`, `missingModels`,
`unitSchemaUnsupported`, `noThinkingCfg`, `ttsJobs`, `localBusy`. So every cooldown and every
"this model is unavailable" block evaporates unpredictably. Do not build logic that assumes a
cooldown survives.

Persisted: `accessMap` (`modelAccess`) and the cost `ledger`. But the ledger save is debounced, so a
worker kill can lose the most recent cost entries.

## 5. Retry layers that multiply

`translateUnitMiss` walks the model chain (`COST.modelChain`, capped at the mode's price) and moves
to the next model on `NEXT_MODEL_ON` (404 / not for this key, rate limit, daily quota, overloaded,
bad output, blocked); a timeout, key, payment or request error goes straight to Google. Inside it
`callGeminiUnit` (up to 3 passes: drops the JSON schema or thinking config the model refuses,
doubles a truncated output once), inside that `geminiCall` (retries only 5xx / network, 2 for the
first model of the chain and 0 for the models after it, plus per-model cooldowns). The Google
fallback is `translateWithRetry` (2 tries plus MyMemory), one sentence per request, all at once.

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

## 8. `options.js` saves every key on every change

So `storage.onChanged` fires for keys that did not change. `youtube.js` has an explicit "only act on
a real change" guard; without it, toggling any unrelated setting restarted dubbing and you heard two
voices at once. Do not "simplify" that guard away.

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
