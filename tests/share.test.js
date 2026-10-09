// The public share build (tools/publish-share.js): friends install from it, so a runtime file left
// out, a Windows script that 5.1 cannot read, or installers pinned to different VieNeu commits would
// only show up on someone else's machine.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { build, EXT_TOOLS } = require("../tools/publish-share.js");

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
        [".gitattributes", ".github", "README.md", "extension", "install-mac.sh", "install-windows.ps1", "vieneu"]);
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
