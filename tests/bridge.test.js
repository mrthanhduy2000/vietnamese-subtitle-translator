// Cầu nối YouTube (yt-bridge.js, chạy trong trang): YouTube trả phụ đề RỖNG nếu thiếu mã "pot"
// của trình phát (đo thật 22/09/2026: 200, 0 byte). Cầu nối phải lấy được nội dung.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = fs.readFileSync(path.join(__dirname, "..", "yt-bridge.js"), "utf8");
const BODY = JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: "hello world" }] }] });
const BASE = "https://www.youtube.com/api/timedtext?v=vid1&caps=asr&exp=xpe&signature=abc&kind=asr&lang=en";

function page(opts = {}) {
    const listeners = [];
    const fetched = [];
    let inner = null;
    const win = {
        location: { href: "https://www.youtube.com/watch?v=vid1" },
        setTimeout, clearTimeout, URL, Promise,
        addEventListener: (type, fn) => { if (type === "message") listeners.push(fn); },
        // nguồn tin nhắn = chính "window" của trang (đối tượng toàn cục bên trong vm)
        postMessage: data => setImmediate(() => listeners.forEach(fn => fn({ source: inner, data }))),
        fetch: async url => {
            fetched.push(url);
            const withPot = /[?&]pot=/.test(url) && /[?&]c=WEB/.test(url);
            const text = opts.direct || withPot ? BODY : "";
            return { ok: true, status: 200, url, text: async () => text, clone() { return this; } };
        }
    };
    class XHR {
        constructor() { this.l = []; this.responseType = ""; }
        open(m, url) { this.url = url; }
        addEventListener(t, fn) { if (t === "load") this.l.push(fn); }
        send() {
            setTimeout(() => {
                this.responseURL = this.url;
                this.responseText = BODY;
                this.l.forEach(fn => fn());
            }, 30);
        }
    }
    win.XMLHttpRequest = XHR;
    let track = opts.track || {};
    const setOpts = [];
    const player = {
        getVideoData: () => ({ video_id: "vid1" }),
        getPlayerResponse: () => ({ videoDetails: { videoId: "vid1" }, captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: BASE, languageCode: "en", kind: "asr" }] } } }),
        loadModule() {}, unloadModule() {},
        getOption: (m, k) => (k === "track" ? track : [{ languageCode: "en", kind: "asr" }]),
        setOption: (m, k, v) => {
            setOpts.push(v);
            track = v;
            // Trình phát tự gửi yêu cầu phụ đề CÓ pot khi bật một track
            if (v && v.languageCode && !opts.playerSilent) {
                const x = new win.XMLHttpRequest();
                x.open("GET", `${BASE}&potc=1&pot=TOKEN&fmt=json3&c=WEB&cver=2.2026`);
                x.send();
            }
        }
    };
    win.document = { querySelector: s => (s === "#movie_player" ? player : null) };
    win.window = win;
    vm.createContext(win);
    inner = vm.runInContext("globalThis", win);
    vm.runInContext(SRC, win);
    const ask = baseUrl => new Promise(resolve => {
        const requestId = "r" + Math.random();
        listeners.push(ev => { if (ev.data && ev.data.cstType === "TRA_LOI_NOI_DUNG_PHU_DE" && ev.data.requestId === requestId) resolve(ev.data); });
        win.postMessage({ cstType: "YEU_CAU_NOI_DUNG_PHU_DE", requestId, baseUrl });
    });
    return { win, ask, fetched, setOpts, get track() { return track; } };
}

test("phụ đề rỗng (thiếu pot): cầu nối bật phụ đề trình phát trong giây lát, lấy nội dung, rồi TẮT lại như cũ", async () => {
    const P = page();
    const r = await P.ask(BASE);
    assert.equal(r.via, "player");
    assert.ok(r.text.includes("hello world"));
    assert.deepEqual({ ...P.track }, {}, "phụ đề của trình phát phải trở về trạng thái tắt");
    // Lần sau: lấy ngay từ bộ nhớ, không bật lại phụ đề
    const n = P.setOpts.length;
    const r2 = await P.ask(BASE);
    assert.ok(r2.text.includes("hello world"));
    assert.equal(P.setOpts.length, n);
});

test("người xem đang bật phụ đề khác: sau khi lấy xong trả lại đúng track đó", async () => {
    const P = page({ track: { languageCode: "vi", kind: "asr", vss_id: "a.vi" } });
    const r = await P.ask(BASE);
    assert.ok(r.text.includes("hello world"));
    assert.equal(P.track.languageCode, "vi");
});

test("video cũ không cần pot: tải thẳng, không đụng tới trình phát", async () => {
    const P = page({ direct: true });
    const r = await P.ask(BASE);
    assert.equal(r.via, "direct");
    assert.equal(P.setOpts.length, 0);
});

test("đã có pot của video (trình phát từng tải một track): tải track khác bằng pot đó", async () => {
    const P = page({ playerSilent: true });
    // trình phát đã tải phụ đề tiếng Anh thủ công trước đó (có pot)
    const x = new (vm.runInContext("XMLHttpRequest", P.win))();
    x.open("GET", "https://www.youtube.com/api/timedtext?v=vid1&lang=de&pot=TOKEN&c=WEB&cver=2.2026&fmt=json3");
    x.send();
    await new Promise(r => setTimeout(r, 60));
    const r = await P.ask(BASE);
    assert.equal(r.via, "pot");
    assert.ok(r.text.includes("hello world"));
    assert.ok(P.fetched.some(u => /pot=TOKEN/.test(u) && /lang=en/.test(u)));
});
