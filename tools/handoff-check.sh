#!/bin/zsh
# Stop hook: reminds Claude to hand over when the working tree has uncommitted changes, and to
# push when there are commits that have not reached GitHub yet.
# Wired in .claude/settings.json. Exits silently (0) when there is nothing to hand over,
# so quiet turns cost nothing.
#
# Loop guard: Claude Code sets stop_hook_active=true on the stdin JSON when it is already
# continuing BECAUSE of this hook. We bail out then, so we can never block twice in a row
# and can never spin, even if the commit itself is refused.

input=$(cat)

case "$input" in
    *'"stop_hook_active"'*'true'*) exit 0 ;;
esac

dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$dir" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

changed=$(git status --porcelain 2>/dev/null)
if [ -z "$changed" ]; then
    if ! node tools/local-build.js check >/dev/null 2>&1; then
        printf '%s\n' '{"decision":"block","reason":"LOCAL BUILD STAMP REQUIRED: run node tools/local-build.js install, then node tools/local-build.js verify. The disk stamp must match HEAD before handover."}'
        exit 0
    fi
    # Nothing uncommitted. Committed but not on GitHub yet? The user wants every update pushed.
    # Compares with the local copy of origin/main, so it works offline and costs no network call.
    ahead=$(git rev-list --count '@{u}..HEAD' 2>/dev/null)
    [ -n "$ahead" ] && [ "$ahead" -gt 0 ] 2>/dev/null || exit 0
    printf '{"decision":"block","reason":"PUSH REQUIRED: %s commit(s) are not on GitHub yet (origin, private repo mrthanhduy2000/vietnamese-subtitle-translator). Run git push. The gh credentials are in the macOS keychain, which the Bash sandbox cannot read: on an auth or keychain error retry with the sandbox disabled. Never force-push. If it still cannot reach GitHub, say so in one line and stop."}\n' "$ahead"
    exit 0
fi

count=$(printf '%s\n' "$changed" | grep -c . | tr -d ' ')
# Strip quotes and backslashes so a exotic filename cannot break the JSON below.
files=$(printf '%s\n' "$changed" | awk '{print $NF}' | head -8 | tr -d '"\\' | tr '\n' ' ')

printf '{"decision":"block","reason":"BAN GIAO / HANDOFF REQUIRED: %s uncommitted file(s) (%s). CLAUDE.md requires a handoff before you finish a turn that changed files. Run the /ban-giao command, which does it all: npm test (bar is 0 fail), add a change note for runtime changes; on main collect notes with node tools/release-changes.js --apply; feature branches do not bump versions, rewrite docs/HANDOFF.md, then stage owned paths, git commit, node tools/local-build.js verify and git push. If the user explicitly told you not to commit, say that in one line and stop."}\n' "$count" "$files"
