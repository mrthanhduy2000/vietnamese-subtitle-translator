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

test("every translation path runs the leak trim", () => {
    const read = f => require("node:fs").readFileSync(require("node:path").join(__dirname, "..", f), "utf8");
    const cs = read("content.js"), yt = read("youtube.js"), bg = read("background.js");
    assert.ok(/translations = trimTranslationLeaks\(translations\)\.list;/.test(cs), "Coursera");
    assert.ok(/ytTrimLeaks\(groups, idxs\);\n    ytGhepViCues\(\);/.test(yt), "YouTube live");
    assert.ok(/ytRepairCachedLeaks\(\);\n            yt\.daDichXong = true;/.test(yt), "YouTube cache");
    assert.ok(/KHÔNG viết tiếp phần nằm trong \[NGỮ CẢNH SAU\]/.test(bg), "the prompt says so too");
});
