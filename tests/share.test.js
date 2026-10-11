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
const { build, EXT_TOOLS, notice, releaseAssets, releaseNotes, releaseTag, assetName, releaseModel, publishCheck } =
    require("../tools/publish-share.js");

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

// ---- The pinned model in friends' installs (BACKLOG 42: open until the release is published and
// the install test is green on all 5 machines) ----


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
    // Lines that set HF_HUB_OFFLINE must sit right under (or on) the marker check; what that check
    // does is run for real below ("start scripts read the pinned copy only while...")
    for (const f of ["tools/vieneu-autostart.command", "tools/vieneu-runner.pyw", "tools/share/install-mac.sh"]) {
        const lines = R(f).split("\n");
        const sets = lines.map((l, i) => [l, i]).filter(([l]) => /HF_HUB_OFFLINE[=]|HF_HUB_OFFLINE="1"/.test(l) && !/^\s*#/.test(l));
        assert.ok(sets.length >= 1, `${f} never sets HF_HUB_OFFLINE`);
        for (const [l, i] of sets) {
            const near = lines.slice(Math.max(0, i - 4), i + 1).join("\n");
            assert.match(near, /pinned-ok|PIN_MARK|pinned_ok|pinned_copy_ok/, `${f} line ${i + 1} sets HF_HUB_OFFLINE without the marker: ${l.trim()}`);
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
        voices: { commit: "c".repeat(40), path: "voices.json", size: 1, sha256: "0".repeat(64) },
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
    // Offline lookups resolve "main" through refs/main. The marker names both revisions and the
    // VieNeu commit, then lists what the start scripts stat: each refs/main and each file's size
    assert.equal(fs.readFileSync(path.join(m.hf, "hub", "models--org2--Model-B", "refs", "main"), "utf8"), "b".repeat(40));
    const [head, list] = fs.readFileSync(m.marker, "utf8").split("\n\n");
    assert.match(head, new RegExp(`^org/Model-A@${"a".repeat(40)}\norg2/Model-B@${"b".repeat(40)}\nvoices ${"c".repeat(40)}\nfiles [0-9a-f]{16}$`));
    assert.deepEqual(list.trimEnd().split("\n"), [
        `ref ${"a".repeat(40)} hub/models--org--Model-A/refs/main`,
        `size 7 hub/models--org--Model-A/snapshots/${"a".repeat(40)}/config.json`,
        `size 70000 hub/models--org--Model-A/snapshots/${"a".repeat(40)}/onnx/w.data`,
        `ref ${"b".repeat(40)} hub/models--org2--Model-B/refs/main`,
        `size 4 hub/models--org2--Model-B/snapshots/${"b".repeat(40)}/b.onnx`]);
    for (const line of list.trimEnd().split("\n")) {
        const [kind, value, rel] = line.split(" ");
        const p = path.join(m.hf, ...rel.split("/"));
        if (kind === "ref") assert.equal(fs.readFileSync(p, "utf8"), value);
        else assert.equal(fs.statSync(p).size, Number(value), rel);
    }
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

// ---- Start scripts: the macOS service line, the installer's cst-start.command, the Windows runner ----

// zsh writes here-documents under TMPPREFIX (default /tmp/zsh), which a sandbox may forbid
const TMP_ENV = { TMPDIR: os.tmpdir(), TMPPREFIX: process.env.TMPPREFIX || path.join(os.tmpdir(), "zsh") };

// The ProgramArguments strings of a plist, entities decoded
const plistArgs = text => [...text.split("<key>ProgramArguments</key>")[1].split("</array>")[0].matchAll(/<string>([\s\S]*?)<\/string>/g)]
    .map(([, s]) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&"));

// A VieNeu folder whose Python is a stub that prints what the server would get, and a pinned copy
// laid by the real vieneu-pin.py --install from the fake mirror
function startWorld() {
    const m = fakeModel();
    const app = path.join(m.dir, "VieNeu-TTS");
    const home = path.join(m.dir, "home");
    const bin = path.join(m.dir, "bin");
    for (const d of [path.join(app, ".venv", "bin"), home, bin]) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(app, ".venv", "bin", "python"),
        "#!/bin/sh\necho \"ARGS $*\"\necho \"HF_HOME=${HF_HOME-unset}\"\necho \"OFFLINE=${HF_HUB_OFFLINE-unset}\"\n", { mode: 0o755 });
    // launchctl must never run under --write-only: a stub records any call
    fs.writeFileSync(path.join(bin, "launchctl"), `#!/bin/sh\necho "$*" >> "${path.join(m.dir, "launchctl.calls")}"\n`, { mode: 0o755 });
    const hf = path.join(app, "models", "hf");
    const r = py([path.join(ROOT, "tools", "vieneu-pin.py"), "--install", "--pin", path.join(m.dir, "pin.json"), "--hf-home", hf,
        "--vieneu", app, "--base-url", pathToFileURL(m.mirror).href, "--no-hf"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const file = (repo, p) => path.join(hf, "hub", "models--" + repo.replace("/", "--"), "snapshots",
        (repo === "org/Model-A" ? "a" : "b").repeat(40), ...p.split("/"));
    return { ...m, app, home, bin, hf, file, env: { PATH: `${bin}:${process.env.PATH}`, HOME: home, ...TMP_ENV } };
}

// Every way the copy can be, from a whole one to one that only looks marked
function* copyStates(w) {
    yield ["whole", true];
    const data = w.file("org/Model-A", "onnx/w.data");
    const body = fs.readFileSync(data);
    fs.truncateSync(data, 1000);
    yield ["a file cut short", false];
    fs.rmSync(data);
    yield ["a file deleted", false];
    fs.writeFileSync(data, body);
    const ref = path.join(w.hf, "hub", "models--org2--Model-B", "refs", "main");
    fs.writeFileSync(ref, "d".repeat(40));
    yield ["refs/main moved", false];
    fs.writeFileSync(ref, "b".repeat(40));
    const marker = fs.readFileSync(path.join(w.hf, ".pinned-ok"), "utf8");
    fs.writeFileSync(path.join(w.hf, ".pinned-ok"), marker.split("\n\n")[0] + "\n");
    yield ["a marker that lists nothing", false];
    fs.rmSync(path.join(w.hf, ".pinned-ok"));
    yield ["no marker", false];
    fs.writeFileSync(path.join(w.hf, ".pinned-ok"), marker);
    yield ["whole again", true];
}

function expectStart(out, offline, w, what) {
    const hf = fs.realpathSync(w.hf);
    assert.match(out, /ARGS -m apps\.openai_speech/, what);
    if (offline) {
        assert.match(out, /^VieNeu model: pinned copy in models\/hf, offline$/m, what);
        assert.equal(fs.realpathSync(out.match(/^HF_HOME=(.*)$/m)[1]), hf, what);
        assert.match(out, /^OFFLINE=1$/m, what);
    } else {
        assert.doesNotMatch(out, /offline/, what);
        assert.match(out, /^HF_HOME=unset$/m, what);
        assert.match(out, /^OFFLINE=unset$/m, what);
    }
}

test("start scripts read the pinned copy only while every file the marker lists is whole",
    { skip: (process.platform !== "darwin" && "the start line is macOS sh (stat -f)") || (!PY && "no python3") }, () => {
    const w = startWorld();
    // 1. The service plist, as vieneu-autostart.command --write-only writes it, run as launchd runs
    // it: /bin/sh -c <line> <python>, in the VieNeu folder, with no inherited HF_* variables
    let r = spawnSync("/bin/zsh", [path.join(ROOT, "tools", "vieneu-autostart.command"), "--write-only"],
        { encoding: "utf8", env: { ...w.env, VIENEU_DIR: w.app } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const plist = fs.readFileSync(path.join(w.home, "Library", "LaunchAgents", "com.damduy.vieneu.plist"), "utf8");
    if (fs.existsSync("/usr/bin/plutil")) {
        const lint = spawnSync("/usr/bin/plutil", ["-lint", path.join(w.home, "Library", "LaunchAgents", "com.damduy.vieneu.plist")], { encoding: "utf8" });
        assert.equal(lint.status, 0, lint.stdout);
    }
    const [sh, dashC, line, python] = plistArgs(plist);
    assert.deepEqual([sh, dashC, python], ["/bin/sh", "-c", path.join(w.app, ".venv", "bin", "python")]);
    assert.ok(!fs.existsSync(path.join(w.dir, "launchctl.calls")), "--write-only never calls launchctl");
    // 2. The installer's cst-start.command, expanded as install-mac.sh's heredoc expands it
    const mac = R("tools/share/install-mac.sh");
    const body = mac.split('cat > "$VN_DIR/cst-start.command" <<EOF\n')[1].split("\nEOF\n")[0];
    const gen = spawnSync("/bin/bash", ["-c", `cat <<EOF\n${body}\nEOF\n`],
        { encoding: "utf8", env: { PATH: process.env.PATH, VN_DIR: w.app, PORT: "8000", PIN_MARK: "models/hf/.pinned-ok" } });
    assert.equal(gen.status, 0, gen.stderr);
    const cst = path.join(w.app, "cst-start.command");
    fs.writeFileSync(cst, gen.stdout, { mode: 0o755 });
    // 3. The Windows runner's own check (its start does the rest on Windows only)
    fs.copyFileSync(path.join(ROOT, "tools", "vieneu-runner.pyw"), path.join(w.dir, "run_vieneu.py"));
    const probe = "import json, os, sys; sys.path.insert(0, sys.argv[1]); import run_vieneu as r; r.HERE = sys.argv[2]; " +
        "on = r.use_pinned_model(); print(json.dumps([on, os.environ.get('HF_HOME'), os.environ.get('HF_HUB_OFFLINE')]))";
    const runner = () => JSON.parse(py(["-c", probe, w.dir, w.app], { env: { PATH: process.env.PATH, PYTHONDONTWRITEBYTECODE: "1" } }).stdout);
    for (const [state, offline] of copyStates(w)) {
        r = spawnSync("/bin/sh", ["-c", line, python], { cwd: w.app, encoding: "utf8", env: { PATH: process.env.PATH } });
        assert.equal(r.status, 0, r.stderr);
        expectStart(r.stdout, offline, w, `plist line, ${state}`);
        for (const shell of ["/bin/sh", "/bin/zsh"]) {
            r = spawnSync(shell, [cst], { cwd: w.dir, encoding: "utf8", env: { PATH: process.env.PATH } });
            assert.equal(r.status, 0, r.stderr);
            expectStart(r.stdout, offline, w, `cst-start under ${shell}, ${state}`);
        }
        const [on, home, off] = runner();
        assert.equal(on, offline ? "offline" : state === "no marker" ? "online" : "incomplete", `runner, ${state}`);
        assert.deepEqual([home && fs.realpathSync(home), off], offline ? [fs.realpathSync(w.hf), "1"] : [null, null], `runner, ${state}`);
    }
    fs.rmSync(w.dir, { recursive: true, force: true });
});

// ---- tools/vieneu-pin.py and the updater, network replaced (tests/pin-cases.py) ----

function pinCase(name) {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), `pincase-${name}-`));
    const home = path.join(work, "home");
    fs.mkdirSync(home);
    const r = py([path.join(__dirname, "pin-cases.py"), name, work],
        { env: { PATH: process.env.PATH, HOME: home, PYTHONDONTWRITEBYTECODE: "1", ...TMP_ENV } });
    fs.rmSync(work, { recursive: true, force: true });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    return JSON.parse(r.stdout.trim().split("\n").pop());
}
const skipPy = { skip: !PY && "no python3" };

test("the updater repairs a pinned copy that lost a file, or withdraws its marker so the server starts online", skipPy, () => {
    const r = pinCase("updater_repair");
    assert.equal(r.quick_ok_installed, true);
    assert.deepEqual(r.log_when_whole, [], "a whole copy: stat only, nothing logged");
    // A truncated file under a marker that still names this pin
    assert.equal(r.quick_ok_truncated, false);
    assert.equal(r.repaired, true, "repaired from the release");
    assert.equal(r.quick_ok_repaired, true);
    assert.match(r.log.join("\n"), /model: the pinned copy is damaged[^\n]*repairing it\nmodel: exit 0: Mo hinh giong da khoa/);
    // Deleted, and no source has it: the lying marker goes (the next start runs online, never a crash loop)
    assert.equal(r.marker_left, false);
    assert.match(r.log.at(-1), /^model: exit 1: /);
});

test("vieneu-pin.py keeps retrying while bytes arrive, and gives a silent source up after 3 empty attempts", skipPy, () => {
    const { progress, silent, slow, tries } = pinCase("stalls");
    assert.equal(tries, 3);
    // Five cuts in a row, each after 20 KB: every attempt made progress, so none counts against it
    assert.equal(progress.ok, true, progress.said);
    assert.equal(progress.calls, 6);
    assert.deepEqual(progress.ranges.slice(1), ["bytes=20000-", "bytes=40000-", "bytes=60000-", "bytes=80000-", "bytes=100000-"]);
    assert.equal(progress.landed_good, true);
    assert.deepEqual(progress.dead, []);
    // Nothing received three times in a row: the source is dead for the remaining files
    assert.equal(silent.ok, false);
    assert.equal(silent.calls, 3);
    assert.deepEqual(silent.dead, ["GitHub"]);
    assert.deepEqual(silent.sleeps, [3, 6]);
    // Progress every time but past 2 hours on one file: this source is left for the next one, not dead
    assert.equal(slow.ok, false);
    assert.equal(slow.calls, 3);
    assert.deepEqual(slow.dead, []);
    assert.match(slow.said, /Qua 2 gio cho tep nay tu GitHub/);
    assert.equal(slow.part_len, 3000, "what arrived is kept for the next source");
});

test("a resumed .part with a corrupt prefix is fetched again from zero; a 200 that ignores Range never truncates it", skipPy, () => {
    const { resumed, ignored_bad, ignored_good, ignored_cut } = pinCase("corrupt_prefix");
    // The hash fails after a resume: the part goes and the same URL is tried once from zero
    assert.equal(resumed.ok, true, resumed.said);
    assert.deepEqual(resumed.ranges, ["bytes=50000-", null]);
    assert.equal(resumed.landed_good, true);
    // A server that ignores Range and sends wrong bytes: refused, the good partial file untouched
    assert.equal(ignored_bad.ok, false);
    assert.equal(ignored_bad.part_len, 50000);
    assert.equal(ignored_bad.part_prefix_good, true);
    assert.equal(ignored_bad.new_left, false);
    // ... and right bytes: swapped in only once their hash matched
    assert.equal(ignored_good.ok, true);
    assert.equal(ignored_good.landed_good, true);
    // ... cut short: the unproven bytes are dropped, the partial file stays as it was
    assert.equal(ignored_cut.part_len, 50000);
    assert.equal(ignored_cut.part_prefix_good, true);
    assert.equal(ignored_cut.new_left, false);
});

test("a full-size .part with one wrong byte never lands", skipPy, () => {
    const { refetched, nowhere } = pinCase("full_part");
    assert.equal(refetched.ok, true);
    assert.deepEqual(refetched.ranges, [null], "fetched whole, not resumed past the wrong byte");
    assert.equal(refetched.landed_good, true);
    assert.equal(nowhere.ok, false);
    assert.equal(nowhere.landed, false);
    assert.equal(nowhere.part_len, null, "the wrong part is removed");
});

test("HTTP: only 404/410 mean the file is absent; 408/425/429/5xx wait (Retry-After, 30 s at most); 401/403/407 are a blocked network", skipPy, () => {
    const h = pinCase("http");
    for (const k of ["gh404", "gh410"]) {
        assert.deepEqual(h[k].dead, ["GitHub"], k);
        assert.match(h[k].said, /Chua co ban phat hanh tren GitHub/, k);
    }
    for (const k of ["gh403", "proxy"]) {
        assert.deepEqual(h[k].dead, ["GitHub"], k);
        assert.match(h[k].said, /Mang hoac proxy chan ket noi toi GitHub/, k);
        assert.doesNotMatch(h[k].said, /phat hanh|khong co tep nay/, `${k} is not a missing release`);
    }
    assert.deepEqual([h.busy.ok, h.busy.sleeps], [true, [7]], "503 Retry-After: 7");
    assert.deepEqual([h.capped.ok, h.capped.sleeps], [true, [30]], "429 Retry-After: 120, capped");
    assert.deepEqual([h.dated.ok, h.dated.sleeps], [true, [0]], "a Retry-After date in the past");
    assert.deepEqual([h.timeout.ok, h.timeout.sleeps], [true, [3]], "408 without Retry-After");
    assert.deepEqual([h.down.ok, h.down.calls, h.down.dead], [false, 3, ["GitHub"]], "500 three times");
    assert.deepEqual([h.odd.ok, h.odd.calls, h.odd.dead], [false, 1, []], "400: refused for this file only");
});

test("Hugging Face URLs name the pinned revision, never main", skipPy, () => {
    const { both, derived } = pinCase("sources");
    assert.deepEqual(both[0], ["GitHub", "https://github.com/x/y/releases/download/t/Model-A__onnx dir__w.data"]);
    assert.deepEqual(both[1], ["Hugging Face", `https://huggingface.co/org/Model-A/resolve/${"a".repeat(40)}/onnx%20dir/w.data`]);
    assert.doesNotMatch(both[1][1], /\/resolve\/main\//);
    assert.deepEqual(derived, [["GitHub", "file:///m/Model-A__c.json"]], "asset name derived when the pin has none; no Hugging Face");
});

test("the pin id names the VieNeu commit; a failed install withdraws a marker made for other VieNeu code", skipPy, () => {
    const r = pinCase("marker");
    assert.equal(r.differs, true);
    assert.equal(r.names_commit, true);
    assert.equal(r.other_code_removed, true);
    assert.equal(r.same_code_kept, true, "an older model on the same code still loads");
    assert.equal(r.own_removed, true);
});

test("a stale model lock is taken over by one run only", skipPy, () => {
    const r = pinCase("lock");
    assert.equal(r.stale_taken, true);
    // B judged the lock stale just before A took it over: B loses and A's fresh lock stays
    assert.equal(r.b_took, false);
    assert.equal(r.a_lock_kept, "A");
    assert.deepEqual(r.leftovers, []);
    assert.equal(r.loser_took, false, "the run that finds the stale lock already moved loses");
    assert.equal(r.exit_when_held, 2);
});

test("--fetch downloads the pinned revision and writes refs/main itself; a moved main is only reported", skipPy, () => {
    const r = pinCase("fetch");
    assert.deepEqual(r.calls[0], { call: "snapshot_download", repo: "org/Model-A", revision: "a".repeat(40) });
    assert.deepEqual(r.calls[1], { call: "model_info", repo: "org/Model-A", revision: "main" });
    assert.equal(r.ref, "a".repeat(40));
    assert.deepEqual(r.main_ref_files, ["main"]);
    assert.match(r.said, /org\/Model-A main is now fffffff, the pin is aaaaaaa: the copy stays on the pin/);
});

test("the updater rewrites only our own old service plist, once, through a helper that knows --write-only",
    { skip: (process.platform !== "darwin" && "macOS only") || (!PY && "no python3") }, () => {
    const r = pinCase("refresh_service");
    assert.equal(r.plist_in_fake_home, true);
    assert.equal(r.rewritten, true);
    assert.equal(r.second_run_same, true);
    assert.equal(r.foreign_untouched, true);
    assert.equal(r.old_helper_ran, false);
    assert.equal(r.old_plist_kept, true);
    assert.deepEqual(r.launchctl_calls, [], "the running server is never restarted");
    assert.deepEqual(r.log, ["service: plist rewritten for the pinned model, used from the next login"]);
});

test("the updater drops the old ~/.cache model only on our installs, once the server runs offline", skipPy, () => {
    const r = pinCase("old_cache");
    assert.deepEqual(r.ours_offline.left, ["models--someone--else"]);
    assert.equal(r.ours_offline.log.length, 1, "logged once over two runs");
    assert.match(r.ours_offline.log[0], /^model: removed the copy older versions left in ~\/\.cache\/huggingface/);
    for (const k of ["ours_online", "not_ours"]) {
        assert.equal(r[k].left.length, 3, k);
        assert.deepEqual(r[k].log, [], k);
    }
});

test("Stop-VieNeu also stops the updater and the model download of that VieNeu folder", () => {
    const ps = R("tools/vieneu-autostart.ps1");
    const start = ps.indexOf("function Stop-VieNeu");
    const fn = ps.slice(start, ps.indexOf("\n}\n", start));
    assert.match(fn, /\$all = @\(Get-CimInstance Win32_Process \| Where-Object \{ \$_\.CommandLine -and \$_\.CommandLine\.IndexOf\(\$App/);
    assert.match(fn, /\$helpers = \$all \| Where-Object \{ \$_\.CommandLine -match 'dichphude-update\\\.py\|vieneu-pin\\\.py' \}/);
    assert.match(fn, /foreach \(\$p in @\(\$supervisors\) \+ @\(\$helpers\) \+ @\(\$servers\)\)/);
    assert.match(fn, /Remove-Item \(Join-Path \$App 'models\\hf\\\.pin-lock'\)/);
    assert.match(ps, /if \(\$Stop -or \$Uninstall\) \{\s*Stop-VieNeu/);
    // The updater starts the download with the folder on its command line (VieNeu's Python, --vieneu)
    assert.match(R("tools/dichphude-update.py"), /\[sys\.executable, path, "--install", "--vieneu", HERE\]/);
    // The uninstall stops everything before it removes the folder
    const win = R("tools/share/install-windows.ps1");
    assert.ok(win.indexOf("Invoke-Autostart '-Uninstall'") < win.indexOf("Remove-Item $VnDir -Recurse -Force"));
});

test("the updater LaunchAgent carries DPD_REF only under the install test", () => {
    const mac = R("tools/share/install-mac.sh");
    const start = mac.indexOf("updater_plist() {");
    const fn = mac.slice(start, mac.indexOf("\n}\n", start) + 2);
    assert.match(mac, /updater_plist > "\$UPD_PLIST"/);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "updplist-"));
    const plist = ref => {
        const env = { PATH: process.env.PATH, UPD_LABEL: "com.damduy.dichphude.update", VN_DIR: "/Users/x/VieNeu-TTS" };
        if (ref) env.DPD_REF = ref;
        const r = spawnSync("/bin/bash", ["-c", `${fn}\nupdater_plist`], { encoding: "utf8", env });
        assert.equal(r.status, 0, r.stderr);
        if (fs.existsSync("/usr/bin/plutil")) {
            fs.writeFileSync(path.join(dir, "p.plist"), r.stdout);
            assert.equal(spawnSync("/usr/bin/plutil", ["-lint", path.join(dir, "p.plist")]).status, 0, r.stdout);
        }
        return r.stdout;
    };
    const ci = plist("0123abcd");
    assert.match(ci, /<key>EnvironmentVariables<\/key><dict><key>DPD_REF<\/key><string>0123abcd<\/string><\/dict>/);
    const friend = plist("");
    assert.doesNotMatch(friend, /EnvironmentVariables|DPD_REF/);
    assert.equal(friend, ci.replace(/ {4}<key>EnvironmentVariables<\/key>.*\n/, ""), "nothing else differs");
    assert.match(friend, /<string>\/Users\/x\/VieNeu-TTS\/dichphude-update\.py<\/string>/);
    fs.rmSync(dir, { recursive: true, force: true });
});

test("the install test fails without the model release and wants every model file from GitHub", { skip: !PY && "no python3" }, () => {
    const ci = R("tools/share/.github/workflows/install-test.yml");
    // The release job: a 404 fails (release first, then push), never a quiet exit 0
    const job = ci.slice(ci.indexOf("  model-release:"));
    assert.match(job, /if \[ "\$code" = 404 \]; then[^\n]*publish-share\.js --release-model[^\n]*exit 1; fi/);
    assert.doesNotMatch(job, /exit 0/);
    // Both install jobs keep the first install's output and read the model summary from it
    const win = ci.slice(ci.indexOf("  windows:"), ci.indexOf("  macos:"));
    const mac = ci.slice(ci.indexOf("  macos:"), ci.indexOf("  model-release:"));
    assert.match(win, /\$o = & \{ irm \$env:URL \| iex \} 6>&1 \| Out-String[\s\S]*WriteAllText\("\$env:RUNNER_TEMP\\install1\.log", \$o\)/);
    assert.match(mac, /run: curl -fsSL "\$URL" \| \/bin\/bash 2>&1 \| tee "\$RUNNER_TEMP\/install1\.log"/);
    const winRe = win.match(/if \(\$sum -notmatch "([^"]+)"\)/)[1];
    const macRe = mac.match(/grep -qE "([^"]+)" "\$RUNNER_TEMP\/install1\.log"/)[1];
    assert.match(win, /if \(\$log -match '\\\) tu Hugging Face'\) \{ throw/);
    assert.match(mac, /if grep -q '\) tu Hugging Face' "\$RUNNER_TEMP\/install1\.log"; then[^\n]*exit 1; fi/);
    // Those patterns, with the file count filled in, against what vieneu-pin.py really prints
    const m = fakeModel();
    const r = m.run();
    assert.equal(r.status, 0, r.stdout);
    const summary = r.stdout.split("\n").find(l => l.startsWith("Mo hinh giong da khoa:"));
    for (const re of [winRe, macRe]) {
        const real = new RegExp(re.replace("$n", "3"));
        assert.match(summary, real, re);
        assert.doesNotMatch(summary.replace("(GitHub 3 tep)", "(GitHub 2 tep, Hugging Face 1 tep)"), real, `${re} must refuse a mixed source`);
    }
    assert.match(r.stdout, /\) tu GitHub\n/, "the per-file source line the Hugging Face check looks for");
    fs.rmSync(m.dir, { recursive: true, force: true });
});

// ---- tools/publish-share.js: the push guard and the model release ----

test("publish-share refuses --push while shipped files changed but the version did not", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pubcheck-"));
    const pub = path.join(dir, "share");
    const git = (...a) => spawnSync("git", ["-C", pub, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false",
        "-c", "core.hooksPath=/dev/null", ...a], { encoding: "utf8" });
    build(pub);
    assert.equal(git("init", "-q").status, 0);
    git("add", "-A");
    assert.equal(git("commit", "-q", "-m", "published").status, 0);
    const fresh = path.join(dir, "fresh");
    build(fresh);
    // 1. Nothing changed: allowed (nothing to push)
    let c = publishCheck(fresh, pub);
    assert.deepEqual([c.ok, c.changed], [true, []]);
    // 2. Friends hold an older pin tool under this same version: refused, the file named
    const tool = path.join(pub, "extension", "tools", "vieneu-pin.py");
    fs.appendFileSync(tool, "# older\n");
    git("commit", "-qam", "older tool");
    c = publishCheck(fresh, pub);
    assert.equal(c.ok, false);
    assert.deepEqual(c.changed, ["extension/tools/vieneu-pin.py"]);
    assert.match(c.message, /bump the version first/);
    // 3. A plain build into the checkout changes only its working tree: the last commit still counts
    build(pub);
    assert.equal(publishCheck(fresh, pub).ok, false);
    git("checkout", "-q", "--", ".");
    // 4. The share repo holds a lower version: allowed
    const mf = path.join(pub, "extension", "manifest.json");
    const real = fs.readFileSync(mf, "utf8");
    fs.writeFileSync(mf, real.replace(/"version": "[^"]+"/, '"version": "0.0.1"'));
    git("commit", "-qam", "older version");
    c = publishCheck(fresh, pub);
    assert.equal(c.ok, true);
    assert.deepEqual(c.changed, ["extension/manifest.json", "extension/tools/vieneu-pin.py"]);
    // 5. Not a git checkout: its files on disk count
    const plain = path.join(dir, "plain");
    build(plain);
    fs.appendFileSync(path.join(plain, "install-mac.sh"), "# older\n");
    assert.equal(publishCheck(fresh, plain).ok, false);
    // 6. The command line: --push refused with exit 1, no commit, the checkout untouched
    fs.writeFileSync(mf, real);
    git("commit", "-qam", "same version, older tool");
    const head = git("rev-parse", "HEAD").stdout;
    const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "publish-share.js"), "--push", "--out", pub], { encoding: "utf8" });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /Refusing to push: 1 shipped file\(s\) differ[^\n]*bump the version first/);
    assert.equal(git("rev-parse", "HEAD").stdout, head);
    assert.equal(git("status", "--porcelain").stdout, "", "the share repo's files are as they were");
    fs.rmSync(dir, { recursive: true, force: true });
});

test("release-model checks every asset's GitHub sha256 digest and cleans its staging even when it throws", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "relmodel-"));
    const vieneu = path.join(dir, "VieNeu-TTS");
    // The two real repo names (the NOTICE names them), fake revisions and bytes
    const files = [["pnnbao-ump/VieNeu-TTS-v3-Turbo", "a".repeat(40), "onnx/w.data", "weights"],
        ["OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX", "b".repeat(40), "b.onnx", "bbbb"]];
    const repos = [];
    for (const [repo, revision, p, body] of files) {
        const at = path.join(vieneu, "models", "hf", "hub", "models--" + repo.replace("/", "--"), "snapshots", revision, ...p.split("/"));
        fs.mkdirSync(path.dirname(at), { recursive: true });
        fs.writeFileSync(at, body);
        // No "asset" field: names derived the same way everywhere (notes included)
        repos.push({ repo, revision, files: [{ path: p, size: body.length, sha256: crypto.createHash("sha256").update(body).digest("hex") }] });
    }
    const pin = { release: { repo: "x/y" }, repos, voices: { commit: "c".repeat(40) } };
    pin.release.tag = releaseTag(pin);
    const pinFile = path.join(dir, "pin.json");
    fs.writeFileSync(pinFile, JSON.stringify(pin));
    const tmpRoot = path.join(dir, "tmp");
    fs.mkdirSync(tmpRoot);
    const assets = releaseAssets(pin, "/x");
    const run = gotAssets => {
        const calls = [];
        const exec = (cmd, args) => {
            calls.push([cmd, ...args]);
            if (cmd === "gh" && args[0] === "release" && args[1] === "view") throw new Error("release not found");
            if (cmd === "gh" && args[0] === "api") return JSON.stringify({ assets: gotAssets });
            return "";
        };
        let error = null;
        try { releaseModel({ vieneu, pinFile, exec, tmpRoot, log: () => { } }); } catch (e) { error = e; }
        assert.deepEqual(fs.readdirSync(tmpRoot), [], "staging and notes removed");
        return { calls, error };
    };
    const good = assets.map(a => ({ name: a.name, size: a.size, digest: `sha256:${a.sha256}` }));
    let r = run(good);
    assert.equal(r.error, null);
    assert.deepEqual(r.calls[0].slice(0, 2), ["python3", path.join(ROOT, "tools", "vieneu-pin.py")]);
    assert.ok(r.calls[0].includes(pinFile), "the author's copy is verified against this same pin");
    assert.deepEqual(r.calls.find(c => c[2] === "upload").slice(-5).map(f => path.basename(f)).sort(),
        ["LICENSE-Apache-2.0.txt", "MOSS-Audio-Tokenizer-Nano-ONNX__b.onnx", "NOTICE", "VieNeu-TTS-v3-Turbo__onnx__w.data", "vieneu-model.json"]);
    assert.deepEqual(r.calls.at(-1), ["gh", "api", `repos/x/y/releases/tags/${pin.release.tag}`]);
    // Same sizes, other bytes stored on GitHub: refused, the asset named
    r = run(good.map((a, i) => i ? a : { ...a, digest: "sha256:" + "0".repeat(64) }));
    assert.match(String(r.error), /VieNeu-TTS-v3-Turbo__onnx__w\.data digest sha256:0{64}, the pin says sha256:/);
    // No digest at all, or an asset missing: refused too
    assert.match(String(run(good.map(a => ({ ...a, digest: null }))).error), /digest absent/);
    assert.match(String(run(good.slice(1)).error), /VieNeu-TTS-v3-Turbo__onnx__w\.data missing/);
    // A python failure (the author's copy is wrong) throws before anything is staged
    const threw = (() => { try { releaseModel({ vieneu, pinFile, exec: () => { throw new Error("exit 1"); }, tmpRoot, log: () => { } }); } catch (e) { return e; } })();
    assert.match(String(threw), /exit 1/);
    assert.deepEqual(fs.readdirSync(tmpRoot), []);
    // The notes name the derived assets, never "undefined"
    const notes = releaseNotes(pin);
    assert.match(notes, /\| `VieNeu-TTS-v3-Turbo__onnx__w\.data` \|/);
    assert.doesNotMatch(notes, /undefined/);
    fs.rmSync(dir, { recursive: true, force: true });
});
