# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-27 · lane B (`dub-prosody.js`, `dub-speech.js`) + D (`tools/build-speech-tables.js`, tests)
· `1.8.2`. User asked: smarter pronunciation / prosody, local only, zero API spend, preserve first.

## What changed
- Prosody, small rules in existing functions: result "nên", "so với" after a quantity, short relative
  "mà", long last list item, short purpose clause soft. `DUBBING.md` "Constituent refinements (1.8.2)".
- Respellings from the local VieNeu front end: ben, kim, leo, nan, ton; "ben"/"kim" in `NAME_WORDS`,
  "ben" in `EN_GIVEN`. Old entries and the CAPS tables unchanged.
- Blind split 2 by a separate agent, frozen unread at 30c6076, scored once. Old blind failures moved
  into dev (`prosody-corpus.js` syntax2, `speech-corpus.js` d89-d96).
- No API call of any kind this session (only the local g2p and the local VieNeu server).

## State
- `npm test`: 485 pass, 0 fail, 1 skip · Reload: **yes** + F5 video tabs. Changed VieNeu lines
  re-render once (free). Paid key and translation key untouched (golden tests).
- Numbers are proxies (phonemes, text marks, real-take stops); nobody has listened to 1.8.0-1.8.2.

## Unfinished / in progress
- `BACKLOG.md` 30: blind 2 failures (comparative "như", "công ty | đã", pronoun rule inside a result
  clause, "lỗi | khi", Long Beach, Raspberry Pi). Move into dev, then blind split 3 by a new agent.
- `BACKLOG.md` 31: short purpose clause now read in one breath; reverses the 1.8.0 ruling's feel.
  Ask the user after they listen.
- Carried over: `BACKLOG.md` 14, 15, 16, 18, 19, 20, 21-24, 26-28; 1.7.2 to 1.8.2 not verified end to
  end in real Chrome; 1.7.9 duck fix not confirmed by the user; Udemy / edX (`BACKLOG.md` 9).

## Traps hit this session
- `build-speech-tables.js` only searches words `isVietWord` accepts, and "ben"/"ken" targets have no
  English-only phoneme: MANUAL now also accepts a reading that differs from the plain Vietnamese one.
- "Ken" reads kɛn in both languages; `pron-eval` flags it anyway. Do not respell to please the scorer.
- `prosody-eval --old` swaps only `dub-audio.js`: for an old/new prosody A/B, run it from a
  `git archive HEAD` copy with the new corpus copied in (takes are shared in ~/.cache).
- `npm test` prints a sandbox registry warning; harmless, tests run offline.

## Suggested next step
- Reload, dub a video with Ben / Kim / Leo names and a talk with "để" / "nên"; listen first for any
  Vietnamese name read English, then for sentences that now run on too long.
