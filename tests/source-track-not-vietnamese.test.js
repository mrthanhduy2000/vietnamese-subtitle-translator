// A Vietnamese caption track on a video whose speech is another language (an English talk with a
// Vietnamese track on the page) must not become the source of the original line: the bilingual view
// then showed Vietnamese on both lines. The speech's own track is the source; the Vietnamese track is
// only used when the speech is Vietnamese or no other track exists.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { read } = require("./bg-env.js");

function pickTrack() {
    const src = read("youtube.js");
    const a = src.indexOf("function ytChonTrack(");
    const b = src.indexOf("\n}\n", a) + 2;
    const sb = { window: { CST_LANG: require("../lang-detect.js") } };
    vm.runInNewContext(src.slice(a, b) + "\nthis.f = ytChonTrack;", sb);
    return sb.f;
}

const ENGLISH_AUDIO = { original: "en-US", tracks: [{ lang: "en-US", isAutoDubbed: false, isDefault: true }] };

test("English speech with a Vietnamese manual track: the English ASR is the source, not the Vietnamese", () => {
    const pick = pickTrack();
    const tracks = [{ kind: "", languageCode: "vi" }, { kind: "asr", languageCode: "en" }];
    const r = pick(tracks, true, { spoken: "en", audio: ENGLISH_AUDIO });
    assert.equal(r.track.languageCode, "en");
    assert.equal(r.daCoTiengViet, false);
});

test("English speech with a Vietnamese ASR and an English manual track: the English manual track wins", () => {
    const pick = pickTrack();
    const tracks = [{ kind: "asr", languageCode: "vi" }, { kind: "", languageCode: "en" }];
    const r = pick(tracks, true, { spoken: "en", audio: ENGLISH_AUDIO });
    assert.equal(r.track.languageCode, "en");
    assert.equal(r.track.kind, "");
    assert.equal(r.daCoTiengViet, false);
});

test("English speech with a Vietnamese track and a French track: the French track is the source, never the Vietnamese", () => {
    const pick = pickTrack();
    const tracks = [{ kind: "", languageCode: "vi" }, { kind: "", languageCode: "fr" }];
    const r = pick(tracks, true, { spoken: "en", audio: ENGLISH_AUDIO });
    assert.equal(r.track.languageCode, "fr");
    assert.equal(r.daCoTiengViet, false);
});

test("a video with only Vietnamese tracks keeps the old shortcut (there is no other source)", () => {
    const pick = pickTrack();
    const r = pick([{ kind: "", languageCode: "vi" }], true, { spoken: "en", audio: ENGLISH_AUDIO });
    assert.equal(r.track.languageCode, "vi");
    assert.equal(r.daCoTiengViet, true);
});

test("Vietnamese speech still uses the Vietnamese track as it did", () => {
    const pick = pickTrack();
    const tracks = [{ kind: "", languageCode: "vi" }, { kind: "asr", languageCode: "en" }];
    const r = pick(tracks, true, { spoken: "vi" });
    assert.equal(r.track.languageCode, "vi");
    assert.equal(r.daCoTiengViet, true);
});

test("unknown speech (no context) keeps the old behaviour", () => {
    const pick = pickTrack();
    const tracks = [{ kind: "", languageCode: "vi" }, { kind: "asr", languageCode: "en" }];
    const r = pick(tracks, true);
    assert.equal(r.track.languageCode, "vi");
    assert.equal(r.daCoTiengViet, true);
});
