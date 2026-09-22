---
description: Hand over end of turn - test, bump version, rewrite docs/HANDOFF.md, commit
---

Hand over whatever is currently uncommitted in this project. Steps 1 to 6 are the job. Do not ask
for permission between them, and do not skip one because it looks unnecessary.

1. `git status --short` and `git diff --stat`. If nothing changed, say so in one line and stop:
   there is nothing to hand over.

2. `npm test`. The bar is **0 fail**. If a test fails because of this session's change, fix it
   before going on. If it was already failing before you touched anything, say so plainly instead
   of letting it look like a pass.

3. Did a **runtime** file change? A runtime file is one Chrome actually loads: `manifest.json`, or
   any `.js` / `.html` / `.css` in the repo root. `docs/`, `tools/`, `tests/`, `README.md`,
   `CLAUDE.md`, `.claude/` and `.gitignore` are **not** runtime.
   - Yes: run `node tools/bump-version.js`.
   - No: skip it and say in one line why.

4. Rewrite `docs/HANDOFF.md` completely. Keep its headings and their order, replace the content,
   keep it to roughly 40 lines (45 hard cap). Write it for a session that knows nothing: name
   the files, name the
   version, say what is unfinished, and record any trap that cost you time. Do not narrate the
   diff, git already has it.

5. If you learned something structural that a future session would waste tokens rediscovering, put
   it in the matching `docs/` file, or in `docs/BACKLOG.md` if it is a defect you are not fixing.
   A few lines, not an essay.

6. `git add -A` then `git commit`, with the version number in the subject line if step 3 bumped it.
   Then report to the user **in Vietnamese**: what changed, whether the version moved, whether they
   need to click Reload at `chrome://extensions`, and anything you left unfinished.

If the user has explicitly told you in this conversation not to commit, do steps 1 to 5, skip the
commit, and say in one line that the handover is written but uncommitted at their request.
