// content.js: the Coursera / generic-page subtitle overlay (style, painting, cue lookup, render loop).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const plain = x => JSON.parse(JSON.stringify(x));

function env(extra = []) {
    const noop = () => {};
    const node = tag => ({
        tag, style: {}, className: "", children: [], dataset: {}, parentElement: null, clientWidth: 0, clientHeight: 0, isConnected: true,
        appendChild(c) { c.parentElement = this; this.children.push(c); return c; },
        replaceChildren(...c) { this.children = []; c.forEach(x => this.appendChild(x)); },
        querySelector() { return null; }, querySelectorAll() { return []; }, textContent: ""
    });
    const S = {
        console: { log: noop, warn: noop, error: noop }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop, URL,
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number, TextEncoder, crypto: globalThis.crypto,
        location: { href: "https://www.coursera.org/learn/x/lecture/y", hostname: "www.coursera.org", pathname: "/learn/x/lecture/y" },
        document: { readyState: "loading", title: "t", body: node("body"), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], getElementsByTagName: () => [], createElement: node, head: { appendChild: noop }, documentElement: { appendChild: noop }, addEventListener: noop, fonts: null },
        addEventListener: noop, postMessage: noop, MutationObserver: class { observe() {} disconnect() {} }, alert: noop,
        requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
        getComputedStyle: () => ({ position: "relative" }),
        chrome: {
            storage: { sync: { get: async d => ({ ...(Array.isArray(d) ? {} : d) }), set: async () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener: noop } },
            runtime: { lastError: null, onMessage: { addListener: noop }, getURL: p => p, sendMessage: (m, cb) => cb && cb({ ok: true }) }
        }
    };
    S.window = S; S.globalThis = S;
    vm.createContext(S);
    for (const f of ["glossary.js", "cst-cache.js", "cost-policy.js", "lang-detect.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js", ...extra]) vm.runInContext(read(f), S);
    return { S, node, call: code => vm.runInContext(code, S) };
}

const CUES = [{ start: 0, end: 2, text: "a" }, { start: 2, end: 4, text: "b" }, { start: 6, end: 8, text: "c" }];

test("csFindCue: binary search finds the cue playing, null in a gap, before the first or after the last", () => {
    const E = env();
    E.S.__c = CUES;
    for (const [t, want] of [[0, "a"], [1.99, "a"], [2, "b"], [3.5, "b"], [4, null], [5, null], [6, "c"], [7.9, "c"], [8, null], [-1, null]]) {
        assert.equal(E.call(`(csFindCue(__c, ${t}) || {}).text || null`), want, `t=${t}`);
    }
    assert.equal(E.call("csFindCue([], 1)"), null);
});

test("csApplyOverlayStyle: font, colours, bottom margin above the bar, top position, pinned bottom, side room", () => {
    const E = env();
    const box = E.node("div"); box.clientWidth = 1000; box.clientHeight = 500;
    const ov = E.node("div");
    E.S.__box = box; E.S.__ov = ov;
    E.call("csPlayerBox = () => __box; csControlGroup = () => ({ height: 50 })");
    E.call("state.subStyle = { position: 'bottom', offset: 2, fontColor: '#ffeeaa', bgColor: '#000000', bgOpacity: 50, borderRadius: 8 }; cs.panelOpen = false; cs.menuOpen = false");
    E.call("csApplyOverlayStyle(__ov)");
    assert.equal(ov.style.color, "#ffeeaa");
    assert.equal(ov.style.borderRadius, "8px");
    assert.equal(ov.style.backgroundColor, "rgba(0, 0, 0, 0.50)");
    assert.equal(ov.style.top, "auto");
    assert.equal(ov.style.bottom, "66px", "the control bar (50 + 16) is higher than the 2% margin");
    assert.equal(ov.style.maxWidth, "92%");
    assert.equal(ov.style.transform, "translateX(-50%)");
    assert.match(ov.style.fontSize, /px$/);
    assert.equal(E.call("cs.renderKey"), "");
    assert.equal(E.call("cs.styleKey").startsWith("1000x500|"), true);

    E.call("state.subStyle = { position: 'top', offset: 10 }");
    E.call("csApplyOverlayStyle(__ov)");
    assert.equal(ov.style.top, "56px", "10% of 500 plus 6");
    assert.equal(ov.style.bottom, "auto");

    E.call("state.subStyle = { position: 'bottom', offset: 0, pinBottom: true }; cs.panelOpen = true");
    E.call("csApplyOverlayStyle(__ov)");
    assert.equal(ov.style.bottom, "6px", "pinned: no bar allowance");
    assert.match(ov.style.maxWidth, /calc\(100% - 452px\)/);
    assert.match(ov.style.transform, /-50% - 202px/);

    E.call("csControlGroup = () => null; state.subStyle = { position: 'bottom', offset: 0 }; cs.panelOpen = false");
    E.call("csApplyOverlayStyle(__ov)");
    assert.equal(ov.style.bottom, "64px", "no bar found: the default allowance");
    assert.doesNotThrow(() => E.call("csApplyOverlayStyle(null)"));
});

test("csPaint: Vietnamese alone, dual below, dual with the source first, source alone, nothing", () => {
    const E = env();
    const box = E.node("div"); box.clientWidth = 1000;
    E.S.__box = box;
    E.call("csPlayerBox = () => __box; cs.panelOpen = false; cs.menuOpen = false");
    const paint = (setup, vi, en) => {
        const ov = E.node("div");
        E.S.__ov = ov; E.S.__vi = vi; E.S.__en = en;
        E.call(`${setup}; csPaint(__ov, __vi, __en)`);
        return ov;
    };
    const vi = { text: "Xin chào các bạn", lines: ["Xin chào", "các bạn"] };
    let ov = paint("state.dualMode = false", vi, "Hello everyone");
    assert.equal(ov.children.length, 1);
    assert.equal(ov.children[0].textContent, "Xin chào\ncác bạn");
    assert.equal(ov.style.opacity, "1");
    ov = paint("state.dualMode = true; state.originalFirst = false", vi, "Hello everyone");
    assert.equal(ov.children.length, 2);
    assert.match(ov.children[1].style.cssText, /font-size:0\.80em/);
    const mainStyle = ov.children[0].style.cssText;
    const secondaryStyle = ov.children[1].style.cssText;
    ov = paint("state.dualMode = true; state.originalFirst = true", vi, "Hello everyone");
    assert.equal(ov.children[0].textContent, "Hello everyone", "the source goes first");
    assert.equal(ov.children[0].style.marginTop, "0");
    assert.equal(ov.children[0].style.cssText.replace("margin-top:0.12em;", ""), mainStyle, "English takes the complete primary style");
    assert.equal(ov.children[1].style.cssText, secondaryStyle.replace("margin-top:0.12em;", ""), "Vietnamese takes the complete secondary style");
    // English on top: English is the full-size line, Vietnamese drops to origScale
    assert.match(ov.children[1].style.cssText, /font-size:0\.80em/, "Vietnamese is the small line");
    assert.match(ov.children[0].style.cssText, /font-size:1\.00em/, "English is the full-size line");
    ov = paint("state.dualMode = false; state.originalFirst = true", vi, "Hello everyone");
    assert.equal(ov.children.length, 1);
    assert.match(String(ov.children[0].style.cssText || ""), /font-size:1\.00em/, "single view: Vietnamese keeps the base size");
    ov = paint("state.dualMode = false", null, "Only source");
    assert.equal(ov.children.length, 1);
    assert.match(ov.children[0].style.cssText, /opacity:0\.85/);
    ov = paint("state.dualMode = false", null, "");
    assert.equal(ov.children.length, 0);
    assert.equal(ov.style.opacity, "0");
    ov = paint("state.dualMode = false", { text: "Một dòng" }, "");
    assert.equal(ov.children[0].textContent, "Một dòng", "no line list: the text");
    // a line wider than the box is re-cut by the segmenter
    box.clientWidth = 200;
    ov = paint("state.dualMode = false", { text: "một hai ba bốn năm sáu bảy tám chín mười mười một mười hai", lines: ["một hai ba bốn năm sáu bảy tám chín mười mười một mười hai"] }, "");
    assert.ok(ov.children[0].textContent.includes("\n"), "a too-wide line is broken");
});

test("csRender: paints the cue playing once, repaints on change, hides under native fullscreen, restyles on resize", () => {
    const E = env();
    const box = E.node("div"); box.clientWidth = 800; box.clientHeight = 450;
    const ov = E.node("div");
    const video = { currentTime: 1 };
    const track = { mode: "disabled" };
    Object.assign(E.S, { __box: box, __ov: ov, __v: video, __track: track });
    E.call(`csVideo = () => __v; csPlayerBox = () => __box; csControlGroup = () => null;
        document.querySelector = s => (s === CS_OVERLAY ? __ov : null);
        state.activeTrack = { track: __track }; state.dualMode = false; state.subStyle = {};
        cs.viCues = [{ start: 0, end: 2, text: "Một", lines: ["Một"] }, { start: 2, end: 4, text: "Hai", lines: ["Hai"] }];
        cs.origCues = [{ start: 0, end: 2, text: "One" }]; cs.renderKey = ""; cs.styleKey = ""`);
    E.call("csRender()");
    assert.equal(ov.children[0].textContent, "Một");
    assert.equal(track.mode, "hidden", "the browser's own renderer is kept off");
    const first = ov.children[0];
    E.call("csRender()");
    assert.equal(ov.children[0], first, "same cue: no repaint");
    video.currentTime = 3;
    E.call("csRender()");
    assert.equal(ov.children[0].textContent, "Hai");
    video.currentTime = 10;
    E.call("csRender()");
    assert.equal(ov.children.length, 0, "no cue playing: the box empties");
    // native fullscreen: the overlay steps aside and the track shows
    E.S.document.fullscreenElement = video;
    E.call("cs.renderKey = ''");
    E.call("csRender()");
    assert.equal(ov.style.visibility, "hidden");
    assert.equal(track.mode, "showing");
    E.S.document.fullscreenElement = null;
    // the player changed size: the style is applied again
    E.call("cs.styleKey = '640x360|{}'");
    E.call("csRender()");
    assert.ok(E.call("cs.styleKey").startsWith("800x450|"));
    // csRestyle applies at once and resets the key
    E.call("cs.renderKey = 'x'; csRestyle()");
    assert.equal(E.call("cs.renderKey"), "");
    // no video or no overlay: nothing happens
    E.call("csVideo = () => null");
    assert.doesNotThrow(() => E.call("csRender()"));
});

// ---------- shortcuts ----------
function shortcutEnv(extra) {
    const E = env(extra);
    const toasts = [], log = [];
    Object.assign(E.S, { __toasts: toasts, __log: log });
    E.call(`cstToast = (m, o) => __toasts.push(m);
        enableTranslation = async () => { __log.push("enable"); state.active = true; };
        disableTranslation = () => { __log.push("disable"); state.active = false; };
        csOpenMenu = () => __log.push("menu");`);
    return { E, toasts, log };
}

test("shortcut actions on a generic or Coursera page: subtitles, voice, quick menu", async () => {
    const { E, toasts, log } = shortcutEnv();
    assert.equal(plain(await E.call('xuLyPhimTat("bat-tat-phu-de", "youtube")')).ok, false, "YouTube code is not loaded");
    E.call("state.active = false");
    let r = plain(await E.call('xuLyPhimTat("bat-tat-phu-de", "coursera")'));
    assert.deepEqual([r.ok, log.at(-1), toasts.at(-1)], [true, "enable", "Đang dịch phụ đề sang tiếng Việt…"]);
    r = plain(await E.call('xuLyPhimTat("bat-tat-phu-de", "coursera")'));
    assert.deepEqual([r.ok, r.on, log.at(-1), toasts.at(-1)], [true, false, "disable", "Đã tắt phụ đề tiếng Việt."]);

    // the quick menu needs the button
    r = plain(await E.call('xuLyPhimTat("mo-bang-dieu-khien", "coursera")'));
    assert.equal(r.ok, false);
    assert.match(toasts.at(-1), /chưa có bảng điều khiển/);
    E.S.document.querySelector = () => ({});
    r = plain(await E.call('xuLyPhimTat("mo-bang-dieu-khien", "coursera")'));
    assert.deepEqual([r.ok, log.at(-1)], [true, "menu"]);

    // the voice: unavailable, on -> off, off -> on
    E.call("window.CST_DUB = undefined");
    r = plain(await E.call('xuLyPhimTat("bat-tat-long-tieng", "coursera")'));
    assert.equal(r.ok, false);
    assert.match(toasts.at(-1), /chưa bật được lồng tiếng/);
    E.call("window.CST_DUB = { dub: { enabled: true }, stop: () => __log.push('stop') }; rememberDub = v => __log.push('remember:' + v)");
    r = plain(await E.call('xuLyPhimTat("bat-tat-long-tieng", "coursera")'));
    assert.deepEqual([r.ok, r.on, log.slice(-2), toasts.at(-1)], [true, false, ["stop", "remember:false"], "Đã tắt lồng tiếng Việt."]);
    E.call("window.CST_DUB = { dub: { enabled: false } }; csVideo = () => null; toggleDubbing = async () => { window.CST_DUB.dub.enabled = true; }");
    r = plain(await E.call('xuLyPhimTat("bat-tat-long-tieng", "coursera")'));
    assert.deepEqual([r.ok, toasts.at(-1)], [true, "Đã bật lồng tiếng Việt."]);
    E.call("toggleDubbing = async () => {}; window.CST_DUB.dub.enabled = false");
    r = plain(await E.call('xuLyPhimTat("bat-tat-long-tieng", "coursera")'));
    assert.deepEqual([r.ok, toasts.at(-1)], [false, "Chưa bật được lồng tiếng trên trang này."]);
    assert.equal(plain(await E.call('xuLyPhimTat("unknown", "coursera")')).ok, false);
});

test("shortcut actions on YouTube: need a video, toggle subtitles and voice, open the menu", async () => {
    const { E, toasts, log } = shortcutEnv(["youtube.js"]);
    E.call("yt.videoEl = null");
    let r = plain(await E.call('xuLyPhimTat("bat-tat-phu-de", "youtube")'));
    assert.deepEqual([r.ok, toasts.at(-1)], [false, "Hãy mở một video YouTube trước."]);
    E.call(`yt.videoEl = {}; yt.active = true; ytTatDich = () => __log.push("ytOff");
        ytBatDauDich = async () => true; ytDatTrangThaiNut = s => __log.push("btn:" + s); ytChuyenLongTieng = async () => { window.CST_DUB.dub.enabled = true; }`);
    r = plain(await E.call('xuLyPhimTat("bat-tat-phu-de", "youtube")'));
    assert.deepEqual([r.ok, r.on, log.at(-1)], [true, false, "ytOff"]);
    E.call("yt.active = false");
    r = plain(await E.call('xuLyPhimTat("bat-tat-phu-de", "youtube")'));
    assert.deepEqual([r.ok, log.at(-1), toasts.at(-1)], [true, "btn:on", "Đã bật phụ đề tiếng Việt."]);
    E.call("ytBatDauDich = async () => false");
    r = plain(await E.call('xuLyPhimTat("bat-tat-phu-de", "youtube")'));
    assert.deepEqual([r.ok, log.at(-1)], [false, "btn:idle"]);
    E.call("window.CST_DUB = { dub: { enabled: false } }");
    r = plain(await E.call('xuLyPhimTat("bat-tat-long-tieng", "youtube")'));
    assert.deepEqual([r.ok, toasts.at(-1)], [true, "Đã bật lồng tiếng Việt."]);
    assert.equal(plain(await E.call('xuLyPhimTat("other", "youtube")')).ok, false);

    // the menu: needs the player and the button, then opens
    E.call("ytMoMenuNhanh = (p, b) => __log.push('ytMenu')");
    r = plain(await E.call('xuLyPhimTat("mo-bang-dieu-khien", "youtube")'));
    assert.deepEqual([r.ok, toasts.at(-1)], [false, "Hãy mở một video YouTube trước."]);
    E.S.document.querySelector = () => ({});
    r = plain(await E.call('xuLyPhimTat("mo-bang-dieu-khien", "youtube")'));
    assert.deepEqual([r.ok, log.at(-1)], [true, "ytMenu"]);
});


test("native fullscreen cue roles swap color, size and weight with the order", () => {
    const E = env();
    let css = "";
    E.S.document.head.appendChild = el => { css = el.textContent; };
    E.call('state.subStyle = { fontWeight: 700, fontColor: "#ffe100", origColor: "#9ca3af", origScale: 80 }; state.dualMode = true; state.originalFirst = false; injectCueStyle()');
    const rule = name => css.match(new RegExp('video::cue\\(\\.' + name + '\\) \\{([^}]+)'))[1].trim();
    const main = rule("cst-vi"), secondary = rule("cst-orig");
    E.call('state.originalFirst = true; injectCueStyle()');
    assert.equal(rule("cst-orig"), main);
    assert.equal(rule("cst-vi"), secondary);
    assert.match(main, /font-weight: 700 !important/);
    assert.match(secondary, /font-size: 0\.80em !important/);
});
