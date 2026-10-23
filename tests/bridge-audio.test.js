// yt-bridge.js, the parts bridge.test.js leaves out: the track list answer, audio-track reading,
// switching back to the original audio, the audio-change notice, and the page-request hooks.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = fs.readFileSync(path.join(__dirname, "..", "yt-bridge.js"), "utf8");
// the player's audio-track objects keep the useful part under a minified property name
const audio = (id, isDefault, isAutoDubbed) => ({ Xa: { id, isDefault, isAutoDubbed }, other: 1 });
const RESPONSE = {
    videoDetails: { videoId: "vid9", title: "T", author: "A", channelId: "C", shortDescription: "d".repeat(500), keywords: Array.from({ length: 20 }, (_, i) => "k" + i) },
    captions: { playerCaptionsTracklistRenderer: {
        captionTracks: [
            { baseUrl: "https://x/a", languageCode: "en", kind: "asr", name: { simpleText: "English (auto)" } },
            { baseUrl: "https://x/b", languageCode: "vi", name: { runs: [{ text: "Vietnamese" }] } },
            { baseUrl: "https://x/c" }
        ],
        audioTracks: [{ audioTrackId: "ja.4" }, { audioTrackId: "en-US.10" }], defaultAudioTrackIndex: 0
    } }
};

function page(opts = {}) {
    const listeners = [], posted = [], intervals = [], hooks = {};
    const win = {
        location: { href: "https://www.youtube.com/watch?v=vid9" },
        setTimeout, clearTimeout, URL, Promise,
        setInterval: fn => { intervals.push(fn); return intervals.length; },
        addEventListener: (type, fn) => { if (type === "message") listeners.push(fn); },
        postMessage: data => { posted.push(data); },
        fetch: opts.fetch || (async () => ({ ok: true, status: 200, url: "", text: async () => "", clone() { return this; } })),
        ytInitialPlayerResponse: opts.global
    };
    function XHR() {}
    XHR.prototype.open = function () { hooks.opened = true; };
    win.XMLHttpRequest = XHR;
    win.document = { querySelector: () => opts.player || null };
    win.window = win;
    vm.createContext(win);
    win.self = vm.runInContext("globalThis", win);
    vm.runInContext(SRC, win);
    // deliver a message from the page to the bridge and return what it posted back
    const send = data => { const n = posted.length; listeners.forEach(fn => fn({ source: win.self, data })); return posted.slice(n); };
    return { win, send, posted, intervals, XHR };
}

const player = (over = {}) => ({
    getPlayerResponse: () => RESPONSE,
    getAvailableAudioTracks: () => [audio("en-US.10", false, true), audio("ja.4", true, false)],
    getAudioTrack: () => audio("ja.4", true, false),
    getVideoData: () => ({ video_id: "vid9" }),
    ...over
});

test("track list: names, trimmed description and keywords, audio info from the player", () => {
    const P = page({ player: player() });
    const [a] = P.send({ cstType: "YEU_CAU_PHU_DE", requestId: 1 });
    assert.equal(a.cstType, "TRA_LOI_PHU_DE");
    assert.deepEqual(a.tracks.map(t => [t.languageCode, t.kind, t.name]), [["en", "asr", "English (auto)"], ["vi", "", "Vietnamese"], ["", "", ""]]);
    assert.equal(a.videoId, "vid9");
    assert.equal(a.description.length, 400);
    assert.equal(a.keywords.length, 12);
    assert.deepEqual({ ...a.audio, tracks: a.audio.tracks.map(t => ({ ...t })) }, {
        original: "ja", current: "ja", currentDubbed: false,
        tracks: [{ lang: "en-US", isDefault: false, isAutoDubbed: true }, { lang: "ja", isDefault: true, isAutoDubbed: false }]
    });
});

test("track list: no player data is an error, no captions is an empty list, the global is the fallback", () => {
    assert.match(page().send({ cstType: "YEU_CAU_PHU_DE", requestId: 1 })[0].error, /Chua doc duoc/);
    const none = page({ player: { getPlayerResponse: () => ({ videoDetails: { videoId: "v" } }) } });
    const r = none.send({ cstType: "YEU_CAU_PHU_DE", requestId: 1 })[0];
    assert.deepEqual([[...r.tracks], r.videoId], [[], "v"]);
    const viaGlobal = page({ global: RESPONSE });
    assert.equal(viaGlobal.send({ cstType: "YEU_CAU_PHU_DE", requestId: 1 })[0].tracks.length, 3);
    const boom = page({ player: { getPlayerResponse: () => ({ captions: { playerCaptionsTracklistRenderer: { captionTracks: [null] } } }) } });
    assert.ok(boom.send({ cstType: "YEU_CAU_PHU_DE", requestId: 1 })[0].error, "a malformed track list is reported, not thrown");
});

test("original audio falls back to the response when the player exposes none", () => {
    const P = page({ player: { getPlayerResponse: () => RESPONSE, getAvailableAudioTracks: () => { throw new Error("api changed"); } } });
    const a = P.send({ cstType: "YEU_CAU_PHU_DE", requestId: 1 })[0].audio;
    assert.equal(a.original, "ja");
    assert.equal(a.current, "");
    assert.deepEqual([...a.tracks], []);
});

test("switch to the original audio: picks the default non-dub, falls back to any non-dub, reports failure", () => {
    const set = [];
    const P = page({ player: player({ setAudioTrack: t => { set.push(t); return true; } }) });
    assert.equal(P.send({ cstType: "CHON_AM_THANH_GOC", requestId: 7 })[0].ok, true);
    assert.equal(set[0].Xa.id, "ja.4");
    const anyOrig = page({ player: player({ getAvailableAudioTracks: () => [audio("en-US.10", false, true), audio("de.2", false, false)], setAudioTrack: t => { set.push(t); return true; } }) });
    assert.equal(anyOrig.send({ cstType: "CHON_AM_THANH_GOC", requestId: 8 })[0].ok, true);
    assert.equal(set[1].Xa.id, "de.2");
    const onlyDubs = page({ player: player({ getAvailableAudioTracks: () => [audio("en-US.10", false, true)], setAudioTrack: () => true }) });
    assert.equal(onlyDubs.send({ cstType: "CHON_AM_THANH_GOC", requestId: 9 })[0].ok, false);
    assert.equal(page({ player: {} }).send({ cstType: "CHON_AM_THANH_GOC", requestId: 1 })[0].ok, false);
    assert.equal(page().send({ cstType: "CHON_AM_THANH_GOC", requestId: 1 })[0].ok, false);
    const throws = page({ player: player({ getAvailableAudioTracks: () => { throw new Error("x"); }, setAudioTrack() {} }) });
    assert.equal(throws.send({ cstType: "CHON_AM_THANH_GOC", requestId: 1 })[0].ok, false);
});

test("audio change notice: silent first read, one message per change, none when unchanged", () => {
    let cur = audio("ja.4", true, false);
    const P = page({ player: player({ getAudioTrack: () => cur }) });
    const tick = P.intervals[0];
    tick();
    assert.equal(P.posted.length, 0, "the first read only records");
    tick();
    assert.equal(P.posted.length, 0, "unchanged");
    cur = audio("en-US.10", false, true);
    tick();
    assert.equal(P.posted.length, 1);
    assert.equal(P.posted[0].cstType, "AM_THANH_DOI");
    assert.equal(P.posted[0].videoId, "vid9");
    tick();
    assert.equal(P.posted.length, 1);
    cur = null;
    tick();
    assert.equal(P.posted.length, 1, "an unreadable track sends nothing");
    // no player yet: the tick does nothing and does not throw
    page().intervals[0]();
});

test("page hooks: a fetch the page makes lends its pot to our own request, and the page still gets its response", async () => {
    const BODY = '{"events":[{"tStartMs":0}]}';
    const PAGE_URL = "https://www.youtube.com/api/timedtext?v=v1&lang=en&pot=P1&c=WEB&fmt=json3";
    const asked = [];
    const P = page({
        fetch: async url => {
            asked.push(String(url));
            const text = /[?&]pot=P1/.test(String(url)) && asked.length > 1 ? BODY : "";
            return { ok: true, url: String(url), text: async () => text, clone() { return this; } };
        }
    });
    const r = await P.win.fetch(PAGE_URL);
    assert.equal(await r.text(), "", "the page gets what the server sent");
    await new Promise(res => setImmediate(res));
    P.send({ cstType: "YEU_CAU_NOI_DUNG_PHU_DE", requestId: 3, baseUrl: "https://www.youtube.com/api/timedtext?v=v1&lang=en" });
    await new Promise(res => setTimeout(res, 20));
    const reply = P.posted.find(m => m.cstType === "TRA_LOI_NOI_DUNG_PHU_DE");
    assert.equal(reply.via, "pot");
    assert.equal(reply.text, BODY);
    assert.ok(asked.at(-1).includes("pot=P1"), "our request carried the recorded pot");
    const x = new P.win.XMLHttpRequest();
    assert.doesNotThrow(() => x.open("GET", "https://www.youtube.com/watch"));
});

test("content request: a server error comes back as an error message", async () => {
    const P = page({ fetch: async () => ({ ok: false, status: 503, text: async () => "" }) });
    P.send({ cstType: "YEU_CAU_NOI_DUNG_PHU_DE", requestId: 5, baseUrl: "https://www.youtube.com/api/timedtext?v=v1&lang=en" });
    await new Promise(r => setTimeout(r, 20));
    const reply = P.posted.find(m => m.cstType === "TRA_LOI_NOI_DUNG_PHU_DE");
    assert.equal(reply.requestId, 5);
    assert.match(reply.error, /503/);
    assert.equal(P.send({ cstType: "YEU_CAU_NOI_DUNG_PHU_DE", requestId: 6, baseUrl: 5 }).length, 0, "a non-string url is ignored");
    assert.equal(P.send(null).length, 0);
    assert.equal(P.send({ cstType: "other" }).length, 0);
});
