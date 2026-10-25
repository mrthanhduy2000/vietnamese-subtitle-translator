// tools/git-autoupdate.js: the author's git checkout follows origin/main, but only when that cannot
// lose work or mix versions under a running browser. Real git repos in a temp folder, no network.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { update, chromeRunning, plist } = require("../tools/git-autoupdate.js");

const sh = (cwd, ...a) => execFileSync("git", ["-C", cwd, "-c", "user.email=t@t", "-c", "user.name=t", ...a], { encoding: "utf8" }).trim();

function setup() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gau-"));
    const origin = path.join(tmp, "origin.git"), work = path.join(tmp, "work"), other = path.join(tmp, "other");
    execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
    execFileSync("git", ["clone", "-q", origin, work]);
    sh(work, "checkout", "-q", "-b", "main");
    fs.writeFileSync(path.join(work, "a.txt"), "1");
    sh(work, "add", "."); sh(work, "commit", "-qm", "one"); sh(work, "push", "-q", "origin", "main");
    execFileSync("git", ["clone", "-q", origin, other]);
    const publish = text => {
        fs.writeFileSync(path.join(other, "a.txt"), text);
        sh(other, "commit", "-qam", text); sh(other, "push", "-q", "origin", "main");
    };
    return { tmp, work, publish };
}

test("fast-forwards to origin/main when the browser is closed and the tree is clean", () => {
    const { tmp, work, publish } = setup();
    publish("2");
    const r = update({ root: work, running: () => false });
    assert.equal(r.status, "updated");
    assert.equal(fs.readFileSync(path.join(work, "a.txt"), "utf8"), "2");
    assert.equal(update({ root: work, running: () => false }).status, "current");
    fs.rmSync(tmp, { recursive: true, force: true });
});

test("waits while a browser is running, then updates on a later run", () => {
    const { tmp, work, publish } = setup();
    publish("2");
    assert.equal(update({ root: work, running: () => true }).status, "wait");
    assert.equal(fs.readFileSync(path.join(work, "a.txt"), "utf8"), "1");
    assert.equal(update({ root: work, running: () => false }).status, "updated");
    fs.rmSync(tmp, { recursive: true, force: true });
});

test("untracked files left in the checkout do not block the update", () => {
    const { tmp, work, publish } = setup();
    publish("2");
    fs.writeFileSync(path.join(work, "notes.md"), "made by another tool");
    fs.mkdirSync(path.join(work, ".agents"));
    assert.equal(update({ root: work, running: () => false }).status, "updated");
    assert.equal(fs.readFileSync(path.join(work, "notes.md"), "utf8"), "made by another tool");
    fs.rmSync(tmp, { recursive: true, force: true });
});

test("never touches uncommitted work, another branch, or local commits main lacks", () => {
    const { tmp, work, publish } = setup();
    publish("2");
    fs.writeFileSync(path.join(work, "a.txt"), "mine");
    assert.equal(update({ root: work, running: () => false }).status, "skip");
    assert.equal(fs.readFileSync(path.join(work, "a.txt"), "utf8"), "mine");
    sh(work, "commit", "-qam", "local");
    const r = update({ root: work, running: () => false });
    assert.equal(r.status, "skip");
    assert.match(r.detail, /ahead or diverged/);
    sh(work, "checkout", "-q", "-b", "feature");
    assert.match(update({ root: work, running: () => false }).detail, /not on main/);
    fs.rmSync(tmp, { recursive: true, force: true });
});

test("an unreachable remote is an error line, not a crash", () => {
    const { tmp, work } = setup();
    sh(work, "remote", "set-url", "origin", path.join(tmp, "nowhere.git"));
    assert.equal(update({ root: work, running: () => false }).status, "error");
    fs.rmSync(tmp, { recursive: true, force: true });
});

test("chromeRunning reads the process list and fails closed", () => {
    const ps = out => () => out;
    assert.equal(chromeRunning(ps("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome\n")), true);
    assert.equal(chromeRunning(ps("/usr/sbin/cfprefsd\n/bin/zsh\n")), false);
    assert.equal(chromeRunning(() => { throw new Error("no ps"); }), true);
});

test("the LaunchAgent plist runs this script at login and every 30 minutes", () => {
    const p = plist();
    assert.match(p, /git-autoupdate\.js/);
    assert.match(p, /<key>RunAtLoad<\/key><true\/>/);
    assert.match(p, /<integer>1800<\/integer>/);
});
