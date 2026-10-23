// Site adapters (site-adapters.js + site-ted.js): offline, against sample TED page data and HLS/WebVTT text.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load() {
    const ctx = { console, URL };
    ctx.window = ctx;
    vm.createContext(ctx);
    for (const f of ["site-adapters.js", "site-ted.js"]) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
    }
    return ctx.CST_SITES;
}

const STREAM = "https://hls.ted.com/talks/123/stream.m3u8";
const MASTER = [
    "#EXTM3U",
    '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Español",LANGUAGE="es",URI="subtitles/es/index.m3u8"',
    '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="subtitles/en/index.m3u8"',
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="x",LANGUAGE="en",URI="audio.m3u8"',
    "#EXT-X-STREAM-INF:BANDWIDTH=1000", "video.m3u8",
].join("\n");
const VTT = "WEBVTT\n\nNOTE x\n\n00:00:01.000 --> 00:00:03.500 align:start\nHello <i>there</i>.\n\n1\n00:03.600 --> 00:05.000\nSecond line\nwraps.\n\n00:06.000 --> 00:05.000\nbackwards\n";
const FILES = {
    [STREAM]: MASTER,
    "https://hls.ted.com/talks/123/subtitles/en/index.m3u8":
        "#EXTM3U\n#EXTINF:3.504,\nintro.vtt\n#EXT-X-DISCONTINUITY\n#EXTINF:60,\nseg0.vtt\n#EXT-X-ENDLIST",
    "https://hls.ted.com/talks/123/subtitles/en/intro.vtt": "WEBVTT\n",
    "https://hls.ted.com/talks/123/subtitles/en/seg0.vtt": VTT,
};
const fetchText = async u => { if (!(u in FILES)) throw new Error("404 " + u); return FILES[u]; };

const pageDoc = (stream = STREAM, key = "videoPlayerData") => ({
    getElementById: id => id === "__NEXT_DATA__" ? { textContent: JSON.stringify({ props: { pageProps: { videoData: {
        [key]: JSON.stringify({ resources: { hls: { stream } } }) } } } }) } : null,
});

function fakeVideo() {
    const tracks = [];
    return { tracks, textTracks: tracks, addTextTrack(kind, label, lang) {
        const t = { kind, label, language: lang, mode: "disabled", cues: [], addCue(c) { this.cues.push(c); } };
        tracks.push(t); return t;
    } };
}

test("parseVtt keeps timing and text, drops notes, tags and backwards cues", () => {
    const cues = load().parseVtt(VTT);
    assert.deepEqual(JSON.parse(JSON.stringify(cues)), [
        { start: 1, end: 3.5, text: "Hello there." },
        { start: 3.6, end: 5, text: "Second line\nwraps." },
    ]);
});

test("cue times after an HLS discontinuity are shifted by the time before it", async () => {
    const S = load();
    const tl = S.parseHlsTimeline(FILES["https://hls.ted.com/talks/123/subtitles/en/index.m3u8"], "https://hls.ted.com/talks/123/subtitles/en/index.m3u8");
    assert.deepEqual(Array.from(tl.map(t => t.offset)), [0, 3.504]);
    const cues = await S.loadHlsVtt("https://hls.ted.com/talks/123/subtitles/en/index.m3u8", fetchText);
    assert.equal(Math.round(cues[0].start * 1000), 4504);   // 1.0 s in the file, 3.504 s intro
});

test("TED stream is found in videoPlayerData, playerData or hlsUrl", async () => {
    const S = load(), loc = { hostname: "www.ted.com", pathname: "/talks/a" };
    for (const doc of [pageDoc(STREAM, "playerData"), { getElementById: () => ({ textContent: JSON.stringify({ props: { pageProps: { videoData: { hlsUrl: STREAM } } } }) }) }]) {
        assert.equal(await S.prepare(fakeVideo(), { loc, doc, fetchText, makeCue: () => ({}) }), 1);
    }
});

test("HLS master gives subtitle renditions with absolute URIs, audio is ignored", () => {
    const subs = load().parseHlsSubtitles(MASTER, STREAM);
    assert.deepEqual(Array.from(subs.map(s => [s.lang, s.uri])), [
        ["es", "https://hls.ted.com/talks/123/subtitles/es/index.m3u8"],
        ["en", "https://hls.ted.com/talks/123/subtitles/en/index.m3u8"],
    ]);
});

test("TED adapter matches talk pages only", () => {
    const S = load();
    assert.equal(S.find({ hostname: "www.ted.com", pathname: "/talks/x_y" }).id, "ted");
    assert.equal(S.find({ hostname: "www.ted.com", pathname: "/playlists/1" }), null);
    assert.equal(S.find({ hostname: "nottted.com", pathname: "/talks/x" }), null);
});

test("prepare adds only the English track to the video as a TextTrack", async () => {
    const S = load(), v = fakeVideo();
    const n = await S.prepare(v, { loc: { hostname: "www.ted.com", pathname: "/talks/a" }, doc: pageDoc(), fetchText, makeCue: (s, e, t) => ({ s, e, t }) });
    assert.equal(n, 1);
    assert.equal(v.tracks[0].language, "en");
    assert.equal(v.tracks[0].mode, "hidden");
    assert.ok(!/^cst/i.test(v.tracks[0].label), "pageTracks() skips labels starting with cst");
    assert.equal(v.tracks[0].cues[0].s, 4.504);
    assert.deepEqual(Array.from(v.tracks[0].cues.map(c => c.t)), ["Hello there.", "Second line\nwraps."]);
    // a second call does not add a duplicate track
    assert.equal(await S.prepare(v, { loc: { hostname: "www.ted.com", pathname: "/talks/a" }, doc: pageDoc(), fetchText, makeCue: () => ({}) }), 1);
    assert.equal(v.tracks.length, 1);
});

test("prepare returns 0 and never throws on a missing stream, failed fetch or unknown site", async () => {
    const S = load(), loc = { hostname: "www.ted.com", pathname: "/talks/a" };
    assert.equal(await S.prepare(fakeVideo(), { loc, doc: { getElementById: () => null }, fetchText }), 0);
    assert.equal(await S.prepare(fakeVideo(), { loc, doc: pageDoc("https://x.test/none.m3u8"), fetchText }), 0);
    assert.equal(await S.prepare(fakeVideo(), { loc: { hostname: "example.com", pathname: "/" }, doc: pageDoc(), fetchText }), 0);
});

test("choose prefers English then Vietnamese, else the first source", () => {
    const S = load(), src = l => ({ lang: l });
    assert.deepEqual(Array.from(S.choose([src("fr"), src("vi"), src("en")]).map(s => s.lang)), ["en", "vi"]);
    assert.deepEqual(Array.from(S.choose([src("fr"), src("de")]).map(s => s.lang)), ["fr"]);
});

test("wiring: scripts load before youtube.js and content.js calls prepare before picking a track", () => {
    const js = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8")).content_scripts.find(g => (g.js || []).includes("youtube.js")).js;
    for (const f of ["site-adapters.js", "site-ted.js"]) assert.ok(js.indexOf(f) > js.indexOf("content.js") && js.indexOf(f) < js.indexOf("youtube.js"), f);
    assert.ok(js.indexOf("site-adapters.js") < js.indexOf("site-ted.js"));
    const cs = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
    const at = cs.indexOf("window.CST_SITES.prepare(csVideo())");
    assert.ok(at > -1 && at < cs.indexOf("const picked = pickBestTrack();", at));
});
