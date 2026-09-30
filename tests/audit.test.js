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
    const calls = { localGet: [], localSet: [], localRemove: [], selector: 0 };
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
                    remove: async k => { calls.localRemove.push(k); for (const x of [].concat(k)) delete store[x]; }
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

// ---- 1.7.5 ----

// A 10-minute Coursera lecture (200 lines of ~60 characters) translated with the Gemini replies
// released one at a time, so what the viewer sees can be checked after each reply
async function courseraLecture(startAt) {
    const cues = Array.from({ length: 200 }, (_, i) => ({ startTime: i * 3, endTime: i * 3 + 2.8, text: `Line ${i} says the gradient moves the weights a bit.` }));
    const track = { srclang: "en", kind: "subtitles", label: "English", track: { mode: "disabled", cues, addCue() {}, removeCue() {} } };
    const video = { currentTime: startAt, duration: 600, parentElement: null, getBoundingClientRect: () => ({ width: 0, height: 0 }) };
    const sent = [], held = [];
    const E = pageEnv({
        timers: true, files: ["lang-detect.js", "context-engine.js"],
        location: { href: "https://www.coursera.org/learn/ml/lecture/a", hostname: "www.coursera.org", pathname: "/learn/ml/lecture/a" },
        tracks: () => [track],
        querySelector: s => (s === "video" ? video : null),
        sendMessage: (msg, cb) => {
            if (msg.action !== "translateUnit") return cb && cb({ ok: true });
            sent.push(msg);
            held.push(() => cb({ ok: true, engine: "gemini", model: "m", translations: msg.sentences.map(s => `Dịch: ${s}`) }));
        }
    });
    const tick = ms => new Promise(r => setTimeout(r, ms));
    await tick(20);
    const done = E.run("enableTranslation()");
    return { E, sent, held, tick, done };
}

test("Coursera: the first translated lines show after the first Gemini reply, not after the whole lecture (1.7.5)", async () => {
    const { E, sent, held, tick, done } = await courseraLecture(0);
    let replies = 0, firstShown = 0;
    while (true) {
        for (let i = 0; i < 50 && !held.length; i++) await tick(2);
        if (!held.length) break;
        held.shift()();
        replies++;
        await tick(5);
        if (!firstShown && E.run("cs.viCues.length") > 0) {
            firstShown = replies;
            assert.equal(E.run("state.active"), true, "the button says on while the rest is translated");
            assert.equal(E.run("csTranslating()"), true);
            assert.equal(E.run("state.groupTotal"), E.run("state.contextSession.units.length"), "the popup gets the lecture's real total");
        }
    }
    await done;
    assert.ok(replies >= 8, `${replies} windows`);
    assert.equal(firstShown, 1, `the first line showed after ${firstShown} of ${replies} replies`);
    assert.equal(E.run("csTranslating()"), false);
    assert.equal(E.run("cs.viCues.length") > 150, true, "the whole lecture at the end");
    assert.equal(sent.length, replies, "no window sent twice");
});

test("Coursera: a lecture resumed at 5:00 translates the lines at 5:00 first (1.7.5)", async () => {
    const { E, sent, held, tick } = await courseraLecture(300);
    for (let i = 0; i < 50 && !sent.length; i++) await tick(2);
    assert.match(sent[0].sentences.join(" "), /Line 10\d /, "the first window sent is the one under the playhead");
    held.shift()();
    await tick(5);
    assert.ok(E.run("cs.viCues.some(c => c.start <= 300 && c.end >= 300)"), "the line on screen now is Vietnamese");
    E.run("disableTranslation()");                                   // turned off mid-lecture
    const before = sent.length;
    held.splice(0).forEach(f => f());
    await tick(30);
    assert.ok(sent.length - before <= 1, "a switched-off lecture kept sending windows");
    assert.equal(E.run("state.active"), false);
    assert.equal(E.run("csTranslating()"), false, "the button would still spin for a run turned off");
});

test("Coursera: the button is redrawn once the translation is over, not left spinning (1.7.5, seen in 1.7.4)", async () => {
    const { E, held, tick, done } = await courseraLecture(0);
    E.sandbox.__draws = [];
    E.run("csUpdateButton = status => __draws.push({ status, busy: state.busy, active: state.active })");
    for (let n = 0; n < 60; n++) { for (let i = 0; i < 20 && !held.length; i++) await tick(2); if (!held.length) break; held.shift()(); }
    await done;
    const last = E.sandbox.__draws[E.sandbox.__draws.length - 1];
    assert.equal(last.busy, false, "the last draw of the button happened while `busy` still held");
    assert.equal(last.active, true);
});

// popup.js in a sandbox: the active tab at `url`, the page answering getStatus with `status()`
function popupEnv(url, status) {
    const els = new Map();
    const el = id => {
        if (!els.has(id)) {
            const handlers = {};
            els.set(id, {
                id, hidden: false, textContent: "", innerHTML: "", checked: false, disabled: false, style: {}, dataset: {}, className: "",
                classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
                addEventListener: (t, f) => { handlers[t] = f; }, handlers, setAttribute() {}, getAttribute: () => null,
                querySelector: () => el(`${id} >`), querySelectorAll: () => [], appendChild() {}
            });
        }
        return els.get(id);
    };
    const ready = [];
    const sandbox = {
        console: { log() {}, warn() {}, error: console.error },
        setTimeout: (f, ms) => setTimeout(f, (ms || 0) / 100), clearTimeout, setInterval: () => 0, clearInterval() {},
        Promise, Math, JSON, Date, URLSearchParams,
        document: {
            addEventListener: (t, f) => { if (t === "DOMContentLoaded") ready.push(f); },
            getElementById: el, querySelector: s => el(s), querySelectorAll: () => [], createElement: () => el(`new${Math.random()}`), body: el("body")
        },
        chrome: {
            storage: { sync: { get: async d => d, set: async () => {} }, onChanged: { addListener() {} } },
            tabs: {
                query: async () => [{ id: 7, url }],
                sendMessage: async (id, m) => (m.method === "getStatus" ? status() : { ok: true })
            },
            runtime: { lastError: null, sendMessage: (m, cb) => cb && cb({ ok: false }), getManifest: () => ({ version: "x" }), openOptionsPage() {}, getURL: p => p }
        }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(read("popup.js"), sandbox);
    return { el, run: () => ready[0]() };
}

test("popup: the translation progress keeps moving while the popup is open, and the buttons are wired at once (1.7.5)", async () => {
    let xong = 10;
    const P = popupEnv("https://www.coursera.org/learn/ml/lecture/a",
        () => ({ site: "coursera", title: "Bài 1", active: true, busy: xong < 100, dub: { on: false }, xong: Math.min(100, xong += 30), tong: 100 }));
    const el = P.el;
    const run = P.run();
    const first = await Promise.race([run.then(() => "done"), new Promise(r => setTimeout(() => r("stuck"), 200))]);
    assert.equal(first, "done", "the popup's setup waited for the progress loop");
    assert.ok(el("translateBtn").handlers.click, "the translate button is wired");
    const seen = new Set([el("nowCount").textContent]);
    for (let i = 0; i < 40 && el("nowCount").textContent !== "Đã dịch xong"; i++) { await new Promise(r => setTimeout(r, 10)); seen.add(el("nowCount").textContent); }
    assert.equal(el("nowCount").textContent, "Đã dịch xong", [...seen].join(" | "));
    assert.ok(seen.size >= 3, `the bar moved through ${[...seen].join(" | ")}`);
    assert.equal(el("btnLabel").textContent, "Dịch lại bài giảng");
});

// 2.3.3: the button said "bài giảng" (lecture) on every page, while most of what is watched is
// everyday YouTube videos
test("popup: the button names a lecture on Coursera and a video anywhere else", async () => {
    const P = popupEnv("https://www.youtube.com/watch?v=abc", () => null);
    await P.run();
    assert.equal(P.el("btnLabel").textContent, "Bắt đầu dịch video");
    const Q = popupEnv("https://www.youtube.com/watch?v=abc", () => ({ site: "youtube", title: "A talk", active: true, busy: false, dub: { on: false }, xong: 5, tong: 5 }));
    await Q.run();
    assert.equal(Q.el("btnLabel").textContent, "Dịch lại video");
    assert.match(read("popup.html"), /id="btnLabel">Bắt đầu dịch</);
});

// 2.3.3: 43 of the user's 51 per-channel term lists were empty, left from before 2.3.1
test("channel terms: the cache sweep drops empty and old lists, keeps a live one", async () => {
    const day = 864e5;
    const E = pageEnv({ youtube: true, local: {
        ctxterms_yt_empty: { luc: Date.now(), terms: [] },
        ctxterms_yt_old: { luc: Date.now() - 61 * day, terms: [["a b", "c", 1]] },
        ctxterms_yt_live: { luc: Date.now(), v: 2, terms: [["gradient descent", "hạ gradient", 2]] },
        // 2.3.8: a channel list from before the stamp was learned while vlogs passed for lectures
        ctxterms_yt_unstamped: { luc: Date.now(), terms: [["Whole Foods", "thực phẩm hữu cơ", 1], ["pricey", "giá thành cao", 1]] },
        ctxterms_coursera_course: { luc: Date.now(), terms: [["slash commands", "lệnh gạch chéo", 1]] }
    } });
    await E.run("ytDonCache()");
    assert.deepEqual(Object.keys(E.store).filter(k => k.startsWith("ctxterms_")).sort(), ["ctxterms_coursera_course", "ctxterms_yt_live"]);
});

// 2.3.9: the user watches a batch of up to 50 new videos, then has the batch reviewed from the cache
test("saved videos: 50 are kept, the oldest go first, and bytes are capped below the storage quota", async () => {
    const video = (luc, chars) => ({ luc, cues: [[0, 1, "a"]], vi: [[0, 1, "b"]], g: [], pad: "x".repeat(chars || 0) });
    const local = {};
    for (let i = 1; i <= 53; i++) local[`ytcache4_v${i}`] = video(i);
    const E = pageEnv({ youtube: true, local });
    await E.run("ytDonCache()");
    const left = Object.keys(E.store).filter(k => k.startsWith("ytcache4_"));
    assert.equal(left.length, 50);
    assert.ok(!left.includes("ytcache4_v3") && left.includes("ytcache4_v4") && left.includes("ytcache4_v53"));
    // three long videos of ~3.5 MB: two fit under 8 MB, the oldest goes
    const B = pageEnv({ youtube: true, local: { ytcache4_old: video(1, 3e6), ytcache4_mid: video(2, 3e6), ytcache4_new: video(3, 3e6) } });
    await B.run("ytDonCache()");
    assert.deepEqual(Object.keys(B.store).filter(k => k.startsWith("ytcache4_")).sort(), ["ytcache4_mid", "ytcache4_new"]);
    // one video over the cap alone is still kept: it is the one being watched
    const O = pageEnv({ youtube: true, local: { ytcache4_huge: video(1, 8e6) } });
    await O.run("ytDonCache()");
    assert.deepEqual(Object.keys(O.store).filter(k => k.startsWith("ytcache4_")), ["ytcache4_huge"]);
    assert.equal(Number(read("youtube.js").match(/const YT_CACHE_TOI_DA = (\d+);/)[1]), Number(read("background.js").match(/const YT_SAVED_MAX = (\d+);/)[1]), "Settings shows the real limit");
});

test("channel terms: an unstamped YouTube list is not read, a stamped one and a course list are", async () => {
    const E = pageEnv({ files: ["context-engine.js"], local: {
        ctxterms_yt_old: { luc: Date.now(), terms: [["pricey", "giá thành cao", 1]] },
        ctxterms_yt_new: { luc: Date.now(), v: 2, terms: [["gradient descent", "hạ gradient", 2]] },
        ctxterms_course: { luc: Date.now(), terms: [["slash commands", "lệnh gạch chéo", 1], ["model context protocol", "[[__T1__]]", 1]] }
    } });
    const terms = async key => JSON.parse(await E.run(`createContextSession({ title: "x" }, ${JSON.stringify(key)}).then(s => JSON.stringify(s.exportTerms()))`));
    assert.deepEqual(await terms("yt_old"), []);
    assert.deepEqual(await terms("yt_new"), [["gradient descent", "hạ gradient", 2]]);
    assert.deepEqual(await terms("course"), [["slash commands", "lệnh gạch chéo", 1]], "a placeholder is no translation");
});

// 2.3.3: left open, Settings asked the local voice server twice every 5 s for hours (5,082 requests
// in 6 idle hours of the user's server log). Fast only while the server is not up yet.
test("settings: the local voice status is polled every 5 s until the server runs, then every 30 s", () => {
    const js = read("options.js");
    assert.doesNotMatch(js, /setInterval\(\(\) => \{ if \(!document\.hidden\) refreshLocalStatus\(\); \}, 5000\)/);
    assert.match(js, /if \(first === true \|\| !document\.hidden\) localRunning = await refreshLocalStatus\(\);\n\s+setTimeout\(pollLocal, localRunning \? 30000 : 5000\);/);
    assert.match(js, /if \(localStatusEl\) pollLocal\(true\);/, "the first check runs even in a background tab");
});

// 2.3.1: the cost card listed "(1) I Removed Everything I Didn't Need - YouTube" (4 of the 5 real
// titles of one day carried the notification count). Every title read goes through one cleaner.
test("video title: no notification count, no site name, one cleaner for every caller", () => {
    const E = pageEnv({ youtube: true });
    for (const [raw, want] of [["(1) I Removed Everything - YouTube", "I Removed Everything"], ["(12+) A talk - YouTube", "A talk"], ["(2024) Year in review - YouTube", "Year in review"], ["Plain title", "Plain title"]]) {
        E.sandbox.document.title = raw;
        assert.equal(E.run("pageVideoTitle()"), want, raw);
        assert.equal(E.run("currentVideoMeta().videoTitle"), want, raw);
    }
    // Once the player has told youtube.js the title of this video, that title wins: the tab title
    // cannot tell a count from a title that starts with "(2024) "
    E.sandbox.URL = URL;
    E.run("yt.currentVideoId = 'abc'; yt.videoTitle = '(2024) Year in review'");
    E.sandbox.document.title = "(2024) Year in review - YouTube";
    assert.equal(E.run("pageVideoTitle()"), "(2024) Year in review");
    E.run("yt.currentVideoId = 'next'");
    assert.equal(E.run("pageVideoTitle()"), "Year in review", "another video in the address bar: the tab title again");
    const h1 = { textContent: "  Gradient Descent  " };
    const C = pageEnv({ location: { href: "https://www.coursera.org/learn/ml/lecture/x", hostname: "www.coursera.org", pathname: "/learn/ml/lecture/x" }, querySelector: s => (s === "h1" ? h1 : null) });
    assert.equal(C.run("pageVideoTitle()"), "Gradient Descent");
    h1.textContent = "";
    C.sandbox.document.title = "Gradient Descent | Coursera";
    assert.equal(C.run("pageVideoTitle()"), "Gradient Descent");
    for (const f of ["content.js", "youtube.js", "dubbing.js"]) {
        const reads = read(f).match(/document\.title/g) || [];
        assert.ok(reads.length <= (f === "content.js" ? 3 : f === "dubbing.js" ? 1 : 0), `${f}: a new raw document.title read (${reads.length})`);
    }
});

// 2.3.1: 43 of the 51 real per-channel term keys were an empty list (everyday videos learn none)
test("channel terms: a video that learned no terms writes no key", async () => {
    const E = pageEnv({ timers: true, files: ["context-engine.js"] });
    const writes = () => E.calls.localSet.filter(o => "ctxterms_yt_a" in o);
    E.run("globalThis.s1 = new CST_CONTEXT.ContextSession({ title: 'x' }); s1.storageKey = 'ctxterms_yt_a'; saveSessionTermsSoon(s1)");
    await new Promise(r => setTimeout(r, 40));
    assert.equal(writes().length, 0);
    E.run("s1.importTerms([['gradient descent', 'hạ gradient', 2]]); saveSessionTermsSoon(s1)");
    await new Promise(r => setTimeout(r, 40));
    assert.equal(writes().length, 1);
    assert.equal(writes()[0].ctxterms_yt_a.terms[0][0], "gradient descent");
    assert.equal(writes()[0].ctxterms_yt_a.v, 2, "stamped, or the next video would not read it");
});

// 2.3.1: a window of sound captions only ("[Music]" between songs) is translated from a list: in the
// user's cache 50 of 531 groups were nothing else, each one a paid request
test("sound captions: a window of notes only sends no request", async () => {
    const sent = [];
    const E = pageEnv({ files: ["vi-quality.js"], sendMessage: (m, cb) => { sent.push(m); cb && cb({ ok: true, translations: ["x", "y"] }); } });
    const r = await E.run("requestUnit({ sentences: ['[Music]', '[Applause] [Music]'], context: {} })");
    assert.equal(r.engine, "sound-notes");
    assert.deepEqual([...r.translations], ["[Âm nhạc]", "[Vỗ tay] [Âm nhạc]"]);
    assert.equal(sent.length, 0);
    await E.run("requestUnit({ sentences: ['[Music]', 'Hello there'], context: {} })");
    assert.equal(sent.length, 1, "speech in the window: asked as before");
});
