// On-screen subtitles (screen-text.js + readScreenText, 2.6.4)
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../screen-text.js");
const COST = require("../cost-policy.js");
const { bgEnv } = require("./bg-env.js");

const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// An RGBA band w x h, filled with one grey level, with optional light rectangles ("letters")
function band(w, h, bg, rects = [], fg = 240) {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = bg; px[i * 4 + 3] = 255; }
    for (const [x0, y0, rw, rh] of rects) {
        for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) {
            const i = (y * w + x) * 4;
            px[i] = px[i + 1] = px[i + 2] = fg;
        }
    }
    return px;
}
// A row of thin letter strokes from x0, the way caption letters look at the measuring width
const letters = (x0, n, y = 20, gap = 4) => Array.from({ length: n }, (_, k) => [x0 + k * gap, y, 2, 9]);

test("screen text: light letters on a dark box are text, a smooth bright area and a dark frame are not", () => {
    const w = 480, h = 60;
    const caption = S.textMask(band(w, h, 30, letters(100, 60)), w, h);
    assert.ok(S.hasText(caption), `count ${caption.count}`);
    assert.ok(caption.top >= 18 && caption.bottom <= 31, `${caption.top}-${caption.bottom}`);
    // a lit wall: bright, but no dark next to it
    assert.equal(S.hasText(S.textMask(band(w, h, 200, [[50, 10, 300, 40]], 250), w, h)), false);
    assert.equal(S.hasText(S.textMask(band(w, h, 20), w, h)), false);
});

test("screen text: a caption is read once it settles, not again while it stays, cleared when it goes", () => {
    const w = 480, h = 60, cw = Math.ceil(w / S.CELL);
    const cellsOf = rects => S.cells(S.textMask(band(w, h, 30, rects), w, h));
    const first = cellsOf(letters(100, 50));
    const second = cellsOf(letters(60, 30, 36));
    const st = {};
    assert.equal(S.step(st, first, cw), "", "one sample: the caption may still be fading in");
    assert.equal(S.step(st, first, cw), "read");
    assert.equal(S.step(st, first, cw), "", "the same caption is not read twice");
    assert.ok(S.difference(first, second, cw) > 0.5);
    assert.equal(S.step(st, second, cw), "");
    assert.equal(S.step(st, second, cw), "read", "a new caption is read");
    assert.equal(S.step(st, null, cw), "", "one blank sample: a flicker");
    assert.equal(S.step(st, null, cw), "clear");
    assert.equal(S.step(st, null, cw), "");
});

// The caption list of qSlxe4hA66g as YouTube gave it on 2026-10-19: audio labelled en-US, spoken in
// Korean up to 17:30; 20 ASR tracks of AI dubs (URL mark "variant=timing-optimized") and one Korean
// ASR track without the mark, the transcript of the original speech, which a Korean dub sits next to
const URL = (l, dub) => `https://www.youtube.com/api/timedtext?v=qSlxe4hA66g&caps=asr&kind=asr&lang=${l}${dub ? "&variant=timing-optimized" : ""}`;
const DUB_LANGS = ["ar", "bn", "nl", "fr", "de", "iw", "hi", "id", "it", "ja", "ko", "ml", "pl", "pt", "pa", "ru", "es", "ta", "te", "uk"];
const QS_TRACKS = DUB_LANGS.map(l => ({ languageCode: l, kind: "asr", baseUrl: URL(l, true) }));
QS_TRACKS.splice(11, 0, { languageCode: "ko", kind: "asr", baseUrl: URL("ko", false) });
const QS_AUDIO = { original: "en-US", tracks: [{ lang: "en-US", isAutoDubbed: false }, ...["ar", "pl", "bn", "pt-BR", "iw", "de-DE", "nl-NL", "ko", "hi", "id", "it", "ml", "ru", "ja", "fr-FR", "pa", "ta", "es-US", "te", "uk"].map(l => ({ lang: l, isAutoDubbed: true }))] };

test("dub transcripts: YouTube's mark tells the original speech's transcript from the dubs' (qSlxe4hA66g)", () => {
    const LANG = require("../lang-detect.js");
    const dubs = LANG.dubTranscripts(QS_TRACKS, QS_AUDIO);
    assert.equal(dubs.size, 20);
    assert.ok(!dubs.has(QS_TRACKS[11]), "the unmarked Korean track is the original speech");
    // the recogniser heard Korean: that beats the uploader's en-US label
    assert.deepEqual(LANG.spokenLanguage({ audio: QS_AUDIO, tracks: QS_TRACKS }), { lang: "ko", confidence: 0.96, source: "asr-original" });
    // so the picture is not needed here
    assert.equal(S.onlyDubTranscripts(QS_TRACKS, QS_AUDIO, QS_TRACKS[11]), false);
    // without the mark (older responses) a dubbed language's ASR still counts as a dub transcript
    const plain = QS_TRACKS.map(t => ({ languageCode: t.languageCode, kind: "asr" }));
    assert.equal(LANG.dubTranscripts(plain, QS_AUDIO).size, 21);
    assert.equal(LANG.spokenLanguage({ audio: QS_AUDIO, tracks: plain }).lang, "en");
});

test("screen text: only when every track is a dub transcript does the picture take over", () => {
    const allDub = QS_TRACKS.filter((t, i) => i !== 11);
    assert.equal(S.onlyDubTranscripts(allDub, QS_AUDIO, allDub[0]), true);
    const withUploaded = [...allDub, { languageCode: "ar", kind: "", baseUrl: URL("ar", false) }];
    assert.equal(S.onlyDubTranscripts(withUploaded, QS_AUDIO, withUploaded[withUploaded.length - 1]), false);
    // no AI dubs: an ordinary video
    assert.equal(S.onlyDubTranscripts([{ languageCode: "ko", kind: "asr" }], { original: "ko", tracks: [] }, { languageCode: "ko", kind: "asr" }), false);
});

test("track choice: qSlxe4hA66g is translated from the original Korean transcript, and a copy saved from another track is dropped", () => {
    const yt = R("youtube.js");
    const fn = yt.slice(yt.indexOf("function ytChonTrack("), yt.indexOf("// ---------- Tai va doc ban chep loi"));
    const LANG = require("../lang-detect.js");
    const ytChonTrack = new Function("window", fn + "; return ytChonTrack;")({ CST_LANG: LANG });
    const sp = LANG.spokenLanguage({ audio: QS_AUDIO, tracks: QS_TRACKS });
    const chosen = ytChonTrack(QS_TRACKS, true, { spoken: sp.lang, audio: QS_AUDIO }).track;
    assert.equal(chosen, QS_TRACKS[11]);
    // before 2.6.4 this video was translated from the Arabic dub's transcript and saved without `src`
    assert.match(yt, /cache && \(cache\.src \? cache\.src !== yt\.srcTrack : hasDubs\)/);
    assert.match(yt, /src: yt\.srcTrack \|\| ""/);
    // the bridge keeps the two "ko" bodies apart (a dub's and the original's)
    const bridge = R("yt-bridge.js");
    assert.match(bridge, /function khoa\(v, lang, kind, variant\)/);
    assert.equal((bridge.match(/u\.searchParams\.get\("variant"\)/g) || []).length, 3);
});

test("screen text: wired into the page before the saved copy, loaded before youtube.js, stopped on teardown", () => {
    const js = JSON.parse(R("manifest.json")).content_scripts.find(g => (g.js || []).includes("youtube.js")).js;
    assert.ok(js.indexOf("screen-text.js") > -1 && js.indexOf("screen-text.js") < js.indexOf("youtube.js"));
    const yt = R("youtube.js");
    const check = yt.indexOf("SCREEN.onlyDubTranscripts(");
    assert.ok(check > -1 && check < yt.indexOf("let cache = await ytDocCache("), "a copy saved from a dub transcript must not come back");
    assert.match(yt.slice(yt.indexOf("function ytTatDich()"), yt.indexOf("function ytTatDich()") + 200), /ytDungDocChuTrenHinh\(\)/);
    assert.match(R("background.js"), /readScreenText: handleReadScreenText/);
});

test("screen text: readScreenText reads and translates one image on the cheapest model the key can call", async () => {
    const seen = [], bodies = [];
    const fetchImpl = async (u, o) => {
        const m = (u.match(/models\/([^:]+):generateContent/) || [])[1];
        seen.push(m);
        if (m === "gemini-2.5-flash-lite") return { ok: false, status: 404, statusText: "Not Found", json: async () => ({ error: { code: 404, status: "NOT_FOUND", message: `This model models/${m} is no longer available to new users.` } }) };
        bodies.push(JSON.parse(o.body));
        const answer = { text: "Defector's Daughter: [We sing songs about your family in school.]", speaker: "Defector's Daughter", vi: "Ở trường, chúng cháu hát những bài về gia đình ông." };
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }], usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 40 } }) };
    };
    const E = bgEnv(fetchImpl, { geminiApiKey: "KEY-NEW-USER", modelsVersion: COST.MODELS_VERSION });
    const image = "data:image/jpeg;base64,/9j/AAAA";
    const r = JSON.parse(JSON.stringify(await E.send({ action: "readScreenText", image, before: [{ text: "Halt!", vi: "Đứng lại!" }], videoKey: "yt:qSlxe4hA66g", videoTitle: "MODERN WARFARE 4" })));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.speaker, "Defector's Daughter");
    assert.match(r.vi, /gia đình/);
    assert.deepEqual(seen, ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"]);
    const parts = bodies[0].contents[0].parts;
    assert.deepEqual(parts[0].inline_data, { mime_type: "image/jpeg", data: "/9j/AAAA" });
    assert.match(parts[1].text, /Halt! => Đứng lại!/);
    assert.match(bodies[0].system_instruction.parts[0].text, /never shorten/);
    // not an image, or no key: no call
    assert.equal((await E.send({ action: "readScreenText", image: "http://x/y.jpg" })).reason, "bad_image");
    const E2 = bgEnv(async () => { throw new Error("no call expected"); }, {});
    assert.equal((await E2.send({ action: "readScreenText", image })).reason, "no_key");
});
