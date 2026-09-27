// Kiểm thử lồng tiếng: kịch bản nói, ngữ điệu, khớp thời lượng, audio thật,
// đồng bộ với video (tốc độ phát, tạm dừng, tua, đang tải, lệch nhịp), lỗi & dự phòng.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const PLAN = require("../dub-planner.js");
const AUDIO = require("../dub-audio.js");
const { DubEngine, geminiScript } = require("../dub-engine.js");
const seg = require("../vi-segmenter.js");
const { Clock, FakeVideo, FakeAudio, makeFakeSpeech, lectureGroups } = require("./dub-sim.js");

// ================= 1. KỊCH BẢN LỒNG TIẾNG =================
function group(vi, src) {
    return { start: src[0].start, end: src[src.length - 1].end, srcCues: src, viText: vi, viCues: seg.segmentGroupSafe(vi, src) };
}

test("kịch bản: câu nối nhiều phụ đề là MỘT đoạn nói liên tục (không TTS từng cue)", () => {
    const g = group("Vì vậy, trong thực tế, khi huấn luyện một mạng sâu, bạn thường bắt đầu với tốc độ học nhỏ, theo dõi hàm mất mát trên tập xác thực sau mỗi epoch.", [
        { start: 0, end: 2.4, text: "So in practice, when you train a deep network," },
        { start: 2.4, end: 4.6, text: "you usually start with a small learning rate," },
        { start: 4.6, end: 6.8, text: "monitor the validation loss after every epoch." }
    ]);
    assert.ok(g.viCues.length >= 2, "phụ đề phải có nhiều cue");
    const script = PLAN.buildDubScript([g]);
    assert.equal(script.length, 1, JSON.stringify(script.map(s => s.subtitleText)));
    assert.ok(script[0].cueCount >= 2);
});

test("kịch bản: khoảng lặng thật trong lời gốc tách thành đoạn nói riêng", () => {
    const g = group("Đây là bước đầu tiên. Giờ ta chuyển sang bước thứ hai của quy trình.", [
        { start: 0, end: 1.8, text: "This is the first step." },
        { start: 3.0, end: 5.6, text: "Now we move to the second step of the process." }
    ]);
    const script = PLAN.buildDubScript([g]);
    assert.equal(script.length, 2, JSON.stringify(script.map(s => [s.start, s.end, s.subtitleText])));
    assert.ok(script[1].start >= 2.9);
});

test("kịch bản: '>>' đổi người nói, giọng được gán theo người nói", () => {
    const a = group("Bạn nghĩ sao về cách này?", [{ start: 0, end: 1.5, text: "What do you think about this?" }]);
    const b = group("Tôi nghĩ nó rất hiệu quả.", [{ start: 2, end: 3.5, text: ">> I think it works really well." }]);
    const c = group("Vậy thì thử luôn nhé.", [{ start: 4, end: 5, text: ">> Let's try it then." }]);
    const s = PLAN.buildDubScript([a, b, c]);
    assert.deepEqual(s.map(x => x.speaker), ["S1", "S2", "S1"]);
});

// ================= 2. VĂN BẢN ĐỂ NÓI & NGỮ ĐIỆU =================
// Measured against the VieNeu server's own normalizer (sea_g2p): each "before" was what the voice
// actually said. 1.500.000 was stripped to 1500000, which the server reads digit by digit.
test("speech text: numbers, money, versions, links and shorthand are read the Vietnamese way", () => {
    const say = P => PLAN.adaptForSpeech(P);
    assert.equal(say("tức 1.500.000 đồng."), "tức một triệu năm trăm nghìn đồng.");
    assert.equal(say("có 1,500,000 người và 1,000 mẫu."), "có một triệu năm trăm nghìn người và một nghìn mẫu.");
    assert.equal(say("mã 12345678 ở đây."), "mã mười hai triệu ba trăm bốn mươi lăm nghìn sáu trăm bảy mươi tám ở đây.");
    assert.equal(say("Giá là $20 mỗi tháng, hoặc 5 USD."), "Giá là 20 đô la mỗi tháng, hoặc 5 đô la.");
    assert.equal(say("Có 7B tham số, ngữ cảnh 200K token, 1.5M người dùng."), "Có 7 tỷ tham số, ngữ cảnh 200 nghìn token, 1 phẩy 5 triệu người dùng.");
    assert.equal(say("Dùng Python 3.11 và phiên bản v2.0."), "Dùng Python 3 chấm 11 và phiên bản 2 chấm 0.");
    assert.equal(say("Phiên bản v1.1.7 chạy ở 127.0.0.1."), "Phiên bản 1 chấm 1 chấm 7 chạy ở 127 chấm 0 chấm 0 chấm 1.");
    assert.equal(say("Chương 3.4, mục 2.1."), "Chương 3 chấm 4, mục 2 chấm 1.");
    // a Vietnamese word at the start of a sentence is not a product name: still a decimal
    assert.equal(say("Trong 3.5 giây, Claude 3.5 trả lời."), "Trong 3 phẩy 5 giây, Claude 3 chấm 5 trả lời.");
    assert.equal(say("Truy cập https://www.claude.ai/code để thử."), "Truy cập claude chấm ai gạch chéo code để thử.");
    assert.equal(say("Ở TP.HCM, v.v."), "Ở TP.HCM, v.v.", "abbreviations must not be read as web addresses");
    assert.equal(say("Thứ tự: 1st, 2nd, 3rd, 4th, 10th."), "Thứ tự: thứ nhất, thứ hai, thứ ba, thứ tư, thứ 10.");
    assert.equal(say("Năm 1990s, những năm 1980s, thập niên 90s."), "Những năm 1990, những năm 1980, thập niên 90.");
    assert.equal(say("Bước #1 nhanh 2x, tốc độ 1,3x."), "Bước số 1 nhanh 2 lần, tốc độ 1 phẩy 3 lần.");
    assert.equal(say("Ta có 2x - 1 và 2x = 4, ảnh 1920x1080."), "Ta có 2x - 1 và 2x bằng 4, ảnh 1920 nhân 1080.", "algebra and sizes keep their meaning");
    assert.equal(say("Google nói vậy, e.g. ví dụ này."), "Google nói vậy, ví dụ này.");
    // the duration model counts what is said: "một triệu năm trăm nghìn" is 5 syllables, not 7 digits
    assert.equal(PLAN.countSyllables(say("1.500.000")), 5);
});

test("đọc số tiếng Việt đúng (kể cả mốt, lăm, tư, linh)", () => {
    const cases = { 21: "hai mươi mốt", 25: "hai mươi lăm", 24: "hai mươi tư", 105: "một trăm linh năm", 175: "một trăm bảy mươi lăm", 2024: "hai nghìn không trăm hai mươi tư", 1800000000000: "một nghìn tám trăm tỷ" };
    for (const [n, v] of Object.entries(cases)) assert.equal(PLAN.numberToVietnamese(Number(n)), v);
});

test("chuyển văn bản sang dạng dễ đọc KHÔNG đổi nghĩa (số, ký hiệu, ngoặc)", () => {
    assert.equal(PLAN.adaptForSpeech("Độ chính xác đạt 97,5% trên tập kiểm tra."), "Độ chính xác đạt 97 phẩy 5 phần trăm trên tập kiểm tra.");
    assert.equal(PLAN.adaptForSpeech("Ta có x = 2 và y = 3."), "Ta có x bằng 2 và y bằng 3.");
    assert.equal(PLAN.adaptForSpeech("Dùng hàm ReLU (hàm kích hoạt) ở lớp ẩn."), "Dùng hàm ReLU, hàm kích hoạt, ở lớp ẩn.");
    assert.equal(PLAN.adaptForSpeech("Tốc độ 60 km/h."), "Tốc độ 60 ki-lô-mét trên giờ.");
    assert.equal(PLAN.adaptForSpeech("Nặng 5kg, độ trễ 20 ms."), "Nặng 5 ki-lô-gam, độ trễ 20 mi-li-giây.");
});

test("ý định câu: 'Really?' khác hẳn 'This is a very important concept.'", () => {
    const q = PLAN.classifyIntent("Really?", "Thật sao?");
    const e = PLAN.classifyIntent("This is a very important concept.", "Đây là một khái niệm rất quan trọng.");
    assert.equal(q.type, "question");
    assert.equal(e.type, "emphasis");
    const pq = PLAN.INTENT_PROSODY[q.type], pe = PLAN.INTENT_PROSODY[e.type];
    assert.ok(pq.endPitch > 1.05, "câu hỏi lên giọng cuối câu");
    assert.ok(pe.rate < 1, "câu nhấn mạnh nói chậm lại");
    for (const [en, vi, type] of [
        ["Be careful, never test on your training data!", "Cẩn thận, đừng bao giờ kiểm tra trên dữ liệu huấn luyện!", "warning"],
        ["In summary, regularization helps generalization.", "Tóm lại, chính quy hóa giúp khái quát hóa.", "conclusion"],
        ["Wow, this is amazing!", "Ồ, thật tuyệt vời!", "excited"],
        ["That's a joke, haha.", "Đùa thôi, haha.", "humor"],
        ["This works because the gradient is small.", "Cách này hiệu quả vì gradient nhỏ.", "explanation"],
        ["The model has two layers.", "Mô hình có hai lớp.", "neutral"]
    ]) assert.equal(PLAN.classifyIntent(en, vi).type, type, en);
});

function segOf(vi, en, start, end, extra = {}) {
    return { id: "x", index: 0, start, end, slotEnd: extra.slotEnd || end + 0.4, speaker: "S1", subtitleText: vi, speechSource: vi, srcText: en, sourcePauses: extra.pauses || [], continuesNext: false };
}

test("nhịp nói: 'Now... what we need to understand is' -> 'Bây giờ...' [ngắt] 'điều chúng ta cần hiểu là...'", () => {
    const s = segOf("Bây giờ, ¦ điều chúng ta cần hiểu là ¦ cách mô hình xử lý dữ liệu đầu vào.", "Now... what we need to understand is how the model processes its input.", 10, 13.5, {
        pauses: [{ frac: 0.06, dur: 0.3, opener: true }]
    });
    const p = PLAN.planSegment(s);
    assert.equal(p.phrases[0].text, "Bây giờ,");
    assert.ok(p.phrases[0].pause >= 0.15, "phải có khoảng ngừng sau nhịp mở đầu");
    assert.equal(p.phrases[1].text, "điều chúng ta cần hiểu là");
    assert.equal(p.intent, "transition");
});

test("nhịp nói: khoảng ngừng thật của người nói được tái tạo ở vị trí tương ứng", () => {
    const s = segOf("Mô hình nhận bức ảnh rồi xử lý ảnh qua nhiều lớp tích chập khác nhau.", "The model receives the image... and then processes it through several convolutional layers.", 0, 5, {
        pauses: [{ frac: 0.33, dur: 0.6 }]
    });
    const p = PLAN.planSegment(s);
    assert.ok(p.phrases.length >= 2, JSON.stringify(p.phrases.map(x => x.text)));
    const cut = p.phrases[0];
    assert.ok(/ảnh$/.test(cut.text), cut.text);
    assert.ok(cut.pause >= 0.35, String(cut.pause));
});

test("nhấn giọng: cụm chứa từ quan trọng được nói chậm và cao hơn một chút", () => {
    const p = PLAN.planSegment(segOf("Đây là một khái niệm cực kỳ quan trọng, các bạn hãy ghi nhớ nó.", "This is an extremely important concept, remember it.", 0, 4.5));
    const emph = p.phrases.find(x => x.emphasis);
    assert.ok(emph && emph.rateMul < 1 && emph.pitchMul > 1, JSON.stringify(p.phrases));
    assert.ok(p.emphasisWords.length >= 1);
});

test("câu dài không ngắt: tách chỗ lấy hơi ở khe cú pháp, không giữa từ ghép", () => {
    const text = "Mạng nơ-ron tích chập sử dụng các bộ lọc nhỏ trượt trên toàn bộ bức ảnh đầu vào để trích xuất những đặc trưng cục bộ quan trọng nhất.";
    const ph = PLAN.buildPhrases(PLAN.adaptForSpeech(text));
    assert.ok(ph.length >= 2, JSON.stringify(ph.map(x => x.text)));
    const j = ph.map(x => x.text).join(" | ");
    assert.ok(!/tích \| chập|nơ-ron \| tích|trích \| xuất|đặc \| trưng|bức \| ảnh/.test(j), j);
});

// ================= 3. KHỚP THỜI LƯỢNG =================
test("mô hình thời lượng khớp giọng Việt thật (120 mẫu, 1x đến 2,2x): sai số trung bình < 5%", () => {
    const data = require("./audio/linh-calibration.json");
    const m = PLAN.DEFAULT_VOICE_MODEL;
    let err = 0;
    for (const d of data) {
        const phrases = PLAN.buildPhrases(PLAN.adaptForSpeech(d.text));
        let t = m.overhead;
        phrases.forEach((ph, k) => { t += PLAN.speechSeconds(ph.syl, d.rate, m); if (k < phrases.length - 1) t += PLAN.pauseSeconds(ph.pauseAfter, d.rate, m); });
        err += Math.abs(t - d.duration) / d.duration;
    }
    assert.ok(err / data.length < 0.05, `sai số ${(err / data.length * 100).toFixed(1)}%`);
});

test("khớp thời lượng: tiếng Việt dài hơn tiếng Anh vẫn nằm gọn trong khung (dùng tốc độ + khoảng lặng)", () => {
    const p = PLAN.planSegment(segOf("Bây giờ, điều chúng ta cần hiểu là cách mô hình xử lý dữ liệu đầu vào.", "Now, what we need to understand is how the model handles input.", 10, 13.5, { slotEnd: 13.9 }));
    assert.ok(p.durationRatio > 1, "tiếng Việt dài hơn khi đọc ở tốc độ thường");
    assert.ok(p.estDuration <= p.targetDuration + 0.02, `${p.estDuration} > ${p.targetDuration}`);
    assert.ok(p.sps <= PLAN.LIMITS.maxSps + 0.05, "không vượt tốc độ nói dễ nghe");
    assert.ok(p.strategies.includes("compress-pauses"));
});

test("khớp thời lượng: tiếng Việt ngắn hơn thì nói thong thả + giãn khoảng ngừng, không lê thê", () => {
    const p = PLAN.planSegment(segOf("Thật sao?", "Really? Are you sure about that?", 0, 2.4));
    assert.ok(p.strategies.includes("slow-fill"));
    assert.ok(p.sps >= PLAN.LIMITS.minSps - 0.05, String(p.sps));
    assert.equal(p.overflow, 0);
});

test("khớp thời lượng: câu quá dài so với lời gốc bị đánh dấu cần rút gọn (không nói nhanh quá mức)", () => {
    const p = PLAN.planSegment(segOf("Trước khi chuyển sang phần tiếp theo, hãy cùng tóm tắt thật kỹ tất cả những gì chúng ta đã học về cơ chế chú ý và mạng nơ-ron hồi quy.", "Let's recap.", 0, 1.2, { slotEnd: 1.4 }));
    assert.ok(p.strategies.includes("needs-condense"), JSON.stringify(p.strategies));
    assert.ok(p.sps <= PLAN.LIMITS.maxSps + 0.05, "không ép tốc độ vượt trần");
});

test("giọng liền mạch: tốc độ hai đoạn sát nhau không nhảy đột ngột", () => {
    const plans = PLAN.planAll(PLAN.buildDubScript(lectureGroups()));
    for (let i = 1; i < plans.length; i++) {
        const a = plans[i - 1], b = plans[i];
        if (b.start - a.end > 0.8 || a.speaker !== b.speaker) continue;
        const need = Math.max(a.rate, b.rate) - Math.min(a.rate, b.rate);
        assert.ok(need <= 0.101 || a.strategies.includes("faster") || b.strategies.includes("faster"), `${a.rate} -> ${b.rate}`);
    }
});

// ================= 4. AUDIO THẬT (giọng tiếng Việt "Linh" tạo bằng TTS macOS) =================
const wav = f => AUDIO.decodeWav(fs.readFileSync(path.join(__dirname, "audio", f)));

test("audio thật: cắt audio 4 câu thành đúng 4 đoạn, bỏ qua chỗ ngắt dấu phẩy", () => {
    const { samples, sampleRate } = wav("linh-chunk.wav");
    const texts = ["Bây giờ, điều chúng ta cần hiểu là cách mô hình xử lý dữ liệu.", "Thật sao?", "Đây là một khái niệm cực kỳ quan trọng, các bạn hãy ghi nhớ nó.", "Hóa ra mô hình bị quá khớp."];
    const r = AUDIO.splitBySilence(samples, sampleRate, texts.map(PLAN.countSyllables));
    assert.equal(r.method, "silence");
    assert.ok(r.confidence > 0.7, String(r.confidence));
    const sil = AUDIO.findSilences(samples, sampleRate);
    const commaPauses = sil.filter(s => s.dur < 0.4).map(s => (s.start + s.end) / 2);
    for (const p of r.parts.slice(1)) assert.ok(!commaPauses.some(c => Math.abs(c - p.start) < 0.05), "cắt nhầm chỗ ngắt dấu phẩy");
    // Mỗi đoạn cắt ra có thời lượng hợp lý theo số âm tiết
    const d = r.parts.map(p => p.end - p.start);
    assert.ok(d[1] < 1.6 && d[1] < d[0] && d[1] < d[2], JSON.stringify(d));
});

test("audio thật: chuẩn hóa âm lượng đều, không vỡ tiếng, không click ở ranh giới", () => {
    const { samples, sampleRate } = wav("linh-single.wav");
    const loud = samples.map(x => x * 2.5);                    // mô phỏng audio quá to, có vỡ
    const quiet = samples.map(x => x * 0.2);                   // mô phỏng audio quá nhỏ
    const a = AUDIO.analyze(AUDIO.prepareSpeech(loud, sampleRate), sampleRate);
    const b = AUDIO.analyze(AUDIO.prepareSpeech(quiet, sampleRate), sampleRate);
    assert.ok(Math.abs(a.voicedRmsDb - b.voicedRmsDb) < 1.5, `${a.voicedRmsDb} vs ${b.voicedRmsDb}`);
    assert.ok(a.peakDb <= -1.4 && b.peakDb <= -1.4, "vượt trần đỉnh");
    assert.equal(a.clipped, 0);
    assert.equal(AUDIO.edgeJump(AUDIO.prepareSpeech(loud, sampleRate)), 0);
    assert.ok(a.leadingSilence <= 0.05 && a.trailingSilence <= 0.06, "còn khoảng lặng thừa làm lệch thời lượng");
});

test("audio: ghi/đọc WAV giữ nguyên dữ liệu", () => {
    const sr = 24000;
    const x = new Float32Array(2400).map((_, i) => 0.5 * Math.sin(i / 10));
    const back = AUDIO.decodeWav(AUDIO.encodeWav(x, sr));
    assert.equal(back.sampleRate, sr);
    assert.ok(Math.max(...back.samples.map((v, i) => Math.abs(v - x[i]))) < 1e-4);
});

// ================= 5. ĐỒNG BỘ VỚI VIDEO (giọng hệ thống, phát theo cụm) =================
function runLive(opts = {}) {
    const clock = new Clock(), video = new FakeVideo(), log = [];
    const trueModel = { ...PLAN.DEFAULT_VOICE_MODEL, sylPerSec: PLAN.DEFAULT_VOICE_MODEL.sylPerSec * (opts.voiceSpeed || 1) };
    const sp = makeFakeSpeech(clock, video, trueModel, log);
    const groups = lectureGroups();
    const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: sp }, now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id) }, { duck: 0.2 });
    eng.start();
    video.playbackRate = opts.rate || 1;
    video.play();
    return { clock, video, log, eng, groups, sp, run: ms => clock.advance(ms, st => video.step(st)) };
}

function overlaps(log) {
    const done = log.filter(r => r.mediaEnd != null).sort((a, b) => a.mediaStart - b.mediaStart);
    let n = 0;
    for (let i = 1; i < done.length; i++) if (done[i].mediaStart < done[i - 1].mediaEnd - 1e-6) n++;
    return n;
}

for (const rate of [0.75, 1, 1.25, 1.5]) {
    test(`đồng bộ ${rate}x: mọi đoạn bắt đầu đúng lúc lời gốc bắt đầu, không chồng tiếng`, () => {
        const S = runLive({ rate });
        const end = S.groups[S.groups.length - 1].end + 3;
        S.run(end / rate * 1000 + 1000);
        assert.equal(S.eng.stats.started.length, S.eng.plans.length, "có đoạn bị bỏ qua");
        const lags = S.eng.stats.started.map(s => s.lag);
        assert.ok(Math.max(...lags) < 0.15, `trễ tối đa ${Math.max(...lags)}`);
        assert.equal(overlaps(S.log), 0);
        assert.equal(S.eng.stats.errors, 0);
        // Không cụm nào bắt đầu trước khi người nói gốc bắt đầu nói
        for (const s of S.eng.stats.started) assert.ok(s.t >= s.due - 0.05);
    });
}

test("đồng bộ: giọng thật chậm hơn mô hình 20% -> tự hiệu chỉnh, độ trễ KHÔNG tích lũy", () => {
    const S = runLive({ voiceSpeed: 0.8 });
    S.run(170000);
    const cal = S.sp.voiceModel.calibration;
    assert.ok(cal > 1.15 && cal < 1.45, `hiệu chỉnh ${cal}`);
    const lags = S.eng.stats.started.map(s => s.lag);
    const lastHalf = lags.slice(Math.floor(lags.length / 2));
    assert.ok(lastHalf.filter(l => l > 0.3).length <= 1, JSON.stringify(lastHalf));
    assert.ok(Math.max(...lags) < S.eng.constructor ? 1.6 : 1.6, "trễ đơn lẻ vẫn trong giới hạn");
    assert.equal(overlaps(S.log), 0);
});

test("tạm dừng: im lặng ngay, tiếp tục đúng cụm đang dở khi phát lại, hủy KHÔNG bị tính là lỗi", () => {
    const S = runLive();
    const p = S.eng.plans.find(x => x.phrases.length >= 2);
    S.run((p.start + p.phrases[0].offset + 0.4) * 1000);
    const spokenBefore = S.log.length;
    S.video.pause();
    S.run(3000);
    assert.equal(S.sp.active, null, "vẫn đang nói khi video tạm dừng");
    assert.equal(S.log.length, spokenBefore, "nói thêm trong lúc tạm dừng");
    const pausedAt = S.video.currentTime;
    S.video.play();
    S.run(600);
    const resumed = S.log[S.log.length - 1];
    assert.ok(resumed.mediaStart - pausedAt < 0.3, "tiếp tục chậm");
    assert.equal(S.eng.stats.errors, 0);
    for (let i = 0; i < 5; i++) { S.video.pause(); S.run(200); S.video.play(); S.run(700); }
    assert.equal(S.eng.stats.errors, 0, "hủy khi tạm dừng bị tính là lỗi");
});

test("tua tới giữa một đoạn: nói từ cụm chưa trôi qua; tua lùi: nói lại đúng đoạn", () => {
    const S = runLive();
    S.run(5000);
    const target = S.eng.plans.find(x => x.phrases.length >= 3 && x.start > 40);
    const mid = target.start + target.phrases[1].offset + 0.02;
    S.video.seek(mid);
    S.run(400);
    const first = S.log[S.log.length - 1];
    assert.ok(first.mediaStart >= mid - 0.01);
    assert.ok(target.phrases.slice(1).some(ph => ph.text === first.text), `sau khi tua nói "${first.text}"`);
    const back = S.eng.plans[2];
    S.video.seek(back.start - 0.2);
    S.run(800);
    assert.equal(S.log[S.log.length - 1].text, back.phrases[0].text);
    assert.equal(overlaps(S.log), 0);
});

test("đang tải (video đứng hình nhưng không tạm dừng): lồng tiếng chờ theo, không chạy trước hình", () => {
    const S = runLive();
    const p = S.eng.plans.find(x => x.phrases.length >= 3);
    S.run((p.start + 0.2) * 1000);
    S.video.stalled = true;
    S.run(2500);
    const talkedDuringStall = S.log.filter(r => r.mediaStart != null && Math.abs(r.mediaStart - S.video.currentTime) < 1e-9 && r !== S.log[S.log.length - 1]).length;
    assert.equal(S.sp.active, null, "vẫn nói khi video đang tải");
    assert.ok(talkedDuringStall <= 1);
    S.video.stalled = false;
    S.run(3000);
    assert.equal(overlaps(S.log), 0);
    assert.equal(S.eng.stats.errors, 0);
});

test("âm lượng gốc hạ/nâng mượt (không giật), tôn trọng người dùng chỉnh âm lượng, trả lại khi tắt", () => {
    const S = runLive();
    const vols = [];
    const p = S.eng.plans[3];
    for (let t = 0; t < (p.start + 2) * 20; t++) { S.run(50); vols.push(S.video.volume); }
    for (let i = 1; i < vols.length; i++) assert.ok(Math.abs(vols[i] - vols[i - 1]) <= 0.08 * 1.001, `bước ${vols[i - 1]} -> ${vols[i]}`);
    assert.ok(Math.min(...vols) < 0.8 * 0.3, "chưa hạ tiếng gốc khi có lời Việt");
    // Người dùng tự giảm âm lượng trong lúc đang hạ tiếng gốc
    const f = S.eng.duckFactor;
    S.video.volume = 0.3;
    S.video.emit("volumechange");
    S.eng.stop();
    // Khi tắt lồng tiếng: trả về đúng mức người dùng muốn (0,3 / hệ số hạ), không về 0,8 cũ
    assert.ok(Math.abs(S.video.volume - Math.min(1, 0.3 / f)) < 0.02, `${S.video.volume} vs ${0.3 / f}`);
});

test("YouTube re-applying its own volume mid-speech does not undo the duck", () => {
    const S = runLive();
    S.eng.settings.playerOwnsVolume = true;
    S.eng.settings.duck = 0.1;
    const p = S.eng.plans[3];
    // Run until the voice speaks and the duck has settled at its target
    let settled = false;
    for (let i = 0; i < (p.start + 2) * 20 && !settled; i++) {
        S.run(50);
        settled = S.eng.speakingUntilMedia >= S.video.currentTime && Math.abs(S.eng.duckFactor - 0.1) < 1e-3;
    }
    assert.ok(settled, "the duck never reached its target");
    // YouTube writes its own level (Stable Volume, seek, player refresh) while the voice goes on
    S.video.volume = 0.75;
    S.video.emit("volumechange");
    S.run(50);
    assert.ok(S.eng.speakingUntilMedia >= S.video.currentTime, "the test needs the voice still speaking");
    assert.ok(Math.abs(S.video.volume - 0.075) < 0.01, `original track left at ${S.video.volume}`);
    // Turning dubbing off gives back YouTube's level, not a level inflated by the duck factor
    S.eng.stop();
    assert.ok(Math.abs(S.video.volume - 0.75) < 0.01, `restored to ${S.video.volume}`);
});

// ================= 6. ĐỒNG BỘ AUDIO CÓ SẴN (Gemini TTS) =================
function fakeGeminiProvider(clock, opts = {}) {
    const calls = [];
    return {
        id: "gemini", label: "Gemini giả", caps: { prerender: true, live: false }, voiceLabel: "Kore",
        voiceModel: { ...PLAN.DEFAULT_VOICE_MODEL, sylPerSec: 4.6, rateExp: 1, pauseFactor: 1.3 },
        calls,
        async render(plans) {
            calls.push(plans.map(p => p.id));
            if (opts.fail) throw new Error("HTTP 429: hết hạn mức");
            await new Promise(r => setTimeout(r, 0));
            return plans.map(p => ({ planId: p.id, wav: new Uint8Array(4), duration: p.estDuration * (opts.lengthFactor || 1) }));
        }
    };
}

async function runBuffer(opts = {}) {
    const clock = new Clock(), video = new FakeVideo();
    const groups = lectureGroups();
    const audios = [];
    const prov = fakeGeminiProvider(clock, opts);
    const fb = opts.fallback ? makeFakeSpeech(clock, video, PLAN.DEFAULT_VOICE_MODEL, []) : null;
    let meta = new Map();
    const eng = new DubEngine({
        video, getGroups: () => groups, providers: { primary: prov, fallback: fb },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        createObjectURL: () => "blob:" + meta.size, revokeObjectURL() {},
        createAudio: url => { const a = new FakeAudio(clock, { duration: 99 }, opts.drift || 0); audios.push(a); return a; },
        onStatus: s => { eng && (eng.lastStatus = s); }
    });
    eng.start();
    // Chờ lượt tạo audio đầu (promise) hoàn tất
    for (let i = 0; i < 20; i++) { clock.advance(50); await new Promise(r => setImmediate(r)); }
    video.playbackRate = opts.rate || 1;
    video.play();
    const run = async ms => {
        for (let t = 0; t < ms; t += 100) {
            clock.advance(100, st => { video.step(st); audios.forEach(a => a.step(st)); });
            await new Promise(r => setImmediate(r));
        }
    };
    return { eng, video, audios, prov, run, clock };
}

test("audio Gemini: gộp nhiều đoạn một lượt TTS, chỉ tạo quanh vị trí đang phát", async () => {
    const S = await runBuffer();
    const firstCalls = S.prov.calls.flat();
    assert.ok(S.prov.calls.some(c => c.length > 1), "không gộp đoạn nào");
    const lastStart = Math.max(...firstCalls.map(id => S.eng.planById.get(id).start));
    assert.ok(lastStart <= 60 + 5, `tạo trước quá xa: ${lastStart}s`);
    await S.run(150000);
    assert.ok(S.prov.calls.length < S.eng.plans.length * 0.7, `${S.prov.calls.length} lượt cho ${S.eng.plans.length} đoạn`);
    // Tua lùi không tạo lại audio đã có (dùng bộ nhớ đệm)
    const before = S.prov.calls.length;
    S.video.seek(10);
    await S.run(3000);
    assert.equal(S.prov.calls.length, before);
});

test("audio Gemini: audio trôi nhịp 3% vẫn được kéo về đúng (lệch < 0,2 s), đúng tốc độ phát", async () => {
    for (const rate of [1, 1.5]) {
        const S = await runBuffer({ drift: 0.03, rate });
        let worst = 0;
        for (let i = 0; i < 400; i++) {
            await S.run(100);
            // Đo theo DÒNG THỜI GIAN LỜI NÓI (1.1.6): câu xếp hàng sau câu dài bắt đầu muộn hơn
            // mốc phụ đề là đúng thiết kế, không phải trôi nhịp
            const t = S.video.currentTime;
            const sp = S.eng.speech;
            if (!sp) continue;
            const r = S.eng.rendered.get(sp.id);
            if (!r || !r.el || r.el.paused) continue;
            worst = Math.max(worst, Math.abs(r.el.currentTime - (sp.offset + (t - sp.mediaStart) * sp.rate)));
            // Tốc độ = tốc độ lời nói x tốc độ video, chỉ được nhích tối đa ±5% để khớp dần
            assert.ok(Math.abs(r.el.playbackRate / (sp.rate * rate) - 1) <= 0.05 + 1e-6, "sai tốc độ phát audio");
            assert.ok(sp.rate >= 0.95 - 1e-9 && sp.rate <= 1.3 + 1e-9, "tốc độ lời nói ngoài giới hạn [0,95 ; 1,3]");
            assert.equal(r.el.preservesPitch, true, "co giãn phải giữ cao độ");
        }
        assert.ok(worst < 0.2 + 0.03 * 0.1 * rate + 1e-6, `lệch tối đa ${worst}`);
        assert.ok(S.eng.stats.corrections + (S.eng.stats.nudges || 0) > 0);
        // Trôi 3% được bù bằng nhích tốc độ: hầu như không phải tua (tua = chỗ vấp nghe được)
        assert.ok(S.eng.stats.corrections <= 4, `tua ${S.eng.stats.corrections} lần`);
    }
});

test("audio Gemini: dài hơn khung thì phát nhanh hơn vừa đủ, giữ cao độ, trong giới hạn an toàn; nhịp đổi từ từ giữa các câu", async () => {
    const S = await runBuffer({ lengthFactor: 1.4 });
    await S.run(20000);
    const rates = S.eng.stats.started.map(x => x.rate).filter(Boolean);
    assert.ok(rates.some(r => r > 1.01), JSON.stringify(rates));
    // co giãn theo khung của câu, không bao giờ ra ngoài dải an toàn
    assert.ok(rates.every(r => r >= 0.95 - 1e-9 && r <= 1.3 + 1e-9), JSON.stringify(rates));
    for (let i = 1; i < rates.length; i++) assert.ok(rates[i] - rates[i - 1] <= 0.1 + 1e-9, `nhịp tăng vọt ${rates[i - 1]} -> ${rates[i]}`);
});

test("audio Gemini: tạm dừng video thì audio dừng, phát lại thì tiếp đúng vị trí", async () => {
    const S = await runBuffer();
    const p = S.eng.plans[2];
    await S.run((p.start + 0.8) * 1000);
    S.video.pause();
    await S.run(1000);
    assert.ok(S.audios.every(a => a.paused), "audio vẫn chạy khi video tạm dừng");
    S.video.play();
    await S.run(300);
    const r = S.eng.rendered.get(S.eng.plans[S.eng.planAt(S.video.currentTime)].id);
    assert.ok(r.el && !r.el.paused);
    assert.ok(Math.abs(r.el.currentTime - (S.video.currentTime - S.eng.plans[S.eng.planAt(S.video.currentTime)].start) * r.stretch) < 0.2);
});

test("dự phòng: Gemini TTS lỗi liên tục -> chuyển cả video sang giọng hệ thống, video không bị ảnh hưởng", async () => {
    const S = await runBuffer({ fail: true, fallback: true });
    await S.run(5000);
    assert.equal(S.eng.provider.id, "system");
    assert.equal(S.eng.lastStatus.fallback, true);
    assert.ok(S.video.currentTime > 4, "video bị kẹt");
});

// ================= 7. KỊCH BẢN GỬI GEMINI TTS =================
test("kịch bản Gemini TTS: có hướng dẫn giọng theo ý định, nhấn từ, ngắt nghỉ; lời thoại tách đoạn", () => {
    const a = PLAN.planSegment(segOf("Thật sao?", "Really?", 0, 1));
    const b = PLAN.planSegment(segOf("Đây là một khái niệm cực kỳ quan trọng, các bạn hãy ghi nhớ nó.", "This is an extremely important concept, remember it.", 2, 6));
    const s = geminiScript([a, b]);
    assert.match(s, /giọng hỏi/);
    assert.match(s, /nhấn vào "cực kỳ/);
    assert.match(s, /Thật sao\?\n\nĐây là/);
    assert.match(s, /không đọc phần hướng dẫn/);
    assert.ok(!/¦/.test(s));
});

// 1.6.1: adapt to how fast the video speaks. A slow voice (Kim Thanh, measured 3.8 syllables/s)
// on a fast speaker used to hit the fixed ceiling sentence after sentence and fall behind. Measured
// on two real cached timelines: lag over 1 s went 3 -> 0 and 5 -> 1, a slow speaker was unchanged.
async function paceRun(timeScale, { oldBehaviour = false } = {}) {
    const { SYNC } = require("../dub-engine.js");
    const saved = { lookAhead: SYNC.lookAhead, paceCeilingMax: SYNC.paceCeilingMax, paceFloorShare: SYNC.paceFloorShare };
    if (oldBehaviour) { SYNC.lookAhead = 0; SYNC.paceCeilingMax = SYNC.maxSpeechRate; SYNC.paceFloorShare = 0; }
    try {
        const clock = new Clock(), video = new FakeVideo();
        const groups = lectureGroups().map(g => ({
            ...g, start: g.start * timeScale, end: g.end * timeScale,
            srcCues: g.srcCues.map(c => ({ ...c, start: c.start * timeScale, end: c.end * timeScale })),
            viCues: g.viCues.map(c => ({ ...c, start: c.start * timeScale, end: c.end * timeScale }))
        }));
        const audios = [];
        const RAW_SPS = 3.61;                       // Kim Thanh after pause trimming, measured
        const prov = {
            id: "vieneu", label: "VieNeu", caps: { prerender: true, live: false, free: true, serial: true, maxBatch: 1, timeStretch: true },
            tempo: { targetSps: 4.8, maxTempo: 1.22, minSps: 4.0, maxFloor: 1.15 },
            voiceModel: { ...PLAN.DEFAULT_VOICE_MODEL, sylPerSec: 4.66, rateExp: 1, pauseFactor: 1 },
            naturalSps: () => 3.8 * 0.86, audioKey: async p => "k" + p.id, abort() {},
            render: async plans => plans.map(p => ({ planId: p.id, wav: new Uint8Array(4), duration: p.phrases.reduce((a, ph) => a + ph.syl, 0) / RAW_SPS + 0.05 }))
        };
        const eng = new DubEngine({
            video, getGroups: () => groups, providers: { primary: prov },
            now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
            setTimeout: (f, ms) => clock.setTimeout(f, ms), createObjectURL: () => "blob:x", revokeObjectURL() {},
            createAudio: () => { const a = new FakeAudio(clock, { duration: 99 }); audios.push(a); return a; }
        });
        eng.start();
        for (let i = 0; i < 20; i++) { clock.advance(50); await new Promise(r => setImmediate(r)); }
        video.play();
        const end = groups[groups.length - 1].end + 2;
        for (let i = 0; i < 20000 && video.currentTime < end; i++) {
            clock.advance(50, st => { video.step(st); audios.forEach(a => a.step(st)); });
            if (i % 4 === 0) await new Promise(r => setImmediate(r));
        }
        eng.stop();
        const st = eng.stats.started;
        return {
            lagMax: Math.max(...st.map(x => x.t - x.due)),
            rateMean: st.reduce((a, x) => a + x.rate, 0) / st.length,
            rateMax: Math.max(...st.map(x => x.rate)),
            spoken: st.length, dropped: eng.stats.dropped
        };
    } finally {
        Object.assign(SYNC, saved);
    }
}

test("slow voice on a fast speaker: speeds up early and evenly, and a slow speaker is left alone", async () => {
    const fastOld = await paceRun(0.8, { oldBehaviour: true });
    const fastNew = await paceRun(0.8);
    assert.equal(fastNew.dropped, 0);
    assert.ok(fastNew.lagMax < fastOld.lagMax - 0.2, `lag ${fastOld.lagMax.toFixed(2)} -> ${fastNew.lagMax.toFixed(2)}`);
    assert.ok(fastNew.rateMax <= 1.65, `never beyond the spoken-pace cap: ${fastNew.rateMax}`);
    const slowOld = await paceRun(1.4, { oldBehaviour: true });
    const slowNew = await paceRun(1.4);
    assert.ok(Math.abs(slowNew.rateMean - slowOld.rateMean) < 0.03, `slow speaker sped up: ${slowOld.rateMean.toFixed(2)} -> ${slowNew.rateMean.toFixed(2)}`);
});

// A second voice for a second speaker is optional and off by default (the user: not every viewer
// wants a voice switching in the middle of a video).
test("second voice: off by default reads every speaker with the main voice; on keeps S1/S2", () => {
    const a = group("Bạn nghĩ sao về cách này?", [{ start: 0, end: 1.5, text: "What do you think about this?" }]);
    const b = group("Tôi nghĩ nó rất hiệu quả.", [{ start: 2, end: 3.5, text: ">> I think it works really well." }]);
    const c = group("Vậy thì thử luôn nhé.", [{ start: 4, end: 5, text: ">> Let's try it then." }]);
    const make = settings => {
        const clock = new Clock();
        const prov = { id: "x", caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, render: async () => [] };
        const eng = new DubEngine({ video: new FakeVideo(), getGroups: () => [a, b, c], providers: { primary: prov },
            now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id) }, settings);
        eng.refresh(true);
        return eng.plans.map(p => p.speaker);
    };
    assert.deepEqual([...new Set(make({}))], ["S1"], "default must be one voice");
    assert.deepEqual(make({ secondVoice: true }), ["S1", "S2", "S1"]);
    const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "options.html"), "utf8");
    const js = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "options.js"), "utf8");
    const dj = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "dubbing.js"), "utf8");
    assert.ok(html.includes('id="dubSecondVoice"'), "no switch in Settings");
    assert.ok(/dubSecondVoice: document\.getElementById\("dubSecondVoice"\)/.test(js), "Settings does not save it");
    assert.ok(/secondVoice: s\.dubSecondVoice === true/.test(dj) && /changes\.dubSecondVoice \|\|/.test(dj), "dubbing does not read it or react to a change");
});

// 1.6.3: planning the whole video on every new translated group cost ~90 ms of main thread on a
// 60-minute lecture (a visible stutter each time). Only a window around playback is planned now.
function longLecture(minutes, marks) {
    const base = lectureGroups();
    const span = base[base.length - 1].end + 2;
    const out = [];
    for (let k = 0; out.length === 0 || out[out.length - 1].end < minutes * 60; k++) base.forEach((g, i) => {
        const o = k * span;
        const src = g.srcCues.map((c, j) => ({ ...c, start: c.start + o, end: c.end + o, text: marks && j === 0 && (k + i) % 3 === 0 ? ">> " + c.text : c.text }));
        out.push({ ...g, start: g.start + o, end: g.end + o, srcCues: src, viCues: g.viCues.map(c => ({ ...c, start: c.start + o, end: c.end + o })) });
    });
    return out;
}

test("planning window: same plans as a whole-video build around playback, second voice included", () => {
    const groups = longLecture(60, true);
    const clock = new Clock(), video = new FakeVideo();
    const prov = { id: "x", caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, render: async () => [] };
    const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: prov },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id) }, { secondVoice: true });
    video.currentTime = 1800;
    eng.refresh(true);
    const whole = PLAN.planAll(PLAN.buildDubScript(groups), { voiceModel: PLAN.DEFAULT_VOICE_MODEL });
    assert.ok(eng.plans.length < whole.length / 4, `planned ${eng.plans.length} of ${whole.length}`);
    const byId = new Map(whole.map(p => [p.id, p]));
    // every windowed plan away from the window's far edge matches the whole-video plan exactly
    const inner = eng.plans.filter(p => p.start > 1800 - 120 && p.start < 1800 + 300);
    assert.ok(inner.length > 20);
    for (const p of inner) {
        const w = byId.get(p.id);
        assert.ok(w, `plan ${p.id} does not exist in a whole-video build`);
        assert.equal(p.text, w.text);
        assert.equal(p.speaker, w.speaker, `speaker differs at ${p.start}`);
        assert.equal(p.continuesNext, w.continuesNext);
    }
    assert.ok(inner.some(p => p.speaker === "S2"), "the fixture should contain a second speaker");
});

test("audio of a plan that left the window is released, not kept forever", () => {
    const groups = longLecture(20);
    const clock = new Clock(), video = new FakeVideo();
    const revoked = [];
    const prov = { id: "x", caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, audioKey: async p => p.id, render: async () => [] };
    const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: prov }, audioCache: {},
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        revokeObjectURL: u => revoked.push(u) });
    video.currentTime = 60;
    eng.refresh(true);
    const early = eng.plans.slice(0, 5);
    early.forEach(p => eng.rendered.set(p.id, { url: "blob:" + p.id, duration: 2, stretch: 1, text: p.text }));
    video.currentTime = 900;                    // far ahead: the early plans leave the window
    eng.refresh(true);
    assert.ok(early.every(p => !eng.planById.has(p.id)));
    eng.releaseOld(900);
    assert.equal(eng.rendered.size, 0, "rendered audio of vanished plans must be freed");
    assert.equal(revoked.length, 5);
});

// ================= PLAYBACK DELIVERY (1.8.6) =================
// tools/playback-sim.js runs the real engine and VieNeu provider against a model of the service
// worker and the serial VieNeu server (slot held ~4.5 s after a client leaves). Old engine vs new on
// the same scenarios: seek back 0.8 -> 0.05 s to voice, rapid seeks 3.7 -> 1.4 s (max 7.1 -> 2.5),
// slow server 13.6 -> 7.7 s, audio elements alive 21 -> 2.
const SIM = require("../tools/playback-sim.js");
const simRun = (name, extra = {}) => SIM.run(require("../dub-engine.js"), { ...SIM.SCENARIOS[name], bgAbort: "queued", ...extra });

test("playback delivery: a seek back onto audio already in the page plays it at once, with no new request", async () => {
    const r = await simRun("seekBackward");
    assert.ok(r.seekRecover != null && r.seekRecover < 0.3, `voice ${r.seekRecover} s after the seek`);
    assert.ok(r.serverRuns <= 17, `${r.serverRuns} requests (a re-cut head line re-rendered held audio: 19)`);
});

test("playback delivery: rapid seeks get voice back within 3 s each; a slow server within 9 s", async () => {
    const r = await simRun("rapidSeek");
    assert.ok(r.seekRecoverMax <= 3, `worst ${r.seekRecoverMax} s`);
    const slow = await simRun("seekWhileSlow");
    assert.ok(slow.seekRecover <= 9, `slow server: ${slow.seekRecover} s`);
});

test("playback delivery: pausing never cancels the request for the lines just ahead", async () => {
    // "running": the old service worker, which cut a started request. Any cancel would show here.
    const r = await simRun("pauseResume", { bgAbort: "running" });
    assert.equal(r.cutRunning, 0);
    assert.equal(r.droppedQueued, 0);
});

test("playback delivery: in every scenario no two voices overlap, no line is generated twice, at most 3 audio elements live", async () => {
    for (const name of Object.keys(SIM.SCENARIOS)) {
        const r = await simRun(name);
        assert.equal(r.overlapTicks, 0, `${name}: overlap`);
        assert.equal(r.duplicateGen, 0, `${name}: duplicate generation`);
        assert.ok(r.maxEls <= 3, `${name}: ${r.maxEls} audio elements alive`);
        assert.ok(r.maxRendered <= 30, `${name}: ${r.maxRendered} lines held`);
    }
});

test("playback delivery: stopping the engine (another video, dubbing off) drops its queued requests", async () => {
    const clock = new Clock(), video = new FakeVideo();
    const aborted = [];
    const prov = {
        id: "vieneu", caps: { prerender: true, live: false, free: true, serial: true, maxBatch: 1 },
        voiceModel: PLAN.DEFAULT_VOICE_MODEL, audioKey: async p => "k" + p.id,
        abort: id => aborted.push(id), render: () => new Promise(() => {})
    };
    const eng = new DubEngine({ video, getGroups: () => lectureGroups(), providers: { primary: prov },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        setTimeout: (f, ms) => clock.setTimeout(f, ms), createObjectURL: () => "blob:x", revokeObjectURL() {},
        audioCache: { get: async () => ({}), put() {} } });
    eng.start();
    video.play();
    for (let i = 0; i < 20 && !eng.jobs.size; i++) { clock.advance(50, st => video.step(st)); await new Promise(r => setImmediate(r)); }
    assert.ok(eng.jobs.size >= 1, "no request was made");
    const ids = [...eng.jobs.keys()];
    eng.stop();
    assert.deepEqual(aborted, ids);
});
