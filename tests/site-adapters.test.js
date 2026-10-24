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

const pageDoc = (stream = STREAM, key = "videoPlayerData", slug = "a") => ({
    getElementById: id => id === "__NEXT_DATA__" ? { textContent: JSON.stringify({ slug, props: { pageProps: { videoData: {
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
    for (const doc of [pageDoc(STREAM, "playerData"), { getElementById: () => ({ textContent: JSON.stringify({ slug: "a", props: { pageProps: { videoData: { hlsUrl: STREAM } } } }) }) }]) {
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
    assert.equal(await S.prepare(fakeVideo(), { loc, doc: { getElementById: () => null }, fetchText }), 0);   // no page data: the HTML fetch 404s
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

test("ted.com pages get the scripts on arrival and are translated without a click", () => {
    const m = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
    const g = m.content_scripts.find(x => (x.js || []).includes("site-ted.js"));
    assert.ok(g.matches.includes("*://*.ted.com/*"));
    const cs = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
    assert.match(cs, /function csAdapterSite\(\)/);
    assert.match(cs, /getCurrentSite\(\) !== "coursera" && !csAdapterSite\(\)/);
    assert.match(cs, /csVideo\(\) && await window\.CST_SITES\.prepare\(csVideo\(\)\)/);
});

const html = stream => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ slug: "next_talk",
    props: { pageProps: { videoData: { hlsUrl: stream } } } })}</script></html>`;

test("after a client-side move the DOM data is stale: the new talk's HTML is fetched", async () => {
    const S = load(), v = fakeVideo();
    const loc = { hostname: "www.ted.com", pathname: "/talks/next_talk" };
    const ft = async u => u === "/talks/next_talk" ? html(STREAM) : fetchText(u);
    const n = await S.prepare(v, { loc, doc: pageDoc(STREAM, "videoPlayerData", "old_talk"), fetchText: ft, makeCue: (s, e, t) => ({ s, e, t }) });
    assert.equal(n, 1);
});

test("tracks of the previous talk go stale and are not reused", async () => {
    const S = load(), v = fakeVideo();
    const mk = () => ({ s: 0, e: 0, t: "" });
    await S.prepare(v, { loc: { hostname: "www.ted.com", pathname: "/talks/a" }, doc: pageDoc(), fetchText, makeCue: mk });
    const n = await S.prepare(v, { loc: { hostname: "www.ted.com", pathname: "/talks/b" }, doc: pageDoc(STREAM, "videoPlayerData", "b"), fetchText, makeCue: mk });
    assert.equal(n, 1);
    assert.equal(v.tracks.length, 2);
    assert.equal(v.tracks[0].cstStale, true);
    assert.equal(v.tracks[1].cstPath, "/talks/b");
});

test("a cue repeated across an HLS segment boundary is kept once", async () => {
    const S = load();
    const files = {
        "https://x.test/p.m3u8": "#EXTM3U\n#EXTINF:30,\na.vtt\n#EXTINF:30,\nb.vtt",
        "https://x.test/a.vtt": "WEBVTT\n\n00:29.000 --> 00:31.000\nsame\n",
        "https://x.test/b.vtt": "WEBVTT\n\n00:29.000 --> 00:31.000\nsame\n\n00:32.000 --> 00:33.000\nnext\n",
    };
    const cues = await S.loadHlsVtt("https://x.test/p.m3u8", async u => files[u]);
    assert.deepEqual(Array.from(cues.map(c => c.text)), ["same", "next"]);
});

test("content.js prefers adapter tracks, drops stale ones and prepares before picking on every talk", () => {
    const cs = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
    assert.match(cs, /!tt\.cstStale/);
    assert.match(cs, /return site\.length \? site : all;/);
    const now = cs.indexOf("async function courseraAutoTranslateNow");
    assert.ok(cs.indexOf("CST_SITES.prepare", now) > -1 && cs.indexOf("CST_SITES.prepare", now) < cs.indexOf("pickBestTrack()", now));
});

test("auto translate tells the viewer when an adapter site already has Vietnamese", () => {
    const cs = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
    assert.match(cs, /decision\.action === "skip" && picked\.alreadyVietnamese && csAdapterSite\(\)\) \{\s*cstToast\("Video này đã có phụ đề tiếng Việt/);
});

test("HLS segments are fetched in parallel and the cues keep playlist order", async () => {
    const S = load();
    const base = "https://hls.ted.com/talks/9/subtitles/en/index.m3u8";
    const n = 30;
    const playlist = "#EXTM3U\n" + Array.from({ length: n }, (_, i) => `#EXTINF:10,\ns${i}.vtt`).join("\n");
    let inFlight = 0, peak = 0;
    const ft = async u => {
        if (u === base) return playlist;
        const i = +/s(\d+)\.vtt/.exec(u)[1];
        inFlight++; peak = Math.max(peak, inFlight);
        await new Promise(r => setTimeout(r, i % 2 ? 1 : 5));   // later segments can finish first
        inFlight--;
        return `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nline ${i}\n`;
    };
    const cues = await S.loadHlsVtt(base, ft);
    assert.equal(cues.length, n);
    assert.deepEqual(Array.from(cues.map(c => c.text)), Array.from({ length: n }, (_, i) => `line ${i}`));
    assert.ok(peak > 1 && peak <= 8, "parallel but bounded, peak " + peak);
});

test("an adapter site's first play is held longer than the standard 5 s", () => {
    const cs = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
    assert.match(cs, /const CS_ADAPTER_HOLD_MS = 15000/);
    assert.match(cs, /maxMs: csAdapterSite\(\) \? CS_ADAPTER_HOLD_MS : undefined/);
});

// TEDx talks embed YouTube in a youtube-nocookie.com iframe; the YouTube pipeline must run in that frame
test("YouTube embed frames get the bridge and the shared pipeline, and are treated as YouTube", () => {
    const root = path.join(__dirname, "..");
    const m = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
    const embedGroups = m.content_scripts.filter(g => (g.matches || []).includes("*://www.youtube-nocookie.com/embed/*"));
    assert.equal(embedGroups.length, 2);
    for (const g of embedGroups) assert.equal(g.all_frames, true);
    const full = m.content_scripts.find(g => (g.js || []).includes("youtube.js") && g.matches.includes("*://*.ted.com/*"));
    const embedMain = embedGroups.find(g => g.js.includes("youtube.js"));
    assert.deepEqual(embedMain.js, full.js, "same scripts, same order as the top-level group");
    assert.equal(embedGroups.find(g => g.world === "MAIN").js[0], "yt-bridge.js");
    const read = f => fs.readFileSync(path.join(root, f), "utf8");
    assert.match(read("content.js"), /youtube\(-nocookie\)\?\\.com/);
    assert.match(read("youtube.js"), /\/embed\//);
    assert.match(read("yt-bridge.js"), /youtube\(-nocookie\)\?/);
});

test("embed frames: start-up leaves DOM marks, the button floats without .ytp-right-controls", () => {
    const root = path.join(__dirname, "..");
    const yt = fs.readFileSync(path.join(root, "youtube.js"), "utf8");
    const br = fs.readFileSync(path.join(root, "yt-bridge.js"), "utf8");
    for (const k of ["Loaded", "Boot", "Player", "Button", "Auto"]) assert.match(yt, new RegExp(`ytChanDoan\\("${k}"`), k);
    assert.match(yt, /dataset\["cstYt" \+ key\]/);
    assert.match(yt, /const rightControls = bar \|\| player/);
    assert.match(br, /dataset\.cstBridge/);
    assert.doesNotMatch(br, /function trinhPhat\(\) \{ return trinhPhat\(\)/, "no self-recursion");
});

test("a cached copy names its source captions in the menu", () => {
    const yt = fs.readFileSync(path.join(__dirname, "..", "youtube.js"), "utf8");
    const cache = yt.slice(yt.indexOf("yt.daDichXong = true;"), yt.indexOf("Lay ban dich tu bo nho dem"));
    assert.match(cache, /yt\.trackInfo = \{ languageCode: chon\.track\.languageCode/);
});
