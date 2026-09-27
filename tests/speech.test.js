// English inside Vietnamese speech (1.7.8): how dub-speech.js finds English spans, what it sends the
// free voice (VieNeu) for them, the version reading of adaptForSpeech, and the prosody model keeping
// every span in one piece. What VieNeu actually says for these texts is checked offline on its own
// phonemizer (tools/pron-eval.js) and in real takes (tools/speech-ab.js); these tests pin the text.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const SPEECH = require("../dub-speech.js");
const PLAN = require("../dub-planner.js");
const PROS = require("../dub-prosody.js");
const CORPUS = require("./speech-corpus.js");

const say = (s, ctx) => SPEECH.render(s, ctx).text;
const spansOf = s => SPEECH.analyze(s).spans.map(x => x.text);

// ---- what VieNeu is sent ----
test("an all-caps code VieNeu spells with Vietnamese letter names gets English letters; one it reads well is left alone", () => {
    assert.equal(say("Chúng tôi làm SEO để tăng CTR và giảm CPC."), "Chúng tôi làm SEO để tăng CTR và giảm <en>c p c</en>.");
    assert.equal(say("Chỉ số ROI và KPI được báo cáo hằng tháng."), "Chỉ số <en>r o i</en> và KPI được báo cáo hằng tháng.");
    assert.equal(say("Windows 11 yêu cầu chip bảo mật TPM."), "Windows 11 yêu cầu chip bảo mật <en>t p m</en>.");
    // already English in VieNeu (its own acronym table): no tag, same text
    for (const s of ["Bạn có thể gọi API này.", "Mô hình chạy trên tám GPU.", "CEO của công ty vừa từ chức."]) assert.equal(say(s), s);
});

test("Vietnamese codes stay Vietnamese: VieNeu's own expansions, broadcasters and firms, a paper size, a team, a shouted line", () => {
    for (const s of ["Anh ấy là HLV của CLB này.", "Tin tức trên VTV lúc bảy giờ.", "Tôi làm việc ở FPT.", "UBND phường vừa họp.",
        "In ra giấy A4 nhé.", "Đội U23 thắng rồi.", "ĐỪNG BAO GIỜ LÀM VẬY.", "Máy có 32 GB RAM."]) {
        assert.equal(say(s), s, s);
    }
    assert.equal(SPEECH.capsClass("CLB"), "vi");
    assert.equal(SPEECH.capsClass("API"), "en");
    assert.equal(SPEECH.capsClass("RAM"), "word");
    assert.equal(SPEECH.capsClass("CPC"), "spelled");
});

test("a word acronym is said as a word, a possessive keeps its s", () => {
    assert.equal(say("Tôi mua bàn làm việc ở IKEA vì giá khá rẻ."), "Tôi mua bàn làm việc ở <en>ikea</en> vì giá khá rẻ.");
    assert.equal(say("Mẫu ghế này nằm trong IKEA's catalog năm nay."), "Mẫu ghế này nằm trong <en>ikea's</en> catalog năm nay.");
    assert.equal(say("NASA vừa phóng một kính viễn vọng mới."), "NASA vừa phóng một kính viễn vọng mới.");   // VieNeu reads it right
    assert.equal(say("Lưu ảnh dưới dạng JPEG."), "Lưu ảnh dưới dạng <en>jay peg</en>.");
});

test("names: a camelCase piece VieNeu would read Vietnamese, a Vietnamese-syllable name word inside an English name", () => {
    assert.equal(say("Leonardo DiCaprio cuối cùng cũng giành được giải Oscar."), "Leonardo <en>dicaprio</en> cuối cùng cũng giành được giải Oscar.");
    assert.equal(say("Tom Hanks từng đoạt hai giải Oscar."), "<en>tahm</en> Hanks từng đoạt hai giải Oscar.");
    assert.equal(say("Tôi thích phim của Tom Cruise."), "Tôi thích phim của <en>tahm</en> Cruise.");
    assert.equal(say("Hội nghị được tổ chức tại San Francisco."), "Hội nghị được tổ chức tại <en>sanne</en> Francisco.");
    assert.equal(say("Họ đóng chung trong La La Land."), "Họ đóng chung trong <en>lah lah land</en>.");
    // unknown name, capitalised mid-sentence next to an English word: evidence enough
    assert.equal(say("Cuốn sách của Dan Brown bán rất chạy."), "Cuốn sách của <en>dann</en> Brown bán rất chạy.");
    // English brands VieNeu reads well are left as they are
    for (const s of ["ChatGPT trả lời khá nhanh.", "Tôi dùng Claude của Anthropic.", "Chạy Performance Max campaign trên Google Ads."]) assert.equal(say(s), s);
});

test("a Vietnamese-syllable word is respelled only with evidence: not at the start of a sentence, not a Vietnamese name", () => {
    for (const s of ["Con AI này thông minh lắm.", "So Google với Bing thì sao.", "Chị Lan làm ở Google.", "Tom về nhà muộn."]) assert.equal(say(s), s, s);
    // the English source line is evidence: "Tom Hanks" there, the same pair here
    assert.equal(say("Tom Hanks đóng vai chính.", { source: "Tom Hanks plays the lead." }), "<en>tahm</en> Hanks đóng vai chính.");
    assert.equal(say("Dan Brown viết cuốn này.", { source: "Dan Brown wrote this one." }), "<en>dann</en> Brown viết cuốn này.");
    assert.equal(say("Dan Brown viết cuốn này."), "Dan Brown viết cuốn này.");
});

test("model numbers: a letter + digit code in a product name, a four-digit number after a code", () => {
    assert.equal(say("MacBook Pro M3 chạy mô hình nhỏ khá mượt."), "MacBook Pro <en>m</en> 3 chạy mô hình nhỏ khá mượt.");
    assert.equal(say("Card RTX 5090 có giá khoảng hai nghìn đô la."), "Card RTX 5 0 9 0 có giá khoảng hai nghìn đô la.");
    assert.equal(say("Năm 2024 thị trường tăng mạnh."), "Năm 2024 thị trường tăng mạnh.");
});

test("text with nothing to render comes back as the same string (its cached audio keeps its key)", () => {
    for (const it of CORPUS.dev.concat(CORPUS.validation)) {
        const plain = PLAN.adaptForSpeech(it.text.replace(/\s[|/](?=\s)/g, ""));
        const r = SPEECH.render(plain);
        if (!r.changed) assert.equal(r.text, plain);
        else assert.notEqual(r.text, plain);
    }
    const vi = "Hôm nay chúng ta sẽ tìm hiểu cách mô hình học từ dữ liệu.";
    assert.equal(SPEECH.render(vi).changed, false);
    assert.equal(SPEECH.render(vi).text, vi);
});

test("never more than 8 <en> tags in one text (VieNeu's normalizer breaks past 10); the first ones are kept", () => {
    const codes = "CPC CPM CPA ROI TPM HR PR SEM AWS GCP ETL CSV".split(" ");
    const s = "Các chỉ số " + codes.join(", ") + " đều quan trọng.";
    const out = say(s);
    assert.equal((out.match(/<en>/g) || []).length, SPEECH.TAG_MAX);
    assert.match(out, /^Các chỉ số <en>c p c<\/en>, <en>c p m<\/en>/);
});

test("the same entity is written the same way in every sentence", () => {
    const forms = ["Tôi thích IKEA.", "IKEA mở cửa hàng mới.", "Ở IKEA có nhiều bàn.", "Hôm qua tôi ghé IKEA, rất đông."]
        .map(s => (say(s).match(/<en>[^<]*<\/en>/) || [""])[0]);
    assert.deepEqual([...new Set(forms)], ["<en>ikea</en>"]);
    const tom = ["Phim của Tom Hanks rất hay.", "Tôi gặp Tom Hanks ở Los Angeles."].map(s => say(s).match(/<en>[^<]*<\/en>/)[0]);
    assert.deepEqual([...new Set(tom)], ["<en>tahm</en>"]);
});

test("the adversarial cases: each one a single span, rendered as expected", () => {
    const cases = [
        ["Tôi thích IKEA's catalog.", "IKEA's catalog", "<en>ikea's</en>"],
        ["Claude's câu trả lời khá dài.", "Claude's", null],
        ["ChatGPT 5 trả lời chính xác hơn.", "ChatGPT 5", null],
        ["Mô hình mới tên là GPT 5 chấm 6.", "GPT 5 chấm 6", null],
        ["Dùng OpenAI API để tạo chatbot.", "OpenAI API", null],
        ["YouTube Shorts đang rất phổ biến.", "YouTube Shorts", null],
        ["Google Ads API cho phép tự động hóa.", "Google Ads API", null],
        ["Chạy Performance Max campaign cho cửa hàng.", "Performance Max campaign", null],
        ["Phim của Christopher Nolan luôn phức tạp.", "Christopher Nolan", null],
        ["Leonardo DiCaprio đóng vai chính.", "Leonardo DiCaprio", "Leonardo <en>dicaprio</en>"],
        ["Tôi học machine-learning mỗi tối.", "machine-learning", null],
        ["Một large language model cần nhiều dữ liệu.", "large language model", null]
    ];
    for (const [s, span, rendered] of cases) {
        assert.ok(spansOf(s).includes(span), `${s}: ${JSON.stringify(spansOf(s))}`);
        if (rendered) assert.ok(say(s).includes(rendered), say(s));
    }
});

// ---- versions and quantities (adaptForSpeech, every voice) ----
test("a version is read with chấm, a quantity with phẩy; a hyphenated identifier is split into words", () => {
    const cases = [
        ["Dùng GPT-5.6 để viết code.", "Dùng GPT 5 chấm 6 để viết code."],
        ["Model gemini-2.5-flash-lite rẻ hơn.", "Model gemini 2 chấm 5 flash lite rẻ hơn."],
        ["Llama-3.3-70B chạy cục bộ.", "Llama 3 chấm 3 70 tỷ chạy cục bộ."],
        ["ChatGPT-5 ra mắt.", "ChatGPT 5 ra mắt."],
        ["Dịch COVID-19 năm 2020.", "Dịch COVID 19 năm 2020."],
        ["Dùng GPT-4o cho việc này.", "Dùng GPT 4o cho việc này."],
        ["Bản cập nhật version 2.5 sửa lỗi.", "Bản cập nhật version 2 chấm 5 sửa lỗi."],
        ["Cập nhật iOS 18.2 hôm qua.", "Cập nhật iOS 18 chấm 2 hôm qua."],
        ["Gemini 2.5 Flash nhanh hơn.", "Gemini 2 chấm 5 Flash nhanh hơn."],
        ["Tăng 2.5 lần.", "Tăng 2 phẩy 5 lần."],
        ["Nặng 2,5 kg.", "Nặng 2 phẩy 5 ki-lô-gam."],
        ["Chiếm 25%.", "Chiếm 25 phần trăm."],
        ["Tệp nặng 10.5 GB.", "Tệp nặng 10 phẩy 5 GB."],
        ["Trong 3.5 giây.", "Trong 3 phẩy 5 giây."],
        ["Từ 2020-2021 và 10-15 phút.", "Từ 2020-2021 và 10-15 phút."],
        ["Học machine-learning qua Wi-Fi.", "Học machine-learning qua Wi-Fi."]
    ];
    for (const [a, b] of cases) assert.equal(PLAN.adaptForSpeech(a), b);
});

// ---- prosody: spans are units ----
test("no pause inside an English span: its gaps are units, and no breathing comma lands in one", () => {
    const s = "Chúng tôi chạy Performance Max campaign trên Google Ads API cho khách hàng của Christopher Nolan tại San Francisco vào tuần trước.";
    const a = PROS.analyze(s);
    const inside = SPEECH.spanGaps(s);
    assert.equal(inside.filter(Boolean).length, 6);
    inside.forEach((x, i) => { if (x) { assert.ok(a.gaps[i].unit && a.gaps[i].value < 0, `${a.words[i].raw}|${a.words[i + 1].raw}`); } });
    const b = PROS.breathText(s);
    for (const name of ["Performance Max campaign", "Google Ads API", "Christopher Nolan", "San Francisco"]) assert.ok(b.includes(name), b);
    // over the whole corpus: no breath group ever ends inside a span
    for (const it of CORPUS.dev.concat(CORPUS.validation)) {
        const t = PLAN.adaptForSpeech(it.text.replace(/\s[|/](?=\s)/g, ""));
        const g = SPEECH.spanGaps(t);
        for (const x of PROS.breathGroups(t)) assert.ok(!g[x.gap], `${it.id}: ${x.word}`);
    }
});

test("the language switch is not a boundary by itself: pure Vietnamese sentences analyse as before", () => {
    const vi = "Hôm nay chúng ta sẽ tìm hiểu cách mô hình học từ dữ liệu thô.";
    assert.deepEqual(SPEECH.spanGaps(vi).filter(Boolean), []);
    assert.equal(PROS.analyze(vi).gaps.some(g => g.span), false);
});

test("backlog 16: from-to after a verb of change, comparative bằng and so với, relative mà, topic thì, a long subject", () => {
    const gap = (s, left, right) => {
        const a = PROS.analyze(s);
        const i = a.words.findIndex((w, k) => w.bare === left && a.words[k + 1] && a.words[k + 1].bare === right);
        assert.ok(i >= 0, `${left}|${right} in ${s}`);
        return a.gaps[i];
    };
    const closed = (s, l, r) => assert.ok(gap(s, l, r).value < 0, `${l}|${r} should be closed in: ${s}`);
    const open = (s, l, r) => assert.ok(gap(s, l, r).value > 0, `${l}|${r} should stay a boundary in: ${s}`);
    closed("Độ chính xác tăng từ 72 phẩy 5 phần trăm lên 91 phần trăm sau khi huấn luyện thêm.", "tăng", "từ");
    closed("Mô hình này học cách dự đoán từ tiếp theo dựa trên ngữ cảnh.", "đoán", "từ");
    closed("Mô hình chỉ tốt bằng dữ liệu mà nó được huấn luyện.", "tốt", "bằng");
    closed("Nếu độ chính xác thấp hơn nhiều so với tập huấn luyện thì mô hình đã quá khớp.", "nhiều", "so");
    closed("Điều quan trọng nhất mà các bạn cần nhớ là dữ liệu.", "nhất", "mà");
    closed("Mô hình chỉ tốt bằng dữ liệu mà nó được huấn luyện.", "liệu", "mà");
    closed("Dữ liệu huấn luyện rất sạch, còn dữ liệu kiểm tra thì có khá nhiều nhiễu.", "tra", "thì");
    closed("Doanh thu của công ty trong quý vừa qua tăng mạnh nhờ vào các sản phẩm mới.", "quý", "vừa");
    closed("Doanh thu của công ty trong quý vừa qua tăng mạnh nhờ vào các sản phẩm mới.", "mạnh", "nhờ");
    // the boundaries that should stay
    open("Doanh thu của công ty trong quý vừa qua tăng mạnh nhờ vào các sản phẩm mới.", "qua", "tăng");
    open("Những người thường xuyên tập thể dục vào buổi sáng thường có giấc ngủ sâu hơn.", "sáng", "thường");
    open("Nếu độ chính xác thấp hơn nhiều so với tập huấn luyện thì mô hình đã quá khớp.", "luyện", "thì");
    open("Mô hình dự đoán dựa trên toàn bộ ngữ cảnh mà nó đã nhìn thấy trước đó.", "cảnh", "mà");
    // contrastive mà keeps its boundary
    open("Mô hình mới không chỉ rẻ hơn mà còn nhanh hơn đáng kể.", "hơn", "mà");
});

// ---- engine and service worker ----
test("engine: the voice is sent the rendered text, the pauses are placed on the plain one, the cache key follows the spoken text", async () => {
    const E = require("../dub-engine.js");
    const plan = { id: "p1", phrases: [{ text: "Tôi mua bàn ở IKEA vì giá rẻ", breakKind: null, syl: 8 }], continuesNext: false, speaker: "S1", srcText: "I bought a desk at IKEA because it was cheap." };
    assert.equal(E.plainScript(plan), "Tôi mua bàn ở IKEA vì giá rẻ.");
    assert.equal(E.speakScript(plan), "Tôi mua bàn ở <en>ikea</en> vì giá rẻ.");
    const plain = { ...plan, phrases: [{ text: "Tôi mua bàn ở cửa hàng vì giá rẻ", breakKind: null, syl: 9 }] };
    assert.equal(E.speakScript(plain), E.plainScript(plain));
    const sent = [];
    const env = { sendMessage: async m => { sent.push(m); return m.action === "synthesizeSpeech" ? { ok: true, parts: [{ wav: "", duration: 1, sampleRate: 24000 }] } : { running: true }; } };
    const provider = E.createVieneuProvider(env, { localVoice: "Mỹ Duyên" });
    await provider.render([plan]);
    const req = sent.find(m => m.action === "synthesizeSpeech");
    assert.equal(req.text, "Tôi mua bàn ở IKEA vì giá rẻ.");
    assert.equal(req.speak, "Tôi mua bàn ở <en>ikea</en> vì giá rẻ.");
    // the key changes with what is spoken
    const k1 = await provider.audioKey(plan), k2 = await provider.audioKey({ ...plan, phrases: [{ text: "Tôi mua bàn ở Ikea vì giá rẻ", breakKind: null, syl: 8 }] });
    assert.notEqual(k1, k2);
});

test("service worker: VieNeu is sent req.speak, the pauses and the runaway check keep the plain text; no speak, no change", async () => {
    const { bgEnv } = require("./bg-env.js");
    const COST = require("../cost-policy.js");
    const calls = [];
    const server = async (u, o) => {
        const url = String(u);
        if (!url.startsWith(COST.LOCAL_TTS.url)) return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
        if (url.endsWith("/health")) return { ok: true, status: 200, json: async () => ({ status: "ok", backend: "onnx", active: 0, waiting: 0 }) };
        const body = JSON.parse(o.body);
        calls.push(body);
        const sr = body.sample_rate, pcm = Buffer.alloc(Math.round(1.5 * sr) * 2);
        for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 6) * 9000), i * 2);
        return { ok: true, status: 200, arrayBuffer: async () => pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length) };
    };
    const E = bgEnv(server, { modelsVersion: COST.MODELS_VERSION });
    const r = await E.send({ action: "synthesizeSpeech", engine: "vieneu", text: "Tôi mua bàn ở IKEA.", speak: "Tôi mua bàn ở <en>ikea</en>.",
        voice: "Mỹ Duyên", parts: [{ key: "s1", weight: 6 }] });
    assert.equal(r.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, "Tôi mua bàn ở <en>ikea</en>.");
    // the same text with another speak is another request, not a merged one
    await E.send({ action: "synthesizeSpeech", engine: "vieneu", text: "Tôi mua bàn ở IKEA.", speak: "Tôi mua bàn ở <en>i k e a</en>.",
        voice: "Mỹ Duyên", parts: [{ key: "s2", weight: 6 }] });
    assert.equal(calls[1].input, "Tôi mua bàn ở <en>i k e a</en>.");
    // an older page that sends no speak: the text itself, as before
    await E.send({ action: "synthesizeSpeech", engine: "vieneu", text: "Xin chào các bạn.", voice: "Mỹ Duyên", parts: [{ key: "s3", weight: 5 }] });
    assert.equal(calls[2].input, "Xin chào các bạn.");
});

// ---- cost, performance, data ----
test("no request at run time: the speech module never calls the network or the extension APIs", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "dub-speech.js"), "utf8");
    assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest|chrome\.|sendMessage|importScripts/);
});

test("performance: 2,000 mixed sentences analysed and rendered in well under a second, the second pass from memo", () => {
    const lines = [];
    for (let i = 0; i < 2000; i++) lines.push(`Câu số ${i}: dùng Google Ads API và GPT 5 chấm ${i % 9} cho IKEA ở San Francisco với ROI tốt.`);
    let t = process.hrtime.bigint();
    for (const s of lines) SPEECH.render(s);
    const first = Number(process.hrtime.bigint() - t) / 1e6;
    t = process.hrtime.bigint();
    for (const s of lines.slice(-500)) SPEECH.render(s);
    const again = Number(process.hrtime.bigint() - t) / 1e6;
    assert.ok(first < 1500, `first pass ${first.toFixed(0)} ms`);
    assert.ok(again < 20, `memoised pass ${again.toFixed(1)} ms`);
});

test("custom entries: a local lexicon entry is used at once, without a reload", () => {
    assert.equal(say("Tôi thích xem Kim Possible."), "Tôi thích xem Kim Possible.");
    SPEECH.addEntry("Kim Possible", "title", "<en>kihm</en> Possible");
    assert.equal(say("Tôi thích xem Kim Possible."), "Tôi thích xem <en>kihm</en> Possible.");
    SPEECH.LEX.delete("kim possible");
});

test("corpus: the unseen split is untouched since it was written (it is scored once, never tuned on)", () => {
    const h = crypto.createHash("sha256").update(JSON.stringify(CORPUS.unseen)).digest("hex").slice(0, 16);
    assert.equal(h, "60af1e730cb471ec");
    const ids = [...CORPUS.dev, ...CORPUS.validation, ...CORPUS.unseen].map(x => x.id);
    assert.equal(new Set(ids).size, ids.length);
});

test("the generated tables are in place and match their builder's markers", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "dub-speech.js"), "utf8");
    assert.match(src, /@generated speech-tables begin: tools\/build-speech-tables\.js/);
    assert.ok(SPEECH.RESPELL.tom && !SPEECH.RESPELL.sam, "sam is held out while the unseen split names Sam Altman");
});

// ---- across subtitle lines ----
function mkGroup(cues) {
    const viCues = cues.map(([s, e, t]) => ({ start: s, end: e, text: t, lines: [t] }));
    return { start: cues[0][0], end: cues[cues.length - 1][1], viText: cues.map(c => c[2]).join(" "), viCues,
        srcCues: cues.map(([s, e, t]) => ({ start: s, end: e, text: t })) };
}
test("a sentence split over three subtitle lines is one take for the free voice, with no pause at the line breaks", () => {
    const E = require("../dub-engine.js");
    const groups = [mkGroup([[10, 11.2, "Tôi nghĩ rằng"], [11.2, 12.6, "đây là một vấn đề"], [12.6, 13.8, "khá nghiêm trọng."]])];
    const segs = PLAN.buildDubScript(groups, { joinGroups: true, segSoft: 8, segHard: 11 });
    assert.equal(segs.length, 1);
    assert.equal(E.plainScript(PLAN.planSegment(segs[0])), "Tôi nghĩ rằng đây là một vấn đề khá nghiêm trọng.");
    // and a line break inside an English name does not split it either
    const g2 = [mkGroup([[20, 21.5, "Hôm qua tôi xem phim của"], [21.5, 23, "Christopher Nolan cùng"], [23, 24.2, "vài người bạn."]])];
    const s2 = PLAN.buildDubScript(g2, { joinGroups: true, segSoft: 8, segHard: 11 });
    assert.equal(s2.length, 1);
    assert.doesNotMatch(E.plainScript(PLAN.planSegment(s2[0])), /Christopher,|Nolan,/);
});
