---
description: Hand over with a main release, tests, automatic build stamp, commit and push
---

Hand over whatever is currently uncommitted in this project. Steps 1 to 7 are the job. Do not ask
for permission between them, and do not skip one because it looks unnecessary.

1. `git status --short` and `git diff --stat`. If nothing changed, say so in one line and stop:
   there is nothing to hand over.

2. Inspect changes and prepare release notes. Run `npm test` after step 3 has generated the final release files. The bar is **0 fail**. If a test fails because of this session's change, fix it
   before going on. If it was already failing before you touched anything, say so plainly instead
   of letting it look like a pass.

3. Release policy: feature branches add `docs/changes/<slug>.md`, never bump versions directly.
   On `main`, collect pending notes with `node tools/release-changes.js --apply` before the final
   test run and release commit. This is the centralized release step, not one bump per parallel PR.
   If no notes exist, do not bump. Never edit generated version files by hand.
   Run `node tools/local-build.js install` once per checkout. Its Git hooks refresh the ignored
   build stamp after commit, merge, checkout and rewrite, and verify the release before push.

4. Rewrite `docs/HANDOFF.md` completely. Keep its headings and their order, replace the content,
   keep it to roughly 40 lines (45 hard cap). If the note you are replacing came from a different
   session and its "Unfinished" items are still open, carry them over instead of deleting them.
   Write it for a session that knows nothing: name
   the files, name the
   version, say what is unfinished, and record any trap that cost you time. Do not narrate the
   diff, git already has it.

5. If you learned something structural that a future session would waste tokens rediscovering, put
   it in the matching `docs/` file, or in `docs/BACKLOG.md` if it is a defect you are not fixing.
   A few lines, not an essay. Then `node tools/doc-sizes.js`: it rewrites the line and test counts
   in `docs/MAP.md` and `docs/TESTING.md`, and names anything it cannot fix (a test file with no row
   in `TESTING.md`, a size in `AGENTS.md`). Fix what it names.

6. `git add -A` then `git commit`, with the version number in the subject line if step 3 released a batch.
   (If another session is working in this folder at the same time, add your own paths, not `-A`.)

7. Run `node tools/local-build.js verify` after committing. A stale/missing stamp or pending main
   release notes must be resolved before finishing. Then `git push` to `origin` (private repo `github.com/mrthanhduy2000/vietnamese-subtitle-translator`).
   The user wants every update on GitHub. Credentials live in the macOS keychain through `gh`, which
   the Bash sandbox cannot read: if the push fails with an authentication or keychain error, run the
   same `git push` again with the sandbox disabled. Never force-push. If it still fails (offline,
   remote ahead), leave the commit local and say so in the report.

Then report to the user **in Vietnamese**: what changed, whether the version moved, whether they
need to click Reload at `chrome://extensions`, whether it reached GitHub, and anything unfinished.

If the user has explicitly told you in this conversation not to commit, do steps 1 to 5, skip the
commit, and say in one line that the handover is written but uncommitted at their request.
