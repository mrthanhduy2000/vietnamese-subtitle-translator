#!/usr/bin/env node
// Builds the public share repo (github.com/mrthanhduy2000/dich-phu-de-long-tieng) that friends
// install from: the extension's runtime files under extension/, the two installers and the patched
// VieNeu server file. Nothing else of this private repo (docs, tests, tools, review data) goes out.
//   node tools/publish-share.js                  build into ../dich-phu-de-long-tieng
//   node tools/publish-share.js --push           build, commit and push it
//   node tools/publish-share.js --out DIR        build somewhere else (tests use this)
//   node tools/publish-share.js --release-model [--dry-run] [--vieneu DIR]
//       create or update the GitHub release that mirrors the pinned VieNeu model
//       (tools/share/vieneu-model.json "release"), from the author's checked copy in
//       <VieNeu>/models/hf. The installers download from it first (tools/vieneu-pin.py --install).
//       Needs gh, signed in, outside the sandbox (keychain). --dry-run prints the gh commands.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const SHARE = path.join(__dirname, "share");
const PIN = path.join(SHARE, "vieneu-model.json");
const LICENSE = "LICENSE-Apache-2.0.txt";
const RUNTIME_DIRS = ["icons", "images"];
// The autostart helpers (and the Windows runner they install) ride inside the extension: the
// Settings page points the user at them. vieneu-pin.py and its pin install the voice model
// (installers, background updater), so they ship side by side.
const EXT_TOOLS = ["vieneu-autostart.command", "vieneu-autostart.ps1", "vieneu-autostart.cmd", "vieneu-runner.pyw",
    "dichphude-update.py", "huong-dan-cai-dat.html", "vieneu-pin.py", "vieneu-model.json"];
// Where an EXT_TOOLS file comes from, when not tools/<name>
const EXT_TOOL_SRC = { "vieneu-model.json": "share/vieneu-model.json" };
const SHARE_FILES = ["README.md", "install-mac.sh", "install-windows.ps1",
    "vieneu/openai_speech.py", "vieneu/openai_speech.patch", LICENSE,
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

function readPin() {
    return JSON.parse(fs.readFileSync(PIN, "utf8"));
}

// Same rule as asset_name() in tools/vieneu-pin.py: release assets cannot hold folders
const assetName = (repo, file) => repo.split("/").pop() + "__" + file.replace(/\//g, "__");
// Same rule as release_tag(): both revisions, so a change to either never overwrites older assets
const releaseTag = pin => "vieneu-model-" + pin.repos.map(r => r.revision.slice(0, 7)).join("-");

// Attribution for what the share repo and its model release redistribute (Apache 2.0, section 4)
function notice(pin) {
    const [turbo, moss] = ["pnnbao-ump/VieNeu-TTS-v3-Turbo", "OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX"]
        .map(n => pin.repos.find(r => r.repo === n));
    const tag = pin.release.tag;
    return [
        "Dich Phu De & Long Tieng AI: third-party notices",
        "",
        "This repository and its model release redistribute parts of two works licensed under the",
        `Apache License, Version 2.0 (full text: ${LICENSE}, or https://www.apache.org/licenses/LICENSE-2.0).`,
        "Copyright in each work stays with its authors.",
        "",
        "1. VieNeu-TTS, by pnnbao97: https://github.com/pnnbao97/VieNeu-TTS",
        `   - vieneu/openai_speech.py is apps/openai_speech.py of VieNeu-TTS at commit ${pin.voices.commit},`,
        "     MODIFIED by this project (it frees a stream slot when the caller hangs up);",
        "     vieneu/openai_speech.patch shows every change.",
        "   - The installers download the VieNeu-TTS code itself, unchanged, from GitHub at that commit.",
        `   - The model files of https://huggingface.co/${turbo.repo} at revision`,
        `     ${turbo.revision}, unchanged, are assets of the GitHub release ${tag}.`,
        "",
        "2. MOSS-Audio-Tokenizer-Nano-ONNX, by the OpenMOSS team:",
        `   https://huggingface.co/${moss.repo}`,
        `   - The model files at revision ${moss.revision}, unchanged, are assets of the same release.`,
        "",
        "Every redistributed model file is listed with its size and sha256 in",
        "extension/tools/vieneu-model.json, and the installer checks each one before use.",
        "",
    ].join("\n");
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
        copy(path.join(ROOT, "tools", EXT_TOOL_SRC[f] || f), to);
        // cmd.exe mis-reads some LF-only batch files; the .gitattributes below keeps these bytes as-is
        if (f.endsWith(".cmd")) fs.writeFileSync(to, fs.readFileSync(to, "utf8").replace(/\r?\n/g, "\r\n"));
    }
    for (const f of SHARE_FILES) copy(path.join(SHARE, f), path.join(out, f));
    fs.writeFileSync(path.join(out, "NOTICE"), notice(readPin()));
    fs.writeFileSync(path.join(out, ".gitattributes"), "* -text\n");
    for (const f of ["install-mac.sh", "extension/tools/vieneu-autostart.command"]) fs.chmodSync(path.join(out, f), 0o755);
    return JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")).version;
}

// The model files as release assets: flat name, where the author's copy holds it, pinned size
function releaseAssets(pin, hfHome) {
    return pin.repos.flatMap(r => r.files.map(f => ({
        name: f.asset || assetName(r.repo, f.path),
        from: path.join(hfHome, "hub", "models--" + r.repo.replace("/", "--"), "snapshots", r.revision, ...f.path.split("/")),
        size: f.size,
    })));
}

function releaseNotes(pin) {
    const size = n => n < 1e6 ? `${(n / 1e3).toFixed(1)} KB` : `${(n / 1e6).toFixed(1)} MB`;
    const lines = pin.repos.flatMap(r => r.files.map(f => `| \`${f.asset}\` | ${size(f.size)} | \`${f.sha256.slice(0, 16)}...\` |`));
    return [
        "Mô hình giọng VieNeu đã khóa phiên bản cho bộ cài **Dịch Phụ Đề & Lồng Tiếng AI**. Bộ cài tự tải",
        "các tệp này và kiểm từng tệp bằng sha256; không cần tải tay.",
        "",
        "| Asset | Size | sha256 |",
        "|---|---|---|",
        ...lines,
        "",
        "```text",
        notice(pin).trimEnd(),
        "```",
        "",
    ].join("\n");
}

function releaseModel({ vieneu = path.join(os.homedir(), "VieNeu-TTS"), dryRun = false } = {}) {
    const pin = readPin();
    const { repo, tag } = pin.release;
    if (tag !== releaseTag(pin)) throw new Error(`release.tag is ${tag}, the pin makes it ${releaseTag(pin)}`);
    const hfHome = path.join(vieneu, "models", "hf");
    // 1. The author's copy must match the pin, byte for byte (exit 1 throws here)
    execFileSync("python3", [path.join(__dirname, "vieneu-pin.py"), "--vieneu", vieneu], { stdio: "inherit" });
    // 2. Flat names, as the installers download them; symlinks, nothing copied
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), "vieneu-release-"));
    const assets = releaseAssets(pin, hfHome);
    for (const a of assets) fs.symlinkSync(fs.realpathSync(a.from), path.join(stage, a.name));
    fs.writeFileSync(path.join(stage, "NOTICE"), notice(pin));
    fs.copyFileSync(path.join(SHARE, LICENSE), path.join(stage, LICENSE));
    fs.copyFileSync(PIN, path.join(stage, "vieneu-model.json"));
    const files = fs.readdirSync(stage).map(f => path.join(stage, f));
    const notes = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vieneu-notes-")), "notes.md");
    fs.writeFileSync(notes, releaseNotes(pin));
    const gh = (...a) => dryRun ? console.log("gh " + a.map(x => /\s/.test(x) ? JSON.stringify(x) : x).join(" "))
        : execFileSync("gh", a, { stdio: "inherit" });
    // 3. Create once (the tag lands on the default branch), else refresh the notes; then upload,
    // --clobber replacing an asset of the same name
    let exists = false;
    if (!dryRun) {
        try { execFileSync("gh", ["release", "view", tag, "-R", repo], { stdio: "ignore" }); exists = true; } catch { }
    }
    const title = `Mô hình giọng VieNeu (${tag.replace("vieneu-model-", "")})`;
    if (exists) gh("release", "edit", tag, "-R", repo, "--title", title, "--notes-file", notes);
    else gh("release", "create", tag, "-R", repo, "--title", title, "--notes-file", notes);
    gh("release", "upload", tag, "-R", repo, "--clobber", ...files);
    // 4. What GitHub holds now: every model asset at its pinned size
    if (!dryRun) {
        const got = JSON.parse(execFileSync("gh", ["release", "view", tag, "-R", repo, "--json", "assets"], { encoding: "utf8" })).assets;
        const size = Object.fromEntries(got.map(a => [a.name, a.size]));
        const bad = assets.filter(a => size[a.name] !== a.size).map(a => a.name);
        if (bad.length) throw new Error(`release ${tag}: wrong or missing ${bad.join(", ")}`);
    }
    console.log(`${dryRun ? "Dry run: " : ""}release ${tag} on ${repo}: ${assets.length} model files ` +
        `(${(assets.reduce((n, a) => n + a.size, 0) / 1e6).toFixed(1)} MB) + NOTICE, ${LICENSE}, vieneu-model.json`);
    fs.rmSync(stage, { recursive: true, force: true });
    fs.rmSync(path.dirname(notes), { recursive: true, force: true });
}

module.exports = { build, runtimeFiles, EXT_TOOLS, notice, releaseAssets, releaseNotes, releaseTag, assetName };

if (require.main === module) {
    const args = process.argv.slice(2);
    const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
    if (args.includes("--release-model")) {
        releaseModel({ vieneu: opt("--vieneu"), dryRun: args.includes("--dry-run") });
        process.exit(0);
    }
    const out = path.resolve(opt("--out") || path.join(ROOT, "..", "dich-phu-de-long-tieng"));
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
