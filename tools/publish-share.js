#!/usr/bin/env node
// Builds the public share repo (github.com/mrthanhduy2000/dich-phu-de-long-tieng) that friends
// install from: the extension's runtime files under extension/, the two installers and the patched
// VieNeu server file. Nothing else of this private repo (docs, tests, tools, review data) goes out.
//   node tools/publish-share.js            build into ../dich-phu-de-long-tieng
//   node tools/publish-share.js --push     build, commit and push it
//   node tools/publish-share.js --out DIR  build somewhere else (tests use this)
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const SHARE = path.join(__dirname, "share");
const RUNTIME_DIRS = ["icons", "images"];
// The autostart helpers (and the Windows runner they install) ride inside the extension: the
// Settings page points the user at them
const EXT_TOOLS = ["vieneu-autostart.command", "vieneu-autostart.ps1", "vieneu-autostart.cmd", "vieneu-runner.pyw"];
const SHARE_FILES = ["README.md", "install-mac.sh", "install-windows.ps1",
    "vieneu/openai_speech.py", "vieneu/openai_speech.patch",
    // the install test: the one-line install on clean Windows and macOS machines at every push
    ".github/workflows/install-test.yml"];

function runtimeFiles() {
    return fs.readdirSync(ROOT).filter(f => f === "manifest.json" || /\.(js|html|css)$/.test(f))
        .filter(f => fs.statSync(path.join(ROOT, f)).isFile());
}

function copy(from, to) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
}

function build(out) {
    fs.mkdirSync(out, { recursive: true });
    for (const f of fs.readdirSync(out)) if (f !== ".git") fs.rmSync(path.join(out, f), { recursive: true, force: true });
    const ext = path.join(out, "extension");
    for (const f of runtimeFiles()) copy(path.join(ROOT, f), path.join(ext, f));
    for (const d of RUNTIME_DIRS) {
        for (const f of fs.readdirSync(path.join(ROOT, d))) {
            if (f.startsWith(".")) continue;
            copy(path.join(ROOT, d, f), path.join(ext, d, f));
        }
    }
    for (const f of EXT_TOOLS) {
        const to = path.join(ext, "tools", f);
        copy(path.join(ROOT, "tools", f), to);
        // cmd.exe mis-reads some LF-only batch files; the .gitattributes below keeps these bytes as-is
        if (f.endsWith(".cmd")) fs.writeFileSync(to, fs.readFileSync(to, "utf8").replace(/\r?\n/g, "\r\n"));
    }
    for (const f of SHARE_FILES) copy(path.join(SHARE, f), path.join(out, f));
    fs.writeFileSync(path.join(out, ".gitattributes"), "* -text\n");
    for (const f of ["install-mac.sh", "extension/tools/vieneu-autostart.command"]) fs.chmodSync(path.join(out, f), 0o755);
    return JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")).version;
}

module.exports = { build, runtimeFiles, EXT_TOOLS };

if (require.main === module) {
    const args = process.argv.slice(2);
    const i = args.indexOf("--out");
    const out = path.resolve(i >= 0 ? args[i + 1] : path.join(ROOT, "..", "dich-phu-de-long-tieng"));
    const version = build(out);
    console.log(`Built ${version} into ${out}`);
    if (args.includes("--push")) {
        const git = (...a) => execFileSync("git", ["-C", out, ...a], { stdio: "inherit" });
        git("add", "-A");
        try { git("commit", "-q", "-m", `Version ${version}`); }
        catch (e) { console.log("Nothing to commit."); }
        git("push");
    }
}
