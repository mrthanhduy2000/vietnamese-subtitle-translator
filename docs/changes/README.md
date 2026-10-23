# docs/changes: one note per feature PR

Many PRs merge in parallel. If each one bumped the version and edited `version-history.js`, they
would conflict on every merge (`manifest.json`, `package.json`, `build-info.js`, the two badges,
`version-history.js`). So feature PRs **do not touch the version**. Instead:

1. A feature PR adds one file here: `docs/changes/<short-slug>.md`. Pick a slug unique to the PR.
2. It does **not** run `tools/bump-version.js`, and does not edit `version-history.js`.
3. A single release step (every 20-30 minutes) collects every note, bumps the version once, writes
   the `version-history.js` entry and deletes the collected notes: `node tools/release-changes.js`.

PRs that only change docs, `tools/` or `tests/` need no note.

## Note format

The note is read by Vietnamese users in Settings > Lich su phien ban, so the title and the bullets
are **Vietnamese**, plain, no long dashes. The file name and everything else stays English.

```
# Ten ban (one line, more than 5 characters)
- What users get, in one or two sentences. One bullet per user-visible change.
- Another change.
```

A note with a title but no bullets is still accepted: each body paragraph becomes one item. The
release step may tidy English-only notes into Vietnamese before `--apply`.

Bullets may wrap onto indented continuation lines. A comparison table (`bang`) is not supported in
notes; the release step can add one by hand when real measurements exist.

## Release step

```bash
node tools/release-changes.js           # preview: lists notes and the version it would produce
node tools/release-changes.js --apply   # bump version, prepend the history entry, delete the notes
npm test
```

Run it on its own branch (`release/<version>`) from the latest `main`, merge when CI is green. If
there are no notes it does nothing. `README.md` is never collected.
