// Regression tests for the backlog cleanup: one source of truth per setting, one YouTube bridge,
// a glossary Node can load, and the segmenter debug aid kept working.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("condensing has exactly one switch: dubbing.js passes condense: null", () => {
    assert.match(R("dubbing.js"), /condense: null/);
    for (const f of ["options.js", "dubbing.js", "cost-policy.js", "options.html"]) {
        assert.doesNotMatch(R(f), /dubCondense/, f);
    }
    const COST = require("../cost-policy.js");
    for (const [name, m] of Object.entries(COST.MODES)) assert.equal(m.condense, undefined, name);
});

test("dualMode decides bilingual display; subStyle.mode is only a fallback", () => {
    const S = require("../subtitle-style.js");
    // popup wrote dualMode alone; the stale mirror must not flip it back
    assert.equal(S.resolveDual({ dualMode: true, subStyle: { mode: "single" } }), true);
    assert.equal(S.resolveDual({ dualMode: false, subStyle: { mode: "dual" } }), false);
    // settings from before the dualMode key existed
    assert.equal(S.resolveDual({ dualMode: null, subStyle: { mode: "dual" } }), true);
    assert.equal(S.resolveDual({ subStyle: { mode: "single" } }), false);
    assert.equal(S.resolveDual({}), false);
    assert.equal(S.resolveDual(null), false);
});

test("the storage listeners never read dualMode back from subStyle.mode", () => {
    assert.doesNotMatch(R("content.js"), /state\.dualMode = [^;\n]*subStyle[^;\n]*mode/);
    assert.match(R("youtube.js"), /ytSubStyle\.mode = state\.dualMode \? "dual" : "single"/);
});

test("there is one YouTube bridge: youtube.js asks the service worker to inject yt-bridge.js", () => {
    const yt = R("youtube.js");
    assert.doesNotMatch(yt, /cst-yt-bridge-injected/, "no inline copy");
    assert.doesNotMatch(yt, /s\.textContent = `\(\$\{function/, "no inline copy");
    assert.match(yt, /action: "ensureYtBridge"/);
    const bg = R("background.js");
    assert.match(bg, /ensureYtBridge: handleEnsureYtBridge/);
    assert.match(bg, /world: "MAIN", files: \["yt-bridge\.js"\]/);
    assert.match(R("yt-bridge.js"), /if \(window\.__cst_bridge_v2\) return;/, "second injection is a no-op");
});

test("glossary.js loads in Node with the standard exports", () => {
    const g = require("../glossary.js");
    assert.ok(Object.keys(g.CST_GLOSSARY_GROUPS).length > 5);
    assert.deepEqual(g.CST_DEFAULT_ENABLED_GROUPS, Object.keys(g.CST_GLOSSARY_GROUPS));
    assert.ok(g.CST_RISKY_PROPER && g.CST_CONTEXTUAL_TERMS && g.CST_DEFAULT_NORMALIZE);
    assert.equal(globalThis.CST_GLOSSARY_GROUPS, g.CST_GLOSSARY_GROUPS);
});

test("segmenter explain() scores the chosen cut and alternatives", () => {
    const seg = require("../vi-segmenter.js");
    const text = "Hôm nay chúng ta sẽ tìm hiểu về mạng nơ-ron và cách huấn luyện mô hình ngôn ngữ lớn";
    const cues = [{ start: 0, end: 2.5, text: "Today we will learn about neural networks" },
                  { start: 2.5, end: 5, text: "and how to train large language models" }];
    const out = seg.explain(text, cues, [["nơ-ron"]]);
    assert.equal(typeof out.chosen, "object");
    assert.ok("alt0" in out);
});

// Performance work: memoised phrase building must never leak one caller's edits into the next
test("buildPhrases memo hands out fresh copies and keys on source pauses", () => {
    const PLAN = require("../dub-planner.js");
    const text = "Hôm nay chúng ta sẽ tìm hiểu về mạng nơ-ron, và cách huấn luyện mô hình ngôn ngữ lớn trên dữ liệu thật.";
    const a = PLAN.buildPhrases(text);
    a[0].pauseAfter = 99; a[0].text = "sửa";
    const b = PLAN.buildPhrases(text);
    assert.notEqual(b[0].pauseAfter, 99);
    assert.notEqual(b[0].text, "sửa");
    const withPause = PLAN.buildPhrases(text, { sourcePauses: [{ frac: 0.3, dur: 0.6 }] });
    assert.ok(withPause.some(p => p.breakKind === "source"), "a different pause list is not served from the plain entry");
});

test("segmenter lexicon spans: longest phrase wins, never across punctuation", () => {
    const seg = require("../vi-segmenter.js");
    const tokens = seg.tokenize("mô hình ngôn ngữ lớn, và trí tuệ nhân tạo");
    const { gap } = seg.analyze(tokens);
    const idx = w => tokens.findIndex(t => t.core === w);
    assert.ok(gap[idx("ngữ")] > 0, "inside 'ngôn ngữ' must not be a good cut");
    assert.ok(gap[idx("và")] < gap[idx("ngữ")], "the comma is a better cut than inside a compound");
});

test("the body-wide button observers are throttled, not run on every mutation", () => {
    for (const f of ["youtube.js", "content.js"]) {
        assert.match(R(f), /if \(now - lastCheck >= 150\)/, f);
    }
});
