// The commit stamp: tools/git-autoupdate.js writes build-stamp.js, the extension reads it at start,
// and version-check.js shows a Reload prompt when the commit on disk differs from the loaded one.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { writeStamp } = require("../tools/git-autoupdate.js");
const VC = require("../version-check.js");

const sh = (cwd, ...a) => execFileSync("git", ["-C", cwd, "-c", "user.email=t@t", "-c", "user.name=t", ...a], { encoding: "utf8" }).trim();

test("writeStamp records the short commit and its commit time, and rewrites only on change", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stamp-"));
    const file = path.join(tmp, "build-stamp.js");
    sh(tmp, "init", "-q", "-b", "main");
    fs.writeFileSync(path.join(tmp, "a.txt"), "1");
    sh(tmp, "add", "."); sh(tmp, "commit", "-qm", "one");
    const head = sh(tmp, "rev-parse", "--short", "HEAD");
    const info = writeStamp({ root: tmp, file });
    assert.equal(info.commit, head);
    assert.ok(!isNaN(Date.parse(info.committedAt)));
    const sandbox = {};
    vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox);
    assert.deepEqual({ ...sandbox.CST_STAMP }, info);
    const mtime = fs.statSync(file).mtimeMs;
    writeStamp({ root: tmp, file });
    assert.equal(fs.statSync(file).mtimeMs, mtime);
    fs.rmSync(tmp, { recursive: true, force: true });
});

// Minimal page: one badge, one mount point, and a list of prepended warning boxes
function fakeDoc(badgeText) {
    const badge = { textContent: badgeText, title: "" };
    const prepended = [];
    const body = { prepend: el => prepended.push(el) };
    return {
        badge, prepended, body,
        querySelector: sel => (sel === ".header-badge" ? badge : null),
        createElement: () => ({ style: {}, setAttribute() { }, append() { }, addEventListener() { }, textContent: "" })
    };
}
const chromeWith = (loadedStamp, version = "3.0.8") => ({
    runtime: {
        getManifest: () => ({ version }),
        sendMessage: async () => ({ ok: true, stamp: loadedStamp })
    }
});
const disk = { commit: "5bd149a", committedAt: "2026-10-25T09:14:28+00:00" };

test("same commit on disk and in Chrome: no warning, badge shows the commit", async () => {
    const doc = fakeDoc("Phiên bản v3.0.8 · cập nhật 23:13 23/10/2026");
    const r = await VC.checkBuild(doc, chromeWith({ commit: "5bd149a" }), ".header-badge", ".content-area", disk);
    assert.equal(r.stale, false);
    assert.equal(doc.prepended.length, 0);
    assert.match(doc.badge.textContent, /commit 5bd149a/);
});

test("a newer commit on disk than the one Chrome loaded: Reload prompt, even with the same version", async () => {
    const doc = fakeDoc("Phiên bản v3.0.8 · cập nhật 23:13 23/10/2026");
    const r = await VC.checkBuild(doc, chromeWith({ commit: "de41543" }), ".header-badge", ".content-area", disk);
    assert.equal(r.stale, true);
    assert.equal(doc.prepended.length, 1);
});

test("a build from before the stamp existed (no reply) counts as stale when the disk has a stamp", async () => {
    const doc = fakeDoc("Phiên bản v3.0.8");
    const chrome = { runtime: { getManifest: () => ({ version: "3.0.8" }), sendMessage: async () => { throw new Error("The message port closed"); } } };
    const r = await VC.checkBuild(doc, chrome, ".header-badge", ".content-area", disk);
    assert.equal(r.stale, true);
    assert.equal(r.loaded, "");
});

test("no stamp on disk (install from a zip): falls back to the version rule", async () => {
    const doc = fakeDoc("Phiên bản v3.0.8");
    assert.equal((await VC.checkBuild(doc, chromeWith(null, "3.0.7"), ".header-badge", ".content-area", null)).stale, true);
    assert.equal((await VC.checkBuild(fakeDoc("Phiên bản v3.0.8"), chromeWith(null), ".header-badge", ".content-area", null)).stale, false);
});

test("managed Git hooks refresh stamps and block unreleased main pushes", t => {
    const { install, check } = require("../tools/local-build.js");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stamp-hooks-"));
    t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
    const repo = path.join(tmp, "repo"), remote = path.join(tmp, "remote.git");
    fs.mkdirSync(repo);
    sh(repo, "init", "-q", "-b", "main");
    sh(tmp, "init", "--bare", "-q", remote);
    sh(repo, "remote", "add", "origin", remote);
    fs.mkdirSync(path.join(repo, "tools"));
    for (const name of ["local-build.js", "git-autoupdate.js"]) fs.copyFileSync(path.join(__dirname, "..", "tools", name), path.join(repo, "tools", name));
    fs.writeFileSync(path.join(repo, ".gitignore"), "build-stamp.js\n");
    fs.writeFileSync(path.join(repo, "manifest.json"), JSON.stringify({ version: "3.1.0" }));
    fs.writeFileSync(path.join(repo, "main.js"), "// Original runtime\n");
    sh(repo, "add", "."); sh(repo, "commit", "-qm", "initial");
    install(repo);
    fs.writeFileSync(path.join(repo, "change.txt"), "updated");
    sh(repo, "add", "."); sh(repo, "commit", "-qm", "next");
    assert.equal(check(repo).commit, sh(repo, "rev-parse", "--short", "HEAD"));
    const beforeMerge = check(repo).commit;
    sh(repo, "checkout", "-qb", "feature");
    fs.writeFileSync(path.join(repo, "change.txt"), "merged update");
    sh(repo, "add", "."); sh(repo, "commit", "-qm", "feature");
    const featureHead = check(repo).commit;
    sh(repo, "checkout", "-q", "main");
    assert.equal(check(repo).commit, beforeMerge, "checkout refreshes the stamp");
    sh(repo, "merge", "--ff-only", "feature");
    assert.equal(check(repo).commit, featureHead, "fast-forward pull/merge refreshes the stamp");
    sh(repo, "commit", "--amend", "-qm", "rewritten");
    assert.equal(check(repo).commit, sh(repo, "rev-parse", "--short", "HEAD"));
    fs.unlinkSync(path.join(repo, "build-stamp.js"));
    assert.throws(() => check(repo), /stale or missing/);
    sh(repo, "push", "-q", "origin", "main");
    assert.equal(check(repo).commit, sh(repo, "rev-parse", "--short", "HEAD"));
    fs.mkdirSync(path.join(repo, "docs", "changes"), { recursive: true });
    fs.writeFileSync(path.join(repo, "docs", "changes", "pending.md"), "# Pending release\n- Change\n");
    sh(repo, "add", "."); sh(repo, "commit", "-qm", "pending");
    const remoteBefore = sh(remote, "rev-parse", "refs/heads/main");
    assert.throws(() => sh(repo, "push", "-q", "origin", "main"), /unreleased change notes/);
    assert.equal(sh(remote, "rev-parse", "refs/heads/main"), remoteBefore);
    fs.unlinkSync(path.join(repo, "docs", "changes", "pending.md"));
    sh(repo, "add", "-u"); sh(repo, "commit", "-qm", "released");
    sh(repo, "push", "-q", "origin", "main");
    assert.equal(sh(remote, "rev-parse", "refs/heads/main"), sh(repo, "rev-parse", "HEAD"));
    fs.writeFileSync(path.join(repo, "main.js"), "// Changed runtime without a note\n");
    sh(repo, "add", "."); sh(repo, "commit", "-qm", "missing release note");
    assert.throws(() => sh(repo, "push", "-q", "origin", "main"), /Runtime changes on main require/);
    fs.writeFileSync(path.join(repo, "manifest.json"), JSON.stringify({ version: "3.1.1" }));
    sh(repo, "add", "."); sh(repo, "commit", "-qm", "release version");
    sh(repo, "push", "-q", "origin", "main");
    assert.equal(sh(remote, "rev-parse", "refs/heads/main"), sh(repo, "rev-parse", "HEAD"));
});

test("hook installation preserves hooks owned by other tools", t => {
    const { install } = require("../tools/local-build.js");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stamp-existing-"));
    t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
    sh(tmp, "init", "-q");
    const file = path.join(tmp, ".git", "hooks", "post-commit");
    fs.writeFileSync(file, "#!/bin/sh\n# owned by another tool\n");
    assert.throws(() => install(tmp), /Existing hook/);
    assert.equal(fs.readFileSync(file, "utf8"), "#!/bin/sh\n# owned by another tool\n");
    assert.equal(fs.existsSync(path.join(tmp, ".git", "hooks", "pre-push")), false);
});

test("an open page discovers disk updates, shows one Reload button and stops on pagehide", async () => {
    const doc = fakeDoc("Phiên bản v3.1.0");
    const originalQuery = doc.querySelector;
    doc.querySelector = sel => sel === ".cst-stale-warning" ? doc.prepended[0] : originalQuery(sel);
    let buttonClick, refresh, stopped = false, reloads = 0, commit = "old";
    doc.createElement = () => ({ style: {}, setAttribute() {}, append(...nodes) { this.firstElementChild = nodes[0]; }, addEventListener: (name, fn) => { if (name === "click") buttonClick = fn; } });
    const events = {};
    const chrome = chromeWith({ commit: "old" }, "3.1.0");
    chrome.runtime.id = "test";
    chrome.runtime.getURL = name => name;
    chrome.runtime.reload = () => reloads++;
    const sandbox = {
        fetch: async (url, options) => {
            assert.equal(options.cache, "no-store");
            return { ok: true, text: async () => `const info = ${JSON.stringify({ commit, committedAt: disk.committedAt })};`, json: async () => ({ version: commit === "old" ? "3.1.0" : "3.1.1" }) };
        },
        setInterval: (fn, ms) => { assert.equal(ms, 15000); refresh = fn; return 1; },
        clearInterval: () => { stopped = true; },
        addEventListener: (name, fn) => { events[name] = fn; },
        removeEventListener: name => { delete events[name]; }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "version-check.js"), "utf8"), sandbox);
    sandbox.CST_VERSION_CHECK.watch(doc, chrome, ".header-badge", ".content-area");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(doc.prepended.length, 0);
    commit = "new";
    await refresh();
    assert.equal(doc.prepended.length, 1);
    assert.match(doc.badge.textContent, /v3\.1\.1.*commit new/);
    commit = "newest";
    await refresh();
    assert.equal(doc.prepended.length, 1);
    assert.match(doc.prepended[0].firstElementChild.textContent, /commit newest/);
    buttonClick();
    assert.equal(reloads, 1);
    events.pagehide();
    assert.equal(stopped, true);
    assert.equal(events.focus, undefined);
});

test("matching commits cannot hide a newer disk version after a worker restart", async () => {
    const doc = fakeDoc("Phiên bản v3.1.1");
    const result = await VC.checkBuild(doc, chromeWith({ commit: disk.commit }, "3.1.0"), ".header-badge", ".content-area", { ...disk, version: "3.1.1" });
    assert.equal(result.stale, true);
    assert.match(doc.badge.textContent, /v3\.1\.1/);
});
