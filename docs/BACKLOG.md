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

(10, a late refine missing YouTube's per-video copy, fixed 1.9.4 `ytSaveAfterRefine`; 12, the store
scan after a wake, measured 1.9.4 in real Chrome IndexedDB: 1.9 ms for 300 records, 5.4 ms for
1,000, 17 ms for 3,000; the audio store holds ~200 to 1,000, and eviction and delete no longer scan
twice.)

**11. A refined line is voiced twice.** Paid voice only (Gemini TTS, off since 1.8.1 `PAID_TTS`). When a refine replaces a line whose Gemini TTS audio was
already made, the engine re-renders it (the words changed, so this is correct, but it pays twice for
that line). Holding TTS until a refine settles would delay the voice; not measured as worth it.

**13. The Gemini voice preview in Settings is not cached** (moot while `PAID_TTS` is off, 1.8.1): each click pays ~5 s of audio, about
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
| trong quý vừa qua | đã" now has one boundary, before "đã"). 1.9.6: a small lexicon of predicate verbs
(`PRED_VERBS`: đạt, chiếm, cho thấy, mang lại, gây ra...) marks "Độ chính xác trên tập kiểm tra | đạt
95%" too (syntax4 real takes: wrong stops kept 9 -> 3, missed 6/20 -> 0/20). Left: verbs outside that
list still unmarked; a short subject before one is legal but not invited (readers disagree there). "Điều này | có nghĩa là" untouched. The
relative-"mà" and topic-"thì" limits (6 syllables) were set on seen sentences: check them on new ones.

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

**21. Respellings cover 58 of 67 candidate names** (1.9.5: "long" laung, "pi" pie, "ray" rae, "mae" mey
by hand; "may", "bin", "son", "do" tagged as they are, which their English engine reads right once
tagged). The VieNeu front end now reads roy, guy, kay, lou, pam, liam, ian and queen the English way
untagged, so they need nothing (`tools/build-speech-tables.js` reports them). Left: du, hang, phan (no
spelling found; also Vietnamese surnames), "beach" (read right in context: "Long Beach" bˈiːtʃ).

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
Found in dev d77. 1.9.6 probed 8 separators on the real voice (zero-width space, NBSP, comma, dash,
parentheses, `<en>` on "Google", `<vi>` on "So"): none changes it. Only a different word does, which
rule 1 forbids. A VieNeu limitation; leave it unless the server's chunker changes.

**28. Cross-subtitle bridging only for the free voice.** Paid voice only (off since 1.8.1). A paid voice keeps a cut at every
translation group, so "Christopher | Nolan" split over two groups is still two takes there: moving
that cut would re-bill stored audio. A silence of 1.2 s or more between lines is always followed.

**29. (mostly closed 1.8.2)** First blind split failures, moved into dev (`prosody-corpus.js` syntax2,
`speech-corpus.js` d89-d96) and fixed by rule, not by phrase: result "nên", "so với" after a quantity,
long last list item, short relative clause, short purpose clause soft. Left: "Ken" is read kɛn, the
same phonemes in both languages (a scorer artefact of `pron-eval`, not a voice fault); lone "Kim"
with an English source line stays Vietnamese by design (26); "thẻ | và" (L1) is now allowed, not chosen.

## Found by the 1.8.2 work, not fixed

**30. Second blind split (`tests/blind-corpus-2.js`, separate agent, frozen at 30c6076, scored once).**
1.9.5 moved its failures into dev (`prosody-corpus.js` syntax3 with counterparts, `speech-corpus.js`
d97-d98) and fixed them by rule: comparative "như" after a gradable word, a result "nên" ends the
fronted clause, a short time clause after a short clause is soft (rule C), a short subject (< 8
syllables) in a clause under 20 is closed (not after a list). Real takes, syntax3: 13 wrong stops kept
-> 1; no other set moved on WRONG / MISSED / RAN-ON. Phonemes: "Long Beach", "Raspberry Pi" fixed
(blind 2 79 -> 81 of 82). Left on purpose: cue k5 ("Mình mở máy / để kiểm tra", 0.7 s gap): the
speaker paused there and a soft boundary follows the speaker; "Vinamilk" read English by VieNeu, a
label question like 23. Blind split 2 is no longer blind for these items: a blind split 3 needs a
separate agent that has not seen the rules.

**31. Purpose clause length is a judgment call.** 1.8.2 makes "để" after a short predicate soft (legal,
not invited) when either side is <= 6 syllables and both fit 16: "Tôi dùng ChatGPT để phân tích dữ liệu"
is now read in one breath unless the voice stops long on its own. The 1.8.0 note said the user ruled the
split right; the dev marks were always "/" (either way). If the user wants the stop back, raise the
`purposeAttached` cost in `dub-prosody.js` `constituents` (part C).

## Found by the 1.8.6 delivery work, not fixed

**33. A server near real time (RTF ~0.9) still chases.** One request at a time, each take lands as
its line ends; after a seek the engine now skips what it cannot reach (13.6 -> 7.7 s to voice) but a
line can then start 3.5 s late. Only a faster server (int8, GPU) really fixes it; `describeHealth`
already tells the viewer.

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
The old README changelog for that period was removed on 2026-09-27; read it with
`git show d0c46d5:README.md`.
