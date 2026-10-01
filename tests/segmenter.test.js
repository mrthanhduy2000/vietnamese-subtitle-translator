// Kiểm thử bộ phân đoạn & ngắt dòng tiếng Việt.
// Chạy: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const seg = require("../vi-segmenter.js");
const cases = require("./fixtures");
const { evaluate, greedyWrap } = require("./quality");
const legacy = require("./legacy/old-splitter.js");

function show(cues) {
    return cues.map(c => `[${c.start}-${c.end}] ${c.lines.join(" / ")}`).join("\n");
}

// ---------- 1. Hồi quy trên bộ ca thực tế ----------
for (const tc of cases) {
    test(`[${tc.group}] ${tc.name}`, () => {
        const out = seg.segmentGroupSafe(tc.vi, tc.src);
        const issues = evaluate(tc, out);
        assert.deepEqual(issues, [], `\n${show(out)}\n${issues.map(i => i.type + ": " + i.detail).join("\n")}`);
        const v = seg.validateSegments(tc.vi, out);
        assert.ok(v.ok, JSON.stringify(v));
        // Cue nằm trong khung thời gian của nhóm nguồn
        const start = Math.min(...tc.src.map(c => c.start));
        const end = Math.max(...tc.src.map(c => c.end));
        assert.ok(out[0].start >= start - 1e-6, "cue đầu bắt đầu trước nhóm");
        assert.ok(out[out.length - 1].end <= end + 1e-6, "cue cuối vượt quá nhóm");
    });
}

test("thuật toán mới ít vi phạm hơn hẳn thuật toán cũ", () => {
    let oldIssues = 0, newIssues = 0;
    for (const tc of cases) {
        const parts = legacy.distributeTranslation(tc.vi, tc.src.map(c => c.text));
        const oldCues = parts.map((p, i) => ({ start: tc.src[i].start, end: tc.src[i].end, text: p, lines: greedyWrap(p) })).filter(c => c.text);
        oldIssues += evaluate(tc, oldCues).length;
        newIssues += evaluate(tc, seg.segmentGroupSafe(tc.vi, tc.src)).length;
    }
    assert.ok(oldIssues >= 10, `bộ ca phải đủ khó để bắt lỗi thuật toán cũ (cũ: ${oldIssues})`);
    assert.equal(newIssues, 0);
});

// ---------- 2. Lỗi [[__T0__]] lọt ra màn hình ----------
test("cleanText xóa mã giữ chỗ bị sót (lỗi trong ảnh chụp)", () => {
    assert.equal(seg.cleanText("[[__T0__]]Nhưng với cá nhân tôi,"), "Nhưng với cá nhân tôi,");
    assert.equal(seg.cleanText("Dùng [[ __T12__ ]] để huấn luyện"), "Dùng để huấn luyện");
    assert.equal(seg.cleanText("[[\\_\\_T0\\_\\_]] rất mạnh"), "rất mạnh", "dạng bị escape markdown");
    assert.equal(seg.cleanText("__T3__ là thư viện"), "là thư viện");
    assert.equal(seg.cleanText("ZQ1QZ hoạt động"), "hoạt động");
});

test("cleanText bỏ ngoặc kép bao ngoài, markdown, dấu gợi ý và khoảng trắng trước dấu câu", () => {
    assert.equal(seg.cleanText("\"Xin chào các bạn.\""), "Xin chào các bạn.");
    assert.equal(seg.cleanText("“Xin chào.”"), "Xin chào.");
    assert.equal(seg.cleanText("Anh ấy nói \"xin chào\" rồi đi."), "Anh ấy nói \"xin chào\" rồi đi.");
    assert.equal(seg.cleanText("**Quan trọng** nhất"), "Quan trọng nhất");
    assert.equal(seg.cleanText("Bản dịch: Xin chào"), "Xin chào");
    assert.equal(seg.cleanText("Nếu tốc độ học quá lớn ¦ thuật toán ¦ có thể lỗi"), "Nếu tốc độ học quá lớn thuật toán có thể lỗi");
    assert.equal(seg.cleanText("Xin chào , bạn !"), "Xin chào, bạn!");
});

test("segmentGroup không bao giờ hiển thị mã giữ chỗ hay dấu gợi ý", () => {
    const src = [{ start: 0, end: 3, text: "But personally, I prefer consistency." }];
    const out = seg.segmentGroupSafe("[[__T0__]]Nhưng với cá nhân tôi, ¦ tôi thích sự nhất quán.", src);
    const all = out.map(c => c.lines.join("\n")).join("\n");
    assert.ok(!/T0|\[\[|¦/.test(all), all);
});

// ---------- 3. Ngắt dòng (bài toán B) ----------
test("ngắt dòng: câu vừa 1 dòng thì giữ 1 dòng", () => {
    assert.deepEqual(seg.breakLines("Điều đó có hợp lý không?"), ["Điều đó có hợp lý không?"]);
});

test("ngắt dòng: ưu tiên dấu phẩy, chấp nhận 40/60 thay vì ép 50/50", () => {
    assert.deepEqual(
        seg.breakLines("Nhưng với cá nhân tôi, điều quan trọng nhất là sự nhất quán."),
        ["Nhưng với cá nhân tôi,", "điều quan trọng nhất là sự nhất quán."]
    );
});

test("ngắt dòng: không để giới từ/lượng từ/trợ động từ treo cuối dòng", () => {
    const cases2 = [
        "Chúng ta sẽ tìm hiểu cách hoạt động của các mô hình ngôn ngữ lớn hiện nay.",
        "Mô hình này học được các mẫu phức tạp trong dữ liệu mà không cần gán nhãn thủ công.",
        "Bạn cần đảm bảo rằng dữ liệu đã được chuẩn hóa trước khi huấn luyện."
    ];
    const bad = new Set(["của", "các", "những", "hãy", "cùng", "rằng", "đã", "được", "trước", "khi", "và", "sẽ", "cần"]);
    for (const text of cases2) {
        const lines = seg.breakLines(text);
        assert.equal(lines.length, 2, lines.join(" / "));
        const last = lines[0].split(" ").pop().toLowerCase();
        assert.ok(!bad.has(last), `"${lines.join(" / ")}" treo từ "${last}"`);
        assert.ok(lines.every(l => l.length <= 45), lines.join(" / "));
    }
});

test("câu quá dài cho 2 dòng: bộ phân đoạn tách cue thay vì treo từ", () => {
    const vi = "Hôm nay chúng ta hãy cùng xem xét những ưu điểm và nhược điểm của phương pháp này.";
    const src = [{ start: 0, end: 2.4, text: "Today let's look at" }, { start: 2.4, end: 5.6, text: "the pros and cons of this approach." }];
    const tc = { vi, forbid: ["hãy|cùng", "cùng|xem", "xem|xét", "ưu|điểm", "nhược|điểm", "phương|pháp"], noLineEnd: ["những", "của", "và", "hãy"] };
    const out = seg.segmentGroupSafe(vi, src);
    assert.deepEqual(evaluate(tc, out), [], show(out));
});

test("ngắt dòng: giữ nguyên thuật ngữ nhiều âm tiết và tên riêng", () => {
    const lines = seg.breakLines("Trong bài này, chúng ta sẽ triển khai một mạng nơ-ron tích chập bằng PyTorch Lightning.");
    const joined = lines.join(" | ");
    assert.ok(!/tích \| chập|nơ-ron \| tích|mạng \| nơ-ron|PyTorch \| Lightning/.test(joined), joined);
});

test("ngắt dòng: không tách số khỏi đơn vị hay danh từ đếm", () => {
    for (const text of [
        "Mô hình lớn nhất hiện nay có khoảng 1,8 nghìn tỷ tham số và cần hàng nghìn GPU.",
        "Trong năm 2024, doanh thu của công ty đã tăng thêm 35 phần trăm so với năm trước."
    ]) {
        const j = seg.breakLines(text).join(" | ");
        assert.ok(!/\d \| |nghìn \| tỷ|tỷ \| tham|năm \| 2024|phần \| trăm/.test(j), j);
    }
});

test("ngắt dòng: tiểu từ cuối câu và từ chỉ định không bị đẩy xuống đầu dòng", () => {
    const j = seg.breakLines("Được rồi, bây giờ chúng ta sẽ cùng nhau chạy thử đoạn mã này nhé.").join(" | ");
    assert.ok(!/\| (này|nhé)/.test(j), j);
});

test("ngắt dòng: khung hẹp thì chia nhiều dòng theo cú pháp thay vì tràn", () => {
    const lines = seg.breakLines("Nếu tốc độ học quá lớn, thuật toán có thể vượt quá điểm cực tiểu và không hội tụ.", { maxLineChars: 26, maxLines: 4 });
    assert.ok(lines.length >= 3, lines.join(" / "));
    assert.ok(lines.every(l => l.length <= 29), lines.join(" / "));
    assert.ok(!/vượt \| quá|cực \| tiểu|tốc \| độ/.test(lines.join(" | ")));
});

test("hồi quy: khung hẹp không treo 'có thể', âm tiết cuối từ ghép ('vượt quá') được đứng cuối dòng", () => {
    // Lỗi phát hiện khi kiểm tra trên trình duyệt: chữ 200% trong khung nhỏ cho ra
    // "thuật toán / gradient descent có thể / vượt quá điểm cực tiểu."
    const lines = seg.breakLines("thuật toán gradient descent có thể vượt quá điểm cực tiểu.", { maxLineChars: 24, maxLines: 4 });
    assert.ok(!lines.some(l => /có thể$/.test(l)), lines.join(" / "));
    assert.ok(!/vượt \| quá|gradient \| descent|cực \| tiểu/.test(lines.join(" | ")), lines.join(" / "));
});

test("hồi quy: 'quan trọng nhất là' không bị hiểu nhầm thành liên từ 'nhất là'", () => {
    // Lỗi phát hiện ở khung xem trước trên màn hình hẹp: "điều quan trọng / nhất là sự nhất quán."
    const lines = seg.breakLines("Nhưng với cá nhân tôi, điều quan trọng nhất là sự nhất quán.", { maxLineChars: 24, maxLines: 4 });
    assert.ok(!/trọng \| nhất/.test(lines.join(" | ")), lines.join(" / "));
});

// ---------- 4. Gợi ý ngắt nghỉ từ AI (lai giữa AI và thuật toán tất định) ----------
test("gợi ý ¦ từ Gemini được dùng như tín hiệu phụ, không phá quy tắc cú pháp", () => {
    // Gợi ý hợp lý (ranh giới cụm giới từ) được tôn trọng
    const good = seg.breakLines("Mô hình này học được các mẫu phức tạp ¦ trong dữ liệu mà không cần gán nhãn thủ công.");
    assert.equal(good[1].split(" ")[0], "trong", good.join(" / "));
    // Gợi ý sai (giữa từ ghép / sau giới từ) không đủ sức phá cú pháp
    for (const bad of [
        "Mô hình này học được các mẫu phức ¦ tạp trong dữ liệu mà không cần gán nhãn thủ công.",
        "Mô hình này học được các mẫu phức tạp trong ¦ dữ liệu mà không cần gán nhãn thủ công.",
        "Chúng ta cần chuẩn hóa dữ liệu đầu vào để mô hình hội ¦ tụ nhanh hơn trong quá trình huấn luyện."
    ]) {
        const lines = seg.breakLines(bad);
        assert.ok(!/(phức|trong|hội)$/.test(lines[0]), lines.join(" / "));
    }
});

// ---------- 5. Phân đoạn cue & thời gian (bài toán A) ----------
test("tiếng Việt không bị ép theo số cue tiếng Anh", () => {
    // 4 cue tiếng Anh ngắn nhưng câu tiếng Việt vừa 1 cue 2 dòng
    const src = [
        { start: 0, end: 1.0, text: "So," }, { start: 1.0, end: 2.0, text: "what we're" },
        { start: 2.0, end: 3.2, text: "going to do" }, { start: 3.2, end: 4.6, text: "is build a classifier." }
    ];
    const out = seg.segmentGroupSafe("Vậy việc chúng ta sẽ làm là xây dựng một bộ phân loại.", src);
    assert.equal(out.length, 1, show(out));
});

test("một cue tiếng Anh dài có thể thành nhiều cue tiếng Việt, đúng khung thời gian", () => {
    const src = [{ start: 10, end: 18, text: "In this module we will cover data preprocessing, feature engineering, model selection and hyperparameter tuning in detail." }];
    const vi = "Trong học phần này, chúng ta sẽ tìm hiểu chi tiết về tiền xử lý dữ liệu, kỹ thuật đặc trưng, lựa chọn mô hình và tinh chỉnh siêu tham số.";
    const out = seg.segmentGroupSafe(vi, src);
    assert.ok(out.length >= 2, show(out));
    assert.ok(out[0].start >= 10 && out[out.length - 1].end <= 18, show(out));
    const j = out.map(c => c.lines.join(" | ")).join(" ‖ ");
    assert.ok(!/tiền \| xử|siêu \| tham|kỹ thuật \| đặc|lựa \| chọn/.test(j.replace(/ ‖ /g, " | ")), j);
});

test("thời gian: không chồng lấn, không cue quá ngắn khi còn chỗ, bám ranh giới lời nói", () => {
    const tc = cases.find(c => c.group === "long");
    const out = seg.segmentGroupSafe(tc.vi, tc.src);
    const englishBounds = tc.src.map(c => c.end);
    for (let i = 0; i < out.length; i++) {
        assert.ok(out[i].end - out[i].start >= 0.99, `cue ${i} ngắn: ${show(out)}`);
        if (i > 0) assert.ok(out[i].start >= out[i - 1].end);
    }
    // Ít nhất một nửa điểm cắt trùng ranh giới cue tiếng Anh (nhịp nói tự nhiên)
    const snapped = out.slice(0, -1).filter(c => englishBounds.some(b => Math.abs(b - c.end) < 0.01)).length;
    assert.ok(snapped >= Math.ceil((out.length - 1) / 2), show(out));
});

test("thời gian: dùng được thời gian từng từ của phụ đề tự động", () => {
    const tl = seg.buildTimeline([{ start: 0, end: 4, text: "one two three four", words: [
        { t: 0, text: "one" }, { t: 0.5, text: "two" }, { t: 3.0, text: "three" }, { t: 3.5, text: "four" }] }]);
    // "three" bắt đầu ở ký tự 8/18: tuyến tính thuần sẽ cho ~1,8 giây, có thời gian từ phải là 3,0
    assert.ok(Math.abs(tl.timeAt(8 / 18) - 3.0) < 0.05, String(tl.timeAt(8 / 18)));
});

test("thời gian: câu cuối dày chữ được kéo dài vào khoảng lặng phía sau (maxEnd)", () => {
    const src = [{ start: 0, end: 1.2, text: "Got it?" }];
    const out = seg.segmentGroupSafe("Các bạn đã hiểu cách hoạt động của nó chưa?", src, { maxEnd: 4 });
    assert.ok(out[out.length - 1].end > 1.2 && out[out.length - 1].end <= 4, show(out));
});

// ---------- 6. Tính toàn vẹn trên dữ liệu ngẫu nhiên ----------
test("toàn vẹn: 300 nhóm ngẫu nhiên không mất/trùng chữ, không chồng thời gian", () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const sentences = cases.map(c => c.vi);
    for (let k = 0; k < 300; k++) {
        const count = 1 + Math.floor(rnd() * 3);
        const vi = Array.from({ length: count }, () => sentences[Math.floor(rnd() * sentences.length)]).join(" ");
        const nSrc = 1 + Math.floor(rnd() * 6);
        const src = [];
        let t = rnd() * 100;
        for (let i = 0; i < nSrc; i++) {
            const d = 0.4 + rnd() * 3;
            src.push({ start: t, end: t + d, text: "word ".repeat(2 + Math.floor(rnd() * 8)).trim() });
            t += d + (rnd() < 0.3 ? rnd() * 1.5 : 0);
        }
        const out = seg.segmentGroupSafe(vi, src);
        const v = seg.validateSegments(vi, out);
        assert.ok(v.ok, `${JSON.stringify(v)}\n${vi}`);
        for (const c of out) {
            assert.ok(c.lines.length <= 3, c.lines.join(" / "));
            for (const l of c.lines) assert.ok(l.length <= 60, l);
        }
    }
});

test("hiệu năng: nhóm 400 ký tự phân đoạn dưới 60ms", () => {
    const tc = cases.find(c => c.group === "long");
    const vi = tc.vi + " " + cases[2].vi + " " + cases[9].vi;
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 5; i++) seg.segmentGroupSafe(vi, tc.src);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 5;
    assert.ok(ms < 60, `${ms.toFixed(1)}ms`);
});

// ---- Real data from two cached YouTube videos (2026-09-23) ----
// A cue that starts a new sentence and stops before it ends makes the reader hold two thoughts at
// once. On 347 real cues 38 did it; the straddle cost brings that to 7.
test("cues end with the sentence they start (real lecture, source with punctuation)", () => {
    const vi = "Điều thứ ba là sự đánh đổi. Mỗi khi bạn đồng ý với một việc, nghĩa là bạn đang từ chối một việc khác, và điều đó hoàn toàn ổn. Cố gắng làm mọi thứ chỉ khiến chúng ta rốt cuộc chẳng làm tốt được việc gì.";
    const src = [{"start":108.08,"end":113.04,"text":"And the third: Trade-off. Every yes is a no to something else. And that’s"},{"start":113.04,"end":117.12,"text":"okay. By trying to do everything, we end up doing nothing well."}];
    const cues = seg.segmentGroupSafe(vi, src, { maxEnd: 118.6 });
    const straddles = cues.filter(c => /[.?!…]\s+\p{Lu}/u.test(c.text) && !/[.?!…]$/.test(c.text.trim()));
    assert.deepEqual(straddles.map(c => c.text), [], cues.map(c => c.lines.join(" / ")).join(" || "));
    assert.equal(cues.map(c => c.text).join(" "), vi, "no word may be lost or added");
    // and the compounds this exposed stay whole
    for (const w of ["tủ đồ", "trào lưu", "bày biện", "bất cứ lúc nào"]) {
        const lines = seg.breakLines("Mục tiêu của tôi là xây dựng một " + w + " thật gọn gàng mà vẫn đủ dùng hằng ngày", { maxLineChars: 30 });
        assert.ok(lines.some(l => l.includes(w)), w + " was split: " + lines.join(" / "));
    }
});

// One group came back with the next two groups translated into it (they were only context). The
// subtitle showed those sentences twice and the voice read them twice, at 36 to 51 chars per second.
test("a translation that leaked the next units is trimmed, and a clean one is left alone", () => {
    const Q = require("../vi-quality.js");
    const [g26, g27, g28, g29] = ["[Nhạc] Không biết các bạn có biết không, nhưng trước khi làm YouTube, tôi từng là chuyên viên tư vấn tài chính. Khi xem xét tình hình tài chính của mọi người, tôi không thể tin được có bao nhiêu người chỉ sống dựa vào thẻ tín dụng. Tôi hiểu rằng đôi khi việc này là cần thiết để giúp bạn tiến xa hơn trong cuộc sống, nhưng đó thực sự là một con dốc trơn trượt và cũng không","bền vững về lâu dài. Văn hóa dùng thẻ tín dụng không phổ biến ở châu Á và tôi lớn lên với tư duy rằng mình phải trả hết mọi khoản nợ vì đó là điều cha tôi luôn khắc ghi trong đầu. Tôi dùng thẻ tín dụng vì có thể tích điểm khách sạn, điểm chuyến bay và nhiều ưu đãi khác. Chúng tôi có một khoản vay thế chấp, nhưng số tiền trả hàng tháng cũng tương đương với tiền thuê nhà trước đây. Ngoài khoản đó ra, chúng tôi không còn bất kỳ khoản nợ nào khác, đặc biệt là nợ do chi tiêu quá mức cho những thứ nằm ngoài khả năng chi trả. Như tôi đã nói, vấn đề không nằm ở vài đô la tiết kiệm được nhờ lối sống này, mà là sự tự do để đưa ra...","nhưng số tiền đó cũng gần bằng với tiền thuê nhà chúng tôi từng trả. Ngoài ra, chúng tôi không còn bất kỳ khoản nợ nào khác, nhất là những khoản nợ do chi tiêu quá mức cho những thứ nằm ngoài khả năng chi trả.","Như tôi đã nói, vấn đề không nằm ở vài đô la tiết kiệm được nhờ lối sống này, mà là sự tự do để đưa ra những quyết định ý nghĩa khi cơ hội đến, bởi chúng tôi đã tích lũy được một khoản tiết kiệm và thực sự có khả năng đầu tư."];
    const cut = Q.trimContextLeak(g27, g28 + " " + g29);
    assert.ok(cut.length < g27.length - 200, "the leaked sentences are still there");
    assert.ok(!/Như tôi đã nói/.test(cut) && !/bất kỳ khoản nợ nào khác/.test(cut), cut);
    assert.ok(/Chúng tôi có một khoản vay thế chấp/.test(cut), "cut into the unit's own content (And we have a mortgage)");
    assert.ok(g27.startsWith(cut));
    // no false alarm on the neighbours, which are clean
    assert.equal(Q.trimContextLeak(g26, g27 + " " + g28), g26);
    assert.equal(Q.trimContextLeak(g28, g29), g28);
    // a unit that merely shares a few common words with the next one is not touched
    const own = "Hôm nay chúng ta học về mạng nơ-ron, một chủ đề thú vị.";
    assert.equal(Q.trimContextLeak(own, "Mạng nơ-ron gồm nhiều lớp, và chúng ta sẽ học từng lớp."), own);
});

// The user's 2026-10-01 batch: a speaker who says a thing twice, or in two parallel clauses, made the
// unit's own clause look like the next units, and 9 lines lost it ("Bạn phải nhớ rằng"). The cached
// lines are the cut ones; each case here is that line with its clause back, against the real
// neighbours. Without the source each one is still cut, as before; with it, none is.
const PARALLEL = [
    ["One of the envelopes had things in it that said, \"By 5pm today, spend this money on yourself.\"",
        "Một loại phong bì có ghi dòng chữ: \"Trước 5 giờ chiều nay, hãy dùng số tiền này cho bản thân.\"",
        "Chúng tôi còn gợi ý một vài món đồ họ có thể mua. Những người khác nhận được mảnh giấy ghi: \"Trước 5 giờ chiều nay, hãy dùng số tiền này cho người khác.\""],
    ["That is, in order to fall asleep at night, your body needs to drop by about 1 to 3 degrees in terms of core body temperature.",
        "Cụ thể là để chìm vào giấc ngủ vào ban đêm, nhiệt độ cốt lõi của cơ thể cần giảm khoảng 1 đến 3 độ.",
        "Ngược lại, khi thức dậy, nhiệt độ cốt lõi của cơ thể sẽ tăng từ 1 đến 3 độ. Với tấm phủ nệm Eight Sleep, bạn có thể điều chỉnh nhiệt độ môi trường ngủ theo ý muốn: một mức nhiệt khi bắt đầu đêm, một mức khác vào giữa đêm,"],
    ["ANDREW HUBERMAN: Before we begin, I'd like to emphasize that this podcast is separate from my teaching and research roles at Stanford.",
        "ANDREW HUBERMAN: Trước khi bắt đầu, tôi muốn nhấn mạnh rằng podcast này tách biệt với vai trò giảng dạy và nghiên cứu của tôi tại Stanford.",
        "Nó cũng tách biệt với vai trò giảng dạy và nghiên cứu của Tiến sĩ Andy Galpin tại Cal State Fullerton. Tuy nhiên, đây là một phần trong mong muốn và nỗ lực của chúng tôi nhằm mang đến thông tin khoa học và các công cụ liên quan đến khoa học hoàn toàn miễn phí cho công chúng."],
    ["If I asked a question like, \"How fast can a child learn how to read in a classroom?\"",
        "Nếu tôi đặt câu hỏi kiểu như: \"Một đứa trẻ có thể học đọc nhanh đến mức nào trong lớp học đó?\"",
        "các nhà khoa học lại đổi câu trả lời thành: \"Đứa trẻ trung bình trong lớp học đó học đọc nhanh đến mức nào?\" và chúng ta điều chỉnh lớp học theo mức trung bình đó."],
    ["You have to remember, people who come on this show actually care about money.",
        "Bạn phải nhớ rằng, những người tham gia chương trình này thực sự quan tâm đến tiền bạc.",
        "Những người tham gia chương trình của tôi thực sự quan tâm đến tiền bạc. Tuy nhiên, có rất nhiều người, tôi đang nói đến hàng chục triệu người, không hề biết những kiến thức tài chính cơ bản, cũng chẳng muốn tìm hiểu."],
    // a long unit, as saved (intact): the repair on load cut its last clause every time it opened
    ["drama any kind of relationship you have will carry its share of drama but you also want to carve out spaces where the drama that you deal with is Meaningful drama it's contextualized by shared values in a higher purpose that makes the drama worth it and if you've got relationships that are not",
        "những rắc rối. Bất kỳ mối quan hệ nào cũng sẽ có những rắc rối riêng, nhưng bạn cần tạo ra những không gian mà ở đó những rắc rối bạn đối mặt phải có ý nghĩa. Chúng cần được đặt trong bối cảnh của những giá trị chung và mục đích cao cả hơn, điều khiến những rắc rối đó trở nên xứng đáng. Và nếu bạn đang có những mối quan hệ không",
        "được khuếch đại bởi việc kết nối với những người khác. Nếu bạn có những mối quan hệ cản trở việc gặp gỡ người mới và kết bạn, thì đó có thể là một dấu hiệu cảnh báo. Trong cuốn sách \"Bốn tình yêu\", C.S. Lewis mô tả tình bạn là tình yêu ít đố kỵ nhất, bởi vì tình bạn là kiểu tình yêu được nâng tầm nhờ việc có thêm những người khác tham gia. Vì vậy, tôi nghĩ nếu bạn đang đối mặt với những người bạn này và họ là bạn thực sự, thì tình bạn giữa hai người nên được củng cố khi bạn muốn kết nối với những người khác. Tôi sẽ xem xét lại các mối quan hệ đó và tự hỏi tại sao mình lại gắn bó với họ. Có phải vì chúng ta học cùng nhau từ hồi lớp năm nên tôi cảm thấy tội lỗi, hay tôi đang tự huyễn hoặc bản thân rằng việc này sẽ"]
];

test("a clause that only parallels the next units is kept when the unit's source is known", () => {
    const Q = require("../vi-quality.js");
    for (const [src, vi, next] of PARALLEL) {
        assert.notEqual(Q.trimContextLeak(vi, next), vi, "the case no longer reproduces the old cut: " + vi);
        assert.equal(Q.trimContextLeak(vi, next, { src }), vi);
    }
});

test("a real leak is still trimmed with the source known, even when the unit's own part is short", () => {
    const Q = require("../vi-quality.js");
    const next = "nhưng số tiền đó cũng gần bằng với tiền thuê nhà chúng tôi từng trả. Ngoài ra, chúng tôi không còn bất kỳ khoản nợ nào khác, nhất là những khoản nợ do chi tiêu quá mức cho những thứ nằm ngoài khả năng chi trả.";
    // the unit's own part keeps its source's length: cut as before
    const own = "Tôi dùng thẻ tín dụng vì có thể tích điểm khách sạn, điểm chuyến bay và nhiều ưu đãi khác. Chúng tôi có một khoản vay thế chấp,";
    const leaked = own + " nhưng số tiền trả hàng tháng cũng tương đương với tiền thuê nhà trước đây. Ngoài khoản đó ra, chúng tôi không còn bất kỳ khoản nợ nào khác, đặc biệt là nợ do chi tiêu quá mức cho những thứ nằm ngoài khả năng chi trả.";
    const src = "I use credit cards because I can earn hotel points, flight points and lots of other perks. And we have a mortgage,";
    const cut = Q.trimContextLeak(leaked, next, { src });
    assert.ok(cut !== leaked && !/bất kỳ khoản nợ nào khác/.test(cut) && cut.startsWith(own.replace(/,$/, "")), cut);
    assert.equal(cut, Q.trimContextLeak(leaked, next), "the source changed a cut it should not");
    // a terse own part, left under 0.7 of its source, still loses a leak that makes the whole 1.8
    // times the source or more
    const terse = "Tôi dùng thẻ tín dụng để tích điểm. Chúng tôi có khoản vay thế chấp,";
    const terseLeak = terse + " nhưng số tiền đó cũng gần bằng với tiền thuê nhà chúng tôi từng trả. Ngoài ra, chúng tôi không còn bất kỳ khoản nợ nào khác, nhất là những khoản nợ do chi tiêu quá mức cho những thứ nằm ngoài khả năng chi trả.";
    const terseCut = Q.trimContextLeak(terseLeak, next, { src });
    assert.ok(terseCut.length < src.length * 0.7 && terseLeak.length >= src.length * 1.8, terseCut);
    assert.equal(terseCut, terse.replace(/,$/, ""));
});

// From the user's cache (2.3.0): the middle item of a window was a sentence fragment; the model gave
// it only its first words, then opened the next item with those words and the rest of the sentence
const HEAD_REPEAT = {
    src: ["But then I started to really like dive into this more, look at the research on this stuff, experiment with some things personally, and I realized that like this is really life-changing. And there's also some,",
        "you know, dark stuff going on. All right. So, get this. [music] The depression rates have basically doubled since the 1980s. Do [music] you know what else doubled? The amount of stuff that we have. Now, obviously, there's a bunch of factors, but like life,"],
    vi: ["Nhưng rồi tôi bắt đầu thực sự đi sâu tìm hiểu",
        "Nhưng rồi tôi bắt đầu thực sự đi sâu tìm hiểu, xem xét các nghiên cứu về vấn đề này, tự mình thử nghiệm một vài thứ và nhận ra rằng nó thực sự thay đổi cuộc sống. Và còn có một vài, bạn biết đấy, những mặt tối đang diễn ra. Được rồi, hãy nghe đây. Tỷ lệ trầm cảm về cơ bản đã tăng gấp đôi kể từ những năm 1980. Bạn có biết điều gì khác cũng tăng gấp đôi không? Đó là lượng đồ đạc chúng ta sở hữu. Tất nhiên, có rất nhiều yếu tố, nhưng cuộc sống,"]
};
const wordsOf = t => String(t).toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || [];

test("a unit that opens with the unit before it again loses the repeat, and the two are split by their source", () => {
    const Q = require("../vi-quality.js");
    const [a, b] = Q.fixRepeatedHeads(HEAD_REPEAT.vi, HEAD_REPEAT.src);
    // said once: the words of the pair are exactly the words of the longer answer, in order
    assert.deepEqual(wordsOf(a + " " + b), wordsOf(HEAD_REPEAT.vi[1]));
    assert.ok(!/^Nhưng rồi tôi bắt đầu/.test(b), b);
    // the first unit gets back what its source says (the research, life-changing), at a clause end
    assert.ok(/xem xét các nghiên cứu/.test(a) && /thay đổi cuộc sống\./.test(a), a);
    assert.ok(/^những mặt tối đang diễn ra\./.test(b), b);
    // shares near the source's (48% / 52%), not 9% / 91% as the model left them
    const share = a.length / (a.length + b.length);
    assert.ok(share > 0.4 && share < 0.56, share);
    // idempotent: a second pass changes nothing
    assert.deepEqual(Q.fixRepeatedHeads([a, b], HEAD_REPEAT.src), [a, b]);
    // without the source lines the repeat still goes, nothing is moved
    const [a2, b2] = Q.fixRepeatedHeads(HEAD_REPEAT.vi);
    assert.equal(a2, HEAD_REPEAT.vi[0]);
    assert.ok(/^xem xét các nghiên cứu/.test(b2), b2);
});

test("a repeat the source itself makes, a short overlap, or a unit that is only the repeat is left alone", () => {
    const Q = require("../vi-quality.js");
    // a mantra from the same cache: the Hindi says the line again (Devanagari vowel signs are \p{M})
    const mantra = {
        src: ["जो कुछ आंखों के सामने है, वह खालीपन है, और खालीपन ही वस्तु है। जो पदार्थ आंखों के सामने है, वह खालीपन है, और खालीपन ही पदार्थ है।", "जो कुछ आंखों के सामने है, वह खालीपन है, और खालीपन ही वस्तु है।"],
        vi: ["Mọi sự vật hiện hữu trước mắt đều là sự trống rỗng", "Mọi sự vật hiện hữu trước mắt đều là sự trống rỗng, và sự trống rỗng chính là vạn vật."]
    };
    assert.deepEqual(Q.fixRepeatedHeads(mantra.vi, mantra.src), mantra.vi);
    // five words in common at the seam is not a repeat
    const short = ["Tôi đã học được rất nhiều điều từ bà tôi nghĩ vậy", "tôi nghĩ vậy nên tôi viết lại tất cả mọi thứ vào sổ."];
    assert.deepEqual(Q.fixRepeatedHeads(short, ["I learned a lot from her, I think", "so I wrote everything down."]), short);
    // the next unit is nothing but the repeat: a line twice beats a line missing (the tail trim's case)
    const whole = ["Chúng tôi đã dọn sạch cả căn bếp trong một buổi chiều", "Chúng tôi đã dọn sạch cả căn bếp trong một buổi chiều."];
    assert.deepEqual(Q.fixRepeatedHeads(whole, ["We cleared the whole kitchen", "in one afternoon."]), whole);
    // empty, missing, single
    assert.deepEqual(Q.fixRepeatedHeads(["", "Xin chào"], ["", "Hello"]), ["", "Xin chào"]);
    assert.deepEqual(Q.fixRepeatedHeads(["Một câu thôi."]), ["Một câu thôi."]);
});

// 2.4.4, from the user's cache: a source unit that stops mid-sentence ends a window, the model
// finishes the sentence there, and the next window translates the sentence's end again in other words
const RETOLD = {
    src: ["conversation with each other now more cafes are embracing this concept and I think it's hugely beneficial to us these third spaces encourage us to disconnect and helps us to focus on meaningful interactions this really shouldn't be limited to cafes we should all have Tech free zones at home you can put it in a",
        "charger or in a box so it's out of sight out of mind as James Clear said in atomic habits we can design our environments to make good habits easier and add friction to the bad habits before we continue I want to thank better heal for sponsoring today's video I've been in therapy for a couple"],
    vi: ["Hiện nay, ngày càng nhiều quán cà phê áp dụng mô hình này và tôi nghĩ nó mang lại lợi ích rất lớn cho chúng ta. Những không gian thứ ba này khuyến khích chúng ta ngắt kết nối và tập trung vào các tương tác ý nghĩa. Điều này thực sự không nên chỉ giới hạn ở các quán cà phê; tất cả chúng ta đều nên có những khu vực không công nghệ tại nhà. Bạn có thể cất thiết bị vào chỗ sạc hoặc trong một chiếc hộp để khuất tầm mắt, khuất tâm trí.",
        "ngăn kéo hoặc trong hộp để khuất tầm mắt, khuất tâm trí. Như James Clear đã nói trong cuốn Atomic Habits, chúng ta có thể thiết kế môi trường sống để hình thành thói quen tốt dễ dàng hơn và tạo thêm trở ngại cho những thói quen xấu. Trước khi tiếp tục, tôi muốn cảm ơn BetterHelp đã tài trợ cho video hôm nay. Tôi đã tham gia trị liệu được vài"]
};

test("a unit that retells the end of the sentence the unit before it finished loses that first sentence", () => {
    const Q = require("../vi-quality.js");
    const [a, b] = Q.fixRepeatedHeads(RETOLD.vi, RETOLD.src);
    assert.equal(a, RETOLD.vi[0]);
    assert.ok(/^Như James Clear đã nói/.test(b), b);
    assert.equal(b, RETOLD.vi[1].slice(RETOLD.vi[1].indexOf("Như James")));
    assert.deepEqual(Q.fixRepeatedHeads([a, b], RETOLD.src), [a, b]);
    // the same seam in a second video: "so that's a warm-up in and of" | "itself and by the way"
    const warm = ["Tôi sẽ xuất phát từ nhà, đạp xe khoảng 10 đến 15 phút đến địa điểm tập leo dốc, đó chính là phần khởi động của tôi.",
        "đó là phần khởi động. Nhân tiện, trên đường đi cũng có vài đoạn dốc ngắn."];
    const [, w] = Q.fixRepeatedHeads(warm, ["I'm going to ride 10 to 15 minutes to the place where I do my Hill repeat so that's a warm-up in and of", "itself and by the way getting there there are a couple of short little climbs"]);
    assert.equal(w, "Nhân tiện, trên đường đi cũng có vài đoạn dốc ngắn.");
    // without the source lines nothing is known about the seam: unchanged
    assert.deepEqual(Q.fixRepeatedHeads(RETOLD.vi), RETOLD.vi);
});

test("an answer that echoes a question, a sentence split right, or a source that repeats is no retelling", () => {
    const Q = require("../vi-quality.js");
    // the source unit closes its sentence: the next one is a new sentence, another speaker's echo
    const echo = ["Có con số trung bình nào không?", "Một con số trung bình. Tôi chỉ hỏi vậy thôi."];
    assert.deepEqual(Q.fixRepeatedHeads(echo, ["Any average?", "An average. I'm just asking."]), echo);
    // the translation runs on as its source does: the next unit finishes the sentence, once
    const split = ["Bạn không cần tất cả chúng. Tôi cũng vậy. Chẳng ai", "cần tất cả chúng cả. Vậy mà hầu hết mọi người đều có."];
    assert.deepEqual(Q.fixRepeatedHeads(split, ["You do not need them all. I do not need them all. Nobody", "needs them all. And yet, most people have most of them."]), split);
    // the speaker says it again
    const again = ["Thứ Tư thay vì chạy 3 dặm, tôi đã chạy 4 dặm.", "Thứ Sáu thay vì chạy 3 dặm, tôi đã chạy 4 dặm. Rồi tôi nghỉ."];
    assert.deepEqual(Q.fixRepeatedHeads(again, ["So Wednesday instead of doing three I did", "four Friday instead of doing three I did four then I rested"]), again);
    // the next unit is nothing but the retelling: a line twice beats a line missing
    const only = [RETOLD.vi[0], "ngăn kéo hoặc trong hộp để khuất tầm mắt, khuất tâm trí."];
    assert.deepEqual(Q.fixRepeatedHeads(only, RETOLD.src), only);
});

// 2.4.4, from the user's cache: one unit translated the next unit's content too, and the next window
// answered its unit with only the last words; the voice fell behind and dropped a 60-word line
const SHIFTED = {
    src: ["minutes at 300 watts um of course you're Outdoors so you don't have complete control it's always jumping around but but I'm really watching the the 3 second power tracing and the average power to keep it there well after the first minute I barely know I'm on the bike like it's it should be really easy after a minute if you're dying after the first",
        "minute you've set your target too high um um 2 minutes in you know two and a half minutes in when I'm halfway done I still feel pretty good my heart rate is now going to be within about five beats of what it's maximum is um but I still feel pretty good it's really at about minute 3 3 3 and a half that the Pain Train starts to leave the station and"],
    vi: ["phút ở mức 300 watt. Tất nhiên khi tập ngoài trời, bạn không thể kiểm soát hoàn toàn nên các chỉ số sẽ luôn dao động, nhưng tôi luôn theo dõi biểu đồ công suất 3 giây và công suất trung bình để giữ mức đó ổn định. Sau phút đầu tiên, tôi gần như không cảm thấy mình đang đạp xe nữa, vì sau một phút thì mọi thứ phải rất nhẹ nhàng. Nếu bạn đã thấy kiệt sức ngay sau phút đầu tiên thì nghĩa là bạn đã đặt mục tiêu quá cao. Khi bước sang phút thứ hai, rồi đến phút thứ hai rưỡi, lúc tôi đã hoàn thành được một nửa chặng đường, tôi vẫn cảm thấy khá ổn. Nhịp tim lúc này sẽ đạt mức gần sát nhịp tim tối đa, nhưng tôi vẫn thấy ổn. Phải đến khoảng phút thứ 3, 3 phút rưỡi...",
        "cơn đau mới thực sự ập đến và"]
};

test("a unit that took the next unit's content gives it back at the clause end its source asks for", () => {
    const Q = require("../vi-quality.js");
    const [a, b] = Q.fixRepeatedHeads(SHIFTED.vi, SHIFTED.src);
    // only moved: the words of the pair, in order, are the words the model gave
    assert.deepEqual(wordsOf(a + " " + b), wordsOf(SHIFTED.vi.join(" ")));
    // cut where the sources meet ("if you're dying after the first" | "minute you've set your target too high")
    assert.ok(/mọi thứ phải rất nhẹ nhàng\.$/.test(a), a);
    assert.ok(/^Nếu bạn đã thấy kiệt sức/.test(b) && /cơn đau mới thực sự ập đến và$/.test(b), b);
    const share = a.length / (a.length + b.length);
    assert.ok(share > 0.45 && share < 0.6, share);
    assert.deepEqual(Q.fixRepeatedHeads([a, b], SHIFTED.src), [a, b]);
    // an ordinary seam, or a short source line ("Yes."), is left where the model put it
    const even = ["Tôi đạp xe tới chân dốc, mất khoảng mười lăm phút, rồi bắt đầu leo.", "Lượt đầu tôi giữ sức, lượt sau mới tăng dần công suất."];
    assert.deepEqual(Q.fixRepeatedHeads(even, ["I ride to the bottom of the hill, about fifteen minutes, then start climbing.", "The first run I hold back, then I build the power up."]), even);
    const short = ["Vâng, đúng vậy, tôi hoàn toàn đồng ý với anh về chuyện tập luyện đều đặn mỗi ngày.", "Vâng."];
    assert.deepEqual(Q.fixRepeatedHeads(short, ["Yes, I agree.", "Yes."]), short);
});

// 2.4.5, from the user's cache: in a window of short podcast lines the model split one line in two,
// and the next answers each sat one item late until two were merged
const SLID = {
    src: ["You committed to this.", "You've got to get out of here.", "Someone who will be like, no, no. It's drop everything and read.",
        "It's 8:00.", "You're supposed to be reading.", "You got to go.", "You're going to check back in on that.", "Check back again every week."],
    vi: ["Anh đã cam kết làm việc này rồi.", "Anh phải đi ngay thôi.", "Một người sẽ kiểu như: không, không được.",
        "Mọi việc phải dừng lại hết để đọc sách.", "Đã 8 giờ rồi.", "Đến giờ anh phải đọc sách rồi.", "Anh phải đi ngay thôi.", "Anh sẽ kiểm tra lại việc đó."],
    fixed: ["Anh đã cam kết làm việc này rồi.", "Anh phải đi ngay thôi.", "Một người sẽ kiểu như: không, không. Gác lại mọi thứ để đọc sách.",
        "Đã 8 giờ rồi.", "Anh phải đang đọc sách mới đúng.", "Anh phải đi thôi.", "Anh sẽ kiểm tra lại việc đó.", "Hằng tuần kiểm tra lại."]
};

test("a window whose answers slid by one item is found by length, a right one is not", () => {
    const Q = require("../vi-quality.js");
    assert.deepEqual(Q.misalignedItems(SLID.src, SLID.vi), [3, 4, 5]);
    assert.deepEqual(Q.misalignedItems(SLID.src, SLID.fixed), []);
    // too few items, a count that differs, a script whose length says little
    assert.deepEqual(Q.misalignedItems(SLID.src.slice(0, 2), SLID.vi.slice(0, 2)), []);
    assert.deepEqual(Q.misalignedItems(SLID.src, SLID.vi.slice(1)), []);
    assert.deepEqual(Q.misalignedItems(["今天", "我们", "开始", "学习"], ["Hôm nay chúng ta", "bắt đầu", "học", "nhé các bạn"]), []);
});

test("a refine keeps the better item, but takes a slid window whole or not at all", () => {
    const Q = require("../vi-quality.js");
    const q = list => list.map((v, k) => Q.assess(SLID.src[k], v));
    const mark = (qs, items) => { for (const k of items) { qs[k].issues.push({ type: "misaligned", severity: 3 }); qs[k].score += 3; } return qs; };
    const q1 = mark(q(SLID.vi), Q.misalignedItems(SLID.src, SLID.vi));
    const q2 = mark(q(SLID.fixed), Q.misalignedItems(SLID.src, SLID.fixed));
    // item by item would keep the slid "Mọi việc phải dừng lại..." beside the realigned items
    assert.deepEqual(Q.pickRefined(SLID.vi, SLID.fixed, q1, q2), SLID.fixed);
    // a refine that slides too is not taken
    assert.deepEqual(Q.pickRefined(SLID.vi, SLID.vi.slice(), q1, q1), SLID.vi);
    // no slide: item by item, as before
    const a = ["Bản dịch tốt.", "x"], b = ["Bản dịch khác.", "Bản dịch đầy đủ hơn."];
    const qa = [{ score: 0, issues: [] }, { score: 3, issues: [{ type: "omission", severity: 3 }] }], qb = [{ score: 0, issues: [] }, { score: 0, issues: [] }];
    assert.deepEqual(Q.pickRefined(a, b, qa, qb), ["Bản dịch tốt.", "Bản dịch đầy đủ hơn."]);
    // both refine paths use it
    const content = require("fs").readFileSync(require("path").join(__dirname, "..", "content.js"), "utf8");
    assert.ok(/Q\.misalignedItems\(req\.sentences, translations\)/.test(content), "assessAll flags a slid window");
    assert.ok(/CST_QUALITY\.pickRefined\(first\.translations, again\.translations, quality, q2\)/.test(content), "refineUnit picks with pickRefined");
});

test("a Vietnamese word written without marks is no English leftover", () => {
    const Q = require("../vi-quality.js");
    const issues = Q.assess("Some use brushless motors, which last longer than the cheaper brushed motors.",
        "Một số loại dùng động cơ không chổi than, bền hơn so với động cơ chổi than giá rẻ.").issues;
    assert.ok(!issues.some(i => i.type === "untranslated"), JSON.stringify(issues));
    assert.deepEqual(Q.englishLeftovers("động cơ chổi than, con mèo, tin nhắn"), []);
    assert.deepEqual(Q.englishLeftovers("bạn có thể save the draft"), ["save", "the", "draft"]);
});

// 2.3.1, from the user's cache: sound captions came back as "Âm nhạc", "(Âm nhạc)" or "[Âm nhạc]"
// within one video, and the voice read the bare ones aloud (45 of 531 groups; 4 left after)
test("sound captions: notes only are translated from a list, every note ends up bracketed and silent", () => {
    const Q = require("../vi-quality.js");
    const P = require("../dub-planner.js");
    const fix = (src, vi) => Q.fixSoundNotes([vi], [src])[0];
    // lines of notes only, in the caption's own language: no request needed
    assert.equal(Q.soundNoteLine("[Music]").vi, "[Âm nhạc]");
    assert.equal(Q.soundNoteLine(" [MUSIC] ").vi, "[Âm nhạc]");
    assert.equal(Q.soundNoteLine("[Tepuk tangan] [Musik] [Tepuk tangan]").vi, "[Vỗ tay] [Âm nhạc] [Vỗ tay]");
    assert.equal(Q.soundNoteLine("[เพลง]").vi, "[Âm nhạc]");
    assert.equal(Q.soundNoteLine("(Applause)").vi, "[Vỗ tay]");
    assert.equal(Q.soundNoteLine("♪♪").vi, "♪♪");
    assert.equal(Q.soundNoteLine("[Suara]").vi, "", "a note not in the list is left to the model");
    for (const speech of ["Hello [Music]", "(for example)", "♪ I love you ♪", "", "We use [INAUDIBLE] here"]) assert.equal(Q.soundNoteLine(speech), null, speech);
    // what the model gave, fixed
    assert.equal(fix("[Music]", "Âm nhạc"), "[Âm nhạc]");
    assert.equal(fix("[Musik]", "(Âm nhạc)"), "[Âm nhạc]");
    assert.equal(fix("[Suara]", "Âm thanh"), "[Âm thanh]", "an unknown note: the model's words, bracketed");
    assert.equal(fix("[Suara] [Foo]", "[Âm thanh] [Foo]"), "[Âm thanh] [Foo]");
    assert.equal(fix("[Musik] maha mahaun [Musik]", "Âm nhạc maha mahaun Âm nhạc"), "[Âm nhạc] maha mahaun [Âm nhạc]");
    assert.equal(fix("[Applause] your okay so", "Vỗ tay] Được rồi, vậy là"), "[Vỗ tay] Được rồi, vậy là");
    assert.equal(fix("[Music] the", "âm nhạc"), "[Âm nhạc]", "the note alone on the line");
    assert.equal(fix("[Music] wait go here. [Music] Watch", "[Nhạc] khoan, để vào đây. [Nhạc] Xem nào"), "[Âm nhạc] khoan, để vào đây. [Âm nhạc] Xem nào");
    assert.equal(fix("He said (laughs) no", "Anh ấy nói (cười) không"), "Anh ấy nói [Tiếng cười] không");
    assert.equal(fix("[Music] hello", "[Music] xin chào"), "[Âm nhạc] xin chào", "a note left in English");
    // speech is never bracketed: lower case inside a sentence, a dropped note, a round aside
    assert.equal(fix("[Laughter] That is so funny", "Buồn cười quá"), "Buồn cười quá");
    assert.equal(fix("[Music] I love music", "Tôi yêu âm nhạc"), "Tôi yêu âm nhạc");
    assert.equal(fix("[Music] see (more about music)", "xem (thêm về âm nhạc)"), "xem (thêm về âm nhạc)");
    assert.equal(fix("[Music] Music is great", "[Âm nhạc] Âm nhạc thật tuyệt"), "[Âm nhạc] Âm nhạc thật tuyệt", "one note, one bracket");
    assert.equal(fix("I love music", "Tôi yêu Âm nhạc"), "Tôi yêu Âm nhạc", "no note in the source, nothing touched");
    // idempotent, and the voice reads none of it
    for (const [src, vi] of [["[Musik] maha mahaun [Musik]", "Âm nhạc maha mahaun Âm nhạc"], ["[Music]", "Âm nhạc"], ["[Applause] your okay so", "Vỗ tay] Được rồi"]]) {
        const once = fix(src, vi);
        assert.equal(fix(src, once), once);
        assert.doesNotMatch(P.stripSoundNotes(once), /nhạc|vỗ tay/i, once);
    }
});

// 2.3.8, from the user's cache: the recognizer writes "[music]" wherever the background music is and
// ">>" at every speaker it hears; the model left most out and kept some (10 notes cutting a phrase in
// two in 5 videos, ">>" in 5 of 27 lines)
// UIy-WQCZd4M (2026-10-01): the model kept the label in 239 of 311 lines that open with one
test("a speaker label that opens the source is put back in front of a translation that dropped it", () => {
    const Q = require("../vi-quality.js");
    const fix = (src, vi) => Q.fixSoundNotes([vi], [src])[0];
    assert.equal(fix("ANDREW HUBERMAN: Number six.", "Số sáu."), "ANDREW HUBERMAN: Số sáu.");
    assert.equal(fix("ANDREW HUBERMAN: Fantastic.", "ANDREW HUBERMAN: Tuyệt vời."), "ANDREW HUBERMAN: Tuyệt vời.");
    // not a label: mixed case, one capital letter, or not at the start
    assert.equal(fix("So here's the thing: we wait.", "Vấn đề là: ta chờ."), "Vấn đề là: ta chờ.");
    assert.equal(fix("A: yes.", "Có."), "Có.");
    assert.equal(fix("And then ANDY GALPIN: yes.", "Rồi thì có."), "Rồi thì có.");
    assert.equal(fix("ANDY GALPIN: Yes.", ""), "", "nothing to put it on");
});

test("sound captions: a music note inside a sentence and the speaker marks are dropped", () => {
    const Q = require("../vi-quality.js");
    const fix = (src, vi) => Q.fixSoundNotes([vi], [src])[0];
    assert.equal(fix("my friend who pays [music] for a gym membership", "cô ấy trả tiền [Âm nhạc] cho gói thành viên"), "cô ấy trả tiền cho gói thành viên");
    assert.equal(fix("it's solid wood and it's easy [music] to clean. Check", "làm từ gỗ và dễ dàng [nhạc] vệ sinh. Bạn"), "làm từ gỗ và dễ dàng vệ sinh. Bạn");
    assert.equal(fix("it is now [music] just an elaborate thing", "thì giờ đây, [âm nhạc] chúng chỉ là cái bẫy"), "thì giờ đây, chúng chỉ là cái bẫy");
    assert.equal(fix("[Music] wait go here [Music] watch", "[Nhạc] khoan, để vào đây [Nhạc] xem nào"), "[Âm nhạc] khoan, để vào đây xem nào");
    // at the start, at the end, between two sentences: the note stays
    assert.equal(fix("[Music] I have become that plant lady", "[Âm nhạc] Tôi đã thành người mê cây"), "[Âm nhạc] Tôi đã thành người mê cây");
    assert.equal(fix("purchase them myself [Music] it's quite easy", "tự mua nữa. [Âm nhạc] Việc tự làm khá dễ"), "tự mua nữa. [Âm nhạc] Việc tự làm khá dễ");
    assert.equal(fix("take care [Music] bye [Music]", "giữ sức khỏe nhé. [Âm nhạc] Tạm biệt. [Âm nhạc]"), "giữ sức khỏe nhé. [Âm nhạc] Tạm biệt. [Âm nhạc]");
    // only music: laughter or applause inside a sentence is something that happened
    assert.equal(fix("He said [laughter] no", "Anh ấy nói [Tiếng cười] không"), "Anh ấy nói [Tiếng cười] không");
    // ">>": dropped when the source line has it, with or without a note beside it
    assert.equal(fix(">> [music] >> And of course, there are seasons", ">> [Âm nhạc] >> Và tất nhiên, có những lúc"), "[Âm nhạc] Và tất nhiên, có những lúc");
    assert.equal(fix("I have no idea. >> Um, around $8,000. >> How many days?", "Tôi không rõ. >> Ừm, khoảng 8.000 đô la. >> Bao nhiêu ngày?"), "Tôi không rõ. Ừm, khoảng 8.000 đô la. Bao nhiêu ngày?");
    assert.equal(fix("x > y means more", "x >> y nghĩa là lớn hơn nhiều"), "x >> y nghĩa là lớn hơn nhiều", "no mark in the source, nothing touched");
    assert.equal(fix(">> >>", ">>"), ">>", "never an empty line");
    for (const [src, vi] of [["pays [music] for it", "trả tiền [Âm nhạc] cho nó"], [">> [music] >> And so", ">> [Âm nhạc] >> Và thế là"]]) {
        const once = fix(src, vi);
        assert.equal(fix(src, once), once, "idempotent");
    }
});

// 2.3.2: each of these was a severity-3 issue in the user's cache, and a paid refine in Balanced mode
test("quality check: web addresses, loanwords and sound notes are neither leftovers nor omissions", () => {
    const Q = require("../vi-quality.js");
    const sponsor = ["yourself. Just fill out a questionnaire and they'll connect you with a credentialed therapist as soon as possible. Click the link in the description or go to betterhelp.com/malama life and get 10% off of your first month therapy. Thank you to BetterHelp for being a paid partner for today's video.",
        "chính bản thân mình. Bạn chỉ cần điền vào bảng câu hỏi, họ sẽ kết nối bạn với một chuyên gia trị liệu có bằng cấp sớm nhất có thể. Hãy nhấp vào liên kết trong phần mô tả hoặc truy cập betterhelp.com/malamalife để được giảm 10% cho tháng trị liệu đầu tiên. Cảm ơn BetterHelp đã đồng hành cùng video hôm nay."];
    assert.deepEqual(Q.assess(...sponsor).issues, [], "8MIBcFVf8g0 #29");
    assert.deepEqual(Q.englishLeftovers("video online, gửi email tới me@site.org hoặc @handle, vào https://a.b.io/x"), []);
    assert.deepEqual(Q.assess("[Music]", "").issues, [], "a line of notes is translated from the list");
    assert.deepEqual(Q.fixSoundNotes([""], ["[Music]"]), ["[Âm nhạc]"], "even when the model gave nothing");
    assert.deepEqual(Q.assess("[Music] is [Music]", "[Âm nhạc]").issues, [], "a stray word heard in the music");
    assert.deepEqual(Q.assess("(Laughter)", "[Tiếng cười]").issues, [], "a note in round brackets (TED)");
    assert.deepEqual(Q.assess("(Applause)", "[Vỗ tay]").issues, []);
    // a speaker label the translation leaves out is no omission (UIy-WQCZd4M)
    assert.deepEqual(Q.assess("ANDREW HUBERMAN: Number six.", "Số sáu.").issues, []);
    assert.deepEqual(Q.assess("ANDREW HUBERMAN: Before we begin, I'd like to emphasize that this podcast is separate from my teaching and research roles at Stanford.",
        "ANDREW HUBERMAN: Trước khi bắt đầu").issues.map(i => i.type), ["omission"]);
    // the length ratio is an English one: a Hindi mantra or a Chinese line is not judged by it
    assert.deepEqual(Q.assess("खालीपन ही पदार्थ है जो पदार्थ आंखों के सामने है, वह खालीपन है खाली होना ही वस्तु है।", "Sự trống rỗng chính là vật chất").issues, []);
    assert.deepEqual(Q.assess("我们今天要学习如何使用这个新的工具来提高工作效率和质量", "Hôm nay chúng ta sẽ học cách sử dụng công cụ mới này để nâng cao hiệu quả và chất lượng công việc").issues, []);
    // substance names kept as they are (nm1TxQj9IsQ, 2026-10-01: 16 refine flags on lines like this)
    assert.deepEqual(Q.assess("Caffeine acts as an adenosine antagonist, what that means is that when you ingest caffeine, whether or not it's coffee or soda or tea, or in any other form, it binds to the adenosine receptor,",
        "Caffeine đóng vai trò là chất đối kháng adenosine, nghĩa là khi bạn nạp caffeine vào cơ thể, dù là từ cà phê, nước ngọt, trà hay bất kỳ dạng nào khác, nó sẽ liên kết với thụ thể adenosine,").issues, []);
    // still caught: English really left in, speech really dropped next to a note
    assert.match(Q.assess("We will now compute the gradient descent update for the weights", "Bây giờ ta sẽ compute gradient descent update cho weights").issues.map(i => i.detail).join(), /compute/);
    assert.deepEqual(Q.assess("[Music] hello there my friends, welcome back", "[Âm nhạc]").issues.map(i => i.type), ["empty"]);
});

test("every translation path runs the leak trim", () => {
    const read = f => require("node:fs").readFileSync(require("node:path").join(__dirname, "..", f), "utf8");
    const cs = read("content.js"), yt = read("youtube.js"), bg = read("background.js");
    assert.ok(/translations = trimTranslationLeaks\(translations, false, groups\.map\(g => g\.text\)\)\.list;/.test(cs), "Coursera");
    // the progressive display fixes head repeats too (it gets the source lines)
    assert.ok(/trimTranslationLeaks\(translations, true, groups\.map\(g => g\.text\)\)/.test(cs), "Coursera progressive");
    assert.ok(/ytTrimLeaks\(groups, idxs\);\n    ytGhepViCues\(\);/.test(yt), "YouTube live");
    assert.ok(/ytRepairCachedLeaks\(\);\n            yt\.daDichXong = true;/.test(yt), "YouTube cache");
    assert.ok(/Q\.fixRepeatedHeads\(\[a\.viText, b\.viText\]/.test(yt), "YouTube runs the head repeat fix inside ytTrimLeaks");
    // sound captions: both paths, and a cached video is repaired on load (ytTrimLeaks counts them)
    assert.ok(/if \(sources && Q\.fixSoundNotes\) translations = Q\.fixSoundNotes\(translations, sources\);/.test(cs), "Coursera sound notes");
    assert.ok(/Q\.fixSoundNotes\(\[g\.viText\], \[src\(g\)\]\)/.test(yt) && /return n \+ notes;/.test(yt), "YouTube sound notes");
    assert.ok(/KHÔNG viết tiếp phần nằm trong \[NGỮ CẢNH SAU\]/.test(bg), "the prompt says so too");
});
