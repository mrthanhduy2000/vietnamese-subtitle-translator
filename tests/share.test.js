// The public share build (tools/publish-share.js): friends install from it, so a runtime file left
// out, a Windows script that 5.1 cannot read, installers pinned to different VieNeu commits, or a
// voice model that is not the pinned one would only show up on someone else's machine.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { build, EXT_TOOLS, notice, releaseAssets, releaseNotes, releaseTag, assetName } = require("../tools/publish-share.js");

const ROOT = path.join(__dirname, "..");
const R = f => fs.readFileSync(path.join(ROOT, f), "utf8");

function built() {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "share-"));
    build(out);
    return out;
}

test("share build carries every file the manifest and the extension pages load", () => {
    const out = built();
    const ext = path.join(out, "extension");
    const m = JSON.parse(fs.readFileSync(path.join(ext, "manifest.json"), "utf8"));
    const need = [m.background.service_worker, m.action.default_popup, m.options_ui.page,
        ...Object.values(m.icons), ...m.content_scripts.flatMap(c => c.js)];
    for (const page of ["popup.html", "options.html"]) {
        for (const [, src] of R(page).matchAll(/<script src="([^"]+)"/g)) need.push(src);
        for (const [, href] of R(page).matchAll(/<link[^>]+href="([^"]+\.css)"/g)) need.push(href);
    }
    for (const f of need) assert.ok(fs.existsSync(path.join(ext, f)), `missing ${f}`);
    for (const f of EXT_TOOLS) assert.ok(fs.existsSync(path.join(ext, "tools", f)), `missing tools/${f}`);
    assert.match(fs.readFileSync(path.join(ext, "tools", "vieneu-autostart.cmd"), "utf8"), /\r\n/);
    fs.rmSync(out, { recursive: true, force: true });
});

test("share build leaves the private parts out", () => {
    const out = built();
    assert.deepEqual(fs.readdirSync(out).sort(),
        [".gitattributes", ".github", "LICENSE-Apache-2.0.txt", "NOTICE", "README.md", "extension", "install-mac.sh",
            "install-windows.ps1", "vieneu"]);
    const ext = fs.readdirSync(path.join(out, "extension"));
    for (const f of ["docs", "tests", "review-archive", "CLAUDE.md", "package.json", "README.md"]) {
        assert.ok(!ext.includes(f), `${f} must not ship`);
    }
    assert.deepEqual(fs.readdirSync(path.join(out, "extension", "tools")).sort(), [...EXT_TOOLS].sort());
    fs.rmSync(out, { recursive: true, force: true });
});

test("Windows scripts are ASCII only, so Windows PowerShell 5.1 reads them unchanged", () => {
    for (const f of ["tools/share/install-windows.ps1", "tools/vieneu-autostart.ps1", "tools/vieneu-autostart.cmd", "tools/vieneu-runner.pyw", "tools/dichphude-update.py", "tools/vieneu-pin.py"]) {
        const bad = R(f).split("\n").findIndex(l => /[^\x00-\x7f]/.test(l));
        assert.equal(bad, -1, `${f} line ${bad + 1} is not ASCII`);
    }
    // `irm | iex` runs in the user's window: exit would close it
    assert.doesNotMatch(R("tools/share/install-windows.ps1"), /^\s*exit\b/m);
});

test("both installers pin the same VieNeu commit, and the shipped server file carries the patch", () => {
    const pin = f => (R(f).match(/VIENEU_COMMIT="([0-9a-f]{40})"|\$VieNeuCommit = '([0-9a-f]{40})'/) || []).slice(1).find(Boolean);
    const mac = pin("tools/share/install-mac.sh");
    assert.ok(mac);
    assert.equal(pin("tools/share/install-windows.ps1"), mac);
    assert.match(R("tools/share/vieneu/openai_speech.py"), /class _Lease/);
    // Both keep the extension in one fixed folder: Chrome keys settings and the API key to its path
    assert.match(R("tools/share/install-mac.sh"), /\$HOME\/DichPhuDe/);
    assert.match(R("tools/share/install-windows.ps1"), /'DichPhuDe'/);
});

test("the pinned VieNeu model is complete, hashed, and matches the VieNeu commit the installers use", () => {
    const pin = JSON.parse(R("tools/share/vieneu-model.json"));
    const repos = Object.fromEntries(pin.repos.map(r => [r.repo, r]));
    for (const r of pin.repos) {
        assert.match(r.revision, /^[0-9a-f]{40}$/, r.repo);
        for (const f of r.files) {
            assert.match(f.sha256, /^[0-9a-f]{64}$/, f.path);
            assert.ok(Number.isInteger(f.size) && f.size > 0, f.path);
        }
    }
    // What the server loads at start (server.log, 2026-10-07): a missing one fails offline
    const need = {
        "pnnbao-ump/VieNeu-TTS-v3-Turbo": ["config.json", "denoiser.onnx", "onnx_update/config.json",
            "onnx_update/tokenizer.json", "onnx_update/vieneu_prefill.onnx", "onnx_update/vieneu_decode_step.onnx",
            "onnx_update/vieneu_acoustic_cached.onnx", "onnx_update/vieneu_backbone_shared.data",
            "onnx_update/vieneu_v3_heads.npz"],
        "OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX": ["codec_browser_onnx_meta.json",
            "moss_audio_tokenizer_decode_full.onnx", "moss_audio_tokenizer_decode_shared.data",
            "moss_audio_tokenizer_decode_step.onnx", "moss_audio_tokenizer_encode.onnx",
            "moss_audio_tokenizer_encode.data"],
    };
    for (const [repo, files] of Object.entries(need)) {
        assert.ok(repos[repo], `missing repo ${repo}`);
        const have = new Set(repos[repo].files.map(f => f.path));
        for (const f of files) assert.ok(have.has(f), `${repo} ${f}`);
    }
    // The voices (Mỹ Duyên among them) live in the VieNeu code: the pin must name the installers' commit
    const mac = R("tools/share/install-mac.sh").match(/VIENEU_COMMIT="([0-9a-f]{40})"/)[1];
    assert.equal(pin.voices.commit, mac);
    assert.match(pin.voices.sha256, /^[0-9a-f]{64}$/);
});

// ---- The pinned model in friends' installs (BACKLOG 42, closed 2026-10-11) ----


const PY = ["python3", "python"].find(p => spawnSync(p, ["--version"]).status === 0);
const py = (args, opts = {}) => spawnSync(PY, args, {
    encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", DPD_MODEL_URL: "" }, ...opts });

test("the pin names a release whose flat asset names are unique and derived from repo + path", () => {
    const pin = JSON.parse(R("tools/share/vieneu-model.json"));
    assert.equal(pin.release.repo, "mrthanhduy2000/dich-phu-de-long-tieng");
    // Both revisions in the tag: a change to either repo alone never overwrites older assets
    assert.equal(pin.release.tag, releaseTag(pin));
    assert.match(pin.release.tag, /^vieneu-model-[0-9a-f]{7}-[0-9a-f]{7}$/);
    const names = pin.repos.flatMap(r => r.files.map(f => {
        assert.equal(f.asset, assetName(r.repo, f.path), f.path);
        assert.match(f.asset, /^[A-Za-z0-9._-]+$/, `${f.asset} must be flat and plain`);
        return f.asset;
    }));
    assert.equal(names.length, 15);
    assert.equal(new Set(names).size, names.length, "asset names collide");
    // The release plan uploads exactly these, at the pinned sizes, with the attribution
    const plan = releaseAssets(pin, "/hf");
    assert.deepEqual(plan.map(a => a.name), names);
    assert.ok(plan.every(a => a.from.startsWith("/hf/hub/models--") && a.from.includes("/snapshots/")));
    const notes = releaseNotes(pin);
    for (const r of pin.repos) assert.ok(notes.includes(r.revision), r.repo);
    assert.match(notes, /Apache License, Version 2\.0/);
});

test("the share build ships the pin tool, its pin, the license and a NOTICE naming both works", () => {
    const out = built();
    const tools = path.join(out, "extension", "tools");
    for (const f of ["vieneu-pin.py", "vieneu-model.json"]) assert.ok(EXT_TOOLS.includes(f), f);
    assert.equal(fs.readFileSync(path.join(tools, "vieneu-model.json"), "utf8"), R("tools/share/vieneu-model.json"));
    assert.equal(fs.readFileSync(path.join(tools, "vieneu-pin.py"), "utf8"), R("tools/vieneu-pin.py"));
    const pin = JSON.parse(R("tools/share/vieneu-model.json"));
    const text = fs.readFileSync(path.join(out, "NOTICE"), "utf8");
    assert.equal(text, notice(pin));
    for (const r of pin.repos) assert.ok(text.includes(r.repo) && text.includes(r.revision), r.repo);
    assert.ok(text.includes(pin.voices.commit) && /MODIFIED/.test(text));
    assert.match(fs.readFileSync(path.join(out, "LICENSE-Apache-2.0.txt"), "utf8"), /Apache License\s+Version 2\.0, January 2004/);
    fs.rmSync(out, { recursive: true, force: true });
});

test("both installers install the model with VieNeu's Python after uv sync and before the server starts", () => {
    const mac = R("tools/share/install-mac.sh");
    const win = R("tools/share/install-windows.ps1");
    const order = (text, marks) => marks.map(m => { const i = text.indexOf(m); assert.ok(i >= 0, m); return i; });
    const m = order(mac, ["\"$UV\" sync", "\"$VN_DIR/.venv/bin/python\" \"$EXT_DIR/tools/vieneu-pin.py\" --install", "vieneu-autostart.command\""]);
    assert.ok(m[0] < m[1] && m[1] < m[2], "mac: uv sync, then the model, then the server");
    const w = order(win, ["& $uv sync", "\"$VnDir\\.venv\\Scripts\\python.exe\" \"$ExtDir\\tools\\vieneu-pin.py\" --install", "Invoke-Autostart $null"]);
    assert.ok(w[0] < w[1] && w[1] < w[2], "windows: uv sync, then the model, then the server");
    // A failed model install warns and goes on (the server then fetches it itself): never die/throw
    assert.match(mac, /if ! "\$VN_DIR\/\.venv\/bin\/python" "\$EXT_DIR\/tools\/vieneu-pin\.py" --install[^\n]*then\n\s+if \[\[ -f/);
    assert.doesNotMatch(win.slice(w[1], w[2]), /\bthrow\b/);
    // The uninstallers keep clearing the cache older installs filled
    assert.match(mac, /\.cache\/huggingface\/hub\/models--pnnbao-ump--/);
    assert.match(win, /models--pnnbao-ump--\*/);
});

test("every start script goes offline only behind the pinned-model marker", () => {
    // Lines that set HF_HUB_OFFLINE must sit right under (or on) the marker check
    for (const f of ["tools/vieneu-autostart.command", "tools/vieneu-runner.pyw", "tools/share/install-mac.sh"]) {
        const lines = R(f).split("\n");
        const sets = lines.map((l, i) => [l, i]).filter(([l]) => /HF_HUB_OFFLINE[=]|HF_HUB_OFFLINE="1"/.test(l) && !/^\s*#/.test(l));
        assert.ok(sets.length >= 1, `${f} never sets HF_HUB_OFFLINE`);
        for (const [l, i] of sets) {
            const near = lines.slice(Math.max(0, i - 4), i + 1).join("\n");
            assert.match(near, /pinned-ok|PIN_MARK/, `${f} line ${i + 1} sets HF_HUB_OFFLINE without the marker: ${l.trim()}`);
        }
    }
    // Windows: the runner decides at every start; the Run value and the installer set nothing
    for (const f of ["tools/vieneu-autostart.ps1", "tools/share/install-windows.ps1"]) {
        assert.doesNotMatch(R(f).split("\n").filter(l => !/^\s*#/.test(l)).join("\n"), /HF_HUB_OFFLINE|HF_HOME/, f);
    }
    // The macOS plist keeps the full Python path as one string: the installer recognises its service by it
    assert.match(R("tools/vieneu-autostart.command"), /<string>\$APP\/\.venv\/bin\/python<\/string>/);
    // XML comments may not hold a double hyphen: the plist would not load
    for (const [, c] of R("tools/vieneu-autostart.command").matchAll(/<!--([\s\S]*?)-->/g)) assert.doesNotMatch(c, /--/);
});

test("DPD_REF makes the installers and the updater fetch the commit under test", () => {
    assert.match(R("tools/share/install-mac.sh"), /REF="\$\{DPD_REF:-refs\/heads\/main\}"[\s\S]*codeload\.github\.com\/\$REPO\/zip\/\$REF/);
    assert.match(R("tools/share/install-windows.ps1"), /\$env:DPD_REF[\s\S]*codeload\.github\.com\/\$Repo\/zip\/\$ref/);
    const upd = R("tools/dichphude-update.py");
    assert.match(upd, /REF = os\.environ\.get\("DPD_REF", ""\)/);
    assert.match(upd, /zip\/%s" % \(REPO, REF or "refs\/heads\/main"\)/);
    assert.match(upd, /%s\/%s\/extension\/manifest\.json" % \(REPO, REF or "main"\)/);
    const ci = R("tools/share/.github/workflows/install-test.yml");
    assert.equal((ci.match(/DPD_REF: \$\{\{ github\.sha \}\}/g) || []).length, 2, "both install jobs");
    assert.match(ci, /vieneu-pin\.py" --vieneu \$vn/);                 // Windows: every byte
    assert.match(ci, /grep -x HF_HUB_OFFLINE=1/);                       // macOS: the server's own env
});

// A tiny pin of two fake repos, served from a file:// mirror: the install path end to end, offline
function fakeModel() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pin-"));
    const mirror = path.join(dir, "mirror");
    fs.mkdirSync(mirror);
    const mk = (repo, rev, files) => ({ repo, revision: rev, files: files.map(([p, body]) => {
        const asset = assetName(repo, p);
        fs.writeFileSync(path.join(mirror, asset), body);
        return { path: p, asset, size: Buffer.byteLength(body), sha256: crypto.createHash("sha256").update(body).digest("hex") };
    }) });
    const pin = {
        release: { repo: "x/y", tag: "t" },
        repos: [mk("org/Model-A", "a".repeat(40), [["config.json", "{\"a\":1}"], ["onnx/w.data", "w".repeat(70000)]]),
            mk("org2/Model-B", "b".repeat(40), [["b.onnx", "bbbb"]])],
        voices: { path: "voices.json", size: 1, sha256: "0".repeat(64) },
    };
    fs.writeFileSync(path.join(dir, "pin.json"), JSON.stringify(pin));
    const hf = path.join(dir, "hf");
    const run = (...extra) => py([path.join(ROOT, "tools", "vieneu-pin.py"), "--install", "--pin", path.join(dir, "pin.json"),
        "--hf-home", hf, "--vieneu", path.join(dir, "none"), "--base-url", pathToFileURL(mirror).href, "--no-hf", ...extra]);
    const file = (r, p) => path.join(hf, "hub", "models--" + r.replace("/", "--"), "snapshots", (r === "org/Model-A" ? "a" : "b").repeat(40), ...p.split("/"));
    return { dir, mirror, hf, pin, run, file, marker: path.join(hf, ".pinned-ok") };
}

test("vieneu-pin.py --install lays the cache, checks every byte, and is idempotent", { skip: !PY && "no python3" }, () => {
    const m = fakeModel();
    // A leftover partial file from a cut download must not end up in the result
    fs.mkdirSync(path.dirname(m.file("org/Model-A", "onnx/w.data")), { recursive: true });
    fs.writeFileSync(m.file("org/Model-A", "onnx/w.data") + ".part", "w".repeat(1000));
    let r = m.run();
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(fs.readFileSync(m.file("org/Model-A", "onnx/w.data"), "utf8"), "w".repeat(70000));
    assert.ok(!fs.existsSync(m.file("org/Model-A", "onnx/w.data") + ".part"));
    // Offline lookups resolve "main" through refs/main; the marker names both revisions
    assert.equal(fs.readFileSync(path.join(m.hf, "hub", "models--org2--Model-B", "refs", "main"), "utf8"), "b".repeat(40));
    assert.match(fs.readFileSync(m.marker, "utf8"), new RegExp(`^org/Model-A@${"a".repeat(40)}\norg2/Model-B@${"b".repeat(40)}\nfiles [0-9a-f]{16}\n$`));
    assert.match(r.stdout, /tai moi 0\.1 MB \(GitHub 3 tep\)/);
    // A second run downloads nothing; --if-changed does not even hash
    fs.rmSync(m.mirror, { recursive: true });
    r = m.run();
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /tai moi 0\.0 MB, /);
    r = m.run("--if-changed");
    assert.equal(r.status, 0);
    assert.match(r.stdout, /khong can tai/);
    // An older revision's snapshot goes once the new pin is complete
    const old = path.join(m.hf, "hub", "models--org2--Model-B", "snapshots", "c".repeat(40));
    fs.mkdirSync(old, { recursive: true });
    m.run("--if-changed");
    assert.ok(!fs.existsSync(old));
    fs.rmSync(m.dir, { recursive: true, force: true });
});

test("vieneu-pin.py --install refuses wrong bytes, keeps no marker, and holds a lock", { skip: !PY && "no python3" }, () => {
    const m = fakeModel();
    const asset = path.join(m.mirror, assetName("org2/Model-B", "b.onnx"));
    fs.writeFileSync(asset, "bbbX");                                    // same size, one byte off
    let r = m.run();
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /Tu choi: ma sha256 khac ban da khoa/);
    assert.ok(!fs.existsSync(m.marker), "no marker over a wrong file");
    assert.ok(!fs.existsSync(m.file("org2/Model-B", "b.onnx")), "the wrong bytes never land");
    assert.ok(fs.existsSync(m.file("org/Model-A", "onnx/w.data")), "the good files are kept for the next run");
    assert.ok(!fs.existsSync(path.join(m.hf, "hub", "models--org2--Model-B", "refs", "main")));
    // Fixed mirror: the next run fetches only the missing file
    fs.writeFileSync(asset, "bbbb");
    r = m.run();
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /Can tai 1 tep/);
    // A marker for this pin over a file that went bad later is withdrawn when it cannot be repaired
    fs.writeFileSync(m.file("org2/Model-B", "b.onnx"), "bbbY");
    fs.writeFileSync(asset, "bbbZ");
    r = m.run();
    assert.equal(r.status, 1);
    assert.ok(!fs.existsSync(m.marker), "a lying marker is removed: the server then starts online");
    // Another install running (the background updater): exit 2, nothing touched
    fs.writeFileSync(path.join(m.hf, ".pin-lock"), "123");
    r = m.run();
    assert.equal(r.status, 2, r.stdout);
    fs.rmSync(m.dir, { recursive: true, force: true });
});

test("the Windows runner sets HF_HOME and HF_HUB_OFFLINE only when the marker exists", { skip: !PY && "no python3" }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "runner-"));
    fs.copyFileSync(path.join(ROOT, "tools", "vieneu-runner.pyw"), path.join(dir, "run_vieneu.py"));
    const probe = "import json, os, sys; sys.path.insert(0, sys.argv[1]); import run_vieneu as r; " +
        "on = r.use_pinned_model(); print(json.dumps([on, os.environ.get('HF_HOME'), os.environ.get('HF_HUB_OFFLINE')]))";
    const ask = () => JSON.parse(py(["-c", probe, dir], { env: { PATH: process.env.PATH, PYTHONDONTWRITEBYTECODE: "1" } }).stdout);
    assert.deepEqual(ask(), [false, null, null]);
    fs.mkdirSync(path.join(dir, "models", "hf"), { recursive: true });
    fs.writeFileSync(path.join(dir, "models", "hf", ".pinned-ok"), "x");
    const [on, home, offline] = ask();
    assert.equal(on, true);
    assert.equal(fs.realpathSync(home), fs.realpathSync(path.join(dir, "models", "hf")));
    assert.equal(offline, "1");
    fs.rmSync(dir, { recursive: true, force: true });
});
