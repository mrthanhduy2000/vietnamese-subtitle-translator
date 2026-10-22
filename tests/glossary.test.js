// Glossary data and the protect -> restore round trip in content.js: settled Vietnamese renderings,
// plural lookup, sentence-start capitals, user overrides, and groups added after a saved list.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const G = require("../glossary.js");
// the large part merges into the same groups (2.5.9), as in the extension
require("../glossary-extra.js");
require("../glossary-data.js");
const EXTRA = globalThis.CST_GLOSSARY_EXTRA_REPORT;

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
    for (const f of ["glossary.js", "glossary-extra.js", "glossary-data.js", "cst-cache.js", "cost-policy.js", "lang-detect.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js"]) vm.runInContext(read(f), sb);
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
        // a store or product name kept only mid-sentence ("~Target") is no everyday word
        const words = group.terms.filter(t => !G.CST_RISKY_PROPER.includes(t)).map(t => t.toLowerCase());
        for (const b of banned) assert.ok(!words.includes(b), `${key}: ${b}`);
        assert.equal(new Set(lower).size, lower.length, `${key} has a duplicate`);
    }
});

test("a group added after the user saved a list starts enabled; one they unticked stays off", () => {
    const all = Object.keys(G.CST_GLOSSARY_GROUPS);
    assert.deepEqual(G.CST_resolveEnabledGroups({}), all);
    // saved before 1.8.5: no knownGroups, so math and productivity are new to this user
    const old = G.CST_resolveEnabledGroups({ enabledGroups: ["tech", "data"] });
    // every group added after 1.8.4 (math, productivity, and the 2.5.9 everyday domains) starts on
    assert.deepEqual(old.slice(0, 4), ["tech", "data", "math", "productivity"]);
    assert.ok(old.includes("lifestyle") && old.includes("beauty") && !old.includes("marketing"));
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

test("2.5.8: wearables and newer AI names are kept; a lowercase whoop only where the device is meant", async () => {
    const sb = loadContent();
    await sb.loadGlossary();
    assert.deepEqual([...sb.protectGlossary("I track it on my whoop strap and my Oura Ring").terms], ["WHOOP", "Oura Ring"]);
    assert.deepEqual([...sb.protectGlossary("She wears a whoop every night").terms], ["WHOOP"]);
    assert.deepEqual([...sb.protectGlossary("The crowd let out a whoop of joy").terms], []);
    assert.deepEqual([...sb.protectGlossary("Make the video with Veo and the voice with ElevenLabs").terms], ["Veo", "ElevenLabs"]);
    assert.deepEqual([...sb.protectGlossary("A reasoning model needs test-time compute").terms], ["mô hình suy luận", "test-time compute"]);
    // a product name that is an everyday word only mid-sentence
    assert.deepEqual([...sb.protectGlossary("Lovable dogs are fun. I built it in Lovable").terms], ["Lovable"]);
});

// ---- the large glossary (2.5.9) ----
test("2.5.9: every line of the large glossary follows the format, and no rendering contradicts another group's", () => {
    assert.deepEqual(EXTRA.issues, []);
    assert.ok(Object.values(EXTRA.added).reduce((a, b) => a + b, 0) > 1000);
    for (const [key, group] of Object.entries(G.CST_GLOSSARY_GROUPS)) {
        assert.ok(group.label && Array.isArray(group.terms) && group.vi, key);
        for (const t of group.terms) assert.equal(t, t.trim(), `${key}: "${t}"`);
    }
});

test("2.5.9: no everyday word with several meanings is a one-word term (a lifestyle video uses it the other way)", () => {
    const everyday = ("string array terminal container pod cookie cookies cache kernel wafer foundry outage downtime bandwidth " +
        "inheritance interface dropout compute logging repository adapter avatar warmup monolith backtracking chunking " +
        "authorization localization accessibility breakpoint interpreter pip spam bug cloud stream feed post story " +
        "network server client agent token prompt model chip memory battery screen window table chart margin balance " +
        "interest return yield bond stock share capital asset equity credit debit charge fee rate rent lease deposit " +
        "order trade market exchange bank fund trust estate will power energy current field mass weight volume " +
        "pressure resistance cell culture tissue organ plant tree root branch leaf seed fruit dressing sauce stock " +
        "draft press release launch pitch deal close lead hook brief case file note record track score goal point " +
        "level stage step phase cycle loop shift swing set rep form figure frame shot cut scene act play match game " +
        "round course class grade degree major minor key note scale chord bar beat pitch tone mood vibe glow base " +
        "primer toner serum mask peel scrub shade palette blush bronzer highlighter concealer foundation powder " +
        // removed while the large glossary was written: each one turned an everyday sentence wrong
        "single tip honey woke mean mode average resume judge bill trial appeal depression guidance conviction " +
        "settlement precedent appreciation variable derivative integral strike overtime commission " +
        "qualification mint node whale whales pandas fit basics slides clutch heels vintage crossover highway " +
        "tablet hotspot rabbit bunny treats harness milestones nursery crib meltdown pumping essence breakout " +
        "purging highlights blowout stroke colon appendix plateau taper calves plank specialist residency fillers " +
        "frequency wavelength atmosphere orbit catalyst evolution compound president progressive conservative " +
        "liberal superpower pronouns impressions incubator dilution fundraising friction clutter minimalist " +
        "frugal solitude closure moving inventory acquisition franchise unicorn reboot fencing cricket " +
        "ace derby pitcher handicap athlete " +
        // 2.6.1: removed again while the glossary grew past 29,000 terms
        "period momentum commit fork weights ate cap bet based mid lore aura ratio slay simp cutting crash " +
        "premium correction bonds stimulus vulnerability visualization fiber mobility strides eccentric dips shrugs " +
        "snatch customs cruise subway recall pickup suspension drift lithium mold").split(" ");
    const phrases = ["long run", "to failure", "extra time", "well done", "due date", "whole foods", "the pilot", "that girl",
        "moving on", "little things", "follow up", "stack overflow"];
    for (const [key, group] of Object.entries(G.CST_GLOSSARY_GROUPS)) {
        const lower = new Set(group.terms);
        for (const w of everyday.concat(phrases)) assert.ok(!lower.has(w), `${key}: "${w}"`);
    }
});

test("2.5.9: a capitalised one-word name that is also an English word is kept only mid-sentence", () => {
    let dict;
    try { dict = new Set(fs.readFileSync("/usr/share/dict/words", "utf8").split("\n").filter(w => /^[a-z]+$/.test(w))); }
    catch (e) { return; }   // no word list on this machine (Windows CI): nothing to check against
    const risky = new Set(G.CST_RISKY_PROPER);
    const before = require("node:child_process").execFileSync(process.execPath, ["-e",
        "const G=require('./glossary.js');console.log(JSON.stringify([].concat(...Object.values(G.CST_GLOSSARY_GROUPS).map(g=>g.terms))))"],
        { cwd: path.join(__dirname, "..") }).toString();
    const old = new Set(JSON.parse(before));
    const bad = [];
    for (const group of Object.values(G.CST_GLOSSARY_GROUPS)) {
        for (const t of group.terms) if (!old.has(t) && /^[A-Z][a-z]+$/.test(t) && dict.has(t.toLowerCase()) && !risky.has(t)) bad.push(t);
    }
    assert.deepEqual(bad, []);
});

test("2.5.9: protecting a long window stays fast with every term loaded, and matches what one big regex would", async () => {
    const sb = loadContent();
    await sb.loadGlossary();
    assert.ok(vm.runInContext("state.glossaryKeep.length", sb) > 2000);
    const text = ("We trained a large language model on GPUs, then used retrieval-augmented generation with a vector database. " +
        "My morning routine with the WHOOP and a cup of coffee, then the interest rate went up again. ").repeat(15);
    sb.protectGlossary(text);
    const t0 = Date.now();
    for (let i = 0; i < 10; i++) sb.protectGlossary(text);
    assert.ok((Date.now() - t0) / 10 < 40, `${(Date.now() - t0) / 10} ms per window`);
    const terms = [...sb.protectGlossary("Use retrieval-augmented generation and a vector database in Python").terms];
    assert.deepEqual(terms, ["Python", "tạo sinh tăng cường truy xuất", "cơ sở dữ liệu vector"]);   // exact-case terms are protected first
});

test("an everyday word English capitalizes (a weekday, a month, a language) is never kept as written", () => {
    const always = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|english|french|german|spanish|chinese|japanese|korean|vietnamese|christmas|easter)s?$/i;
    for (const [k, g] of Object.entries(G.CST_GLOSSARY_GROUPS)) {
        for (const t of g.terms) if (always.test(t)) assert.ok((g.vi || {})[t.toLowerCase()], `${k}: "${t}" kept as written`);
    }
    // the merge refuses one (the series "Wednesday" kept every weekday: "vào thứ Tư Wednesday")
    const before = EXTRA.issues.length;
    globalThis.CST_GLOSSARY_EXTRA_ADD("lab_always", "lab", "Wednesday\nMonday|thứ Hai");
    assert.equal(EXTRA.issues.length, before + 1);
    assert.match(EXTRA.issues[EXTRA.issues.length - 1], /Wednesday.*needs a rendering/);
    assert.ok(G.CST_GLOSSARY_GROUPS.lab_always.terms.includes("Monday"));
    EXTRA.issues.length = before;
    delete G.CST_GLOSSARY_GROUPS.lab_always;
});
