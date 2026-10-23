# Handoff (2026-10-23, 2.9.7)

## State
- 2.9.7 (lane D, glossary): +140 specialist terms (AI/ML, software, finance, medicine, science,
  statistics) in a block at the end of `glossary-data.js`. Probe of ~520 terms: 80% of mainstream
  jargon was already present, ~70% of deeper jargon; only the missing ones were added.
- Existing renderings win on conflict (e.g. "đa xơ cứng", "ảo giác của AI"); 40 variants differ
  only in wording, none changed.
- Renderings come from model knowledge (vi.wikipedia titles, textbook usage); web search could only
  confirm "phương sai thay đổi". Not verified by a native medical or finance reviewer.
- VieNeu readings of the new `=` and acronym terms NOT measured (Mac only): run
  `node tools/glossary-pron.js --write` there.
- 2.9.3-2.9.6 notes from earlier sessions: `regress.js` still not run since 2.9.3.

## Traps
- Single everyday words stay out (guard list in `tests/glossary.test.js`); lowercase kept terms need `=`.
- Ambiguous acronyms (PSA, EMA, ACH, PPO) were deliberately left out.
- Write `glossary-data.js` with Bash `cat >>`, never Read/Write.

## Unfinished
- On the Mac: `node tools/regress.js` then `--save`; `glossary-pron.js` for the new terms.
- Spot-check drafted names (esports, fitness, board games, supplements); ~181 names still read Vietnamese.
- Carried over: BACKLOG 43-48, 2.6.9-2.8.9 by ear, Coursera lectures not in `tools/review.js`.
