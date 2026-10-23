// youtube.js caption loading: the body parser (json3, display-form rows, XML), the bridge
// handshakes, and the direct-fetch fallback when the bridge never answers.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// Just enough XML for the two caption layouts: <p t d>text</p> (srv3) and <text start dur>text</text>
class FakeDOMParser {
    parseFromString(src) {
        const root = (src.match(/^\s*<(\w+)/) || [])[1] || "";
        const nodes = [];
        for (const m of src.matchAll(/<(p|text)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
            const attrs = Object.fromEntries([...m[2].matchAll(/(\w+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
            nodes.push({ getAttribute: k => (k in attrs ? attrs[k] : null), textContent: m[3].replace(/<[^>]+>/g, "") });
        }
        return { documentElement: root ? { nodeName: root } : null, querySelectorAll: () => nodes };
    }
}

function env(bridge) {
    const noop = () => {};
    const listeners = [], posted = [], fetched = [];
    const S = {
        console: { log: noop, warn: noop, error: noop }, setTimeout, clearTimeout, setInterval, clearInterval, URL,
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number, TextEncoder, crypto: globalThis.crypto,
        DOMParser: FakeDOMParser,
        location: { href: "https://www.youtube.com/watch?v=abc123", hostname: "www.youtube.com", pathname: "/watch" },
        document: { readyState: "loading", title: "t", body: {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], getElementsByTagName: () => [], createElement: () => ({ style: {}, appendChild: noop, addEventListener: noop }), head: { appendChild: noop }, documentElement: { appendChild: noop }, addEventListener: noop },
        addEventListener: (t, f) => { if (t === "message") listeners.push(f); },
        removeEventListener: (t, f) => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); },
        postMessage: data => {
            posted.push(data);
            const reply = bridge && bridge(data);
            if (reply) setImmediate(() => listeners.slice().forEach(f => f({ source: S.__self, data: reply })));
        },
        MutationObserver: class { observe() {} disconnect() {} }, alert: noop, requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
        fetch: async url => { fetched.push(String(url)); return S.__fetch(String(url)); },
        chrome: {
            storage: { sync: { get: async d => ({ ...(Array.isArray(d) ? {} : d) }), set: async () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener: noop } },
            runtime: { lastError: null, onMessage: { addListener: noop }, getURL: p => p, sendMessage: (m, cb) => { posted.push({ runtime: m }); cb && cb({ ok: true }); } }
        }
    };
    S.window = S; S.globalThis = S;
    vm.createContext(S);
    S.__self = vm.runInContext("globalThis", S);
    for (const f of ["glossary.js", "cst-cache.js", "cost-policy.js", "lang-detect.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js", "youtube.js"]) vm.runInContext(read(f), S);
    const call = (code) => vm.runInContext(code, S);
    return { S, call, posted, fetched };
}
// cross-realm results: copy to plain values before deepEqual
const plain = x => JSON.parse(JSON.stringify(x));

const json3 = events => JSON.stringify({ events });
const seg = (utf8, tOffsetMs) => (tOffsetMs === undefined ? { utf8 } : { utf8, tOffsetMs });

test("json3 body: text is joined and squeezed, empty events dropped, overlaps cut, word times kept", () => {
    const E = env();
    E.S.__raw = json3([
        { tStartMs: 0, dDurationMs: 3000, segs: [seg("hello"), seg(" there  world", 400)] },
        { tStartMs: 2000, dDurationMs: 2000, segs: [seg("\n")] },
        { tStartMs: 2500, dDurationMs: 1500, segs: [seg("second   line")] },
        { tStartMs: 9000, dDurationMs: 500 },
        { tStartMs: 9500, dDurationMs: 500, segs: [seg("tail")] }
    ]);
    const cues = plain(E.call("ytDocNoiDungPhuDe(__raw)"));
    assert.deepEqual(cues.map(c => c.text), ["hello there world", "second line", "tail"]);
    assert.equal(cues[0].end, 2.5, "the first cue stops where the second starts");
    assert.deepEqual(cues[0].words, [{ text: "hello", t: 0 }, { text: "there  world", t: 0.4 }]);
    assert.equal(cues[1].words, undefined, "one segment gives no word list");
    assert.equal(E.call("ytDocNoiDungPhuDe('')").length, 0);
});

test("display-form block: rows share the block's time by length, up to where the next block starts", () => {
    const E = env();
    E.S.__raw = json3([
        { tStartMs: 0, dDurationMs: 10000, segs: [seg("aaaa\nbbbbbbbb")] },
        { tStartMs: 6000, dDurationMs: 2000, segs: [seg("next")] }
    ]);
    const cues = plain(E.call("ytDocNoiDungPhuDe(__raw)"));
    assert.deepEqual(cues.map(c => c.text), ["aaaa", "bbbbbbbb", "next"]);
    assert.equal(cues[0].start, 0);
    assert.equal(cues[0].end, 2, "4 of 12 characters of the 6 s before the next block");
    assert.equal(cues[1].start, 2);
    assert.ok(cues[1].end <= 6 + 1e-9, "no overlap with the next block");
    // an uploaded two-row cue that ends before the next one is kept whole
    E.S.__raw2 = json3([
        { tStartMs: 0, dDurationMs: 2000, segs: [seg("one\ntwo")] },
        { tStartMs: 5000, dDurationMs: 1000, segs: [seg("later")] }
    ]);
    assert.deepEqual(plain(E.call("ytDocNoiDungPhuDe(__raw2)")).map(c => c.text), ["one two", "later"]);
});

test("XML bodies: srv3 <p t d>, srv1 <text start dur>, a blank track is flagged, an error page is not", () => {
    const E = env();
    E.S.__a = '<timedtext><body><p t="1500" d="2000">Hello <s>there</s></p><p t="4000" d="1000"> </p></body></timedtext>';
    const a = plain(E.call("ytDocNoiDungPhuDe(__a)"));
    assert.deepEqual(a, [{ start: 1.5, end: 3.5, text: "Hello there" }]);
    E.S.__b = '<transcript><text start="2.5" dur="1.5">Old format</text></transcript>';
    assert.deepEqual(plain(E.call("ytDocNoiDungPhuDe(__b)")), [{ start: 2.5, end: 4, text: "Old format" }]);
    E.S.__blank = '<timedtext><body><p t="0" d="1000"> </p></body></timedtext>';
    const blank = E.call("ytDocNoiDungPhuDe(__blank)");
    assert.equal(blank.length, 0);
    assert.equal(blank.blank, true, "events but no words: the track itself is blank");
    E.S.__err = "<html><body><p>Error 429</p></body></html>";
    const err = E.call("ytDocNoiDungPhuDe(__err)");
    assert.equal(err.blank, undefined);
    E.S.__json = json3([{ tStartMs: 0, dDurationMs: 1000, segs: [seg(" ")] }]);
    assert.equal(E.call("ytDocNoiDungPhuDe(__json)").blank, true);
});

test("bridge handshake: track list and body come back by request id; an error reply rejects", async () => {
    const bridge = d => {
        if (d.cstType === "YEU_CAU_PHU_DE") return { cstType: "TRA_LOI_PHU_DE", requestId: d.requestId, tracks: [{ languageCode: "en" }], videoId: "abc123" };
        if (d.cstType === "YEU_CAU_NOI_DUNG_PHU_DE") {
            if (d.baseUrl.includes("bad")) return { cstType: "TRA_LOI_NOI_DUNG_PHU_DE", requestId: d.requestId, error: "Máy chủ phụ đề trả về mã 503" };
            return { cstType: "TRA_LOI_NOI_DUNG_PHU_DE", requestId: d.requestId, text: json3([{ tStartMs: 0, dDurationMs: 1000, segs: [seg("via bridge")] }]), via: "pot" };
        }
    };
    const E = env(bridge);
    const list = plain(await E.call("ytHoiDanhSachPhuDe(2000)"));
    assert.equal(list.videoId, "abc123");
    assert.ok(E.posted.some(p => p.runtime && p.runtime.action === "ensureYtBridge"), "the service worker is asked to inject the bridge once");
    const cues = plain(await E.call('ytTaiBanChepLoi("https://x/api/timedtext?v=abc123&lang=en")'));
    assert.equal(cues[0].text, "via bridge");
    await assert.rejects(E.call('ytTaiBanChepLoi("https://x/bad")'), /503/);
    const errBridge = env(d => d.cstType === "YEU_CAU_PHU_DE" ? { cstType: "TRA_LOI_PHU_DE", requestId: d.requestId, error: "Chua doc duoc du lieu trinh phat" } : undefined);
    await assert.rejects(errBridge.call("ytHoiDanhSachPhuDe(2000)"), /Chua doc duoc/);
});

test("no bridge answer: the track list times out; the body falls back to a direct json3 fetch", async () => {
    const E = env(() => undefined);
    await assert.rejects(E.call("ytHoiDanhSachPhuDe(60)"), /chưa phản hồi/);
    E.S.__fetch = async url => ({ ok: true, status: 200, text: async () => json3([{ tStartMs: 0, dDurationMs: 1000, segs: [seg("direct")] }]) });
    const orig = E.call("ytHoiNoiDungPhuDe");
    E.S.ytHoiNoiDungPhuDe = (u) => orig(u, 40);
    const cues = plain(await E.call('ytTaiBanChepLoi("https://x/api/timedtext?v=abc123&lang=en")'));
    assert.equal(cues[0].text, "direct");
    assert.ok(E.fetched[0].endsWith("&fmt=json3"), "json3 asked for");
    await E.call('ytTaiBanChepLoi("https://x/api/timedtext?v=abc123&fmt=srv3")');
    assert.ok(E.fetched[1].endsWith("fmt=srv3"), "an explicit format is kept");
    E.S.__fetch = async () => ({ ok: false, status: 500, text: async () => "" });
    await assert.rejects(E.call('ytTaiBanChepLoi("https://x/api/timedtext?v=abc123")'), /500/);
});

test("empty body from the bridge gives no cues (and does not throw)", async () => {
    const E = env(d => d.cstType === "YEU_CAU_NOI_DUNG_PHU_DE" ? { cstType: "TRA_LOI_NOI_DUNG_PHU_DE", requestId: d.requestId, text: "", via: "none", reason: "no-pot" } : undefined);
    const cues = await E.call('ytTaiBanChepLoi("https://x/api/timedtext?v=abc123")');
    assert.equal(cues.length, 0);
});

// ---------- drawing the subtitle ----------
function dom(E) {
    const node = (tag) => ({
        tag, style: {}, className: "", children: [], dataset: {}, parentElement: null, clientWidth: 0,
        appendChild(c) { c.parentElement = this; this.children.push(c); return c; },
        replaceChildren(...c) { this.children = []; c.forEach(x => this.appendChild(x)); },
        get text() { return this.children.map(c => (c.tag === "#text" ? c.value : c.tag === "br" ? "\n" : c.text)).join(""); }
    });
    E.S.document.createElement = tag => node(tag);
    E.S.document.createTextNode = value => ({ tag: "#text", value });
    return node;
}

test("ytTaoKhoiChu: lines become text nodes joined by <br>", () => {
    const E = env(); dom(E);
    const d = E.call('ytTaoKhoiChu(["một", "hai", "ba"], "cst-vi", "color:red;")');
    assert.equal(d.className, "cst-vi");
    assert.equal(d.style.cssText, "color:red;");
    assert.equal(d.text, "một\nhai\nba");
    assert.equal(E.call('ytTaoKhoiChu(["x"], "c")').style.cssText, undefined);
});

test("ytVePhuDe: Vietnamese only, dual with the source below, dual with the source first, source alone, nothing", () => {
    const E = env(); const node = dom(E);
    const draw = (setup, cue, en, opts) => {
        const overlay = node("div");
        E.S.__o = overlay;
        E.S.__cue = cue; E.S.__en = en; E.S.__opts = opts || {};
        E.call(`${setup}; ytVePhuDe(__o, __cue, __en, __opts)`);
        return overlay;
    };
    const cue = { text: "Xin chào các bạn", lines: ["Xin chào", "các bạn"] };
    let o = draw("state.dualMode = false; ytSubStyle.mode = 'single'", cue, "Hello everyone");
    assert.equal(o.children.length, 1, "single mode: no source line");
    assert.equal(o.children[0].className, "cst-vi");
    assert.equal(o.children[0].text, "Xin chào\ncác bạn");
    assert.equal(o.style.opacity, "1");
    o = draw("state.dualMode = true; state.originalFirst = false", cue, "Hello everyone");
    assert.deepEqual(o.children.map(c => c.className), ["cst-vi", "cst-orig"]);
    assert.match(o.children[1].style.cssText, /font-size:0\.80em/);
    o = draw("state.dualMode = true; state.originalFirst = true", cue, "Hello everyone");
    assert.deepEqual(o.children.map(c => c.className), ["cst-orig", "cst-vi"], "the source goes above");
    assert.equal(o.children[0].style.marginTop, "0");
    o = draw("state.dualMode = false", null, "Only source");
    assert.deepEqual(o.children.map(c => c.className), ["cst-orig"], "a line with no translation yet shows the source");
    assert.match(o.children[0].style.cssText, /opacity:0\.85/);
    o = draw("state.dualMode = false", null, "");
    assert.equal(o.children.length, 0);
    assert.equal(o.style.opacity, "0", "nothing to show hides the overlay");
    o = draw("state.dualMode = false", { text: "Một dòng" }, "", { dim: true });
    assert.equal(o.children[0].text, "Một dòng", "a cue with no line list falls back to its text");
    assert.equal(o.style.opacity, "0.85", "dim");
});

test("ytVuaKhung: leaves lines alone with no measuring, and reserves room for the open panel or menu", () => {
    const E = env(); const node = dom(E);
    const box = node("div"); box.clientWidth = 1000;
    const overlay = node("div"); box.appendChild(overlay);
    E.S.__o = overlay;
    assert.equal(E.call("(yt.panelOpen = false, yt.menuOpen = false, ytSideRoom())"), 0);
    assert.equal(E.call("(yt.panelOpen = true, ytSideRoom())"), 404);
    assert.equal(E.call("(yt.menuOpen = true, ytSideRoom())"), 404);
    assert.equal(E.call("(yt.panelOpen = false, ytSideRoom())"), 352);
    let seen;
    E.S.CST_STYLE.fitLines = (lines, text, o, opts) => { seen = opts; return ["fit"]; };
    assert.deepEqual(plain(E.call('ytVuaKhung(["a"], "a", __o, 1)')), ["fit"]);
    assert.equal(seen.widthRatio, (1000 - 352 - 48) / 1000);
    E.call("yt.menuOpen = false");
    E.call('ytVuaKhung(["a"], "a", __o, 0.8)');
    assert.equal(seen.widthRatio, 0.92);
    assert.equal(seen.scale, 0.8);
    E.S.CST_STYLE.fitLines = undefined;
    assert.deepEqual(plain(E.call('ytVuaKhung(["a"], "a", __o, 1)')), ["a"], "no fitLines: the lines pass through");
});

test("control bar height and the player observers", () => {
    const E = env(); const node = dom(E);
    const cls = new Set();
    const bar = { getBoundingClientRect: () => ({ height: 48, top: 700 }) };
    const player = { classList: { contains: c => cls.has(c) }, querySelector: s => (s === ".ytp-chrome-bottom" ? bar : null), getBoundingClientRect: () => ({ height: 400, bottom: 748 }) };
    E.S.__p = player;
    E.S.getComputedStyle = () => ({ display: "block", visibility: "visible" });
    assert.equal(E.call("ytChieuCaoThanhDieuKhien(__p)"), 48);
    cls.add("ytp-autohide");
    assert.equal(E.call("ytChieuCaoThanhDieuKhien(__p)"), 0, "hidden by the autohide class");
    cls.clear();
    E.S.getComputedStyle = () => ({ display: "none", visibility: "visible" });
    assert.equal(E.call("ytChieuCaoThanhDieuKhien(__p)"), 0);
    E.S.getComputedStyle = () => ({ display: "block", visibility: "visible" });
    bar.getBoundingClientRect = () => ({ height: 48, top: 760 });
    assert.equal(E.call("ytChieuCaoThanhDieuKhien(__p)"), 0, "a bar below the player");
    bar.getBoundingClientRect = () => ({ height: 300, top: 400 });
    assert.equal(E.call("ytChieuCaoThanhDieuKhien(__p)"), 160, "capped at 40% of the player");
    E.S.querySelector = undefined;
    E.call("(() => { const p = { classList: { contains: () => false }, querySelector: () => null }; return ytChieuCaoThanhDieuKhien(p); })()");

    // observers: attached once per player element, re-attached when YouTube swaps the element
    const made = [];
    E.S.MutationObserver = class { constructor(cb) { this.cb = cb; this.disconnected = 0; made.push(this); } observe() { this.observed = true; } disconnect() { this.disconnected++; } };
    E.S.ResizeObserver = class { constructor(cb) { this.cb = cb; this.disconnected = 0; made.push(this); } observe() { this.observed = true; } disconnect() { this.disconnected++; } };
    const overlay = node("div"); const calls = [];
    const mkPlayer = () => ({ clientWidth: 800, querySelector: () => overlay, classList: { contains: () => false }, getBoundingClientRect: () => ({ height: 400, bottom: 400, width: 800 }) });
    E.S.__p1 = mkPlayer(); E.S.__p2 = mkPlayer();
    E.S.ytCapNhatKichThuoc = () => calls.push("size");
    E.S.ytCapNhatViTri = () => calls.push("pos");
    E.call("ytTheoDoiTrinhPhat(__p1)");
    E.call("ytTheoDoiTrinhPhat(__p1)");
    assert.equal(made.length, 2, "one resize and one class observer for the same player");
    made[0].cb(); made[1].cb();
    assert.ok(calls.includes("size") && calls.includes("pos"));
    E.call("ytTheoDoiTrinhPhat(__p2)");
    assert.equal(made.length, 4);
    assert.equal(made[0].disconnected + made[1].disconnected, 2, "the old observers were released");
});

test("ytCapNhatKichThuoc: font size follows the player width and clears the render key", () => {
    const E = env(); const node = dom(E);
    const overlay = node("div");
    E.S.__o = overlay; E.S.__p = { clientWidth: 1000 };
    E.call('yt.renderKey = "x"; ytCapNhatKichThuoc(__p, __o)');
    assert.match(overlay.style.fontSize, /^\d+(\.\d)?px$/);
    assert.equal(E.call("yt.renderKey"), "");
    E.call("ytCapNhatKichThuoc(null, __o)");
    const small = parseFloat(overlay.style.fontSize);
    E.S.__p.clientWidth = 0;
    E.call("ytCapNhatKichThuoc(__p, __o)");
    assert.ok(parseFloat(overlay.style.fontSize) > 0 && parseFloat(overlay.style.fontSize) <= small, "no width falls back to 640");
});
