# Handoff (2026-10-17, 2.5.8)

## State
- 2.5.8: brand and AI names in dubbing and translation. `dub-speech.js`: VieNeu spells every all-caps
  code of 5+ letters it lacks a dictionary word for (WHOOP "vê kép hát ô ô phê", SAMSUNG, GARMIN);
  the old code assumed it read them as words. `capsClass` says "spelled" past 4 letters, caps shape
  reaches 12 letters, and `wordShaped` codes (NIKE, LEGO, WHOOP...) go out as `<en>whoop</en>`.
  INITIALISMS (UCLA, USDA, HTTPS), Vietnamese syllables and codes the English source lacks are
  untouched. Lexicon respellings for Qwen, Groq, xAI, NotebookLM, DALL-E, Oura, Huawei, Xiaomi,
  GoPro, CRISPR, NGINX. `PRONUNCIATION_VERSION` 1.9.0. Details: `DUBBING.md` "Word-shaped caps".
- `glossary.js`: wearables (WHOOP, Oura Ring, Garmin, Strava, Fitbit, Apple Watch, Peloton, sleep /
  recovery / readiness scores), newer AI products (Veo, Imagen, Nano Banana, Kling, Runway,
  ElevenLabs, Suno, Codex, Gemini CLI...) and AI phrases (reasoning model, test-time compute, vibe
  coding...). Normalize turns a lowercase "my whoop" / "whoop strap" into WHOOP, not "a whoop of joy".
- Measured: `pron-eval` dev 123 -> 128 of 131 (d104-d109 new), validation 39/42 unchanged.
  `npm test` 706 pass, 0 fail, 1 skip. regress: one tick, UIy-WQCZd4M late 921 -> 922 (rendered
  text of a few lines changed length), baseline saved at 2.5.8.
- 2.5.7 (keyboard shortcuts set by the viewer) and 2.5.6 cost changes: see git log, `SUBTITLE.md`.

## Traps
- `vieneu-g2p.py {"normalize": [...]}` on a bare word lowercases it and hides the spelling; test a
  code inside a carrier sentence ("Tôi thích WHOOP lắm.") through the full path.
- `pron-eval`'s judge calls the English letter "M" (ɛm) Vietnamese; NotebookLM is a unit test only.
- Glossary: "runway" is already a lowercase business term, so "Runway" is protected at a sentence
  start too. Duplicate check is case-insensitive per group ("WHOOP" and "Whoop" cannot both be terms).
- Opening a page in the user's Chrome takes over the tab they are watching; lab runs only when they
  are not watching. Daily budget 200,000 đ since 2026-10-16.
- `~/.claude/projects/.../memory` is outside the Bash sandbox: write memory with Edit/Write.

## Unfinished
- Not heard live yet: WHOOP and the respellings were checked on phonemes, not in a real take
  (`tools/speech-ab.js`, the user runs VieNeu renders).
- BACKLOG 44 (next: read the 30 videos with `--sentences`, about 0.05 USD), 45, 46, 47.
- Carried over: 2.5.7 shortcuts not yet tried on YouTube itself; share repo promotion of 2.5.7/2.5.8
  after a green install test; joint-takes branches; the 2.5.0 Coursera start hold not yet seen live;
  CI gaps (VC++ runtime, browser steps, a Vietnamese Windows profile); voice items "có nghĩa là",
  DN, NHNN; BACKLOG 43; `ban-giao.md` does not mention the share repo.
- Never ask the user about Chrome's Apple Events setting.
