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

**16. Mild pause placements the model still keeps** (each a pause the corpus marks as wrong, none
inside a unit): "tăng | từ 72,5%" (a verb before its from-to complement; the voice itself stopped
0.58 s there), "tăng mạnh | nhờ vào" (maybe a missing mark), "chỉ tốt | bằng dữ liệu" (comparative
"bằng" read as the preposition), "Điều này | có nghĩa là" (text-only choice, never a comma: 2
syllables), "tập thể dục | vào buổi sáng" (inside a long subject), relative "mà" after a noun, "thì"
as a topic marker. Fix one only as a cost correction in `adjustJoins` with a linguistic reason,
then `tools/prosody-eval.js` on all four sets, and new unseen sentences (all four are seen now).

**17. Versions in model names are read as decimals**: "gemini-2.5-flash-lite" is said "gemini hai
phẩy năm flash lite". That is `adaptForSpeech` (speech text), not the pause model.

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
