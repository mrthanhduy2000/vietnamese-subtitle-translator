# docs/changes: one note per feature PR

Many PRs merge in parallel. If each one bumped the version and edited `version-history.js`, they
would conflict on every merge (`manifest.json`, `package.json`, `build-info.js`, the two badges,
`version-history.js`). So feature PRs **do not touch the version**. Instead:

1. A feature PR adds one file here: `docs/changes/<short-slug>.md`. Pick a slug unique to the PR.
2. It does **not** run `tools/bump-version.js`, and does not edit `version-history.js`.
3. The main-branch handover release step collects every pending note, bumps the version once, writes
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

A feature branch leaves its notes for integration. A main-branch handover runs this release step
before final tests and commit; do not assume a scheduled job exists. If
there are no notes it does nothing. `README.md` is never collected.

## Tests

`npm test` runs `tests/*.test.js` by glob, so a new test file needs no edit to `package.json`
(that line used to conflict on every merge).

## Local Reload detection

Run `node tools/local-build.js install` once per checkout. Managed Git hooks refresh ignored
`build-stamp.js` after commit, merge, checkout and rewrite. Before push they refresh and verify
it, and refuse pushing main while change notes remain unreleased. Existing hooks owned by other
tools are preserved: installation refuses rather than replacing them. Run
`node tools/local-build.js verify` after committing and before handover. The Settings/popup watcher
reads disk metadata on focus and every 15 seconds; Reload remains a user action, preserving settings.

The pre-push guard also compares committed runtime files and manifest versions with origin/main.
A changed runtime with an unchanged version is rejected even if its author forgot the change note.
