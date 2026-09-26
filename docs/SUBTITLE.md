# Subtitle pipelines, message contracts, storage keys

Line numbers drift. Grep the function name.

## Who does what

`background.js` is the only place that talks to Gemini or does TTS. Content scripts never call an
API directly. `content.js` owns Coursera and the shared toast layer; `youtube.js` owns YouTube and
runs in the same world, reading `content.js`'s `state` and `CST_UI` directly (not via messages).

## Coursera flow (`content.js`)

`init` -> `courseraAutoTranslate` (if enabled) -> `enableTranslation`:

1. Read the VTT track from the player.
2. `protectGlossary` wraps terms that must survive translation; `rebuildGlossaryRegex` builds the
   matcher from `glossary.js` plus the user's own keep-list.
3. `groupCuesIntoSentences` merges cues into sentence units (or keeps them per-cue if `perCueMode`).
4. `translateAllGroups` / `translateWindow` -> `requestUnit`, the **only** bridge to the service
   worker. `CST_CONTEXT` attaches a sliding window of 2 previous and 2 next cues plus domain and
   term hints, char-budgeted.
5. `vi-quality.js` scores the result; above threshold `refineUnit` retranslates with the strong model.
6. `vi-segmenter.js` `segmentGroupSafe` re-cuts the Vietnamese into cues and breaks lines by syntax,
   not by character count. `applyTranslation` writes them back **and** fills `cs.viCues` / `cs.origCues`.
7. Display (1.5.3): the track goes to `mode = "hidden"` and `csStartRender` paints our own overlay
   (`.cst-cs-overlay`) with `CST_STYLE`, exactly like the YouTube one. Before that the Vietnamese went
   to the browser's cue renderer, which Coursera paints over, so the two boxes overlapped.
   The control button lives in Coursera's own control bar (`csPlayerParts` finds it by geometry,
   never by class name) and opens the same quick menu; the two circles that used to float over the
   picture are gone.
   A style change must go through `csRestyle()` (the storage listener does): `csRender` only
   re-applies the style when the player box changes size, so before 1.5.6 a new font size waited for
   a resize. Both quick menus carry a subtitle-size stepper (`buildStepper` in `player-ui.js`).
8. `disableTranslation` tears it down. `CS_GEN` tags every node this script instance created.

**On-player layout (1.5.9).** Both quick menus are two sections built with `kit.buildSection`
("Phụ đề": switch, display mode, size, skip; "Giọng đọc": switch with `describeHealth`, voice,
volumes), then the footer. The transcript panel is 392 px wide. `ytSideRoom` / `csSideRoom` return
the pixels taken on the right (panel 404, open menu 352); the overlay shifts by half and caps at
`calc(100% - room - 48px)`, and the line fitting uses the same free width. The popup's "Đang xem" card reads `title` and
`dub.health` from `getStatus`.

**Context leaks (1.5.8).** Each translation request carries neighbouring lines as context, and the
model sometimes translates them into the unit before (measured: one unit held the next two units'
content, shown and spoken twice). `CST_QUALITY.trimContextLeak(text, next)` cuts a tail whose word
pairs repeat the next units' translation; it runs in `applyTranslation` (Coursera, via
`trimTranslationLeaks`), `ytGanBanDich` (`ytTrimLeaks`, both directions) and on cache load
(`ytRepairCachedLeaks`). A paraphrased leak shares words, not word pairs, and is not caught.
The prompt now forbids finishing the last item's sentence; `TR_PROMPT_VERSION` was deliberately
not bumped, since that would re-bill every cached translation for an additive instruction.

**Sentence straddling (1.5.8).** `segmentTokens` charges `straddleCost` (45) for a cue that starts a
sentence and ends before it does. On 347 real cues: 38 -> 7. It exposes missing compounds in
`COMPOUND_LIST` more often; add them rather than lowering the cost.

**Editing a line (1.5.7).** The pencil on a transcript row saves through `adapter.saveEdit` ->
`CST_EDITS.save`, then `ytApplyEdits` / `csApplyEdits` call `CST_EDITS.sync` over both the display
cues and the dub groups (separate objects on the cache path and on Coursera) and rebuild the group's
`viText` token by token, keeping the pause hints of untouched cues. `CST_EDITS.notify` makes the
engine `refresh(true)`, which drops audio only where the text changed. Both players also listen on
`storage.onChanged` for their own `edits:` key, so Settings and other tabs apply live.

**Transcript panel (1.5.4, both sites).** `transcript.js` (`CST_TRANSCRIPT.toggle(adapter)`) draws the
whole talk beside the picture from the lists the overlay already uses, so it costs no API call:
`ytTranscriptAdapter()` feeds it `yt.viCues` + `yt.cues`, `csTranscriptAdapter()` feeds it
`cs.viCues` + `cs.origCues`, and `mergeLines` pairs them up. Click a row to seek, search inside the
talk, export `.srt` (bilingual when the display mode is bilingual). Both quick menus also show which
source track is in use (`ytNguonPhuDe` / `csSubtitleSource`): machine-heard captions are the usual
reason a translated line is wrong, and the label turns warning-coloured for them.

## YouTube flow (`youtube.js` + `yt-bridge.js`)

`ytKhoiDong` -> `ytTheoDoi` (watches SPA navigation) -> `ytTuDongDich` -> `ytBatDauDich`:

1. `ytDamBaoBridge` makes sure the MAIN-world bridge is alive (see `DANGER.md`: there are **two**
   bridge implementations).
2. `ytHoiDanhSachPhuDe` asks the bridge for the caption track list.
3. `ytHoiNoiDungPhuDe` asks the bridge to fetch the track; `ytDocNoiDungPhuDe` parses it.
   Auto-generated tracks carry per-word timings, which the segmenter uses.
4. `ytChayTienTrinhPrefetch` runs a 2-worker sliding-window pool over `ytDichNhom`, staying
   `translateAhead` seconds ahead of playback. `ytDichKhanCap` jumps the queue after a seek.
5. `ytVePhuDe` draws the subtitle itself into an overlay (YouTube's own caption layer is not used).
   `ytBatDauDongBo` drives it off `requestVideoFrameCallback`.
6. `ytBatDauDOMCaptionObserver` is the fallback path that reads YouTube's own rendered captions.
7. `ytTatDich` tears down. `YT_GEN` / `YT_BORN` tag nodes; see `DANGER.md` before touching them.

## Message contracts

### Anything -> service worker: `chrome.runtime.sendMessage({ action })`

15 actions in the `ROUTES` table at the end of `background.js`, plus `ttsAbort`, which is handled
synchronously *before* routing (it must not wait on the queue):

`translateUnit` · `translateUnitStore` · `synthesizeSpeech` · `condenseSpeech` · `audioCacheGet` ·
`audioCacheDelete` · `cacheStats` · `cacheClear` · `modelStatus` · `testKey` · `openOptions` ·
`costStats` · `costReset` · `localTtsStatus` · `localTtsWarm` · `ttsAbort`

To add one: write `handleX`, add `X: handleX` to `ROUTES`. Nothing else.

### Service worker or popup -> content script: `chrome.tabs.sendMessage({ method })`

`translate` · `phimTat` (keyboard shortcut relay) · `forgetVideoAudio` · `getStatus`

Handled by the listener near the end of `content.js`. Note `popup.js` also sends `setOptions`,
which **no one handles**; see `BACKLOG.md`.

### `youtube.js` <-> `yt-bridge.js`: `window.postMessage({ cstType })`

Request/response pairs correlated by `requestId`:

`YEU_CAU_PHU_DE` -> `TRA_LOI_PHU_DE` (track list) ·
`YEU_CAU_NOI_DUNG_PHU_DE` -> `TRA_LOI_NOI_DUNG_PHU_DE` (track contents)

## Storage keys

### `chrome.storage.sync` (27 settings written by `options.js` `collectSettings`, plus `uiTheme`)

Subtitle: `subStyle` (nested object; defaults live in `subtitle-style.js`), `dualMode`,
`perCueMode`, `styleOriginal`, `originalFirst`, `skipSameLang`

AI and cost: `useAi`, `geminiApiKey`, `geminiModel`, `geminiStrongModel`, `costMode`,
`autoTranslate`, `budgetDailyUsd`, `budgetVideoUsd`

Glossary: `glossaryEnabled`, `userKeep`, `userNormalize`, `enabledGroups`

UI: `uiTheme` (`auto` / `light` / `dark`), written by `theme.js`, **not** by `collectSettings`. It is
also mirrored into `localStorage` as `cstUiTheme` so the page can paint before storage resolves.

Dubbing: `dubEnabled`, `dubProvider`, `dubTtsModel`, `dubVoiceName`, `dubGeminiVoice`,
`dubGeminiVoice2`, `dubLocalVoice`, `dubLocalVoice2`, `dubSecondVoice` (off by default: every speaker is S1,
see `DubEngine.oneVoice`), `dubDuck`, `dubVolume`, `dubPrepareWait`.
`dubCondense` is retired (condensing is permanently off, see `DUBBING.md`); old stored values are ignored

One-shot migration flags (do not reuse the names): `modelsVersion`, `costMigration113`,
`localVoices1111`, `dubProvider1113`, `styleDefaults118`

**`options.js` writes every key on every change**, so `storage.onChanged` fires for keys that did
not actually change. `youtube.js` has a deliberate "only act on a real change" guard so this does
not stack two dubbing voices. Keep it.

### `chrome.storage.local` (owned by `background.js`, not user-editable)

`edits:<videoKey>` is the exception: the viewer's own line corrections, written by
`subtitle-edits.js` from the transcript panel and the Settings tab "Phụ đề đã sửa". videoKey is
`currentVideoMeta().videoKey` (`yt:<id>` or the Coursera lecture path). Shape:
`{ title, url, updated, lines: { "<startMs>": { text, orig } } }`. Never write edits into
`ytcache4_*`: `ytGhiCache` stores `cstOrig` (the machine text) so a revert in Settings really reverts.


`modelAccess` per-API-key model availability, keyed by a SHA-256 hash of the key, 3-day TTL ·
`costLedger` daily cost ledger · `ytcache4_<videoId>` cached YouTube translations (an older
`ytcache` prefix exists) · `ctxterms_<key>` agreed context terms · plus the `cst-cache` IndexedDB
database, which is separate (see `DUBBING.md`).

### `chrome.storage.session`

`costSession` per-session cost.

## Adding a setting: the 4 places

1. A control in the right card of `options.html`.
2. Read it in `options.js` when loading, and add it to `collectSettings`.
3. A default wherever it is consumed (`cost-policy.js`, `subtitle-style.js` or the module itself).
4. If the content script must react live, handle it in the `storage.onChanged` listener.

Miss step 2 and the setting silently never saves. Miss step 1 and you get a dead key, which is
exactly how the retired `dubCondense` key ended up with four contradictory sources.
