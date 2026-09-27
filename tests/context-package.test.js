// What reaches Gemini with each translation request, checked offline (1.8.3): grouping keeps a clause
// that runs across cues together, the context package carries the sentence a pronoun or an ellipsis
// points back to, windows translated in order carry the previous window's translation, hints are
// only the ones the domain decides, and the cache key holds exactly what changes the translation.
// No network: the service worker is faked, the prompt is built with the real background.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const C = require("../context-engine.js");
const corpus = require("./context-corpus.js");
const { bgEnv } = require("./bg-env.js");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

function contentEnv(onMsg, mode = "balanced", timeScale = 1) {
    const noop = () => {};
    const sb = {
        console: { log: noop, warn: noop, error: console.error }, clearTimeout,
        setTimeout: timeScale === 1 ? setTimeout : (fn, ms, ...a) => setTimeout(fn, (ms || 0) / timeScale, ...a), setInterval: () => 0, clearInterval: noop,
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number, TextEncoder, crypto: globalThis.crypto,
        location: { href: "https://www.youtube.com/watch?v=t", hostname: "www.youtube.com", pathname: "/watch" },
        document: { readyState: "complete", title: "t", body: {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            getElementsByTagName: () => [], createElement: () => ({ style: {}, appendChild: noop, addEventListener: noop }),
            head: { appendChild: noop }, documentElement: { appendChild: noop }, addEventListener: noop },
        addEventListener: noop, postMessage: noop, MutationObserver: class { observe() {} disconnect() {} }, alert: noop,
        requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
        chrome: {
            storage: { sync: { get: async d => ({ ...d, costMode: mode }), set: async () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener: noop } },
            runtime: { lastError: null, onMessage: { addListener: noop }, sendMessage: (m, cb) => Promise.resolve(onMsg(m)).then(cb) }
        }
    };
    sb.window = sb; sb.globalThis = sb;
    vm.createContext(sb);
    for (const f of ["glossary.js", "cst-cache.js", "cost-policy.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js", "youtube.js"]) vm.runInContext(read(f), sb);
    return sb;
}
async function ready(env) { for (let i = 0; i < 60 && !env.state?.reExact; i++) await new Promise(r => setTimeout(r, 5)); }

// A fake service worker that answers after a delay growing with the text and records every first
// request (a refine pass, which the fake text triggers in some modes, just returns the draft)
function slowWorker(sent) {
    return async m => {
        if (m.action !== "translateUnit") return { ok: true };
        if (m.refine) return { ok: true, engine: "gemini", model: "x", latency: 1, terms: [], translations: m.refine.draft };
        sent.push(JSON.parse(JSON.stringify(m)));
        const n = sent.length;
        await new Promise(r => setTimeout(r, 15 + m.sentences.join(" ").length / 40));
        return { ok: true, engine: "gemini", model: "x", latency: 1, terms: [],
            // glossary placeholders kept, or content.js resends the window unprotected
            translations: m.sentences.map((s, k) => [`Bản dịch ${n}.${k + 1}`, ...(s.match(/\[\[__T\d+__\]\]/g) || [])].join(" ")) };
    };
}

function sessionOf(units, meta = {}) {
    const s = new C.ContextSession(meta);
    s.setUnits(units);
    return s;
}

// ---------- Grouping: a clause across cues is one unit ----------
test("grouping: a clause split across cues stays one translation unit", async () => {
    const env = contentEnv(() => ({ ok: true }));
    const group = cues => { env.__c = cues; return JSON.parse(vm.runInContext("JSON.stringify(groupCuesIntoSentences(__c, false).map(g => g.text))", env)); };
    assert.deepEqual(group([
        { start: 0, end: 1.6, text: "After we finish this step," },
        { start: 1.6, end: 3.4, text: "we can move on to the next one." }
    ]), ["After we finish this step, we can move on to the next one."]);
    assert.deepEqual(group([
        { start: 0, end: 0.9, text: "I think" },
        { start: 0.9, end: 2.2, text: "this is important." }
    ]), ["I think this is important."]);
});

// ---------- The context package for a window starting at line 2 ----------
const CASES = [
    { name: "pronoun", units: ["Sam joined the company.", "He later became the CEO."], prev: /Sam joined/ },
    { name: "ellipsis", units: ["The first approach is expensive.", "The second is faster."], prev: /first approach/ },
    { name: "discourse", units: ["This is important.", "However, there is another problem."], prev: /This is important/ },
    { name: "entity", units: ["The company grew fast.", "The company then hired more people.", "It moved to a bigger office."], prev: /The company then hired/ }
];
for (const c of CASES) {
    test(`context package, ${c.name}: the window starting at the last line carries the line it points back to`, () => {
        const s = sessionOf(c.units);
        const last = c.units.length - 1;
        const req = s.buildRequest([last]);
        assert.deepEqual(req.sentences, [c.units[last]]);
        assert.match(req.context.prevSource, c.prev);
        // translated before: the previous translation rides along too
        s.record([last - 1], { translations: ["Bản dịch câu trước."] });
        assert.match(s.buildRequest([last]).context.prevTranslation, /Bản dịch câu trước/);
    });
}

test("context package, terminology: an agreed term comes back wherever it appears again, however far", () => {
    const units = ["The model was trained on web pages.", ...Array.from({ length: 12 }, (_, i) => `Filler sentence ${i}.`), "We fine-tune the model on reviews."];
    const s = sessionOf(units, { title: "Training language models" });
    s.record([0], { translations: ["Mô hình được huấn luyện trên các trang web."], terms: [{ en: "model", vi: "mô hình" }] });
    const req = s.buildRequest([units.length - 1]);
    assert.deepEqual(req.context.terms, [{ en: "model", vi: "mô hình" }]);
    // a term that is not in the lines to translate is not sent
    assert.deepEqual(s.buildRequest([3]).context.terms, []);
});

// ---------- Sense hints: only what the domain decides ----------
test("sense hints: no everyday-meaning fallback, no duplicate line for weight / weights", () => {
    const ml = { primary: "ml", secondary: null };
    assert.deepEqual(C.senseHintsFor("At this point, the model is ready.", ml), ["model: mô hình (học máy)"], "'point: ý, luận điểm' misled for 'at this point'");
    assert.deepEqual(C.senseHintsFor("We update the weights.", ml), ["weight: trọng số"]);
    assert.deepEqual(C.senseHintsFor("The new model is on this train.", { primary: "general", secondary: null }), [], "general talk: the model's own reading");
    // the domain-specific senses still go
    assert.match(C.senseHintsFor("choose the right channel for your ads", { primary: "marketing", secondary: null }).join(), /kênh tiếp thị/);
});

// ---------- Coursera: windows in order carry the previous translation ----------
test("Coursera: every window but the first of each half carries the previous window's translation", async () => {
    const sent = [];
    const env = contentEnv(slowWorker(sent), "economy");
    await ready(env);
    env.__cues = corpus.cues();
    await vm.runInContext(`(async () => {
        const gs = groupCuesIntoSentences(__cues, false);
        const s = new CST_CONTEXT.ContextSession({ title: "Training language models" });
        s.setUnits(gs.map(g => g.text));
        globalThis.__gs = gs;
        globalThis.__res = await translateAllGroups(s, gs, null, () => true, {});
    })()`, env);
    const windows = sent.length;
    assert.ok(windows >= 4, `only ${windows} windows`);
    const noPrev = sent.filter(m => m.context.prevSource && !m.context.prevTranslation).length;
    assert.ok(noPrev <= 1, `${noPrev} of ${windows} windows went without the previous translation (was all of them)`);
    // what it carries is that window's actual translation
    const withPrev = sent.find(m => m.context.prevTranslation);
    assert.match(withPrev.context.prevTranslation, /Bản dịch \d+\.\d+/);
    // every group translated exactly once, nothing sent twice
    assert.equal(sent.reduce((n, m) => n + m.sentences.length, 0), env.__gs.length);
    assert.ok(env.__res.every(Boolean));
});

test("Coursera: a short closing line rides with the window before it instead of its own request", async () => {
    const sent = [];
    const env = contentEnv(slowWorker(sent), "economy");
    await ready(env);
    // 8 sentences close a window at a sentence end; the 9th is a lone "Thanks for watching."
    env.__cues = [...Array.from({ length: 8 }, (_, i) => ({ start: i * 3, end: i * 3 + 2.5, text: `This is sentence number ${i} of the talk.` })),
        { start: 30, end: 31.5, text: "Thanks for watching." }];
    await vm.runInContext(`(async () => {
        const gs = groupCuesIntoSentences(__cues, false);
        const s = new CST_CONTEXT.ContextSession({});
        s.setUnits(gs.map(g => g.text));
        await translateAllGroups(s, gs, null, () => true, {});
    })()`, env);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].sentences.length, 9);
});

// ---------- YouTube: prefetch waits for the window before, windows keep a tail ----------
test("YouTube prefetch: a window further ahead waits for the one before it, so it carries that translation", async () => {
    const sent = [];
    const env = contentEnv(slowWorker(sent), "balanced");
    await ready(env);
    env.__cues = corpus.cues();
    vm.runInContext(`
        const gs = groupCuesIntoSentences(__cues, false).map(g => ({ ...g, translated: false, viCues: null }));
        globalThis.__gs = gs;
        yt.videoEl = { currentTime: 0, paused: false, addEventListener() {}, removeEventListener() {} };
        yt.groups = gs; yt.huyDich = false; yt.inFlightGroups.clear();
        yt.session = (() => { const s = new CST_CONTEXT.ContextSession({}); s.setUnits(gs.map(g => g.text)); return s; })();
        ytChayTienTrinhPrefetch(gs);
    `, env);
    for (let i = 0; i < 200 && !env.__gs.filter(g => g.start <= 100).every(g => g.translated); i++) await new Promise(r => setTimeout(r, 10));
    vm.runInContext("yt.huyDich = true;", env);
    const w = vm.runInContext("ytWindows(__gs)", env);
    const firstOf = m => env.__gs.findIndex(g => g.text === m.sentences[0]);
    const far = sent.filter(m => w.of[firstOf(m)] > 0 && env.__gs[firstOf(m)].start > 20);
    assert.ok(far.length >= 2, "the test needs windows beyond 20 s");
    for (const m of far) assert.ok(m.context.prevTranslation, `window at ${env.__gs[firstOf(m)].start}s sent without the previous translation`);
    // no window sent twice
    assert.equal(new Set(sent.map(m => m.sentences.join("|"))).size, sent.length);
});

test("YouTube windows: a short last window joins the one before when it fits every hard limit", () => {
    const env = contentEnv(() => ({ ok: true }));
    const g = (i, text, start) => ({ text, start, end: start + 2.5 });
    env.__g = [g(0, "This is the first sentence of the closing part, a longer one to fill the window.", 0),
        g(1, "Here is the second sentence, which is also fairly long to reach the soft limit.", 3),
        g(2, "A third sentence keeps adding characters so the window closes at its end here.", 6),
        g(3, "And a fourth one closes the window because it holds four groups by now.", 9),
        g(4, "Thanks for watching.", 12)];
    const w = JSON.parse(vm.runInContext("JSON.stringify(ytCanonicalWindows(__g))", env));
    assert.deepEqual(w.wins, [[0, 1, 2, 3, 4]]);
    assert.deepEqual(w.of, [0, 0, 0, 0, 0]);
    // too far apart in time: kept on its own
    env.__g[4].start = 60; env.__g[4].end = 61;
    assert.equal(vm.runInContext("ytCanonicalWindows(__g)", env).wins.length, 2);
});

// ---------- Cache identity ----------
test("cache key: source + source context + model; not the previous translation, the terms or the hints", async () => {
    const bg = bgEnv(async () => { throw new Error("offline"); });
    const key = (req, model = "gemini-3.1-flash-lite") => bg.sandbox.unitCacheKey(req, model);
    const base = { sentences: ["He later became the CEO."], context: { topic: "Tiêu đề: Startups", domain: "Kinh doanh", prevSource: "Sam joined the company.", nextSource: "It grew fast." } };
    const k0 = await key(base);
    assert.equal(await key(JSON.parse(JSON.stringify(base))), k0, "same subtitle, same context: hit");
    assert.notEqual(await key({ ...base, context: { ...base.context, prevSource: "Anna joined the company." } }), k0, "same subtitle, other antecedent: miss");
    assert.notEqual(await key({ ...base, context: { ...base.context, nextSource: "She left soon after." } }), k0);
    assert.notEqual(await key(base, "gemini-2.5-flash"), k0, "another model: miss");
    const extra = { ...base, context: { ...base.context, prevTranslation: "Sam vào công ty.", terms: [{ en: "CEO", vi: "giám đốc điều hành" }], senseHints: ["x"], phraseHints: ["y"] } };
    assert.equal(await key(extra), k0, "session state that varies from run to run must not split the cache");
});

// ---------- 1.8.4: antecedents further back ----------
test("far antecedent: a pronoun or 'the company' whose referent is 3+ units back gets that sentence", () => {
    const s = sessionOf(["Sam joined the company in 2019.", "The office was small.", "It had ten desks.", "We hired more people.",
        "He later became the CEO.", "The company then grew fast.", "So in practice, you start small.", "He said that was the key."]);
    assert.equal(s.buildRequest([4]).context.refSource, "Sam joined the company in 2019.");
    assert.equal(s.buildRequest([5]).context.refSource, "Sam joined the company in 2019.", "'the company' named long before");
    // the nearest sentence with a name wins over a nearer "the CEO"
    assert.equal(s.buildRequest([7]).context.refSource, "Sam joined the company in 2019.");
    // antecedent already in the previous two units or inside the window: nothing added
    assert.equal(s.buildRequest([2]).context.refSource, "");
    assert.equal(s.buildRequest([0, 1, 2, 3, 4]).context.refSource, "");
});

test("far antecedent: 'it' / 'they' add nothing, a running topic word adds nothing, the lookback is bounded", () => {
    const s = sessionOf(["The dataset has images.", "Filler one.", "Filler two.", "Filler three.", "It is large and they are labelled."]);
    assert.equal(s.buildRequest([4]).context.refSource, "", "'it' points at almost anything");
    const ml = sessionOf(["The model is small.", "We train the model.", "The model learns.", "Filler.", "Filler again.", "Then the model converges."]);
    assert.equal(ml.buildRequest([5]).context.refSource, "", "'the model' all through the talk is the topic");
    const far = sessionOf(["Sam wrote it.", ...Array.from({ length: 20 }, (_, i) => `filler number ${i}.`), "He was right."]);
    assert.equal(far.buildRequest([21]).context.refSource, "", "not beyond the lookback");
    // a sentence opener is not a name, a name that opens a sentence is
    const opener = sessionOf(["Maria Lopez leads the group.", "The group has twelve members.", "Most of them work on vision.", "Now we test.", "She moved the team."]);
    assert.equal(opener.buildRequest([4]).context.refSource, "Maria Lopez leads the group.");
});

test("far antecedent: in the prompt only when present, and in the cache key only when present", async () => {
    const bg = bgEnv(async () => { throw new Error("offline"); });
    const base = { sentences: ["He later became the CEO."], context: { topic: "t", domain: "d", prevSource: "We hired more people.", nextSource: "" } };
    const withRef = { ...base, context: { ...base.context, refSource: "Sam joined the company in 2019." } };
    assert.doesNotMatch(bg.sandbox.buildUnitPrompt(base).user, /NHẮC LẠI/);
    assert.match(bg.sandbox.buildUnitPrompt(withRef).user, /\[NHẮC LẠI TỪ TRƯỚC, chỉ để hiểu đại từ\] Sam joined/);
    const key = r => bg.sandbox.unitCacheKey(r, "gemini-3.1-flash-lite");
    assert.equal(await key({ ...base, context: { ...base.context, refSource: "" } }), await key(base), "keys without it unchanged");
    assert.notEqual(await key(withRef), await key(base), "another referent, another translation");
});

test("topic: links, handles, sponsor lines and timestamps leave the video description", () => {
    const d = C.cleanDescription("Learn transformers from scratch.\nhttps://x.com/abc\nFollow me on Twitter @abc\n0:00 Intro\n#ai #ml\nThis video is sponsored by NordVPN\nIn this video we build GPT.");
    assert.equal(d, "Learn transformers from scratch. In this video we build GPT.");
    const s = new C.ContextSession({ title: "GPT", description: "Use code SAVE10 for a discount\nWe build a tokenizer." });
    assert.equal(s.topicLine(), "Tiêu đề: GPT | Mô tả: We build a tokenizer.");
});

// ---------- 1.8.4: realtime path, timeliness, console summary ----------
test("YouTube realtime: the next group in a later window waits when that window plays far ahead", () => {
    const env = contentEnv(() => ({ ok: true }));
    vm.runInContext(`
        globalThis.__g = Array.from({ length: 12 }, (_, i) => ({ text: "Sentence " + i + " is a complete sentence of some length to fill a window.", start: i * 8, end: i * 8 + 7, translated: false }));
        yt.groups = __g; yt.inFlightGroups.clear();
    `, env);
    const w = JSON.parse(vm.runInContext("JSON.stringify(ytWindows(__g))", env));
    assert.ok(w.wins.length >= 2);
    const second = w.wins[1][0];
    const wait = t => vm.runInContext(`ytWaitForWindowBefore(__g, ${second}, ${t})`, env);
    assert.equal(wait(__secondStart(env, second) - 60), true, "far ahead, window before still to do: wait");
    assert.equal(wait(__secondStart(env, second) - 10), false, "plays within 20 s: send now");
    vm.runInContext(`ytWindows(__g).wins[0].forEach(k => { __g[k].translated = true; })`, env);
    assert.equal(wait(__secondStart(env, second) - 60), false, "window before done: send");
    assert.equal(vm.runInContext("ytWaitForWindowBefore(__g, 0, 0)", env), false, "the first window never waits");
});
function __secondStart(env, i) { return vm.runInContext(`__g[${i}].start`, env); }

test("YouTube timeliness: with 3 s replies every window from the third on is ready 10 s before it plays", async () => {
    const K = 50;                 // video seconds run 50 times faster than real ones, timers too
    const sent = [];
    const env = contentEnv(async m => {
        if (m.action !== "translateUnit") return { ok: true };
        if (m.refine) return { ok: true, engine: "gemini", model: "x", terms: [], translations: m.refine.draft };
        sent.push(m);
        await new Promise(r => setTimeout(r, 3000 / K));
        return { ok: true, engine: "gemini", model: "x", latency: 1, terms: [], translations: m.sentences.map(t => ["Bản dịch", ...(t.match(/\[\[__T\d+__\]\]/g) || [])].join(" ")) };
    }, "balanced", K);
    await ready(env);
    const t0 = Date.now();
    env.__now = () => (Date.now() - t0) * K / 1000;
    env.__cues = corpus.cues();
    vm.runInContext(`
        const gs = groupCuesIntoSentences(__cues, false).map(g => ({ ...g, translated: false, viCues: null }));
        globalThis.__gs = gs;
        yt.videoEl = { get currentTime() { return __now(); }, paused: false, addEventListener() {}, removeEventListener() {} };
        yt.groups = gs; yt.huyDich = false; yt.inFlightGroups.clear();
        yt.session = (() => { const s = new CST_CONTEXT.ContextSession({}); s.setUnits(gs.map(g => g.text)); return s; })();
        ytChayTienTrinhPrefetch(gs);
    `, env);
    const doneAt = new Map();
    while (env.__now() < 130) {
        await new Promise(r => setTimeout(r, 2));
        env.__gs.forEach((g, i) => { if (g.translated && !doneAt.has(i)) doneAt.set(i, env.__now()); });
    }
    vm.runInContext("yt.huyDich = true;", env);
    const w = JSON.parse(vm.runInContext("JSON.stringify(ytWindows(__gs).wins)", env));
    const leads = w.map(win => env.__gs[win[0]].start - (doneAt.has(win[0]) ? doneAt.get(win[0]) : Infinity)).filter((_, k) => env.__gs[w[k][0]].start < 120);
    assert.ok(leads.length >= 4);
    for (const [k, lead] of leads.entries()) if (k >= 2) assert.ok(lead >= 10, `window ${k} ready only ${lead.toFixed(1)} s ahead`);
    assert.ok(sent.filter(m => m.context.prevSource && !m.context.prevTranslation).length <= 1);
});

test("console line tells what context went with the request", () => {
    const env = contentEnv(() => ({ ok: true }));
    const line = vm.runInContext(`contextSummary({ prevSource: "a", prevTranslation: "", refSource: "Sam.", terms: [{}], senseHints: ["x"], phraseHints: [] })`, env);
    assert.equal(line, " · ngữ cảnh: câu trước ✓, bản dịch trước ✗, nhắc lại xa ✓, thuật ngữ 1, gợi ý 1");
});
