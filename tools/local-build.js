#!/usr/bin/env node
// Local Git lifecycle guard. The stamp is generated after HEAD changes, never committed.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { writeStamp, stampSource } = require("./git-autoupdate.js");
const ROOT = path.resolve(__dirname, "..");
const MARKER = "# cst-local-build-hook-v1";
const HOOKS = ["post-commit", "post-merge", "post-checkout", "post-rewrite", "pre-push"];
const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";

function check(root = ROOT) {
    const expected = { commit: git(root, "rev-parse", "--short", "HEAD"), committedAt: git(root, "log", "-1", "--format=%cI", "HEAD") };
    const file = path.join(root, "build-stamp.js");
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== stampSource(expected)) {
        throw new Error("Local build stamp is stale or missing. Run node tools/local-build.js sync before handing over.");
    }
    return expected;
}

function sync(root = ROOT) {
    const stamp = writeStamp({ root, file: path.join(root, "build-stamp.js") });
    if (!stamp) throw new Error("Cannot generate the local build stamp.");
    return check(root);
}

function verify(root = ROOT) {
    const stamp = sync(root);
    if (git(root, "branch", "--show-current") !== "main") return stamp;
    const notes = path.join(root, "docs", "changes");
    if (fs.existsSync(notes) && fs.readdirSync(notes).some(name =>
        name.endsWith(".md") && name.toLowerCase() !== "readme.md")) {
        throw new Error("Main has unreleased change notes. Run node tools/release-changes.js --apply, test and commit the release before pushing main.");
    }
    // Missing notes must not let a runtime change bypass the release rule.
    let previous;
    try { previous = JSON.parse(git(root, "show", "refs/remotes/origin/main:manifest.json")); }
    catch { return stamp; } // Initial push or a non-extension test repository has no baseline.
    const current = JSON.parse(git(root, "show", "HEAD:manifest.json"));
    const runtimeChanged = git(root, "diff", "--name-only", "refs/remotes/origin/main", "HEAD")
        .split("\n").some(name => /^(manifest\.json|[^/]+\.(js|html|css))$/.test(name));
    if (runtimeChanged && previous.version === current.version) {
        throw new Error("Runtime changes on main require a release note and a version bump before push. Run the main handover release step.");
    }
    return stamp;
}

function install(root = ROOT) {
    const hookDir = path.resolve(root, git(root, "rev-parse", "--git-path", "hooks"));
    const files = HOOKS.map(name => path.join(hookDir, name));
    // Validate the entire set first; never replace hooks owned by another tool.
    for (const file of files) {
        if (fs.existsSync(file) && !fs.readFileSync(file, "utf8").includes(MARKER)) {
            throw new Error(`Existing hook must be integrated manually: ${file}`);
        }
    }
    fs.mkdirSync(hookDir, { recursive: true });
    const script = action => '#!/bin/sh\n' + MARKER + '\n' +
        'root=$(git rev-parse --show-toplevel) || exit 1\n' +
        // A pre-push hook inherits ref data on stdin. This command needs none of it.
        'exec ' + quote(process.execPath.replace(/\\/g, "/")) + ' "$root/tools/local-build.js" ' + action + ' </dev/null\n';
    for (const file of files) {
        fs.writeFileSync(file, script(path.basename(file) === "pre-push" ? "verify" : "sync"), { mode: 0o755 });
        fs.chmodSync(file, 0o755);
    }
    return sync(root);
}

module.exports = { check, sync, install, verify, HOOKS };
if (require.main === module) {
    try {
        const action = process.argv[2] || "check";
        if (!["check", "sync", "install", "verify"].includes(action)) throw new Error("Use check, sync, install or verify.");
        const result = ({ check, sync, install, verify })[action]();
        console.log(`Local build ${result.commit}: ${action} OK`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
