# Handoff (2026-10-23, 2.9.5)

- Test-only change after 2.9.4 (no bump): GitHub Actions `test.yml`, `tests/units.test.js`, `npm run coverage`.

## State
- 2.9.5 (lane B/D, glossary): +34,700 names from 50 topic drafts (`scratchpad/cands3`), 73,270
  candidates in total. Drafted from memory, mostly unverified. About 181 still read Vietnamese by
  VieNeu (writer LEFT list). Short source files need a spot-check: esports 86 lines, fitness 125,
  board games 352, supplements 515.
- 2.9.4 (other session, lane A, content.js): Coursera and generic pages keep each translated lecture
  whole (`cscache1_<host><path>`, index `cscacheIdx`, newest 200). Google-fallback windows are healed
  like YouTube (`csHealFallbacks`). `SUBTITLE.md` item 11.
- 2.9.3 (other session, youtube.js): `ytFindUsableTrack` walks up to 4 other tracks when the first is
  blank or a broken ASR. The 2 bn vlogs stay untranslatable.
- Bare "4K"/"8K" stay Vietnamese on purpose (in Vietnamese they are money). "401k" stays English.
- 2.9.4 (glossary) and 2.9.5 were done in a cloud session: `regress.js` NOT run here.

## Traps
- A name the writer cannot respell gets no reading: check `GLOSSARY_SAY` after `--write`. Merge keeps
  an old entry for any term still in the list, so remove a bad line from the generated block first.
- `$TMPDIR/fix.py` removes by core term in every block of `glossary-data.js`: check the removed count.
- New glossary blocks let everyday words in (list in `tests/glossary.test.js`). A capitalised English
  word ("Wired") needs the `~` prefix.
- Write `glossary-data.js` with Bash `cat >>`, never Read/Write.
- `pageEnv` (audit.test.js) objects come from another vm realm: spread into a local array before
  `deepEqual`.
- Driver pages: open `yt-driver.html` in its own window; reloading the extension kills a run.
- `seekWhileSlow` gives 15/7 or 16/6; timing tests fail during a driver batch: rerun first.

## Unfinished
- On the Mac: `node tools/regress.js` (then `--save`) for 2.9.3 to 2.9.5; try a Coursera lecture twice.
- Spot-check the drafted names (esports, fitness, board games, supplements) and fix the ~181 residual
  Vietnamese readings via `MANUAL_SAY`. Not yet 100,000 terms.
- Saved Coursera lectures are not in `tools/review.js` (reads `ytcache4_` only).
- Not heard: 2.6.9-2.8.9 by ear (tôi/mình mixing at video start).
- Uploaded Vietnamese tracks never saved by design (driver logs "NOT SAVED"): jFZksJqL1Vc XnQ7Py8D6v0
  MebK9iEUzQA JwBuHx_3GOU rm_9cPXrv4A gN07gbipMoY nBN9zG1JNPg O_MQr4lHm0c c347oYQO57A PweksFQGzmI
  Bwe7zLSPtXA h0I4083Bm9s dGCdYtk9fHQ nDg7NumntYc E8UKIJ2rLjg RCPS2VC3lk4 MmQp4PkvXV4 w7kz2lI1IMw.
- Carried over: prompt 3 and the >> split (BACKLOG 44); 2.6.5-2.6.8 not checked live; `screen-text.js`
  never ran; share repo promotion of 2.5.7-2.8.8 after a green install test; BACKLOG 43-47; 2.5.7
  shortcuts on YouTube; joint-takes branches; 2.5.0 Coursera start hold; coverage gaps in TESTING.md; voice items "có
  nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo. Never ask about Chrome's Apple Events setting.
