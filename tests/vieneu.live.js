// Kiểm tra THẬT với máy chủ VieNeu đang chạy trên máy (không nằm trong npm test vì cần máy chủ).
// Chạy: nhấp đúp ~/VieNeu-TTS/cst-start.command, rồi: node tests/vieneu.live.js
// Dùng CHÍNH background.js + dub-engine.js; chỉ Gemini/Google được giả lập (không tốn tiền).
const assert = require("node:assert/strict");
const CACHE = require("../cst-cache.js");
const COST = require("../cost-policy.js");
const E = require("../dub-engine.js");
const seg = require("../vi-segmenter.js");
const { Clock, FakeVideo, FakeAudio } = require("./dub-sim.js");
const { bgEnv } = require("./bg-env.js");

const realFetch = (u, o) => (String(u).startsWith(COST.LOCAL_TTS.url) ? fetch(u, o) : Promise.reject(new Error("mạng ngoài bị tắt trong bài kiểm tra")));

(async () => {
    const backend = CACHE.memoryBackend();
    const B = bgEnv(realFetch, { modelsVersion: COST.MODELS_VERSION }, { backend });
    const st = await B.send({ action: "localTtsStatus" });
    assert.equal(st.running, true, "Máy chủ VieNeu chưa chạy");
    console.log("Máy chủ:", st.backend);

    // 1. Tạo audio cho một đoạn, lưu kho; gọi lại -> lấy từ kho, không tạo lại
    const text = "Tôi cũng thích vừa đi bộ vừa làm việc, nên đã tự chế một chiếc bàn chạy bộ tạm thời.";
    let t0 = Date.now();
    const r1 = await B.send({ action: "synthesizeSpeech", engine: "vieneu", text, voice: "Thùy Dung", parts: [{ key: "live-1", weight: 20 }] });
    assert.equal(r1.ok, true, r1.error);
    console.log(`Tạo audio: ${r1.parts[0].duration.toFixed(2)} giây lời nói trong ${((Date.now() - t0) / 1000).toFixed(2)} giây`);
    t0 = Date.now();
    const r2 = await B.send({ action: "synthesizeSpeech", engine: "vieneu", text, voice: "Thùy Dung", parts: [{ key: "live-1", weight: 20 }] });
    assert.equal(r2.fromCache, true);
    console.log(`Lần hai: lấy từ kho trong ${Date.now() - t0} ms`);

    // 2. Engine lồng tiếng thật: bài giảng ngắn, video giả chạy theo đồng hồ ảo
    const mk = (vi, s, e, en) => { const src = [{ start: s, end: e, text: en }]; return { start: s, end: e, srcCues: src, viText: vi, viCues: seg.segmentGroupSafe(vi, src) }; };
    const groups = [
        mk("Xin chào các bạn, hôm nay chúng ta sẽ tìm hiểu về mạng nơ-ron tích chập.", 0.5, 4.0, "Hello everyone, today we learn about CNNs."),
        mk("Đây là một khái niệm rất quan trọng, các bạn hãy ghi nhớ nhé.", 4.5, 7.5, "This is very important, remember it."),
        mk("Hóa ra mô hình bị quá khớp với dữ liệu huấn luyện.", 8.2, 10.5, "It turns out the model overfits.")
    ];
    const provider = E.createVieneuProvider({ sendMessage: m => B.send(m) }, { localVoice: "Thùy Dung" });
    assert.equal(await provider.init(), true);
    const clock = new Clock(), video = new FakeVideo(), audios = [];
    const eng = new E.DubEngine({
        video, getGroups: () => groups, providers: { primary: provider },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        createObjectURL: b => "blob:" + b.length, revokeObjectURL() {},
        createAudio: url => { const a = new FakeAudio(clock, { duration: 99 }); audios.push(a); return a; }
    }, { prefetchMax: 18 });
    eng.start();
    const wallStart = Date.now();
    // Chờ audio thật được tạo (thời gian thật), đồng hồ video đứng yên
    while (eng.rendered.size < groups.length && Date.now() - wallStart < 30000) {
        clock.advance(50);
        await new Promise(r => setTimeout(r, 50));
    }
    console.log(`Engine: ${eng.rendered.size}/${groups.length} đoạn có audio sau ${((Date.now() - wallStart) / 1000).toFixed(1)} giây, ${eng.stats.requests} lượt gọi, lỗi ${eng.stats.errors}`);
    assert.equal(eng.rendered.size, groups.length);
    for (const p of eng.plans) {
        const r = eng.rendered.get(p.id);
        console.log(`  đoạn ${p.index + 1}: audio ${r.duration.toFixed(2)} giây, khung ${p.targetDuration.toFixed(2)} giây, co giãn x${r.stretch.toFixed(2)}`);
    }
    eng.stop();
    // 3. ĐỘ ĐỀU CỦA NHỊP NÓI: bài giảng 22 câu thật, giọng Mỹ Duyên (đọc truyện, chậm)
    const { lectureGroups } = require("./dub-sim.js");
    const lecture = lectureGroups();
    const prov2 = E.createVieneuProvider({ sendMessage: m => B.send(m) }, { localVoice: "Mỹ Duyên", localVoice2: "Thái Sơn" });
    await prov2.init();
    const clock2 = new Clock(), video2 = new FakeVideo(), audios2 = [];
    const eng2 = new E.DubEngine({
        video: video2, getGroups: () => lecture, providers: { primary: prov2 },
        now: () => clock2.now(), setInterval: (f, ms) => clock2.setInterval(f, ms), clearInterval: id => clock2.clear(id),
        createObjectURL: b => "blob:" + b.length, revokeObjectURL() {},
        createAudio: url => { const a = new FakeAudio(clock2, { duration: 99 }); audios2.push(a); return a; }
    }, { prefetchMax: 18 });
    eng2.start();
    video2.play();
    // Video chạy theo thời gian THẬT (đồng hồ ảo tiến đúng bằng thời gian thực) để audio được
    // tạo đúng như khi xem thật; phát xong bài giảng thì dừng
    const end = lecture[lecture.length - 1].end + 4;
    let last = Date.now();
    while (video2.currentTime < end) {
        const now = Date.now();
        const step = Math.max(5, now - last);
        last = now;
        clock2.advance(step, st => { video2.step(st); audios2.forEach(a => a.step(st)); });
        await new Promise(r => setTimeout(r, 20));
    }
    const st2 = eng2.stats.started;
    if (process.env.DETAIL) for (const x of st2) {
        const p = eng2.planById.get(x.id), r = eng2.rendered.get(x.id);
        console.log(`  t=${x.t.toFixed(2)} hạn=${x.due.toFixed(2)} trễ=${x.lag.toFixed(2)} x${x.rate.toFixed(2)} audio=${r ? r.duration.toFixed(2) : "?"} khung=${p.targetDuration.toFixed(2)} hết lời=${x.speechEnd.toFixed(2)} hết phụ đề=${x.cueEnd.toFixed(2)}`);
    }
    const rates = st2.map(x => x.rate);
    const jumps = rates.slice(1).map((r, i) => Math.abs(r - rates[i]));
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const sd = Math.sqrt(rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length);
    // Cách CŨ (1.1.10) tính cho cùng audio: co giãn riêng từng câu theo khung, trần 1,15; + đuổi kịp tới 1,3
    const old = eng2.plans.filter(p => eng2.rendered.has(p.id)).map((p, i, arr) => {
        const r = eng2.rendered.get(p.id);
        const next = eng2.plans[eng2.plans.indexOf(p) + 1];
        const slot = Math.max(0.3, p.targetDuration, next ? next.start - p.start - 0.1 : Infinity);
        return r.duration > slot ? Math.min(1.15, r.duration / slot) : 1;
    });
    const oldJumps = old.slice(1).map((r, i) => Math.abs(r - old[i]));
    const oldMean = old.reduce((a, b) => a + b, 0) / old.length;
    const oldSd = Math.sqrt(old.reduce((a, b) => a + (b - oldMean) ** 2, 0) / old.length);
    const lags = st2.map(x => x.lag);
    console.log(`Nhịp nói (Mỹ Duyên, ${rates.length}/${eng2.plans.length} câu được nói, bỏ ${eng2.stats.dropped}, trễ tối đa ${Math.max(...lags).toFixed(2)} giây):`);
    console.log(`  MỚI: tốc độ trung bình x${mean.toFixed(3)}, độ lệch chuẩn ${sd.toFixed(3)}, thấp nhất x${Math.min(...rates).toFixed(2)}, cao nhất x${Math.max(...rates).toFixed(2)}, bước nhảy lớn nhất ${Math.max(...jumps).toFixed(3)}`);
    console.log(`  CŨ : tốc độ trung bình x${oldMean.toFixed(3)}, độ lệch chuẩn ${oldSd.toFixed(3)}, thấp nhất x${Math.min(...old).toFixed(2)}, cao nhất x${Math.max(...old).toFixed(2)}, bước nhảy lớn nhất ${Math.max(...oldJumps).toFixed(3)}`);
    const sps = eng2.plans.filter(p => eng2.rendered.has(p.id)).map(p => p.phrases.reduce((a, ph) => a + ph.syl, 0) / eng2.rendered.get(p.id).duration);
    const effMean = sps.reduce((a, b) => a + b, 0) / sps.length;
    console.log(`  Giọng Mỹ Duyên đo được: ${effMean.toFixed(2)} âm tiết/giây (audio đã rút khoảng lặng dài); sàn x${eng2.floorRate({ speaker: "S1" }).toFixed(3)}, trung bình x${mean.toFixed(3)} -> nghe ${(effMean * mean).toFixed(2)} âm tiết/giây`);
    eng2.stop();
    assert.ok(eng2.stats.dropped === 0, "không được bỏ câu");
    assert.ok(Math.max(...jumps) <= 0.101, "nhịp đổi đột ngột giữa hai câu");

    // 4. THỰC TẾ KHI MỞ VIDEO: bản dịch về dần, KHÔNG theo thứ tự (2 luồng dịch song song, mỗi
    // lượt 3 nhóm mất 1,5 đến 3 giây, thỉnh thoảng lỗi phải dịch lại). Đo: thời gian tới tiếng
    // đầu tiên, khoảng im bất thường (câu tới giờ mà chưa có tiếng), câu bị bỏ.
    {
        const lec = lectureGroups().map(g => ({ ...g }));
        const got = new Set();
        const prov3 = E.createVieneuProvider({ sendMessage: m => B.send(m) }, { localVoice: "Mỹ Duyên", localVoice2: "Thái Sơn" });
        const clock3 = new Clock(), video3 = new FakeVideo(), audios3 = [];
        const eng3 = new E.DubEngine({
            video: video3, getGroups: () => lec.filter((g, i) => got.has(i)), providers: { primary: prov3 },
            now: () => clock3.now(), setInterval: (f, ms) => clock3.setInterval(f, ms), clearInterval: id => clock3.clear(id),
            createObjectURL: b => "blob:" + b.length, revokeObjectURL() {},
            createAudio: url => { const a = new FakeAudio(clock3, { duration: 99 }); audios3.push(a); return a; }
        }, { prefetchMax: 18 });
        const wall0 = Date.now();
        await prov3.init();
        eng3.start();
        video3.play();
        // Người dịch giả: ưu tiên nhóm gần vị trí xem nhất, 2 luồng, về lộn thứ tự
        const inflight = new Set();
        let fails = 0;
        const worker = async () => {
            while (got.size < lec.length && video3.currentTime < lec[lec.length - 1].end) {
                const cur = video3.currentTime;
                const cand = lec.map((g, i) => i).filter(i => !got.has(i) && !inflight.has(i) && lec[i].end > cur - 5)
                    .sort((a, b) => Math.abs(lec[a].start - cur - 3) - Math.abs(lec[b].start - cur - 3));
                if (!cand.length) { await new Promise(r => setTimeout(r, 200)); continue; }
                const batch = cand.slice(0, 3);
                batch.forEach(i => inflight.add(i));
                await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
                if (Math.random() < 0.15) { fails++; await new Promise(r => setTimeout(r, 2000)); }   // lỗi, dịch lại
                batch.forEach(i => { inflight.delete(i); got.add(i); });
            }
        };
        const workers = [worker(), worker()];
        const end3 = lec[lec.length - 1].end + 4;
        let last = Date.now(), firstSpeechWall = null;
        while (video3.currentTime < end3) {
            const now = Date.now();
            const step = Math.max(5, now - last);
            last = now;
            clock3.advance(step, st => { video3.step(st); audios3.forEach(a => a.step(st)); });
            if (firstSpeechWall == null && eng3.stats.started.length) firstSpeechWall = (Date.now() - wall0) / 1000;
            await new Promise(r => setTimeout(r, 20));
        }
        await Promise.all(workers);
        const st3 = eng3.stats.started;
        // Khoảng im bất thường: câu bắt đầu muộn hơn hạn > 1 giây
        const late = st3.filter(x => x.lag > 1);
        console.log(`Mở video (bản dịch về lộn thứ tự, ${fails} lượt dịch lỗi): tiếng đầu tiên sau ${firstSpeechWall != null ? firstSpeechWall.toFixed(1) : "?"} giây, đọc ${st3.length}/${eng3.plans.length} câu, bỏ ${eng3.stats.dropped}, câu trễ > 1 giây: ${late.length} (tối đa ${Math.max(0, ...st3.map(x => x.lag)).toFixed(2)} giây), lượt tạo audio ${eng3.stats.requests}`);
        eng3.stop();
        assert.ok(eng3.stats.requests <= eng3.plans.length + 2, "tạo lại audio nhiều lần");
    }

    const stats = await B.send({ action: "costStats" });
    console.log(`Thống kê: VieNeu ${stats.day.localSec.toFixed(1)} giây audio, chi phí giọng AI ${stats.day.ttsUsd} USD`);
    assert.equal(stats.day.ttsUsd, 0);
    console.log("ĐẠT");
})().catch(e => { console.error("LỖI:", e.message); process.exit(1); });
