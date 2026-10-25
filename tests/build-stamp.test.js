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
