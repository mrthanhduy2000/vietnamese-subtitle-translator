# Backlog

Known defects and leftovers, found by audit, **not yet decided on**. None of these are currently
breaking anything the user has reported. Do not fix one as a drive-by: they touch settings and state,
so each deserves its own change and its own version bump. Ask the user first.

Add to this file whenever you find something out of scope for your task. Delete entries you fix.

## Defects

none open (items 1 to 4 fixed in 1.6.4: condense switch, `dualMode` source of truth, single
bridge, glossary exports).

## Not built yet

**9. Site-specific caption sources for generic pages.** Udemy draws captions in its own DOM (no
text track; the public previews have no captions at all, so it could not be inspected); edX puts
the unit in a cross-origin iframe and its player's `data-metadata` holds `transcriptTranslationUrl`.
Both need a logged-in sample page to build against. The generic path (`SUBTITLE.md`) covers any
player that exposes standard text tracks.

## Found by the 1.7.4 audit, deliberately not fixed

**10. A late refine misses YouTube's per-video copy.** `ytGhiCache` saves once the last group is
translated; a background refine (`onRefined`) that lands after that is not in `ytcache4_`, so the
next visit shows the pre-refine line (no cost: the refined line is in the IndexedDB store). Rare.

**11. A refined line is voiced twice.** When a refine replaces a line whose Gemini TTS audio was
already made, the engine re-renders it (the words changed, so this is correct, but it pays twice for
that line). Holding TTS until a refine settles would delay the voice; not measured as worth it.

**12. Unmeasured: the first cache write after each service-worker wake lists every meta record**
(`TieredCache.ensureTotals`). Cheap for a small store; no IndexedDB in Node to measure a full one.

**13. The Gemini voice preview in Settings is not cached**: each click pays ~5 s of audio, about
0.1 to 0.3 US cents at the catalog's estimated prices. VieNeu previews are free.

**14. Coursera waits for a retranslation before showing a window** (`translateWindow` with
`realtime: false`): when the quality check asks for one (Cân bằng: severe issues only), that window
shows one Gemini round trip later. Kept: showing first and replacing later (as YouTube does) makes
the voice read the line twice, and Gemini TTS bills both.

**15. A stretch with no boundary at all is read in one run.** 1.7.6 dropped the 1.7.5 rule "a 0.16 s
breath after 4.5 s wherever the voice stopped" on purpose: in the corpus it split units ("gấp | mười",
"đô | la", "chuẩn | bị"). A pause now needs a gap of value >= 0 (`dub-prosody.js` `K.minValue`), and
a breathing comma needs value >= 0.6 in a 20+ syllable stretch. A run of words with no such gap (a
long English name, a repeated word) keeps no pause. In the corpus 6 of 140 marked "|" boundaries got
no voice stop at all (RAN-ON), same as 1.7.5. The 1.7.5 case (`speech-bench.live.js` `ky-thuat`) now
keeps "phi tuyến | giữa đầu vào".

## Found by the 1.7.6 prosody evaluation, not fixed

**16. Mild pause placements the model still keeps.** 1.7.8 fixed "tăng | từ 72,5%", "tăng mạnh |
nhờ vào", "chỉ tốt | bằng", "tập thể dục | vào buổi sáng", relative "mà", topic "thì", "thấp hơn
nhiều | so với" (`adjustJoins`, see `DUBBING.md` "1.7.8 additions"; WRONG on the four old sets 18 ->
3). 1.8.0 (`constituents`): a prepositional phrase inside a subject is no longer a boundary when the
predicate has a marker the model knows (đã, sẽ, là, được, a verb of change...: "công ty ... ở California
| trong quý vừa qua | đã" now has one boundary, before "đã"). Left: a subject whose verb has no marker
("Độ chính xác trên tập kiểm tra | đạt 95%"): the model has no verb lexicon and does not guess. "Điều này | có nghĩa là" untouched. The
relative-"mà" and topic-"thì" limits (6 syllables) were set on seen sentences: check them on new ones.

**17. (fixed 1.7.8)** Versions in model names are read with "chấm" ("GPT 5 chấm 6", "gemini 2 chấm 5
flash lite"), for every voice (`adaptForSpeech`).

**18. Alignment limits.** A stop's place in the text is its share of voiced time (mean error 0.33
syllables on punctuation, 4 of 220 off by more than 1). If the voice skips or repeats a word, or two
stops fall within 1.5 syllables of one boundary, the later decisions can land on the neighbouring
gap. Punctuation anchors bound the damage to one clause.

**19. Nobody has listened to 1.7.6 blind.** The marks in `tests/prosody-corpus.js` are one reader's
judgment and the numbers measure agreement with them. The A/B WAVs of this session were sent in chat.

## Found by the 1.7.7 cold-server fix, not fixed

**20. VieNeu gets swapped out on a 16 GB Mac.** After ~4 days idle the server held 24 MB of its
1.2 GB model; the first renders ran at 3.5x real time. 1.7.7 stops the page overreacting, but the
first seconds of a video are still silent while the model pages in. A real fix lives in
`~/VieNeu-TTS` (outside this repo): keep the model resident, or restart it. The same-run engine
simulation (tests/hardening) does not reproduce the 7 dropped lines; the fix is judged by reasoning.

## Found by the 1.7.8 English-in-speech work, not fixed

**21. Respellings cover 45 of 67 candidate names** (1.8.0 added "sam": "samh"). No spelling was found that VieNeu's English
engine reads the English way for kim, do, du, hang, bin, nan, ton, son, phan, leo, ray, roy, guy,
kay, may, mae, lou, pam, liam, ian, beach, queen: inside an English name they are still read as
Vietnamese syllables ("Liam" is fine only because "liam" is not one). The "sam" holdout was dropped in 1.8.0 (a new
blind split exists, `tests/blind-corpus.js`). Some targets are only near ("shalamay" is two words).

**22. What is checked is phonemes, not sound.** `tools/pron-eval.js` reads VieNeu's phonemes; nobody
has listened to the renders blind, and no speech recogniser runs here (none installed; downloading one
needs the user's permission). `tools/speech-ab.js` numbers for clicks and level jumps are proxies.

**23. Label debate: "RAM" in validation v12 is marked English**; VieNeu reads it ɹˈaːm (English r,
Vietnamese vowel), which many Vietnamese speakers say too. Left as marked so the validation score is
not edited to look better. 1.8.0: a 5+ letter code with **no vowel** gets English letters only on
English evidence (the source line has it); VieNeu spells every such code Vietnamese. A code with a
vowel is left to VieNeu even though it spells "CRISPR", "NGINX", "MMORPG" with Vietnamese letter
names: whether it is said as a word or as letters is unknown, and a wrong English guess is worse.

**25. (judgment changed 1.8.0)** The user ruled "[Tôi dùng ChatGPT] [để phân tích dữ liệu]" the right
split: a purpose clause is a clause boundary. `speech-corpus.js` d3/d4 now mark it "/". "chạy Google
Ads | cho ..." is closed by the short-predicate rule. Old text: A short main clause before "để" / "cho" keeps the voice's stop ("Tôi dùng ChatGPT | để phân
tích dữ liệu", "chạy Google Ads | cho một ... campaign"; `tools/speech-ab.js` dev, same in 1.7.7 and
1.7.8). Not a language-boundary rule: "để" (purpose, opener weight 22) after 4-5 syllables is a
strong boundary for every sentence. A fix needs new marked sentences with "để" first.

**24. Unknown all-caps defaults to English letters.** A 2-4 letter code VieNeu spells Vietnamese
("CPC") becomes `<en>c p c</en>` unless it is in `VI_CAPS` or VieNeu's own table. A Vietnamese code
not in either (a new bank or firm) would be read English. With an English source line present the
evidence rules still do not check caps against it: a possible refinement.

## Found by the 1.8.0 context / constituent work, not fixed

**26. Conservative misses, on purpose.** A lone "Dan", "Lan", "An", "Van", "Tan" stays Vietnamese
even when the English source line names them (an English video about a Vietnamese person writes them
the same way); "anh Dan" with source "Dan says" is not rewritten. "Kim", "Leo", "Ray" and the other 22
names without a respelling are read Vietnamese inside any English name. At the start of a sentence
only name words (`NAME_WORDS`) count before an English surname.

**27. "So Google với Bing" is read "sˈoʊ" by VieNeu itself** (its chunker, not a rewrite of ours).
Found in dev d77; not addressed.

**28. Cross-subtitle bridging only for the free voice.** A paid voice keeps a cut at every
translation group, so "Christopher | Nolan" split over two groups is still two takes there: moving
that cut would re-bill stored audio. A silence of 1.2 s or more between lines is always followed.

**29. Blind split failures (1.8.0, scored once, not tuned on).** Kim Kardashian, Ken Griffin, Ben
Affleck, lone Ben / Kim with an English source line (no respelling; add "ben" / "ken" to
`build-speech-tables.js` NAMES and search). Prosody: "phần trăm | so với cùng kỳ" kept by the text-only
choice in a 25-syllable run once the subject's PP was closed; "hộ chiếu, ảnh thẻ | và" (a list item
the model blocks); "sáng | nên" (cause "nên" after a clause without a comma, missed); "Adobe Premiere
Pro | để" and "đây | để": the blind author marks a short purpose clause attached, the user ruled the
opposite for "Tôi dùng ChatGPT / để": needs a decision on length. Move these into dev next round and
write a new blind split with a separate agent.

## Cosmetic / housekeeping

**5. The folder name says `v1.0.4`, the extension is many versions past that.** Renaming the folder means
re-running Load unpacked in Chrome, which creates a new extension id and **loses the stored API key
and settings**, so this is deliberately not done. Just do not trust the folder name.

**7. Two stylesheets, same design tokens.** `options.html` carries ~810 lines of inline CSS while
`popup.css` is a separate 923-line file, and they duplicate the same tokens with nothing shared.

**8. `legacy/old-splitter.js` duplicates a large Vietnamese compound-word lexicon** that
`vi-segmenter.js` also maintains. This one is intentional (frozen baseline) and should stay, but be
aware the lexicon exists twice and only one copy is live.

## No version control history before 2026-09-23

`git init` was run on 2026-09-23 with the whole 1.4.0 tree as the first commit. Everything from
v1.0.4 to v1.4.0 has no per-release history (`version-history.js` reconstructs it for the UI). The original v1.0.4 zip sits at
`~/Downloads/vietnamese-subtitle-translator-v1.0.4.zip` if you ever need the true starting point.
`README.md` is the closest thing to a changelog for that period; `grep -n '^#' README.md` gives the
index.
