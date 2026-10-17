// 1.8.0: context decides a word's language (dub-speech.js CONF, three states), codes of 5+ letters,
// one parser for version vs quantity (dub-planner.js numberRole), constituents in the prosody model
// (dub-prosody.js constituents), subtitle lines bridged inside a phrase (dub-planner.js), one token
// map for both, and the cache identities: what the paid voice and the translation store are keyed by
// must not move with any of it. Measured: tools/pron-eval.js, tools/syntax-eval.js.
const test = require("node:test");
const assert = require("node:assert");
const SPEECH = require("../dub-speech.js");
const PLAN = require("../dub-planner.js");
const PROS = require("../dub-prosody.js");

const say = (s, ctx) => SPEECH.render(s, ctx).text;
const confOf = (s, word, ctx) => SPEECH.analyze(s, ctx).tokens.find(t => t.s === word).conf;

// ---- pronunciation: three states ----
test("a name word is English only with enough evidence: HIGH_EN is rewritten, AMBIGUOUS and HIGH_VI are left alone", () => {
    // an English surname after it, even at the start of the sentence
    assert.equal(confOf("Sam Altman vừa công bố kế hoạch mới.", "Sam"), SPEECH.HIGH_EN);
    assert.equal(say("Sam Altman vừa công bố kế hoạch mới."), "<en>samh</en> Altman vừa công bố kế hoạch mới.");
    assert.equal(say("Tim Cook giới thiệu sản phẩm."), "<en>timm</en> Cook giới thiệu sản phẩm.");
    // alone: not enough, whatever the word
    for (const s of ["Tom đang đợi ở ngoài.", "Hôm qua tôi gặp Dan ở quán.", "Sam gọi cho tôi.", "Tim sẽ đến muộn."]) {
        assert.equal(say(s), s, s);
        assert.equal(confOf(s, s.match(/Tom|Dan|Sam|Tim/)[0]), SPEECH.AMBIGUOUS, s);
    }
    // a Vietnamese name word beside it is decisive, a title is weak
    assert.equal(confOf("Nguyễn Văn Dan là sinh viên.", "Dan"), SPEECH.HIGH_VI);
    assert.equal(say("Nguyễn Văn Dan là sinh viên."), "Nguyễn Văn Dan là sinh viên.");
    assert.equal(say("Chị Kim là trưởng phòng."), "Chị Kim là trưởng phòng.");
    assert.equal(say("Cô Kim Anh dạy môn toán."), "Cô Kim Anh dạy môn toán.");
    // a capitalised title is not a Vietnamese name word: "Chị Sam Altman" keeps its English surname clue
    assert.equal(confOf("Chị Sam Altman nói.", "Sam"), SPEECH.HIGH_EN);
});

test("a Vietnamese word opening a sentence before an English word stays Vietnamese: only name words count there", () => {
    for (const s of ["Con Labrador này rất ngoan.", "So Google với Bing thì sao.", "Con AI này trả lời nhanh.", "In Poster này ra giúp tôi.", "Can Marketing thì sao."]) assert.equal(say(s), s, s);
    assert.equal(say("Don Norman viết một cuốn sách."), "<en>donn</en> Norman viết một cuốn sách.");
});

test("the English source line names a lone given name: English; a name Vietnamese people carry is never taken from it", () => {
    assert.equal(say("Tom kể rằng anh ấy đã bỏ việc.", { source: "Tom said he had quit his job." }), "<en>tahm</en> kể rằng anh ấy đã bỏ việc.");
    assert.equal(say("Anh Tom kể lại.", { source: "Tom told me again." }), "Anh <en>tahm</en> kể lại.");
    // Lan, Dan (Dân), An, Van (Văn): an English video about a Vietnamese person writes them the same way
    assert.equal(say("Lan nói rằng dự án đã xong.", { source: "Lan said the project is done." }), "Lan nói rằng dự án đã xong.");
    assert.equal(say("Dan hỏi tôi về kế hoạch.", { source: "Dan asked me about the plan." }), "Dan hỏi tôi về kế hoạch.");
    // a source line that is not English is no evidence
    assert.equal(say("Tom đang đợi.", { source: "Tom đang đợi." }), "Tom đang đợi.");
});

test("codes of 5+ letters: English letters only for a code with no vowel and English evidence; Vietnamese ones and pronounceable ones are left to the voice", () => {
    assert.equal(say("Máy chủ gửi thư qua SMTPS.", { source: "The server sends mail over SMTPS." }), "Máy chủ gửi thư qua <en>s m t p s</en>.");
    assert.equal(say("Máy chủ gửi thư qua SMTPS."), "Máy chủ gửi thư qua SMTPS.");
    for (const s of ["Học sinh đang ôn thi THPTQG.", "Hiến pháp nước CHXHCN Việt Nam.", "Mạng lưới UBMTTQ hoạt động ở mọi xã."]) assert.equal(say(s), s, s);
    // a vowel but no word shape: said as a word or as letters, unknown; "CRISPR" is in the lexicon
    assert.equal(say("Kỳ thi IELTS rất khó.", { source: "The IELTS exam is hard." }), "Kỳ thi IELTS rất khó.");
    assert.equal(say("Kỹ thuật CRISPR rất mới.", { source: "CRISPR is very new." }), "Kỹ thuật <en>crisper</en> rất mới.");
    // VieNeu drops both I's of "NVIDIA": the lexicon says it
    assert.equal(say("Cổ phiếu NVIDIA tăng mạnh."), "Cổ phiếu <en>nvidia</en> tăng mạnh.");
    assert.ok(SPEECH.PRONUNCIATION_VERSION);
});

// ---- version or quantity ----
test("one parser tells a version from a quantity: a unit after the number wins over a product name before it", () => {
    assert.equal(PLAN.numberRole("CPU", "GHz"), "quantity");
    assert.equal(PLAN.numberRole("Python", "năm"), "version");
    assert.equal(PLAN.numberRole("phiên bản", ""), "version");
    assert.equal(PLAN.numberRole("Trong", "giây"), "quantity");
    const cases = [
        ["Xung nhịp CPU 3.5 GHz khá cao.", "3 phẩy 5"], ["Bộ nhớ GPU 2.5 GB là không đủ.", "2 phẩy 5"],
        ["Tệp này nặng 10.5 GB.", "10 phẩy 5"], ["Mỗi túi nặng 2,5 kg.", "2 phẩy 5"], ["Trong 3.5 giây.", "3 phẩy 5"],
        ["Python 3.12 năm ngoái ra mắt.", "3 chấm 12"], ["iOS 18.2 sửa lỗi.", "18 chấm 2"], ["Gemini 2.5 Flash nhanh hơn.", "2 chấm 5"],
        ["Bản macOS 15.1 sửa lỗi.", "15 chấm 1"], ["Trong phiên bản 3.5, giao diện đổi.", "3 chấm 5"], ["GPT-5.6 ra mắt.", "5 chấm 6"]
    ];
    for (const [s, want] of cases) assert.ok(PLAN.adaptForSpeech(s).includes(want), `${s} -> ${PLAN.adaptForSpeech(s)}`);
    // a four-digit number after a code is a model number, unless a unit follows
    assert.equal(say("Card RTX 5090 rất mạnh."), "Card RTX 5 0 9 0 rất mạnh.");
    assert.equal(say("Máy có RAM 4096 MB."), "Máy có RAM 4096 MB.");
});

// ---- prosody: constituents ----
const gap = (s, w) => { const a = PROS.analyze(s); const i = a.words.findIndex(x => x.raw === w); return a.gaps[i]; };
test("constituents: no pause inside a subject before its prepositional phrase; the boundary is before the predicate", () => {
    const s = "Một công ty công nghệ lớn ở California trong quý vừa qua đã tăng doanh thu gấp đôi.";
    assert.ok(gap(s, "lớn").value < 0 && gap(s, "California").value < 0, "inside the subject");
    assert.ok(gap(s, "qua").value > 0, "subject | predicate stays a boundary");
    assert.deepEqual(PROS.analyze(s).clauses[0].subject, [0, 11]);
    const t = "Độ chính xác của mô hình trên tập kiểm tra đã tăng đáng kể.";
    assert.ok(gap(t, "hình").value < 0);
    // a fronted adjunct is not a subject; a degree adverb means the verb came earlier: nothing forced
    assert.ok(!PROS.analyze("Ở Việt Nam các công ty đã tăng lương.").clauses[0].subject);
    assert.ok(!PROS.analyze("Mô hình học rất nhanh trên tập huấn luyện nhưng lại kém.").clauses[0].subject);
});

test("constituents: a short predicate keeps its first adjunct; a purpose clause is a clause, not an adjunct", () => {
    assert.ok(gap("Lợi nhuận tăng mạnh nhờ vào dữ liệu khách hàng.", "mạnh").value < 0);
    assert.ok(gap("Anh ấy làm việc với khách hàng từ sáng đến tối.", "việc").value < 0);
    assert.ok(gap("Tôi đang chạy Google Ads cho Performance Max để tăng doanh số.", "Ads").value < 0);
    // "Tôi dùng ChatGPT | để phân tích": a legal boundary, never "để | phân tích"
    const s = "Tôi dùng ChatGPT để phân tích dữ liệu.";
    assert.ok(gap(s, "ChatGPT").value >= 0);
    assert.ok(gap(s, "để").value < 0);
    const a = PROS.analyze("Tôi dùng ChatGPT để phân tích dữ liệu.");
    assert.equal(a.clauses[1].role, "purpose");
    // an English entity is one constituent: no pause inside, none forced around it
    const b = PROS.analyze("Tôi đang chạy Google Ads cho Performance Max.");
    assert.equal(b.gaps[3].tier, "hard");   // Google | Ads
    assert.equal(b.gaps[6].tier, "hard");   // Performance | Max
});

test("token map: pronunciation and prosody read one tokenisation; each token carries both decisions", () => {
    const m = PROS.tokenMap("Tom Hanks đóng phim ở San Francisco.");
    assert.deepEqual(m.map(t => t.surface), ["Tom", "Hanks", "đóng", "phim", "ở", "San", "Francisco."]);
    assert.equal(m[0].language, "en");
    assert.equal(m[0].spanId, m[1].spanId);
    assert.equal(m[0].entityType, "person");
    assert.equal(m[0].pronunciationConfidence, SPEECH.HIGH_EN);
    assert.equal(m[0].boundaryAfter, "hard");
    assert.equal(m[5].boundaryAfter, "hard");
    const v = PROS.tokenMap("Chị Kim là trưởng phòng.");
    assert.equal(v[1].pronunciationMode, "as-is");
});

// ---- across subtitle lines (free voice) ----
function groups(cues, gap) {
    let t = 10;
    return cues.map(text => {
        const d = Math.max(0.8, PLAN.countSyllables(text) / 4.6);
        const g = { start: t, end: t + d, viText: text, viCues: [{ start: t, end: t + d, text, lines: [text] }], srcCues: [{ start: t, end: t + d, text: "" }] };
        t += d + gap;
        return g;
    });
}
const FREE = { joinGroups: true, segSoft: 8, segHard: 11 };
test("a pause of the speaker inside a phrase is not a speech boundary for the free voice; a real break or a paid voice is followed", () => {
    const cut = (cues, gap, opts) => PLAN.buildDubScript(groups(cues, gap), opts).map(s => s.subtitleText);
    for (const cues of [["Tôi rất thích phim của Christopher", "Nolan vì cốt truyện phức tạp."], ["Xung nhịp đạt 3,5", "GHz khi ép xung."],
        ["Một công ty lớn ở California", "trong quý vừa qua đã tăng lương."]]) {
        assert.equal(cut(cues, 0.7, FREE).length, 1, cues.join(" / "));
        assert.equal(cut(cues, 1.5, FREE).length, 2, "a 1.5 s silence is a real break");
        assert.equal(cut(cues, 0.7, {}).length, 2, "paid voices keep their per-group cut");
    }
    // at a clause boundary the pause is still followed
    assert.equal(cut(["Tôi dùng ChatGPT", "để phân tích dữ liệu."], 0.7, FREE).length, 2);
    assert.equal(cut(["Tôi dùng ChatGPT", "để phân tích dữ liệu."], 0.1, FREE).length, 1);
});

// ---- cache identities ----
test("cache identity: the paid voice's key is the 1.7.9 key (nothing here reaches it); the free voice's key follows what it says and how the text is paused", async () => {
    const E = require("../dub-engine.js");
    const g = E.createGeminiProvider({ sendMessage: async () => ({}) }, { geminiVoice: "Kore" });
    const key = t => g.audioKey({ text: PLAN.adaptForSpeech(t), speaker: "S1", intent: "neutral", emphasisWords: [], sps: 4.5 });
    // computed with the 1.7.9 modules (git 0d04df4)
    assert.equal(await key("Tom Hanks đóng vai chính trong phim của Christopher Nolan."), "f1811f287aade6d67b18dcf472d6e60edcd87e0db8b9d6f7a9434851f59a109d");
    assert.equal(await key("Tôi dùng ChatGPT để phân tích dữ liệu trên Google Ads."), "596fde7e13ec5e77ee9d86c96741247650b90536ab8197515f97ed4354333d43");
    assert.equal(await key("Máy chủ gửi thư qua SMTPS, xung nhịp 3.5 GHz."), "fd975523cedcef6be3bb87da3497281d2eb548b341ad684fa48762f2031c87e1");
    // the free voice: same line, same key; a different pronunciation or pause analysis, a different key
    const v = E.createVieneuProvider({ sendMessage: async () => ({}) }, { localVoice: "Mỹ Duyên" });
    const plan = text => ({ id: "p", phrases: [{ text, breakKind: null, syl: 9 }], continuesNext: false, speaker: "S1", srcText: "" });
    const k1 = await v.audioKey(plan("Tom Hanks đóng vai chính"));
    assert.equal(k1, await v.audioKey(plan("Tom Hanks đóng vai chính")));
    assert.notEqual(k1, await v.audioKey(plan("Tom Hanks đóng vai phụ")));
    assert.equal(PROS.signature("Tom Hanks đóng vai chính."), PROS.signature("Tom Hanks đóng vai chính."));
    assert.notEqual(PROS.signature("Lợi nhuận tăng mạnh nhờ vào dữ liệu."), PROS.signature("Lợi nhuận tăng mạnh, nhờ vào dữ liệu."));
});

test("cache identity: the translation key has no input from speech or prosody", () => {
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "background.js"), "utf8");
    const body = src.slice(src.indexOf("async function unitCacheKey"), src.indexOf("const unitInFlight"));
    assert.ok(body.length > 100);
    assert.doesNotMatch(body, /SPEECH|PROSODY|speak|signature|PRONUNCIATION|LOCAL_STYLE/);
});

test("analysis stays well under a millisecond a line, and the token map reuses the memoised analyses", () => {
    const lines = [];
    for (let i = 0; i < 400; i++) lines.push(`Câu ${i}: Sam Altman nói ở San Francisco rằng doanh thu của công ty trong quý vừa qua đã tăng mạnh nhờ vào ChatGPT.`);
    let t = process.hrtime.bigint();
    for (const s of lines) { PROS.analyze(s); SPEECH.render(s); }
    const per = Number(process.hrtime.bigint() - t) / 1e6 / lines.length;
    assert.ok(per < 3, `${per.toFixed(2)} ms a line`);   // ~0.6 ms on 2026-09-27, generous for a loaded run
    t = process.hrtime.bigint();
    for (const s of lines.slice(-100)) PROS.tokenMap(s);
    const map = Number(process.hrtime.bigint() - t) / 1e6 / 100;
    assert.ok(map < 0.5, `${map.toFixed(3)} ms a map from memo`);
});

// ---- 1.8.2: respellings found by the local search (Ben, Kim, Leo), and the lines they must not cross ----
test("Ben, Kim and Leo inside an English name are said the English way; Vietnamese uses of the same words are not", () => {
    assert.equal(say("Đạo diễn Ben Affleck xác nhận sẽ quay phim."), "Đạo diễn <en>benn</en> Affleck xác nhận sẽ quay phim.");
    assert.equal(say("Ben Affleck xác nhận sẽ quay phim."), "<en>benn</en> Affleck xác nhận sẽ quay phim.");
    assert.equal(say("Bà Kim Kardashian đang rót tiền."), "Bà <en>kym</en> Kardashian đang rót tiền.");
    assert.equal(say("Kim Kardashian mở thêm một thương hiệu."), "<en>kym</en> Kardashian mở thêm một thương hiệu.");
    assert.equal(say("Nam diễn viên Leo DiCaprio đoạt giải."), "Nam diễn viên <en>lleo</en> <en>dicaprio</en> đoạt giải.");
    // a lone Ben is English only when the English source line names him; a lone Kim never (Vietnamese people carry it)
    assert.equal(say("Ben sẽ chỉ cho các bạn.", { source: "Ben is going to show you." }), "<en>benn</en> sẽ chỉ cho các bạn.");
    assert.equal(say("Ben sẽ chỉ cho các bạn."), "Ben sẽ chỉ cho các bạn.");
    assert.equal(say("Kim nói rằng bài chưa xong.", { source: "Kim said the talk is not done." }), "Kim nói rằng bài chưa xong.");
    for (const s of ["Chị Kim là trưởng nhóm.", "Kim Anh dạy tiếng Anh.", "Kim loại này rất nặng.", "Kim Nguyễn là giám đốc.",
        "Leo núi rất mệt.", "Tôi thích leo núi với bạn.", "Kim Google nói."]) assert.equal(say(s), s, s);
});

test("2.5.8: an all-caps brand shaped like a word is said as a word, never spelled (WHOOP)", () => {
    // VieNeu spelled these with Vietnamese letter names ("vê kép hát ô ô phê") or got English letters
    assert.equal(say("Tôi đeo WHOOP mỗi ngày.", { source: "I wear my WHOOP every day." }), "Tôi đeo <en>whoop</en> mỗi ngày.");
    assert.equal(say("Tôi đeo WHOOP mỗi ngày.", { source: "I wear my Whoop every day." }), "Tôi đeo <en>whoop</en> mỗi ngày.");
    assert.equal(say("Giày NIKE và đồ LEGO."), "Giày <en>nike</en> và đồ <en>lego</en>.");
    assert.equal(say("Tôi thích ADIDAS và SAMSUNG."), "Tôi thích <en>adidas</en> và <en>samsung</en>.");
    assert.equal(say("Dữ liệu WHOOP's rất chi tiết."), "Dữ liệu <en>whoop's</en> rất chi tiết.");
    // letter codes keep their letters; Vietnamese and translator-made codes stay Vietnamese
    assert.equal(say("Máy CPAP giúp ngủ."), "Máy <en>c p a p</en> giúp ngủ.");
    for (const s of ["Trang HTML này.", "Đại học UCLA.", "Thi THPTQG.", "ĐỪNG BAO GIỜ LÀM VẬY.", "Các DN nhỏ."]) assert.equal(say(s), s, s);
    assert.equal(say("Tôi thích ADIDAS.", { source: "I like those sneakers." }), "Tôi thích ADIDAS.");
});

test("2.5.8: AI and brand names VieNeu misreads get the reading checked on its phonemizer", () => {
    assert.equal(say("Dùng Qwen, Groq và xAI."), "Dùng <en>chuen</en>, <en>grock</en> và <en>x a i</en>.");
    assert.equal(say("Mở NotebookLM rồi gọi DALL-E."), "Mở <en>notebook l m</en> rồi gọi <en>dolly</en>.");
    assert.equal(say("Đeo Oura Ring hay đồng hồ Huawei."), "Đeo <en>ora ring</en> hay đồng hồ <en>wahway</en>.");
    // the ones it already reads well are left as they are
    for (const s of ["Dùng Garmin và Strava.", "Mô hình DeepSeek và Mistral."]) assert.equal(say(s), s, s);
});
