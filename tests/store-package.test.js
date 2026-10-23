// The Chrome Web Store ZIP (tools/package-store.js) must hold every file the manifest loads and nothing from tools/tests/docs.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { build } = require("../tools/package-store.js");

const ROOT = path.join(__dirname, "..");

test("store zip lists every manifest file and no dev folders", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "store-"));
    const { file, names } = build(out);
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
    const need = [m.background.service_worker, m.action.default_popup, m.options_ui.page,
        ...Object.values(m.icons), ...m.content_scripts.flatMap(c => c.js)];
    for (const f of need) assert.ok(names.includes(f), f + " missing from the store zip");
    assert.ok(!names.some(n => /^(tools|tests|docs|\.git)\//.test(n)));
    assert.ok(fs.statSync(file).size < 20 * 1024 * 1024);
});

test("store zip is a valid archive when the system unzip is available", { skip: spawnSync("unzip", ["-v"]).error ? "no unzip" : false }, () => {
    const { file } = build(fs.mkdtempSync(path.join(os.tmpdir(), "store-")));
    assert.equal(spawnSync("unzip", ["-tq", file]).status, 0);
});
