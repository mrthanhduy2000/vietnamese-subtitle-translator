// Fuzz / property tests: the pure parsers and cleaners fed hostile input (empty, huge, emoji, RTL,
// CJK, control characters, negative or overlapping times). Offline and deterministic: one seeded
// generator, so a failure reproduces from the printed case index.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const SEG = require("../vi-segmenter.js");
const PLAN = require("../dub-planner.js");
const SPEECH = require("../dub-speech.js");
const QUAL = require("../vi-quality.js");
const LANG = require("../lang-detect.js");
const T = require("../transcript.js");
const { bgEnv } = require("./bg-env.js");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// mulberry32: tiny seeded PRNG
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const FRAGMENTS = [
    "Hello", "world", "the", "model", "GPU", "3.5", "1,000,000", "$5", "50%", "2024", "Dr.", "e.g.", "U.S.A.",
    "Xin chào", "các bạn", "học máy", "trí tuệ nhân tạo", "không", "được", "và", "của",
    "😀", "👨‍👩‍👧‍👦", "🇻🇳", "é", "é", "ǅ", "ß", "İ",
    "مرحبا بالعالم", "שלום עולם", "‮", "‫", "‏", "‎",
    "你好世界", "こんにちは", "한국어", "ｱｲｳ", "　",
    "\u0000", "\u0001", "\u001B[31m", "\u007F", "\u0085", " ", " ", "﻿", "​", " ", "\t", "\r\n", "\n",
    "[[__T0__]]", "[[__T99__]]", "__T1__", "ZQ3QZ", "[[__T", "]]", "¦", "...", "..", "--", "—", "…",
    "(Laughter)", "[Music]", "♪", "<i>", "</b>", "&amp;", "&lt;", "<script>", "'", "\"", "“", "”", "\\", "$&", "$1", "%s",
    "__proto__", "constructor", "toString", "a".repeat(300), ".", ",", "?", "!", " ", "  "
];

function fuzzText(r, maxParts = 12) {
    const n = Math.floor(r() * maxParts);
    let s = "";
    for (let i = 0; i < n; i++) s += FRAGMENTS[Math.floor(r() * FRAGMENTS.length)] + (r() < 0.8 ? " " : "");
    return s;
}

const FIXED = [
    "", " ", "\n", "\u0000", "a", ".", "😀".repeat(500), "x ".repeat(5000), "مرحبا ".repeat(800), "你好".repeat(3000),
    "‮".repeat(100), "[[__T0__]] ".repeat(200), "¦".repeat(100), "a".repeat(100000)
];

const CASES = 400;
function eachText(fn) {
    for (const s of FIXED) fn(s, "fixed");
    const r = rng(20261023);
    for (let i = 0; i < CASES; i++) fn(fuzzText(r), "case " + i);
}

const weird = [NaN, Infinity, -Infinity, -5, 0, 1e12, null, undefined, "3", {}, []];
function fuzzCues(r) {
    const n = Math.floor(r() * 6);
    const cues = [];
    for (let i = 0; i < n; i++) {
        const start = r() < 0.15 ? weird[Math.floor(r() * weird.length)] : r() * 30 - (r() < 0.1 ? 10 : 0);
        const end = r() < 0.15 ? weird[Math.floor(r() * weird.length)] : (typeof start === "number" && isFinite(start) ? start : 0) + (r() < 0.2 ? -r() * 3 : r() * 4);
        const c = { start, end, text: fuzzText(r, 6) };
        if (r() < 0.2) c.words = [{ text: "x", t: weird[Math.floor(r() * weird.length)] }, { text: fuzzText(r, 2), t: r() * 30 }];
        cues.push(c);
    }
    return cues;
}

test("fuzz: cleanText / breakLines never throw and always return strings or string arrays", () => {
    eachText((s, id) => {
        const c = SEG.cleanText(s);
        assert.equal(typeof c, "string", id);
        assert.ok(!/\[\[__T\d+__\]\]|__T\d+__|ZQ\d+QZ/.test(c), id + ": a placeholder code reached the screen");
        const lines = SEG.breakLines(c);
        assert.ok(Array.isArray(lines) && lines.every(l => typeof l === "string"), id);
    });
});

test("fuzz: segmentGroupSafe returns usable cues for any text and any cue times", () => {
    const r = rng(7);
    const run = (vi, cues, id) => {
        const segs = SEG.segmentGroupSafe(vi, cues);
        assert.ok(Array.isArray(segs), id);
        if (!SEG.cleanText(vi).trim()) return segs;      // nothing to show is a valid answer
        assert.ok(segs.length >= 1, id + ": text lost, no cue");
        for (const s of segs) {
            assert.equal(typeof s.text, "string", id);
            assert.ok(Array.isArray(s.lines), id);
            assert.ok(Number.isFinite(s.start) && Number.isFinite(s.end), `${id}: non-finite time ${s.start} ${s.end}`);
            assert.ok(s.end >= s.start, `${id}: ends before it starts ${s.start} ${s.end}`);
        }
        return segs;
    };
    for (const s of FIXED) run(s, [{ start: 0, end: 2, text: "Hi" }], "fixed");
    for (let i = 0; i < CASES; i++) run(fuzzText(r), fuzzCues(r), "case " + i);
    run("Xin chào các bạn", [], "no cues");
    run("Xin chào các bạn", null, "null cues");
});

test("fuzz: when segmenting succeeds no word is lost or repeated and times never overlap", () => {
    const r = rng(11);
    for (let i = 0; i < CASES; i++) {
        const vi = fuzzText(r, 25).replace(/[\u0000-\u001F]/g, " ");
        const dur = 1 + r() * 8;
        const segs = SEG.segmentGroupSafe(vi, [{ start: 5, end: 5 + dur, text: "src" }]);
        const clean = SEG.cleanText(vi).replace(/\s+/g, " ").trim();
        if (!clean) continue;
        const joined = segs.map(s => s.text).join(" ").replace(/\s+/g, " ").trim();
        assert.equal(joined, clean, "case " + i);
        for (let k = 1; k < segs.length; k++) assert.ok(segs[k].start >= segs[k - 1].end - 1e-6, `case ${i}: overlap at ${k}`);
    }
});

test("fuzz: adaptForSpeech, stripSoundNotes, stripSpeakerLabels, numberToVietnamese stay total", () => {
    eachText((s, id) => {
        assert.equal(typeof PLAN.adaptForSpeech(s), "string", id);
        assert.equal(typeof PLAN.stripSoundNotes(s), "string", id);
        assert.equal(typeof PLAN.stripSoundNotes(s, true), "string", id);
        assert.equal(typeof PLAN.stripSpeakerLabels(s, ["Alice", "Bob"]), "string", id);
        const ph = PLAN.buildPhrases(PLAN.adaptForSpeech(s));
        assert.ok(Array.isArray(ph), id);
    });
    for (const n of [0, -1, -0, 1e6, 1e9, 1e15, 1e18, 1e21, 1e300, 0.5, -0.5, 123456789.987, "12", "123456789012345678901234567890", 2 ** 53]) {
        const out = PLAN.numberToVietnamese(n);
        assert.ok(out == null || typeof out === "string", String(n));
        assert.ok(!/NaN|undefined|Infinity|\[object/.test(String(out || "")), `${String(n)} -> ${out}`);
        if (Math.abs(Number(n)) >= 1e18) assert.match(out, /^[\d ]+$/, `${String(n)}: units ran out, must be said digit by digit`);
    }
});

test("fuzz: buildDubScript / planAll survive empty, overlapping, negative and non-finite times", () => {
    const r = rng(23);
    for (let i = 0; i < 150; i++) {
        const groups = [];
        const n = Math.floor(r() * 5);
        for (let k = 0; k < n; k++) {
            const src = fuzzCues(r).filter(c => typeof c.start === "number" && Number.isFinite(c.start) && Number.isFinite(c.end));
            if (!src.length) continue;
            const vi = fuzzText(r, 14);
            groups.push({ start: src[0].start, end: Math.max(...src.map(c => c.end)), srcCues: src, viText: vi, viCues: SEG.segmentGroupSafe(vi, src) });
        }
        const script = PLAN.buildDubScript(groups);
        assert.ok(Array.isArray(script), "case " + i);
        const plans = PLAN.planAll(script);
        assert.ok(Array.isArray(plans), "case " + i);
        for (const p of plans) {
            for (const [k, v] of Object.entries(p)) {
                if (typeof v === "number") assert.ok(Number.isFinite(v), `case ${i}: plan.${k} = ${v}`);
            }
        }
    }
});

test("fuzz: dub-speech analyze/render/vieneuText never throw and never leak control characters", () => {
    eachText((s, id) => {
        const out = SPEECH.vieneuText(s);
        assert.equal(typeof out, "string", id);
        assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(out), id + ": control character sent to the voice");
        assert.equal(typeof SPEECH.render(s).text, "string", id);
    });
});

test("fuzz: vi-quality assess / trimContextLeak / fixSoundNotes / realignSentences stay total", () => {
    const r = rng(31);
    for (let i = 0; i < CASES; i++) {
        const src = fuzzText(r), vi = fuzzText(r);
        const a = QUAL.assess(src, vi);
        assert.ok(a && Array.isArray(a.issues || a), "case " + i);
        assert.deepEqual([...QUAL.fixSoundNotes([vi], [src])].map(x => typeof x), ["string"], "case " + i);
        assert.equal(typeof QUAL.trimContextLeak(vi, fuzzText(r)), "string", "case " + i);
        QUAL.realignSentences([src, fuzzText(r)], [vi]);
    }
    for (const s of FIXED) { QUAL.assess(s, s); QUAL.assess(null, s); QUAL.assess(s, undefined); }
});

test("fuzz: language detection tolerates every script and returns a verdict object", () => {
    eachText((s, id) => {
        const d = LANG.detectText(s);
        assert.ok(d === null || typeof d === "object", id);
        assert.ok(LANG.decide({ metaLang: "en", sample: s }) !== undefined, id);
        LANG.brokenTranscript("en", s);
        LANG.normCode(s);
    });
});

test("fuzz: buildSrt / mergeLines / fileName handle junk rows and times", () => {
    const r = rng(41);
    for (let i = 0; i < CASES; i++) {
        const lines = [];
        for (let k = 0; k < Math.floor(r() * 5); k++) {
            const pick = () => (r() < 0.2 ? weird[Math.floor(r() * weird.length)] : r() * 7200 - (r() < 0.1 ? 50 : 0));
            lines.push({ start: pick(), end: pick(), vi: fuzzText(r, 4), en: fuzzText(r, 4) });
        }
        const srt = T.buildSrt(lines, { keepOriginal: r() < 0.5 });
        assert.equal(typeof srt, "string", "case " + i);
        assert.ok(!/NaN|undefined|Infinity/.test(srt), `case ${i}: ${srt.slice(0, 120)}`);
        // every clock line is a valid 00:00:00,000 --> 00:00:00,000
        for (const l of srt.split("\n")) if (l.includes("-->")) assert.match(l, /^\d{2,}:\d{2}:\d{2},\d{3} --> \d{2,}:\d{2}:\d{2},\d{3}$/, `case ${i}`);
        T.mergeLines(lines.map(l => ({ start: l.start, end: l.end, text: l.vi })), lines.map(l => ({ start: l.end, end: l.start, text: l.en })));
        const f = T.fileName(fuzzText(r));
        assert.match(f, /^[A-Za-z0-9._-]+\.srt$/, "case " + i + ": " + f);
        assert.ok(f.length <= 64, f);
    }
    for (const c of [NaN, Infinity, -Infinity, 1e15, "x", {}]) assert.match(T.srtClock(c), /^\d+:\d{2}:\d{2},\d{3}$/, String(c));
});

test("fuzz: sanitizeModelOutput / stripAddedFormatting never throw, never leave invisible characters, never grow codes", () => {
    const bg = bgEnv(async () => { throw new Error("offline"); });
    const { sanitizeModelOutput, stripAddedFormatting } = bg.sandbox;
    eachText((s, id) => {
        const clean = sanitizeModelOutput(s, ["[[__T0__]]", "[[__T2__]]"]);
        assert.equal(typeof clean, "string", id);
        assert.ok(!/[​-‍⁠﻿ \n\r]/.test(clean), id + ": invisible character survived");
        assert.ok(!/\[\[__T(?!0__|2__)\d+__\]\]/.test(clean), id + ": an invented code survived");
        assert.equal(typeof stripAddedFormatting(clean, s), "string", id);
    });
    for (const v of [null, undefined, 0, {}, [], NaN]) {
        assert.equal(typeof sanitizeModelOutput(v, null), "string");
        assert.equal(typeof stripAddedFormatting(v, v), "string");
    }
});

// content.js / youtube.js run in a page sandbox
function pageSandbox() {
    const noop = () => {};
    const el = () => ({ style: {}, dataset: {}, appendChild: noop, addEventListener: noop, setAttribute: noop, remove: noop });
    const sandbox = {
        console: { log: noop, warn: noop, error: noop },
        setTimeout: () => 0, clearTimeout: noop, setInterval: () => 1, clearInterval: noop,
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number,
        MutationObserver: class { observe() {} disconnect() {} },
        performance: { now: () => 0 },
        location: { href: "https://www.youtube.com/watch?v=abc", hostname: "www.youtube.com", pathname: "/watch" },
        document: {
            readyState: "complete", title: "t", body: el(), head: el(), documentElement: el(), getElementById: () => null,
            querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener: noop, removeEventListener: noop
        },
        addEventListener: noop, removeEventListener: noop, postMessage: noop,
        chrome: {
            storage: {
                sync: { get: async d => ({ ...d, autoTranslate: false }), set: async () => {} },
                local: { get: async () => ({}), set: async () => {}, remove: async () => {} },
                onChanged: { addListener: noop }
            },
            runtime: { id: "ext", lastError: null, onMessage: { addListener: noop }, sendMessage: noop }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of ["glossary.js", "subtitle-style.js", "vi-segmenter.js", "content.js", "youtube.js"]) vm.runInContext(read(f), sandbox);
    return sandbox;
}

test("fuzz: the glossary protect -> restore round trip never throws and never leaks a code", async () => {
    const sb = pageSandbox();
    await new Promise(r => setImmediate(r));
    vm.runInContext("state.glossaryEnabled = true", sb);
    eachText((s, id) => {
        sb.__s = s;
        const out = vm.runInContext("(() => { const p = protectGlossary(__s); return JSON.stringify({ p, r: restoreGlossary(p.text, p.terms) }); })()", sb);
        const { p, r } = JSON.parse(out);
        assert.equal(typeof p.text, "string", id);
        assert.equal(typeof r, "string", id);
        assert.ok(!/\[\[__T\d+__\]\]|__T\d+__|ZQ\d+QZ/.test(r), id + ": a code survived restore");
    });
    // codes the model invented or reordered are dropped, never restored from the wrong slot
    for (const model of ["[[__T7__]] xin chào", "Z Q 1 Q Z", "[[ __ T 0 __ ]]", "[[__T0__]][[__T0__]][[__T0__]]", "[[__T99999999999999999999__]]"]) {
        sb.__m = model;
        const r = vm.runInContext("restoreGlossary(__m, [])", sb);
        assert.ok(!/__T|ZQ|\[\[/.test(r), model + " -> " + r);
        const r2 = vm.runInContext("restoreGlossary(__m, ['Alpha', 'Beta'])", sb);
        assert.ok(!/__T\d|ZQ\d|\[\[__/.test(r2), model + " -> " + r2);
    }
});

test("fuzz: the YouTube json3 reader keeps only finite, ordered, non-empty cues", async () => {
    const sb = pageSandbox();
    await new Promise(r => setImmediate(r));
    const parse = raw => { sb.__raw = raw; return JSON.parse(vm.runInContext("JSON.stringify(ytDocNoiDungPhuDe(__raw))", sb)); };
    const r = rng(53);
    const times = [0, 1000, -500, 1.5, 1e15, null, undefined, "7", NaN, {}, []];
    const t = () => times[Math.floor(r() * times.length)];
    for (let i = 0; i < 300; i++) {
        const events = [];
        for (let k = 0; k < Math.floor(r() * 6); k++) {
            const ev = { tStartMs: r() < 0.5 ? Math.floor(r() * 60000) : t(), dDurationMs: r() < 0.5 ? Math.floor(r() * 5000) : t() };
            if (r() < 0.9) ev.segs = Array.from({ length: Math.floor(r() * 4) }, () => (r() < 0.1 ? null : { utf8: fuzzText(r, 3), tOffsetMs: r() < 0.3 ? t() : Math.floor(r() * 900) }));
            events.push(ev);
        }
        // null segs entries and non-numeric times are hostile but valid JSON
        let cues;
        try { cues = parse(JSON.stringify({ events })); } catch (e) { assert.fail(`case ${i}: ${e.message}\n${JSON.stringify({ events }).slice(0, 300)}`); }
        for (const c of cues) {
            assert.ok(c.text.trim().length > 0, `case ${i}: blank cue`);
            assert.ok(Number.isFinite(c.start) && Number.isFinite(c.end), `case ${i}: non-finite ${c.start} ${c.end}`);
        }
    }
    for (const raw of ["", "{}", "[]", "null", "0", "\"x\"", "{\"events\":null}", "{\"events\":{}}", "{\"events\":[null]}", "{\"events\":[1,\"a\",[]]}", "{\"events\":[{\"segs\":null}]}", "\u0000", "{".repeat(2000), "[".repeat(5000)]) {
        try { parse(raw); } catch (e) { assert.fail(`${JSON.stringify(raw.slice(0, 40))}: ${e.message}`); }
    }
});

test("fuzz regressions: each defect class found by the fuzzer, pinned with its smallest input", () => {
    const one = vi => SEG.segmentGroupSafe(vi, [{ start: 0, end: 3, text: "s" }]).map(s => s.text).join(" ");
    assert.equal(one("xin ¦, chào"), "xin, chào", "a cut hint before a comma leaves no orphan token");
    assert.equal(one("nói “ ¦ chào”"), "nói “chào”", "a cut hint after an opening quote leaves no gap");
    assert.equal(SEG.cleanText("hàm __init__ chạy trước"), "hàm __init__ chạy trước", "double underscores are code, not italics");
    assert.equal(SEG.cleanText("một _chữ_ nghiêng"), "một chữ nghiêng");
    assert.equal(T.srtClock(Infinity), "00:00:00,000");
    assert.equal(T.srtClock({}), "00:00:00,000");
    assert.equal(PLAN.adaptForSpeech("ID 12345678901234567890"), "ID 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0");
    assert.equal(PLAN.numberToVietnamese(1e15), "một triệu tỷ");
    const t0 = Date.now();
    PLAN.adaptForSpeech("a".repeat(100000));
    QUAL.assess("a".repeat(100000), "a".repeat(100000));
    QUAL.assess("a.".repeat(50000), "a.".repeat(50000));
    assert.ok(Date.now() - t0 < 3000, "one very long word must not cost seconds (quadratic regex)");
    const segs = SEG.segmentGroupSafe("Xin chào các bạn", [{ start: 1, end: Infinity, text: "Hello" }, { start: NaN, end: 4, text: "x" }]);
    assert.ok(segs.every(s => Number.isFinite(s.start) && Number.isFinite(s.end)));
});
