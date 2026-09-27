# Vietnamese Subtitle Translator (Coursera + YouTube)

Chrome MV3 extension: translates Coursera/YouTube subtitles into Vietnamese with Gemini, plus AI
dubbing. **`manifest.json` holds the real version** (the folder name `v1.0.4` is stale, and so is
any version number written into a doc: never hardcode one here). No bundler, no
dependencies, no build step: these source files *are* the extension, loaded unpacked in Chrome
"Profile 42", id `lpknjhmnlocilmkmooomffknibghibao`. All source sits flat in the repo root. Code
comments, UI strings and test names are Vietnamese.

## Session start, in this order

1. `git log --oneline -5 && git status --short` -> what the last session did. Far cheaper than
   re-reading files to guess.
2. `docs/HANDOFF.md` -> the last session's own handover: current state, what is unfinished, traps
   it hit. Under 40 lines, always worth reading.
3. Find your task in the routing table, open **only** what it lists.
4. Obey the read protocol below. Nothing here is worth reading whole.

## Non-negotiable rules

1. **Never condense, shorten or summarize dubbing lines.** If the Vietnamese speech overruns its
   subtitle slot, fix it with speech rate, pause trimming and sentence chaining. Dropping words
   loses what the speaker actually said. There is no condense code any more (removed in 1.7.3,
   `tests/backlog.test.js` guards it); do not add one back, and do not propose "translate it
   shorter" either.
2. **Bump the version at the end of every code change**: `node tools/bump-version.js`. Scheme is
   +0.0.1 with carry at 9 (`1.2.9` -> `1.3.0`, `1.9.9` -> `2.0.0`). The script owns all five places
   the version appears; never hand-edit `build-info.js` or a version badge.
3. **Tell the user to click Reload** at `chrome://extensions` after any change. Never tell them to
   remove it and Load unpacked again: Chrome then recreates the settings store and the Gemini API
   key plus dubbing settings are lost.
4. **The default model must stay `"auto"`.** The user's Gemini key is a new key and gets 404 for
   `gemini-2.5-flash-lite`. Never hardcode a model as default just because the docs call it stable;
   availability is per API key and `background.js` probes it.
5. **Language: English in the repo, Vietnamese to people.** Full table in the next section. This
   is the rule broken most often, because most of what is already here is Vietnamese.

## Language

| Thing | Language |
|---|---|
| Your chat replies to the user | **Vietnamese**, plain, no long dashes |
| Comments you write in code | **English** |
| Names of new functions, variables, constants, files | **English** |
| Names of new tests | **English** |
| Commit messages, `docs/`, `CLAUDE.md` | **English** |
| Strings the end user reads: labels in `options.html` and `popup.html`, toast text, `manifest.json` description and command descriptions | **Vietnamese** |

That last row is not a style choice. This extension is for Vietnamese users; translating a UI
string breaks the product. If you are unsure whether a string is UI, check whether it reaches the
screen.

**The Vietnamese already here stays.** Do not start a translation pass:

- The 41 Vietnamese function names (`ytBatDauDich`, `layNoiDungPhuDe`, `capNhatHienThi`, ...) keep
  their names. Renaming them across 14,400 lines fails in ways the tests do not catch.
- The 231 Vietnamese test names keep their names.
- The ~1,000 Vietnamese comment lines get translated **only** when you are already rewriting that
  exact block for another reason. Never open a file just to translate comments, and never ship a
  diff that is only comment translation.

## Read protocol (this is the token budget)

Reading all source is ~500KB, roughly 145k tokens. Don't. A normal task should land in 10-25k.

- Never `Read` a file over ~400 lines whole. `grep -n <symbol>` first, then read with offset/limit.
- Line numbers in `docs/` are anchors and they drift. Confirm with grep before editing.
- **Grep only, never read whole:** `options.html` (1405, ~810 of them inline CSS),
  `youtube.js` (1924), `content.js` (1454), `dub-engine.js` (1269), `background.js` (1256),
  `glossary.js` (665, pure data), `dub-speech.js` (454, a third of it a generated table), `tests/hardening.test.js` (1489), `tests/cost.test.js` (924).
- Safe to read whole when you need them: `cost-policy.js` (278), `popup.js` (267), `yt-bridge.js`
  (219), `subtitle-style.js` (213), `vi-quality.js` (165), `lang-detect.js` (93), any `docs/` file.

## Routing table: task -> open exactly this

| Task | Open |
|---|---|
| YouTube captions come back empty / "không đọc được nội dung" | `docs/DANGER.md` §pot, then `yt-bridge.js` |
| YouTube overlay, position, control-bar button, quick menu | `docs/SUBTITLE.md` §YouTube, then grep `youtube.js` |
| Coursera subtitles | `docs/SUBTITLE.md` §Coursera, then grep `content.js` |
| Vietnamese line breaking / cue splitting | `vi-segmenter.js` (`segmentGroupSafe`), `tests/fixtures.js` |
| Translation quality, wrong term, English left in | `context-engine.js`, `vi-quality.js`, grep the term in `glossary.js` |
| Dubbing out of sync, late, drifting, too fast or slow | `docs/DUBBING.md` §SYNC, then `dub-engine.js` `SYNC` block (lines 27-76) |
| No voice at all | `docs/DUBBING.md` §providers. Check the server first: `curl 127.0.0.1:8000/health` |
| Voice pacing, pauses, prosody | `dub-planner.js` (`buildDubScript`, `planSegment`) + `docs/DUBBING.md` |
| Voice says an English name, brand, acronym or model number wrong | `docs/DUBBING.md` §English inside Vietnamese speech, then `dub-speech.js`; measure with `tools/pron-eval.js` |
| Cost, model pick, budget, quota error | `cost-policy.js` (read whole, it is the single source of truth) |
| Add or change a setting | `docs/SUBTITLE.md` §storage keys, then `options.js` `collectSettings` + its card in `options.html` |
| Popup behaviour | `popup.js` |
| New service-worker action, retries, API errors | `docs/SUBTITLE.md` §messages, then `background.js` `ROUTES` (near the end) |
| Reload breaks the tab, duplicate buttons, script fights itself | `docs/DANGER.md` §reload guards |
| Writing or fixing a test | `docs/TESTING.md` |
| "What does file X do?" / "where does Y live?" | `docs/MAP.md` only. Do not go file-hunting |

## docs/

`HANDOFF.md` the last session's handover, rewritten every time a file changes ·
`MAP.md` every file, its role, size, global export, consumers, and the manifest load order ·
`SUBTITLE.md` both subtitle pipelines, the message contracts, every storage key ·
`DUBBING.md` planner -> engine -> audio data contract, the `SYNC` tuning block, the 3 TTS providers,
the cache · `DANGER.md` fragile code and what breaks when you touch it. **Read this before editing
`youtube.js`, `yt-bridge.js` or `dub-engine.js`** · `TESTING.md` the test matrix and the manual
harnesses · `BACKLOG.md` known defects and leftovers.

## Lanes: one session takes one lane

| Lane | Files |
|---|---|
| A. Subtitle | `content.js` `youtube.js` `yt-bridge.js` `vi-segmenter.js` `vi-quality.js` `context-engine.js` `glossary.js` `lang-detect.js` `subtitle-style.js` |
| B. Dubbing | `dubbing.js` `dub-engine.js` `dub-planner.js` `dub-prosody.js` `dub-speech.js` `dub-audio.js` `cst-cache.js` |
| C. UI | `popup.*` `options.*` `version-check.js` `chrome-shim.js` |
| D. Core | `background.js` `cost-policy.js` `manifest.json` `tools/` `tests/` |

`background.js` and `manifest.json` are hot: lane B and C both reach into them. If you must edit
outside your lane, say so in the commit message. `build-info.js` is generated; never touch it.

## Commands

```bash
npm test                       # fully offline, ~14s. The bar is 0 fail. 1 skip is normal
                               # (316 tests / 315 pass on 2026-09-23; the count grows as tests are added)
npm run compare                # old vs new segmenter over the fixtures
node tools/bump-version.js     # run at the end of every code change
git push                       # after every commit: private repo on GitHub (see Definition of done)
node tests/vieneu.live.js      # needs the local TTS server running
curl 127.0.0.1:8000/health     # is the VieNeu TTS server up?
open ~/VieNeu-TTS/cst-start.command   # start it (lives outside this repo)
```

The one skipped test needs `OLD_YT=<path-to-an-older-youtube.js>`; skipping it is normal.

## Definition of done: hand over, every time

**A turn that changed any file is not finished until you have handed over.** Run `/ban-giao`; it is
this whole checklist. A `Stop` hook (`tools/handoff-check.sh`, wired in `.claude/settings.json`)
looks for uncommitted changes, or commits not yet pushed to GitHub, and tells you if you forget. It fires at most once per turn,
so it cannot loop. A turn that only answered a question and changed nothing needs no handover.

By hand, `/ban-giao` is:

1. `npm test` shows **0 fail**. A new failure is yours; fix it before finishing. Do not compare
   pass counts against a number in a doc, they go stale: use `git stash` if you need to know
   whether a failure predates you.
2. `node tools/bump-version.js`, but **only if a runtime file changed**: `manifest.json`, or a
   `.js` / `.html` / `.css` in the repo root. Docs, `tools/` and `tests/` do not earn a bump.
3. Rewrite `docs/HANDOFF.md`: current state, what is unfinished, traps that cost you time. Replace
   it, do not append. Roughly 40 lines, 45 hard cap. **One exception:** if the note you are
   replacing came from a different session and its "Unfinished" items are still open, carry those
   items over. Replacing is for stale content, not for someone else's unfinished work.
4. Anything structural the next session would waste tokens rediscovering goes in the matching
   `docs/` file, or in `docs/BACKLOG.md` if it is a defect you are not fixing.
5. `git add -A && git commit`, version number in the subject if step 2 bumped it. **If another
   session is working in this folder at the same time, commit your own paths, not `-A`** - it has
   happened here, and you would be committing someone's half-finished feature.
6. `git push` to `origin`. The repo lives at `github.com/mrthanhduy2000/vietnamese-subtitle-translator`
   (**private**), and the user wants every update there. `gh` keeps the credentials in the macOS
   keychain, which the Bash sandbox cannot read: on an auth or keychain error, retry the push with
   the sandbox disabled. Never force-push.
7. Report to the user in Vietnamese: what changed, whether the version moved, whether they need to
   click Reload at `chrome://extensions`, whether it reached GitHub, and anything you left unfinished.
