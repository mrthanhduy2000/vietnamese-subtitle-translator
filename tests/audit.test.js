// Codebase audits (1.7.3, 1.7.4): behaviour that changed or was removed, pinned so it cannot come back.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { bgEnv } = require("./bg-env.js");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// content.js (+ youtube.js) in a sandbox that records storage calls and change listeners
function pageEnv(opts = {}) {
    const noop = () => {};
    const calls = { localGet: [], localSet: [], selector: 0 };
    const changeListeners = [];
    const el = () => ({ style: {}, dataset: {}, appendChild: noop, addEventListener: noop, setAttribute: noop, remove: noop });
    const store = { ...(opts.local || {}) };
    const intervals = [];
    const sandbox = {
        console: { log: noop, warn: noop, error: console.error },
        // opts.timers: real timers, 100x faster (a 1500 ms wait takes 15 ms); intervals are recorded
        // and never fire on their own (E.intervals)
        setTimeout: opts.timers ? (f, ms) => setTimeout(f, (ms || 0) / 100) : () => 0, clearTimeout: opts.timers ? clearTimeout : noop,
        setInterval: f => { intervals.push(f); return intervals.length; }, clearInterval: noop,
        ...(opts.timers ? { requestAnimationFrame: () => 0, URL } : {}),
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number,
        performance: { now: () => opts.now ? opts.now() : 0 },
        location: opts.location || { href: "https://www.youtube.com/watch?v=abc", hostname: "www.youtube.com", pathname: "/watch" },
        document: {
            readyState: "complete", title: "t", body: el(), head: el(), documentElement: el(), getElementById: () => null,
            querySelector: s => { calls.selector++; return opts.querySelector ? opts.querySelector(s) : null; },
            querySelectorAll: () => [], getElementsByTagName: t => (t === "track" && opts.tracks ? opts.tracks() : []),
            createElement: el, addEventListener: noop
        },
        VTTCue: class { constructor(start, end, text) { Object.assign(this, { startTime: start, endTime: end, text }); } },
        addEventListener: noop, postMessage: noop,
        MutationObserver: class { observe() {} disconnect() {} },
        chrome: {
            storage: {
                sync: { get: async d => ({ ...d, autoTranslate: false, ...(opts.sync || {}) }), set: async () => {} },
                local: {
                    get: async k => { calls.localGet.push(k); return k === null ? { ...store } : typeof k === "object" && k ? { ...k, ...store } : store; },
                    set: async o => { calls.localSet.push(o); Object.assign(store, o); },
                    remove: async () => {}
                },
                onChanged: { addListener: fn => changeListeners.push(fn) }
            },
            runtime: { id: "ext", lastError: null, onMessage: { addListener: noop }, sendMessage: opts.sendMessage || noop }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of ["glossary.js", "subtitle-style.js", "vi-segmenter.js", ...(opts.files || []), "content.js", ...(opts.youtube ? ["youtube.js"] : [])]) vm.runInContext(read(f), sandbox);
    return { sandbox, calls, changeListeners, store, intervals, run: code => vm.runInContext(code, sandbox) };
}

test("popup 'Tiếng Anh ở trên' applies while watching, not only after the next Translate click", async () => {
    const E = pageEnv();
    await new Promise(r => setImmediate(r));
    assert.equal(E.run("state.originalFirst"), false);
    E.run("cs.renderKey = 'x'");
    for (const fn of E.changeListeners) fn({ originalFirst: { newValue: true } }, "sync");
    assert.equal(E.run("state.originalFirst"), true);
    assert.equal(E.run("cs.renderKey"), "", "the subtitle repaints now");
});

test("the dead 'Làm mờ dòng tiếng Anh' switch is gone from the popup and the page state", () => {
    for (const f of ["popup.html", "popup.js", "content.js"]) assert.doesNotMatch(read(f), /styleOriginal/, f);
    for (const k of ["dubVoiceName", "dubAutoRate"]) assert.doesNotMatch(read("content.js"), new RegExp(k));
});

test("Coursera render loop: the player box is looked up at most once per 500 ms, not every frame", () => {
    let clock = 0;
    const video = { parentElement: { isConnected: true, clientWidth: 640 }, getBoundingClientRect: () => ({ width: 0, height: 0 }) };
    const E = pageEnv({
        now: () => clock,
        location: { href: "https://www.coursera.org/learn/ml/lecture/a", hostname: "www.coursera.org", pathname: "/learn/ml/lecture/a" },
        querySelector: s => (s === "video" ? video : null)
    });
    const before = E.calls.selector;
    for (let i = 0; i < 30; i++) { clock += 16; E.run("csPlayerBox()"); }          // ~0.5 s of frames
    const lookups = E.calls.selector - before;
    assert.ok(lookups <= 2, `${lookups} lookups in 30 frames`);
    assert.equal(E.run("csPlayerBox()"), video.parentElement);
    clock += 600;
    E.run("csPlayerBox()");
    assert.ok(E.calls.selector - before > lookups, "looked up again once the memo expired");
});

test("YouTube: a video with a line from the Google fallback is not saved, so the next visit gets Gemini", async () => {
    const E = pageEnv({ youtube: true });
    await new Promise(r => setImmediate(r));
    E.run(`yt.cues = [{ start: 0, end: 2, text: "Hello." }];
        yt.viCues = [{ start: 0, end: 2, text: "Xin chào.", lines: ["Xin chào."] }];
        yt.groups = [{ start: 0, end: 2, text: "Hello.", translated: true, viText: "Xin chào.", fallback: true, srcCues: [{ start: 0, end: 2, text: "Hello." }], viCues: [{ start: 0, end: 2, text: "Xin chào." }] }];`);
    await E.run("ytGhiCache('abc')");
    assert.equal(E.calls.localSet.filter(o => Object.keys(o).some(k => k.startsWith("ytcache4_"))).length, 0);
    E.run("yt.groups[0].fallback = false");
    await E.run("ytGhiCache('abc')");
    assert.ok(E.calls.localSet.some(o => o.ytcache4_abc), "an all-Gemini video is saved as before");
    // ytGanBanDich records who translated
    E.run(`yt.groups = [{ start: 0, end: 2, text: "Hi.", srcCues: [{ start: 0, end: 2, text: "Hi." }], translated: false }];
        ytGanBanDich(yt.groups, [0], ["Chào."], "google_fallback");`);
    assert.equal(E.run("yt.groups[0].fallback"), true);
});

test("YouTube: the full-storage sweep runs at most once a day, not on every tab load", async () => {
    const E = pageEnv({ youtube: true, local: { ytSweptAt: Date.now() - 3600e3 } });
    await new Promise(r => setImmediate(r));
    const full = () => E.calls.localGet.filter(k => k === null).length;
    assert.equal(full(), 0, "swept an hour ago: the tab does not read all of storage");
    E.store.ytSweptAt = Date.now() - 2 * 864e5;
    await E.run("ytSweepCacheDaily()");
    assert.equal(full(), 1);
    await E.run("ytSweepCacheDaily()");
    assert.equal(full(), 1, "stamped: not again today");
});

test("Google fallback translates the window's sentences at once, not one after another", async () => {
    let inFlight = 0, peak = 0;
    const E = bgEnv(async u => {
        inFlight++; peak = Math.max(peak, inFlight);
        await new Promise(r => setTimeout(r, 30));
        inFlight--;
        return { ok: true, status: 200, json: async () => [[["Bản Google", "x"]], null, "en"] };
    }, { useAi: false });
    const r = await E.send({ action: "translateUnit", sentences: ["One.", "Two.", "Three.", "Four."], context: {} });
    assert.equal(r.engine, "google", "Gemini switched off: Google is the chosen engine, not a fallback");
    assert.equal(r.translations.length, 4);
    assert.equal(peak, 4);
});

test("removed dead code stays removed", () => {
    assert.doesNotMatch(read("youtube.js"), /ytBatDauDOMCaptionObserver|liveSession|ytCapNhatTienTrinh|cst-yt-icon|cst-yt-dub-icon/);
    assert.doesNotMatch(read("content.js"), /cst-dub-icon\[/);
    assert.doesNotMatch(read("dubbing.js"), /pickVietnameseVoice/);
    assert.doesNotMatch(read("dub-audio.js"), /function gateNoise/);
    assert.doesNotMatch(read("background.js"), /localTtsWarm|handleLocalTtsWarm/);
    assert.equal(require("../cost-policy.js").DEFAULT_MODELS.universal, undefined);
});

// ---- 1.7.4 ----

test("Coursera: leaving a lecture mid-translation stops its Gemini calls, never paints it over the next lecture, and the next one still auto-translates", async () => {
    const lecture = (name, n) => Array.from({ length: n }, (_, i) => ({ startTime: i * 3, endTime: i * 3 + 2.5, text: `In ${name}, sentence ${i} explains how the gradient moves the weights.` }));
    const trackOf = cues => ({ srclang: "en", kind: "subtitles", label: "English", track: { mode: "disabled", cues, addCue() {}, removeCue() {} } });
    let tracks = [trackOf(lecture("lecture one", 60))];
    const sent = [], held = [];
    const E = pageEnv({
        timers: true, files: ["lang-detect.js", "context-engine.js"], sync: { autoTranslate: true },
        location: { href: "https://www.coursera.org/learn/ml/lecture/a", hostname: "www.coursera.org", pathname: "/learn/ml/lecture/a" },
        tracks: () => tracks,
        sendMessage: (msg, cb) => {
            if (msg.action !== "translateUnit") return cb && cb({ ok: true });
            sent.push(msg);
            held.push(() => cb({ ok: true, engine: "gemini", model: "m", translations: msg.sentences.map(s => `Bản dịch: ${s}`) }));
        }
    });
    const tick = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 50 && !sent.length; i++) await tick(5);       // lecture one auto-translates
    const inFlight = sent.length;
    assert.ok(inFlight >= 1 && inFlight <= 2, `${inFlight} windows in flight`);
    // the viewer moves on to the next lecture while those windows are still out
    Object.assign(E.sandbox.location, { href: "https://www.coursera.org/learn/ml/lecture/b", pathname: "/learn/ml/lecture/b" });
    tracks = [trackOf(lecture("lecture two", 12))];
    E.intervals.forEach(f => f());
    await tick(40);                                                    // lecture two's auto-translate is waiting
    held.splice(0).forEach(f => f());
    for (let i = 0; i < 100 && sent.length === inFlight; i++) await tick(5);
    const old = sent.slice(inFlight).filter(m => m.sentences.some(s => s.includes("lecture one")));
    assert.deepEqual(old, [], "windows of the lecture left behind were still sent to Gemini");
    assert.ok(sent.slice(inFlight).some(m => m.sentences.some(s => s.includes("lecture two"))), "the next lecture never auto-translated");
    for (let i = 0; i < 100 && !E.run("state.active"); i++) { held.splice(0).forEach(f => f()); await tick(5); }
    const shown = E.run("cs.viCues.map(c => c.text).join(' ')");
    assert.match(shown, /lecture two/);
    assert.doesNotMatch(shown, /lecture one/, "the old lecture's Vietnamese is on the new video");
});

test("YouTube: opening another video while the first one loads never puts the first one's captions on it, and the new one still auto-translates", async () => {
    const held = [], sent = [];
    const E = pageEnv({
        youtube: true, timers: true, files: ["lang-detect.js", "context-engine.js"], sync: { autoTranslate: true },
        location: { href: "https://www.youtube.com/watch?v=aaa", hostname: "www.youtube.com", pathname: "/watch" },
        sendMessage: (msg, cb) => {
            if (msg.action !== "translateUnit") return cb && cb({ ok: true });
            sent.push(msg);
            cb({ ok: true, engine: "gemini", model: "m", translations: msg.sentences.map(s => `Bản dịch: ${s}`) });
        }
    });
    E.sandbox.__held = held;
    // the bridge and the network, stubbed: the caption fetch waits until the test lets it go
    E.run(`
        ytHoiDanhSachPhuDe = async () => { const v = ytLayMaVideo(); return { videoId: v, title: "Video " + v, author: "ch", tracks: [{ baseUrl: "cap-" + v, languageCode: "en", kind: "" }] }; };
        ytTaiBanChepLoi = url => new Promise(r => __held.push(() => r(Array.from({ length: 8 }, (_, i) => ({ start: i * 3, end: i * 3 + 2.5, text: url + " line " + i + " explains the gradient." }))))); 
        ytDocCache = async () => null;
        ytNhanDienNgonNgu = async () => ({ lang: "en", confidence: 1, source: "test", action: "translate" });
    `);
    const tick = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 100 && !held.length; i++) await tick(5);      // video aaa is fetching its captions
    assert.equal(held.length, 1);
    Object.assign(E.sandbox.location, { href: "https://www.youtube.com/watch?v=bbb" });
    E.intervals.forEach(f => f());                                    // ytTheoDoi notices the new video
    await tick(20);
    held.shift()();                                                   // aaa's captions arrive late
    for (let i = 0; i < 100 && !held.length; i++) await tick(5);
    assert.equal(held.length, 1, "the new video never asked for its captions");
    held.shift()();
    for (let i = 0; i < 100 && !sent.length; i++) await tick(5);
    const lines = sent.flatMap(m => m.sentences).join(" ");
    assert.doesNotMatch(lines, /cap-aaa/, "the video left behind was sent to Gemini");
    assert.match(lines, /cap-bbb/);
    assert.equal(E.run("yt.currentVideoId"), "bbb");
    assert.ok(E.run("yt.cues.every(c => c.text.startsWith('cap-bbb'))"), "the old video's captions are on the new one");
});
