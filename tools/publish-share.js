#!/usr/bin/env node
// Builds the public share repo (github.com/mrthanhduy2000/dich-phu-de-long-tieng) that friends
// install from: the extension's runtime files under extension/, the two installers and the patched
// VieNeu server file. Nothing else of this private repo (docs, tests, tools, review data) goes out.
//   node tools/publish-share.js                  build into ../dich-phu-de-long-tieng
//   node tools/publish-share.js --stage          build, commit and push it to the share repo's branch
//       `staging` only: the install test runs there, and friends' updaters (main only) never see it
//   node tools/publish-share.js --promote        once that test is green on the staged commit, move
//       main to it (refused while it runs, failed, or staging is not this checkout's commit)
//   node tools/publish-share.js --push           build, commit and push straight to main (no test
//       first). Every way in is refused while a shipped file differs from the share repo's last
//       commit and the version is not higher than the one it holds (friends' updaters only take a
//       higher version: bump first)
//   node tools/publish-share.js --out DIR        build somewhere else (tests use this)
//   node tools/publish-share.js --release-model [--dry-run] [--vieneu DIR]
//       create or update the GitHub release that mirrors the pinned VieNeu model
//       (tools/share/vieneu-model.json "release"), from the author's checked copy in
//       <VieNeu>/models/hf. The installers download from it first (tools/vieneu-pin.py --install).
//       After the upload every asset's size and GitHub sha256 digest must match the pin.
//       Needs gh, signed in, outside the sandbox (keychain). --dry-run prints the gh commands.
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { stampSource } = require("./git-autoupdate.js");

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
        "     MODIFIED by this project (it frees a stream slot when the caller hangs up, and listens",
        "     on 127.0.0.1 unless HOST says otherwise);",
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
    // Friends' installs have no git checkout: an empty stamp leaves only the version rule (version-check.js)
    fs.writeFileSync(path.join(ext, "build-stamp.js"), stampSource({ commit: "", committedAt: "" }));
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

// ---- The push guard ----

const vtuple = v => String(v).split(".").map(n => parseInt(n, 10) || 0);
function vcmp(a, b) {
    const x = vtuple(a), y = vtuple(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
    return 0;
}

// git's id for a file's bytes (what `git ls-tree` lists): a build compares with a commit unread
const blobId = buf => crypto.createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");

function filesOnDisk(dir) {
    const out = new Map();
    const walk = rel => {
        for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
            if (!rel && e.name === ".git") continue;
            const p = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) walk(p);
            else out.set(p, blobId(fs.readFileSync(path.join(dir, p))));
        }
    };
    walk("");
    return out;
}

const manifestVersion = text => { try { return JSON.parse(text).version; } catch { return null; } };

// What the share repo holds: its last commit when `out` is the top of a git checkout (a plain build
// into it changes only the working tree, so the guard still sees what friends got), else its files.
function publishedState(out) {
    if (!fs.existsSync(out)) return null;
    const git = (...a) => execFileSync("git", ["-C", out, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    try {
        // .native expands Windows 8.3 short names (RUNNER~1) that git's toplevel spells out in full
        if (fs.realpathSync.native(git("rev-parse", "--show-toplevel").trim()) !== fs.realpathSync.native(out)) throw new Error("nested");
        const files = new Map();
        // -z: paths raw, never quoted (a non-ASCII file name would otherwise never match)
        for (const line of git("ls-tree", "-r", "-z", "HEAD").split("\0").filter(Boolean)) {
            const [meta, file] = line.split("\t");
            const [, type, id] = meta.split(" ");
            if (type === "blob") files.set(file, id);
        }
        let version = null;
        try { version = manifestVersion(git("show", "HEAD:extension/manifest.json")); } catch { }
        return { files, version };
    } catch {
        const m = path.join(out, "extension", "manifest.json");
        return { files: filesOnDisk(out), version: fs.existsSync(m) ? manifestVersion(fs.readFileSync(m, "utf8")) : null };
    }
}

// Friends' updaters take a new copy only when extension/manifest.json's version rises, and tools/
// changes earn no bump by the repo rule: a push that changes shipped files under the same version
// would reach new installs but never the installed ones. built: a fresh build; out: the share repo.
function publishCheck(built, out) {
    const before = publishedState(out);
    if (!before) return { ok: true, changed: [] };
    const now = filesOnDisk(built);
    const changed = [...new Set([...now.keys(), ...before.files.keys()])]
        .filter(f => now.get(f) !== before.files.get(f)).sort();
    const version = manifestVersion(fs.readFileSync(path.join(built, "extension", "manifest.json"), "utf8"));
    if (!changed.length || !before.version || vcmp(version, before.version) > 0) return { ok: true, changed, version };
    const list = changed.slice(0, 8).join(", ") + (changed.length > 8 ? `, and ${changed.length - 8} more` : "");
    return {
        ok: false, changed, version,
        message: `Refusing to push: ${changed.length} shipped file(s) differ from the share repo (${list}), ` +
            `but extension/manifest.json is ${version} here and ${before.version} there. Friends' updaters only ` +
            `take a higher version, so installed copies would never get these files: bump the version first ` +
            `(node tools/bump-version.js), then publish again.`,
    };
}

// ---- The model release ----

// The model files as release assets: flat name, where the author's copy holds it, pinned size + hash
function releaseAssets(pin, hfHome) {
    return pin.repos.flatMap(r => r.files.map(f => ({
        name: f.asset || assetName(r.repo, f.path),
        from: path.join(hfHome, "hub", "models--" + r.repo.replace("/", "--"), "snapshots", r.revision, ...f.path.split("/")),
        size: f.size,
        sha256: f.sha256,
    })));
}

// What GitHub holds against the plan: every asset there, at its pinned size, with GitHub's own
// sha256 of the stored bytes ("digest": "sha256:...") equal to the pin. [] when all match.
function releaseProblems(assets, got) {
    const by = new Map((got || []).map(a => [a.name, a]));
    const bad = [];
    for (const a of assets) {
        const g = by.get(a.name);
        if (!g) { bad.push(`${a.name} missing`); continue; }
        if (g.size !== a.size) bad.push(`${a.name} is ${g.size} bytes, the pin says ${a.size}`);
        if (g.digest !== `sha256:${a.sha256}`) bad.push(`${a.name} digest ${g.digest || "absent"}, the pin says sha256:${a.sha256}`);
    }
    return bad;
}

function releaseNotes(pin) {
    const size = n => n < 1e6 ? `${(n / 1e3).toFixed(1)} KB` : `${(n / 1e6).toFixed(1)} MB`;
    const lines = pin.repos.flatMap(r => r.files.map(f =>
        `| \`${f.asset || assetName(r.repo, f.path)}\` | ${size(f.size)} | \`${f.sha256.slice(0, 16)}...\` |`));
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

// pinFile, exec, tmpRoot and log are for tests: gh and python stubbed, staging in a throwaway folder
function releaseModel({ vieneu = path.join(os.homedir(), "VieNeu-TTS"), dryRun = false, pinFile = PIN,
    exec = execFileSync, tmpRoot = os.tmpdir(), log = console.log } = {}) {
    const pin = JSON.parse(fs.readFileSync(pinFile, "utf8"));
    const { repo, tag } = pin.release;
    if (tag !== releaseTag(pin)) throw new Error(`release.tag is ${tag}, the pin makes it ${releaseTag(pin)}`);
    const hfHome = path.join(vieneu, "models", "hf");
    // 1. The author's copy must match the pin, byte for byte (exit 1 throws here)
    exec("python3", [path.join(__dirname, "vieneu-pin.py"), "--vieneu", vieneu, "--pin", pinFile], { stdio: "inherit" });
    const stage = fs.mkdtempSync(path.join(tmpRoot, "vieneu-release-"));
    const notesDir = fs.mkdtempSync(path.join(tmpRoot, "vieneu-notes-"));
    try {
        // 2. Flat names, as the installers download them; symlinks, nothing copied
        const assets = releaseAssets(pin, hfHome);
        for (const a of assets) fs.symlinkSync(fs.realpathSync(a.from), path.join(stage, a.name));
        fs.writeFileSync(path.join(stage, "NOTICE"), notice(pin));
        fs.copyFileSync(path.join(SHARE, LICENSE), path.join(stage, LICENSE));
        fs.copyFileSync(pinFile, path.join(stage, "vieneu-model.json"));
        const files = fs.readdirSync(stage).map(f => path.join(stage, f));
        const notes = path.join(notesDir, "notes.md");
        fs.writeFileSync(notes, releaseNotes(pin));
        const gh = (...a) => dryRun ? log("gh " + a.map(x => /\s/.test(x) ? JSON.stringify(x) : x).join(" "))
            : exec("gh", a, { stdio: "inherit" });
        // 3. Create once (the tag lands on the default branch), else refresh the notes; then upload,
        // --clobber replacing an asset of the same name
        let exists = false;
        if (!dryRun) {
            try { exec("gh", ["release", "view", tag, "-R", repo], { stdio: "ignore" }); exists = true; } catch { }
        }
        const title = `Mô hình giọng VieNeu (${tag.replace("vieneu-model-", "")})`;
        if (exists) gh("release", "edit", tag, "-R", repo, "--title", title, "--notes-file", notes);
        else gh("release", "create", tag, "-R", repo, "--title", title, "--notes-file", notes);
        gh("release", "upload", tag, "-R", repo, "--clobber", ...files);
        // 4. What GitHub holds now: every model asset at its pinned size and sha256 (GitHub hashes
        // what it stored, so a cut or swapped upload shows here, not on a friend's machine)
        if (!dryRun) {
            const got = JSON.parse(exec("gh", ["api", `repos/${repo}/releases/tags/${tag}`], { encoding: "utf8" })).assets;
            const bad = releaseProblems(assets, got);
            if (bad.length) throw new Error(`release ${tag} on ${repo}: ${bad.join("; ")}`);
        }
        log(`${dryRun ? "Dry run: " : ""}release ${tag} on ${repo}: ${assets.length} model files ` +
            `(${(assets.reduce((n, a) => n + a.size, 0) / 1e6).toFixed(1)} MB) + NOTICE, ${LICENSE}, vieneu-model.json` +
            (dryRun ? "" : ", every size and sha256 digest checked on GitHub"));
    } finally {
        fs.rmSync(stage, { recursive: true, force: true });
        fs.rmSync(notesDir, { recursive: true, force: true });
    }
}

// ---- Staging, then main ----

// main moves to the staged commit only when the install test on that very commit passed. exec is
// for tests (git and gh stubbed).
function promote(out, { exec = execFileSync, log = console.log } = {}) {
    const repo = readPin().release.repo;
    const git = (...a) => String(exec("git", ["-C", out, ...a], { encoding: "utf8" })).trim();
    const head = git("rev-parse", "HEAD");
    git("fetch", "-q", "origin", "staging");
    const staged = git("rev-parse", "FETCH_HEAD");
    if (staged !== head) throw new Error(`staging is at ${staged.slice(0, 7)}, this checkout at ${head.slice(0, 7)}: stage this commit first (--stage)`);
    const runs = JSON.parse(String(exec("gh", ["run", "list", "-R", repo, "--branch", "staging", "-L", "20",
        "--json", "headSha,status,conclusion,url,workflowName"], { encoding: "utf8" })));
    const run = runs.find(r => r.headSha === head && r.workflowName === "Install test");
    if (!run) throw new Error(`no install test on staging for ${head.slice(0, 7)} yet`);
    if (run.status !== "completed") throw new Error(`the install test on ${head.slice(0, 7)} is still ${run.status}: ${run.url}`);
    if (run.conclusion !== "success") throw new Error(`the install test on ${head.slice(0, 7)} ended "${run.conclusion}": ${run.url}`);
    exec("git", ["-C", out, "push", "origin", "HEAD:refs/heads/main"], { stdio: "inherit" });
    log(`main is now ${head.slice(0, 7)}, green on staging (${run.url}): friends' updaters take it within 6 h`);
}

module.exports = { build, runtimeFiles, EXT_TOOLS, notice, releaseAssets, releaseNotes, releaseTag, assetName,
    releaseProblems, releaseModel, publishCheck, blobId, promote };

if (require.main === module) {
    const args = process.argv.slice(2);
    const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
    if (args.includes("--release-model")) {
        releaseModel({ vieneu: opt("--vieneu"), dryRun: args.includes("--dry-run") });
        process.exit(0);
    }
    const out = path.resolve(opt("--out") || path.join(ROOT, "..", "dich-phu-de-long-tieng"));
    if (args.includes("--promote")) {
        try { promote(out); } catch (e) { console.error(`Refusing to promote: ${e.message}`); process.exit(1); }
        process.exit(0);
    }
    const pushing = args.includes("--push") || args.includes("--stage");
    // Built aside first: a refused push leaves the share repo exactly as it was
    const aside = fs.mkdtempSync(path.join(os.tmpdir(), "share-check-"));
    let check;
    try { build(aside); check = publishCheck(aside, out); }
    finally { fs.rmSync(aside, { recursive: true, force: true }); }
    if (!check.ok) {
        console.error(check.message);
        if (pushing) process.exit(1);
    }
    const version = build(out);
    console.log(`Built ${version} into ${out}`);
    if (pushing) {
        const git = (...a) => execFileSync("git", ["-C", out, ...a], { stdio: "inherit" });
        git("add", "-A");
        try { git("commit", "-q", "-m", `Version ${version}`); }
        catch (e) { console.log("Nothing to commit."); }
        if (args.includes("--stage")) {
            git("push", "origin", "HEAD:refs/heads/staging");
            console.log("Staged: the install test runs on staging (gh run list -R mrthanhduy2000/dich-phu-de-long-tieng). " +
                "When it is green: node tools/publish-share.js --promote");
        } else git("push");
    }
}
