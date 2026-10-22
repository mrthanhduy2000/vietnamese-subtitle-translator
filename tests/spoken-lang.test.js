// 1.6.9: a video spoken in Vietnamese is recognised and never subtitled, even when YouTube has
// AI-dubbed it into English (measured on 3lY0eRQhYkY: audio "vi.4" original + "en-US.10" dubbed,
// and the English ASR of the dub listed first).
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const L = require("../lang-detect.js");
const { read } = require("./bg-env.js");

const TITLE = "Đường Mã Lò ngập sâu sau mưa lớn, người dân chờ nước rút mới dám về nhà";
const DUBBED = [{ kind: "asr", languageCode: "en-US" }, { kind: "asr", languageCode: "vi" }];

test("the original audio track decides first", () => {
    const audio = { original: "vi", tracks: [{ lang: "en-US", isAutoDubbed: true }, { lang: "vi", isDefault: true }] };
    assert.deepEqual(L.spokenLanguage({ audio, tracks: DUBBED }), { lang: "vi", confidence: 0.97, source: "audio" });
});

test("several ASR tracks: the one that is not an AI dub, else the one matching the title", () => {
    assert.equal(L.spokenLanguage({ audio: { tracks: [{ lang: "en-US", isAutoDubbed: true }] }, tracks: DUBBED }).lang, "vi");
    const byTitle = L.spokenLanguage({ tracks: DUBBED, title: TITLE });
    assert.equal(byTitle.lang, "vi");
    assert.ok(byTitle.confidence >= 0.7);
    // an English talk dubbed into Spanish stays English
    assert.equal(L.spokenLanguage({ audio: { tracks: [{ lang: "es", isAutoDubbed: true }] },
        tracks: [{ kind: "asr", languageCode: "es" }, { kind: "asr", languageCode: "en" }], title: "How neural networks learn" }).lang, "en");
});

test("one ASR track is YouTube's own reading of the speech", () => {
    assert.equal(L.spokenLanguage({ tracks: [{ kind: "asr", languageCode: "en" }], title: TITLE }).lang, "en");
});

test("no ASR: a Vietnamese title means Vietnamese speech, unless it says it is a translation", () => {
    assert.equal(L.spokenLanguage({ tracks: [{ kind: "", languageCode: "en" }], title: TITLE }).lang, "vi");
    for (const t of ["[Vietsub] Cách huấn luyện mô hình ngôn ngữ lớn từ đầu", "Bài giảng AI (thuyết minh tiếng Việt) về mạng nơ-ron", "Lồng tiếng: Hành trình bên trong mạng nơ-ron nhân tạo"]) {
        assert.equal(L.spokenLanguage({ tracks: [{ kind: "", languageCode: "en" }], title: t }).lang, "unknown", t);
    }
    assert.equal(L.spokenLanguage({ tracks: [{ kind: "", languageCode: "en" }], title: "A Journey inside a Neural Network" }).lang, "unknown");
});

function chonTrack() {
    const src = read("youtube.js");
    const a = src.indexOf("function ytChonTrack(");
    const b = src.indexOf("\n}\n", a) + 2;
    const sb = { window: { CST_LANG: require("../lang-detect.js") } };
    vm.runInNewContext(src.slice(a, b) + "\nthis.f = ytChonTrack;", sb);
    return sb.f;
}

test("track pick skips the ASR of an AI dub and prefers the spoken language", () => {
    const pick = chonTrack();
    const audio = { tracks: [{ lang: "es", isAutoDubbed: true }, { lang: "de", isDefault: true }] };
    const tracks = [{ kind: "asr", languageCode: "es" }, { kind: "asr", languageCode: "de" }, { kind: "", languageCode: "en" }];
    assert.equal(pick(tracks, true, { spoken: "de", audio }).track.languageCode, "de");
    // without the context the old order still holds (English manual first)
    assert.equal(pick(tracks, true).track.languageCode, "en");
    // a Vietnamese ASR that only transcribes a Vietnamese AI dub is not "Vietnamese subtitles"
    const viDub = { tracks: [{ lang: "vi", isAutoDubbed: true }, { lang: "en", isDefault: true }] };
    const r = pick([{ kind: "asr", languageCode: "vi" }, { kind: "asr", languageCode: "en" }], true, { spoken: "en", audio: viDub });
    assert.equal(r.daCoTiengViet, false);
    assert.equal(r.track.languageCode, "en");
});

test("wiring: the bridge reports audio tracks, a spoken-Vietnamese video stops before the cache", () => {
    const bridge = read("yt-bridge.js");
    assert.match(bridge, /audio: docAmThanh\(response\)/);
    assert.match(bridge, /"isAutoDubbed" in v/);
    const yt = read("youtube.js");
    const gate = yt.indexOf("if (!opts.force && sp.lang === \"vi\" && sp.confidence >= 0.7)");
    assert.ok(gate > 0 && gate < yt.indexOf("let cache = await ytDocCache(yt.currentVideoId);"), "the gate must run before the cache");
    assert.match(yt, /actionLabel: "Vẫn dịch", onAction: \(\) => \{ ytBatDauDich\(\{ force: true \}\)/);
    assert.match(yt, /action: sp\.lang === "vi" \? "skip" : "translate"/);
});

// 1.7.0: an English video played with YouTube's own Vietnamese AI dub
test("hearing YouTube's Vietnamese AI dub is recognised; the original Vietnamese or another dub is not", () => {
    assert.equal(L.hearsVietnameseDub({ original: "en", current: "vi", currentDubbed: true }), true);
    assert.equal(L.hearsVietnameseDub({ original: "", current: "vi", currentDubbed: true }), true, "original unknown");
    assert.equal(L.hearsVietnameseDub({ original: "en", current: "en", currentDubbed: false }), false);
    assert.equal(L.hearsVietnameseDub({ original: "vi", current: "vi", currentDubbed: false }), false, "a Vietnamese video is the other rule");
    assert.equal(L.hearsVietnameseDub({ original: "vi", current: "en-US", currentDubbed: true }), false);
    assert.equal(L.hearsVietnameseDub(undefined), false);
});

test("wiring: gate, audio-switch messages and the switch back to the original audio", () => {
    const yt = read("youtube.js"), bridge = read("yt-bridge.js");
    const gate = yt.indexOf("window.CST_LANG.hearsVietnameseDub(info.audio)");
    assert.ok(gate > 0 && gate < yt.indexOf("let cache = await ytDocCache(yt.currentVideoId);"), "dub gate must run before the cache");
    assert.match(yt, /actionLabel: "Dùng tiếng gốc \+ giọng tiện ích"/);
    assert.match(yt, /cstType === "AM_THANH_DOI"\) ytKhiDoiAmThanh\(event\.data\)/);
    assert.match(yt, /if \(dubbing\) \{ api\.stop\(\); ytDatTrangThaiNutLongTieng\(false\); \}/);
    assert.match(bridge, /cstType: "AM_THANH_DOI"/);
    assert.match(bridge, /data\.cstType === "CHON_AM_THANH_GOC"/);
    assert.match(bridge, /player\.setAudioTrack\(orig\)/);
});

test("Portuguese and Romanian text is not taken for Vietnamese (ã, ă are not Vietnamese-only letters)", () => {
    const pt = "Não é possível. Então vamos começar a aula de hoje, são muitas coisas para ver.";
    assert.equal(L.detectText(pt).lang, "pt");
    assert.equal(L.decide({ metaLang: "pt", sample: pt }).action, "translate");
    assert.notEqual(L.detectText("Bună ziua, astăzi vă voi arăta această metodă simplă pentru că este importantă.").lang, "vi");
    for (const vi of ["Xin chào các bạn, hôm nay chúng ta sẽ học về lập trình.", "Năm nay tăng trưởng mạnh, cảm ơn các bạn đã theo dõi."]) {
        assert.equal(L.detectText(vi).lang, "vi", vi);
    }
});

// 2.7.9: a Tamil-English street interview tagged "ko (auto)" by YouTube; its 413 lines were dots,
// digits and stray Latin. The uploaded English track was left unused and no window could be translated
test("a machine transcript that heard nothing usable is told apart, a real one is not", () => {
    const junk = ". 5 - 6 HFC B . ENT ? . 10 lp ? . V lad entman Welcome back to SUM today we are going tow asking CH How much They make let get sted . . ort . . . ? . 0 . . as the comp . ? 2022 . 22 . 5 - 6 end comp end use ook";
    assert.deepEqual(L.brokenTranscript("ko", junk), { broken: true, why: "wrong-script" });
    assert.equal(L.brokenTranscript("en", ". . . ? . 0 . . . 22 . 5 - 6 . . ? . . - . . 10 . ? . . . . 2022 . . ? . . . . . 5 . . . . ? . . ".repeat(2)).why, "no-words");
    assert.equal(L.brokenTranscript("en", junk).broken, false, "English words in an English track");
    assert.equal(L.brokenTranscript("ko", "안녕하세요 여러분 오늘은 서울에서 가장 맛있는 떡볶이 가게를 찾아가 보겠습니다 정말 기대되네요 [음악] 같이 가 봐요").broken, false);
    assert.equal(L.brokenTranscript("ja", "今日は東京の小さなアパートを紹介します。とても狭いですが、収納がたくさんあります。一緒に見てみましょう").broken, false, "kanji count for Japanese");
    assert.equal(L.brokenTranscript("hi", "नमस्ते दोस्तों आज हम बात करेंगे कि पैसे कैसे बचाएं और अपने बजट को कैसे संभालें यह बहुत जरूरी है").broken, false);
    assert.equal(L.brokenTranscript("ko", "[음악] [음악] [박수]").broken, false, "too little to judge");
});

test("YouTube: a broken machine transcript gives way to the best other track, the saved copy keeps the first choice's id", () => {
    const yt = read("youtube.js");
    const at = yt.indexOf("LD.brokenTranscript(track.languageCode");
    assert.ok(at > 0);
    const block = yt.slice(at - 600, at + 900);
    assert.match(block, /track\.kind === "asr"/, "only a machine transcript is judged");
    assert.match(block, /ytChonTrack\(others, false/);
    assert.doesNotMatch(block, /yt\.srcTrack\s*=/, "yt.srcTrack stays the first choice's");
});
