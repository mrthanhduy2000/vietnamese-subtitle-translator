# Dubbing (lồng tiếng)

Line numbers drift. Grep the function name.

**Rule that overrides everything here: never condense, shorten or summarize a line.** If Vietnamese
speech does not fit its slot, the allowed levers are speech rate, trimming pauses inside the
sentence, chaining sentences together, and accepting a small lag. There is no condense code: the
machinery that one `condense: null` in `dubbing.js` used to keep off (`needsCondense`,
`condenseBeforeTts`, the `condenseSpeech` action, `condensedIsSafe`) was removed in 1.7.3, and
`tests/backlog.test.js` fails if any of it comes back.

## How this file is laid out

Sections are by topic, in three parts that follow the data. Inside a section, the bold version labels
("**1.9.9 ...**") say when a piece arrived and hold the measurements behind it; grep a label to find
it. Where two labels disagree the later one wins, and a paragraph marked "history" or "replaced" is
kept only for its measurements. A new change goes under the section it belongs to, not at the end.

1. **What is said**: data contract, speech text, English inside Vietnamese speech, the prosody model
   and its later rules (constituents, respellings, predicate verbs).
2. **When it is said**: the `SYNC` block, then delivery (pipeline, entering a line, robustness, the
   video shared with ads and a reloaded script, a slow server).
3. **Who says it and where it is kept**: the three TTS providers, the cache, testing without a video.

## Six files, one direction of data

```
dub-planner.js   pure    text -> speech script -> prosody and timing. No I/O, fully testable
dub-prosody.js   pure    where speech may pause and how long (1.7.6), see "Prosody model" below
dub-speech.js    pure    English spans in Vietnamese speech and how VieNeu is made to say them (1.7.8)
dub-audio.js     pure    WAV/PCM: decode, normalize, find silence, split, shape pauses
dub-engine.js    impure  providers + scheduler + video clock + ducking. The complicated one
dubbing.js       thin    settings, provider pick, badge, "hold the video while preparing"
```

`dubbing.js` is what `youtube.js` and `content.js` call (`CST_DUB.start` / `.stop`). It is small on
purpose: put logic in the planner or the engine, not here.

## Data contract

**group** (from the translation layer, filtered in `dub-engine.js` `refresh`)
`{ start, end, viText, viCues[], srcCues[], midLine? }`; `midLine` (YouTube, 2.3.2): the group starts
inside the caption line the group before ended in, and the free voice reads on across that cut

**segment** (`dub-planner.js` `buildDubScript`) - note these are *continuous speech spans*, not one
per cue: `{ id, index, start, end, slotEnd, speaker, cueCount, subtitleText, speechSource, srcText,
sourcePauses[], continuesNext }`

`id` is `t<ms>` and deliberately stable: out-of-order translation must not invalidate audio that
has already been paid for.

**plan** (`dub-planner.js` `planSegment`) adds `{ sps, calibration, text, intent, phrases[], rate,
pauseScale, pitch, emphasisWords, naturalDuration, targetDuration, estDuration, durationRatio,
overflow, strategies[], style }`, where a phrase is `{ text, syl, pauseAfter, rateMul, emphasis,
breakKind, offset, dur, pause }`.

**provider.render(plans, ctx)** -> `[{ planId, wav: Uint8Array, duration, sampleRate }]`

**rendered** (engine RAM) `{ url, duration, stretch, fit, overflow, text, el }`
**speech** (playing now) `{ id, mediaStart, offset, rate, end }`

## Speech text (`adaptForSpeech`, 1.5.8)

What the voice is sent, for every provider. Check a change against what VieNeu actually says: its
normalizer is `sea_g2p` and runs offline with
`~/VieNeu-TTS/.venv/bin/python` + `from vieneu_utils.phonemize_text import PuncNormalizer`.
Measured facts behind the rules: the server reads a digit run of 7+ digits one digit at a time
(`1500000` -> "một năm không..."), so grouped and long numbers are sent as words; `$20` is "u s d",
`7B`/`200K` are letters, English `1,000` becomes "một", `1990s` ends in "giây". Versions and section
numbers are read with "chấm", a decimal with "phẩy". Test: `tests/dub.test.js` "speech text".
1.7.8: a hyphenated identifier with a digit in it is split into words and its dots read "chấm"
("GPT-5.6" -> "GPT 5 chấm 6", "Llama-3.3-70B", "COVID-19"; the server said "gạch ngang" / "dash" and
"phẩy"); a version after any non-Vietnamese word with a capital counts ("iOS 18.2"). Ranges
("2020-2021", "10-15") and word pairs ("Wi-Fi", "machine-learning") are untouched. Every provider
gets this. Test: `tests/speech.test.js` "a version is read with chấm".
2.4.2: a speaker label of edited captions ("ANDREW HUBERMAN: ...") stays in the subtitle and is not
read. `buildDubScript` takes the labels in capitals that the group's own source carries
(`speakerLabels`) out of every subtitle line it reads (`stripSpeakerLabels`, at a line start or after
a sentence end or a "--", also when a line ends on the label). The 3-hour podcast UIy-WQCZd4M read
262 of them; on the simulator its dropped lines went 54 -> 4. Test: `tests/dub.test.js` "script: a
speaker label". `playback-sim.js` counts lost words against the same stripped text.
2.5.1 (`dub-engine.js` `scriptBase`, so VieNeu only; the subtitles and `geminiScript` keep the text):
a speaker cut off mid-thought is written "vì-- Vâng". Such a "--" is now read as the comma it is
("vì, Vâng"), unless a digit stands on both sides (a range, "5--10"); then, in that line only, ",,",
a comma before other punctuation, a leading comma and a comma left before the closing full stop go
("đón nhận-- Vâng," -> "đón nhận, Vâng."; "vì--." -> "vì."). 53 of 7,795 lines on the 45 saved
videos change (their takes are made again once, free); 13 lines end in ",." without a dash and are
left alone. A changed line can also move `breathText`'s breathing commas (the new comma shortens the
stretch it measures). Simulator: late 1653 -> 1648 (the fake server's take length is seeded by the
spoken text). Test: `tests/speech.test.js` "an interruption".

**Symbols between words (2.8.3).** A corpus pass (every saved line through `adaptForSpeech`, its
non-word symbols collected, then `tools/vieneu-g2p.py`) found "/" between words said "trên" (now
"hoặc", or "một" before a unit of time or count, kept between single letters "P/E" and for "km/h"),
" > " between words said "lớn hơn" (now a comma), "@handle" "a còng" (dropped), "cửa hàng 7/11"
"bảy trên mười một" (seven eleven; a date "ngày 7/11" stays). The slash rule runs after the web
addresses and the units. `tests/prosody.test.js` holds its "/" mark as "⫽" through adaptForSpeech.
A number pass the same way (2.8.4): "30k" was "ba mươi ca", now "nghìn" (not 401k, 403b, 457b); "3dl",
"1m50", "3D", "S25", "8GB" were already right.

**Text faces (2.8.2).** VieNeu reads ":D" "đê", "^^" "mũ mũ", "<3" "nhỏ hơn ba", "=)))" "bằng":
`adaptForSpeech` drops a face (eyes `:;=` only, never after a digit, so "8:3", "3:00", "583" stay).
The K/M/B magnitude rule now needs the letter alone (`(?![\p{L}\p{N}])`, u flag): "2020 Mình" was
"2020 triệuình". 18,129 saved lines: 12 change, all faces. A first try with "8" as eyes ate "83" of
"583" and "):" closed brackets: always diff the whole corpus before and after a speech rule.

**A bracketed sentence is speech (2.8.1, `notesOnly`).** A source line all in brackets used to be a
note line, its translation stripped; subtitled Japanese and Korean vlogs bracket a cat's or a thought's
words ("(Cat: Are you listening?)"). A parenthesis is a note only when `isSoundNote` or under 3 words.
Multilingual batch: 5 of 89 note-only lines became speech, all speech; words lost on JKW9_bw0oTY 35 -> 6.

**Numbers and units (2.8.0).** The VieNeu normalizer already says most units glued to a number
("400g" gam, "500ml" mi li lít, "225°C" độ xê, "45W" oát, "120Hz" héc, "12GB" gigabyte, "4K"
bốn ca): check with `tools/vieneu-g2p.py` `{"normalize": [...]}` before adding a rule. It misreads
"4 mph", "15$" ("u s d") and fractions ("một trên bốn"): `adaptForSpeech` says "dặm một giờ",
"đô la", "nửa" / "một phần tư" (not after ngày/tháng, not 24/7). Two slips of ours: a kept term led
by a digit ("5G") matched inside "65g" (now `(?<!\p{N})`), and "video 4K" became "4 nghìn" (a
resolution only in a line with a screen word, `SCREEN`). 23,274 saved lines: 10 changed, all right.

## English inside Vietnamese speech (1.7.8, `dub-speech.js`)

VieNeu's front end (`sea_g2p` 0.9.1, Rust, inside `~/VieNeu-TTS`) already reads English: a word that
is not a Vietnamese syllable goes to its English dictionary and G2P, its acronym table turns "API"
into `<en>a p i</en>`, and its Vietnamese table expands "CLB" to "câu lạc bộ". `tools/pron-eval.js`
reads back its phonemes for `tests/speech-corpus.js` and found four faults, which are all this
module fixes:

| Fault (1.7.7) | Example | Sent now |
|---|---|---|
| unknown all-caps code spelled with Vietnamese letter names | CPC "xê phê xê", IKEA "i ca e a" | `<en>c p c</en>`, `<en>ikea</en>` |
| camelCase piece that is a Vietnamese syllable | DiCaprio "zi caprio" | `<en>dicaprio</en>` |
| name word that is a Vietnamese syllable, even inside `<en>` | Tom t̪ˈɔm, San sˈaːn | `<en>tahm</en>`, `<en>sanne</en>` |
| model number read as an amount | RTX 5090 "năm nghìn không trăm..." | `RTX 5 0 9 0` |

- Not every "spelled" code is English (2.2.4): `VI_CAPS` holds Vietnamese abbreviations and tickers
  the table misses (DN, NHNN, TMCP, SGK, HPG, ThS...), and an unknown code the English source line
  (`plan.srcText`) does not contain is the translator's, so it stays Vietnamese. `INITIALISMS` and
  `EN_SPELLED` (PDF, URL, QA...) keep English letters whatever the source says.
- `<en>...</en>` is the front end's own marker; text inside skips its acronym and camelCase rules. It
  cannot change the language of a Vietnamese-syllable word (hence the respellings), and **past 10
  tags in one normalizer call it breaks** (placeholder "ENTOKEN1" vs "ENTOKEN10": the 11th tag reads
  "... 0"). `TAG_MAX` = 8 per text, lowest priority dropped first.
- **Data, generated offline** by `tools/build-speech-tables.js` from the front end itself (the block
  between the `@generated speech-tables` markers; never hand-edit it): how the server reads every
  2-4 letter all-caps code (179 English already, 67 Vietnamese expansions, 1,524 read as a word, the
  rest spelled Vietnamese) and 44 respellings (target = the English engine's reading of the
  possessive "tom's"; each kept only if the server reads it exactly so, alone, in a Vietnamese
  carrier sentence). "sam" is held out while the unseen split names Sam Altman.
- **Evidence before a respelling**: a Vietnamese-syllable word is respelled only inside a lexicon
  entry ("Tom Hanks"), or capitalised mid-sentence next to a capitalised English word ("của Tom
  Cruise"), or when the English source line (`plan.srcText`) has the same pair. "Con AI", "So
  Google", "Chị Lan" and a lone "Tom" stay Vietnamese. Letter + digit codes ("M3") only inside a
  product name ("MacBook Pro M3"); "giấy A4", "U23" stay Vietnamese. A shouted line stays as is.
- **Spans for prosody**: `spanGaps(text)` marks every gap inside an English span (lexicon units,
  runs of English words, capitalised names, a model's numbers "GPT 5 chấm 6"). `dub-prosody.js` gives
  those gaps cost >= 80 and `unit`, so neither a breathing comma nor a kept voice stop lands there.
- **Two texts per VieNeu line**: `plainScript(plan)` is the text the pauses are placed on (sent as
  `text`); `speakScript(plan)` = `render(plainScript, { source: plan.srcText })` is what the voice
  says (sent as `speak`, used by `background.js` as `input`) and keys the audio cache. A line the
  renderer leaves alone comes back as the same string. 1.7.8 also moved `LOCAL_STYLE_VERSION` to 10
  (the pause shaping changed and cached audio is shaped), so every cached VieNeu line re-renders once,
  free and local.
  Gemini and Web Speech get neither: they read English natively.
- Lexicon entries (`ENTRIES`) carry a `say` only where the server's reading was checked wrong;
  `addEntry(surface, category, say)` or `globalThis.CST_SPEECH_LEXICON` adds local ones (no UI).
- **Measured, 1.7.7 -> 1.7.8** (phonemes: `tools/pron-eval.js --old=HEAD`; real takes: `tools/speech-ab.js`,
  Mỹ Duyên x2 + Thái Sơn x1 per text, texts that did not change share their takes):

  | Split | Entities read right | Kept pauses the marks forbid | at a language edge | inside a span | Duration |
  |---|---|---|---|---|---|
  | dev (62, tuned on) | 68 -> 79 of 79 | 14 -> 7 | 7 -> 4 | 0 -> 0 | -0.8% |
  | validation (24) | 18 -> 23 of 24 | 6 -> 1 | 3 -> 0 | 0 -> 0 | +0.4% |
  | unseen (24, scored once) | 23 -> 28 of 29 | 1 -> 0 | 1 -> 0 | 0 -> 0 | +0.4% |

  Clipping, clicks (jumps > 0.3 in quiet audio) and runaway takes: 0 in both versions. Level jumps
  > 15 dB between speech frames: +14% on the 19 changed texts, inside the take-to-take spread of the
  same text (median 10%, p90 25%). Longest run without a kept pause, dev max 17 -> 20 syllables.
  The misses left: validation "RAM" (label debate, `BACKLOG.md` 23), unseen "Sam Altman" (held out).
  The unseen texts were written by the same session that wrote the rules, and it had read them: the
  version rule was widened to lower-case-first names ("iOS") knowing unseen had "iOS 18.2", and the
  "hay" in the comparative list matches unseen u18. Read unseen as a guard against overfitting, not an
  independent benchmark.
  What it does not measure: how a respelling *sounds* (only its phonemes), and anything the server's
  own G2P reads wrong in a word it already treats as English.

- **The glossary bridge (2.6.0).** When the glossary is loaded (content scripts, options page),
  `loadExtra()` also runs `loadGlossaryNames()`: every term the glossary keeps in English (no `vi`,
  passes `glossaryName`: at most 6 words, no diacritics, not all Vietnamese syllables, not two
  capitalised Vietnamese syllables in a row, not in `VI_CAPS`) becomes a lexicon unit of cat
  `glossary`, so its words are English for span analysis. Its reading comes from `GLOSSARY_SAY`, a
  generated table (`// @generated glossary-say` block) written by `node tools/glossary-pron.js
  --write`: for each kept name the server's G2P still reads as Vietnamese through a carrier
  sentence, it tries the whole name lowercase in `<en>`, piecewise (`&` -> and, capitals as
  letters), letters in `<en>` with digits outside, and respellings, and keeps the first that reads
  English. Without `--write` the tool only reports (`--show=N`, `--json`). 2.6.0 numbers: 11,684
  kept names; read as Vietnamese 496 without the bridge, 98 with it (most of the rest are numerals,
  read in Vietnamese on purpose, and a few Chinese or Korean names). Caps tokens inside a glossary
  unit that `capsClass` calls Vietnamese become `spelled` unless they are in `VI_CAPS` (CUDA said as
  a word, SSI and VTV stay Vietnamese letters). Initials inside an English name ("Samuel L.
  Jackson", "e.l.f.") are English letters and their dot is dropped. `adaptForSpeech` says `&`
  between Latin words as "and" unless both sides are Vietnamese syllables ("Nam & Lan" -> và).
  Rerun `--write` after adding names to `glossary-data.js`; `tests/glossary-speech.test.js` fails
  on a respelling whose name left the glossary.

- **English the translation kept, on real subtitles (2.6.1).** `tools/subtitle-pron.js` sends every
  Vietnamese line of `review-archive/` (plus `--dir=` of `ytcache4_*.json`) through the engine's
  text path with the English source cues of the same time, and judges each English span (Latin
  words that are no Vietnamese syllable, or that the source writes the same way) by the front end's
  phonemes against the line with "cái" in its place; `--old=<rev>` compares. 2,041 spans on 50
  videos: read Vietnamese 64 (3.1%) at 2.6.0 -> 21 (1.0%). Of the 21 left, 11 are "nhóm A" /
  "A hoặc B" (Vietnamese letters on purpose), "750 W", "4 nhân 4", three nonsense words in a
  transcript, and two artefacts of the diff. Rules added for it, all in `dub-speech.js` unless noted:
  a capital letter or a letter+digit code right after an English word ("vitamin D3", "urolithin
  A", "Plan B", "model G1"); a vitamin list ("vitamin C, D3, E và K", and a lone D3 on a vitamin
  line); hyphen spellings "R-E-V-E-R-I-E" and a letter prefix "L-taurine" (shape `spell`); web
  addresses "DonorsChoose.org" (shape `domain`) and the translator's own "x chấm com gạch chéo y"
  -> "dot com slash"; a code VieNeu expands to Vietnamese words that the English source writes the
  same way ("KS Fit", not "KS" kỹ sư on its own); plural codes "DPOs" -> "d p o's", "eGFR" letters;
  dotted initials the source has ("C.S."); dashes glued to a word ("O-U-S--") moved to the trail;
  a lone capitalised Vietnamese-syllable word the source pairs with an English neighbour or a
  number ("Ram 2500"), or names mid-sentence while the line names someone else in English ("Dan và
  John"); `dub-planner.js`: "+" inside English names "and" / glued "plus" ("Disney+", "C++"),
  "C#" "sharp", one letter in brackets after a code or name kept for the speech side ("401(k)",
  "Lp(a)", "Ear (a)"). Neighbouring `<en>` tags now merge into one ("<en>lleo dicaprio</en>"), so
  `TAG_MAX` counts groups. RESPELL grew 58 -> 106 (`tools/build-speech-tables.js` NAMES list).
  Cost: regress `late` 1712 -> 1718 over 45 videos (English letter names and "dot com slash" are a
  little longer than "đê", "chấm com").

## Prosody model (1.7.6, `dub-prosody.js`)

Where the dubbed speech may pause, how strongly, and which of the voice's own stops to keep. Pure,
deterministic, memoised per text (600 entries). It reads the text through `vi-segmenter.js`
(`SEG.analyze`, the subtitle line breaker's own scoring, so subtitles and speech agree on what is a
phrase) and the planner's `countSyllables`. Loaded after `dub-planner.js`, before `dub-audio.js`.

**What it can and cannot do.** VieNeu decides where it stops. The extension can shorten a silence,
never create or lengthen one, so placing pauses is a *selection* over the voice's stops. The one way
to create a stop is the text sent: a comma (`breathText`). Paid voices are never touched: their text
and their segment cuts are billed audio.

**1. `analyze(text)`**: per word its syllables; per gap between two words:
- 2.6.2: a dotted initial ("C.S.") is English letters when the source writes the letters before the name, even split across two cues (`srcHas` in `renderUncached`). The measure (`tools/subtitle-pron.js`) uses ±4 s of source for evidence. Known measure false positive: replacing "John" with "cái" changes Dan's reading, so "và" shows up in the diff.
- `cost` = the segmenter's gap cost; `value` = clamp((5 - cost) / 20, -4, 2). A gap with value < 0
  (`K.minValue`) is inside a phrase and never a pause, however long the run.
- `unit`: inside a number, a number and its unit, a name, an acronym or English run, a term. Never a
  pause (the old 4.5 s breath split "gấp | mười", "đô | la", "chuẩn | bị").
- Corrections on top of the segmenter, each with a linguistic reason and a corpus check (do **not**
  grow these into keyword lists that trigger pauses; they only move a gap's cost):
  a several-word adjunct opener after a content word ("thô | thông qua"); connectives the segmenter
  lacks (`CONNECTIVES`: "chứ không", "hơn là", "làm thế nào để", "kể cả khi"); "và / hoặc / hay"
  inside a list or joining short phrases is no boundary; "rằng" never more than a joint (either
  side); modal "nên" after a subject or "quyết định" is "should", not "so"; the main clause after a
  fronted clause written without its comma ("bị thiếu | chúng ta", once per sentence); a subject of
  5+ syllables before a preverbal word ("tại Toronto | đã"); "trước đó / trước đây" after a word.
- At punctuation, a `role` and a target `pause` (continuous, from the 1.6.8 / 1.7.2 measurements):
  comma min(0.28, 0.14 + 0.012 x words) with -0.04 before và/hoặc/hay/rồi/mà/cùng, +0.02 before a
  strong opener (nhưng, vì vậy...), +0.03 closing a fronted clause ("Nếu ..., "), -0.03 before 2 words
  or fewer; lead-in (3 syllables or fewer) 0.12 + 0.01 x syllables; list items 0.15, the one before
  the closing "và" 0.17; ; and : min(0.32, 0.2 + 0.012 x words); sentence 0.28 + 0.01 x words (max
  12), ? +0.05, ! +0.03, +0.03 before a transition. `level`: sentence long, clause/comma medium,
  lead/list short, other gaps short / micro / none by value.

**2. `selectBoundaries` / `choose`** (called by `dub-audio.js` `shapePauses`): punctuation the voice
honoured is fixed. Between fixed points a dynamic program keeps the subset of the voice's stops that
maximises the sum of (value + 0.5 x voice evidence - `pauseCost` 0.9), minus 2 x (0.8 - run)^2 for a
run under 0.8 voiced seconds (choppy) and 0.45 x (run - 2.6)^2 over 2.6 s (no breath). Voice evidence
is 0 at a 0.12 s stop and 1 from 0.4 s. A stop under 0.12 s is never kept. Tight mode (`maxPause` <
0.2, a dense sentence) raises the cost 1.8 times and allows 1 s longer runs: speculative pauses go
first. A kept phrase pause is min(0.22, 0.1 + up to 0.05 by value + 0.025 per voiced second before
it); the rest become 0.09 s joints; everything is capped by `maxPause`.

**Alignment** (`dub-audio.js` `alignStops`): a stop's place in the text is its share of voiced time
= share of syllables. Measured on 220 punctuation stops: mean error 0.33 syllables, 216 within 1.
Phrase-final lengthening and energy-nucleus models were tried and were worse. Punctuation is matched
first (1.7.5 scoring), then each other stop is placed between its matched neighbours, within 1.5
syllables; a long stop is pulled away from units and bound pairs, never towards a chosen word.

**3. `breathText(text)`** (engine `plainScript`, VieNeu only, part of the audio key through
`LOCAL_STYLE_VERSION`, 9 in 1.7.6; today's key is under "Cache identity" below): in an unpunctuated stretch of 20+ syllables, a comma at the text-only
choice (`breathGroups`, 4.6 syllables per second) where value >= 0.35 and 7+ syllables are on each
side, in a stretch of 18+ (2.1.5; 0.6 / 20 before). Only commas are added. 29 of 184 corpus sentences
change, every comma at a marked boundary ("|" or "/"). 2.1.5 was judged on real takes, not text: the
20 sentences the new thresholds change, 5 local takes each way (Mỹ Duyên x3, Thái Sơn x2, scored as
`tools/prosody-eval.js` does, 6 of the 20 from held-out sets): "|" read in one run 18/60 -> 0/60,
kept stops where the marks say none 2 -> 0, longest run p90 22 -> 17 syllables (max 38 -> 26), kept
pause mean 0.18 -> 0.24 s, total length +0.7%. The "/" commas ("Performance Max này, đã tăng",
"PyTorch, để xây dựng") sit where the voice already stopped on 4-5 of 5 takes without them; the comma
makes it every take and 0.05 s longer. A changed text is a new audio key, so those lines re-render.
2.1.6: `minSide` 7 -> 6, and a stretch of `longRun` 26+ syllables may take a boundary of value >=
`longValue` 0.1 (it had none of 0.35: corpus v2, 36 syllables, was read in runs of up to 30). 36 of
184 corpus sentences now change, still every comma at a mark. Real takes of the 7 it adds (3 held
out, 35 each way): every added comma stopped the voice, longest run p90 26 -> 15 (max 30 -> 17),
RAN-ON 0/15 both, WRONG 0 -> 1 (the voice's own stop before "trong quý vừa qua", not at a comma),
+1.4% length. Left in one run on purpose: the 13 "|" inside 13-17 syllable sentences (a one-breath
length; a comma there would chop them). The slow delivery matrix is identical (its script has no
such stretch). 2.1.7 reversed that last choice on real takes: the rebuilt prosody cache (920 takes)
showed syntax4-6 reading "subject | verb of effect" in one run on 45 of 85 takes. `breathGroups`
keeps a pause budget and left those 15-17 syllable runs whole, so `breathText` now also gives a run
of `fallbackRun` 15+ with no comma its best boundary of value >= 0.35 (sides >= 6), and `minRun` is
16. 56 of 184 sentences change, every comma at a mark. The 20 it adds, 100 takes each way: RAN-ON
30/55 -> 0/55, WRONG 0 -> 0, longest run p90 17 -> 10. All 184 as sent (920 takes, `$TMPDIR/br/prod.js`
style scoring): RAN-ON 39/365 -> 9/365, WRONG 1 -> 1, +0.2% length. Left: 4 in corpus (l2 "trễ |
đều", a 14-syllable run) and syntax2 L1 "thẻ | và" (a 2-syllable side). The comma is only in the
text sent to VieNeu: a subject-verb comma is not written Vietnamese, but the subtitle never shows it.
2.1.8: a breathing comma is shaped as a breath. The engine sends `breath` (`breathAt(plan)` =
`breathAdded(scriptBase(plan))`, word indices) with each VieNeu request; `background.js`
`splitTtsAudio` passes it to `shapePauses` (`opts.breath`), and `choose` keeps such a stop at
`max(K.breathKeep 0.14, phrasePause)` (kind `breath`) instead of the comma's `g.pause`. Telling them
apart from the text alone was tried and not kept: removing a comma and re-running `breathText` finds
57 of 57 but also 4 of the translation's 60 own commas ("dữ liệu cũ, nhưng"). 920 real takes as sent:
same stops kept (RAN-ON 9/365, WRONG 1), mean kept pause 0.23 -> 0.21 s, total 3854.5 -> 3841.8 s.
`LOCAL_STYLE_VERSION` is not bumped: lines already cached keep their longer breath until re-rendered.
2.1.9: `fallbackRun` 15 -> 14 (corpus l2, a list subject then "đều ảnh hưởng", ran on 3 of 5 takes).
3 sentences change (15 takes each way): RAN-ON 3/10 -> 0/10, WRONG 0. All 184 as sent: RAN-ON 6/365.
The rest: "ảnh thẻ | và" (a 2-syllable side, left) and 1 of 5 takes running past the comma in "Anh
Đàm, phần này" (the voice's own). 13 was not taken: it cuts "không chỉ rẻ hơn, mà còn" (13 syllables).

**4. `boundaryValue(left, right)`**: the value of a cut between two segments. Engine `gapAfter`: a
part that continues the sentence without , ; : rests `SYNC.joinGapClause` when the cut's value is >=
`SYNC.joinGapValue` 0.3, else `joinGap`. Planner `prosodicCut` (free voice only, `joinGroups`): when
a segment must be cut and there is no punctuation to cut at, the cut goes to the best line boundary
(any half of the segment) that beats the default by 0.3.

**2.0.6 head cuts.** Around the point where playback starts or lands after a seek (`headAt`), a
subtitle line of more than 4.3 s is cut into ~3.5 s pieces so the first request is short
(`buildDubScript`, `HEAD_HARD`). The cut used to be the word nearest the syllable midpoint (a comma
earned 3 syllables): over the 138 long lines of the prosody corpus and the fixtures, 106 of 157 cuts
fell inside a phrase and many inside a word ("mạng | nơ-ron", "điện | tử", "tham | số", "50 xuống |
30 đô la"), so after every seek the voice read two broken utterances. Now `lineGapValues` reads the
prosody value of every gap of the line and a cut costs its distance from the middle minus
`HEAD_CUT.perValue` 3 per unit of value (up to 1), plus `inside` 20 for a gap inside a phrase; no
piece may pass `maxPiece` 1.5 x `HEAD_HARD` (the first request stays short). A hint mark "¦" counts
no syllable. Against the corpus marks: cuts at "|" 30 -> 51, at "/" 25 -> 74, where none is marked
89 -> 18; inside a phrase 106 -> 30 (what is left: lines with no better place, "xem xét | mạng" at
-0.25). First piece 8.5 -> 8.8 syllables on average, p90 11 -> 12, max 15 -> 16.
Delivery (`playback-sim`, separate processes: the planner is a global, so an old engine loaded in
the same process runs the new planner): scenarios and the healthy rapid-seek matrix identical; the
144-run slow matrix paired run by run: lines 2109 -> 2096 (22 runs more, 24 fewer), late 521 -> 504,
gaps 745 -> 735 s, voice back after a seek 5.90 -> 5.99 s (34 runs later, 39 sooner), first voice
sooner in 60 runs and later in 10. The big swings are all at RTF 1.0-1.1 on a 2x video.

**Measured** (tools/prosody-eval.js; same takes for both engines, both placed with the new alignment;
WRONG = a kept pause where the marks say none, severe = inside a unit or a bound pair; the marks are
one reader's judgment, nobody has listened to a blind A/B yet):

| Set (sentences x takes) | 1.7.5 kept / WRONG (severe) | 1.7.6 kept / WRONG (severe) | Longest run p90 (syllables) | Duration |
|---|---|---|---|---|
| corpus, tuned on (56 x 5) | 290 / 10 (4) | 341 / 7 (0) | 21 -> 16 | +0.4% |
| holdout1, seen then fixed (16 x 5) | 85 / 8 (4) | 89 / 4 (0) | 19 -> 21 | -0.1% |
| holdout2, seen then fixed (16 x 5) | 52 / 3 (3) | 54 / 1 (0) | 19 -> 19 | 0 |
| holdout3, other topics, scored once (16 x 5) | 73 / 4 (0) | 77 / 6 (0) | 19 -> 19 | +0.2% |
| corpus, tight mode | 270 / 10 (4), 11 good stops closed | 279 / 4 (0), 1 closed | 21 -> 18 | 0 |

Holdout3 is the honest number for unseen text: no gain in WRONG there (4 of the 6 are "tăng mạnh |
nhờ vào", which 1.7.5 also keeps and which may be a missing mark). What 1.7.6 fixed is the severe
kind (pauses inside units: 11 -> 0 over all sets) and the stops before "mà", "nên", "sau mỗi" that
1.7.5 closed. Breathing commas (7 sentences x 5 takes, new engine both sides): the voice stopped at
35/35 inserted commas; longest run mean 16.9 -> 14.2 syllables, worst 28 -> 18; +0.35% duration.
Segment cuts (synthetic lecture, 57 segments): mid-sentence cuts 7 -> 5, all now at commas.

**1.7.8 additions** (`adjustJoins`, each a cost correction with a linguistic reason; the old sets
are all seen, so these numbers are not an unseen score):
- English spans are units (`dub-speech.js` `spanGaps`): cost >= 80 inside "Google Ads API",
  "Christopher Nolan", "GPT 5 chấm 6". A language switch is not a boundary by itself.
- "từ" after a verb of change and before a number is its from-to complement ("tăng | từ 72,5%");
  "từ tiếp theo" is the noun "word"; "ADJ bằng" is the comparative ("chỉ tốt | bằng"); "so với" within
  two words of "hơn" is the standard of a comparison; relative "mà" after a light head (cách, điều,
  nhất...) or before a pronoun subject with a clause of <= 6 syllables; topic "thì" after a topic of
  <= 6 syllables that is not a fronted condition; "là" after a subject of <= 4 syllables.
- A temporal phrase ("vừa qua", "gần đây", ...) is one unit, binds to the noun before it, and closes
  a long subject ("... trong quý vừa qua | tăng"); a predicate of <= 3 syllables after a subject
  boundary keeps its adjunct ("tăng mạnh nhờ vào", not "tăng mạnh | nhờ").
- The long-subject count stopped at "thể" in "tập thể dục" (taken for "có thể"); now only "có thể".
- WRONG on the four old sets: 7/4/1/6 -> 0/2/0/1, severe 0, MISSED and RAN-ON unchanged, duration
  within 0.1 s. Left: "độ chính xác | trên tập kiểm tra" (H3, the voice's 0.13 s stop) and "công ty |
  trong quý" (F1): a prepositional phrase inside a long subject, not fixed without a parser.

**To change it:** run `node tools/prosody-eval.js` before and after (all four sets), and listen to
the takes that changed. A rule that only moves WRONG on the corpus is overfitting; check holdout3
and write new unseen sentences for the next check. For English spans, also `node tools/speech-ab.js`
(real takes of `tests/speech-corpus.js`, old vs new, sandbox off).

## Context, constituents and cache identity (1.8.0)

**Pronunciation: three states** (`dub-speech.js` `CONF`). A word VieNeu reads Vietnamese (an "ambig"
shape: Tom, San, Dan...) gets a score; only `HIGH_EN` (>= 3) is rewritten, `AMBIGUOUS` and `HIGH_VI`
(<= -3) are left alone. Clues: lexicon unit or the source line's same pair (decisive, +10); a
capitalised English neighbour mid-sentence, a name word (`NAME_WORDS`) opening a sentence before an
English non-brand surname ("Sam Altman ...", not "So Google", "Con Labrador"), a lone given name the
English source line names (`EN_GIVEN`: not Lan, An, Dan, Van, Tan, Kim) (strong, +5); a Vietnamese
name word beside it ("Nguyễn Văn Dan", decisive -10); a title before it ("chị Kim", weak -2); a line
in capitals (decisive). A lone "Tom" with no source line stays as is. Every token also carries
`lang`, `entity`, `conf`, `score`.
**Codes of 5+ letters**: English letters only for a code with **no vowel** and English evidence (the
source line has it; or an English neighbour plus F/J/W/Z). VieNeu spells all of them Vietnamese
("SMTPS", "THPTQG"); a code with a vowel and no word shape ("IELTS") is left to the voice.
**Word-shaped caps (2.5.8)**: inside a Vietnamese sentence VieNeu spells *every* all-caps code of 5+
letters it has no dictionary word for ("WHOOP" -> "vê kép hát ô ô phê", "GARMIN", "SAMSUNG"; measured
2026-10-17; `normalize` on the bare word lowercases it and hides this, test codes in a carrier
sentence). `capsClass` now says "spelled" past 4 letters, the caps shape reaches 12 letters, and a
4+ letter code that `wordShaped` accepts (vowel runs <= 2, consonant runs an English onset / coda /
joint: `ONSETS`, `CODAS`) is sent `<en>whoop</en>`; so are 4-letter ones the table spells ("NIKE",
"LEGO" were English letters). A source line writing it "Whoop" counts too (`inSourceAnyCase`). Not
for INITIALISMS ("UCLA", "USDA", "HTTPS"), Vietnamese syllables, or a code the English source lacks.
Lexicon respellings checked on the phonemizer: Qwen "chuen", Groq "grock", xAI, NotebookLM, DALL-E
"dolly", Oura "ora", Huawei "wahway", Xiaomi "shaomee", GoPro, CRISPR "crisper", NGINX "engine x".
`pron-eval` dev 123 -> 128 of 131 (d104-d109 added), validation unchanged. Its judge flags letter
"M" (ɛm) as Vietnamese, so "NotebookLM" is pinned by a unit test, not the corpus.
**Version or quantity**: `dub-planner.js` `numberRole(before, after)`, used by `adaptForSpeech` and
the model-number rule: a measure unit after the number wins ("CPU 3.5 GHz" -> "3 phẩy 5", "RAM 4096
MB"), then a section word or product name before it ("Python 3.12 năm ngoái" -> "chấm").

**Constituents** (`dub-prosody.js` `constituents`, run after `adjustJoins`): clauses start at
punctuation and openers of weight >= 20 (+ "rằng"), each with a role (purpose, cause, condition,
contrast, time, result, complement, relative, main). A subject is a personal pronoun, or the words
before the first predicate marker (preverbal word, "là", "được"/"bị", a verb of change; not inside a
compound, not "vừa qua"; the scan stops at a degree adverb and never starts at a preposition). Then
only prohibitions: **A** no pause inside a subject (<= 22 syllables) before a preposition; **B** a
short predicate keeps its first adjunct (<= 3 syllables before an adjunct opener, <= 5 before a
plain preposition). A purpose clause is a clause: "Tôi dùng ChatGPT / để phân tích" stays a legal
boundary. Every gap gets a `tier`: punct, hard (unit or value < 0), soft, open.
**Token map**: `PROSODY.tokenMap(text, ctx)` joins both analyses per token (id, surface, language,
spanId, entityType, pronunciationMode, pronunciationConfidence, boundaryBefore/After). Both modules
read one `SEG.tokenize`, memoised; analysis is ~0.2 to 0.6 ms a line uncached.
**Across subtitle lines** (free voice only, `buildDubScript`): a silence under `BRIDGE_MAX` 1.2 s at a
line boundary the model forbids ("Christopher / Nolan", "3,5 / GHz", a subject's PP) no longer cuts
the segment; `prosodicCut` takes any legal line boundary over an illegal "here". Paid voices keep
their per-group cuts (a moved cut re-bills stored audio).
**Across a caption line cut at a sentence end** (2.3.2, free voice only): YouTube groups now close
at a sentence end inside a caption line (`SUBTITLE.md` step 3), and the group after the cut is
`midLine`. A finished sentence closes the open segment at a group edge, except into a `midLine`
group over a pause under `PAUSE_SPLIT`: there the voice reads on as it did when the line was one
group. Simulated on the user's 6 punctuated videos (cache repaired as on load, Mỹ Duyên 3.8 syl/s;
all groups at once / arriving window by window, 4 s a window, 40 s ahead):

| grouping, rule | late starts | syllables lost to drops | takes never played (by window) |
|---|---|---|---|
| before the cut | 88 / 93 | 29 / 49 | 52 |
| cut, closed at every sentence end | 124 / 128 | 17 / 37 | 17 |
| cut, carried into `midLine` (shipped) | 87 / 88 | 29 / 49 | 41 |
| cut, every finished sentence carried within a window | 71 / 87 | 52 / 72 | 15 |

Carrying every finished sentence starts fewer lines late, but the lines it drops are longer: more
words lost, declined for rule 1's sake. A take never played costs the free server time, nothing
else. `ytCanonicalWindows` ends a window before a `midLine` group only at a hard limit (2.3.6;
before, windows ran on through runs of them to 3,075 characters), so the two halves of such a
segment can arrive apart. **A segment that has played never grows** (`buildDubScript`
`opts.spoken`, the start and end of the last segment the engine spoke or passed): the engine goes
on from the first segment starting after it, so words carried into it from a later group were
never read. The later half now opens a segment of its own; pieces up to that end still join, or a
carry made before it played would come apart and be read twice. Simulated on the user's video with
every window arriving 0.5 / 2 s before the one before it ended, words never read: 2.3.5 38 / 18,
windows closed at the hard limit without the guard 125 / 105, with it 24 / 4; none read twice;
arriving early, the voice is unchanged (15 real videos and the scenarios, identical). Paid voices
still cut at every group (per sentence now). The table's split is approximate (cached groups cut at
Vietnamese sentence ends; the real cut is made on the English line and translated as such); the
scripts are not kept, `tools/playback-sim.js` exports `realGroups` and takes `batch` on groups for
window-by-window arrival (a batch arrives when its last group is in reach, as the prefetch sends).

**Cache identity.** Paid (Gemini) key: unchanged, pinned by golden hashes in
`tests/speech-context.test.js`; nothing of `dub-speech.js` or `dub-prosody.js` reaches it (it keys
`plan.text`, the `adaptForSpeech` output; only a "PRODUCT N.N unit" line changes, where it said
"chấm" for a quantity). Free (VieNeu) key: `LOCAL_STYLE_VERSION` 11 (shaping code) + voice + the
rendered text (`speakScript`: that *is* the pronunciation fingerprint, so a lexicon or policy change
re-renders exactly the lines whose text changed) + `PROSODY.signature(plainScript)` (per-gap values,
units, punctuation pauses: an analysis change re-renders only the lines it touches). 1.8.0 itself
re-renders every VieNeu line once (free, local). Translation key: no input from either module
(asserted). `PRONUNCIATION_VERSION` names the data version and is deliberately not in a key.

**Measured** (same takes old vs new; the marks are one reader's; proxies, nobody has listened):
- Phonemes (`pron-eval`, 1.7.9 -> 1.8.0): dev 97 -> 104 of 107, validation 35 -> 39 of 42, old
  unseen 28 -> 29 of 29 (dev/validation grew by 45 / 16 items written before the code). Misses left:
  Kim Kardashian (no respelling), MMORPG (vowel, left), "So" (VieNeu's own reading), RAM (label), Dan
  with source (by design), TPM (scorer artefact next to "chip").
- Real takes (`prosody-eval`, WRONG kept pauses): syntax (dev) 5 -> 0, syntaxval 1 -> 0, holdout3
  1 -> 0 ("công ty | trong quý"), corpus 1 -> 1, holdout1 3 -> 3, holdout2 0 -> 0; MISSED / RAN-ON
  unchanged. Cost: in 2 of 5 takes of S1 no stop is left (the voice did not stop before "đã"): longest
  run max 14 -> 21 syllables on that set.
- Real takes of the speech corpus (`speech-ab`, 8 of 128 texts differ; no source lines there): dev
  WRONG 5 -> 3, pauses at a language edge 2 -> 0, inside a span 0 -> 0, clicks / clipping / runaway 0,
  level jumps 490 -> 485, duration -0.3%; longest run max 20 -> 22.
- **Blind split** (`tests/blind-corpus.js`, 55 + 40 + 13 items by a separate agent, frozen at commit
  2b6b2db before the rules were written, scored once): phonemes 62 -> 65 of 70 (en 30 -> 33 of 38;
  vi 9/9, hold 6/6, vletters 3/3 in both: **no new false positive**). Fixed: "Sam Altman" opening a
  sentence, lone "Tom" / "Sam" named by the source line. Left: Kim, Ken, Ben (no respelling; "Ben" is
  not a candidate). Prosody text decisions: WRONG 2 -> 2 (one fixed, "mây | trong quý ba"; one moved
  to "phần trăm | so với" in the same 25-syllable run), MISSED 2 -> 2, BLOCKED 1 -> 1. Subtitle lines
  with a 0.7 s gap: segment cuts at an unmarked gap 10 -> 1 (the one left is a purpose clause, "đây |
  để", which 1.8.0 treats as a legal boundary and the blind marks do not). The blind split is seen now:
  its failures are next round's dev cases (`BACKLOG.md` 29).

## Constituent refinements and respellings (1.8.2)

Small local rules, each checked both ways in `tests/prosody.test.js` / `tests/speech-context.test.js`.
No new module, no new abstraction; `analyze`, `signature` and the cache keys are unchanged in shape.
- **Result "nên"** (`adjustJoins`, `isResultClause`): after a clause that already has its predicate
  (degree adverb, preverbal word, "bị" / "được", verb of change) or a fronted "vì" / "do" / "nhờ", it is
  a clause boundary like "để" (value 0.85). Without that evidence, or after a verb of thinking
  ("Tôi nghĩ công ty nên"), "nên" may be "should": soft (0.25), no longer 0.55.
- **"so với" after a quantity** ("tăng hai mươi phần trăm so với", "gấp đôi so với"): bound, as after
  "hơn". **Relative "mà"**: the clause length stops where the main predicate resumes ("chiếc máy mà
  tôi mua hôm qua | đã hỏng"), so a short one stays with its noun.
- **Long last list item**: "A, B và <8+ syllables>" may breathe before "và" (not forced); the item is
  counted to its predicate, so "Apple, Microsoft và Google | đều ..." stays bound.
- **Purpose clause** (`constituents` part C): when either side is <= 6 syllables and both fit 16, the gap
  before "để" is soft (`purposeAttached`): legal, not invited. Longer pairs keep 0.85. `BACKLOG.md` 31.
- **Respellings** (`tools/build-speech-tables.js`): ben "benn", kim "kym", leo "lleo", nan, ton; "ben"
  and "kim" join `NAME_WORDS`, "ben" joins `EN_GIVEN`. "Ken" needs none: VieNeu's kɛn is the same in
  both languages (`pron-eval` still flags it).
- **Cost**: nothing reaches the paid key or the translation key (golden tests unchanged); a VieNeu line
  re-renders only if its text or its prosody signature changed (free).

**Measured** (proxies, nobody has listened): real takes (`prosody-eval`, WRONG kept pauses) syntax2 6 -> 0,
MISSED 1 -> 0, all other sets unchanged (syntax longest run p90 14 -> 15). `speech-ab` (4 of 136 texts
differ): WRONG, clicks, clipping, runaway, pauses at a language edge or inside a span unchanged (0 where
0), level jumps 540 -> 525. Text-only first blind (now dev) WRONG 2 -> 0, BLOCKED 1 -> 0. **Blind split
2** (`tests/blind-corpus-2.js`, scored once): text-only WRONG 5 -> 4, INVITE 12 -> 7, MISSED 0, HARD 0,
CUT-WRONG 1 -> 1; phonemes 78 -> 79 of 82, vi 13/14 both (the miss is "Vinamilk", VieNeu's own reading).
Analysis cost unchanged (~0.15 ms a line uncached, analyse + breath groups + render).

## Later prosody and name rules (1.9.5, 1.9.6)

**1.9.5 prosody and names (BACKLOG 30, 21), judged on real takes.** Rules in `dub-prosody.js`:
comparative "như" after a gradable word joins it (as "bằng"); a result "nên" ends a fronted "Vì ..."
clause, so a pronoun after a time word inside it is not a main clause; rule C covers a time clause
("gặp lỗi | khi cài đặt"); a subject under `K.subjectLong` (8) syllables in a clause under
`K.subjectClauseMin` (20) is closed, not after a list. Measured with each version in its own process
(an `OLD=` dub-audio loaded next to the new one shares the new prosody module: that A/B shows no
difference whatever changed). `tools/prosody-eval.js`, 1.9.4 -> 1.9.5: syntax3 wrong stops kept
13 -> 1 (65 takes); corpus, holdouts, syntax, syntaxval, syntax2 unchanged on WRONG / MISSED / RAN-ON,
a few optional stops closed (corpus kept 328 -> 323). A closed stop is shortened to the voice's
minimum, not removed: "công ty | đã" 0.15 -> 0.09 s. Names: RESPELL gains long, pi, ray, mae and the
identity entries may, bin, son, do (tagged only); LEX gains Long Beach, Long Island, Bay Area.
`tools/pron-eval.js` dev 114 -> 120 of 123 (new items included), validation 39/42 unchanged, blind 2
79 -> 81 of 82. Proxy to watch: level jumps in the 12 changed takes 19 -> 23 (`speech-ab.js`).

**1.9.6 predicate verbs (BACKLOG 16).** `PRED_VERBS` in `dub-prosody.js` (đạt, chiếm, vượt, gồm, cho
thấy, mang lại, gây ra, dẫn đến, tạo ra, bao gồm, đòi hỏi, trở thành, đóng vai trò, phụ thuộc, giúp) and
`predVerbAt`: a 2 or 3 word verb matches whole, a one-word verb only when it is not inside a compound
("chiếm dụng" stays a noun). In `adjustJoins`, a subject of 5+ syllables before such a verb becomes a
boundary: invited (value above `minValue`) when long, legal but uninvited when short (same
`subjectLong` / `subjectClauseMin` test as 1.9.5). `constituents` counts the verb as a predicate
marker. Real takes (`prosody-eval.js`, syntax4, 40 takes): WRONG 9 -> 3, MISSED 6/20 -> 0/20, RAN-ON
14 -> 13 of 20; the other eight sets identical on every count.

**2.0.4 verbs of effect (BACKLOG 16).** `PRED_VERBS` gains ảnh hưởng / tác động đến (tới), cải
thiện, tiết kiệm, phản ánh, thúc đẩy, tiêu tốn, quyết định, chứng minh, thể hiện, đóng góp, hạn chế,
làm tăng, làm giảm. Three guards came with them, each found on real takes or a test:
- `NOUN_BEFORE`: after các, những, một, ra ("đưa ra quyết định"), có, của, sự, việc... the word is
  a noun, `predVerbAt` returns 0 (it caught `boundaryValue("cách mô hình đưa ra", "quyết định")`).
- Only the first predicate of a clause ends the subject: no `subjectEnd` after one already set in
  the zone ("ảnh hưởng đến | quyết định" stays closed).
- `KIN_NOUNS` ("trẻ em", "anh em", "chị em", "anh chị"): the pronoun word does not stop the subject
  count. And `constituents` checks `predVerbAt` before skipping a two-syllable word as a noun, so
  "cải thiện" is found as the predicate and the PP inside its subject is closed.
Real takes: syntax5 (dev, 70 takes) WRONG 4 -> 0, MISSED 14/35 -> 0/35, RAN-ON 21 -> 19; syntax6
(written after the rule, scored once) WRONG 3 -> 0, MISSED 15/30 -> 0/30, RAN-ON 15 -> 15; the other
nine sets identical on every count. RAN-ON is the voice not stopping at all: out of reach of
pause shaping, which only keeps or closes the voice's own stops.

**2.0.5 a place or topic phrase inside a short subject.** In the `PRED_VERBS` branch a subject of
5-7 syllables is invited like a long one when it holds one of `SUBJECT_PP` (trên, trong, ở, tại,
dưới, giữa, về). "của" is left out (possessive; blind split 2 ruled "Số nhân viên của công ty | đã"
wrong) and so are "qua", "ra", "vào", which also follow verbs ("ghé qua sửa | giúp" was invited
with the full `PREPOSITIONS`). Evidence is thin: over the 493 corpus sentences it changes one,
syntax4 V1; on its cached takes WRONG 4 -> 2, MISSED 2 -> 0, the other ten sets identical. No
held-out sentence exists for it.

## Known limits kept on purpose (backlog closed 2026-09-29)

What the old BACKLOG entries left open, now decided. Numbers are the old entry numbers (git has the
full text). Reopen only with a new failing example, measured on real takes.
- **Server speed (20, 33, 36).** macOS pages VieNeu's model out after long idle: 2.2.6 sends one tiny
  take when the server is cold (`handleLocalWarm`, >10 min since a good take), during the wait for
  the first translation. A server at or past real time cannot keep up whatever the page does; the
  quick menu says so (`describeHealth`) and names a quicker voice. Never shorter speech (rule 1).
- **Prosody (15, 16, 18, 29, 30, 31).** Every eval set is WRONG 0 on the text-only proxy (2.2.6:
  explaining copulas "có nghĩa là", "tức là" after a short subject closed, corpus e1). Text-only
  MISSED at subject | verb is where the real voice stops and the model keeps it (real takes MISSED 0,
  2.0.4). Left on purpose: a run under 14 syllables with no boundary of value >= 0.1 keeps no pause;
  alignment errs 0.33 syllables on average, bounded by punctuation anchors; cue k5 follows the
  speaker's pause; a purpose clause after a short predicate is soft (the user's 1.8.0 ruling).
- **English readings (21, 23, 26, 27).** No respelling exists for du, hang, phan (also Vietnamese
  surnames). "RAM" stays marked English in validation v12. A lone Dan, Lan, An, Van, Tan, Kim stays
  Vietnamese even when the source names them. "So Google" is read sˈoʊ by VieNeu's own chunker (8
  separators probed, none helps).
- **Checks (19, 22).** `pron-eval` compares phonemes, not sound; corpus marks are one reader's. The
  user's live listen is the final check (HANDOFF).

## Who speaks: a voice per speaker (2.4.8, 2.5.2, 2.5.3)

On by default since 2.5.2: `dubSpeakers` is `"auto"` (a voice per speaker, up to eight since 2.5.3)
or `"one"`. It replaces `dubSecondVoice` (off by default, now ignored). `"auto"` sets the engine's
`settings.secondVoice`, and `DubEngine.refresh` passes `PLAN.speakerTurns(given, { ai })` to
`buildDubScript`; `"one"` passes `PLAN.NO_TURNS` and `oneVoice` makes every segment S1. Before 2.4.8
the voice toggled at a ">>", "- " or "NAME:" opening a group's first line, which over 46 saved
videos was wrong both ways: the recognizer writes ">>" around music and sighs in one person's talk
(10 one-person videos read 2 to 94% in the second voice), while half the real turns sit inside a
group (rtAi3qa8UtQ: 57 of 111). `speakerTurns(groups, { ai })` (memo per array and AI reading):
- every mark of the source with its time (inside a line by its share of the characters);
- a mark next to a sound note (`TURN_NOTE`) is none, except one turn after a question
  ("is there? >> [laughter] >> It's not...");
- anonymous marks (">>", "- ") count only in a conversation: `TURN_MIN_PAIRED` 4 of them within
  `TURN_PAIR_S` 12 s of another. A "NAME:" label (up to 4 capitalized words, not a credit like
  "Translator:", not a sentence before a colon) counts when the video has `TURN_MIN_NAMED` 3. News
  transcripts write a first turn with who the speaker is (`NAMED_CAPS_RE`: "TAMARA KEITH, National
  Public Radio:", "REP. MARIA ELVIRA SALAZAR (R-FL):"; missed, 4 of 19 panels lost 15 to 30 points).
  The name is what follows the line's last sentence end (`nameOf`) unless that end is a title's
  (`TITLE_ABBR`): "Yeah. ANDREW HUBERMAN:" is Andrew Huberman, not a third person;
- labels that name every turn (`labelsComplete`, the turns' `complete`): two names or more, a name
  right after itself at most `LABEL_SAME_SHARE` 25% of the time, no unlabelled stretch over
  `LABEL_GAP_SHARE` half the labelled talk. Then the labels decide (`source: "names"`, ranked by
  talk: S1 the longest, then S2..S8, `MAX_VOICES`; a ninth and on share S2..S8, `voiceIdx`) and no
  reading is paid for. Labels on some turns only (a host's "Amna:" before each question, the
  answers bare) give way to the AI reading: on 4 of 30 news videos they put the whole video in one or
  two voices (28 to 75% of the words right), the reading 77 to 99%;
- no complete labels: the AI reading below when there is one and it passes (`source: "ai"`);
- otherwise labels (`"names"`) or anonymous turns alternating (`source: "marks"`); whoever talks
  `TURN_MAIN_S` 45 s without a turn is the main speaker and gets S1, so a missed turn swaps the
  voices only until then.

`buildDubScript` gives each piece the speaker at its middle and ends a segment at every turn. A turn
inside a piece cuts it (2.5.3, `TURN_CUTS`) at a sentence end or a broken-off "--" within 0.3 of the
turn's share of the piece, else at a comma within 0.2, else at the share. A "NAME:" label inside a
translated line (`stripLabelsAt` keeps where each stood, the piece's `labelAt`) is the cut itself:
on the labelled podcast UIy-WQCZd4M "about you because--" / "ANDREW HUBERMAN: Right, ..." became one
Vietnamese line, and the voice now changes at the label in 14 of 14 such lines (3 of 14 before).
The result also carries `voices` (how many are heard) and `genders` (by rank, from the AI).

**AI reading (2.5.2, YouTube).** `dubbing.js` `readSpeakers` asks once per video, after
`engine.start()`, when the mode is "auto", `dubSpeakerAi` is on (default), AI is on with a key, the
video has 8 lines or more and its labels are not complete. `PLAN.speakerLines(groups)` gives the
source lines in time order (each once, sound-only lines out). Captions cut into short pieces (median
under `JOIN_SHORT` 40 characters, as recognizer captions are) go joined into sentences
(`joinCaptionLines`: a piece joins the line before unless that ends a sentence, would pass
`JOIN_MAX` 160 characters, or `JOIN_GAP` 1.5 s of silence lie between; ">>", "- " and "NAME:" open a
line; each line keeps its pieces' times, `timeIn`). The lines go to `analyzeSpeakers` (background.js,
"WHO SPEAKS") in parts of one size, `SPEAKER_PART` 900 lines at most (1289 lines are 645 + 644);
each later part gets the roster found so far and `last`, who was talking where the part before ended.
The service worker uses the cheapest model of `COST.modelChain("cheap")` the key can call (404 or
not available for the key: the next one), temperature 0 (`SPEAKER_TEMPERATURE`) and a JSON schema;
checks the budget; bills it with `trackText`; caches it in `caches.tr` under `["spk",
SPEAKER_PROMPT_VERSION, model, roster + last, lines]`. The answer is speakers `{ id, label, gender }`,
turns `{ line, speaker, at }` and a confidence. Output cap `2048 + 32` tokens a line (16,384 at
most); an answer cut off by the cap keeps its whole turns (`salvageSpeakerAnswer`, "medium") and
says how far they reach (`upTo`): the page reads on from there. Timeout: time for the longest answer
the cap allows at 250 tokens a second (15 s + 0.4 ms a character + 4 ms a token, 120 s at most); a
request our timer drops is charged at once as `400 + 3` output tokens a line, left running, and when
its answer still comes it is charged at its real counts and kept in the cache.
`PLAN.speakerHints` makes times of it: `at`, the new speaker's first words, is found where it stands
(`findAt`: the line named, the one after or before, also running on into the next line); a turn
named by its line alone that opens on the tail of a sentence hands over after it ends
(`afterSentenceTail`: "pain. Over to you."). `mergeSpeakerHints` joins the parts,
`DubEngine.setSpeakerHints` bumps `hintsRev` and replans. `acceptAiTurns` (only when the labels are
not complete):
- confidence "low": ignored;
- a turn within `AI_SNAP_S` 2 s of a caption mark moves onto the mark;
- a speaker with fewer than `AI_MIN_TURNS` 2 turns and under `AI_MIN_TALK_S` 8 s of talk folds
  into the one around it (a quote read aloud). 15 s in 2.5.2 folded real interviewees of news
  reports into the reporter's voice: 8 s gave +0.7 points over 30 videos, no monologue split;
- fewer than 2 speakers left: ignored, one voice;
- past the part already read: S1.
The debug snapshot (`localStorage.cstDubDebug = "1"`, attribute `data-cst-dub`) shows `speakers`
(`source`, `voices`, `read`), the cast (`voices`), each plan's speaker (`sp`) and `speakerRead`: what
the reading did (skipped and why, asking, read with its time and whether it came from the cache,
failed and why).

**Turns inside a line, prompt 3 (2.6.6).** `speakerLines` splits every caption line at an inner
">>" (`splitAtMarks`, the piece's time its share of the line's characters) before deciding to join;
joining still opens a line at a mark. Before, a line holding two or three turns went whole and the
reading gave it one speaker at its start: qSlxe4hA66g (Korean recognizer captions, 92 of 167
captions with a ">>", most inside) came back as 3 speakers, all labelled "unknown" with gender
"unknown", turns only at line starts. Prompt 3 adds film / drama / game scenes, lines in any
language, a role label instead of "unknown", gender from a role or how others address someone.
Not yet scored: the prepared lab lines (30 news videos, "plains") hold no inner ">>", so the split
does not change them; prompt 3 has not been read on the lab (paid) nor on qSlxe4hA66g live.

**Prompt 2 and the speaker lab (2.5.3).** Scored on 30 PBS NewsHour videos against their named
transcripts (docs/TESTING.md "Speaker lab"): words in the right voice 81.5 -> 89.3% on
recognizer-like captions ("plain"), 89.7 -> 93.5% on clean ones, people sharing a voice 20 -> 7.
Prompt 1 told the model to skip a turn it was not sure of and never said what an interview looks
like: it missed the host's questions. The placement rules then took plain 89.3 -> 90.2% (of 42
turns moved, 32 nearer the real one, 8 farther). Measured and not kept: pause marks in the lines, a
stricter "at", 3.5 Flash-Lite, temperature 0.5 or 1 (Google's advice for Gemini 3; it did not stop
the runaway below), a prompt forbidding a turn back to the same speaker (on JBvcMfa7K6E it wrote 367
alternating turns, 13,270 tokens, and lost a speaker), joining whole caption lines (-3.9 points on
22 news videos captioned in whole lines; -0.3, noise, on 7 captioned in pieces). Parts on the
3-hour podcast UIy-WQCZd4M (clean lines): about 800 lines 90.8%, 300 lines 84.5%, one call cut at
the cap 79.2%; its errors are mostly a missed turn back after a short interjection.
Where the plain words in a wrong voice come from (2.5.5, `score --why`, 10.1% by its own matching):
turns the reading never named 3.3, people it took for one 3.2, turns given to the person a question
names 1.8, switches early or late 1.7; 978 of 987 quoted first words are found,
so placement is done. The rest needs better readings, which costs money to measure: BACKLOG 44.
Handing a ">>" with no AI turn near it to the voice before was tried and dropped (-0.17).

**Measured live (2.5.3, `tests/harness/yt-watch.html`).** JBvcMfa7K6E, a 30-minute show with three
people and no marks: in 2.5.2 the reading never reached the voices. Its first part of 900 pieces ran
past the 22.5 s timeout twice (each charged as 20 output tokens; the same part read in the lab wrote
16,368 at temperature 0 and 1, a turn for nearly every piece, and 10,799 at 0.5). Its 637 joined sentences now read in one call
(5,227 output tokens, 178 turns, 3 speakers, 11 s); live, from the cache in 39 ms: 3 voices (Mỹ Duyên
7 lines, Thái Sơn 18, Thục Đoan 4 in the 80 s watched), nothing dropped. Aj_UWp8Y5D4 (a 4-minute
report, an anchor then a teacher, captions in whole lines so not joined): 50 lines in one call, 3
speakers read where the named transcript has 2; the first 75 s in two voices, the teacher in the
main one (20 lines) and the anchor in the second (4), nothing dropped.

**Cast.** `castVoices(L, main, second, genders)` (dub-engine.js; voices from `LOCAL_TTS.cast` in
cost-policy.js): S1 the main voice; S2 the viewer's second voice unless the main one already has it
or the AI says the other gender; S3..S8 unused catalogue voices of the AI's gender (alternating when
unknown), the main voice's region first. Defaults: Mỹ Duyên, Thái Sơn, Thục Đoan, Adam, Thùy Dung,
Minh Triết, Kim Thanh, Đức Trí. `setCast(genders)` recasts only when the genders change. Web Speech:
a speaker sharing S1's voice gets a pitch from `SPEAKER_PITCH` (S2..S8). Gemini TTS casts S1..S8
from `GEMINI_VOICES` (`createGeminiProvider` `setCast`, `castSig`).

**Takes follow the voice.** Each plan carries `voiceTag` (its voice's name). A replan that moves a
line to another voice (an AI reading arrived, a new cast) drops its take as a text change does;
`lookupCache` and a late render check it too. `audioKeysForVideo` covers every voice in use. This
relies on `given` being the whole video's list, as youtube.js and content.js pass it: a list cut
from the front restarts the anonymous alternation at another mark and swaps voices back and forth
(`playback-sim.js` cut groups 200 s behind until 2.5.2: yZfh made 108 takes it never played).

**Measured (2.5.2).** 50 saved videos, rules only: the one-person videos 0 switches, the 5
conversations switch (as in 2.4.8). `batch-review.js` `simulate` now runs the shipped default
(voices per speaker; `oneVoice` for one), so regress compares that with one voice: in the 5
conversations more segments and late starts dSEZ 31 -> 34, UIy 903 -> 909, yZfh 121 -> 150 (median
lag 0.85 -> 1.18 s), Zq7 32 -> 39, rtAi 28 -> 37; nothing dropped or lost; the other 40 videos
unchanged. `batch-review.js` shows `voiceSwitch` and `voice2` per video, so a one-person video
showing a switch stands out. 2.5.3 (with `SEG_STRETCH` below): 45 videos, segments 7850 -> 7845,
late 1702 -> 1711 (UIy +12, Zq7 +1, both from more turn cuts: voiceSwitch +2 and +4), gaps 56 -> 59
(krPK 2, uziJ 1: 0.37 s; UIy's gap time 2.06 -> 2.23 s), words lost 0. Limits: without names or an AI reading, who is who
is alternation only (a turn the recognizer did not mark is not seen); nothing listens to the audio.

**Cuts inside a phrase (2.5.3, `SEG_STRETCH`).** Free voice: a cut the length forces where no line
boundary is better and that falls inside a phrase ("cường độ cao với | những quãng nghỉ") waits for
the end of that line, up to `SEG_STRETCH` 2 s past `segHard` (11 s), when speech may pause there.
Not near where playback starts (`HEAD_HARD` keeps the first request short). Over the user's 44
saved videos: cuts inside a phrase 39 -> 17, segments 7794 -> 7779, segments over 11 s 13 -> 34
(none over 13 s). A 3 s stretch reached 11 and was not taken. Cutting inside a line at its best
phrase boundary instead was tried and reverted (+49 segments, weak cuts 19 -> 55).


## The SYNC block is the tuning bible

`dub-engine.js`, one object named `SYNC` (`grep -n "const SYNC"`, ~140 lines). **Every timing
constant lives there.** If you are about to introduce a magic number anywhere in the dubbing code,
put it in `SYNC` instead.
The comments in it record why each value is what it is; read them before changing one.

Knobs you will actually reach for:

- **Start-up (2.4.6), read this before touching `driveSpeech`**: Chrome needs time to start a media
  element after `play()` or a seek: ~20 to 100 ms on a quiet machine, **0.16 to 0.96 s** in the user's
  Chrome while VieNeu was making takes (a fresh element made at its line's start, one Chrome idled
  after 15 s, `kSuspended`). Until then `currentTime` stands still and `paused` is false. Before
  2.4.6 that wait read as drift: past `driftCorrect` the voice was seeked, the seek restarted the wait,
  and the loop repeated (chrome://media-internals: one 3 s line seeked 7 times in 1.1 s, HAVE_ENOUGH
  only at 0.96 s) = the user's "bụp bụp, lúc được lúc không". Now a start or a seek is complete only
  once the element is seen moving (`settleSpeech`, `startMoved` 0.015); the wait is absorbed into the
  line's timeline (`mediaStart` / `end` move later, nothing skipped) after every start and every
  seek; a playing voice is seeked at most once per `reseekSpacing` 2 s; a line whose element has not
  started is not ended at its planned end (`startWaitMax` 2.5 s wall). Edges: a start inside the take
  (`fadeFrom` 0.02: a resume, a mid-line entry, a drift seek) stays at volume 0 until it moves, then
  `speechVolume` ramps it in over `restartFade` 0.04 s, squared; a sounding voice that must stop (the
  video paused or stalled, the next line due) goes through `quietPause`: 64/36/16/4% at
  `fadeStepMs` 10 ms, then the pause (`el.cstFade` token; `driveSpeech` calls it off). Since 2.4.7 a
  seek, an ad and dubbing off fade too: `releaseAudio(r, true, after)` clears `r.el` at once, lets the
  element go when its fade ends (`quietPause(el, then)`, a fade already running takes the callback) and
  `stop()` revokes the URL only then. Simulator, all scenarios, `LATENCY=busy`: voices paused while
  loud 18 -> 0 (8 seeks, 10 stops), every delivery number unchanged; 45 saved videos unchanged. `watchSpeech` polls every 10 ms while starting or fading
  (ticks are 50 ms). Measured: 34 saved videos (712 min) in the simulator with `LATENCY=busy`, 2.4.5
  -> 2.4.6: playing-voice seeks 1599 -> 0, take seconds passed over 253 -> 0, voices up inside a take
  at full volume 213 -> 0, lines 7165 -> 7165, drops 0 -> 0, late starts 1689 -> 1715. Real Chrome
  (headless, voice output captured through WebAudio around scripted pauses): level in the last 5 ms
  before a pause 1.38-2.13x the voice -> 0.01-0.07x, first 5 ms of a resume 0.63-0.75x -> 0.11-0.12x,
  voice back 30 -> 80 ms after play. Without start latency every delivery number is unchanged.
- **Drift (1.6.8)**: `driftCorrect` 0.15s re-seeks the audio. Below that, `driveSpeech` first absorbs
  the element's start-up latency into the sentence's timeline (`driftAnchor` 0.12, once per
  sentence; since 2.4.6 after every start and seek, uncapped, see Start-up), smooths the drift (EMA), and nudges by one fixed 3% step with hysteresis
  (`driftNudge` 0.08 on, `driftNudgeOff` 0.02 off, `nudgeSpacing` 0.8 s). Measured in real Chrome
  (`tests/harness/smooth.html`, 120 s of real VieNeu audio): the old per-tick nudge changed
  `playbackRate` 510 times on playing voices (~21 per sentence), each one restarting Chrome's
  time-stretch = the "robotic stutter" (Thục Đoan); after the fix 0 for Thục Đoan and for Mỹ Duyên
  (Mỹ Duyên measured only after), lag still 0.
  `chooseRate` also plays a sentence within `snapToNatural` (5%) of 1.0 at exactly 1.0 when the
  voice is not a sped-up slow one and the step limits allow (21/24 Thục Đoan sentences, no stretch).
- **Rate**: `chooseRate` clamps per sentence to `[floorRate(), maxSpeechRate 1.3]`, rising to
  `lagMaxSpeechRate` 1.4 once lag passes `lagBoostAt` 1.0. Between sentences the change is smoothed
  (`rateStepUp` 0.1, `rateStepDown` 0.04; 0.06 until 2.5.1) because the user's complaint was uneven
  pace, not wrong pace. 2.0.7: the next part of a sentence the voice is still reading moves at most
  `rateStepInSentence` 0.03 up; down too when it is the sentence's last part (a part that goes on
  may still slow down freely: finishing early there left a 0.38 s silence mid-sentence in the
  hidden-tab test). Not when the voice is more than `lagBoostAt` behind. Rapid-seek matrix: parts
  of one sentence that changed pace by 0.05 or more 23 -> 6 of 53, mean change 0.032 -> 0.021;
  every delivery number of the rapid and slow matrices and of the scenarios identical. Between
  sentences a fast talk see-saws (1.30 1.24 1.30, each line's own need). Checked in 2.0.8 and not
  kept: holding the last pace when one of the next two lines needs it back (capped by `earliest`)
  took the steady matrix from 111 to 94 see-saws of 813 and 393 to 357 changes of 0.05 or more of
  876, late 280 -> 276; a small gain for steps that fall at a sentence end, where a reader's pace
  moves as much. `baseTempo` comes from the voice's **measured** syllables per second (`measureVoice`,
  EMA 0.25), not a constant. `floorRate` divides by `video.playbackRate`.
- **Faster climb for an overrunning line (2.7.0)**: of the 1657 starts over 0.5 s late on the 70
  saved videos, 1344 follow a line read at the ceiling (the voice cannot go faster: kept) and 313 a
  line held below it by `rateStepUp` 0.1, mostly at a new sentence (a slow line, then a dense one).
  A line that would overrun its slot by more than `overrunStepAt` 0.4 s at the gentle step may climb
  `rateStepUpOverrun` 0.2 (inside a sentence `rateStepInSentence` still holds). Simulator, 8,989
  lines (rate pairs = consecutive lines under 1 s apart, ~5900):

  | step / threshold | late > 0.5 s | > 1 s | lag s | pairs changing > 15% |
  |---|---|---|---|---|
  | 0.1 (2.6.9) | 1657 | 900 | 2506 | 5 |
  | 0.15 / 0.4 | 1502 | 805 | 2304 | 50 |
  | **0.2 / 0.4 (kept)** | 1419 | 766 | 2197 | 77 |
  | 0.3 / 0.4 | 1380 | 731 | 2120 | 102 |
  | 0.2 / 0.8 | 1557 | 786 | 2299 | 56 |

  `regress.js`: reviewed videos late 1629 -> 1431, scenarios 78 -> 74, gaps +2 (+0.25 s).
- **Smoother pace (2.5.1, "Mỹ Duyên nghe không đều")**: two measurements found where the uneven pace
  comes from: line-to-line rate choices (a fast talk climbed 0.1, fell 0.06, climbed again) and each
  take's own pace (VieNeu reads one line slower than the next, so the same rate is not the same pace
  to the ear). Four changes, all in `SYNC`:
  - `rateStepDown` 0.06 -> 0.04 with `lookAhead` 3 -> 5 and `lookAheadEarly` 0.5 -> 1.0: a dense
    stretch is climbed towards earlier and left more gently.
  - A part that runs on into the next part of its sentence may step down `rateStepDownJoined` 0.08
    when the gentle step would end it more than `midSilenceMax` 0.4 s before that part may chain on
    (`chainLead`): without it the slower descent left those parts finishing early, 120 s more
    silence mid-sentence over the 45 videos (excess beyond the intended rest 1080 -> 1200 s).
  - Heard pace (`paceComp` 0.05, `paceCompMinSyl` 8): the smoothing steps from the last line's heard
    pace (its rate x its take's syllables per second) over this take's own pace, kept within 5% of the
    last rate, when both takes have 8+ syllables (a short take's own pace is too noisy). The ceiling
    hold after a catch-up still uses the rate really played; the result is clamped to `lagCeiling`
    and the viewer's cap again after the in-sentence step. `lastHeard` / `lastHeardSyl` carry it.
  - `lagRest` and the warm elements (Delivery, "Pace and warm elements").
  Measured on the 45 saved videos (simulator, Mỹ Duyên 3.8 syllables/s, `LATENCY=busy`, 7,748 lines;
  heard pace = rate x the take's syllables per second, a pair = two lines under 1 s apart, 5,262 to
  5,507 pairs; scratch scripts, not in the repo):

  | | 2.5.0 | rate steps only | A: + `lagRest`, warm elements | A + `duckBridge` 2.5 | + heard pace 0.05 (kept) | + heard pace 0.08 |
  |---|---|---|---|---|---|---|
  | starts over 0.5 s late | 1802 | 1658 | 1616 | 1616 | 1653 | 1696 |
  | over 1 s / 2 s / 4.5 s | 1116 / 434 / 67 | 1011 / 389 / 60 | 940 / 308 / 33 | same | 962 / 306 / 30 | 978 / 313 / 32 |
  | delivery gaps (n, s) | 68, 12.25 | 69, 12.9 | 52, 8.59 | same | 53, 8.72 | 54, 8.81 |
  | heard pace: neighbour spread (sd) | 8.8% | 8.5% | 8.5% | same | 7.35% | 7.0% |
  | heard pace: pairs jumping > 15% / > 10% | 585 / 1369 | 486 / 1243 | 491 / 1236 | same | 284 / 775 | 236 / 619 |
  | ... of them inside one sentence (> 15%) | 102 | 89 | 95 | same | 15 | 7 |
  | heard see-saws (up then down, both > 5%) | 942 | 865 | 864 | same | 594 | 506 |
  | original let up and down again (pumps) | 408 | 422 | 421 | 72 | 68 | 73 |

  Spoken 7,748, dropped 0 and words lost 0 in every column. The playback rate itself now changes more
  often (rate steps of 0.05 or more 2,134 -> 3,000): it moves to keep the heard pace even, which is the
  point. 0.08 was not kept: 48 fewer heard jumps than 0.05 for 43 more late starts, and the rapid-seek
  matrix late 27 -> 31 (0.05: 27 -> 27); per video the cost is concentrated (krPKW8J6JSM late 15 -> 21
  at 0.05, its heard jumps 11 -> 4). Slow matrix 2101/507/753 -> 2102/509/755 (spoken, late, gap s);
  scenarios late 87 -> 78. The simulator agent's own see-saw count (rate steps of 0.05 or more both
  ways, 939 -> 118 with A) mostly measures that a 0.04 step falls under its threshold: use the heard
  numbers above. A test pins the heard reference ("the second part of a sentence keeps the pace").
  Not verified by ear yet.
- **A pause frees the pace (2.8.5, `rateMemory` 4 -> 1, BACKLOG 48)**: every silence of 1.5 s or more
  while the source still talks (1,193 on 100 saved videos) sat inside the line's own slot: the line
  ended early. A fast line held the next one fast across a pause of up to 4 s (`rateStepDown` 0.04 a
  line, the fast-stretch floor, look-ahead), so a short line was rushed, then the voice fell silent.
  Simulator, 100 saved videos, 8,977 lines, Mỹ Duyên 3.8 syl/s, translations ready
  (`$TMPDIR/pacesweep.js`, scratch; "jumps" = rate change > 15% between lines under 1 s apart):

  | rateMemory | late > 0.5 s | lag s | jumps | rushed (>= 1.15x) then silent >= 1 s | silences >= 1.5 s (s) |
  |---|---|---|---|---|---|
  | 4 (old) | 751 | 1159 | 55 | 916 | 1193 (2868) |
  | 2 | 741 | 1143 | 49 | 797 | 1128 (2712) |
  | **1 (kept)** | 716 | 1105 | 46 | 687 | 1068 (2574) |
  | 0.8 | 678 | 1059 | 99 | 670 | 1058 (2558) |
  | 0.6 | 663 | 1049 | 169 | 625 | 1043 (2529) |

  Below 1 s, lines a breath apart jump pace. Words lost 22 -> 54 at 1 and 2: one video only
  (6QULfp2wdZI, a Russian machine transcript broken into word salad needing 5.5-6.4 syl/s), where a
  line is dropped 11 s behind at every setting and which line it is changes. Tried and dropped:
  `holdEarlyMax` (a held pace may end a line at most N s early): jumps 55 -> 418, late 751 -> 930.
- **Chaining**: `chainLead` was cut from 2.0s to 0.8s because starting early accumulated error
  across chained segments, and to 0.3 s in 2.6.9: the voice reads a part faster than its slot, so
  nearly every chained part waited only for the lead and started the full 0.8 s before the speaker
  (user: "lồng tiếng trước khi người thật nói liên tục"). Simulator on the 70 saved videos (8,989
  lines, Mỹ Duyên 3.8 syl/s): starts > 0.3 s early 1371 -> 0 (> 0.6 s 1182 -> 0), mid-sentence
  silences > 0.4 s 114 -> 177 (183 -> 276 s), late > 0.5 s 1649 -> 1657, words lost 0 -> 0. 0.5 left
  1330 early, 0.15 gave 187 silences and 1675 late. The same holds for a video's own uploaded
  Vietnamese track (`ytHienThiNguyenTiengViet`, one group per cue, most cues end mid-sentence): 55
  of 374 starts over 0.6 s early -> 0. `continuesNext` treats gaps up to 1.5s as one continuous span.
- **Skipping**: whole sentences only, never mid-sentence. 2.4.2: a line past `maxQueueLag` was read
  only when it gave time back (`absorbsLag`): 17 -> 9 drops on 39 videos. 2.4.5 (`readsLate`): a line
  whose audio is ready is always read up to `maxQueueLagHard` 8 s late, because dropping bought no
  sync back. On the 40 saved videos: drops 8 -> 0, words lost 113 -> 0, latest start 6.68 -> 6.70 s,
  starts over 4.5 s late 11 -> 38 of 7271, none over 8. `maxQueueLag` still drops a line with no
  audio (a slow server). The slow and rapid matrices and the 14 delivery scenarios are identical.
  What is left is lateness on fast talkers: 13% of lines start over 1 s late (yZfhCQwCWT4 100 of
  191). The voice is already at its rate ceiling, so only slowing the video would cut that, and the
  user declined that (2026-10-06, `BACKLOG.md` 41): kept on purpose.
  `maxQueueLag` 4.5, `dropLag` 4.0 for the
  live provider. Gating happens in `nextSpeech`.
- **Overload (added 1.4.7)**: when the TTS server is slower than real time, waiting for the next
  sentence's audio is hopeless and the old code stood silent 4.5s per sentence, dropping them one
  by one while still rendering sentences it had already given up on. Three parts now: `waitAudio(p)`
  estimates the remaining wait from the **measured** `renderRtf` (generated seconds per second of
  speech, EMA in `renderBatch`), `skipAhead` jumps the queue to the first sentence whose audio can
  still arrive (`skipAfter` 8, `skipAheadMax` 60), and `schedule`'s `inWindow` refuses any plan at
  or behind `lastSpokenStart`. Plus: with an empty buffer a request carries **one** short plan, not
  a 4-plan batch. Simulated on a real 11-minute timeline with a server at RTF 1.0: 12/61 sentences
  spoken before, 30/61 after; at RTF 0.23 nothing changes (61/61). The thresholds are measured, not
  guessed: `skipAfter` 4.5 costs 2 sentences at RTF 0.7, and capping `skipAheadMax` at 6 to 14
  seconds drops to 14/61 because short jumps land late again. See `tests/hardening.test.js`
  "slow voice server".
- **Video pace (1.6.1)**: `videoPace(t)` reads the next `paceWindow` (90 s): for each plan,
  `planNeed(i)` = natural audio length (rendered, else syllables / measured voice sps) over its slot,
  syllable-weighted median (`mid`) and upper quartile (`high`). `paceLimits` raises the ceiling to
  `min(paceCeilingMax 1.55, high * 1.08, maxSpokenSps 5.8 / sps)` (+0.1 while lagging) and the floor
  to `mid * 0.92` when `mid > 1`. `chooseRate` also looks `lookAhead` (5; 3 until 2.5.1) plans ahead
  and starts climbing early, bounded so the current sentence ends at most `lookAheadEarly` (1.0 s;
  0.5 until 2.5.1) before its subtitle. Simulated with Kim Thanh on two real cached timelines: lag over 1 s 3 -> 0 and 5 -> 1,
  a slow speaker (timeline x1.35) unchanged. Measured live on 4eY5DuqASQc 8:25 to end (1.6.1, Kim Thanh):
  peak start lag 1.88 -> 0.43 s, overrun 1.76 -> 0.42 s, top rate 1.40 -> 1.41, none dropped. Harness: a session scratch script (not in the repo); the same case lives in
  `tests/dub.test.js` "slow voice on a fast speaker".
- **Prefetch**: `prefetchAhead` is adaptive, roughly `(latency * 2.5 + 4) * playbackRate`, times 0.6
  if the user seeks twice in a minute. The free local voice keeps `freeAheadMin` 60 to `freeAheadMax`
  90 media seconds, times the video rate (1.9.9; 20 to 40 before, see "A slow server" under Delivery). At a seek only
  jobs for the first `seekKeepAhead` 20 s after the landing point are kept. `dubbing.js`
  `smartPrefetch` shrinks it 30% for videos over 30 minutes.
- **Retention**: `keepBehind` 90s / `keepAhead` 240s in `releaseOld`, so a short rewind is free.
- **Levels (1.5.6)**: `dubVolume` and `dubDuck` are 0..1 and read through `CST_DUB.level(x, fallback)`.
  Never `Number(x) || fallback`: 0 is a real choice (mute the original), and that idiom turned the
  Settings slider's 0% into 20%. Both are also set from the quick menu (`buildVolumeControls` in
  `player-ui.js`) and applied live by the storage listener in `dubbing.js`.
- **What the viewer sees (1.5.6)**: `engine.health(t)` returns `{ live, ahead, rtf, dropped, errors,
  pace, paceHigh }`;
  `CST_DUB.describeHealth()` turns it into the one line under "Lồng tiếng Việt" in both quick menus
  (ready N seconds ahead / server slow at RTF x / N lines skipped / a quicker voice by name, 1.9.9),
  warning-coloured when it matters.
- **Render speed (1.7.7, 1.9.7)**: `renderRtf` is an EMA of `(secs - renderOver()) / audioSecs`; the
  first sample of a run is capped at `SYNC.firstRtfCap`, and drop decisions use `dropRtf()` = min(EMA,
  latest sample). Cold server: macOS swaps VieNeu's model out after long idle (3.5x real time vs 0.23
  warm). `background.js` `localIsCold()` (>10 min since a good render, kept in `chrome.storage.session`)
  gives that first line a 60 s limit and keeps it out of the speed log. No warm-up line (1.2.6 test).
- **Ducking**: voice cannot be separated from music, so the original track is ramped down
  (`duckRampTicks` 9, `duckHold` 0.35) in `updateDuck`. The ramp (`duckStep`, 2.0.9) moves in equal
  steps of loudness: 1.55 dB a tick at the default 0.2, full <-> duck in 0.45 s either way; a duck of
  0 ramps to -40 dB, then off. The linear ramp before it (0.09 a tick) jumped +2.9 dB on its first
  step back up and crept +0.8 dB on its last; on eleven playback-sim scenarios the largest one-tick
  change went 3.23 -> 1.55 dB, and the 20 lines that began over a loud original (a start, a seek, a
  late take) had it at -4.5 -> -6.1 dB mean power in their first 0.45 s. 2.1.2: once a voice is
  already sounding over an original above the duck level (`this.speech` past its `mediaStart`, or a
  system-voice phrase speaking), the way down is the attack, `duckAttackTicks` 4 (3.5 dB a tick);
  a line announced ahead (`lineComing`) still comes down at the gentle 9 ticks before it starts, and
  the way up is unchanged. Those 20 lines: -6.1 -> -9.6 dB (3 ticks -10.9 at 4.7 dB a step, 5 -8.7,
  6 -7.9); loud share of voiced time 0.3 -> 0.1%; delivery and every pump count identical (slow
  matrix and system-voice logs compared line by line). Any volume write that is not ours
  (`onVolume`) resets the base and sets `duckDirty`, so the duck is re-applied next tick. On YouTube
  (`playerOwnsVolume`, set in `dubbing.js`) the written value IS the new base: the player writes its
  own full level (Stable Volume after a seek, measured 0.1 -> 0.89). Elsewhere it is divided by the
  duck factor (a native slider shows the ducked value). Before 1.7.9 a YouTube write mid-speech left
  the original loud until the voice paused. 2.4.6: on YouTube the duck goes back inside `onVolume`
  itself while ducked; waiting for the tick left the original at full for up to 50 ms (a probe on the
  user's tab caught the player writing 0.825 over a 0.2475 duck 2 s after play).
- **Live check, 2026-09-29 (2.1.9, H9yU-Y22vGI, a fast English talker, cached translation, VieNeu
  RTF 0.22, the user's duck 0.05)**: ~4 min with a seek to 300 s, a 5 s pause, then 1.5x. 0 drops, 0
  errors, 66 requests; voice back 0.78 s and 2.08 s after the two seeks; the pause kept the original
  at the duck level; 3 lines started 0.6 to 0.9 s late, all at 1.5x with the rate at its 1.3 cap.
  Rates were 1.2 to 1.41 at 1x (pace mid 1.1, high 1.18): the talker is fast, rule 1 leaves only
  rate and pauses. At a 0.05 duck the ramp spans 26 dB: 2.9 dB a tick back up, 6.5 dB a tick on
  the attack. The original comes up to full during a seek's load and down when the new line starts.
  Tried after it and not kept: an attack of only the first 12 dB in 4 ticks, then the ramp's pace
  (no step over 3 dB). At a 0.05 duck the 18 lines that begin over a loud original had it at -14.8
  -> -9.5 dB in their first 0.45 s: the first words lose far more than the smoother step gains, and
  broadcast duckers attack in 10 to 50 ms anyway (a slow release is what the ear needs).
- **Ducking between lines (2.0.8)**: `lineComing` / `nextVoiceAt` know when the next line starts
  whenever that is known: its take is in the page (by `nextSpeech`'s own rules: the rest after the
  last line, `chainLead` for a running sentence, the subtitle start after a start or seek), or it is
  the system voice's next phrase (`tickLive`'s due time; `live.endMedia` is set in `onend`). A gap
  under `SYNC.duckBridge` 2.5 wall seconds (2.0 until 2.5.1) keeps the original down; after a longer one it comes down
  a ramp's length (~0.45 s) before the line. It is let up when the line is `duckHold` late. While
  paused, loading or stalled with a line under way (`speech`, a system-voice phrase the pause cut) or
  about to start, the duck holds instead of releasing, and a system-voice phrase still speaking past
  its predicted end still counts as speech. On a plain player (Coursera) the slider therefore shows
  the ducked level during such a pause too, as it always did while the voice speaks; YouTube's never
  shows it (`playerOwnsVolume`). Before, the original came back after `duckHold` whatever
  came next: in a 0.8 s sentence gap it was at full just as the next line began, then ramped down
  under that line's first words. Nine playback-sim scenarios (`normal rate15 slowTranslation slowTts
  fastSlowdown pauseResume rate2 seekForward seekBackward`): pumps (above 50% inside a gap under
  1.5 s) 88/180 -> 2/180, lines beginning over it above 50% 163/265 -> 11/265, voice time over it
  above 35% 6.4% -> 0.4%; gaps over 2.5 s still have it at full 63% of the time (75% before). What
  is left is inherent: the first line after a start and a take that lands late. Delivery is identical
  (rapid and slow matrices, every scenario). Not verified by ear; `duckBridge` is the one knob.
  2.1.3 (code shipped in the 2.1.3 commit, entry 2.1.4): a next take still being made (`pending`,
  its job not orphaned) counts too, at `max(start, now + jobRemain)`, for the bridge only (no
  pre-duck, since an overrun estimate would keep pulling it forward): the original stays down at
  most `duckBridge` after the last line, then comes up. slowTts pumps 2 -> 0; the slow matrix
  (`sim-matrix slow`, 144 runs, 2 seeks each): short-gap pumps 197 -> 8 (all 8 across a seek), lines
  beginning over it above 50% 594 -> 382 (the rest are first lines after a start or seek), silent
  time with it down 22.1 -> 25.9%. Delivery identical (slow matrix, system-voice logs).
  2.5.1: `duckBridge` 2.0 -> 2.5. On the 45 saved videos the original still came up and went down
  again (above the halfway point in dB, back at the duck level within 2 s while playing) 421 times
  with the 2.5.1 pace changes; nearly all in gaps of 2 to 2.5 s, where it reached full only to be
  pulled down for the next line: 421 -> 72 (2.5.0: 408), times it came up at all 1158 -> 809. The 24
  scenarios: 94 -> 26. Delivery identical (every late, gap and lag number of the 45 videos and the
  scenarios). With no voice the original is now held down up to `duckBridge` + `duckHold` + the ramp
  (~3.3 s); the bound in `tests/dub.test.js` "slow server" follows `duckBridge` (+ 1 s).

**Planning window (1.6.3).** `refresh` plans only groups overlapping
`[step*planStep - planBehind, (step+1)*planStep + planAhead]` (60 / 150 / 300 s) plus one group past
the edge (for `continuesNext`); the step number is in the signature, so it rebuilds at most once a
minute while nothing new arrives. Who speaks comes from `PLAN.speakerTurns(given, { ai })` over every group
(see "Who speaks" above), so a window and a whole-video build agree. Whole-video planning cost ~90 ms per new group on a 60-minute
talk; now ~15 ms. `releaseOld` frees audio whose plan left the window (it used to skip them: a leak).
`audioKeysForVideo` still plans the whole video, on purpose (forget-audio needs every key).

`tick` is the 50ms main loop. It splits into `tickLive` (Web Speech, no buffer) and `tickBuffer`
(prerendered timeline). A seek is detected in `tick` as `t < lastT - 0.3 || t > lastT + 2.5` and
calls `hardReset`, which drops queued speech, renders a tiny first batch (`warmup`), and re-anchors.
`cancelObsoleteJobs` deliberately lets jobs that are nearly done finish, because aborting a Gemini
call still bills for it. For VieNeu the service worker also keeps any request the server has started
(1.8.6, see "Delivery"), so a VieNeu abort only drops what is still queued.

**Viewer cap (1.6.6).** `settings.maxRate` (storage `dubMaxRate`) is the one user override of this
block: when set, `userMaxRate()` clamps `ceiling`, `lagCeiling` and the final rate, even below a
slow voice's floor rate. The voice then falls behind instead of rushing; it never drops words.

## Delivery: getting made audio to the ear on time (1.8.6)

### The pipeline and what 1.8.6 changed

Pipeline, per line: group translated -> `refresh` plans the window -> `schedule` looks the line up
(page L1, then the service worker's store) -> one request at a time to VieNeu (`maxBatch` 1, `serial`)
-> `background.js` queue (`localSerial`), same-key requests join one flight (`ttsInFlight`), store
checked first, take written to the store before the reply -> `addRendered` (blob URL, no element)
-> `prepareNext` builds the next line's element while the current one plays (`prewarm` between
lines, 2.5.1) -> `nextSpeech` /
`tickBuffer` start it on the video clock (`ended` event re-ticks at once; `gapTimer` for the rest)
-> `releaseAudio` when it ends. Priority is implicit and recomputed every tick: `todo` is sorted by
start from the current time, so the line about to play always goes first; no queue framework.

Measured with `tools/playback-sim.js` (real engine + provider, modelled service worker and server,
old = 1.8.5 engine with the old abort policy; all local, no API):

| Scenario | voice after seek (s) | requests | audio elements alive |
|---|---|---|---|
| seek back to held audio | 0.8 -> 0.05 | 19 -> 16 | 12 -> 2 |
| seek forward (1.5 s is translation) | 3.05 -> 3.05, 3 s of it server-blocked -> 0 | 25 -> 24 | 14 -> 2 |
| 5 seeks in 7 s | mean 3.7 -> 1.4, worst 7.1 -> 2.5 | 28 -> 31 (23 lines spoken, was 20) | 16 -> 2 |
| server at RTF 0.9, 2 seeks | 13.6 -> 7.7 (lines 15 -> 17) | 21 -> 19 | 9 -> 2 |
| steady play, pause, 1.5x, 2x, all cached | unchanged (no gap before either) | equal or -1 | 20-21 -> 2 |

The slow-server run has one more delivery gap (2 -> 3, 3.4 -> 7.1 s): a line now starts 3.5 s late
where the old code was still silent. Late starts and gaps in steady play were 0 before and after:
the gains are all around seeks, pauses and slow servers.
Real Chrome (`tests/harness/smooth.html`, real VieNeu takes): voice 15 to 27 ms after a seek back
and a seek into prefetched audio, 0 overlap in 2,854 samples, at most 2 elements holding a source.
What changed, each for a measured cause:
- **A request VieNeu has started is not cut** (`background.js` `LOCAL_KEEP_RUNNING_S` 4). The server
  keeps its one stream slot ~4-5 s after a client leaves (`apps/openai_speech.py` `_Lease`), and
  `waitLocalIdle` made the next request (the seek target) wait: `server.log` had 23 such releases,
  11 of them followed by 12-21 `/health` polls. The take now finishes (~1 s) into the store; a
  request still in the service worker queue is dropped unsent. Cold server: still cut.
- **A seek onto held audio keeps the cut** (`hardReset` -> `audioReadyAt`, `headPinned`). The short
  head cut re-rendered a line that sat ready; now it plays from its offset (the same mid-line entry
  the head cut used whenever the seek landed >0.3 s into a piece).
- **Unreachable lines are not rendered after a start/seek** (`unreachable`, only with a measured rtf):
  at RTF 0.9 or 2x the engine rendered the line under the playhead, then skipped it as too late.
  `waitAudio` counts an orphan job on a serial server as busy (it now runs to the end).
- **Pause does not cancel** (`cancelObsoleteJobs` uses `prefetchAhead(true)`, the playing horizon).
- **Elements are let go**: `releaseAudio` after a line ends and on `hardReset` (the blob URL stays;
  a rewind makes a new element). `stop()` aborts its queued jobs (next video not held behind them).
- **Scorecard** (debug only): `debugSnapshot().delivery` = `recoverMs` (start/seek -> first voice),
  `late` (lag > `SYNC.lateStart`), `gaps` / `gapSec` (silence beyond the intended rest, `SYNC.gapMin`),
  requests, cache hits, aborted, detached, lines held, live elements. Intended pauses never count.
  2.4.2, for a reported "pop" the simulator cannot hear: `reseeks` (a sounding voice moved by
  `driftCorrect`, a jump each), `nudges`, `duckUps` (the original back at full between lines), and
  `settings.duck` / `volume` in "Chép chẩn đoán". The simulator on Q4JWEtq23h8 (the report, 2.4.1): the
  original came up 11 times in 10 minutes, 1 for under 1.5 s; not a pump. That "pop" was the start-up
  seek loop (see Start-up in the SYNC section), which the simulator could not show while its elements
  started at once. 2.4.6 adds `startUp` { n, slow (> 150 ms), maxMs, avgMs }: Chrome's start time
  per voice start, the cause behind a future "pop" report on a busy machine.
Not changed on purpose: prefetch horizon (`prefetchAhead` already scales with latency and rate: no
gap at 1.5x / 2x), rate choice, drift, ducking, prosody, the paid-voice cache keys.

### Pace and warm elements (2.5.1)

Two delivery parts of the 2.5.1 pace work (the rate part and the full table are under "Smoother
pace" in the SYNC section). Measured on the 45 saved videos (simulator, `LATENCY=busy`), each by
turning it off in the 2.5.1 setup without heard pace (`paceComp` 0):
- **A short breath when behind** (`nextSpeech`, `SYNC.lagRest` 0.12): when the next line was already
  more than `lagBoostAt` (1 s) late as the last one ended, the rest after that line is at most 0.12 s
  instead of a full stop's 0.18 (or a clause's 0.15). The next line is found with `planAt`. Starts over
  4.5 s late 60 -> 33, over 2 s 385 -> 308, over 0.5 s 1654 -> 1616, delivery gaps 60 -> 52.
- **Warm elements** (`prepareNext`, `prewarm`, `makeEl` / `r.madeAt`): Chrome starts an element made
  just before its line, or one it suspended after ~15 s idle, cold (0.25 to 0.75 s while the server
  works, the simulator's `LATENCY=busy` model of chrome://media-internals). After a take shorter than
  `prepTwoUnder` 1.2 s, `prepareNext` also makes the element of the line after it. Between lines
  (nothing speaking, the next line not due), `prewarm` makes the next take's element once its line is
  less than `prewarmAhead` 3 media s away (and more than `prewarmMin` 0.3 s), and makes it again when
  it sat unplayed (paused, at 0, no fade running) longer than `prewarmIdle` 12 s. A playing or fading
  element is never touched. Delivery gaps 61 -> 52 (12.32 -> 8.59 s), silences of more than 0.5 s
  beyond the intended rest with the next line already due 6 -> 0, late 1619 -> 1616. Cost: one more
  element alive between lines (`maxEls` 2 -> 3 in 20 of the 24 scenarios). Real Chrome not measured.

### The start hold on each site (2.5.0)

"Chờ chuẩn bị" (`dubPrepareWait`, `dubbing.js` `prepareHold`, at most 5 s, `initial` restarts from 0
when the video is under 1.5 s in) holds a video until the engine `isReadyAt` its current time.
YouTube arms it in `ytTuDongDich` before the caption list is fetched; seeks arm it in `dubbing.js`.
Coursera had no start hold until 2.5.0: it autoplays 2-3 s after a lecture opens, and live on
2026-10-06 (cached lecture) the engine came up with the video at 1.7 s, the greeting was never
voiced and the first voice landed on line two (uncached, around 7 s). `content.js`
`courseraHoldFirstPlay` now holds the lecture's first `play` (a capturing listener on the
document: media events do not bubble), or at once if it already plays; `courseraAutoTranslate`
releases it when no voice came up. Generic pages and the manual dub button still have none.

### Entering a line (1.8.7)

**1.8.7 additions** (1.8.6 vs 1.8.7 on the same simulator, `OLD_BG=queued`):
- **Clean entry into a line** (`findStops` at `addRendered`, `entryPoint` in `nextSpeech`): the
  proportional position `into x audio/slot` started inside a syllable on 1,277 of 1,509 landings over
  25 real takes (`tests/harness/smooth/`), with an amplitude jump on 689. Now it moves back to the
  last gap between words (<= `entryBack` 1.2 s, heard again) or ahead to the next (<= `entryAhead`
  0.8 s): 4 of 1,509 inside the voice, 3 jumps; on average 0.35 s heard again or 0.12 s skipped.
  Gaps of `entryStopMs` 40 ms (80 ms left 6%, 60 ms 1.3%). ~0.5 ms per take. Real Chrome: 3 of 3
  seeks entered exactly at a gap, voice 23-26 ms after the seek.
- **Store before re-cut** (`headProbe`, `resolveHeadProbe`): a seek with nothing in the page looks the
  landing lines up in the store under the current cut before making the head cut. Rewind of 3 min:
  voice 0.95 -> 0.1 s, one request less; a miss costs one store round trip (rapid seeks +0.04 s).
- **Optimistic reach before a measurement** (`SYNC.reachOverheadMin` 0.2 + `reachRtfMin` 0.2 x
  length): first voice at 2x 2.75 -> 1.75 s, at 1.5x 2.3 -> 1.75 s (one late start -> 0); 1x unchanged.

**A rebuild keeps a made take (2.7.6, `keepMadeTakes` in `refresh`).** The planner's cut follows
`voiceModel.calibration`, which the first takes move, and every rebuild (a `planStep` crossing,
`replanFuture`) cut the lines ahead anew; `refresh` then threw away a take whose plan now read other
words. On the first line of a video (10 s of speech, made at 2 s) the new cut came just before its
turn: its first part had no audio and was dropped as `entry-no-audio`. A line with a take (or one
being made) whose new plans only cut it elsewhere, same words and speaker over the same span, now
stays as it was. Playback-sim on 100 saved videos: dropped 2 -> 0, words lost 23 -> 0, takes 12,398
-> 12,388, late 1,854 -> 1,853. A line with other words (a refine) is made again as before.

**The speed ceiling, measured again (2026-10-23, not changed).** All late starts on 100 saved
videos are carry-over after a line read at the ceiling (`maxSpokenSps` 5.8, `paceCeilingMax` 1.55).
Playback-sim, late > 0.5 s / lines over 6.2 syl/s: 5.8 & 1.55 -> 1,626 (13.8%) / 4; 6.2 & 1.65 ->
1,358 / 471; 6.5 & 1.75 -> 1,274 / 701; a higher ceiling only while lagging (6.2) -> 1,566 / 174.
Each line of lag bought back costs about two rushed lines; an interpreter's 1-2 s of lag sounds
human, 1.65x does not. The talk register (2.7.4) reads 3.6% fewer syllables (tr-lab `reg1`).

### Stalls, races and errors (1.8.8 to 1.9.1)

**1.8.8 resilience.** Each case reproduced first (`tests/dub.test.js` "resilience", all fail on 1.8.7):
- A store lookup the worker never answers kept `busyLookup` set: 0 lines in 60 s. Now
  `SYNC.lookupTimeout` 4 s, then misses (late hits still used if they fit).
- TTS jobs that never answer counted toward `maxJobs` forever: 3 of them = silence for good. Now an
  orphan stops counting `orphanStallMs` 20 s after it was left, any job after `jobStallMs` 90 s; a
  retry joins the worker's flight (`ttsInFlight`), so nothing is generated twice. `pending` is a Map
  planId -> jobId: only the owning job clears it.
- A hit landing after `stop()` made a blob URL nobody revoked; a hit for a line re-translated while
  the lookup was out was kept under the new text. Both dropped (`running`, same id and text).
- A take with a NaN / missing duration: rates went NaN, 1 line of 13. `audioLength` validates and
  reads the WAV header; garbage = `bad_audio`, retried like an error.
- Errors by kind in `debugSnapshot().delivery.errorTypes` (`countError`; kinds listed there). The
  VieNeu provider tells `no_response` (port closed) from `invalid` and the worker's `errorType`.
- `background.js` reads store keys together (`cachedParts`, `handleAudioCacheGet`, keys validated and
  deduped): 12 keys on a wedged IndexedDB 18 s -> 1.5 s.
Measured and left alone: the tick is 17 us on a 60-min lecture (max 6 ms on a plan rebuild, 5 per
200 s), `base64ToBytes` 0.7 ms per take, `audioKey` 0.02 ms per plan (memoised).

**1.8.9 service-worker races and error codes.** Each reproduced first (`tests/hardening.test.js`,
"1.8.9", all fail on 1.8.8):
- A job dropped while queued in `localSerial` answered only when the queue reached it; it now leaves
  the queue at once (abort listener, removed when the pump takes it).
- A line dropped and asked for again (seek away and back) joined the dropped flight and got
  "aborted". A new flight now waits for the old one and uses its take when it finished (kept running,
  `LOCAL_KEEP_RUNNING_S`), else makes it: never refused, never made twice. Flight cleanup is
  owner-checked (`ttsInFlight.get(reqKey) === f`).
- A `ttsAbort` landing while the request key is still hashed was lost and the line generated anyway:
  `ttsRegistering` holds jobs between arrival and registration.
- `synthesizeLocalOnce` error by stage: before a reply `local_unavailable` (the only one that may
  switch the video to the system voice), mid-body `dropped` (retried once, like `timeout`), after it
  `invalid`. All three read "server not running" before. `synthesizeLocal` (`withStartHint`) rewrites
  the `local_unavailable` text with `LOCAL_TTS.startHint()` (cost-policy.js): a Windows browser is
  sent to `tools\vieneu-autostart.cmd`, never to the Mac-only `cst-start.command`; `dubbing.js` toasts
  use the same hint.
- `waitLocalIdle` follows the job's signal and times the body too: a hung `/health` held a dropped
  line 1.7 s, now ~5 ms. A dropped job is never sent (was: sent with an aborted signal).
- `ttsRequestProblem` refuses bad `jobId` / `parts` (key 1-256 chars, weight > 0, <= 12 parts) as
  `invalid` before any read; a numeric key was stored before.
- Page cache (`dubbing.js`): one corrupt record threw away every hit of the lookup; now a miss for
  its line. A hit moves to the newest end, so a take replayed on each rewind is not evicted first.

**1.9.0 play() refusals and WAV headers.** Reproduced first (`tests/dub.test.js`, fail on 1.8.9).
`driveSpeech` used to send every `play()` rejection to `onProviderError` and ask the paused element
again on every tick. `onPlayFailed` sorts them by the browser's error name:
- `AbortError` (a pause or seek cut the start): `play_interrupted`, not a provider error. 8 of them in
  30 s counted before; three in a row switch a paid voice to the system voice.
- `NotAllowedError` (autoplay policy): `play_blocked`, asked again after `SYNC.playRetryMs` (1 s):
  282 -> 25 calls in 20 s. `status().playBlocked` puts a warning on the badge until a play starts.
- anything else (`NotSupportedError`): `play_failed`, the take is dropped and the line goes back to
  the schedule (`S.prevSpokenStart`/`prevSpokenId` restored): 51 calls on a broken take -> 1, and
  the line is made again.
`decodeWav` refuses non-PCM, channels outside 1-8, rates outside 4-192 kHz and a cut `fmt` chunk
with `e.code === "wav_invalid"`; rate 0 or 4 GHz used to decode into Infinity durations.

**1.9.1 system voice stall.** `tickLive` returned while `live.speaking`, so an utterance whose end
Chrome never reports (collected with its handlers, a network voice stopping, a queue stuck pending)
silenced the system voice for the rest of the video: 3 of 23 lines. `liveStalled` gives a phrase up
after predicted length x `SYNC.liveStallFactor` + `liveStallPadMs` from its start (or from `sentAt`
when no start came), counts `speech_stalled` and goes on: 23 of 23. The web-speech handle keeps
`utterance` so it is not collected. `audioCacheDelete` refuses a non-array, drops bad and repeated
keys. Measured, left alone: a 2 s scrub (125 `seeking` events) costs 0.4 ms of `hardReset` in total
and sends no render.

### The video is shared: a reloaded script, ads (1.9.2, 1.9.3, 1.9.8)

**1.9.2 duck across a Reload.** The old content script runs on after Reload (DANGER.md §3) and the new
one starts on the same `<video>`: each took the other's ducked level for the user's own. After dubbing
stopped YouTube was at 0.01 of 0.80 (old script stopping late) or 0.16 (old script frozen); a plain
video 0.16. Isolated worlds share only the DOM, so the element carries `data-cst-duck-owner` (the
engine's token) and `data-cst-duck-base` (the user's level). `start()` takes the held level unless the
element is louder (stale), and claims; `tick()` stops an engine whose token is no longer the owner
(`stats.superseded`), so there is one voice; `setVideoVolume` never writes or restores for a
non-owner; a restore removes both attributes. Checked in real Chrome with two engines on one element:
old one stood down, duck 0.16, 0.80 after stop, no attribute left.

**1.9.3 YouTube ads.** An ad plays in the lecture's own `<video>`, so its clock (0 to 30 s) read as the
lecture's: 5 lines read over a 15 s mid-roll, the ad ducked, those lines rendered. `d.adShowing()`
(optional; `dubbing.js` `adShowingFor`: the player's `ad-showing` / `ad-interrupting` class) gates
`tick()` (`adGate`: silence, no schedule, no duck, `stats.ads`) and `onSeek`; when the ad ends the
engine resets once (`hardReset("ad")`, `lastT` cleared). The subtitle loop has the same gate
(`youtube.js` `ytAdShowing`), which also stops Gemini calls for the ad's clock.

**1.9.8 ad resume** (BACKLOG 35, `adCut` / `takeAdResume`). The line an ad cuts goes on where the
voice was, not where the video was. A seek after the ad drops it (`hardReset` clears `adResume`).
2.0.1: an ad that comes while the voice rests after a finished line whose subtitle is still up
leaves `adCut = { done: true }`; after the ad `takeAdResume` restores `lastSpokenStart` /
`lastSpokenId` (`stats.adKeptPlace`), so the engine goes on with the next line. Before, the fresh
path entered that line again at the video's place and read its tail twice (live harness, 2.0.0:
from 4.63 s of a take already heard).

### A slow server (1.9.7 to 1.9.9)

**1.9.7 a server near real time (BACKLOG 33).** The reach decisions ran on a wrong speed:
- The overhead was a fixed 0.6 s guess. Real VieNeu costs 0.07 s + 0.21 s per second of audio
  (fitted on 12 takes), and the page path measured 0.16-0.17 s. So a 0.6 s take read as RTF 0.08,
  and `dropRtf()` (min of EMA and latest) took it. `noteTake` / `renderOver()` now fit a line through
  the latest 12 takes made while the server was free. The fit needs 4 or more takes spanning 1.5 s of
  audio, and is clamped to 0.05-1.5 s. A take under `rtfShortAudio` (1.2 s) feeds the EMA but is never
  the latest sample.
- A take the worker's store answered (`fromCache`) counted as a render at RTF ~0.1. It now counts 0
  seconds of audio (`o.cached`).
- A job left running for the old place after a seek read as 0 s: the plans are rebuilt, and its lines
  are not among them. `job.est` keeps the length known at send time.
- `crowdsNext`, called from `unreachable()` for a serial provider: a line whose audio lands late anyway
  is given up when the next line gains more time than the late line had left to be heard (at least
  `crowdGainMin`). This is not condensing: whole lines were already dropped for lag (`skipAhead`,
  `maxQueueLag`). This only picks which line.

Measured:
- `playback-sim.js` seekWhileSlow: delivery gaps 7.07 -> 4.87 s, worst gap 3.54 -> 2.49 s, late
  starts 6 -> 5, recovery 7.68 -> 6.58 s (max 9.9 -> 7.7). Every other scenario is identical.
- A 144-run matrix (RTF 0.8-1.1, rate 1/1.5/2, 12 seek pairs): lines spoken 2025 -> 2141, late 559
  -> 546, gaps 818 -> 797 s, worst recovery 34.0 -> 24.6 s.
- One part was tried and removed: skipping the rtf sample of a take queued behind another left the
  estimate stale after seeks (worst recovery 25 s at RTF 1.0, rate 1.5).
- Live, `tests/harness/live.html` on the real VieNeu server held to RTF 0.9: see TESTING.md.

**1.9.8 after the live runs.**
- A take queued behind another job on a serial server has that job's predicted rest taken out of
  its rtf sample (`job.ahead` from `serverBusy()`). The live harness read RTF 0.3 as 0.55 after a
  burst of seeks.
- `SYNC.overFitPad` 0.3 s is added to the fitted overhead for reach decisions. The exact fit let in
  marginal lines that then started late.

Measured against 1.9.6:

| Matrix | Lines spoken | Late starts | Gaps |
|---|---|---|---|
| Slow servers (144 runs) | 2025 -> 2138 | 559 -> 539 | 818 -> 799 s |
| Healthy server, rapid seeks (60 runs) | 873 -> 877 | 25 -> 29 | 10 -> 11 s |

The extra late starts on the healthy server are the lines 1.9.6 skipped entirely. Per cell it is
mixed: at RTF 0.9 and 1x, one of 8 seek pairs turns out worse, because a request cut on the server
holds its slot 4.5 s and the page cannot see that. So the test (`dub.test.js`, 24 runs) checks the
sum, not one scenario. The matrix scripts are not in the repo; the cells are in the test.

**1.9.9 silence, a rush, then skipped lines on a first view.** The user's report: continuous
viewing of a new YouTube video. The Vietnamese subtitle showed while the voice was silent. Then the
voice came back faster, stalled again, and skipped what it had not read. Measured live in the user's
Chrome (1.9.8, zPSs9a0MYGw, Mỹ Duyên, the `data-cst-dub` snapshot sampled every 500 ms):
- A fast talk. Mỹ Duyên read it at 3.78 syllables/s (the voice table says 4.2), so a line needed up
  to 1.25 s of audio per second of video. The rate sat at 1.45-1.56 for minutes, lag up to 3.5 s.
- VieNeu went from RTF 0.25 to 0.5-0.87 for minutes while the Mac was busy (`server.log`).
- The server's load is RTF x audio seconds per video second; 0.87 x 1.25 is past real time. The 20 s
  ready ahead drained within a minute. Then came silence, the catch-up rate, lag past `maxQueueLag`
  4.5 s, and whole lines dropped: the sequence the user saw.

What changed:
- `freeAheadMin` 20 -> 60, `freeAheadMax` 40 -> 90, in media seconds scaled by the video rate. On
  the real engine with a virtual clock, 6-minute fast talks:
  - a server at 0.9x for 200 s dropped 22 lines before, 1 now;
  - a 60 s stall dropped 12, now 0;
  - at 1.2x for 90 s, drops went 10 -> 0 and silence 33 -> 3 s.
  - A 90-120 s floor gained nothing more.
- `seekKeepAhead` 20: `hardReset` passes it to `cancelObsoleteJobs` as the reach.
- A job left behind (`job.orphan`) now feeds `renderRtf` (latency stays live-only). Only jobs that
  landed in time were measured, so on a server at 1.0x the estimate froze at 0.47. The engine then
  chased lines it could not reach. With the 60 s horizon and without this, the 144-run matrix's worst
  voice-back after a seek was 35 s; with it, 24.4 s.
- `tick()` jump detector: a forward jump that matches the wall clock since the last tick is this
  page's timer running late (a long task, memory pressure). It is counted in `stats.lateTicks`, with
  no reset. The reset cut the line being read and entered it again mid-way. A real seek still fires
  `seeking`; a jump the clock does not explain still resets.
- Diagnostics: `note()` keeps the last `SYNC.eventKeep` (150) events in `engine.events`, always on:
  - `drop` with `why`: lag, lag-no-audio, failed, entered-too-late (a seek into a line's tail, not
    counted) or entry-no-audio (2.0.0: waited on at a start or seek and lost, counted in `stats.dropped`
    when `SYNC.entryWaitMin` 1 s was left);
  - `skip` with lines, wait and rtf;
  - `reset` with `why`, `error` with `kind`, `late` with lag and rate.
  `debugSnapshot()` gains rtf, over, pace, lateTicks, spoken and events. `dubbing.js` `diagnostics()`
  returns one JSON text (no key, no text beyond line ids). Its quick-menu button ("Chép chẩn đoán")
  was removed in 2.5.5 (a menu of what is changed while watching; never ask the user for it):
  read `data-cst-dub` with `tests/harness/yt-watch.html` instead.
- Voice hint: `health().paceHigh` (the busiest quarter's rate). At 1.35 or more (`SLOW_VOICE_PACE`),
  `describeHealth` names up to two voices of the same gender that are at least 0.8 syllables/s
  quicker (`fasterVoices`, `CST_COST.LOCAL_TTS.voices`). Simulated on a fast talk with a slow server:
  late starts went 59 -> 3 with Thục Đoan (5.3) in place of Mỹ Duyên. Nothing is shortened; a quicker
  voice says the same words in less time.

Measured against 1.9.8 (`tools/playback-sim.js`, `tools/sim-matrix.js`):

| Run | 1.9.8 | 1.9.9 |
|---|---|---|
| fastSlowdown: fast talk, server 0.9x for 2 min | 55 spoken, 11 dropped, 6.6 s gaps | 66, 0, 0 |
| Slow servers with seeks (144 runs): spoken / late / gaps | 2138 / 539 / 799 s | 2109 / 521 / 745 s |
| ... voice back after a seek: mean / p90 / max | 5.66 / 12.3 / 24.6 s | 5.90 / 14.2 / 24.4 s |
| Healthy server, rapid seeks (60 runs): spoken / late / gaps / mean back | 877 / 29 / 11 s / 2.27 s | 869 / 28 / 11 s / 2.24 s |
| `dub.test.js` 24-run matrix: spoken / late / gaps / mean back | 290 / 104 / 143.8 / 4.11 | 282 / 98 / 128.6 / 4.26 |

The cost, stated plainly: a server that stays at 0.8-1.1x, with a viewer who seeks twice a minute,
gets 1.4% fewer lines and 0.24 s more to voice after a seek. Ablation splits it in two:
- The orphan sample makes the engine see a slow server as slow. It gives up lines it cannot reach
  instead of reading them late: 5 of the 8 lines in the 24-run test, bought back as fewer gaps and
  late starts.
- The 60 s horizon keeps the serial server busy further ahead when the seek comes (the other 3).
- Tried and not kept: the horizon back to 20 s after two seeks in a minute. The 144-run matrix was
  unchanged (2111 / 523 / 750 / 5.90).
- The one-scenario seekWhileSlow went 5.5 -> 10.6 s. Over 16 seek-time shifts the means are 6.45 vs
  7.11 s, and the whole difference is in two shifts: the first request left 50 ms later and one line
  crossed the entered-too-late edge.

Leads checked after 1.9.9 and not kept (BACKLOG 38, closed 2026-09-29). Each was measured on the
144-run slow matrix, or on real logs where the sim cannot show it. Do not re-try them without new
evidence:
- `dropRtf()` = min(EMA, latest) with a spike as the latest: "F6" (never skip a line not yet due)
  2109 -> 2074 lines, back after a seek 5.90 -> 6.16 s; "F5" + F6 2045 lines, 6.41 s.
- Cancelling jobs for lines the queue has passed: 2085 / 514 / 738 / 6.14 s, worst back 28.9 s. A cut
  VieNeu take holds its slot ~4 s (DANGER §15), which costs more than the wasted render.
- Theil-Sen overhead fit in `noteTake`: 2108 / 520 / 741 / 5.90. Noise.
- `jobRemain`'s 0.3 s floor grown with the overrun (k = 0.25 / 0.5 / 1.0): about 1% either way. Noise.
- The worker retrying a stuck take (`synthesizeLocal`, timeout then one more try): in 8439 takes of
  `~/VieNeu-TTS/server.log` no finished take came near its limit (`localTimeoutMs`, 8 s at least).
  Every long `total=` there has `active=1` and a cut audio length: a take the page left, not one
  the timeout cut. The path is kept for a truly stuck model and costs nothing when it does not fire.
- Translation windows near the 60 s horizon: 1 line's closing changed per 8 minutes. Fine.
- Service-worker CPU per take, measured 2026-09-29 on the 280 corpus takes (node, 48 kHz, the
  `splitTtsAudio` chain): ~11 ms per second of audio, 90 ms mean / 124 ms p90 for a 6-12 s take.
  `cleanTake` is 90% of it; base64 of a 10 s WAV is 3 ms. It runs inside the serial slot
  (`localSerial`), so it delays the next request by ~4% of render time at RTF 0.24 and ~1% at RTF
  1, where it would matter. Moving it out of the slot was judged not worth touching the store-then-
  reply order for.

Held audio in the page: up to 195 s on the fast talk (41 lines, about 18 MB of 48 kHz WAV), against
150 s before. `playback-sim.js` gains `scale`, `sps`, `unique` and `maxHeld`. `unique` keys each line
by its place. Without it the repeating lecture's store hits hide the server entirely: fastSlowdown
showed no difference at all.

## The three TTS providers

Selected by the `dubProvider` setting. `createVieneuProvider` / `createGeminiProvider` /
`createWebSpeechProvider` in `dub-engine.js`.

**1.8.1: the paid voice is switched off** (`cost-policy.js` `PAID_TTS = false`, the user's choice on
2026-09-27). VieNeu is the only *paid-free AI* voice: `dubbing.js` never builds Gemini providers. 2.9.8: with
`dubSystemFallback` (default on, Settings > Lồng tiếng) the browser's Vietnamese Web Speech voice speaks when
VieNeu is not running (toast, then `doiVieNeuSanSang` hands back to VieNeu) and is the engine's `fallback`
when VieNeu reports `local_unavailable` mid-video; off = the old behaviour (a toast, then it waits for the
server and starts by itself); the service
worker answers a non-local `synthesizeSpeech` with `errorType: "disabled"` before any request;
Settings has no voice source picker (2.5.5: the picker, the Gemini and system voice selects and the
TTS model box are gone; `collectSettings` writes `dubProvider` "vieneu" and the old defaults); a stored
`dubProvider` becomes "vieneu" once (`dubProvider181`). The Gemini TTS code and its tests stay: the
test harnesses set `PAID_TTS = true` (`bg-env.js` `opts.paidTts`), `hardening.test.js` "paid voice
off as shipped" checks the real default. To bring it back: `PAID_TTS = true` and those controls in
`options.html` (git history before 2.5.5).

### VieNeu local (default, free)

Config is centralized in `cost-policy.js` `LOCAL_TTS`: `http://127.0.0.1:8000`, model
`vieneu-v3-turbo`, 48 kHz (native), temperature 0.6, plus a 25-voice table with each voice's measured
syllables per second. The server is a user-run process outside this repo (`~/VieNeu-TTS`, started
with `cst-start.command`).

Engine sends `{ action: "synthesizeSpeech", engine: "vieneu", text, speak, voice, jobId, parts: [{ key,
weight }], maxPause, breath }` (`speak`, 1.7.8: the words the voice says; `text`: the one pauses
follow; `breath`, 2.1.8: word indices of the breathing commas in `text`). `background.js` probes `/health` and `/v1/models` (`handleLocalTtsStatus`;
Settings asks every 5 s until the server runs, then every 30 s, 2.3.3), and calls the OpenAI-compatible
`POST /v1/audio/speech` with `{ model, voice, input, response_format: "pcm", sample_rate,
temperature }`.

**The server serves one request at a time.** `background.js` keeps a global first-in-first-out
queue (`localSerial` / `localPump`) with an adaptive timeout and one retry. Its caps are
`{ serial: true, maxBatch: 1, free: true }`. Do not parallelize it.

First stop when there is no voice at all: `curl 127.0.0.1:8000/health`.

**Pinned model (2026-10-10, the author's machine only).** Where a voice lives: the 25 preset voices
are 266 numbers each (192 `speaker_emb` + 74 `codes`) in the VieNeu *code*,
`src/vieneu/assets/voices_v3_turbo.json` (180 KB, pinned with the code at `d350c63`). The 580 MB
shared by all voices is the *model*, which VieNeu fetches from Hugging Face (`pnnbao-ump/VieNeu-TTS-v3-Turbo`
`onnx_update/` + `denoiser.onnx`, and `OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX`) into `~/.cache`
on every start, always at `main`. Two failures came from that:
- **diskguard** (`~/Library/Scripts/diskguard.sh`, `SAFE_PATHS`) deletes `~/.cache` each day the disk
  has under 40 GB free. It deleted the model on 2026-10-06; the server kept talking only because it
  held the deleted files open, and any restart meant a 4-minute download (or silence offline).
- The author pushes to `main`: the server loaded `5f2a3e9` on 09-22 and `61b85e3` on 10-07. Those
  commits only touched `gguf/`, but nothing would stop a change to the ONNX weights reaching the ear.

Now the server reads `HF_HOME=~/VieNeu-TTS/models/hf` with `HF_HUB_OFFLINE=1` (LaunchAgent
`com.damduy.vieneu` and `cst-start.command`): `61b85e3` + MOSS `ceff0d0`, 15 files, every byte
checked against the Hugging Face LFS hashes, all listed in `tools/share/vieneu-model.json`;
`python3 tools/vieneu-pin.py` re-checks the copy offline (exit 1 on any difference), `--fetch` rebuilds it. Measured:
ready in 2.0 s (was 19 s, or 4 min after a clean), 0 requests to Hugging Face; in the sandbox with the
network cut, Mỹ Duyên read 5 sentences at RTF 0.22 to 0.34; through the real server, `POST /v1/audio/speech`
3.68 s of speech in 1.04 s. The voices file never comes from the network
(`voices_v3_turbo.json` is a 404 there, by design). After editing the plist, `launchctl kickstart -k`
keeps the **old** environment: bootout + bootstrap. Backup and undo: `~/VieNeu-Backups/2026-10-10-before-pinned-model/RESTORE.md`,
repo tag `backup/before-pinned-model-2026-10-10`.

**Friends get the same pinned model (built 2026-10-11; BACKLOG 42 stays open until the release is
published and the install test is green on all 5 machines).** The 15 files are assets of one
GitHub release of the public share repo (`release` in `vieneu-model.json`; a git repo cannot hold the
415 MB file, and the 6-hourly updater downloads the whole repo zip). Both installers, after `uv sync`,
run `extension/tools/vieneu-pin.py --install` with VieNeu's Python: each file from the release, else
from Hugging Face at the pinned revision, streamed to `.part` (resumed after a cut), size + sha256
checked, then `refs/main` and the marker `models/hf/.pinned-ok`.
- **The marker is a receipt, never trusted alone.** It lists every file with its size and each
  `refs/main` with its revision; every server start (macOS plist `/bin/sh -c` line `pinned_ok`,
  `cst-start.command`, Windows `vieneu-runner.pyw`) stats those before going offline. A file deleted
  or cut short (a disk cleaner, a crash) sends the server online with `VieNeu model: pinned copy
  incomplete` in its log, where it used to crash in a loop for good. Same-size corruption needs the
  hash, which only `vieneu-pin.py` (no flag, or `--install`) does.
- **The updater repairs.** Every 30 min `dichphude-update.py` runs the stat-only `quick_ok`; on any
  mismatch it runs `--install`, which fetches the missing bytes or, failing that, removes a marker that
  names this pin or another VieNeu commit (the pin id includes `voices.commit`), so the next start
  goes online. A failed attempt waits 6 h; a success clears the wait. It installs again when a new
  version moves the pin.
- **Old cache.** Once the copy passes and the server's last `VieNeu model:` line says offline, an
  install our installer made (`.dichphude-vieneu`) drops `~/.cache/huggingface/hub/models--pnnbao-ump--VieNeu-TTS-v3-Turbo`
  and the MOSS folder (600 MB), logged once. Never on the author's machine.
- **Downloads give up on silence, not on cuts.** A source is dead after 3 attempts in a row that
  received no byte; a cut with progress resets the count; 2 h per file is the cap. 404/410 = the
  source lacks the file ("release not published" on GitHub), 401/403/407 = a network or proxy block
  (said so, not "release missing"), 408/425/429/5xx wait for `Retry-After` (30 s at most). A resumed
  `.part` that fails its hash is removed and fetched once from zero; a 200 that ignores `Range` goes to
  a fresh file, swapped in only after its hash matches, so a good partial is never truncated.
- **Release first, then push.** The install test fails when the release is missing and asserts that
  the first install fetched all 15 files from GitHub (none from Hugging Face). Installs themselves
  still fall back to Hugging Face at the pinned revision (same bytes). `publish-share.js --push`
  refuses changed shipped files under an unchanged version: friends' updaters only take a higher one.
Older installs move over by themselves: the updater installs the model, and on macOS rewrites a
service plist without `pinned_ok` once for the next login. Still fetched at install time outside our
control: uv, its Python and the PyPI packages of `uv sync`. Measured 2026-10-11 on the author's Mac (copies only, the live server
untouched): install from a file mirror of the author's copy, 608.6 MB in 1 s, verify exit 0, re-run
0 MB; a mirror with one flipped byte refused (no marker, the 13 good files kept), then the 2 refused
files fetched from Hugging Face at the pinned revision, a cut at 42.6 MB resumed by a Range request;
a second server on port 8011 from that copy with `HF_HUB_OFFLINE=1` and `HF_ENDPOINT` at a dead port:
ready in 5.5 s, Mỹ Duyên spoke (507 KB WAV, 48 kHz), no Hugging Face line in its log, its only socket
the listener. After the review fixes (same day, same mirror method, the new marker): 608.6 MB in
0.9 s "(GitHub 15 tep)", re-run 0.0 MB, `--quick` 43 ms, verify exit 0; the plist start line on that
copy 33 to 56 ms warm (718 ms on the first, cold run). **The author's machine** runs its own plist (it sets `HF_HOME` by hand, no marker
check), so the marker there only matters if `vieneu-autostart.command` is run again. Its marker,
written 2026-10-11 in the old format (no file list, no VieNeu commit), is no longer current: a start
line would read it as incomplete and go online. To rewrite it (0 MB downloaded):
`~/VieNeu-TTS/.venv/bin/python tools/vieneu-pin.py --install --no-hf`, sandbox off.

**Voice paces (1.5.9).** Every voice in `LOCAL_TTS.voices` now has a measured `sps`. Method, so it
can be redone: 3 lecture sentences per voice through `POST /v1/audio/speech` (pcm, 24 kHz), count
syllables over voiced 20 ms frames (energy within 38 dB of the peak), scale by 0.984 so the 4
voices measured earlier are reproduced (they were, within 4%). Needs the sandbox off for loopback.
`CST_COST.voiceLabel(v)` shows the pace (chậm < 4.4 <= vừa <= 5.2 < nhanh) in all three pickers.

#### Take cleanup and the old pause shaping (1.6.7 to 1.7.2)

**Pauses, hiss, sample rate (1.6.7).** Three causes of the voice stopping where the text has no
break, all fixed: `plainScript` no longer adds a comma at the source speaker's pauses (only after an
opener); `background.js` runs `AUDIO.shapePauses(piece, sr, text)` instead of `compressPauses`, which
matches every internal silence to the text's punctuation by position in voiced time, keeps
sentence 0.4 / clause 0.32 / comma 0.26 s (capped by `maxPause`, so tight mode still works), closes
every other stop to 0.09 s, and leaves one 0.16 s breath per 4.5 s of unpunctuated speech (1.7.6:
the breath rule is gone, see "Prosody model"); and
`buildDubScript({ joinGroups })` (free voice only) reads a sentence that spans two translation groups
as one segment (a split made the model end the first half with a falling tone, then stop). Then
`AUDIO.gateNoise` (removed in 1.7.3, see below) pulled the gaps down 18 dB (Mỹ Duyên's reference hiss: gaps -52.8 -> -64.7 dB).
Requests are 48 kHz: Chrome's pitch-preserving time-stretch roughened a 24 kHz Thục Đoan copy much
more (roughest-decile harmonicity 0.700 -> 0.613 at 1.4x vs 0.669 -> 0.649 at 48 kHz). The server
ignores `speed`, so the browser stretch cannot be avoided. `LOCAL_STYLE_VERSION` 4: all VieNeu audio
re-renders once (free). Temperature 0.4 / 0.6 / 0.8 made no measurable difference to roughness.

**1.6.8 refinements.** Pause shaping v2: a comma's pause grows with the clause before it
(0.14 + 0.012 per word, capped 0.28), is 0.04 shorter before a joining word (và, nhưng, còn...),
and ? / ! rest a little longer (capped by `maxPause`). `gateNoise` now gates only frames within 6 dB
of the take's own noise floor (never above 30 dB under speech) with 60 ms hold: 1.6.7's fixed
threshold altered 2 to 4% of Thục Đoan's speech samples (clipped word tails), now 0 to 0.3%; Mỹ
Duyên's hiss drops 4 to 9 dB instead of 12. Free voices segment with `FREE_SEGMENTS` (`joinGroups`,
`segSoft` 8, `segHard` 11) so fewer sentences are cut into two utterances. `LOCAL_STYLE_VERSION` 5.

**Hiss removal (1.7.1).** `AUDIO.denoise` runs on the whole VieNeu take before it is cut: STFT
(1024 / hop 256 at 48 kHz), per-bin noise power = 20th percentile over frames x 1.6, decision-directed
Wiener gain (a-priori SNR smoothing 0.98) with a -12 dB floor and 3-bin smoothing (no musical noise).
A take with speech/floor over 50 dB is left alone (Thục Đoan ~58 to 60 dB: skipped; Mỹ Duyên ~40 to
41 dB: applied). Measured on Mỹ Duyên: stationary hiss down ~10 dB in the low and high bands, speech
energy change under 0.1 dB, harmonicity unchanged; ~140 ms per 10 s take in the service worker.
Pause shaping measured on 8 Mỹ Duyên sentences with , ; : ? ! : 14/14 punctuation marks matched a
pause, 6 unpunctuated stops closed. `LOCAL_STYLE_VERSION` 6.

**Cleanup and pauses v3 (1.7.2).** Measured on 17 test sentences x 4 takes (Mỹ Duyên x2, Thục
Đoan, Thái Sơn). What the VieNeu path now does, in `splitTtsAudio` order:
`AUDIO.cleanTake` = `highPass` (4th-order Butterworth, `LOCAL_TTS.highPassHz` 80 Hz female / 60 Hz
male, picked by `localHighPass(voice)`) then `denoise`; per piece `shapePauses` then `prepareSpeech`.
- Rumble: Mỹ Duyên's reference carries 20 to 150 Hz noise at almost the same level under the words
  as in the pauses; her voice has nothing under ~130 Hz. 20-60 Hz vs 200-1000 Hz: -45 -> -61 dB.
  Speech bands above 125 Hz unchanged; Thái Sơn loses 0.09 dB at 80-100 Hz.
- Hiss estimate: 1.7.1's 20th percentile x 1.6 per bin sat ~4.5 dB under the true noise, so the
  1-4 kHz hiss between words came down only ~2 dB (4-12 kHz ~4 dB). Now the mean over frames that
  are pure hiss (>= 20 dB under speech, within 6 dB of their median), bias 1.3: gaps -8.5 dB at
  1-4 kHz, -9.6 dB at 4-12 kHz; fricatives 0.0 dB, loud speech -0.1 dB, weak word tails -1.2 dB
  (was -0.7). Flaring-bin index in the gaps 14.6 -> 10.6 (raw 9.7). 97 -> 75 ms per take.
- The gate (`gateNoise`) is off the path: after the fix it took only ~1.5 dB more off the gaps and
  made the floor rise and fall with the words. Removed in 1.7.3.
- Pauses (**replaced in 1.7.6** by `dub-prosody.js`, kept here as history): `textBreaks` added soft breaks before clause openings (`STARTERS2`, `STARTERS1`, weak "và"
  / "hoặc") when the clause before has >= 5 words (6 for weak) and >= 3 (4) follow. Only a real
  stop of the voice (>= 0.12 s) near one keeps 0.1 + 0.008 per word (max 0.2); the voice stopped
  there on every clause opening of the test set, and 1.7.1 closed those stops to 0.09 s, the
  run-on reading. A full stop rests 0.28 + 0.01 per word of its sentence (cap 0.4), ? +0.05, !
  +0.03, never past `maxPause`. Positions count spoken syllables (`spokenWeight`) from the first to
  the last sound (the lead silence used to push a first-word comma out of tolerance). Breaths only
  at stops >= 0.2 s. Durations: -2.3% total on the 130 s lecture (shorter sentence pauses).
- Onset: a take whose first 5 ms is already voiced (Thái Sơn 14/17, Thục Đoan 5/17, Mỹ Duyên 0/34)
  gets a 20 ms fade-in instead of 8 ms.
- Engine: `gapAfter(plan)`: a part of a running sentence that ended on , ; : is followed after
  `SYNC.joinGapClause` 0.15 s (was 0: the comma's rest was trimmed away with the take's tail).
- Not changed, measured fine: loudness per take (LUFS sd 0.2 to 0.3 dB within a voice, -20.3 avg
  for all four), the soft clipper (10/68 takes touch it, added distortion under -56 dB), DC
  (< 1e-3), sample rate (48 kHz native, no resampling). No EQ: Mỹ Duyên's 2-8 kHz balance is within
  1.5 dB of Thục Đoan's. `LOCAL_STYLE_VERSION` 7.
- 1.7.5 (history, replaced in 1.7.6): adjunct openers `ADJUNCTS2` ("dựa trên", "dựa vào", "bằng cách", "thông qua", "nhờ vào",
  "theo đó") are soft breaks too, but never after a pronoun (they are also verbs: "chúng ta dựa vào")
  and only with 3 more words after them. A/B on the same real Mỹ Duyên takes (5 each): the voice
  stopped 0.26 to 0.43 s before "thông qua" and "bằng cách" every time; kept 0/10 before, 10/10 now
  (0.16 to 0.2 s). A long sentence with no opener at all still reads in one run (a 22-syllable one,
  0 of 3 takes paused): not changed, it needs listening first. `LOCAL_STYLE_VERSION` 8.
  `tests/speech-bench.live.js` re-measures the 12-sentence set on the live server.

### Gemini TTS (paid)

`POST` to `GEMINI_BASE` with `responseModalities: ["AUDIO"]` and a prebuilt voice name; the reply
carries `candidates[0].content.parts[].inlineData`. Several segments are synthesized in one call
and cut apart with `dub-audio.js` `splitBySilence`, then **persisted to cache before replying**, so
a service-worker death does not lose paid audio. A timeout marks plans failed with no retry,
because the call may already have been billed.

### Web Speech (fallback, free, live)

No buffer, so it runs the `tickLive` path. Quality and pacing control are much weaker.

## Cache (`cst-cache.js`)

IndexedDB database `cst-cache`, stores `tr` and `audio`, each with a separate `<store>_meta` store
so LRU touches do not rewrite the WAV blob. Falls back to an in-memory backend if IndexedDB is
unavailable.

Keys are SHA-256 over the content-determining fields only, **never the video id**, so identical
audio is reused across videos. The audio key includes the style version, model, voice, text,
intent, emphasis and a pace bucket.

Budgets: `tr` 30MB, `audio` 3 GB (2.4.0, `background.js` `AUDIO_CACHE_MAX_BYTES`; 200MB held 3 videos at ~61 MB each); memory tier 400 entries for `tr`, 24 for `audio`. Eviction is
LRU plus version-mismatch victims, down to 85% of the cap. A single item larger than half the cap
is not stored. Reads time out at 1500ms and writes at 3000ms, degrading to a cache miss rather than
blocking playback. `dubbing.js` keeps a small page-side mirror; per-video purge goes through
`audioKeysForVideo`.

Lookups before paying (1.7.4). `schedule` looks up the segments a batch may take past the prefetch
window (`SYNC.batchSpill`) before it builds the batch, and never puts a segment that was not looked
up into a paid batch: a revisit used to pay again for a stored segment sitting right after an
unheard stretch. Only for a batching provider; VieNeu (`maxBatch: 1`) sets `tightPauses`, part of
its key, when a segment enters the window. The translation store is looked up for the chain's first
model and every later model priced at or above it (`handleTranslateUnit`): when the first model is
rate-limited the next one translates and saves under its own key.

## Testing dubbing without a video

`tests/dub-sim.js` gives you a virtual clock plus fake video, audio and speech objects, so a
20-minute video simulates in milliseconds and deterministically. `tests/dub.test.js` and
`tests/cost.test.js` use it. Real-audio checks use the WAV fixtures in `tests/audio/`. For a real
`HTMLAudioElement`, open `tests/harness/dub.html` in Chrome. See `TESTING.md`.
