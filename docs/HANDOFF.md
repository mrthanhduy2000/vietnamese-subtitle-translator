# Handoff (2026-10-23, 2.9.0)

## State
- 2.9.0: +16 names from saved videos (2026 devices, two players). Sports and tech are near-saturated.
- 2.8.9: glossary grows by 55 (44 media outlets and apps in "press", 11 tech and games in "tech");
  glossary-data.js ~35,100 lines; kept-English names 13,974 (`glossary-pron.js` read Vietnamese 0).
- Audit regression fixed: 14 names had no reading ("CI/CD", "async/await", "AC/DC"...). Hand
  readings in `MANUAL_SAY` now go first; letter-led names are kept before `cleanText` ("/" -> "hoặc").
- Bare "4K"/"8K" are NOT read in English on purpose: in Vietnamese they are money (8K = 8 nghìn). The
  audit counts them as "money shorthand left as Vietnamese" (7 terms). "401k" stays English.
- `npm test` 761 pass, 0 fail. `regress.js`: 0 numbers moved vs 2.8.8. `pron-eval` unchanged.

## Traps
- A name the writer cannot respell gets no reading: check `GLOSSARY_SAY` after `--write`. Merge keeps
  an old entry for any term still in the list, so remove a bad line from the generated block first.
- `$TMPDIR/fix.py` removes by core term in every block of `glossary-data.js`: check the removed count.
- New glossary blocks let everyday words in (list in `tests/glossary.test.js`). A capitalised English
  word ("Wired") needs the `~` prefix.
- Write `glossary-data.js` with Bash `cat >>`, never Read/Write.
- Driver pages: open `yt-driver.html` in its own window, not `open_url`; reload kills a run.
- `playback-sim.js` `run(..., { keepStarted: true })` returns every start; hook `DubEngine.prototype.note`.
- `seekWhileSlow` varies 15/7 or 16/6; the timing tests fail during a driver batch. New YouTube ids:
  `curl` the results page (node fetch ignores the proxy), parse `ytInitialData`.

## Unfinished
- Not heard: 2.6.9-2.8.9 by ear (tôi/mình mixing at video start).
- Uploaded Vietnamese tracks (shown as is, never saved by design, driver logs "NOT SAVED"):
  jFZksJqL1Vc XnQ7Py8D6v0 MebK9iEUzQA JwBuHx_3GOU rm_9cPXrv4A gN07gbipMoY nBN9zG1JNPg O_MQr4lHm0c
  c347oYQO57A PweksFQGzmI Bwe7zLSPtXA h0I4083Bm9s dGCdYtk9fHQ nDg7NumntYc E8UKIJ2rLjg RCPS2VC3lk4
  MmQp4PkvXV4 w7kz2lI1IMw.
- Coursera has no fallback heal (a revisit asks again).
- Carried over: prompt 3 and the >> split on a real reading (BACKLOG 44); 2.6.5-2.6.8 not checked
  live; `screen-text.js` never ran; share repo promotion of 2.5.7-2.8.8 after a green install
  test; BACKLOG 43-47; 2.5.7 shortcuts on YouTube; joint-takes branches; 2.5.0 Coursera start hold;
  CI gaps; voice items "có nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo. Never ask about Chrome's Apple Events setting.

## Traps
- Open a driver page in a window of its own: one opened with `open_url` lands in the user's window
  and dies when they close it, leaving dubbing off (open `yt-driver.html` without ids to put it back).
- Reloading the extension closes every extension page: a driver run in progress dies with it.
- `playback-sim.js` `run(..., { keepStarted: true })` returns every start; hook
  `DubEngine.prototype.note` for drop reasons. An old engine must sit in the repo dir to load.
- Scenario `seekWhileSlow` gives 15/7 or 16/6 run to run; the two analysis timing tests fail while
  Chrome runs a driver batch: rerun before blaming a change.
- New YouTube ids: `curl` the results page (node fetch ignores the proxy), parse `ytInitialData`.
