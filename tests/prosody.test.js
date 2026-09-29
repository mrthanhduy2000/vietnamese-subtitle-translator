// Prosody model (1.7.6): where Vietnamese speech may pause, how strongly, and which of a voice's own
// stops to keep. Measured on 56 sentences x 5 real VieNeu takes plus three held-out sets, see
// docs/DUBBING.md "Prosody model (1.7.6)". Three real takes live in tests/audio (16 kHz, cleaned).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../dub-prosody.js");
const A = require("../dub-audio.js");
const PLAN = require("../dub-planner.js");

const gapAfter = (text, word) => {
    const a = P.analyze(text);
    const i = a.words.findIndex(w => w.bare === word || w.raw === word);
    assert.ok(i >= 0 && i < a.gaps.length, `no gap after "${word}"`);
    return a.gaps[i];
};
const eligible = g => !g.unit && g.value >= P.K.minValue;

test("syllables are counted the way the voice reads them", () => {
    assert.equal(P.syllables("huấn"), 1);
    assert.equal(P.syllables("GPU"), 3);
    assert.equal(P.syllables("72"), 3);                  // bảy mươi hai
    assert.equal(P.syllables("123"), 5);                 // một trăm hai mươi ba
    assert.equal(P.syllables("PyTorch"), 2);
    assert.equal(P.syllables("khuyên,"), 1);
    assert.equal(P.syllables("network."), 2);
    // the fallback weight (no planner loaded): one per vowel group, one per digit
    assert.equal(P.spokenWeight("123"), 3);
    assert.equal(P.spokenWeight("—"), 0);
});

test("boundaries are graded, not pause / no pause: sentence > clause and comma > lead-in and list > phrase", () => {
    const a = P.analyze("Bây giờ, chúng ta đã huấn luyện mô hình trên dữ liệu cũ, nhưng kết quả chưa tốt. Tại sao lại như vậy?");
    const levels = a.gaps.filter(g => g.punct).map(g => [g.role, g.level]);
    assert.deepEqual(levels, [["lead", "short"], ["comma", "medium"], ["sentence", "long"]]);
    const [lead, comma, stop] = a.gaps.filter(g => g.punct).map(g => g.pause);
    assert.ok(lead < comma && comma < stop, `${lead} < ${comma} < ${stop}`);
    // a pause length is a continuous function of the clause around it, not a fixed table
    const short = gapAfter("Tôi đã thử, nhưng kết quả vẫn không thay đổi.", "thử,").pause;
    const long = gapAfter("Tôi đã thử đi thử lại rất nhiều lần với nhiều cấu hình, nhưng kết quả vẫn không thay đổi.", "hình,").pause;
    assert.ok(long - short >= 0.06, `${short} vs ${long}`);
});

test("list items rest alike and briefly; the last separator a little more", () => {
    const a = P.analyze("Bạn cần chuẩn bị ba thứ: dữ liệu huấn luyện, một mô hình cơ sở, và một hàm mất mát phù hợp.");
    const list = a.gaps.filter(g => g.role === "list");
    assert.equal(list.length, 2);
    assert.equal(list[0].pause, 0.15);
    assert.equal(list[1].pause, 0.17);                  // before "và": the closing item
    assert.ok(gapAfter("CPU, bộ nhớ, tốc độ mạng và độ trễ đều ảnh hưởng.", "CPU,").role === "list");
    // "và" inside a list is no boundary at all
    assert.ok(!eligible(gapAfter("CPU, bộ nhớ, tốc độ mạng và độ trễ đều ảnh hưởng.", "mạng")));
});

test("a comma before a contrast rests longer than one before a joining word; a fronted clause's comma too", () => {
    const but = gapAfter("Tôi đã kiểm tra kỹ toàn bộ hệ thống, nhưng không thấy lỗi.", "thống,").pause;
    const and = gapAfter("Tôi đã kiểm tra kỹ toàn bộ hệ thống, và không thấy lỗi.", "thống,").pause;
    assert.ok(but - and >= 0.05, `${but} vs ${and}`);
    const fronted = gapAfter("Nếu bạn bật tùy chọn này, hệ thống sẽ lưu lại.", "này,").pause;
    const plain = gapAfter("Bạn đã bật tùy chọn này, hệ thống sẽ lưu lại.", "này,").pause;
    assert.ok(fronted > plain, `${fronted} vs ${plain}`);
});

test("sentence ends: a question and a following transition rest longer", () => {
    const q = gapAfter("Tại sao hệ thống lại chậm? Nguyên nhân là bộ nhớ đệm.", "chậm?").pause;
    const s = gapAfter("Hệ thống lại chậm hơn. Nguyên nhân là bộ nhớ đệm.", "hơn.").pause;
    const t = gapAfter("Hệ thống lại chậm hơn. Tuy nhiên nguyên nhân chưa rõ.", "hơn.").pause;
    assert.ok(q > s && t > s, `${q} ${s} ${t}`);
    assert.ok(q <= 0.45);
});

test("never a pause inside a number, a number and its unit, an acronym run, a term or a name", () => {
    const t = P.analyze("Giá khoảng 10 triệu đồng cho gói 5 GB với một triệu năm trăm nghìn mẫu của chiến dịch Google Ads Performance Max và large language model của ông Nguyễn Văn An.");
    const inside = ["10", "triệu", "5", "một", "năm", "trăm", "Google", "Ads", "Performance", "large", "language", "Nguyễn", "Văn"];
    for (const w of inside) {
        const i = t.words.findIndex(x => x.raw === w);
        assert.ok(!eligible(t.gaps[i]), `gap after "${w}" is eligible`);
    }
    assert.ok(!eligible(gapAfter("Hệ thống xử lý dữ liệu.", "Hệ")));
});

test("no pause around rằng, after a short subject, or before a modal nên", () => {
    const s = "Các nhà nghiên cứu phát hiện ra rằng mô hình lớn hơn không phải lúc nào cũng tốt hơn.";
    assert.ok(!eligible(gapAfter(s, "ra")), "predicate | rằng");
    assert.ok(!eligible(gapAfter(s, "rằng")), "rằng | complement");
    assert.ok(!eligible(gapAfter("Điều này có nghĩa là hệ thống sẽ phải xử lý gấp đôi.", "thống")), "short subject");
    assert.ok(!eligible(gapAfter("Thì rất có thể mô hình đã bị quá khớp.", "hình")), "modal before the subject");
    assert.ok(!eligible(gapAfter("Chúng ta nên chuẩn hóa dữ liệu.", "ta")), "chúng ta | nên (should)");
    assert.ok(!eligible(gapAfter("Tôi thử lại và kết quả tốt hơn.", "lại")), "và between short phrases");
    assert.ok(!eligible(gapAfter("Mô hình chỉ đang ghi nhớ dữ liệu chứ không hiểu nó.", "chứ")), "inside chứ không");
});

test("a long subject before an unmarked predicate verb is a boundary; the verb inside a noun and a short subject are not", () => {
    assert.ok(eligible(gapAfter("Doanh thu của công ty trong quý ba đạt mức cao nhất từ trước đến nay.", "ba")), "subject | đạt");
    assert.ok(eligible(gapAfter("Kết quả nghiên cứu của nhóm cho thấy mô hình học rất nhanh.", "nhóm")), "subject | cho thấy");
    assert.ok(!eligible(gapAfter("Tỷ lệ chiếm dụng phòng của khách sạn đã tăng mạnh trong mùa hè.", "lệ")), "chiếm dụng is a noun");
    assert.ok(!eligible(gapAfter("Sản phẩm mới giúp khách hàng tiết kiệm thời gian.", "mới")), "short subject | giúp");
});

test("clause openings, adjuncts and a long subject are boundaries, weighted by the segmenter's scoring", () => {
    const pairs = [
        ["Vì máy chủ quá tải nên yêu cầu bị chuyển sang một mô hình khác.", "tải"],
        ["Mô hình dự đoán dựa trên toàn bộ ngữ cảnh mà nó đã nhìn thấy trước đó.", "cảnh"],
        ["Mạng học biểu diễn từ dữ liệu thô thông qua quá trình lan truyền ngược.", "thô"],
        ["Hệ thống sẽ tự động lưu lại mọi thay đổi sau mỗi lần chỉnh sửa.", "đổi"],
        ["Năm 2012, một nhóm nghiên cứu nhỏ tại Toronto đã tạo ra một mô hình.", "Toronto"],
        ["Mô hình chỉ đang ghi nhớ dữ liệu chứ không hiểu nó.", "liệu"],
        ["Khi dữ liệu đầu vào có nhiều giá trị bị thiếu chúng ta phải quyết định.", "thiếu"]
    ];
    for (const [s, w] of pairs) assert.ok(eligible(gapAfter(s, w)), `${w} in: ${s}`);
    // strength follows the opener: "nhưng" > "vì" > "và" > a preposition > "của"
    const v = w => gapAfter(`Mô hình học rất nhanh trên toàn bộ tập huấn luyện ${w} kết quả trên tập kiểm tra lại không tốt như mong đợi.`, "luyện").value;
    assert.ok(v("nhưng") > v("vì") && v("vì") > v("và") && v("và") > v("trên") && v("trên") > v("của"));
    // "và" joining two short phrases is no boundary; joining two clauses it is
    assert.ok(gapAfter("Mô hình học rất nhanh trên tập huấn luyện và kết quả kém.", "luyện").value < 0);
    // "xem ví dụ": "ví dụ" is a noun there, not an opener
    assert.ok(gapAfter("Bây giờ, hãy cùng xem ví dụ.", "xem").value < 0.3);
});

// ---- the marked corpus (tests/prosody-corpus.js): 104 sentences, one reader's marks ----
const PLAN_ = require("../dub-planner.js");
function marked(m) {
    const words = [], gold = [];
    for (const t of PLAN_.adaptForSpeech(m).split(/\s+/).filter(Boolean)) {
        if (t === "|" || t === "/") { if (words.length) gold[words.length - 1] = t === "|" ? 2 : 1; continue; }
        words.push(t); gold.push(0);
    }
    return { text: words.join(" "), words, gold };
}
const CORPUS = Object.values(require("./prosody-corpus.js")).flat();

test("corpus: a breathing comma only ever lands where the marks allow a pause", () => {
    let changed = 0;
    for (const [id, , m] of CORPUS) {
        const { text, words, gold } = marked(m);
        const b = P.breathText(text);
        if (b === text) continue;
        changed++;
        b.split(/\s+/).forEach((w, i) => {
            if (/,$/.test(w) && !/,$/.test(words[i])) assert.ok(gold[i] > 0, `${id}: comma after "${words[i]}"`);
        });
    }
    // 8 on 2026-09-27; 29 since 2.1.5 (BREATH 0.35 / 18 also takes the "/" boundaries); 36 since
    // 2.1.6 (minSide 6, a weaker boundary in a 26+ syllable stretch)
    assert.ok(changed >= 31 && changed <= 41, `${changed} sentences got a comma`);
});

test("corpus: the text-only choice never splits a unit or a bound pair, and no marked boundary is a unit", () => {
    let phrase = 0, unmarked = 0;
    for (const [id, , m] of CORPUS) {
        const { text, gold } = marked(m);
        const a = P.analyze(text);
        a.gaps.forEach(g => assert.ok(!(g.unit && gold[g.i]), `${id}: marked gap after "${a.words[g.i].raw}" is a unit`));
        for (const b of P.breathGroups(text)) {
            const g = a.gaps[b.gap];
            if (g.punct) continue;
            phrase++;
            assert.ok(!g.unit && g.cost < 20, `${id}: "${a.words[g.i].raw} | ${a.words[g.i + 1].raw}" cost ${g.cost}`);
            if (!gold[g.i]) unmarked++;
        }
    }
    // 37 phrase boundaries, 5 at unmarked (mild) gaps on 2026-09-27: "Điều này | có nghĩa là",
    // "tăng | từ", "tăng mạnh | nhờ vào", "tốt | bằng", "tập thể dục | vào buổi sáng"
    assert.ok(unmarked <= 6, `${unmarked} of ${phrase} at unmarked gaps`);
});

// ---- selection ----
const point = (sec, value, dur, fixed) => ({ sec, value, dur, fixed: !!fixed });
test("selection: a few good pauses, not every candidate (pause budget, choppy runs cost)", () => {
    // 6 s of speech, good boundaries every 0.6 s: keeping all would chop it into 0.6 s pieces
    const pts = [point(0, 0, null, true)];
    for (let k = 1; k < 10; k++) pts.push(point(k * 0.6, 0.6, 0.35));
    pts.push(point(6, 0, null, true));
    const kept = [...P.selectBoundaries(pts)].filter(j => !pts[j].fixed).map(j => pts[j].sec).sort((a, b) => a - b);
    assert.ok(kept.length >= 1 && kept.length <= 4, `kept ${kept.length} of 9`);
    for (let i = 1; i < kept.length; i++) assert.ok(kept[i] - kept[i - 1] >= 1, `pauses ${kept[i - 1]} and ${kept[i]} s`);
});

test("selection: a long run takes the best boundary available; a short one takes none", () => {
    // 6 s: a weak boundary at 1.5 s, a good one at 3 s, a boundary inside a phrase at 4.5 s
    const pts = [point(0, 0, null, true), point(1.5, 0.1, 0.3), point(3, 0.9, 0.3), point(4.5, -0.9, 0.5), point(6, 0, null, true)];
    const kept = [...P.selectBoundaries(pts)].filter(j => !pts[j].fixed);
    assert.deepEqual(kept, [2]);
    // 2 s: the same good boundary is not worth a pause, unless the voice stopped long there
    const short = [point(0, 0, null, true), point(1, 0.5, 0.15), point(2, 0, null, true)];
    assert.equal([...P.selectBoundaries(short)].length, 2);
    // a stop below the minimum is never kept; a gap under the floor never, however long the run
    const floor = [point(0, 0, null, true), point(4, -0.5, 0.6), point(8, 0, null, true)];
    assert.equal([...P.selectBoundaries(floor)].length, 2);
    // tight mode (a dense sentence): fewer optional pauses
    const pts2 = [point(0, 0, null, true), point(1.2, 0.5, 0.35), point(2.4, 0.5, 0.35), point(3.6, 0, null, true)];
    assert.ok([...P.selectBoundaries(pts2, { tight: true })].length <= [...P.selectBoundaries(pts2)].length);
});

test("text only: breath groups at the best boundaries, deterministic and memoised", () => {
    const s = "Khi chúng ta tăng kích thước của tập dữ liệu huấn luyện lên gấp mười lần thì sai số trên tập kiểm tra giảm xuống đáng kể nhưng thời gian huấn luyện cũng tăng lên tương ứng.";
    const words = P.breathGroups(s).map(b => b.word);
    assert.deepEqual(words, ["lần", "kể"]);
    assert.equal(P.analyze(s), P.analyze(s), "same text, same analysis object");
    assert.deepEqual(P.breathGroups(s), P.breathGroups(s));
});

test("breathing commas: only in a long unpunctuated stretch, only at a strong boundary, words unchanged", () => {
    const s = "Khi chúng ta tăng kích thước của tập dữ liệu huấn luyện lên gấp mười lần thì sai số trên tập kiểm tra giảm xuống đáng kể nhưng thời gian huấn luyện cũng tăng lên tương ứng.";
    const b = P.breathText(s);
    assert.equal(b, s.replace("mười lần thì", "mười lần, thì").replace("đáng kể nhưng", "đáng kể, nhưng"));
    assert.equal(b.replace(/,/g, ""), s.replace(/,/g, ""), "only commas are added");
    // a fronted clause without its comma gets one before the main clause
    assert.match(P.breathText("Khi dữ liệu đầu vào có nhiều giá trị bị thiếu chúng ta phải quyết định nên loại bỏ chúng hay điền vào bằng giá trị trung bình."), /bị thiếu, chúng ta phải quyết định nên loại bỏ chúng hay/);
    // short, already punctuated, or only weak boundaries: unchanged
    for (const t of ["Tôi thử lại và kết quả tốt hơn.", "Nếu bạn bật tùy chọn này, hệ thống sẽ tự động lưu lại mọi thay đổi sau mỗi lần chỉnh sửa.",
        "Điều này có nghĩa là hệ thống sẽ phải xử lý gấp đôi lượng dữ liệu trong cùng một khoảng thời gian."]) assert.equal(P.breathText(t), t);
});

test("cut boundary value: a segment cut between two texts", () => {
    assert.ok(P.boundaryValue("một nhóm nghiên cứu nhỏ tại Toronto", "đã tạo ra một mô hình") >= 0.3);
    assert.ok(P.boundaryValue("cách mô hình đưa ra", "quyết định chúng ta") < 0);
    assert.ok(P.boundaryValue("Tôi nghĩ rằng", "đây là một vấn đề") < -2);
});

test("analysis is cheap: 300 long sentences analysed and selected in well under a second", () => {
    const base = "Trong phần này chúng ta sẽ tìm hiểu cách mà mạng nơ-ron học được các biểu diễn từ dữ liệu thô thông qua quá trình lan truyền ngược và cập nhật trọng số";
    const t0 = Date.now();
    for (let i = 0; i < 300; i++) P.breathGroups(`${base} sau bước ${i}.`);
    assert.ok(Date.now() - t0 < 1500, `${Date.now() - t0} ms`);
});

// ---- on real takes ----
const take = f => A.decodeWav(new Uint8Array(fs.readFileSync(path.join(__dirname, "audio", f))));
const decisions = (f, text) => {
    const w = take(f);
    const r = A.shapePauses(w.samples, w.sampleRate, text);
    const an = A.alignStops(w.samples, w.sampleRate, text).A;
    return r.pauses.filter(p => p.dur >= 0.2).map(p => ({ after: an.words[p.gap] && an.words[p.gap].raw, keep: p.keep, kind: p.kind }));
};

test("real Mỹ Duyên takes: the voice's own stop before mà and before nên is kept, the one after rằng closed", () => {
    // 1.7.5 closed the first two to a 0.09 s joint: the 27-syllable sentence read in one breath
    const long = decisions("vieneu-my-duyen-long-ma.wav", "Mô hình này học cách dự đoán từ tiếp theo dựa trên toàn bộ ngữ cảnh mà nó đã nhìn thấy trước đó trong đoạn văn bản.");
    assert.deepEqual(long.map(d => [d.after, d.kind]), [["cảnh", "soft"]]);
    assert.ok(long[0].keep >= 0.15 && long[0].keep <= 0.22);
    const nen = decisions("vieneu-my-duyen-nen.wav", "Vì máy chủ quá tải nên yêu cầu bị chuyển sang một mô hình khác.");
    assert.deepEqual(nen.map(d => [d.after, d.kind]), [["tải", "soft"]]);
    const rang = decisions("vieneu-my-duyen-rang.wav", "Tôi nghĩ rằng đây là một ví dụ rất hay.");
    assert.deepEqual(rang.map(d => [d.after, d.kind, d.keep]), [["rằng", "joint", 0.09]]);
});

test("wiring: the service worker loads the text analysis before the audio module, the page loads the prosody and speech modules", () => {
    const bg = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
    // 1.7.8: dub-speech.js tells the pause shaping where the English spans are
    assert.match(bg, /importScripts\("cst-cache\.js", "cost-policy\.js", "vi-segmenter\.js", "dub-planner\.js", "dub-prosody\.js", "dub-speech\.js", "dub-audio\.js"\)/);
    const man = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
    const js = man.content_scripts.find(g => g.js.includes("content.js")).js;
    assert.ok(js.indexOf("dub-prosody.js") > js.indexOf("dub-planner.js") && js.indexOf("dub-prosody.js") < js.indexOf("dub-engine.js"));
    assert.ok(js.indexOf("dub-speech.js") > js.indexOf("dub-prosody.js") && js.indexOf("dub-speech.js") < js.indexOf("dub-engine.js"));
    const opt = fs.readFileSync(path.join(__dirname, "..", "options.html"), "utf8");
    assert.match(opt, /<script src="dub-prosody\.js"><\/script>\s*<script src="dub-speech\.js"><\/script>/);
});

// ---- across segments ----
function mkGroup(cues) {
    const viCues = cues.map(([s, e, t]) => ({ start: s, end: e, text: t, lines: [t] }));
    return { start: cues[0][0], end: cues[cues.length - 1][1], viText: cues.map(c => c[2]).join(" "), viCues,
        srcCues: cues.map(([s, e]) => ({ start: s, end: e, text: "src" })) };
}
test("free voice: a forced cut falls at the best line boundary, even in the first half; paid voices keep theirs", () => {
    // measured on a synthetic lecture: two long lines, the first ending a sentence, cut mid-phrase
    // ("đưa ra | quyết định") because only the second half was searched for punctuation
    const groups = [mkGroup([
        [275.3, 280.5, "đã tạo ra một mô hình làm thay đổi hoàn toàn lĩnh vực thị giác máy tính."],
        [280.5, 283.1, "Để hiểu được cách mô hình đưa ra"],
        [283.1, 287.2, "quyết định chúng ta cần xem xét trọng số của từng đặc trưng trong lớp cuối cùng."]
    ])];
    const free = PLAN.buildDubScript(groups, { joinGroups: true, segSoft: 8, segHard: 11 });
    assert.deepEqual(free.map(s => s.subtitleText.split(" ").slice(-2).join(" ")), ["máy tính.", "cuối cùng."]);
    const paid = PLAN.buildDubScript(groups, { segSoft: 6, segHard: 8 });
    assert.ok(paid.some(s => /đưa ra$/.test(s.subtitleText)), "paid segmentation unchanged");
});

test("head cuts after a start or seek fall where speech may pause, never inside a word, and stay short", () => {
    // one long subtitle line at the point where playback starts (headAt): cut into ~3.5 s pieces
    const heads = (text, dur = PLAN.countSyllables(text) / 3.2) => {
        const g = { start: 0, end: dur, viText: text, viCues: [{ start: 0, end: dur, text }], srcCues: [{ start: 0, end: dur, text: "src" }] };
        return PLAN.buildDubScript([g], { headAt: 0, joinGroups: true, segSoft: 8, segHard: 11 });
    };
    // the lecture fixture's second line (4.6 s) was cut "xem xét mạng | nơ-ron"
    for (const [text, dur] of [["Chúng ta hãy xem xét mạng nơ-ron tích chập hai lớp.", 4.6],
        "Hệ thống gợi ý của các sàn thương mại điện tử ảnh hưởng đến quyết định mua hàng của người dùng.",
        "Giá cổ phiếu giảm từ 50 xuống 30 đô la chỉ trong một tháng.",
        "Nếu bạn bật tùy chọn này, hệ thống sẽ tự động lưu lại mọi thay đổi sau mỗi lần chỉnh sửa."].map(x => (Array.isArray(x) ? x : [x]))) {
        const segs = heads(text, dur);
        assert.ok(segs.length >= 2, `not cut: ${text}`);
        for (let k = 1; k < segs.length; k++) {
            // inside a word, a term or a number the value is -3 or less; "xem xét | mạng" (a verb and
            // its object, -0.25) is the best this line has
            const v = P.boundaryValue(segs[k - 1].subtitleText, segs[k].subtitleText);
            assert.ok(v > -1, `${segs[k - 1].subtitleText} | ${segs[k].subtitleText}: ${v}`);
        }
        // the first request stays short: no piece over 1.5 x the 3.5 s head length
        assert.ok(segs.every(s => s.end - s.start <= 3.5 * 1.5 + 1e-6), segs.map(s => (s.end - s.start).toFixed(2)).join(" "));
    }
    assert.equal(heads("Chúng ta hãy xem xét mạng nơ-ron tích chập hai lớp.", 4.6)[0].subtitleText, "Chúng ta hãy xem xét");
});

test("engine: after a cut at a clause boundary without a comma the voice rests like a comma, inside a phrase it runs on", () => {
    const E = require("../dub-engine.js");
    const plan = (text, cont) => ({ phrases: [{ text, breakKind: null }], continuesNext: cont });
    assert.equal(E.gapAfter(plan("năm 2012 một nhóm nghiên cứu nhỏ tại Toronto", true), plan("đã tạo ra một mô hình mới.", false)), E.SYNC.joinGapClause);
    assert.equal(E.gapAfter(plan("để hiểu cách mô hình đưa ra", true), plan("quyết định cuối cùng.", false)), E.SYNC.joinGap);
    assert.equal(E.gapAfter(plan("khi chúng ta nhìn vào đường cong", true)), E.SYNC.joinGap, "no next plan known");
});

test("a 26+ syllable stretch with only weak boundaries still breathes once; a shorter one keeps its run", () => {
    // 2.1.6: corpus v2 (36 syllables, no boundary of value 0.35) was read in one run of up to 30
    const long = "Một trong những lý do khiến mô hình này hoạt động tốt là vì nó có thể tận dụng thông tin từ cả phía trước lẫn phía sau của câu trong cùng một lần xử lý.";
    const b = P.breathText(long);
    assert.equal((b.match(/,/g) || []).length, 1, b);
    assert.equal(b.replace(/,/g, ""), long, "only a comma is added");
    const short = "Các nhà nghiên cứu phát hiện ra rằng mô hình lớn hơn không phải lúc nào cũng tốt hơn.";
    assert.equal(P.breathText(short), short);
    // the shorter side may be 6 syllables now: "Do tốc độ học quá lớn, nên ..."
    assert.match(P.breathText("Do tốc độ học quá lớn nên hàm mất mát dao động liên tục và không giảm xuống được."), /^Do tốc độ học quá lớn, nên /);
});

test("VieNeu text: a long stretch gets its breathing comma, the audio key follows the text", () => {
    const E = require("../dub-engine.js");
    const long = "Khi chúng ta tăng kích thước của tập dữ liệu huấn luyện lên gấp mười lần thì sai số trên tập kiểm tra giảm xuống đáng kể nhưng thời gian huấn luyện cũng tăng lên tương ứng";
    const s = E.plainScript({ phrases: [{ text: long, breakKind: null }], continuesNext: false });
    assert.match(s, /mười lần, thì .* đáng kể, nhưng .* tương ứng\.$/);
    assert.equal(E.plainScript({ phrases: [{ text: "Tôi thử lại và kết quả tốt hơn", breakKind: null }], continuesNext: false }), "Tôi thử lại và kết quả tốt hơn.");
});

// ---- 1.8.2: constituent rules from the first blind split, each checked both ways ----
test("result 'nên' after a clause with its predicate is a clause boundary; 'should' is not invited", () => {
    assert.ok(gapAfter("Trời mưa rất to từ sáng nên buổi quay ngoài trời phải dời sang ngày mai.", "sáng").value >= 0.8);
    assert.ok(gapAfter("Vì trời mưa nên chúng tôi ở nhà cả ngày.", "mưa").value >= 0.8);
    for (const [text, word] of [["Doanh nghiệp nhỏ nên tập trung vào khách hàng quen.", "nhỏ"],
        ["Tôi nghĩ công ty nên đầu tư thêm vào đội ngũ kỹ thuật.", "ty"], ["Chúng ta nên bắt đầu từ dữ liệu.", "ta"]]) {
        const g = gapAfter(text, word);
        assert.ok(g.value < 0.3, `${word} | nên: ${g.value}`);
    }
});

test("relative 'mà' keeps a short clause with its noun; it ends where the main predicate resumes", () => {
    assert.ok(gapAfter("Chiếc máy mà tôi mua hôm qua đã bị hỏng.", "máy").value < 0);
    assert.ok(gapAfter("Cuốn sách mà tôi giới thiệu tuần trước đã hết hàng.", "sách").value < 0);
    // a long relative clause after a long noun phrase keeps its light boundary (unchanged)
    assert.ok(eligible(gapAfter("Mô hình dự đoán dựa trên toàn bộ ngữ cảnh mà nó đã nhìn thấy trước đó trong đoạn văn.", "cảnh")));
    // contrastive "mà" is not touched
    assert.ok(eligible(gapAfter("Mô hình mới không chỉ rẻ hơn mà còn nhanh hơn đáng kể.", "hơn")));
});

test("'so với' after a measured quantity is the standard of the comparison, not an adjunct", () => {
    assert.ok(gapAfter("Doanh thu tăng hai mươi phần trăm so với cùng kỳ năm ngoái.", "trăm").value < 0);
    assert.ok(gapAfter("Lượng khách tháng này cao gấp đôi so với năm ngoái.", "đôi").value < 0);
    assert.ok(gapAfter("Doanh thu tăng 20% so với cùng kỳ.", "20%").value < 0);
    // after a plain clause it stays an adjunct boundary
    assert.ok(eligible(gapAfter("Chúng tôi đã thay đổi cách làm việc so với những năm trước.", "việc")));
});

test("a long last list item may take a breath before 'và'; a short one or a subject list may not", () => {
    assert.ok(eligible(gapAfter("Bạn cần chuẩn bị hộ chiếu, ảnh thẻ và bản sao kê ngân hàng trong ba tháng gần nhất.", "thẻ")));
    assert.ok(!eligible(gapAfter("Apple, Microsoft và Google đều đang đầu tư mạnh vào trí tuệ nhân tạo.", "Microsoft")));
    assert.ok(!eligible(gapAfter("Bạn cần chuẩn bị hộ chiếu, ảnh thẻ và giấy khai sinh.", "thẻ")));
});

test("a purpose clause completing a short predicate is soft; two long sides keep the clause boundary", () => {
    for (const [text, word] of [["Mình ghé qua đây để mua ít cà phê thôi.", "đây"], ["Tôi dùng ChatGPT để phân tích dữ liệu.", "ChatGPT"],
        ["Chúng tôi dùng Adobe Premiere Pro để dựng toàn bộ video.", "Pro"]]) {
        const g = gapAfter(text, word);
        assert.ok(g.purposeAttached && g.value >= P.K.minValue && g.value < 0.5, `${word} | để: ${g.value}`);
    }
    // still a legal boundary: never a unit
    assert.ok(eligible(gapAfter("Tôi dùng ChatGPT để phân tích dữ liệu.", "ChatGPT")));
    for (const [text, word] of [["Tôi dùng ChatGPT để phân tích toàn bộ dữ liệu bán hàng của công ty trong ba tháng gần nhất.", "ChatGPT"],
        ["Nhóm nghiên cứu đã thu thập hơn mười nghìn bức ảnh để huấn luyện một mô hình nhận diện bệnh trên lá lúa.", "ảnh"]]) {
        assert.ok(gapAfter(text, word).value >= 0.8, word);
    }
});

test("a verb of effect after a long subject is invited (BACKLOG 16, syntax5); a second verb, a noun or a short subject is not", () => {
    for (const [text, word] of [["Kết quả thử nghiệm trên hai nghìn bệnh nhân chứng minh loại thuốc này an toàn.", "nhân"],
        ["Những bài tập thở đơn giản vào buổi tối cải thiện chất lượng giấc ngủ rõ rệt.", "tối"],
        ["Hệ thống gợi ý của các sàn thương mại điện tử ảnh hưởng đến quyết định mua hàng của người dùng.", "tử"],
        // "trẻ em" is a noun, not the pronoun "em" that would end the subject count
        ["Thói quen đọc sách mỗi ngày của trẻ em quyết định phần lớn vốn từ vựng sau này.", "em"]]) {
        const g = gapAfter(text, word);
        assert.ok(g.subjectEnd && g.value >= 0.3, `${word} | verb: ${g.value}`);
    }
    // the first predicate ends the subject: "quyết định" after "ảnh hưởng đến" is its object
    assert.ok(!eligible(gapAfter("Hệ thống gợi ý của các sàn thương mại điện tử ảnh hưởng đến quyết định mua hàng của người dùng.", "đến")));
    // a prepositional phrase inside that subject stays closed, now that the predicate is found
    assert.ok(gapAfter("Những bài tập thở đơn giản vào buổi tối cải thiện chất lượng giấc ngủ rõ rệt.", "giản").inSubject);
    assert.ok(!eligible(gapAfter("Nghiên cứu này thể hiện điều đó.", "này")));
    assert.ok(!eligible(gapAfter("Việc hạn chế thời gian dùng điện thoại giúp trẻ ngủ ngon hơn.", "Việc")));
});

test("a short subject with a place or topic phrase inside is invited before its verb; a verb particle is not that phrase", () => {
    const g = gapAfter("Độ chính xác trên tập kiểm tra đạt 95% sau mười lần huấn luyện.", "tra");
    assert.ok(g.subjectEnd && g.value >= 0.3, `tra | đạt: ${g.value}`);
    // "ghé qua": "qua" follows a verb, the gap before "giúp" stays legal but uninvited
    assert.ok(gapAfter("Hôm qua chú Phong ghé qua sửa giúp cái vòi nước bị rò.", "sửa").value < 0.3);
});
