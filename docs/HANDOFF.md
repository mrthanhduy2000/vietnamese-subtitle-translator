# Handoff (2026-10-18, 2.6.0)

## State
- 2.6.0: glossary 14,064 -> 24,911 terms, 35 -> 52 groups (people, brands, places, music, drinks,
  outdoors, engineering, accounting...; plus product models, cars, schools, landmarks, creators,
  athletes, beauty and fashion jargon). Data only in `glossary-data.js` (~27,500 lines, ~620 KB).
- Glossary bridge into the voice: `dub-speech.js` `loadGlossaryNames()` turns every kept-English
  term into a lexicon unit (cat `glossary`); `GLOSSARY_SAY` (generated, 416 entries) holds readings
  for names VieNeu's G2P reads as Vietnamese. `tools/glossary-pron.js` audits it (`--show=N`) and
  regenerates it (`--write`). 11,684 kept names: 496 read Vietnamese without the bridge, 98 with.
  `VI_CAPS` codes (SSI, VTV) are excluded. `adaptForSpeech`: `&` between English words -> "and".
  Initials inside a name (Samuel L. Jackson, e.l.f.) -> English letters. Docs: DUBBING.md bullet
  "The glossary bridge (2.6.0)".
- Load: glossary 23 ms, speech init with the bridge 35 ms (Node). 1.86 protected terms per window
  on the 74-video set (was 1.47).
- `npm test` 715 pass, 0 fail, 1 skip (new `tests/glossary-speech.test.js`, own process);
  `pron-eval --old=HEAD` unchanged (dev 128/131, validation 39/42); regress 0 moved, saved at 2.6.0.

## Traps
- After appending names, rerun `node tools/glossary-pron.js --write`; the test fails on a stale
  `GLOSSARY_SAY` key. The tool merges with the existing table, it never drops a reading.
- A lowercase entry matches any case: Fossil, Peacock, Nirvana, Half-Life, Decathlon all collided
  with lowercase renderings this time. Scan: for every lowercase key with `vi`, look for a
  capitalised kept form of the same key in any group (the scan script was in $TMPDIR, rewrite it).
- Every new block let common words in (foundation, period, momentum, commit, fork, highlights,
  weights, base...). `tests/glossary.test.js` everyday list catches only what it names; extend it.
- Capitalised dictionary words need `~` (the test checks `/usr/share/dict/words`), but a `~` line
  cannot carry a rendering: drop the name or lowercase it.
- Write data with Bash `cat >>`, never Read/Write on `glossary-data.js` (the echo doubles tokens).

## Unfinished
- The user asked for "vài chục ngàn" more terms; this turn added ~10,850. More can follow the same
  way (more product lines, songs and albums, local Vietnamese brands, more domain jargon).
- Translation quality with the big glossary not measured on Gemini (needs a paid run).
- 2.5.8 and 2.6.0 respellings checked on phonemes only, not heard in a real take.
- BACKLOG 44 (next: read the 30 videos with `--sentences`, about 0.05 USD), 45, 46, 47.
- Carried over: 2.5.7 shortcuts not tried on YouTube itself; share repo promotion of
  2.5.7-2.6.0 after a green install test; joint-takes branches; the 2.5.0 Coursera start hold not
  seen live; CI gaps (VC++ runtime, browser steps, a Vietnamese Windows profile); voice items
  "có nghĩa là", DN, NHNN; BACKLOG 43; `ban-giao.md` does not mention the share repo.
- Never ask the user about Chrome's Apple Events setting.
