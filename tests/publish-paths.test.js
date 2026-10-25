const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { publishCheck } = require("../tools/publish-share.js");

function fixture(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "publish paths Đàm "));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const pub = path.join(dir, "published copy");
    const fresh = path.join(dir, "fresh");
    for (const root of [pub, fresh]) {
        fs.mkdirSync(path.join(root, "extension"), { recursive: true });
        fs.writeFileSync(path.join(root, "extension", "manifest.json"), '{"version":"1.0.0"}\n');
        fs.writeFileSync(path.join(root, "extension", "tool.js"), "old\n");
    }
    const git = (...args) => execFileSync("git", ["-C", pub, "-c", "user.name=test",
        "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false",
        "-c", `core.hooksPath=${path.join(dir, "no-hooks")}`, "-c", "core.autocrlf=false", ...args]);
    git("init", "-q");
    git("add", "-A");
    git("commit", "-qm", "published");
    // Rebuilding changes disk bytes, but the guard must still compare against HEAD.
    for (const root of [pub, fresh]) fs.writeFileSync(path.join(root, "extension", "tool.js"), "new\n");
    return { dir, pub, fresh };
}

function assertRefused(fresh, pub) {
    const result = publishCheck(fresh, pub);
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.deepEqual(result.changed, ["extension/tool.js"]);
}

test("publish guard reads HEAD through directory aliases with spaces and Unicode", t => {
    const { dir, pub, fresh } = fixture(t);
    const alias = path.join(dir, "alias");
    fs.symlinkSync(pub, alias, process.platform === "win32" ? "junction" : "dir");
    assertRefused(fresh, alias);
});

test("publish guard reads HEAD through Windows 8.3 short paths after a rebuild", {
    skip: process.platform !== "win32" && "needs Windows 8.3 paths",
}, t => {
    const { pub, fresh } = fixture(t);
    const short = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); " +
        "$fso = New-Object -ComObject Scripting.FileSystemObject; $fso.GetFolder($env:DPD_TEST_FOLDER).ShortPath"],
    { encoding: "utf8", env: { ...process.env, DPD_TEST_FOLDER: pub } }).trim();
    if (!short.includes("~")) {
        t.skip("8.3 short names are disabled on this volume");
        return;
    }
    assertRefused(fresh, short);
});
