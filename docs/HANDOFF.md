# Handoff (2026-10-23, 2.9.4)

## State
- 2.9.4 (lane A, content.js): Coursera and generic pages keep each translated lecture whole:
  `cscache1_<host><path>` `{ luc, fp, vi }`, index `cscacheIdx` (newest 200). A revisit with the same
  fingerprint (group text + start times) goes to `applyTranslation`, no request. `SUBTITLE.md` item 11.
  Google-fallback windows are healed like YouTube (`csHealFallbacks`, 3 rounds, 20/40/60 s, skips a
  window playing or due in 15 s); a lecture is saved only when none is left. `background.js`
  `localCacheBytes` counts `cscache` keys so the Settings cache clear removes them.
- 2.9.3 (other session, youtube.js): `ytFindUsableTrack` walks up to 4 other tracks when the first is
  blank or a broken ASR; a blank XML body is blank too. The 2 bn vlogs stay untranslatable.
- 2.9.2: glossary 55,276 terms from model memory (expect some errors); 14 names still read
  Vietnamese by VieNeu (Temodar, Nissan Teana, Ram 1500 ...). Bare "4K"/"8K" stay Vietnamese on purpose.
- Both 2.9.3 and 2.9.4 were done in cloud sessions with no `review-archive`: `regress.js` NOT run.

## Traps
- `pageEnv` (audit.test.js) objects come from another vm realm: spread into a local array before
  `deepEqual`. The fake answer "Dịch: <English>" is cut as a leak: compare screen text between runs.
- A name the writer cannot respell gets no reading: check `GLOSSARY_SAY` after `--write`. Write
  `glossary-data.js` with Bash `cat >>`, never Read/Write.
- Driver pages: open `yt-driver.html` in its own window; reloading the extension kills a run.
- `seekWhileSlow` gives 15/7 or 16/6; timing tests fail during a driver batch: rerun first.
- New YouTube ids: `curl` the results page (node fetch ignores the proxy), parse `ytInitialData`.

## Unfinished
- On the Mac: `node tools/regress.js` (then `--save`) for 2.9.3 and 2.9.4; try a Coursera lecture
  twice (hit path, voice starting from a saved lecture, how often fallbacks heal).
- Saved Coursera lectures are not in `tools/review.js` (reads `ytcache4_` only).
- Not heard: 2.6.9-2.8.9 by ear (tôi/mình mixing at video start).
- Uploaded Vietnamese tracks never saved by design (driver logs "NOT SAVED"): jFZksJqL1Vc XnQ7Py8D6v0
  MebK9iEUzQA JwBuHx_3GOU rm_9cPXrv4A gN07gbipMoY nBN9zG1JNPg O_MQr4lHm0c c347oYQO57A PweksFQGzmI
  Bwe7zLSPtXA h0I4083Bm9s dGCdYtk9fHQ nDg7NumntYc E8UKIJ2rLjg RCPS2VC3lk4 MmQp4PkvXV4 w7kz2lI1IMw.
- Carried over: prompt 3 and the >> split (BACKLOG 44); 2.6.5-2.6.8 not checked live; `screen-text.js`
  never ran; share repo promotion of 2.5.7-2.8.8 after a green install test; BACKLOG 43-47; 2.5.7
  shortcuts on YouTube; joint-takes branches; 2.5.0 Coursera start hold; voice items "có
  nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo. Never ask about Chrome's Apple Events setting.
