# Handoff (2026-10-24, 3.0.7)

## Security pass (2026-10-24, lane D, tools only)
- Audited install scripts, manifest, messaging, localhost VieNeu, key storage, innerHTML: only two real gaps. Fixed: voice server refuses non-loopback Host and non-extension Origin (`_LoopbackOnly` in the patched `openai_speech.py`, patch regenerated against the pinned commit); Windows installer checks the Microsoft signature of vc_redist before the elevated run.
- Accepted, not changed: uv installed via vendor `curl | sh` (unpinned), key lives in storage.sync (syncs to the Google account, by design), share zip comes from public `main`. Reaches users only after `publish-share.js --stage/--promote` on the Mac.

Audit 2026-10-24: `npm test` 934 pass, 0 fail; BACKLOG holds only items that need the Mac, an ear or paid calls. LaunchAgent install below is still not done (auto mode blocked it from the remote session).

## UX/UI review fixes (2026-10-23, lanes A/C, docs/changes/ux-review-fixes.md)
- Done: toast length + warn mark, popup contrast, popup Tắt button + readiness line, welcome card removed, VieNeu box per OS, sidebar fade. `tests/ux-review.test.js`.
- NOT done (BACKLOG candidate): the on-player menu is written twice (`youtube.js` ~1892-2090, `content.js` ~2300-2480); merge into `player-ui.js` only when next editing the menu.

## Auto-update of the author's git checkout (2026-10-23, lane D, tools only)
- `tools/git-autoupdate.js`: ff-only to origin/main when on main, tree clean, no browser running (Chrome reads the folder at start, so no Reload). `--install` adds LaunchAgent `com.damduy.dichphude.gitupdate` (login + 30 min, log `~/Library/Logs/dichphude-gitupdate.log`). Tests: `tests/git-autoupdate.test.js`.
- TO DO ON THE MAC (cloud cannot): `node tools/git-autoupdate.js --install`, check the log once git auth works from launchd. The share package never carried `tests/harness` (`share.test.js` now pins it); the Mac checkout does load it, since Chrome takes the whole folder.

## Why Windows installs got 2.5.7 (2026-10-23)
- This repo is private. Friends and AIs install from the PUBLIC share repo `dich-phu-de-long-tieng`, whose main still holds 2.5.7 (never promoted since). Fix = `node tools/publish-share.js --stage`, install test green, `--promote` (needs gh + both clones, run on the Mac). Not done: outward-facing, waiting for the user's go.
- Added `.github/workflows/release.yml` (tag vX.Y.Z + zip release when manifest version is new on main) and an update section in `docs/HUONG-DAN.md`. The private repo's releases are only visible when signed in.

## Site adapters thread (TED)
- `site-adapters.js` + `site-ted.js` (docs/changes/site-adapters-ted.md). Offline tests pass. TRY ON CHROME:
  open a ted.com/talks page, click Translate in the popup. Unknown until then: whether the
  `fetch` to hls.ted.com from the content script passes CORS (if not, route through background.js and add
  the host permission) and whether `__NEXT_DATA__` still carries `playerData.resources.hls.stream`.
- Udemy, edX, Vimeo embeds still open (BACKLOG 9).

## TED auto (PR #46)
- ted.com auto-translates on arrival; verify on the Mac: button/menu on TED's player, voice, SPA move to the next talk. Vietnamese track from TED is not shown by us (notice only).

## State
- unreleased (lane A/D): bent glossary codes (`[[T0]]`, `[__T0__]`...) are restored and a window whose model wrote
  the terms itself is kept (`docs/changes/bent-glossary-codes.md`). Check the Mac console warning count.
- Voice from existing Vietnamese captions (docs/changes/dub-from-vietnamese-captions.md, SUBTITLE.md last section): Coursera/TED/generic only; YouTube already did it. TRY ON CHROME: a TED talk with en+vi tracks, click the toast button or Giọng đọc. Offline tests only (`tests/vi-voice.test.js`).
- Weak machines (lane B/D, no bump, `docs/changes/weak-machines.md`): `dub-hardware.js` toast offers the video
  speed a slow voice keeps up with (0.8/rtf); `SYNC` untouched (look-ahead made no difference in the sim);
  `install-mac.sh` reads the chip via `hw.optional.arm64`, Intel voice opt-in `DPD_INTEL_VOICE=1`,
  `.github/workflows/intel-voice.yml` times it on macos-15-intel. Details: `DUBBING.md` "A weak machine".
- Unreleased (lane B, BACKLOG 48, `docs/changes/loose-line-pauses.md`, DUBBING.md "Loose lines hand
  spare time"): a line that would end 1 s+ early at its floor pace asks for longer punctuation pauses
  (`looseSlack`, `pauseSlack`, `shapePauses opts.slack`, key `slack<step>`). 101 videos: silences
  >= 1.5 s while the source talks 1,439 -> 1,260, late > 0.5 s 1,603 -> 1,580. Not heard by ear.
- unreleased (lane A, loose brand match): inner-capital brands match in lower case, minus 49 English-word
  collisions (`docs/changes/loose-brand-match.md`). Regenerate the skip list after big glossary releases.
- unreleased (lane A/D, glossary protection): the window cache key no longer holds protected terms or codes
  (`SUBTITLE.md` "Protected glossary terms and the window cache"); matcher buckets warm up in idle slices
  (first `protectGlossary` 50-80 ms -> ~2 ms). `tests/glossary-cache.test.js`. `regress.js` not run.
  Lowercase-brand gap, not loosened: `BACKLOG.md`.
- 3.0.2 (glossary, cloud): `tools/glossary-filter.py <first-line> --names=<nltk names> --write` dropped ~660
  everyday words and history names that hid Vietnamese renderings from the 2.9.2 and 2.9.5 batches
  (~2,300 false hits gone on 3.2M words). Run it on every new batch before merging. 14 VieNeu names
  (Temodar, Nissan Teana, Ram 1500...) still need `MANUAL_SAY` + `glossary-pron.js --write` on the Mac.
- 3.0.1 (lane A/C, notices): `CST_UI.explainError` (content.js) maps a raw failure to one Vietnamese
  sentence plus an optional action button (reload / open Settings); Coursera "Dịch thất bại" and
  YouTube "Không dịch được" use it (YouTube auto mode still only logs). Progress "Đang dịch x/y đoạn"
  now shows in the popup and both on-player menus. Toasts replace each other, so no stacking.
  Not done: dubbing.js toasts and VieNeu messages were not reworded; "Thread Rà lỗi tiềm ẩn" owns error handling.
- 3.0.0 (lane A/C): `CST_STYLE.legibilityIssue` + `#legibilityHint` in Settings preview warns on same-colour
  box or no box and no outline. Warning only. Not seen live.
- 2.9.9 (lane A, overlay UX): `CST_STYLE.overlayFontPx` (12 px floor, one size formula for YouTube and
  Coursera), `overlayTransition` (honours prefers-reduced-motion; Coursera now animates `top` too).
  Not seen on a live page; click Reload and check a narrow/mini player.
- 2.9.8 (UI contrast) and 2.9.7 (`stripAddedFormatting`, `sanitizeModelOutput`): see git log.
- 2.9.5 (lane B/D, glossary): +34,700 names from 50 topic drafts (`scratchpad/cands3`), 73,270
  candidates in total, mostly unverified. About 181 still read Vietnamese by VieNeu. Spot-check short
  source files: esports 86 lines, fitness 125, board games 352, supplements 515.
- 2.9.4 (other session, lane A, content.js): Coursera and generic pages keep each translated lecture
  whole (`cscache1_<host><path>`, index `cscacheIdx`, newest 200). Google-fallback windows are healed
  like YouTube (`csHealFallbacks`). `SUBTITLE.md` item 11.
- 2.9.3 (other session, youtube.js): `ytFindUsableTrack` walks up to 4 other tracks when the first is
  blank or a broken ASR. The 2 bn vlogs stay untranslatable.
- Bare "4K"/"8K" stay Vietnamese on purpose (in Vietnamese they are money). "401k" stays English.
- 2.9.4 (glossary) and 2.9.5 were done in a cloud session: `regress.js` NOT run here.

## Traps
- `regress.js` has no SYNC override: for an off/on diff, set the value off in a scratch worktree,
  `--save` there (its own copy of `review-archive/`), restore, rerun. Never `--save` main's copy from a branch.
- A synthetic lecture repeats its sentences: a key that depends on the measured pace re-renders the
  repeat. Memoise such a decision by words, not by start (`looseSlack`).
- A plan object re-made by a refresh has `slackPauses`/`tightPauses` unset until it re-enters the
  window: the simulator asks `eng.looseSlack` for the key it was made under.
- VieNeu at 127.0.0.1:8000 is unreachable from the sandbox: hand the user a command that writes files.
- A name the writer cannot respell gets no reading: check `GLOSSARY_SAY` after `--write`.
- Write `glossary-data.js` with Bash `cat >>`, never Read/Write. A capitalised English word needs `~`.
- `pageEnv` (audit.test.js) objects come from another vm realm: spread before `deepEqual`.
- Driver pages: `yt-driver.html` in its own window; reloading the extension kills a run.
- `seekWhileSlow` gives 15/7 or 16/6; timing tests fail during a driver batch: rerun first.

## Unfinished
- Intel voice works in CI with `onnxruntime<1.24` (rtf 1.5-1.8, 4-core runner). Hear it on a real Intel Mac
  before making it the default.
- On the Mac: `node tools/regress.js` (then `--save`) for 2.9.3 to 3.0.7; try a Coursera lecture twice; 14 VieNeu names
  (Temodar, Nissan Teana, Ram 1500...) need `MANUAL_SAY` + `glossary-pron.js --write`.
- Spot-check the drafted names (esports, fitness, board games, supplements) and fix the ~181 residual
  Vietnamese readings via `MANUAL_SAY`. Not yet 100,000 terms.
- BACKLOG 48: render the A/B takes (`node /private/tmp/claude-501/b48ab/render.js` on the Mac), shape
  them (`$TMPDIR/b48shape.js`), listen. After merge, `node tools/regress.js --save` on main.
- Saved Coursera lectures are not in `tools/review.js` (reads `ytcache4_` only).
- Not heard: 2.6.9-2.8.9 by ear (tôi/mình mixing at video start).
- Uploaded Vietnamese tracks never saved by design: jFZksJqL1Vc XnQ7Py8D6v0 MebK9iEUzQA JwBuHx_3GOU
  rm_9cPXrv4A gN07gbipMoY nBN9zG1JNPg O_MQr4lHm0c c347oYQO57A PweksFQGzmI Bwe7zLSPtXA h0I4083Bm9s
  dGCdYtk9fHQ nDg7NumntYc E8UKIJ2rLjg RCPS2VC3lk4 MmQp4PkvXV4 w7kz2lI1IMw.
- Carried over: BACKLOG 43-47 and 44 (prompt 3, >> split); 2.6.5-2.6.8 not checked live;
  `screen-text.js` never ran; share repo promotion after a green install test; 2.5.7 shortcuts on
  YouTube; joint-takes branches; 2.5.0 Coursera start hold; coverage gaps (youtube.js, content.js,
  dubbing.js lowest); voice items "có nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo.
  Never ask about Chrome's Apple Events setting.
