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
   matcher from `glossary.js` plus the user's own keep-list. A term with an entry in its group's
   `vi` map (from `GLOSSARY_VI`, 1.8.5) is restored as that Vietnamese, not the English
   (`translateAsFor` folds plurals; user keep-list and `=>` rules override it).
3. `groupCuesIntoSentences` merges cues into sentence units (or keeps them per-cue if `perCueMode`).
   A group closes at a sentence end, a pause over 1.5 s, or 24 s / 520 characters / 12 cues. A
   sentence's short last piece (up to 40 characters and 2 s) joins past those limits, by up to 3 s /
   40 characters (2.3.7): alone it was a group of its own ("mind.", 0.72 s) and the model put half
   the sentence's Vietnamese there, 29 syllables the voice could not fit (krPKW8J6JSM dropped the
   next line). It changes 2 groups on the user's 16 videos, the 2 crammed ones.
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
9. Page changes (1.7.4): `watchNavigation` bumps `state.navGen`. A `translateTrackSite` run started
   under an older value sends no further window, never applies its result, and returns false; the
   new lecture's `courseraAutoTranslate` waits (up to 20 s) for that run's `busy` instead of giving
   up. Before, the old run paid for every remaining window and then painted over the new lecture.
10. Progressive (1.7.5): `translateAllGroups` takes the window under the playhead first
   (`opts.startAt`) and calls `opts.onWindow` after each one; `csShowTranslated` puts what is done on
   screen and into `state.dubGroups` (untranslated lines show the English), `state.active` turns on
   with the first window and `opts.onShown` starts the voice then. `applyTranslation` still rewrites
   the track once at the end; `csGroupCues` memoises the segmentation per group so that pass does
   not cut again. "Translating" in the UI is `csTranslating()` (the run holding `busy` belongs to the
   current `navGen`); `disableTranslation` bumps `navGen` too. The popup's total is
   `state.groupTotal`. Measured on a simulated 10-minute lecture (25 windows): Gemini replies waited
   for before the first Vietnamese line 25 -> 1.

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
(`ytRepairCachedLeaks`). The verbatim part of a leak is cut; a clause the model paraphrased right
at the seam stays (it shares words, not word pairs). Measured 2.3.1: 2 of 531 cached groups keep one
such clause (4eY5DuqASQc #27: 630 -> 382 chars, 7ReQFzSndj4 #14: 741 -> 429). Catching it needs single
shared words, which real content next to its neighbour also has: kept on purpose.
2.4.2: every caller passes the unit's source (`trimContextLeak(text, next, { src })`). A speaker who
says a thing twice or in parallel clauses ("spend this money on yourself" / "... on someone else")
made the unit's own clause look like a leak: 9 lines of the 2026-10-01 batch were cut to 0.22-0.54 of
their source when translated ("Bạn phải nhớ rằng"), and the repair on load cut 7 more saved lines in
long units, at every load. With the source a cut is refused when the whole translation is under
`LEAK_ROOM` 1.3 times the source's length (no room for a leaked unit; 1.29 is the 90th percentile of
4934 real units, the leaks measured 2.0-2.4), or when it would leave under `LEAK_KEEP_MIN` 0.7 and the
whole is under `LEAK_FULL_MIN` 1.8. On the 39 saved videos the load-time cuts went 8 -> 1 (the one
real leak, 7ReQFzSndj4). Lines already saved cut stay cut (the saved text is all there is).
The prompt now forbids finishing the last item's sentence; `TR_PROMPT_VERSION` was deliberately
not bumped, since that would re-bill every cached translation for an additive instruction.
The reverse (2.3.0): a unit that opens with the unit before it again (seen inside one window: the
middle item came back as its first words only, the next item repeated them with the rest of the
sentence). `CST_QUALITY.fixRepeatedHeads(vi, src)` drops a word-for-word repeat of 6+ words at the
seam and re-splits the pair at the clause end nearest the source-length share. Skipped when the two
source lines share a 3-word run (chorus, mantra) or the next unit is nothing but the repeat (the tail
trim's case). Runs in `trimTranslationLeaks` (both Coursera calls pass the source lines) and first
in `ytTrimLeaks` (live and `ytRepairCachedLeaks`; cached groups have no `.text`, it joins `srcCues`).
2.4.4, two more seam shapes inside `fixRepeatedHeads`, both need `src`. These happen at a window
seam where the prompt rule above was ignored. `retoldHead`: the source unit runs on (no sentence
end), its translation closes a sentence anyway, and the next unit's first sentence is shorter than
that sentence and shares >= 3 word pairs, >= 60% of its own. That first sentence is dropped
("... khuất tâm trí." | "ngăn kéo hoặc trong hộp để khuất tầm mắt, khuất tâm trí."). `shiftedTail`:
one unit's translation is >= 1.6x its source, the next one's <= 0.45x (sources >= 40 chars; the
1st/99th percentiles over 5000 units are 0.65/1.60). The tail is moved to the next unit at the
clause end nearest the source share, so words are moved, never dropped. Over the 40 saved videos
(6873 units) they fire on 2 and 1 seams. The 45 lookalikes (a speaker repeating or echoing,
"Any average?" | "An average."; a sentence split right, "Chẳng ai" | "cần tất cả chúng cả.") pass.
Measured with the dubbing simulation, words lost went 173 -> 113.
2.4.5, a slid window: the model split one short item in two, so the next answers sat one item late
until two were merged (a podcast, "It's 8:00." -> "Mọi việc phải dừng lại hết để đọc sách."). Only
one item looked short, and per-item refine picking would then mix slid and realigned answers.
`CST_QUALITY.misalignedItems(src, vi)` finds a run of >= 3 items whose answers fit a neighbour's
source length clearly better than their own. In all 40 saved videos it finds 1 run and no false
hit at window sizes 4 to 12. `assessAll` adds a severity-3 `misaligned` issue that tells the refine
what is wrong. `pickRefined` then takes the refined window whole, if its total score is lower,
instead of item by item. `englishLeftovers` skips `VI_PLAIN`, Vietnamese words with no marks that
English also has ("chổi than", "con", "tin").

**Sound captions (2.3.1).** Automatic captions put "[Music]", "[Applause]" on lines of their own,
in the caption's language ("[Musik]", "[Tepuk tangan]", "[เพลง]"); Coursera writes "[MUSIC]". The
model returned them bare, in round or square brackets, and `dub-planner.js` `stripSoundNotes` only
silences square brackets and a known word in round ones, so bare notes were read aloud (45 of 531
cached groups). `CST_QUALITY.soundNoteLine(src)` translates a line of notes only from `SOUND_WORDS`
(`requestUnit` answers a window of nothing else locally, engine `"sound-notes"`, no request: 50
groups); `fixSoundNotes(vi, src)` brackets the rest: an unknown note's line gets the model's words in
`[...]`, and inside speech as many list words as the source has notes, in order, when bracketed (a
lone `]` too), capitalized or alone on the line. Lower-case words in a sentence stay ("buồn cười").
Runs first in `trimTranslationLeaks` and `ytTrimLeaks` (counted apart from leaks, but returned, so
`ytRepairCachedLeaks` fixes old caches). Measured after: 45 -> 1 read aloud.
2.3.8, same function: a `[Âm nhạc]` inside a sentence (after a word or a comma, before a lower-case
word) is removed, because the recognizer writes "[music]" wherever the background music is and the
note cut a phrase in two on screen ("dễ dàng [nhạc] vệ sinh": 10 lines in 5 of 21 cached videos); at
the start, at the end or between two sentences it stays, and so does laughter or applause anywhere.
The speaker mark ">>" is removed from a translation whose source has it (kept in 5 of 27 lines, so
it told the viewer nothing); the voice takes its turns from the source line.
2.4.3: the other way for a speaker label in capitals that opens the source ("ANDREW HUBERMAN:
Fantastic."): it says who speaks, and the model kept it in 239 of 311 such lines of UIy-WQCZd4M, so
`fixSoundNotes` (`restoreLabel`) puts it back in front when the translation lacks it: 311 of 311. The
voice never reads a label (`DUBBING.md` "Speech text").

**Everyday phrase hints (2.3.8).** `context-engine.js` `PHRASES` held lecture idioms only, while the
user watches vlogs about home, money and habits. The round 7 reading of 3 real videos (241 findings
by 14 readers, 155 of them severity 2 or 3) found these word for word or in the wrong sense: "in my 20s" as
"ở độ tuổi 20", "dresser" as a wardrobe, "go viral", "the logistics of", "declutter" as housework,
"let go of" as "loại bỏ". They now lead `PHRASES` (so the limit of 8 never drops one for "kind of")
and fire 74 times over the 21 cached videos, 6 at most in a window. **Not measured live**: whether
Gemini follows each hint shows only on the next video. The rest of those findings (dropped hedges,
stiff register, a term drifting inside one video, brand names the recognizer misheard) have no local
fix; a system-prompt change for them was not made because it cannot be compared offline.

**Video title (2.3.1).** `content.js` `pageVideoTitle()` is the one title for the cost ledger
(`currentVideoMeta`, `dubbing.js` `videoMeta`), `getStatus`, both transcript panels and edits. On
YouTube it prefers `yt.videoTitle` (the player's `videoDetails.title`, set with `currentVideoId`)
when that is the video in the address bar, else the tab title without the "(3) " notification count
and " - YouTube". The raw tab title had reached the ledger (4 of 5 titles one day).

**Domain (2.3.0).** `detectDomain` counts whole keywords (plural included; `stem*` entries are
stems) and a field needs 3 different keywords and a score of `max(3, words / 150)`; the description
goes in without links and sponsor lines (`cleanDescription(desc, 800)`). The old prefix match made 6
of 13 everyday videos in the user's cache technical ("important" as import, "general" as gene), and
`senseHintsFor` then sent a wrong sense with every window. `wantsTerms` uses the same matcher.
`vi-quality.js` `assess` flags a doubled word only for grammar words (`REPEAT_SLIP`) and never across
punctuation: "tôi. Tôi" and "rần rần" were severity-3 slips that paid for a refine (15 -> 6 of 531 lines).

**Quality check before a refine (2.3.2).** The last 6 severity-3 flags in the user's 531 cached
lines were all false, and each would pay for a refine; now 1 (a real English leftover). `assess`
leaves out web addresses, e-mails and handles (`ADDRESS_RE`) and the loanwords Vietnamese writes as
they are (`LOANWORDS`: video, email, app, livestream...) from English leftovers; strips sound notes
("[Music]", "♪") from both sides before judging, so a line of notes alone, or a note with at most 4
stray heard words, is never "empty"; and applies the length ratio only when the source is Latin or
Cyrillic script (a Hindi mantra or a Chinese line is short in characters, not in meaning).
2.4.2, from the 2026-10-01 batch (refine flags 36 -> 13 of 5638 lines): `LOANWORDS` also holds the
substances Vietnamese health writing names as they are (caffeine, melatonin, cortisol, dopamine...)
and sport and food words (golf, squat, cardio, sandwich): 16 of one sleep lecture's 17 flags. A line
of notes in round brackets ("(Laughter)" -> "[Tiếng cười]", `soundNoteLine`) is not judged, it read
as empty. A speaker label in capitals ("ANDREW HUBERMAN: Number six.") is left out of the length ratio
on both sides: the model drops it from some lines, which then read as omissions.
`translateWindow` runs `localFixes` (`fixSoundNotes`, then `fixRepeatedHeads`) on the first answer
before `assessAll`: what the free fix mends no longer pays for a refine (zPSs9a0MYGw: the head repeat
that cost one refine is mended first). Both fixes are idempotent, so the later passes in
`trimTranslationLeaks` / `ytTrimLeaks` change nothing more.

**Previous translation in context (1.8.3).** `ContextSession.buildRequest` sends the translation of
the two groups before the window (`prevTranslation`), but only if they are already recorded. Coursera's
two workers used to take windows turn about, so it was always empty; `translateAllGroups` now gives
each worker a contiguous half. The YouTube prefetch skips a window whose previous window is in flight or
still to do unless it starts within 20 s. A short last window (< 240 chars Coursera, < 160 YouTube)
joins the one before. Sense hints carry no `general` fallback. Measure with `node tools/context-eval.js`
(offline, `--root <dir>` for an old checkout). `prevTranslation`, terms and hints are not in the cache key.
1.8.4: `ContextSession.refSourceFor` adds `refSource` (prompt `[NHẮC LẠI TỪ TRƯỚC ...]`) when the window
has he/she or "the <noun>" (list `REF_NOUNS`) whose referent is not in the previous two units: the nearest
sentence naming a person (a capitalised word not in `OPENERS`) or the noun, 15 units back at most, 2
sentences at most; a noun in 3+ earlier units is the topic and skipped; "it"/"they" never. It joins the
cache key only when non-empty. `ytWaitForWindowBefore` is the one 20 s rule for prefetch and the
realtime +1/+2 groups. `cleanDescription` strips links, handles, sponsor lines, timestamps from the topic.
The console "🤖 GEMINI" line ends with `contextSummary`: what context each request carried.

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
`cs.viCues` + `cs.origCues`, and `mergeLines` pairs them up: each source line goes to the one
Vietnamese row it overlaps most (2.3.5; listed in every row it touched, the English came out 45%
longer than the video's, and 10% of rows now show no English line of their own). Click a row to seek, search inside the
talk, export `.srt` (bilingual when the display mode is bilingual). Both quick menus also show which
source track is in use (`ytNguonPhuDe` / `csSubtitleSource`): machine-heard captions are the usual
reason a translated line is wrong, and the label turns warning-coloured for them.

**Size scale and reading time (1.7.1).** `CST_STYLE.sizeFactor(fontSize)` = fontSize / 100 x 0.7: the
user found the old 70% the right size and asked for it to be called 100%; every pixel conversion
(YouTube and Coursera overlays, `video::cue`, the Settings preview) goes through it, and
`fontScale170` rescales stored sizes once (old / 0.7, rounded to 5). `CST_STYLE.lingerCues` keeps each
display line up to 0.7 s into the silence after it (0.06 s before the next line, idempotent via
`baseEnd`, which is what the cache stores). Display copies only: the voice keeps subtitle timing.
Fixture timeline: lines over 20 chars/s 3 -> 2, lines under 1 s 1 -> 0.

## Generic video pages (`content.js`, 1.6.5)

Any http(s) page that is not YouTube or Coursera: `getCurrentSite()` returns `"generic"` and
`isTrackSite()` sends it down the Coursera path (`translateTrackSite`). Nothing is injected until the
viewer asks: the popup's Translate button and the shortcuts grant `activeTab`, and
`background.js` `injectGenericPage` probes for `CST_UI`, then injects the ISOLATED group from the
manifest. There is no broad host permission, and `reinjectOpenTabs` does not touch these tabs (after
a Reload the viewer clicks Translate again).

- `csVideo()` takes the biggest visible `<video>` (playing ones count double); Coursera still takes the first.
- `pageTracks()` adds the video's `textTracks` that have no `<track>` element (video.js, Plyr,
  hls.js add them with `addTextTrack`), wrapped by `trackWrap` into the `{ track, srclang, kind, label }`
  shape of a `<track>` element; metadata, chapters, descriptions are skipped.
- No control bar found by `csPlayerParts`: `csPlayerBox()` returns `csFrame(v)`, a transparent
  absolutely-positioned frame over the picture (re-aligned by `csAlignFrame` on every render), and
  `csCreateFloatingButton` puts the button in its top-right corner. `init` retries the button for 30 s
  because players size the video after metadata loads.
- Native fullscreen of a bare `<video>` shows only the element, so `csRender` sets the track (which
  holds the Vietnamese cues) to `showing` there and hides the overlay.
- `genericMeta()` gives the translation context (og:title / h1, host as channel). Cost and edit keys
  are `host + path` (`currentVideoMeta`, `dubbing.js` `videoMeta`).
- Not supported, by design of this path: players inside a cross-origin `<iframe>` (Vimeo embeds,
  edX units) and sites that draw captions in their own DOM with no text track (Udemy). Each needs a
  site-specific source; see `BACKLOG.md`.

## YouTube flow (`youtube.js` + `yt-bridge.js`)

`ytKhoiDong` -> `ytTheoDoi` (watches SPA navigation) -> `ytTuDongDich` -> `ytBatDauDich`.
`ytBatDauDich` checks `stale()` (`yt.huyDich`, `yt.dead`, or the URL's video id changed) after
**every** await and returns false (1.7.4); a new await there needs the same check. `ytTuDongDich`
waits (up to 10 s) for a run left over from the previous video instead of skipping on `yt.busy`:

1. `ytDamBaoBridge` makes sure the MAIN-world bridge is alive (one file, `yt-bridge.js`, injected by
   the manifest or on request by the service worker; see `DANGER.md` item 2).
2. `ytHoiDanhSachPhuDe` asks the bridge for the caption track list, plus `audio` (1.6.9:
   `docAmThanh` in `yt-bridge.js`: original vs AI-dubbed audio tracks, read from the player by value
   shape since its property names are minified, falling back to the response's `audioTracks`).
   `ytNgonNguNoi` -> `CST_LANG.spokenLanguage` decides the spoken language (original audio > the one
   non-dub ASR track > title, "Vietsub"-style titles ignored). **Spoken Vietnamese is never
   subtitled** (auto: silent; by hand: a toast with "Vẫn dịch" = `ytBatDauDich({ force: true })`),
   and the check runs before the translation cache. `ytChonTrack(tracks, skip, { spoken, audio })`
   drops ASR tracks in an AI-dubbed audio language and prefers the spoken language's tracks.
   **YouTube's Vietnamese AI dub (1.7.0):** `CST_LANG.hearsVietnameseDub(audio)` (current track is an
   auto-dub in Vietnamese, original is not) stops `ytBatDauDich` too, with a toast whose action
   `ytChonAmThanhGoc` asks the bridge (`CHON_AM_THANH_GOC` -> `player.setAudioTrack`) for the original
   audio, then translates and dubs. The bridge polls `getAudioTrack` once a second and posts
   `AM_THANH_DOI` on a switch; `ytKhiDoiAmThanh` stops our subtitles and voice when the viewer moves
   onto the Vietnamese dub, and re-runs the opening checks when they move off it.
3. `ytHoiNoiDungPhuDe` asks the bridge to fetch the track; `ytDocNoiDungPhuDe` parses it.
   Auto-generated tracks carry per-word timings, which the segmenter uses.
   `splitCuesAtSentenceEnds` (`content.js`, 2.3.2) then cuts a line at a sentence end inside it
   ("cook more at home. I feel like I am"), by word times when the track has them, else by
   characters; abbreviations, decimals, a lower-case next word and a piece under 0.3 s keep the line
   whole. Grouping only looks at line ends: on the user's 6 punctuated videos 112 of 316 groups ended
   mid-sentence (the 24 s / 520 char limits cut them) and 64 windows ended on a fragment, where the
   model finished the sentence from the next window's context (a leak) or split it over two items
   (a head repeat). After: 11 groups, 1 window. A sentence start in the last word or two of a line
   ("5 years now. There's") has barely one word's time, so the 0.3 s rule kept 13 of 56 such lines
   whole on the first live video (2.3.6: all 8 one-word starts): it now moves to the front of the
   next line instead, if that follows within 1 s and has no `>>`. Over the 7 punctuated videos,
   lines left whole 135 -> 33 (word times modelled on the live one), groups ending mid-sentence 23 -> 10.
   A piece after a cut is `midLine`, and so is a line that took a sentence start, and so is its
   group: the voice reads across the cut as before (`DUBBING.md` "Across a caption line cut"), and
   the flag is the cache's 6th group field. `yt.cues` holds the pieces, so the English line of the
   bilingual display and the transcript rows change at the cut too. Coursera is not cut: its groups map back to the track's
   own cues (`cueIndexes`) for `applyTranslation`, and there is no Coursera data to measure it on.
4. `ytChayTienTrinhPrefetch` runs a 2-worker pool over `ytDichNhom`, staying `translateAhead`
   seconds ahead of playback. `ytDichKhanCap` jumps the queue after a seek. Windows are fixed by the
   text alone (`ytCanonicalWindows`, 1.7.3: close at a sentence end from 420 chars or 8 groups, at
   most 800 chars / 12 groups / 45 s; 2.3.2 raised 4 / 6 because groups are single sentences more
   often, which at 4 / 6 took 29% more requests, at 8 / 12 6% more), so a second visit from any
   position sends the same sentences and the translation cache hits. A window does not close at its
   soft limit before a `midLine` group, so the voice's segment across the cut arrives in one piece;
   the hard limits hold there too (2.3.6). 2.3.2 let a window run past them into any `midLine`
   group, and those come in runs (up to 26 in a row): windows reached 3,075 characters and 142 s,
   49 of 105 over a limit on the 7 punctuated videos, 0 of 150 now (+3 to +12 requests a video, at
   ~600 fixed input tokens each 0.0005-0.0018 USD). A window longer than the horizon was sent only
   once the viewer was inside it. The prefetch
   takes a window only when all of it is inside the horizon; a failed window backs off as a whole.
5. `ytVePhuDe` draws the subtitle itself into an overlay (YouTube's own caption layer is not used).
   `ytBatDauDongBo` drives it off `requestVideoFrameCallback`.
   While the player shows an ad (`ytAdShowing`, 1.9.3) nothing is drawn and nothing is sent for
   translation: the ad plays in the same `<video>` and its clock is not the lecture's.
6. `ytTatDich` tears down. (A never-wired live-caption path, `ytBatDauDOMCaptionObserver`, was
   removed in 1.7.3: wired, it would have cost one Gemini call per caption change.)
   `YT_GEN` / `YT_BORN` tag nodes; see `DANGER.md` before touching them.

## Message contracts

### Anything -> service worker: `chrome.runtime.sendMessage({ action })`

14 actions in the `ROUTES` table at the end of `background.js`, plus `ttsAbort`, which is handled
synchronously *before* routing (it must not wait on the queue):

`ensureYtBridge` · `translateUnit` · `translateUnitStore` · `synthesizeSpeech` · `audioCacheGet` ·
`audioCacheDelete` · `cacheStats` · `cacheClear` · `modelStatus` · `testKey` · `openOptions` ·
`costStats` · `costReset` · `localTtsStatus` · `ttsAbort` (`condenseSpeech` and `localTtsWarm` had no
caller and were removed in 1.7.3). `translateUnit` answers `engine`: `gemini`, `google` (Gemini off
or no key: the chosen engine) or `google_fallback` (Gemini failed or the budget ran out: shown, but
YouTube does not save such a video, so the next visit asks Gemini again).

To add one: write `handleX`, add `X: handleX` to `ROUTES`. Nothing else.

### Service worker or popup -> content script: `chrome.tabs.sendMessage({ method })`

`translate` · `phimTat` (keyboard shortcut relay) · `forgetVideoAudio` · `getStatus`

Handled by the listener near the end of `content.js`. (`popup.js` used to send a `setOptions` that
nothing handled; removed in 1.4.4, `ui.test.js` guards it.)

### `youtube.js` <-> `yt-bridge.js`: `window.postMessage({ cstType })`

Request/response pairs correlated by `requestId`:

`YEU_CAU_PHU_DE` -> `TRA_LOI_PHU_DE` (track list) ·
`YEU_CAU_NOI_DUNG_PHU_DE` -> `TRA_LOI_NOI_DUNG_PHU_DE` (track contents)

## Storage keys

### `chrome.storage.sync` (30 settings written by `options.js` `collectSettings`, plus `originalFirst` and `uiTheme`)

Subtitle: `subStyle` (nested object; defaults live in `subtitle-style.js`), `dualMode`,
`perCueMode`, `skipSameLang` (on: a video's own Vietnamese track is used as is; off: translate from
the source track; YouTube, Coursera, generic), and `originalFirst`, which only the popup writes
(`popup.js`), never `collectSettings`. `styleOriginal`, the popup's "Làm mờ dòng tiếng Anh", was never
read by the page and was removed in 1.7.3; old stored values are ignored.

AI and cost: `useAi`, `geminiApiKey`, `geminiModel`, `geminiStrongModel`, `costMode`,
`autoTranslate`, `budgetDailyUsd`, `budgetVideoUsd` (always USD; the VND view converts), `costCurrency`
(`vnd` / `usd` / `both`), `costUsdVnd`, `costExtraPct` (display only; `COST.moneyOpts`, `COST.money`)

Glossary: `glossaryEnabled`, `userKeep`, `userNormalize`, `enabledGroups`, `knownGroups` (1.8.5:
group keys the user had seen at the last Save; a group missing from it starts enabled, see
`CST_resolveEnabledGroups` in `glossary.js`)

UI: `uiTheme` (`auto` / `light` / `dark`), written by `theme.js`, **not** by `collectSettings`. It is
also mirrored into `localStorage` as `cstUiTheme` so the page can paint before storage resolves.

Dubbing: `dubEnabled`, `dubProvider`, `dubTtsModel`, `dubVoiceName`, `dubGeminiVoice`,
`dubGeminiVoice2`, `dubLocalVoice`, `dubLocalVoice2`, `dubSecondVoice` (off by default: every speaker is S1,
see `DubEngine.oneVoice`), `dubDuck`, `dubVolume`, `dubPrepareWait`.
`dubMaxRate` (0 = automatic, else 1.1 to 1.5: caps every rate in `DubEngine.chooseRate` /
`paceLimits` through `userMaxRate()`, applied live). `dubCondense` is retired (condensing is
permanently off, see `DUBBING.md`); old stored values are ignored.

One-shot migration flags (do not reuse the names): `modelsVersion`, `costMigration113`,
`localVoices1111`, `dubProvider1113`, `dubProvider181` (1.8.1: paid voice off, source forced to vieneu once), `styleDefaults118`, `fontScale170` (size / 0.7, chained after
`styleDefaults118`), `voiceMyDuyen170`

**`options.js` writes every key on every change**, so `storage.onChanged` fires for keys that did
not actually change. `youtube.js` has a deliberate "only act on a real change" guard so this does
not stack two dubbing voices. Keep it.

### `chrome.storage.local` (not user-editable; written by `background.js`, `youtube.js`, `content.js`)

`edits:<videoKey>` is the exception: the viewer's own line corrections, written by
`subtitle-edits.js` from the transcript panel and the Settings tab "Phụ đề đã sửa". videoKey is
`currentVideoMeta().videoKey` (`yt:<id>` or the Coursera lecture path). Shape:
`{ title, url, updated, lines: { "<startMs>": { text, orig } } }`. Never write edits into
`ytcache4_*`: `ytGhiCache` stores `cstOrig` (the machine text) so a revert in Settings really reverts.


`modelAccess` per-API-key model availability, keyed by a SHA-256 hash of the key, 3-day TTL; a refusal repeated right after a lapse doubles it (`ttl`, cap 30 days, 2.2.2); a lapsed refusal is kept 60 days so `likelyModel` names the next model and the Settings cards say it will be retried once ·
`costLedger` daily cost ledger (2.1.0: every billed request is charged through `geminiCall`'s `policy.onBilled`, also thrown-away answers and our own timeouts, which Google still bills; `inTok`/`outTok`/`estCalls` added; 2.1.1: `thoughtTok`, `cachedTok`, `byModel`) · `costHistory` the same text-call totals keyed by Google's billing day (Pacific time, `pacificDay()`), last 31 days, kept by `costReset` · `costTokenRatio` measured characters per token for estimates · `ytcache4_<videoId>` cached YouTube translations (an older
`ytcache` prefix exists; swept once a day, `ytSweptAt`, since the sweep reads all of storage.local;
the newest 100 are kept, 2.4.0 (50 in 2.3.9): measured 90 KB a video, 6.8 KB a minute, so ~9 MB;
the manifest asks for `unlimitedStorage` because storage.local alone holds 10 MB, and a 64 MB cap
guards against a runaway store. The dubbing audio store went from 200 MB to 3 GB with it
(`background.js` `AUDIO_CACHE_MAX_BYTES`: ~61 MB for a 13-minute video, so ~50 videos). Saved only once the whole video is translated and no group fell back to
Google. Settings shows the count and how many were saved since the last review: `background.js`
`REVIEW_MARK` `{ until, videos }`, **moved by the session that finishes a batch review**) ·
`ctxterms_<key>` agreed context terms `{ luc, v, terms }` (an empty list is never written, 2.3.1; the
sweep drops one left from before, 2.3.3; a `ctxterms_yt_` list without `v: 2` is neither read nor
kept, 2.3.8: all 6 of the user's were learned before 2.3.0 fixed domain detection, held "Whole Foods
= thực phẩm hữu cơ", "pricey = giá thành cao", and every later video of the channel re-saved them; a
term whose Vietnamese is a glossary placeholder is never stored) · plus the `cst-cache` IndexedDB
database, which is separate (see `DUBBING.md`).

### `chrome.storage.session`

`costSession` per-session cost · `localTtsLastOk` time of the last good VieNeu render, so
`localIsCold()` survives the service worker sleeping (see `DUBBING.md` "Render speed").

**Backup (1.6.6).** `settings-backup.js` + the "Sao lưu cài đặt" card: exports all of
`storage.sync` and the `edits:*` keys of `storage.local` (never caches), the API key only when the
box is ticked. Import validates (`parseBackup`), confirms, writes, reloads the page so the stale
form cannot autosave over it. Controls marked `data-no-save` are skipped by the autosave listener.
A new sync key is backed up automatically; a new local key needs a prefix in `LOCAL_PREFIXES`.

## Adding a setting: the 4 places

1. A control in the right card of `options.html`.
2. Read it in `options.js` when loading, and add it to `collectSettings`.
3. A default wherever it is consumed (`cost-policy.js`, `subtitle-style.js` or the module itself).
4. If the content script must react live, handle it in the `storage.onChanged` listener.

Miss step 2 and the setting silently never saves. Miss step 1 and you get a dead key, which is
exactly how the retired `dubCondense` key ended up with four contradictory sources.
