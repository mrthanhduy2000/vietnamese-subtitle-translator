// Glossary data and the protect -> restore round trip in content.js: settled Vietnamese renderings,
// plural lookup, sentence-start capitals, user overrides, and groups added after a saved list.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const G = require("../glossary.js");

// A fake node: every property is another fake node, and calling one returns a fake node too.
// Enough for the page setup content.js runs at load time.
function stubNode() {
    const own = { style: {}, dataset: {}, children: [] };
    return new Proxy(function () {}, {
        get: (f, k) => (k in own ? own[k] : k === "querySelectorAll" ? () => [] : k === "querySelector" ? () => null
            : k === Symbol.toPrimitive ? () => "" : stubNode()),
        set: (f, k, v) => { own[k] = v; return true; },
        apply: () => stubNode()
    });
}

function loadContent(stored = {}) {
    const noop = () => {};
    const sb = {
        console: { log: noop, warn: noop, error: noop }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
        requestAnimationFrame: f => f(), URL, Promise, Map, Set, Math, JSON, Date, RegExp, TextEncoder,
        location: { href: "https://www.coursera.org/learn/x", hostname: "www.coursera.org", pathname: "/learn/x" },
        document: stubNode(), MutationObserver: class { observe() {} disconnect() {} }, addEventListener: noop, postMessage: noop,
        getComputedStyle: () => ({ position: "relative" }),
        chrome: {
            storage: { sync: { get: async d => ({ ...d, ...stored }), set: async () => {} }, local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener: noop } },
            runtime: { id: "x", onMessage: { addListener: noop }, getURL: p => p, sendMessage: noop }
        }
    };
    sb.window = sb; sb.globalThis = sb;
    vm.createContext(sb);
    for (const f of ["glossary.js", "cst-cache.js", "cost-policy.js", "lang-detect.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js"]) vm.runInContext(read(f), sb);
    return sb;
}

// Stand-in for Gemini: echo every placeholder in order, in a Vietnamese-looking frame
function roundTrip(sb, english, frame = ids => ids.join(" và ") + ".") {
    const prot = sb.protectGlossary(english);
    const ids = prot.terms.map((_, i) => `[[__T${i}__]]`);
    return { prot, out: sb.restoreGlossary(frame(ids), prot.terms) };
}

test("every Vietnamese rendering is a protected term of its group, keys lowercase", () => {
    for (const [key, group] of Object.entries(G.CST_GLOSSARY_GROUPS)) {
        const terms = new Set(group.terms.map(t => t.toLowerCase()));
        for (const [en, vi] of Object.entries(group.vi || {})) {
            assert.equal(en, en.toLowerCase(), `${key}: ${en}`);
            assert.ok(terms.has(en), `${key}: ${en} is not in terms`);
            assert.ok(vi && !/[–—]/.test(vi), `${key}: ${en} -> ${vi}`);
        }
    }
    assert.ok(Object.keys(G.CST_GLOSSARY_GROUPS.math.vi).length > 20);
});

test("a term never gets two different Vietnamese renderings across groups", () => {
    const seen = new Map();
    for (const [key, group] of Object.entries(G.CST_GLOSSARY_GROUPS)) {
        for (const [en, vi] of Object.entries(group.vi || {})) {
            if (seen.has(en)) assert.equal(seen.get(en).vi, vi, `${en}: ${seen.get(en).key} vs ${key}`);
            seen.set(en, { key, vi });
        }
    }
});

test("no single ambiguous everyday word is protected, and no term is listed twice in a group", () => {
    const banned = ["make", "lead", "run", "scale", "model", "share", "reach", "target", "value", "return", "form", "pivot", "public good"];
    for (const [key, group] of Object.entries(G.CST_GLOSSARY_GROUPS)) {
        const lower = group.terms.map(t => t.toLowerCase());
        for (const b of banned) assert.ok(!lower.includes(b), `${key}: ${b}`);
        assert.equal(new Set(lower).size, lower.length, `${key} has a duplicate`);
    }
});

test("a group added after the user saved a list starts enabled; one they unticked stays off", () => {
    const all = Object.keys(G.CST_GLOSSARY_GROUPS);
    assert.deepEqual(G.CST_resolveEnabledGroups({}), all);
    // saved before 1.8.5: no knownGroups, so math and productivity are new to this user
    const old = G.CST_resolveEnabledGroups({ enabledGroups: ["tech", "data"] });
    assert.deepEqual(old, ["tech", "data", "math", "productivity"]);
    // saved from 1.8.5 on: the user has seen every group, an unticked one stays unticked
    assert.deepEqual(G.CST_resolveEnabledGroups({ enabledGroups: ["tech"], knownGroups: all }), ["tech"]);
    assert.match(read("options.js"), /knownGroups: allKeys/);
});

test("a settled term comes back in Vietnamese, plurals included, English kept terms stay English", async () => {
    const sb = loadContent();
    await sb.loadGlossary();
    const { prot, out } = roundTrip(sb, "Interest rates and the standard deviation");
    assert.deepEqual([...prot.terms], ["lãi suất", "độ lệch chuẩn"]);
    assert.equal(out, "Lãi suất và độ lệch chuẩn.");
    assert.deepEqual([...sb.protectGlossary("written in Python").terms], ["Python"]);
    assert.equal(roundTrip(sb, "two case control studies").prot.terms[0], "nghiên cứu bệnh chứng");
});

test("possessive and digit spellings still reach their rendering", async () => {
    const sb = loadContent();
    await sb.loadGlossary();
    assert.deepEqual([...sb.protectGlossary("the prisoner’s dilemma").terms], ["thế lưỡng nan của người tù"]);
    assert.deepEqual([...sb.protectGlossary("by Bayes's theorem").terms], ["định lý Bayes"]);
    assert.deepEqual([...sb.protectGlossary("Scope 3 emissions are hard").terms], ["phát thải phạm vi 3"]);
});

test("sentence-start capital only for an all-lowercase term, and only at a sentence start", async () => {
    const sb = loadContent();
    await sb.loadGlossary();
    assert.equal(sb.restoreGlossary("[[__T0__]] tăng. [[__T1__]] giảm", ["lãi suất", "iOS"]), "Lãi suất tăng. iOS giảm");
    assert.equal(sb.restoreGlossary("Khi [[__T0__]] tăng", ["lãi suất"]), "Khi lãi suất tăng");
    assert.equal(sb.restoreGlossary("Ví dụ: [[__T0__]] tăng", ["lãi suất"]), "Ví dụ: lãi suất tăng");
});

test("user rules win: a kept term stays English, a => rule replaces the group rendering", async () => {
    const sb = loadContent({ userKeep: "cash flow", userNormalize: "interest rate => lãi vay" });
    await sb.loadGlossary();
    assert.deepEqual([...sb.protectGlossary("cash flow and interest rates").terms], ["cash flow", "lãi vay"]);
});

test("a disabled group renders nothing, its terms go to Gemini untouched", async () => {
    const all = Object.keys(G.CST_GLOSSARY_GROUPS);
    const sb = loadContent({ enabledGroups: all.filter(k => k !== "economics"), knownGroups: all });
    await sb.loadGlossary();
    assert.deepEqual([...sb.protectGlossary("the opportunity cost").terms], []);
});

test("Vietnamese renderings join the unbreakable multi-word list for the segmenter", async () => {
    const sb = loadContent();
    await sb.loadGlossary();
    assert.ok(vm.runInContext("state", sb).glossaryMultiTerms.includes("độ lệch chuẩn"));
});
