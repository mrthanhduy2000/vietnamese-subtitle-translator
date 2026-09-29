# Backlog

Known defects and leftovers, **not yet decided on**. None of these is breaking anything the user has
reported. Do not fix one as a drive-by: they touch settings and state, so each deserves its own change
and its own version bump. Ask the user first.

How this file works:
- Grouped by **area**, not by when it was found; *(found 1.x.y)* after a title says when.
- Numbers are permanent: code comments and `version-history.js` cite them. Never renumber. The next
  free number is **39**.
- Add an entry whenever you find something out of scope for your task. Delete it once it is fixed and
  add its number to "Closed" below. An entry that is only partly fixed keeps what is left, not the
  story of the fix (that is in git and `DUBBING.md`).

Closed (story in git and `version-history.js`): 1-4 (1.6.4), 6, 10 and 12 (1.9.4), 17 (1.7.8),
25 (merged into 31), 32 and 34 (1.8.7), 35 (1.9.8), 38 (2026-09-29: every lead checked, none
kept; the numbers are in `DUBBING.md` under the 1.9.9 buffer).

Declined by the user, never re-add or re-propose: 37 (2026-09-28, the VieNeu "release the slot at
once" server patch; real use showed 27 slow releases in 7979 takes, ~2 min of delay a week, and the
full gain needed the fragile abort path in `DANGER.md` §15. The patch was deleted; it is in git).

## Defects

none open.

## Subtitles and translation

**9. Site-specific caption sources for generic pages.** *(found 1.6.5)* Udemy draws captions in its
own DOM (no text track; the public previews have no captions at all, so it could not be inspected);
edX puts the unit in a cross-origin iframe and its player's `data-metadata` holds
`transcriptTranslationUrl`. Both need a logged-in sample page to build against. The generic path
(`SUBTITLE.md`) covers any player that exposes standard text tracks.

**14. Coursera waits for a retranslation before showing a window** *(found 1.7.4 audit)*
(`translateWindow` with `realtime: false`): when the quality check asks for one (Cân bằng: severe
issues only), that window shows one Gemini round trip later. Kept: showing first and replacing later
(as YouTube does) makes the voice read the line twice, and Gemini TTS bills both.

## Dubbing: when the voice speaks (delivery, slow server)

**20. VieNeu gets swapped out on a 16 GB Mac.** *(found 1.7.7)* After ~4 days idle the server held
24 MB of its 1.2 GB model; the first renders ran at 3.5x real time. 1.7.7 stops the page
overreacting, but the first seconds of a video are still silent while the model pages in. A real fix
lives in `~/VieNeu-TTS` (outside this repo): keep the model resident, or restart it. The same-run
engine simulation (tests/hardening) does not reproduce the 7 dropped lines; the fix is judged by
reasoning.

**33. A server at or past real time (RTF 0.9 and up).** *(found 1.8.6)* (Mostly closed 1.9.7.) The
reach decisions ran on a speed read 5x too fast: the 0.6 s overhead guess, store answers, and a job
left over from a seek read as 0 s. The overhead is now fitted and those are fixed; `crowdsNext`
gives up a late line to save the next one (DUBBING.md "1.9.7"). Left: a server at RTF 1 or more, or
RTF 0.9 at 2x, cannot keep up whatever the page does. Lines start late or are skipped; only a faster
server (int8, GPU) fixes that, and `describeHealth` tells the viewer.

**36. A server that stays slow on a fast talk with a slow voice.** *(found 1.9.9)* The 60 s buffer
(1.9.9) carries a slowdown of a few minutes. It cannot help when VieNeu stays at 0.8x or slower for
the whole video while the voice needs 1.25 s of audio per second of it (Mỹ Duyên, 3.8 syllables/s,
on zPSs9a0MYGw). Lines then start late or are skipped. What fixes it is a quicker voice (the quick
menu names one: `fasterVoices`) or a less loaded Mac. Never shorter speech (CLAUDE.md rule 1).

## Dubbing: where the voice pauses (prosody)

**15. A stretch with no boundary at all is read in one run.** *(found 1.7.4 audit)* 1.7.6 dropped
the 1.7.5 rule "a 0.16 s breath after 4.5 s wherever the voice stopped" on purpose: in the corpus it
split units ("gấp | mười", "đô | la", "chuẩn | bị"). A pause now needs a gap of value >= 0
(`dub-prosody.js` `K.minValue`), and a breathing comma needs value >= 0.6 in a 20+ syllable stretch.
A run of words with no such gap (a long English name, a repeated word) keeps no pause. In the corpus
6 of 140 marked "|" boundaries got no voice stop at all (RAN-ON), same as 1.7.5. The 1.7.5 case
(`speech-bench.live.js` `ky-thuat`) now keeps "phi tuyến | giữa đầu vào". A lead, checked on text
only (2.0.8, not shipped; `node tools/syntax-eval.js --breath=0.35,18`): `BREATH` minValue 0.35 and
minRun 18 (now 0.6 / 20) put a breathing comma at 12 of the 25 "|" with no punctuation (3 now) and
at 18 "/" (7 now), never at an unmarked gap, changing 29 of 184 corpus sentences ("... thương mại
điện tử, ảnh hưởng đến"). It changes what VieNeu reads, so it needs real takes of the new text (the
local server, outside the sandbox) and an ear before it ships.

**16. Mild pause placements the model still keeps.** *(found 1.7.6)* 1.7.8 fixed "tăng | từ 72,5%",
"tăng mạnh | nhờ vào", "chỉ tốt | bằng", "tập thể dục | vào buổi sáng", relative "mà", topic "thì",
"thấp hơn nhiều | so với" (`adjustJoins`, see `DUBBING.md` "1.7.8 additions"; WRONG on the four old
sets 18 -> 3). 1.8.0 (`constituents`): a prepositional phrase inside a subject is no longer a
boundary when the predicate has a marker the model knows (đã, sẽ, là, được, a verb of change...:
"công ty ... ở California | trong quý vừa qua | đã" now has one boundary, before "đã"). 1.9.6: a
small lexicon of predicate verbs (`PRED_VERBS`: đạt, chiếm, cho thấy, mang lại, gây ra...) marks "Độ
chính xác trên tập kiểm tra | đạt 95%" too (syntax4 real takes: wrong stops kept 9 -> 3, missed 6/20
-> 0/20). 2.0.4 added 16 verbs of effect with three guards (DUBBING.md "2.0.4"; syntax5 and the
held-out syntax6: WRONG 7 -> 0, MISSED 29 -> 0). Left: verbs outside that list still unmarked; a
short subject before one is legal but not invited (readers disagree there). "Điều này | có nghĩa là" untouched. The relative-"mà" and
topic-"thì" limits (6 syllables) held on new sentences (syntax5 W11-W14, 2026-09-29: no wrong or
missed stop).

**18. Alignment limits.** *(found 1.7.6)* A stop's place in the text is its share of voiced time
(mean error 0.33 syllables on punctuation, 4 of 220 off by more than 1). If the voice skips or
repeats a word, or two stops fall within 1.5 syllables of one boundary, the later decisions can land
on the neighbouring gap. Punctuation anchors bound the damage to one clause.

**19. Nobody has listened to 1.7.6 blind.** *(found 1.7.6)* The marks in `tests/prosody-corpus.js`
are one reader's judgment and the numbers measure agreement with them. The A/B WAVs of this session
were sent in chat.

**29. First blind split leftovers.** *(found 1.8.0)* (Mostly closed 1.8.2.) First blind split
failures, moved into dev (`prosody-corpus.js` syntax2, `speech-corpus.js` d89-d96) and fixed by
rule, not by phrase: result "nên", "so với" after a quantity, long last list item, short relative
clause, short purpose clause soft. Left: "Ken" is read kɛn, the same phonemes in both languages (a
scorer artefact of `pron-eval`, not a voice fault); lone "Kim" with an English source line stays
Vietnamese by design (26); "thẻ | và" (L1) is now allowed, not chosen.

**30. Second blind split (`tests/blind-corpus-2.js`, separate agent, frozen at 30c6076, scored once).** *(found 1.8.2)*
1.9.5 moved its failures into dev (`prosody-corpus.js` syntax3 with counterparts, `speech-corpus.js`
d97-d98) and fixed them by rule: comparative "như" after a gradable word, a result "nên" ends the
fronted clause, a short time clause after a short clause is soft (rule C), a short subject (< 8
syllables) in a clause under 20 is closed (not after a list). Real takes, syntax3: 13 wrong stops kept
-> 1; no other set moved on WRONG / MISSED / RAN-ON. Phonemes: "Long Beach", "Raspberry Pi" fixed
(blind 2 79 -> 81 of 82). Left on purpose: cue k5 ("Mình mở máy / để kiểm tra", 0.7 s gap): the
speaker paused there and a soft boundary follows the speaker; "Vinamilk" read English by VieNeu, a
label question like 23. Blind split 2 is no longer blind for these items: a blind split 3 needs a
separate agent that has not seen the rules.

**31. Purpose clause length is a judgment call.** *(found 1.8.2)* 1.8.2 makes "để" after a short
predicate soft (legal, not invited) when either side is <= 6 syllables and both fit 16: "Tôi dùng
ChatGPT để phân tích dữ liệu" is now read in one breath unless the voice stops long on its own. In
1.8.0 the user ruled a purpose clause a clause boundary, "[Tôi dùng ChatGPT] [để phân tích dữ liệu]"
(old item 25, merged here); the dev marks were always "/" (either way). If the user wants the stop
back, raise the `purposeAttached` cost in `dub-prosody.js` `constituents` (part C).

## Dubbing: how English inside Vietnamese is said

**21. Respellings cover 58 of 67 candidate names** *(found 1.7.8)* (1.9.5: "long" laung, "pi" pie,
"ray" rae, "mae" mey by hand; "may", "bin", "son", "do" tagged as they are, which their English
engine reads right once tagged). The VieNeu front end now reads roy, guy, kay, lou, pam, liam, ian
and queen the English way untagged, so they need nothing (`tools/build-speech-tables.js` reports
them). Left: du, hang, phan (no spelling found; also Vietnamese surnames), "beach" (read right in
context: "Long Beach" bˈiːtʃ).

**22. What is checked is phonemes, not sound.** *(found 1.7.8)* `tools/pron-eval.js` reads VieNeu's
phonemes; nobody has listened to the renders blind, and no speech recogniser runs here (none
installed; downloading one needs the user's permission). `tools/speech-ab.js` numbers for clicks and
level jumps are proxies.

**23. Label debate: "RAM" in validation v12 is marked English** *(found 1.7.8)*; VieNeu reads it
ɹˈaːm (English r, Vietnamese vowel), which many Vietnamese speakers say too. Left as marked so the
validation score is not edited to look better. 1.8.0: a 5+ letter code with **no vowel** gets
English letters only on English evidence (the source line has it); VieNeu spells every such code
Vietnamese. A code with a vowel is left to VieNeu even though it spells "CRISPR", "NGINX", "MMORPG"
with Vietnamese letter names: whether it is said as a word or as letters is unknown, and a wrong
English guess is worse.

**24. Unknown all-caps defaults to English letters.** *(found 1.7.8)* A 2-4 letter code VieNeu
spells Vietnamese ("CPC") becomes `<en>c p c</en>` unless it is in `VI_CAPS` or VieNeu's own table.
A Vietnamese code not in either (a new bank or firm) would be read English. With an English source
line present the evidence rules still do not check caps against it: a possible refinement.

**26. Conservative misses, on purpose.** *(found 1.8.0)* A lone "Dan", "Lan", "An", "Van", "Tan"
stays Vietnamese even when the English source line names them (an English video about a Vietnamese
person writes them the same way); "anh Dan" with source "Dan says" is not rewritten. "Kim", "Leo",
"Ray" and the other 22 names without a respelling are read Vietnamese inside any English name. At
the start of a sentence only name words (`NAME_WORDS`) count before an English surname.

**27. "So Google với Bing" is read "sˈoʊ" by VieNeu itself** *(found 1.8.0)* (its chunker, not a
rewrite of ours). Found in dev d77. 1.9.6 probed 8 separators on the real voice (zero-width space,
NBSP, comma, dash, parentheses, `<en>` on "Google", `<vi>` on "So"): none changes it. Only a
different word does, which rule 1 forbids. A VieNeu limitation; leave it unless the server's chunker
changes.

## Paid voice only (off since 1.8.1)

**11. A refined line is voiced twice.** *(found 1.7.4 audit)* Paid voice only (Gemini TTS, off since
1.8.1 `PAID_TTS`). When a refine replaces a line whose Gemini TTS audio was already made, the engine
re-renders it (the words changed, so this is correct, but it pays twice for that line). Holding TTS
until a refine settles would delay the voice; not measured as worth it.

**13. The Gemini voice preview in Settings is not cached** *(found 1.7.4 audit)* (moot while
`PAID_TTS` is off, 1.8.1): each click pays ~5 s of audio, about 0.1 to 0.3 US cents at the catalog's
estimated prices. VieNeu previews are free.

**28. Cross-subtitle bridging only for the free voice.** *(found 1.8.0)* Paid voice only (off since
1.8.1). A paid voice keeps a cut at every translation group, so "Christopher | Nolan" split over two
groups is still two takes there: moving that cut would re-bill stored audio. A silence of 1.2 s or
more between lines is always followed.

## Cosmetic / housekeeping

**5. The folder name says `v1.0.4`, the extension is many versions past that.** Renaming the folder
means re-running Load unpacked in Chrome, which creates a new extension id and **loses the stored
API key and settings**, so this is deliberately not done. Just do not trust the folder name.

**7. Two stylesheets, two palettes.** `options.html` carries its CSS inline, `popup.css` is a
separate file. They do not share tokens because they are not the same design: the popup uses
`--claude-*` (accent #D97757, Newsreader), the options page `--primary` (#c96442, Source Serif 4).
Unifying them is a design decision for the user, not a cleanup. The dead CSS is gone
(2.0.2, 2.0.3): the legacy `:root` block, 9 fully overridden rules, and every early declaration a
later rule with the same selector overrides (50 declarations, plus the stale color in 3 border shorthands).
Each step checked with 0 computed-style differences over every element in light and dark, against
the committed page in an iframe. `popup.css` has none. Only the palette question is left.

**8. `tests/legacy/old-splitter.js` duplicates a large Vietnamese compound-word lexicon** that
`vi-segmenter.js` also maintains. This one is intentional (frozen baseline) and should stay, but be
aware the lexicon exists twice and only one copy is live.

## No version control history before 2026-09-23

`git init` was run on 2026-09-23 with the whole 1.4.0 tree as the first commit. Everything from
v1.0.4 to v1.4.0 has no per-release history (`version-history.js` reconstructs it for the UI). The original v1.0.4 zip sits at
`~/Downloads/vietnamese-subtitle-translator-v1.0.4.zip` if you ever need the true starting point.
The old README changelog for that period was removed on 2026-09-27; read it with
`git show d0c46d5:README.md`.
