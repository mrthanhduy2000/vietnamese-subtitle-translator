// Kiểm thử đợt hoàn thiện 1.1.6: quyền truy cập model theo API key, mở Cài đặt,
// tự nhận diện ngôn ngữ + tự dịch, lồng tiếng không bị cắt, ngân sách chi phí.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const COST = require("../cost-policy.js");
const LANG = require("../lang-detect.js");
const seg = require("../vi-segmenter.js");
const E_ENGINE = require("../dub-engine.js");
const { DubEngine } = E_ENGINE;
const { Clock, FakeVideo, FakeAudio } = require("./dub-sim.js");
const { bgEnv, read } = require("./bg-env.js");

const REQ = { action: "translateUnit", sentences: ["The model receives the image."], context: { domain: "AI" } };
const reply = obj => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
const GOOGLE_OK = { ok: true, status: 200, json: async () => [[["Bản Google", "x"]], null, "en"] };
const modelOf = u => (u.match(/models\/([^:]+):generateContent/) || [])[1];
const NEW_USER_404 = m => ({ ok: false, status: 404, statusText: "Not Found", json: async () => ({ error: { code: 404, status: "NOT_FOUND", message: `This model models/${m} is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite.` } }) });
const cfg = (extra = {}) => ({ geminiApiKey: "KEY-NEW-USER", modelsVersion: COST.MODELS_VERSION, ...extra });

// Máy chủ giả: danh sách model bị chặn theo TỪNG key (giống thực tế: key mới không gọi được 2.5)
function server(seen, blockedFor = { "KEY-NEW-USER": ["gemini-2.5-flash-lite", "gemini-2.5-flash-preview-tts"] }) {
    return async (u, o) => {
        if (!u.includes("generativelanguage")) return GOOGLE_OK;
        const m = modelOf(u);
        const key = o.headers["x-goog-api-key"];
        seen.push(m);
        if ((blockedFor[key] || []).includes(m)) return NEW_USER_404(m);
        const body = JSON.parse(o.body);
        if (body.generationConfig.responseModalities) {
            const pcm = Buffer.alloc(24000 * 2 * 2);
            for (let i = 0; i < 24000 * 2; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 6) * 9000), i * 2);
            return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: pcm.toString("base64") } }] } }] }) };
        }
        return reply({ t: [`bản của ${m}`] });
    };
}

// ================= 1. GEMINI 2.5 FLASH-LITE: QUYỀN TRUY CẬP THEO API KEY =================
test("key CÓ quyền 2.5: chế độ Tự động dùng 2.5 (rẻ nhất)", async () => {
    const seen = [];
    const r = await bgEnv(server(seen), cfg({ geminiApiKey: "KEY-OLD-USER" })).send(REQ);
    assert.equal(r.model, "gemini-2.5-flash-lite");
    assert.deepEqual(seen, ["gemini-2.5-flash-lite"]);
});

test("key mới: 2.5 trả 404 'no longer available to new users' -> ghi nhận MODEL_UNAVAILABLE_FOR_KEY, dùng ngay 3.1 trong CÙNG yêu cầu, phụ đề sau KHÔNG thử lại 2.5", async () => {
    const seen = [];
    const local = {};
    const E = bgEnv(server(seen), cfg(), { local });
    const r1 = await E.send(REQ);
    assert.equal(r1.engine, "gemini", "không được rơi xuống Google khi 3.1 vẫn dùng được");
    assert.equal(r1.model, "gemini-3.1-flash-lite");
    assert.equal(r1.fallbackFrom, "gemini-2.5-flash-lite");
    for (let i = 0; i < 5; i++) await E.send({ ...REQ, sentences: [`Subtitle number ${i}.`] });
    assert.deepEqual(seen, ["gemini-2.5-flash-lite", ...Array(6).fill("gemini-3.1-flash-lite")], "mỗi phụ đề lại thử 2.5");
    // Lưu theo mã băm của key, KHÔNG lưu key
    const saved = JSON.stringify(local.modelAccess);
    assert.ok(saved.includes("gemini-2.5-flash-lite") && saved.includes("unavailable"));
    assert.ok(!saved.includes("KEY-NEW-USER"), "không được lưu API key");
    assert.ok(saved.includes("gemini-3.5-flash-lite"), "ghi lại model Google đề nghị");
});

test("tải lại tiện ích (service worker mới, cùng storage): vẫn nhớ 2.5 không khả dụng, không gọi lại; hết hạn thì thử lại", async () => {
    const seen = [];
    const local = {};
    await bgEnv(server(seen), cfg(), { local }).send(REQ);
    seen.length = 0;
    const B = bgEnv(server(seen), cfg(), { local });
    const r = await B.send({ ...REQ, sentences: ["After reload."] });
    assert.equal(r.model, "gemini-3.1-flash-lite");
    assert.deepEqual(seen, ["gemini-3.1-flash-lite"]);
    // Hết thời hạn ghi nhớ: thử lại 2.5 (quyền truy cập có thể đã thay đổi)
    for (const kh of Object.keys(local.modelAccess)) local.modelAccess[kh]["gemini-2.5-flash-lite"].until = Date.now() - 1;
    seen.length = 0;
    await bgEnv(server(seen), cfg(), { local }).send({ ...REQ, sentences: ["After expiry."] });
    assert.equal(seen[0], "gemini-2.5-flash-lite");
});

test("key/dự án KHÁC có quyền 2.5: vẫn chọn và dùng được 2.5 (trạng thái tính theo từng key)", async () => {
    const seen = [];
    const local = {};
    await bgEnv(server(seen), cfg(), { local }).send(REQ);                                   // key mới: 2.5 bị chặn
    seen.length = 0;
    const r = await bgEnv(server(seen), cfg({ geminiApiKey: "KEY-OLD-USER", geminiModel: "gemini-2.5-flash-lite" }), { local }).send(REQ);
    assert.equal(r.model, "gemini-2.5-flash-lite");
    assert.deepEqual(seen, ["gemini-2.5-flash-lite"]);
});

test("Cài đặt phản ánh trạng thái: 2.5 'không khả dụng' với key mới, model thực tế = 3.1; key khác chưa rõ -> Tự động dùng 2.5", async () => {
    const local = {};
    const E = bgEnv(server([]), cfg(), { local });
    await E.send(REQ);
    const st = await E.send({ action: "modelStatus" });
    assert.equal(st.models["gemini-2.5-flash-lite"].state, "unavailable");
    assert.equal(st.models["gemini-3.1-flash-lite"].state, "ok");
    assert.equal(st.effective.cheap, "gemini-3.1-flash-lite");
    const other = await E.send({ action: "modelStatus", key: "KEY-OLD-USER" });
    assert.equal(other.models["gemini-2.5-flash-lite"].state, "unknown");
    assert.equal(other.effective.cheap, "gemini-2.5-flash-lite");
});

test("Kiểm tra Key trong Cài đặt: gọi generateContent THẬT theo chuỗi model, báo model trả lời và model bị bỏ qua", async () => {
    const seen = [];
    const E = bgEnv(server(seen), cfg());
    const r = await E.send({ action: "testKey", key: "KEY-NEW-USER", model: "auto" });
    assert.equal(r.ok, true);
    assert.equal(r.model, "gemini-3.1-flash-lite");
    assert.deepEqual([...r.skipped], ["gemini-2.5-flash-lite"]);
    const r2 = await E.send({ action: "testKey", key: "KEY-OLD-USER", model: "gemini-2.5-flash-lite" });
    assert.equal(r2.model, "gemini-2.5-flash-lite");
});

test("TTS: key mới không dùng được 2.5 TTS -> dùng 3.1 TTS, ghi nhớ, lượt sau không thử lại 2.5 TTS", async () => {
    const seen = [];
    const E = bgEnv(server(seen), cfg());
    const T = { action: "synthesizeSpeech", text: "Xin chào các bạn.", voice: "Kore", parts: [{ key: "a1", weight: 5 }] };
    const r = await E.send(T);
    assert.equal(r.ok, true);
    assert.equal(r.model, "gemini-3.1-flash-tts-preview");
    await E.send({ ...T, text: "Câu khác.", parts: [{ key: "a2", weight: 3 }] });
    assert.deepEqual(seen, ["gemini-2.5-flash-preview-tts", "gemini-3.1-flash-tts-preview", "gemini-3.1-flash-tts-preview"]);
    const st = await E.send({ action: "modelStatus" });
    assert.equal(st.effective.tts, "gemini-3.1-flash-tts-preview", "khóa kho audio phải theo model TTS thật sự dùng");
});

test("model có lịch ngừng: 3.1 hiện ngày ngừng + model thay thế; qua ngày ngừng thì tự dùng model thay thế, không chờ API lỗi", () => {
    const m = COST.findModel("gemini-3.1-flash-lite");
    assert.equal(m.shutdown, "2027-05-07");
    assert.equal(m.replacement, "gemini-3.5-flash-lite");
    const c = { cheap: "gemini-3.1-flash-lite", strong: "gemini-3.5-flash-lite" };
    assert.equal(COST.modelChain("cheap", c, "balanced", () => false, "2027-01-01")[0], "gemini-3.1-flash-lite");
    const after = COST.modelChain("cheap", c, "balanced", () => false, "2027-05-07");
    assert.equal(after[0], "gemini-3.5-flash-lite");
    assert.ok(!after.includes("gemini-3.1-flash-lite"));
});

// ================= 2. MỞ TRANG CÀI ĐẶT =================
test("mở Cài đặt: tin nhắn openOptions tới service worker -> chrome.runtime.openOptionsPage()", async () => {
    const E = bgEnv(async () => reply({}), cfg());
    const r = await E.send({ action: "openOptions" });
    assert.deepEqual({ ...r }, { ok: true, via: "openOptionsPage" });
    assert.deepEqual(E.opened, ["openOptionsPage"]);
});

test("mở Cài đặt: openOptionsPage lỗi -> service worker mở tab options.html của chính tiện ích", async () => {
    const E = bgEnv(async () => reply({}), cfg(), { openOptionsPage: async () => { throw new Error("Could not create an options page."); } });
    const r = await E.send({ action: "openOptions" });
    assert.equal(r.ok, true);
    assert.equal(r.via, "tabs.create");
    assert.deepEqual(E.opened, ["chrome-extension://test-id/options.html"]);
});

function pageEnv(opts = {}) {
    const noop = () => {};
    const sent = [], opened = [];
    const sandbox = {
        console: { log: noop, warn: noop, error: noop }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop, URL,
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number, TextEncoder, crypto: globalThis.crypto,
        location: { href: "https://www.youtube.com/watch?v=abc123", hostname: "www.youtube.com", pathname: "/watch" },
        document: { readyState: "loading", title: "t", body: {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], getElementsByTagName: () => [], createElement: () => ({ style: {}, appendChild: noop, addEventListener: noop }), head: { appendChild: noop }, documentElement: { appendChild: noop }, addEventListener: noop },
        addEventListener: noop, postMessage: noop, MutationObserver: class { observe() {} disconnect() {} }, alert: noop,
        requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
        open: url => opened.push(url),
        chrome: {
            storage: { sync: { get: async d => ({ ...(Array.isArray(d) ? {} : d), ...(opts.sync || {}) }), set: async () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener: noop } },
            runtime: {
                lastError: null, onMessage: { addListener: noop },
                getURL: p => `chrome-extension://test-id/${p}`,
                sendMessage: (m, cb) => { sent.push(m); Promise.resolve(opts.onMsg ? opts.onMsg(m) : { ok: true }).then(r => cb && cb(r)); }
            }
        }
    };
    sandbox.window = sandbox; sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of ["glossary.js", "cst-cache.js", "cost-policy.js", "lang-detect.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js", "youtube.js"]) vm.runInContext(read(f), sandbox);
    return { sandbox, sent, opened };
}

test("nút 'Chỉnh kiểu phụ đề & Cài đặt' trên YouTube: gửi openOptions cho service worker, KHÔNG tự mở chrome-extension:// từ trang", async () => {
    const P = pageEnv();
    vm.runInContext("ytMoCaiDat()", P.sandbox);
    await new Promise(r => setImmediate(r));
    assert.deepEqual(P.sent.map(m => m.action), ["openOptions"]);
    assert.deepEqual(P.opened, []);
    for (const f of ["youtube.js", "content.js", "dubbing.js"]) {
        assert.ok(!/window\.open\(|location\.href\s*=\s*chrome\.runtime\.getURL|getURL\("options\.html"\)/.test(read(f)), `${f} vẫn tự mở trang tiện ích`);
    }
    const manifest = JSON.parse(read("manifest.json"));
    assert.equal(manifest.options_ui.page, "options.html");
    assert.equal(manifest.options_page, undefined, "không khai báo trùng options_page");
    assert.ok(!manifest.permissions.includes("tabs"), "không thêm quyền thừa");
});

// ================= 3. NHẬN DIỆN NGÔN NGỮ + TỰ ĐỘNG DỊCH =================
const SAMPLES = {
    en: "So today we are going to talk about how neural networks learn from data and why this matters for your projects.",
    ko: "오늘은 신경망이 데이터로부터 어떻게 학습하는지에 대해 이야기해 보겠습니다. 이것은 매우 중요합니다.",
    ja: "今日はニューラルネットワークがデータからどのように学習するかについてお話しします。とても大切です。",
    zh: "今天我们来讨论神经网络如何从数据中学习，以及为什么这对你的项目很重要。",
    vi: "Hôm nay chúng ta sẽ nói về cách mạng nơ-ron học từ dữ liệu và vì sao điều này quan trọng với dự án của bạn.",
    es: "Hoy vamos a hablar de cómo las redes neuronales aprenden de los datos y por qué esto es muy importante."
};

test("nhận diện trên máy: Anh/Hàn/Nhật/Trung/Tây Ban Nha -> dịch; Việt -> không dịch; không rõ -> không tự dịch", () => {
    for (const lang of ["en", "ko", "ja", "zh", "es"]) {
        const d = LANG.decide({ sample: SAMPLES[lang] });
        assert.equal(d.lang, lang);
        assert.equal(d.action, "translate", lang);
    }
    assert.equal(LANG.decide({ sample: SAMPLES.vi }).action, "skip");
    assert.equal(LANG.decide({ sample: "[Music] [Applause] 123" }).action, "unsure");
    assert.equal(LANG.decide({}).action, "unsure");
    // Ưu tiên thông tin track; nhưng track gắn nhãn sai (nội dung chắc chắn là tiếng Việt) thì tin nội dung
    assert.equal(LANG.decide({ metaLang: "a.en" }).action, "translate");
    assert.equal(LANG.decide({ metaLang: "vi" }).action, "skip");
    assert.equal(LANG.decide({ metaLang: "en", sample: SAMPLES.vi }).action, "skip");
    assert.equal(LANG.normCode("zh-Hans"), "zh");
});

async function autoCase(tracks, sync, sample) {
    const P = pageEnv({ sync });
    const S = P.sandbox;
    await new Promise(r => setTimeout(r, 20));
    S.__tracks = tracks;
    S.__sample = sample || "";
    S.__calls = { list: 0, start: 0 };
    vm.runInContext(`
        ytHoiDanhSachPhuDe = async () => { __calls.list++; return { tracks: __tracks, videoId: "abc123" }; };
        ytTaiBanChepLoi = async () => __sample ? [{ start: 0, end: 2, text: __sample }] : [];
        ytBatDauDich = async () => { __calls.start++; return true; };
        ytDatTrangThaiNut = () => {};
        yt.autoTried = ""; yt.active = false; yt.busy = false;
    `, S);
    await vm.runInContext("ytNapCaiDatKieu()", S);
    const q = await vm.runInContext("ytTuDongDich()", S);
    return { q, calls: S.__calls };
}

test("YouTube tự động dịch (BẬT): tiếng Anh / Hàn / Nhật / Trung tự dịch; tiếng Việt không; không rõ không tự dịch", async () => {
    const T = (lang, kind = "asr") => ({ baseUrl: "u", languageCode: lang, kind });
    for (const lang of ["en", "ko", "ja", "zh-Hans"]) {
        const { calls } = await autoCase([T(lang)], { autoTranslate: true });
        assert.equal(calls.start, 1, lang);
    }
    const vi = await autoCase([T("vi")], { autoTranslate: true });
    assert.equal(vi.calls.start, 0);
    assert.equal(vi.q.action, "skip");
    // Không có track tự động, nhiều track, không lấy được mẫu -> không chắc chắn -> không tự dịch
    const unk = await autoCase([T("en", ""), T("fr", "")], { autoTranslate: true }, "");
    assert.equal(unk.q.action, "unsure");
    assert.equal(unk.calls.start, 0);
    // Nhiều track, mẫu nội dung tiếng Hàn -> dịch
    const ko = await autoCase([T("en", ""), T("ko", "")], { autoTranslate: true }, SAMPLES.ko);
    assert.equal(ko.calls.start, 1);
});

test("YouTube tự động dịch (TẮT): không nhận diện, không dịch; nút dịch tay vẫn dùng được", async () => {
    const { q, calls } = await autoCase([{ baseUrl: "u", languageCode: "en", kind: "asr" }], { autoTranslate: false });
    assert.equal(q, null);
    assert.deepEqual(calls, { list: 0, start: 0 });
    const P = pageEnv({ sync: { autoTranslate: false } });
    assert.equal(typeof vm.runInContext("ytBatDauDich", P.sandbox), "function");
});

test("nội dung đã là tiếng Việt: requestUnit trả nguyên, KHÔNG gửi Gemini", async () => {
    const P = pageEnv({ onMsg: () => ({ ok: true, engine: "gemini", translations: ["x"] }) });
    await new Promise(r => setTimeout(r, 20));
    P.sandbox.__s = vm.runInContext(`(() => { const s = new CST_CONTEXT.ContextSession({}); s.setUnits([${JSON.stringify(SAMPLES.vi)}]); return s; })()`, P.sandbox);
    const r = await vm.runInContext("translateWindow(__s, [0], { realtime: false })", P.sandbox);
    assert.equal(r.engine, "same-language");
    assert.equal(r.translations[0], SAMPLES.vi);
    assert.equal(P.sent.filter(m => m.action === "translateUnit").length, 0);
});

// ================= 4. LỒNG TIẾNG KHÔNG BỊ CẮT: DÒNG THỜI GIAN LỜI NÓI RIÊNG =================
function mkGroup(vi, start, end, en) {
    const src = [{ start, end, text: en }];
    return { start, end, srcCues: src, viText: vi, viCues: seg.segmentGroupSafe(vi, src) };
}

// durations: planIndex -> thời lượng audio THẬT (giây); control: { hold } giữ kết quả để thử "về muộn"
function speechRun(groups, durations, control = {}) {
    const clock = new Clock(), video = new FakeVideo();
    const audios = [];
    const pending = [];
    const provider = {
        id: "gemini", label: "giả", caps: { prerender: true, live: false }, voiceLabel: "Kore",
        voiceModel: { sylPerSec: 4.6, rateExp: 1, pauseFactor: 1.3, calibration: 1 },
        calls: [],
        audioKey: async p => "k" + p.id + p.text,
        abort() {},
        render(plans) {
            provider.calls.push(plans.map(p => p.id));
            const out = plans.map(p => ({ planId: p.id, wav: new Uint8Array(Math.round(durations[p.index != null ? p.index : 0] * 1000)), duration: durations[p.index != null ? p.index : 0], sampleRate: 24000 }));
            if (control.hold) return new Promise(res => pending.push(() => res(out)));
            return Promise.resolve(out);
        }
    };
    const eng = new DubEngine({
        video, getGroups: () => groups, providers: { primary: provider },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        setTimeout: (f, ms) => clock.setTimeout(f, ms),
        createObjectURL: b => "blob:" + b.length, revokeObjectURL() {},
        createAudio: url => { const a = new FakeAudio(clock, { duration: Number(url.slice(5)) / 1000 }); a.log = []; audios.push(a); return a; }
    }, { prefetchMax: 30 });
    eng.start();
    const run = async ms => {
        for (let t = 0; t < ms; t += 50) {
            clock.advance(50, st => {
                video.step(st);
                audios.forEach(a => { a.step(st); if (!a.paused) a.log.push({ media: video.currentTime, pos: a.currentTime }); });
            });
            await new Promise(r => setImmediate(r));
        }
    };
    return { eng, video, audios, run, provider, release: () => pending.splice(0).forEach(f => f()) };
}

const LONG_VI = "Trước khi chuyển sang phần tiếp theo, chúng ta hãy cùng nhau tóm tắt lại thật kỹ toàn bộ những gì đã học.";

test("cue 0,2–3 s, lời nói 0,2–4,6 s (câu sau ở 5 s): phát ĐỦ tới 4,6 s, không cắt ở cue.end", async () => {
    const groups = [mkGroup(LONG_VI, 0.2, 3.0, "Before moving on, let's recap."), mkGroup("Bắt đầu nhé.", 5.0, 6.5, "Let's start.")];
    const S = speechRun(groups, [4.4, 1.0]);
    await S.run(300);
    S.video.play();
    await S.run(6000);
    const a1 = S.audios[0];
    const last = a1.log[a1.log.length - 1];
    assert.ok(last.pos >= 4.4 - 0.08, `audio câu 1 dừng ở ${last.pos.toFixed(2)} giây / 4,4`);
    assert.ok(last.media >= 4.5, `lời nói kết thúc lúc ${last.media.toFixed(2)} (phải kéo dài quá cue.end = 3,0)`);
    const st = S.eng.stats.started[0];
    assert.ok(st.speechEnd > st.cueEnd + 1, "speech.end phải tách khỏi cue.end");
});

test("câu dài chồng sang giờ của câu sau: câu trước nói TRỌN, câu sau chờ rồi mới nói (không chồng tiếng), vẫn đủ lời", async () => {
    const groups = [mkGroup(LONG_VI, 0.2, 3.0, "Before moving on, let's recap."), mkGroup("Giờ ta bắt đầu phần hai.", 3.2, 5.5, "Now part two.")];
    const S = speechRun(groups, [4.4, 1.6]);
    await S.run(300);
    S.video.play();
    await S.run(9000);
    const [a1, a2] = S.audios;
    assert.ok(a1 && a2, "cả hai câu đều phải được phát");
    const end1 = a1.log[a1.log.length - 1];
    assert.ok(end1.pos >= 4.4 - 0.08, `câu 1 bị cắt ở ${end1.pos.toFixed(2)} giây / 4,4`);
    assert.ok(end1.media > 3.3, "câu 1 phải còn nói sau khi câu 2 tới giờ (3,2)");
    const start2 = a2.log[0].media;
    assert.ok(start2 >= end1.media - 0.06, `câu 2 bắt đầu ${start2.toFixed(2)} khi câu 1 chưa xong ${end1.media.toFixed(2)}`);
    const end2 = a2.log[a2.log.length - 1];
    assert.ok(end2.pos >= 1.6 - 0.08, "câu 2 cũng phải nói trọn");
    assert.ok(S.eng.stats.started[1].lag > 0, "câu 2 xếp hàng (trễ so với mốc phụ đề)");
    // Không bao giờ có hai audio cùng phát
    const overlap = a1.log.some(x => a2.log.some(y => Math.abs(x.media - y.media) < 1e-9));
    assert.ok(!overlap, "hai câu phát chồng lên nhau");
});

test("tạm dừng giữa câu rồi phát tiếp: giữ nguyên trạng thái, nói tiếp đúng chỗ và trọn câu", async () => {
    const groups = [mkGroup(LONG_VI, 0.2, 3.0, "Before moving on, let's recap."), mkGroup("Bắt đầu nhé.", 6.0, 7.0, "Let's start.")];
    const S = speechRun(groups, [4.4, 1.0]);
    await S.run(300);
    S.video.play();
    await S.run(2000);
    const before = S.audios[0].currentTime;
    S.video.pause();
    await S.run(1500);
    assert.ok(Math.abs(S.audios[0].currentTime - before) < 0.08, "audio phải đứng yên khi video tạm dừng");
    S.video.play();
    await S.run(5000);
    const a1 = S.audios[0];
    assert.ok(a1.log[a1.log.length - 1].pos >= 4.4 - 0.08);
});

test("tua khi đang nói: bỏ lời cũ ngay, không phát lại lời cũ ở vị trí mới", async () => {
    const groups = [mkGroup(LONG_VI, 0.2, 3.0, "Before moving on, let's recap."), mkGroup("Phần cuối của bài.", 20.0, 22.0, "Final part.")];
    const S = speechRun(groups, [4.4, 1.2]);
    await S.run(300);
    S.video.play();
    await S.run(1500);
    assert.ok(!S.audios[0].paused);
    S.video.seek(12);
    await S.run(1000);
    assert.ok(S.audios[0].paused, "lời cũ vẫn phát sau khi tua");
    assert.equal(S.eng.speech, null);
});

test("kết quả TTS về muộn sau khi lời thoại đã đổi (rút gọn / dựng lại): KHÔNG phát audio cũ", async () => {
    const groups = [mkGroup(LONG_VI, 5.0, 8.0, "Before moving on, let's recap.")];
    const S = speechRun(groups, [4.4], { hold: true });
    await S.run(300);
    assert.equal(S.provider.calls.length, 1);
    // Lời thoại đã đổi trong lúc chờ: engine dựng kế hoạch MỚI cho đoạn này (như sau khi rút gọn)
    const p = S.eng.plans[0];
    const np = { ...p, text: "Tóm tắt nhanh nhé." };
    S.eng.plans[0] = np;
    S.eng.planById.set(p.id, np);
    S.release();
    await S.run(300);
    assert.ok(!S.eng.rendered.has(p.id), "audio của lời thoại cũ bị đưa vào phát");
});

test("TTS quá thời gian chờ: không gửi lại cho cùng đoạn (máy chủ có thể đã tạo và tính tiền)", async () => {
    const groups = [mkGroup("Xin chào các bạn.", 2.0, 4.0, "Hello."), mkGroup("Hôm nay ta học mạng nơ-ron.", 5.0, 7.0, "Today.")];
    const S = speechRun(groups, [1.2, 1.5]);
    S.provider.render = plans => { S.provider.calls.push(plans.map(p => p.id)); const e = new Error("quá thời gian"); e.type = "timeout"; return Promise.reject(e); };
    await S.run(300);
    S.video.play();
    await S.run(8000);
    const all = S.provider.calls.flat();
    assert.equal(new Set(all).size, all.length, "đoạn đã quá thời gian bị gửi TTS lại");
    assert.ok(S.eng.stats.timeouts >= 1);
});

// ================= 5. NGÂN SÁCH & THỐNG KÊ CHI PHÍ =================
test("ngân sách: lượt TTS làm vượt ngân sách video -> KHÔNG gọi Gemini TTS, báo 'budget'", async () => {
    const seen = [];
    const E = bgEnv(server(seen), cfg({ geminiApiKey: "KEY-OLD-USER", budgetVideoUsd: 0.00001 }));
    const r = await E.send({ action: "synthesizeSpeech", text: "Một câu khá dài để tạo audio.", voice: "Kore", parts: [{ key: "b1", weight: 40 }], videoKey: "yt:v1" });
    assert.equal(r.ok, false);
    assert.equal(r.errorType, "budget");
    assert.deepEqual(seen, []);
});

test("ngân sách: engine lồng tiếng chuyển NGAY sang giọng hệ thống khi chạm ngân sách", async () => {
    const groups = [mkGroup("Xin chào các bạn.", 1.0, 3.0, "Hello.")];
    const S = speechRun(groups, [1.2]);
    const fallback = { id: "system", label: "Giọng hệ thống", caps: { live: true, prerender: false }, voiceModel: { sylPerSec: 3.45, rateExp: 0.85, pauseFactor: 1.8 }, speak: () => ({ cancel() {} }), stopAll() {} };
    S.eng.fallback = fallback;
    S.provider.render = () => { const e = new Error("ngân sách"); e.type = "budget"; return Promise.reject(e); };
    await S.run(500);
    assert.equal(S.eng.provider.id, "system");
    assert.equal(S.eng.fallbackReason, "budget");
});

test("thống kê chi phí: ghi số lượt, USD ước tính, audio, lượt tránh được; còn sau khi tải lại tiện ích; chỉ lưu trên máy", async () => {
    const local = {};
    const seen = [];
    const E = bgEnv(server(seen), cfg({ geminiApiKey: "KEY-OLD-USER" }), { local });
    await E.send({ ...REQ, videoKey: "yt:v1", videoSec: 600, videoTitle: "Bài giảng" });
    await E.send({ ...REQ, videoKey: "yt:v1" });                              // trúng cache
    await E.send({ action: "synthesizeSpeech", text: "Xin chào.", voice: "Kore", parts: [{ key: "s1", weight: 4 }], videoKey: "yt:v1", videoSec: 600 });
    const st = await E.send({ action: "costStats" });
    assert.equal(st.day.trCalls, 1);
    assert.equal(st.day.ttsCalls, 1);
    assert.ok(st.day.trUsd > 0 && st.day.ttsUsd > 0);
    assert.ok(st.day.audioSec > 1.5);
    assert.equal(st.day.hitsTr, 1);
    assert.ok(st.day.avoided >= 1);
    assert.equal(st.day.videos["yt:v1"].videoSec, 600);
    await new Promise(r => setTimeout(r, 1700));                                 // ghi xuống storage (gộp 1,5 giây)
    const B = bgEnv(server([]), cfg({ geminiApiKey: "KEY-OLD-USER" }), { local });
    const st2 = await B.send({ action: "costStats" });
    assert.equal(st2.day.trCalls, 1, "thống kê ngày phải còn sau khi tải lại");
    assert.ok(!JSON.stringify(local).includes("KEY-OLD-USER"));
});

test("vượt gấp đôi ngân sách ngày: ngừng gọi Gemini dịch (hàng rào cứng), dùng bản miễn phí", async () => {
    const local = { costLedger: null };
    const seen = [];
    const E = bgEnv(server(seen), cfg({ geminiApiKey: "KEY-OLD-USER", budgetDailyUsd: 0.01 }), { local });
    const d = new Date();
    local.costLedger = { day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, trUsd: 0.03, ttsUsd: 0, videos: {} };
    const E2 = bgEnv(server(seen), cfg({ geminiApiKey: "KEY-OLD-USER", budgetDailyUsd: 0.01 }), { local });
    const r = await E2.send(REQ);
    assert.equal(r.engine, "google_fallback");
    assert.deepEqual(seen, []);
    void E;
});

// ================= 6. PHÁT HIỆN TIỆN ÍCH CHƯA ĐƯỢC NẠP LẠI (1.1.7) =================
const VC = require("../version-check.js");
function fakeDoc(badgeText) {
    const mk = tag => ({ tag, children: [], style: {}, textContent: "", listeners: {}, setAttribute() {},
        append(...c) { this.children.push(...c); }, prepend(c) { this.children.unshift(c); },
        addEventListener(n, f) { this.listeners[n] = f; } });
    const mount = mk("section"), badge = mk("span");
    badge.textContent = badgeText;
    return { mount, badge, body: mk("body"), createElement: mk, querySelector: s => (s === ".badge" ? badge : s === ".mount" ? mount : null) };
}

test("Chrome đang chạy bản cũ (chưa nạp lại) còn file đã mới: trang Cài đặt/popup báo rõ và có nút nạp lại", () => {
    const doc = fakeDoc("Phiên bản v1.1.7");
    let reloaded = 0;
    const chromeApi = { runtime: { getManifest: () => ({ version: "1.1.2" }), reload: () => reloaded++ } };
    const r = VC.check(doc, chromeApi, ".badge", ".mount");
    assert.deepEqual({ ...r }, { stale: true, loaded: "1.1.2", disk: "1.1.7" });
    const box = doc.mount.children[0];
    assert.match(box.children[0].textContent, /bản 1\.1\.2.*bản 1\.1\.7/);
    box.children[1].listeners.click();
    assert.equal(reloaded, 1);
    // Cùng phiên bản: không báo
    const doc2 = fakeDoc("v1.1.7");
    assert.equal(VC.check(doc2, { runtime: { getManifest: () => ({ version: "1.1.7" }) } }, ".badge", ".mount").stale, false);
    assert.equal(doc2.mount.children.length, 0);
    // Ngoài tiện ích (không có getManifest): bỏ qua
    assert.equal(VC.check(fakeDoc("v1.1.7"), {}, ".badge", ".mount"), null);
    // Nhãn phiên bản trên trang khớp manifest trên đĩa
    const manifest = JSON.parse(read("manifest.json"));
    assert.ok(read("options.html").includes(`Phiên bản v${manifest.version}`));
    assert.ok(new RegExp(`brand-badge"[^>]*>v${manifest.version.replace(/\./g, "\\.")}<`).test(read("popup.html")));
    assert.ok(read("options.html").includes('src="version-check.js"') && read("popup.html").includes('src="version-check.js"'));
});

// ================= 7. KIỂU PHỤ ĐỀ MẶC ĐỊNH, VỊ TRÍ ỔN ĐỊNH, BỎ DEEPLEARNING.AI (1.1.8) =================
test("kiểu mặc định: cỡ 90%, độ đậm 400, viền quầng mờ, lề 1% (một nguồn duy nhất)", () => {
    const S = require("../subtitle-style.js");
    const d = S.DEFAULT_STYLE;
    assert.equal(d.fontSize, 90);
    assert.equal(d.fontWeight, "400");
    assert.equal(d.strokeStyle, "glow");
    assert.equal(d.offset, 1);
    assert.equal(S.normalizeStyle({}).offset, 1);
    assert.ok(!/fontSize:\s*130|offset:\s*3\b/.test(read("youtube.js")), "youtube.js còn bản sao kiểu mặc định cũ");
});

test("chuyển kiểu đã lưu một lần: mục còn giá trị mặc định cũ -> mặc định mới; mục đã tự chỉnh giữ nguyên", async () => {
    const E = bgEnv(async () => reply({}), cfg({ subStyle: { fontSize: 130, fontWeight: "500", strokeStyle: "thick", offset: 3, fontColor: "#ffee00" } }));
    const s = E.syncStore.subStyle;
    assert.equal(s.fontSize, 90);
    assert.equal(s.fontWeight, "400");
    assert.equal(s.strokeStyle, "thick", "viền đã tự chọn phải giữ");
    assert.equal(s.offset, 1);
    assert.equal(s.fontColor, "#ffee00");
    assert.equal(E.syncStore.styleDefaults118, true);
    const again = bgEnv(async () => reply({}), cfg({ subStyle: { fontSize: 130 }, styleDefaults118: true }));
    assert.equal(again.syncStore.subStyle.fontSize, 130, "chỉ chuyển một lần");
});

function playerMock({ height = 540, autohide = false, barHeight = 0 }) {
    return {
        clientHeight: height,
        classList: { contains: c => c === "ytp-autohide" && autohide },
        getBoundingClientRect: () => ({ top: 0, bottom: height, height }),
        querySelector: sel => (sel === ".ytp-chrome-bottom" && barHeight ? { getBoundingClientRect: () => ({ top: height - barHeight, bottom: height, height: barHeight }) } : null)
    };
}

test("YouTube: phụ đề GIỮ lề đã chọn khi thanh điều khiển ẩn; chỉ nâng vừa đủ khi thanh điều khiển thật sự che (không cộng cứng 64 px)", async () => {
    const P = pageEnv();
    const S = P.sandbox;
    S.getComputedStyle = () => ({ display: "block", visibility: "visible" });
    const pos = (style, player) => {
        S.__o = { style: {} }; S.__p = player;
        vm.runInContext(`ytSubStyle = ytChuanHoaKieu(${JSON.stringify(style)}); ytCapNhatViTri(__p, __o);`, S);
        return { ...S.__o.style };
    };
    // Lề 1% trên khung 540 px: 5,4 + 6 px; thanh ẩn -> đúng lề, không cộng 16/64 px
    assert.equal(pos({ offset: 1 }, playerMock({ autohide: true })).bottom, "11px");
    // Lề 3%: thanh ẩn -> 22 px (trước đây calc(3% + 16px)); thanh hiện cao 70 px -> nâng vừa đủ 76 px
    assert.equal(pos({ offset: 3 }, playerMock({ autohide: true, barHeight: 70 })).bottom, "22px");
    assert.equal(pos({ offset: 3 }, playerMock({ barHeight: 70 })).bottom, "76px");
    // Lề đã cao hơn thanh điều khiển: không nhảy chút nào khi thanh hiện ra
    const hidden = pos({ offset: 20 }, playerMock({ autohide: true, barHeight: 70 })).bottom;
    const shown = pos({ offset: 20 }, playerMock({ barHeight: 70 })).bottom;
    assert.equal(hidden, shown);
    // Vị trí trên cùng: theo lề, không phụ thuộc thanh điều khiển
    const top = pos({ position: "top", offset: 1 }, playerMock({ barHeight: 70 }));
    assert.equal(top.top, "11px");
    assert.equal(top.bottom, "auto");
});

test("đã bỏ DeepLearning.AI khỏi manifest, quyền truy cập, mã và giao diện; tài nguyên tiện ích không mở cho mọi trang", () => {
    const manifest = JSON.parse(read("manifest.json"));
    const all = JSON.stringify(manifest);
    assert.ok(!/deeplearning/i.test(all));
    assert.ok(!manifest.web_accessible_resources.some(w => w.matches.includes("<all_urls>")));
    for (const f of ["content.js", "youtube.js", "popup.js", "popup.html", "options.html", "options.js", "background.js"]) {
        assert.ok(!/deeplearning\.ai|DeepLearning\.AI|"deeplearning"/.test(read(f)), `${f} còn DeepLearning.AI`);
    }
});

// ================= 8. VỊ TRÍ COURSERA, GIỮ SÁT LỀ, LỒNG TIẾNG NHANH MÀ KHÔNG TỐN THÊM (1.1.9) =================
test("Coursera: vị trí + lề áp vào từng cue (một dòng theo %, song ngữ xếp hàng đúng thứ tự); đổi Cài đặt thì đặt lại ngay", async () => {
    const P = pageEnv();
    const S = P.sandbox;
    await new Promise(r => setTimeout(r, 20));
    const place = (style, dual, originalFirst, role) => {
        S.__c = { id: role === "vi" ? "cst-vi-0-0" : "orig" };
        vm.runInContext(`state.subStyle = ${JSON.stringify(style)}; state.dualMode = ${dual}; state.originalFirst = ${originalFirst}; placeCue(__c, "${role}");`, S);
        return { ...S.__c };
    };
    assert.deepEqual(place({ offset: 1 }, false, false, "vi"), { id: "cst-vi-0-0", snapToLines: false, line: 99, lineAlign: "end" });
    assert.deepEqual(place({ offset: 5, position: "top" }, false, false, "vi"), { id: "cst-vi-0-0", snapToLines: false, line: 5, lineAlign: "start" });
    // Song ngữ, dưới: bản dịch đọc trước (trên, -3), bản gốc sát lề (-1); bật "gốc trước" thì ngược lại
    assert.equal(place({}, true, false, "vi").line, -3);
    assert.equal(place({}, true, false, "orig").line, -1);
    assert.equal(place({}, true, true, "vi").line, -1);
    assert.equal(place({}, true, true, "orig").line, -3);
    assert.equal(place({ position: "top" }, true, false, "vi").line, 0);
    assert.equal(place({ position: "top" }, true, false, "orig").line, 2);
    // Đổi lề khi đang xem: các cue đang có được đặt lại
    S.__cues = [{ id: "cst-vi-0-0" }, { id: "cst-vi-1-0" }];
    vm.runInContext(`state.dualMode = false; state.activeTrack = { track: { cues: __cues } }; state.subStyle = { offset: 10 }; repositionCues();`, S);
    assert.deepEqual(S.__cues.map(c => c.line), [90, 90]);
});

test("'Luôn giữ sát lề': thanh điều khiển hiện ra cũng không đẩy phụ đề lên; phụ đề vẽ trên thanh (không chặn chuột)", async () => {
    const P = pageEnv();
    const S = P.sandbox;
    S.getComputedStyle = () => ({ display: "block", visibility: "visible" });
    S.__o = { style: {} };
    S.__p = playerMock({ barHeight: 70 });
    vm.runInContext(`ytSubStyle = ytChuanHoaKieu({ offset: 1, pinBottom: true }); ytCapNhatViTri(__p, __o);`, S);
    assert.equal(S.__o.style.bottom, "11px");
    assert.equal(S.__o.style.zIndex, "70");
    vm.runInContext(`ytSubStyle = ytChuanHoaKieu({ offset: 1 }); ytCapNhatViTri(__p, __o);`, S);
    assert.equal(S.__o.style.bottom, "76px");
    assert.equal(require("../subtitle-style.js").normalizeStyle({ pinBottom: "yes" }).pinBottom, false, "chỉ nhận đúng true");
});

function jobsRun(opts = {}) {
    const groups = Array.from({ length: 8 }, (_, i) => mkGroup(`Đây là câu thử nghiệm số ${i + 1} để kiểm tra lồng tiếng.`, 1 + i * 3, 3.5 + i * 3, `Sentence ${i}.`));
    const S = speechRun(groups, groups.map(() => 2.0), { hold: true });
    if (opts.renderError) {
        const base = S.provider.render;
        let n = 0;
        S.provider.render = plans => { n++; if (n === 1) { S.provider.calls.push(plans.map(p => p.id)); const e = new Error("429"); e.type = opts.renderError; return Promise.reject(e); } return base(plans); };
    }
    return S;
}

test("lồng tiếng AI: lượt đầu nhỏ (có tiếng sớm), audio phía trước sắp cạn thì chạy 2 lượt song song; mỗi đoạn vẫn chỉ tạo MỘT lần", async () => {
    const S = jobsRun();
    await S.run(400);
    const first = S.provider.calls[0].map(id => S.eng.planById.get(id));
    const syl = first.reduce((a, p) => a + p.phrases.reduce((b, ph) => b + ph.syl, 0), 0);
    assert.ok(first.length === 1 || syl <= 40, `lượt đầu ${syl} âm tiết`);
    assert.equal(S.provider.calls.length, 2, "chưa có audio nào phía trước: phải có lượt bắt kịp chạy song song");
    assert.ok(S.eng.jobs.size <= 2);
    S.release();
    await S.run(400);
    S.release();
    await S.run(400);
    const all = S.provider.calls.flat();
    assert.equal(new Set(all).size, all.length, "có đoạn bị tạo audio hai lần");
});

test("lồng tiếng AI: API báo vượt giới hạn tốc độ (429) -> chuyển sang dè dặt: 1 lượt mỗi lúc, bỏ lượt đầu nhỏ", async () => {
    const S = jobsRun({ renderError: "rate_limit" });
    await S.run(400);
    assert.equal(S.eng.conservative, true);
    const before = S.provider.calls.length;
    await S.run(600);
    let active = 0;
    for (const j of S.eng.jobs.values()) if (!j.orphan) active++;
    assert.ok(active <= 1, `có ${active} lượt cùng lúc sau khi bị giới hạn tốc độ`);
    assert.ok(S.provider.calls.length >= before);
});

test("kịch bản đọc cho Gemini TTS: chỉ yêu cầu ngừng lâu ('…') khi khoảng ngừng >= 0,6 giây (khoảng lặng cũng tính tiền)", () => {
    const { geminiScript } = require("../dub-engine.js");
    const plan = (pause) => ({ intent: "neutral", sps: 4.5, emphasisWords: [], phrases: [{ text: "Hôm nay chúng ta học", pause }, { text: "về mạng nơ-ron", pause: 0 }] });
    assert.match(geminiScript([plan(0.5)]), /học, về/);
    assert.match(geminiScript([plan(0.7)]), /học… về/);
});

// ================= 9. GIỌNG VIỆT TRÊN MÁY: VIENEU-TTS (1.1.10) =================
function vieneuServer(calls, opts = {}) {
    return async (u, o) => {
        const url = String(u);
        if (!url.startsWith(COST.LOCAL_TTS.url)) return GOOGLE_OK;
        if (opts.down) throw new TypeError("Failed to fetch");
        if (url.endsWith("/health")) return { ok: true, status: 200, json: async () => ({ status: "ok", backend: "onnx", active: 0, waiting: 0 }) };
        const body = JSON.parse(o.body);
        calls.push(body);
        const sec = 1.5, sr = body.sample_rate;
        const pcm = Buffer.alloc(Math.round(sec * sr) * 2);
        for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 6) * 9000), i * 2);
        return { ok: true, status: 200, arrayBuffer: async () => pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length) };
    };
}

test("VieNeu: service worker gọi máy chủ trên máy (127.0.0.1) đúng định dạng, lưu kho, lần sau 0 lượt gọi, chi phí 0 USD", async () => {
    const calls = [];
    const E = bgEnv(vieneuServer(calls), cfg());
    assert.equal((await E.send({ action: "localTtsStatus" })).running, true);
    const req = { action: "synthesizeSpeech", engine: "vieneu", text: "Xin chào các bạn.", voice: "Thùy Dung", parts: [{ key: "v1", weight: 5 }], videoKey: "yt:x" };
    const r = await E.send(req);
    assert.equal(r.ok, true);
    assert.equal(calls.length, 1);
    assert.deepEqual({ ...calls[0] }, { model: "vieneu-v3-turbo", voice: "Thùy Dung", input: "Xin chào các bạn.", response_format: "pcm", sample_rate: 24000, temperature: 0.6 });
    assert.ok(r.parts[0].duration > 1);
    assert.equal((await E.send(req)).fromCache, true);
    assert.equal(calls.length, 1);
    const st = await E.send({ action: "costStats" });
    assert.equal(st.day.ttsUsd, 0);
    assert.ok(st.day.localSec > 1);
    const manifest = JSON.parse(read("manifest.json"));
    assert.ok(manifest.host_permissions.includes("http://127.0.0.1:8000/*"));
});

test("VieNeu: máy chủ chưa chạy -> trạng thái 'không chạy', lỗi rõ ràng kèm cách bật, không ghi kho", async () => {
    const E = bgEnv(vieneuServer([], { down: true }), cfg());
    assert.equal((await E.send({ action: "localTtsStatus" })).running, false);
    const r = await E.send({ action: "synthesizeSpeech", engine: "vieneu", text: "Xin chào.", voice: "Thùy Dung", parts: [{ key: "v2", weight: 3 }] });
    assert.equal(r.ok, false);
    assert.equal(r.errorType, "local_unavailable");
    assert.match(r.error, /cst-start\.command/);
    assert.equal((await E.backend.listMeta("audio")).length, 0);
});

test("VieNeu: engine gửi lần lượt từng câu (máy chủ CPU chỉ phục vụ 1 luồng), khóa kho riêng theo giọng", async () => {
    const calls = [];
    const B = bgEnv(vieneuServer(calls), cfg());
    const provider = E_ENGINE.createVieneuProvider({ sendMessage: m => B.send(m) }, { localVoice: "Mỹ Duyên" });
    assert.equal(await provider.init(), true);
    assert.equal(provider.caps.serial, true);
    assert.equal(provider.caps.maxBatch, 1);
    const groups = Array.from({ length: 4 }, (_, i) => mkGroup(`Đây là câu số ${i + 1} của bài giảng.`, 1 + i * 3, 3.5 + i * 3, `Sentence ${i}.`));
    const clock = new Clock(), video = new FakeVideo();
    const eng = new DubEngine({
        video, getGroups: () => groups, providers: { primary: provider },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        createObjectURL: () => "blob:x", revokeObjectURL() {}, createAudio: () => new FakeAudio(clock, { duration: 99 })
    }, { prefetchMax: 18 });
    eng.start();
    let maxActive = 0;
    for (let i = 0; i < 400 && eng.rendered.size < 4; i++) {
        clock.advance(50);
        let a = 0; for (const j of eng.jobs.values()) if (!j.orphan) a++;
        maxActive = Math.max(maxActive, a);
        await new Promise(r => setTimeout(r, 5));
    }
    const renderedCount = eng.rendered.size;
    const warm = calls.filter(c => c.input === "Xin chào.");
    // 1.2.6: bỏ làm nóng giọng (2 lượt chen trước câu đầu tiên, làm chậm ~0,6 giây)
    assert.equal(warm.length, 0, "không làm nóng giọng trước câu đầu tiên");
    calls.splice(0, calls.length, ...calls.filter(c => c.input !== "Xin chào."));
    const firstPlan = eng.plans[0];
    eng.stop();                                    // stop() giải phóng audio: đếm TRƯỚC khi dừng
    assert.equal(renderedCount, 4);
    assert.equal(maxActive, 1, "VieNeu chỉ được 1 lượt mỗi lúc");
    assert.ok(calls.every(c => c.voice === "Mỹ Duyên"));
    assert.equal(calls.length, 4, "mỗi câu một lượt");
    const k1 = await provider.audioKey(firstPlan);
    const g = E_ENGINE.createGeminiProvider({ sendMessage: async () => ({}) }, {});
    assert.notEqual(k1, await g.audioKey(firstPlan), "kho audio VieNeu và Gemini phải tách riêng");
});

function dubEnvWithLocal(mode, provider, running, msgs) {
    const env = dubbingEnvFor(mode, provider, msgs, m => {
        if (m.action === "localTtsStatus") return { ok: true, running };
        return { ok: false };
    });
    return env;
}

for (const [mode, provider, running, expect] of [
    ["balanced", "auto", true, "vieneu"], ["balanced", "auto", false, "gemini"], ["economy", "auto", true, "vieneu"],
    ["economy", "auto", false, "system"], ["premium", "gemini", true, "gemini"], ["balanced", "vieneu", false, "gemini"]
]) {
    test(`chọn nguồn giọng: chế độ ${mode}, nguồn '${provider}', VieNeu ${running ? "đang chạy" : "chưa chạy"} -> ${expect}`, async () => {
        const msgs = [];
        const env = dubEnvWithLocal(mode, provider, running, msgs);
        const video = new FakeVideo();
        const ok = await env.CST_DUB.start({ video, getGroups: () => [] });
        assert.equal(ok, true);
        assert.equal(env.CST_DUB.dub.engine.provider.id, expect);
        if (expect === "vieneu") assert.equal(env.CST_DUB.dub.engine.fallback && env.CST_DUB.dub.engine.fallback.id, "system", "VieNeu lỗi thì về giọng hệ thống miễn phí, không tự sang Gemini");
        env.CST_DUB.stop();
    });
}

// Môi trường trang cho dubbing.js (chọn nguồn giọng), phản hồi tin nhắn tùy biến
function dubbingEnvFor(mode, dubProvider, msgs, onMsg) {
    const noop = () => {};
    const voices = [{ name: "Linh", lang: "vi-VN", localService: true }];
    const sandbox = {
        console: { log: noop, warn: noop, error: console.error }, setTimeout, clearTimeout, setInterval: () => 1, clearInterval: noop,
        Promise, Map, Set, Math, JSON, Date, TextEncoder, crypto: globalThis.crypto, atob, btoa, URL, alert: m => msgs.push({ alert: m }),
        performance: { now: () => Date.now() }, location: { href: "https://www.youtube.com/watch?v=abc", pathname: "/watch" },
        document: { title: "t", querySelector: () => null, querySelectorAll: () => [] },
        speechSynthesis: { getVoices: () => voices, speak: noop, cancel: noop, addEventListener: noop },
        SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
        chrome: {
            storage: { sync: { get: async d => ({ ...d, geminiApiKey: "k", useAi: true, costMode: mode, dubProvider }) }, onChanged: { addListener: noop } },
            runtime: { lastError: null, sendMessage: (m, cb) => { msgs.push(m); cb(onMsg(m)); } }
        }
    };
    sandbox.window = sandbox; sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of ["cst-cache.js", "cost-policy.js", "vi-segmenter.js", "dub-planner.js", "dub-audio.js", "dub-engine.js", "dubbing.js"]) vm.runInContext(read(f), sandbox);
    return sandbox;
}

test("VieNeu là giọng chính (chế độ Cân bằng, có API key): KHÔNG rút gọn lời thoại, không hỏi model Gemini TTS", async () => {
    const msgs = [];
    const env = dubbingEnvFor("balanced", "vieneu", msgs, m => (m.action === "localTtsStatus" ? { ok: true, running: true } : { ok: false }));
    const video = new FakeVideo();
    video.play();
    assert.equal(await env.CST_DUB.start({ video, getGroups: () => require("./dub-sim.js").lectureGroups() }), true);
    const eng = env.CST_DUB.dub.engine;
    assert.equal(eng.provider.id, "vieneu");
    assert.equal(eng.d.condense, null, "Đàm: KHÔNG BAO GIỜ rút gọn lời thoại");
    assert.ok(!msgs.some(m => m.action === "modelStatus"), "không cần hỏi model Gemini TTS");
    for (let i = 0; i < 20; i++) { video.currentTime += 0.5; eng.tick(); await new Promise(r => setImmediate(r)); }
    assert.ok(!msgs.some(m => m.action === "condenseSpeech"), "không gửi yêu cầu rút gọn");
    env.CST_DUB.stop();
});

// ================= 10. NHỊP NÓI ĐỀU + CHẤT LƯỢNG AUDIO VIENEU (1.1.11) =================
const AUD = require("../dub-audio.js");

test("rút khoảng lặng dài trong câu (giọng kể chuyện ngừng 0,3 đến 0,6 giây) xuống 0,22 giây; khoảng ngắn và hai đầu giữ nguyên", () => {
    const sr = 24000;
    const tone = (sec, amp) => Float32Array.from({ length: Math.round(sec * sr) }, (_, i) => amp * Math.sin(i / 6));
    const parts = [tone(0.1, 0), tone(1, 0.4), tone(0.55, 0), tone(0.8, 0.4), tone(0.15, 0), tone(0.7, 0.4), tone(0.1, 0)];
    const all = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
    const c = AUD.compressPauses(all, sr, { maxPause: 0.22 });
    assert.ok(Math.abs((all.length - c.length) / sr - 0.33) < 0.02, `bớt ${((all.length - c.length) / sr).toFixed(2)} giây`);
    const sil = AUD.findSilences(c, sr, { minMs: 100 }).filter(x => x.start > 0.05 && x.end < c.length / sr - 0.05).map(x => +x.dur.toFixed(2));
    assert.ok(sil.every(d => d <= 0.23), JSON.stringify(sil));
    assert.ok(sil.some(d => d >= 0.14 && d <= 0.16), "khoảng ngừng ngắn phải giữ nguyên");
    // Không thêm tiếng "tách" ở chỗ cắt: bước nhảy biên độ lớn nhất không vượt tín hiệu gốc
    const maxJump = x => { let j = 0; for (let i = 1; i < x.length; i++) j = Math.max(j, Math.abs(x[i] - x[i - 1])); return j; };
    assert.ok(maxJump(c) <= maxJump(all) + 1e-6, `bước nhảy ${maxJump(c)} > ${maxJump(all)}`);
});

test("lời thoại cho VieNeu: chỉ giữ dấu câu thật (+ sau cụm mở đầu), bỏ ký hiệu, câu còn nối tiếp không ép kết câu", () => {
    const { plainScript } = E_ENGINE;
    assert.equal(plainScript({ continuesNext: false, phrases: [{ text: "Bây giờ", breakKind: "opener" }, { text: "điều chúng ta cần hiểu là", breakKind: "breath" }, { text: "cách mô hình xử lý dữ liệu", breakKind: "end" }] }),
        "Bây giờ, điều chúng ta cần hiểu là cách mô hình xử lý dữ liệu.");
    assert.equal(plainScript({ continuesNext: true, phrases: [{ text: "[Nhạc] >> Tôi cũng thích vừa đi bộ", breakKind: "hint" }, { text: "vừa làm việc", breakKind: "end" }] }),
        "Tôi cũng thích vừa đi bộ vừa làm việc");
    assert.equal(plainScript({ continuesNext: false, phrases: [{ text: "- Thật sao?", breakKind: "end" }] }), "Thật sao?");
    // Chỗ người nói gốc ngừng thật (phụ đề tự động không có dấu câu) -> dấu phẩy để ngắt hơi
    assert.equal(plainScript({ continuesNext: false, phrases: [{ text: "hôm nay chúng ta sẽ học", breakKind: "source", pauseAfter: 0.4, syl: 6 }, { text: "cách huấn luyện mô hình", breakKind: "end" }] }),
        "hôm nay chúng ta sẽ học, cách huấn luyện mô hình.");
    // Ngừng rất ngắn hoặc cụm quá ngắn: không thêm dấu phẩy
    assert.equal(plainScript({ continuesNext: false, phrases: [{ text: "và rồi", breakKind: "source", pauseAfter: 0.4, syl: 2 }, { text: "chúng ta đi tiếp", breakKind: "end" }] }),
        "và rồi chúng ta đi tiếp.");
});

function rateEngine(opts = {}) {
    const groups = (opts.slots || [3, 2.2, 3.5, 1.8, 3, 2.5, 4, 2]).reduce((acc, len, i) => {
        const start = acc.length ? acc[acc.length - 1].end + 0.3 : 1;
        acc.push(mkGroup(`Đây là câu số ${i + 1} trong bài giảng về trí tuệ nhân tạo và dữ liệu.`, start, start + len, `S${i}.`));
        return acc;
    }, []);
    // Thời lượng audio giả KHỚP tốc độ giọng (âm tiết / tốc độ) để engine đo đúng giọng chậm/nhanh
    const PL = require("../dub-planner.js");
    const S = speechRun(groups, groups.map(g => opts.dur || PL.countSyllables(g.viText) / (opts.sps || 3.6)));
    S.provider.tempo = { targetSps: 4.8, maxTempo: 1.22, minSps: 4.0, maxFloor: 1.15 };
    S.provider.naturalSps = () => opts.sps || 3.6;
    if (opts.videoRate) S.video.playbackRate = opts.videoRate;
    return S;
}

test("nhịp nói BÁM PHỤ ĐỀ mà vẫn ĐỀU: nói xong gần mốc cuối phụ đề (không chạy trước), không dưới sàn của giọng, tối đa 1,3x (1,4x khi đang trễ), tăng <= 0,1 / giảm <= 0,06 mỗi câu, không bỏ câu", async () => {
    for (const sps of [3.6, 5.4]) {
        const S = rateEngine({ sps });
        await S.run(300);
        S.video.play();
        await S.run(30000);
        const st = S.eng.stats.started;
        const rates = st.map(x => x.rate);
        assert.ok(rates.length >= 8, `chỉ nói ${rates.length} câu`);
        // Sàn: giọng chậm 3,6 âm tiết/giây -> không dưới 4,0/3,6 = 1,11x (nghe >= 4 âm tiết/giây)
        const floor = Math.max(0.95, Math.min(1.15, 4.0 / sps));
        // Trần 1,3x; đang trễ > 1 giây được tới 1,4x để bắt kịp (không bỏ chữ)
        assert.ok(rates.every((r, i) => r >= floor - 1e-9 && r <= (st[i].lag > 1 || (i > 0 && rates[i - 1] > 1.3) ? 1.4 : 1.3) + 1e-9), `ngoài dải [${floor.toFixed(2)} ; 1,3/1,4]: ${JSON.stringify(rates)}`);
        for (let i = 1; i < rates.length; i++) {
            const d = rates[i] - rates[i - 1];
            assert.ok(d <= 0.1 + 1e-9 && d >= -0.06 - 1e-9, `nhịp nhảy ${rates[i - 1]} -> ${rates[i]}`);
        }
        assert.equal(S.eng.stats.dropped, 0);
        // Lời không chạy trước phụ đề: câu kết thúc sớm hơn mốc cuối phụ đề > 0,6 giây chỉ khi
        // tốc độ đã bị giới hạn: chậm nhất cho phép, hoặc chỉ được giảm 0,06 so với câu trước
        // (làm mượt, đánh đổi có chủ ý để nhịp không đổi đột ngột)
        const early = st.filter((x, i) => x.speechEnd < x.cueEnd - 0.6 && x.rate > floor + 1e-6 && !(i > 0 && Math.abs(x.rate - (st[i - 1].rate - 0.06)) < 1e-6));
        assert.equal(early.length, 0, `chạy trước phụ đề: ${JSON.stringify(early.map(x => [x.speechEnd.toFixed(2), x.cueEnd.toFixed(2), x.rate.toFixed(2)]))}`);
    }
});

test("nghỉ giữa hai câu như người thật: câu trước kết thúc bằng dấu chấm thì câu sau (đang xếp hàng) chờ >= 0,18 giây", async () => {
    // Audio dài hơn khung nhiều -> các câu phải xếp hàng nối nhau
    const S = rateEngine({ dur: 4.5, slots: [2, 2, 2, 2, 2] });
    await S.run(300);
    S.video.play();
    await S.run(30000);
    const st = S.eng.stats.started;
    assert.ok(st.length >= 3);
    for (let i = 1; i < st.length; i++) {
        const gap = st[i].t - st[i - 1].speechEnd;
        assert.ok(gap >= 0.18 - 0.06, `nghỉ ${gap.toFixed(3)} giây`);
    }
});

test("video phát 1,5x: không nhân thêm nhịp nền (tránh giọng líu ríu 1,83x)", async () => {
    const S = rateEngine({ videoRate: 1.5, dur: 2.0 });
    await S.run(300);
    S.video.play();
    await S.run(20000);
    const rates = S.eng.stats.started.map(x => x.rate);
    assert.ok(rates.length > 0);
    assert.ok(rates.every(r => r * 1.5 <= 1.6 + 1e-9), `tốc độ thật ${rates.map(r => (r * 1.5).toFixed(2))}`);
});

test("giải phóng audio các câu đã qua xa (video dài không phình bộ nhớ); tua lại lấy từ kho, KHÔNG tạo lại", async () => {
    const groups = Array.from({ length: 40 }, (_, i) => mkGroup(`Câu thứ ${i + 1} của video dài.`, 1 + i * 4, 3.5 + i * 4, `S${i}.`));
    const S = speechRun(groups, groups.map(() => 1.5));
    const store = new Map();
    S.eng.d.audioCache = { async get(keys) { const o = {}; for (const k of keys) if (store.has(k)) o[k] = store.get(k); return o; }, put(k, rec) { store.set(k, rec); } };
    await S.run(300);
    S.video.play();
    await S.run(140000);
    const released = S.eng.stats.released || 0;
    assert.ok(released > 5, `giải phóng ${released}`);
    assert.ok(S.eng.rendered.size < 40, `còn giữ ${S.eng.rendered.size} đoạn`);
    const calls = S.provider.calls.flat().length;
    S.video.seek(5);
    await S.run(3000);
    assert.equal(S.provider.calls.flat().length, calls, "tua lại mà phải tạo lại audio");
    assert.ok(S.eng.stats.cacheHits > 0);
});

test("VieNeu bận (429): chờ theo Retry-After rồi thử lại (tối đa 2 lần), không coi là lỗi", async () => {
    let n = 0;
    const calls = [];
    const inner = vieneuServer(calls);
    const E = bgEnv(async (u, o) => {
        if (String(u).endsWith("/v1/audio/speech") && n++ < 1) return { ok: false, status: 429, headers: { get: () => "0" }, text: async () => "busy" };
        return inner(u, o);
    }, cfg());
    const r = await E.send({ action: "synthesizeSpeech", engine: "vieneu", text: "Xin chào.", voice: "Mỹ Duyên", parts: [{ key: "b429", weight: 3 }] });
    assert.equal(r.ok, true);
    assert.equal(n, 2);
});

test("bản dịch về KHÔNG theo thứ tự (dịch song song): audio đã tạo giữ nguyên, không tạo lại, không im giữa chừng", async () => {
    const all = Array.from({ length: 10 }, (_, i) => mkGroup(`Đây là câu thứ ${i + 1} trong bài giảng.`, 1 + i * 3, 3.5 + i * 3, `S${i}.`));
    // Ban đầu chỉ có các câu 3..6 (quanh vị trí đang xem); câu 1, 2 và 7..10 về sau
    const have = new Set([2, 3, 4, 5]);
    const S = speechRun([], all.map(() => 1.6));
    S.eng.d.getGroups = () => all.filter((g, i) => have.has(i));
    S.video.currentTime = 7;
    await S.run(300);
    S.video.play();
    await S.run(1500);
    const calls0 = S.provider.calls.flat().length;
    assert.ok(calls0 >= 2);
    const startOf = id => { const p = S.eng.planById.get(id); return p ? p.start : null; };
    const renderedStarts = () => S.eng.plans.filter(p => S.eng.rendered.has(p.id)).map(p => p.start);
    const before = renderedStarts();
    assert.ok(before.length >= 2);
    // Câu 1, 2 (phía trước) dịch xong muộn -> trước đây đổi mã mọi đoạn phía sau
    const startsCalled = S.provider.calls.flat().map(startOf);
    have.add(0); have.add(1);
    S.eng.tick();
    const after = renderedStarts();
    for (const st of before) assert.ok(after.includes(st), `câu ở ${st}s mất audio đã tạo sau khi câu phía trước dịch xong`);
    have.add(6); have.add(7); have.add(8); have.add(9);
    await S.run(22000);
    // Mỗi mốc câu được tạo audio đúng MỘT lần
    const calledStarts = [...startsCalled, ...S.provider.calls.flat().slice(startsCalled.length).map(startOf)];
    assert.equal(new Set(calledStarts).size, calledStarts.length, `tạo lại audio: ${JSON.stringify(calledStarts)}`);
    // Đọc đủ các câu 3..10, không bỏ câu
    assert.equal(S.eng.stats.dropped, 0);
    assert.ok(S.eng.stats.started.length >= 8, `chỉ đọc ${S.eng.stats.started.length} câu`);
});

test("nguồn giọng mặc định: Giọng Việt trên máy (VieNeu); chuyển một lần từ \"Tự động\", giữ lựa chọn riêng", () => {
    assert.equal(bgEnv(async () => reply({}), cfg({})).syncStore.dubProvider, "vieneu");
    assert.equal(bgEnv(async () => reply({}), cfg({ dubProvider: "auto" })).syncStore.dubProvider, "vieneu");
    assert.equal(bgEnv(async () => reply({}), cfg({ dubProvider: "gemini" })).syncStore.dubProvider, "gemini");
    // Đã chuyển rồi: người dùng chọn lại "Tự động" thì giữ nguyên
    assert.equal(bgEnv(async () => reply({}), cfg({ dubProvider: "auto", dubProvider1113: true })).syncStore.dubProvider, "auto");
    const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "options.html"), "utf8");
    assert.match(html, /<option value="vieneu" selected>/);
    assert.doesNotMatch(html, /dubLocalModel|Model VieNeu/);
});

test("rút gọn câu (Gemini) chậm 8 giây: KHÔNG chặn việc tạo audio quá 2,5 giây, giọng không im cả quãng", async () => {
    const groups = Array.from({ length: 8 }, (_, i) => mkGroup(`Đây là một câu khá dài số ${i + 1} trong bài giảng về trí tuệ nhân tạo và dữ liệu lớn.`, 1 + i * 3, 3 + i * 3, `S${i}.`));
    // audio dài gấp đôi khung -> mọi câu "cần rút gọn"
    const S = speechRun(groups, groups.map(() => 4.2));
    let calls = 0;
    S.eng.d.condense = () => { calls++; const t0 = S.eng.d.now(); return new Promise(res => { const id = S.eng.d.setInterval(() => { if (S.eng.d.now() - t0 >= 8000) { S.eng.d.clearInterval(id); res(null); } }, 50); }); };
    await S.run(300);
    S.video.play();
    await S.run(12000);
    assert.ok(calls >= 1);
    const first = S.eng.stats.started[0];
    assert.ok(first && first.t < 4, `câu đầu tiên có tiếng lúc ${first && first.t}`);
    assert.ok(S.eng.stats.started.length >= 4, `chỉ đọc ${S.eng.stats.started.length} câu trong 12 giây`);
    // Trước đây câu 2 trễ 3,9 giây vì chờ rút gọn; nay trễ chỉ do audio dài hơn khung
    const worst = Math.max(...S.eng.stats.started.map(x => x.lag));
    assert.ok(worst < 2, `trễ ${worst.toFixed(2)} giây vì chờ rút gọn`);
});

// Phụ đề TỰ ĐỘNG như video thật (DwWu9ZKCSzU): các dòng ~2 giây nối liền, KHÔNG dấu câu, mỗi nhóm
// dịch ~20 giây. Giọng tạo audio mất 0,3 giây cho mỗi giây lời (VieNeu trên M3, đo thật 0,25 đến 0,3).
function asrRun(startAt, rtf = 0.3) {
    const words = "hôm nay tôi muốn chia sẻ với các bạn một vài thói quen giúp cuộc sống của tôi trở nên đơn giản hơn rất nhiều".split(" ");
    const groups = [];
    for (let gi = 0; gi < 30; gi++) {
        const g0 = gi * 20;
        const src = Array.from({ length: 10 }, (_, k) => ({ start: g0 + k * 2, end: g0 + k * 2 + 2, text: `line ${gi}-${k} of the talk` }));
        // ~3,5 âm tiết mỗi giây video (người nói tiếng Anh ~2,7 từ/giây, bản Việt dài hơn ~1,3 lần)
        const vi = Array.from({ length: 10 }, (_, k) => words.slice((k * 7) % 15, (k * 7) % 15 + 7).join(" ")).join(" ");
        groups.push({ start: g0, end: g0 + 20, srcCues: src, viText: vi, viCues: seg.segmentGroupSafe(vi, src) });
    }
    const S = speechRun(groups, []);
    const clock = S.eng.d;
    // Thời lượng audio theo số âm tiết (giọng 3,6 âm tiết/giây); tạo mất 0,3 giây cho mỗi giây lời
    S.provider.render = plans => {
        S.provider.calls.push(plans.map(p => p.id));
        const out = plans.map(p => { const d = p.phrases.reduce((a, ph) => a + ph.syl, 0) / 3.6; return { planId: p.id, wav: new Uint8Array(Math.round(d * 1000)), duration: d, sampleRate: 24000 }; });
        const need = out.reduce((a, o) => a + o.duration, 0) * rtf * 1000 + 150;
        const t0 = clock.now();
        return new Promise(res => { const id = clock.setInterval(() => { if (clock.now() - t0 >= need) { clock.clearInterval(id); res(out); } }, 50); });
    };
    S.provider.tempo = { targetSps: 4.8, maxTempo: 1.22, minSps: 4.0, maxFloor: 1.15 };
    S.provider.naturalSps = () => 3.6;
    S.provider.caps = { ...S.provider.caps, serial: true, maxBatch: 1, free: true };   // như VieNeu
    S.video.currentTime = startAt;
    return S;
}

test("phụ đề tự động (dòng nối liền, không dấu câu): đoạn đọc <= 8 giây, có tiếng nhanh kể cả khi mở giữa video, không im giữa câu", async () => {
    const S = asrRun(300);
    await S.run(100);
    const longest = Math.max(...S.eng.plans.map(p => p.end - p.start));
    assert.ok(longest <= 8.01, `đoạn đọc dài ${longest.toFixed(1)} giây (trước đây cả nhóm 20 giây)`);
    S.video.play();
    await S.run(30000);
    const st = S.eng.stats.started;
    assert.ok(st.length >= 4, `chỉ đọc ${st.length} đoạn trong 30 giây`);
    // Tiếng đầu tiên: đoạn quanh chỗ bắt đầu được cắt ngắn (~3,5 giây) -> tạo nhanh. Đo: 1,65 giây
    // khi đoạn đầu dài 5 giây (1.2.4), nay ~1,1 giây (trước 1.2.4: 25 giây vẫn chưa có)
    const head = S.eng.planById.get(st[0].id);
    assert.ok(head.end - head.start <= 3.6, `đoạn đầu dài ${(head.end - head.start).toFixed(1)} giây`);
    assert.ok(st[0].t - 300 < 1.3, `tiếng đầu tiên sau ${(st[0].t - 300).toFixed(2)} giây`);
    if (process.env.SHOW) console.log("tiếng đầu tiên sau", (st[0].t - 300).toFixed(2), "giây; đoạn đầu", (head.end - head.start).toFixed(1), "giây");
    // Không im giữa câu: giữa hai đoạn liền nhau của cùng một câu, khoảng im <= 0,3 giây
    const gaps = st.slice(1).map((x, i) => ({ gap: x.t - st[i].speechEnd, cont: S.eng.planById.get(st[i].id).continuesNext })).filter(x => x.cont);
    assert.ok(gaps.length >= 2);
    const bad = gaps.filter(x => x.gap > 0.3);
    assert.equal(bad.length, 0, `im giữa câu: ${JSON.stringify(bad.map(x => x.gap.toFixed(2)))}`);
});

test("mở video ở GIỮA một đoạn đọc: nói tiếp từ đúng chỗ trong audio, không bỏ cả đoạn rồi im chờ đoạn sau", async () => {
    const S = asrRun(303.8, 0.02);
    await S.run(100);
    const p = S.eng.plans[S.eng.planAt(303.8)];
    assert.ok(p.start < 303.8 && p.end > 304.5, "phải bắt đầu giữa một đoạn");
    S.video.play();
    await S.run(1500);
    const st = S.eng.stats.started;
    assert.ok(st.length >= 1 && st[0].id === p.id, `đoạn đang phát bị bỏ: ${JSON.stringify(st.map(x => x.id))}, đoạn ${p.id}`);
    assert.ok(st[0].t - 303.8 < 0.8, `có tiếng sau ${(st[0].t - 303.8).toFixed(2)} giây`);
});

test("VieNeu: mọi yêu cầu (nhiều tab, làm nóng giọng) xếp hàng trong service worker, máy chủ không bao giờ nhận 2 yêu cầu cùng lúc", async () => {
    const calls = [];
    const inner = vieneuServer(calls);
    let active = 0, peak = 0;
    const E = bgEnv(async (u, o) => {
        if (!String(u).endsWith("/v1/audio/speech")) return inner(u, o);
        active++; peak = Math.max(peak, active);
        await new Promise(r => setTimeout(r, 15));
        try { return await inner(u, o); } finally { active--; }
    }, cfg());
    const rs = await Promise.all([
        E.send({ action: "localTtsWarm", voices: ["Mỹ Duyên", "Thái Sơn"] }),
        ...[1, 2, 3, 4].map(i => E.send({ action: "synthesizeSpeech", engine: "vieneu", text: `Câu thử số ${i} cho hàng đợi.`, voice: "Mỹ Duyên", parts: [{ key: "q" + i, weight: 6 }] }))
    ]);
    assert.ok(rs.every(r => r.ok), JSON.stringify(rs.map(r => r.error)));
    assert.equal(peak, 1, `máy chủ nhận ${peak} yêu cầu cùng lúc`);
    // Làm nóng mỗi giọng chỉ một lần trong phiên
    const warmCalls = calls.filter(c => c.input === "Xin chào.").length;
    await E.send({ action: "localTtsWarm", voices: ["Mỹ Duyên", "Thái Sơn"] });
    assert.equal(calls.filter(c => c.input === "Xin chào.").length, warmCalls);
});

test("VieNeu bị kẹt (log thật: 6 giây audio mất 45 giây): hủy theo độ dài câu rồi tạo lại, câu vẫn có audio", async () => {
    const calls = [];
    const inner = vieneuServer(calls);
    let n = 0;
    const E = bgEnv(async (u, o) => {
        if (String(u).endsWith("/v1/audio/speech") && n++ === 0) {
            // lần đầu treo tới khi bị hủy
            return new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(new Error("aborted"))));
        }
        return inner(u, o);
    }, cfg(), { timeScale: 0.01 });
    const r = await E.send({ action: "synthesizeSpeech", engine: "vieneu", text: "Hóa ra mô hình bị quá khớp với dữ liệu huấn luyện.", voice: "Mỹ Duyên", parts: [{ key: "hang1", weight: 12 }] });
    assert.equal(r.ok, true, r.error);
    assert.equal(n, 2);
    // Thời gian chờ tỷ lệ với độ dài câu: câu ngắn 8 giây, không phải 45 giây
    assert.equal(E.sandbox.localTimeoutMs("Xin chào các bạn."), 8000);
    assert.ok(E.sandbox.localTimeoutMs("một ".repeat(60)) > 8000);
});

test("VieNeu trả audio dài bất thường (mô hình lặp): không dùng, tạo lại", async () => {
    let n = 0;
    const E = bgEnv(async (u, o) => {
        if (!String(u).endsWith("/v1/audio/speech")) return vieneuServer([])(u, o);
        const sec = n++ === 0 ? 30 : 1.5;
        const pcm = Buffer.alloc(Math.round(sec * 24000) * 2, 1);
        return { ok: true, status: 200, arrayBuffer: async () => pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length) };
    }, cfg());
    const r = await E.send({ action: "synthesizeSpeech", engine: "vieneu", text: "Xin chào các bạn.", voice: "Mỹ Duyên", parts: [{ key: "run1", weight: 4 }] });
    assert.equal(r.ok, true);
    assert.equal(n, 2);
    assert.ok(r.parts[0].duration < 3);
});

test("giọng VieNeu mặc định: Mỹ Duyên + Thái Sơn (miền Nam), model v3 Turbo; chuyển một lần từ mặc định cũ, giữ lựa chọn riêng", () => {
    assert.equal(COST.LOCAL_TTS.defaultVoice, "Mỹ Duyên");
    assert.equal(COST.LOCAL_TTS.defaultVoice2, "Thái Sơn");
    assert.equal(COST.LOCAL_TTS.model, "vieneu-v3-turbo");
    assert.equal(COST.LOCAL_TTS.temperature, 0.6);
    const A = bgEnv(async () => reply({}), cfg({ dubLocalVoice: "Thùy Dung", dubLocalVoice2: "Minh Triết" }));
    assert.equal(A.syncStore.dubLocalVoice, "Mỹ Duyên");
    assert.equal(A.syncStore.dubLocalVoice2, "Thái Sơn");
    const B = bgEnv(async () => reply({}), cfg({ dubLocalVoice: "Kim Thanh", dubLocalVoice2: "Đức Trí" }));
    assert.equal(B.syncStore.dubLocalVoice, "Kim Thanh");
    assert.equal(B.syncStore.dubLocalVoice2, "Đức Trí");
});

// ================= PHIÊN BẢN: quy tắc của Đàm + thời gian cập nhật =================
test("phiên bản: đúng quy tắc (mỗi lần +0.0.1, tới 9 thì sang bậc trên), thống nhất mọi nơi, Cài đặt ghi thời gian cập nhật", () => {
    const fs = require("node:fs"), path = require("node:path");
    const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    const { next, valid } = require("../tools/bump-version.js");
    assert.deepEqual(["0.0.0", "1.1.9", "1.2.4", "1.2.9", "1.9.9"].map(next), ["0.0.1", "1.2.0", "1.2.5", "1.3.0", "2.0.0"]);
    const v = JSON.parse(R("manifest.json")).version;
    assert.ok(valid(v), `phiên bản ${v} sai quy tắc`);
    assert.equal(JSON.parse(R("package.json")).version, v);
    const build = require("../build-info.js");
    assert.equal(build.version, v);
    assert.ok(!isNaN(Date.parse(build.updatedAt)));
    assert.match(R("options.html"), new RegExp(`Phiên bản v${v.replace(/\./g, "\\.")} · cập nhật ${build.updatedLabel}`));
    assert.match(R("popup.html"), new RegExp(`>v${v.replace(/\./g, "\\.")}<`));
    // Nhãn vẫn đọc được bởi bộ phát hiện tiện ích chưa nạp lại
    const VC = require("../version-check.js");
    const doc = { querySelector: () => ({ textContent: `Phiên bản v${v} · cập nhật ${build.updatedLabel}` }) };
    assert.equal(VC.diskVersion(doc, ".header-badge"), v);
});

test("Tải lại tiện ích: tự nạp lại ĐỦ mã (đúng thứ tự manifest) vào tab YouTube / Coursera đang mở, không cần F5", async () => {
    const tabs = [
        { id: 1, url: "https://www.youtube.com/watch?v=abc" },
        { id: 2, url: "https://www.coursera.org/learn/x/lecture/y" },
        { id: 3, url: "https://example.com/" },
        { id: 4, url: "https://www.youtube.com/watch?v=zzz", discarded: true }
    ];
    const E = bgEnv(async () => reply({}), cfg(), { tabs, injectFail: o => o.target.tabId === 2 && o.world === "MAIN" });
    assert.equal(E.installedListeners.length, 1);
    E.installedListeners[0]({ reason: "update" });
    await new Promise(r => setTimeout(r, 20));
    const manifest = JSON.parse(require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "manifest.json"), "utf8"));
    const iso = manifest.content_scripts.find(g => g.world !== "MAIN");
    const yt = E.injected.filter(o => o.target.tabId === 1);
    assert.deepEqual(yt.map(o => o.world), ["MAIN", "ISOLATED"]);
    assert.deepEqual([...yt[1].files], iso.js, "phải nạp đủ tệp theo thứ tự manifest");
    assert.ok(iso.js.indexOf("subtitle-style.js") < iso.js.indexOf("youtube.js"));
    // Coursera: chỉ mã ISOLATED (không có cầu nối YouTube)
    assert.deepEqual(E.injected.filter(o => o.target.tabId === 2).map(o => o.world), ["ISOLATED"]);
    assert.equal(E.injected.filter(o => o.target.tabId === 3 || o.target.tabId === 4).length, 0);
    // popup: nạp dự phòng cũng lấy đủ tệp từ manifest (không còn danh sách 4 tệp)
    const popup = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "popup.js"), "utf8");
    assert.match(popup, /getManifest\(\)\.content_scripts/);
});

test("mã cũ trong tab tự tắt khi tiện ích được nạp lại; nút / lớp phụ đề của mã cũ bị ẨN (không xóa) để mã mới thay", () => {
    const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "youtube.js"), "utf8");
    assert.match(src, /function ytTuTatKhiMatKetNoi/);
    assert.match(src, /chrome\.runtime && chrome\.runtime\.id/);
    // Phần tử của thế hệ mã khác: ẨN, không bao giờ XÓA (xóa -> hai thế hệ xóa / tạo lại nhau vô tận,
    // treo tab; xem tests/reload-fight.test.js)
    assert.match(src, /ytAnCuaMaKhac\(player, "\.cst-yt-overlay"\)/);
    assert.match(src, /ytAnCuaMaKhac\(rightControls, "\.cst-ytp-btn"\)/);
    assert.doesNotMatch(src, /cstGen !== YT_GEN\) \w\.remove\(\)/);
    const cs = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "content.js"), "utf8");
    assert.match(cs, /el\.dataset\.cstGen !== CS_GEN && el\.style\.display !== "none"\) el\.style\.display = "none"/);
    assert.doesNotMatch(cs, /cstGen !== CS_GEN\) el\.remove\(\)/);
});

test("lồng tiếng tự bật MẶC ĐỊNH (chưa từng chọn / kho cài đặt bị tạo lại); Cài đặt có ô Tự động lồng tiếng", () => {
    const fs = require("node:fs"), path = require("node:path");
    const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    assert.match(R("youtube.js"), /ytSettings\.dubEnabled = res\.dubEnabled !== false;/);
    assert.match(R("content.js"), /state\.dubEnabled = saved\.dubEnabled !== false;/);
    assert.match(R("popup.js"), /dubbingBox\.checked = saved\.dubEnabled !== false;/);
    assert.match(R("options.html"), /id="autoDub" checked/);
    assert.match(R("options.js"), /dubEnabled: autoDubBox \? autoDubBox\.checked : true/);
});

test("đoạn đọc được cắt NGAY SAU dấu câu (kể cả giữa khung phụ đề 2 dòng), không cắt ngang một vế câu", () => {
    const PL = require("../dub-planner.js");
    // Khung phụ đề ~5 giây, dấu phẩy nằm giữa khung (như bản dịch Gemini của phụ đề tự động)
    const lines = [
        "Hôm nay tôi sẽ chia sẻ cách tôi sắp xếp, toàn bộ cuộc sống số của mình",
        "từ điện thoại đến máy tính, và cả những ứng dụng mà tôi dùng hằng ngày",
        "để làm việc hiệu quả hơn, bớt xao nhãng hơn và có nhiều thời gian hơn",
        "cho những điều thật sự quan trọng, như gia đình và sức khỏe của bản thân."
    ];
    const src = lines.map((_, k) => ({ start: k * 5, end: k * 5 + 5, text: `line ${k}` }));
    const vi = lines.join(" ");
    const g = { start: 0, end: 20, srcCues: src, viText: vi, viCues: lines.map((t, k) => ({ start: k * 5, end: k * 5 + 5, text: t })) };
    const script = PL.buildDubScript([g]);
    assert.ok(script.length >= 2, JSON.stringify(script.map(x => x.subtitleText)));
    for (const seg of script.slice(0, -1)) {
        assert.match(seg.subtitleText, /[,.;:!?…]$/, `cắt ngang vế câu: "${seg.subtitleText.slice(-30)}"`);
        assert.ok(seg.end - seg.start <= 8.01);
    }
    // Chỉ đoạn cuối có dấu chấm -> các đoạn trước đều là "câu chưa hết" (đọc nối liền)
    assert.ok(script.slice(0, -1).every(x => x.continuesNext), "các đoạn giữa câu phải đọc nối liền");
});

test("khoảng ngừng nhỏ giữa câu (0,8 giây, chưa có dấu chấm) vẫn là câu CHƯA HẾT -> đọc nối liền, không dừng chờ phụ đề", () => {
    const PL = require("../dub-planner.js");
    const a = { start: 0, end: 3, srcCues: [{ start: 0, end: 3, text: "a" }], viText: "tôi luôn cố gắng giữ mọi thứ", viCues: [{ start: 0, end: 3, text: "tôi luôn cố gắng giữ mọi thứ" }] };
    const b = { start: 3.8, end: 6.5, srcCues: [{ start: 3.8, end: 6.5, text: "b" }], viText: "đơn giản nhất có thể.", viCues: [{ start: 3.8, end: 6.5, text: "đơn giản nhất có thể." }] };
    const script = PL.buildDubScript([a, b]);
    assert.equal(script.length, 2);
    assert.equal(script[0].continuesNext, true);
    // Hết câu (dấu chấm) hoặc ngừng dài (> 1,5 giây): không nối
    const c = { ...b, start: 5, end: 7, viCues: [{ start: 5, end: 7, text: "đơn giản nhất có thể." }] };
    assert.equal(PL.buildDubScript([a, c])[0].continuesNext, false);
});

test("cửa sổ Chrome bị che (bộ đếm giờ của trang chỉ chạy ~1 lần/giây): đoạn sau vẫn nối liền ngay khi đoạn trước phát xong", async () => {
    const S = asrRun(300, 0.05);
    // Giả lập Chrome giãn bộ đếm giờ của tab bị che: vòng xử lý 1 giây một lần
    S.eng.d.clearInterval(S.eng.timer);
    S.eng.timer = S.eng.d.setInterval(() => S.eng.tick(), 1000);
    await S.run(100);
    S.video.play();
    await S.run(30000);
    const st = S.eng.stats.started;
    assert.ok(st.length >= 4, `chỉ đọc ${st.length} đoạn`);
    const gaps = st.slice(1).map((x, i) => ({ gap: x.t - st[i].speechEnd, cont: S.eng.planById.get(st[i].id).continuesNext })).filter(x => x.cont);
    assert.ok(gaps.length >= 2);
    const worst = Math.max(...gaps.map(x => x.gap));
    assert.ok(worst <= 0.3, `hụt ${worst.toFixed(2)} giây giữa hai đoạn của cùng câu`);
});

// ================= CHỜ CHUẨN BỊ (tối đa 3,5 giây) khi mở video mới / tua tới đoạn mới =================
function holdEnv() {
    const msgs = [];
    const env = dubbingEnvFor("balanced", "vieneu", msgs, () => ({ ok: false }));
    env.setInterval = setInterval; env.clearInterval = clearInterval;
    env.document.createElement = () => ({ style: {}, remove() {}, set textContent(v) { this.text = v; } });
    const video = { paused: true, listeners: {}, parentElement: { appendChild() {} },
        addEventListener(n, f) { (this.listeners[n] = this.listeners[n] || []).push(f); },
        removeEventListener(n, f) { this.listeners[n] = (this.listeners[n] || []).filter(x => x !== f); },
        emit(n) { (this.listeners[n] || []).forEach(f => f()); },
        pause() { this.paused = true; this.emit("pause"); }, play() { this.paused = false; this.emit("play"); return Promise.resolve(); } };
    return { env, video };
}

test("chờ chuẩn bị: video mới bị giữ dừng (kể cả khi trình phát tự phát), phát tiếp NGAY khi phụ đề + giọng sẵn sàng", async () => {
    const { env, video } = holdEnv();
    let ready = false;
    const t0 = Date.now();
    assert.equal(env.CST_DUB.prepareHold(video, () => ready, { initial: true }), true);
    video.play();                                   // YouTube tự phát video mới
    assert.equal(video.paused, true, "phải giữ dừng trong lúc chuẩn bị");
    setTimeout(() => { ready = true; }, 400);
    while (video.paused && Date.now() - t0 < 3000) await new Promise(r => setTimeout(r, 20));
    const waited = Date.now() - t0;
    assert.equal(video.paused, false, "phải tự phát tiếp khi sẵn sàng");
    assert.ok(waited >= 380 && waited < 800, `phát tiếp sau ${waited} ms (sẵn sàng ở 400 ms)`);
    assert.equal(env.CST_DUB.hold.active, false);
});

test("chờ chuẩn bị: không bao giờ quá 5 giây; người xem tự bấm phát thì bỏ chờ; đã sẵn sàng thì không dừng", async () => {
    const A = holdEnv();
    A.video.paused = false;
    const t0 = Date.now();
    A.env.CST_DUB.prepareHold(A.video, () => false, {});
    assert.equal(A.video.paused, true);
    while (A.video.paused && Date.now() - t0 < 7000) await new Promise(r => setTimeout(r, 50));
    const waited = Date.now() - t0;
    assert.ok(waited >= 4900 && waited < 5300, `chờ ${waited} ms`);
    // Người xem bấm phát sau 1,5 giây: tôn trọng
    const B = holdEnv();
    B.video.paused = false;
    B.env.CST_DUB.prepareHold(B.video, () => false, {});
    await new Promise(r => setTimeout(r, 1600));
    B.video.play();
    assert.equal(B.video.paused, false);
    assert.equal(B.env.CST_DUB.hold.active, false);
    // Đã sẵn sàng (tua lại đoạn đã có giọng): không dừng
    const C = holdEnv();
    C.video.paused = false;
    assert.equal(C.env.CST_DUB.prepareHold(C.video, () => true, {}), false);
    assert.equal(C.video.paused, false);
});

test("engine.isReadyAt: chưa dịch -> chưa sẵn sàng; đã dịch nhưng chưa có giọng -> chưa; có giọng -> sẵn sàng; quãng không lời -> không chờ", async () => {
    const groups = [mkGroup("Xin chào các bạn, hôm nay chúng ta học bài mới.", 10, 13, "Hello.")];
    const S = speechRun(groups, [2]);
    const raw = [{ start: 10, end: 13, text: "Hello." }];
    S.eng.d.getGroups = () => raw;                 // chưa dịch
    assert.equal(S.eng.isReadyAt(9.5), false);
    S.eng.d.getGroups = () => groups;              // đã dịch
    S.eng.rendered.clear();
    assert.equal(S.eng.isReadyAt(9.5), false);
    await S.run(300);                              // engine tạo giọng
    assert.equal(S.eng.isReadyAt(9.5), true);
    assert.equal(S.eng.isReadyAt(40), true, "quãng không có lời: không cần chờ");
});

test("Cài đặt có ô Chờ chuẩn bị (mặc định bật); tua tới đoạn chưa có giọng thì chờ; mở video mới thì chờ", () => {
    const fs = require("node:fs"), path = require("node:path");
    const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    assert.match(R("options.html"), /id="dubPrepareWait" checked/);
    assert.match(R("options.js"), /dubPrepareWait: document\.getElementById\("dubPrepareWait"\)/);
    assert.match(R("dubbing.js"), /reason !== "seek" \|\| !s\.dubPrepareWait/);
    assert.match(R("youtube.js"), /ytSettings\.prepareWait && ytSettings\.dubEnabled/);
});





test("KHÔNG rút gọn lời thoại ở mọi chế độ / mọi giọng; Cài đặt không còn ô rút gọn", async () => {
    const fs = require("node:fs"), path = require("node:path");
    const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    assert.doesNotMatch(R("options.html"), /id="dubCondense"/);
    for (const mode of ["premium", "balanced"]) {
        const msgs = [];
        const env = dubbingEnvFor(mode, "gemini", msgs, () => ({ ok: false }));
        const video = new FakeVideo(); video.play();
        assert.equal(await env.CST_DUB.start({ video, getGroups: () => require("./dub-sim.js").lectureGroups() }), true);
        assert.equal(env.CST_DUB.dub.engine.d.condense, null, `chế độ ${mode}`);
        env.CST_DUB.stop();
    }
});

test("người nói RẤT nhanh (đo thật 1.2.9: trễ dồn tới 4 giây): GIỮ NGUYÊN lời thoại; câu dày chữ rút khoảng nghỉ, đang trễ thì đọc tới 1,4x; trễ không dồn, không bỏ câu", async () => {
    const PL = require("../dub-planner.js");
    // Khung 3 giây/câu, câu Việt cần ~1,35x mới vừa (giọng thật 3,56 âm tiết/giây)
    const groups = Array.from({ length: 14 }, (_, i) => mkGroup(`Phần ${i + 1}: hệ thống tối giản giúp bạn giữ nhà cửa gọn gàng mỗi ngày.`, i * 3, i * 3 + 2.9, `S${i}.`));
    const S = speechRun(groups, []);
    const sps = 3.56;
    S.provider.caps = { ...S.provider.caps, free: true, serial: true, maxBatch: 1 };
    S.provider.tempo = { targetSps: 4.8, maxTempo: 1.22, minSps: 4.0, maxFloor: 1.15 };
    S.provider.naturalSps = () => sps;
    const texts = [];
    // Khoảng nghỉ ngắn (câu dày chữ) làm audio ngắn hơn ~8%, KHÔNG bớt chữ
    S.provider.render = plans => { S.provider.calls.push(plans.map(p => p.id)); return Promise.resolve(plans.map(p => { texts.push(p.text); const d = PL.countSyllables(p.text) / sps * (p.tightPauses ? 0.92 : 1); return { planId: p.id, wav: new Uint8Array(Math.round(d * 1000)), duration: d, sampleRate: 24000 }; })); };
    await S.run(100);
    S.video.play();
    await S.run(45000);
    const st = S.eng.stats.started;
    assert.equal(S.eng.stats.dropped, 0);
    assert.equal(st.length, 14, `đọc ${st.length}/14 câu`);
    // Lời thoại đọc NGUYÊN VẸN như bản dịch (không câu nào bị bớt chữ)
    for (const g of groups) assert.ok(texts.some(t => t.includes(g.viText.slice(0, 20))), "thiếu câu");
    assert.ok(S.eng.plans.every(p => !p.condensedText));
    assert.ok(S.eng.plans.some(p => p.tightPauses), "câu dày chữ phải rút khoảng nghỉ");
    const lags = st.map(x => x.t - x.due);
    assert.ok(Math.max(...lags) < 2, `trễ tối đa ${Math.max(...lags).toFixed(2)} giây`);
    assert.ok(st.every(x => x.rate <= 1.4 + 1e-9));
});

test("VieNeu: câu dày chữ gửi yêu cầu khoảng nghỉ ngắn (0,15 giây), khóa kho riêng; service worker giới hạn trong [0,1 ; 0,4]", async () => {
    const calls = [];
    const E = bgEnv(vieneuServer(calls), cfg());
    const r = await E.send({ action: "synthesizeSpeech", engine: "vieneu", text: "Xin chào các bạn.", voice: "Mỹ Duyên", parts: [{ key: "tp1", weight: 5 }], maxPause: 0.01 });
    assert.equal(r.ok, true);
    const P = E_ENGINE.createVieneuProvider({ sendMessage: async () => ({ ok: true, running: true }) }, {});
    const plan = { speaker: "S1", phrases: [{ text: "Xin chào các bạn", syl: 4 }], continuesNext: false };
    const k1 = await P.audioKey(plan);
    const k2 = await P.audioKey({ ...plan, tightPauses: true });
    assert.notEqual(k1, k2);
    assert.equal(COST.LOCAL_TTS.tightPause, 0.15);
});

// Đo thật 22/09/2026 (video TED có phụ đề Việt do người dịch, bản 1.3.1): câu Việt ngắn hơn lời
// gốc, các đoạn của một câu được nói nối liền sớm tối đa 2 giây -> độ sớm CỘNG DỒN, giọng đi trước
// phụ đề tới 2,0 giây (7/25 đoạn sớm hơn 0,8 giây)
test("phụ đề thưa (câu Việt ngắn hơn khung): giọng KHÔNG đi trước phụ đề quá 0,8 giây dù nói nối liền nhiều đoạn, không bỏ đoạn nào", async () => {
    const texts = ["và rồi tôi nhận ra", "rằng mình đã", "trì hoãn suốt", "trong cả tuần", "mà không làm gì", "cho bài luận"];
    const groups = texts.map((vi, i) => mkGroup(vi, 1 + i * 2.2, 1 + i * 2.2 + 2, `part ${i}`));
    const S = speechRun(groups, texts.map(() => 0.6));
    await S.run(300);
    S.video.play();
    await S.run(16000);
    const st = S.eng.stats.started;
    if (process.env.SHOW) console.log(JSON.stringify(S.eng.plans.map(p => [p.id, p.index, p.continuesNext])), JSON.stringify(st.map(x => [x.id, +x.t.toFixed(2), x.due])));
    assert.equal(st.length, texts.length, `chỉ đọc ${st.length}/${texts.length} đoạn`);
    const early = st.filter(x => x.t < x.due - 0.85);
    assert.equal(early.length, 0, `đi trước phụ đề: ${JSON.stringify(early.map(x => (x.due - x.t).toFixed(2)))}`);
    assert.ok((S.eng.stats.chained || 0) >= 3, "vẫn phải nói nối liền (sớm có giới hạn) thay vì chờ đúng mốc từng đoạn");
});

test("đoạn chỉ 1 đến 2 âm tiết mà câu còn tiếp (\"Và\", \"Thế là\"): gộp vào đoạn sau, không tạo audio lẻ loi", () => {
    const PL = require("../dub-planner.js");
    const groups = [mkGroup("Và", 10, 11.6, "And"), mkGroup("tôi bắt đầu viết bài luận của mình", 12, 14, "I started writing my essay."), mkGroup("Xong.", 15, 15.8, "Done."), mkGroup("Hôm sau thì sao", 20, 21.5, "The next day?")];
    const script = PL.buildDubScript(groups);
    assert.equal(script.length, 3, JSON.stringify(script.map(x => x.subtitleText)));
    assert.equal(script[0].start, 10);
    assert.ok(/^Và tôi bắt đầu/.test(script[0].subtitleText), script[0].subtitleText);
    // câu đã kết thúc ("Xong.") hay đoạn cách xa thì KHÔNG gộp
    assert.equal(script[1].subtitleText.replace(/\s+/g, " ").trim(), "Xong.");
});

test("xóa audio đã lưu của MỘT video: chỉ xóa đúng khóa của video đó, audio video khác còn nguyên; engine tạo lại", async () => {
    const CACHE = require("../cst-cache.js");
    const c = CACHE.createCaches({ backend: CACHE.memoryBackend() });
    await c.audio.set("a", { wav: new Uint8Array(10) });
    await c.audio.set("b", { wav: new Uint8Array(10) });
    await c.audio.set("khac", { wav: new Uint8Array(10) });
    assert.equal(await c.audio.remove(["a", "b", "khong-co"]), 2);
    assert.equal(await c.audio.get("a"), null);
    assert.ok(await c.audio.get("khac"), "audio của video khác phải còn");

    const groups = [mkGroup("Xin chào các bạn, hôm nay chúng ta học về dữ liệu.", 1, 4, "Hi."), mkGroup("Bắt đầu nhé.", 5, 6.5, "Start.")];
    const S = speechRun(groups, [2.5, 1.0]);
    await S.run(300);
    const keys = await S.eng.audioKeysForVideo();
    for (const p of S.eng.plans) assert.ok(keys.includes(await S.provider.audioKey(p)), `thiếu khóa của đoạn ${p.id}`);
    assert.ok(S.eng.rendered.size > 0);
    const calls = S.provider.calls.length;
    S.eng.forgetRendered();
    assert.equal(S.eng.rendered.size, 0);
    await S.run(300);
    assert.ok(S.provider.calls.length > calls, "phải tạo lại audio sau khi xóa");
});

// Đo thật 22/09/2026 (bản 1.3.5): YouTube tự phát video mới 0,2 đến 0,4 giây trước khi bị giữ dừng ->
// phát tiếp từ 0,2 đến 0,4 giây, câu đầu mất vài chữ và giọng Việt vào trễ tương ứng
test("chờ chuẩn bị video MỚI: YouTube đã tự phát vài trăm mili giây thì quay về 0 rồi mới phát; tua / đang xem giữa video thì giữ nguyên vị trí", async () => {
    const { env, video } = holdEnv();
    video.paused = false; video.currentTime = 0.3;
    let ready = false;
    env.CST_DUB.prepareHold(video, () => ready, { initial: true });
    ready = true;
    const t0 = Date.now();
    while (video.paused && Date.now() - t0 < 2000) await new Promise(r => setTimeout(r, 20));
    assert.equal(video.paused, false);
    assert.equal(video.currentTime, 0, "phải phát lại từ đầu video");
    // Mở bằng liên kết có mốc thời gian (&t=120) hoặc tua: không kéo về đầu
    const B = holdEnv();
    B.video.paused = false; B.video.currentTime = 120.3;
    let r2 = false;
    B.env.CST_DUB.prepareHold(B.video, () => r2, { initial: true });
    r2 = true;
    while (B.video.paused && Date.now() - t0 < 4000) await new Promise(r => setTimeout(r, 20));
    assert.equal(B.video.currentTime, 120.3);
});

// Phản hồi 22/09/2026 (ảnh video TED): "(Vỗ tay)", "(Cười)" hiện trên phụ đề cũng bị đọc thành lời,
// nghe mất tự nhiên
test("chú thích âm thanh (Vỗ tay), (Cười), [Nhạc], (Laughter): KHÔNG đọc thành lời, khung chỉ có chú thích thành khoảng lặng; ngoặc giải thích vẫn đọc", () => {
    const PL = require("../dub-planner.js");
    const groups = [
        mkGroup("(Vỗ tay)", 0, 3, "(Applause)"),
        mkGroup("Khi còn học đại học, tôi học ngành chính trị.", 4, 7, "In college I was a government major."),
        mkGroup("(Cười)", 7.5, 9, "(Laughter)"),
        mkGroup("[Nhạc] Mô hình AI (trí tuệ nhân tạo) học từ dữ liệu. (Tiếng cười)", 10, 14, "[Music] AI models learn from data. (Laughter)")
    ];
    const script = PL.buildDubScript(groups);
    const said = script.map(x => x.speechSource.replace(/¦/g, "").replace(/\s+/g, " ").trim());
    assert.equal(script.length, 2, JSON.stringify(said));
    assert.ok(said.every(t => !/Vỗ tay|Cười|cười|Nhạc/.test(t)), JSON.stringify(said));
    assert.ok(/trí tuệ nhân tạo/.test(said[1]), "ngoặc giải thích phải được giữ");
    assert.equal(script[0].start, 4);
});

// Phản hồi 22/09/2026: đổi giọng đọc trong Cài đặt thì giọng CŨ và giọng MỚI đọc chồng lên nhau.
// Nguyên nhân: trang Cài đặt lưu tất cả mục -> dubbing.js và youtube.js cùng bật lại lồng tiếng;
// việc bật có nhiều bước chờ nên hai lượt chạy song song và tạo ra HAI bộ đọc cùng phát
test("đổi giọng đọc: hai lượt bật lồng tiếng cùng lúc chỉ để lại MỘT bộ đọc (giọng cũ tắt hẳn, không chồng tiếng)", async () => {
    const msgs = [];
    const env = dubbingEnvFor("balanced", "vieneu", msgs, m => (m.action === "localTtsStatus" ? { ok: true, running: true } : { ok: false }));
    const made = [];
    const Real = env.CST_DUB_ENGINE.DubEngine;
    env.CST_DUB_ENGINE.DubEngine = function (d, o) { const e = new Real(d, o); made.push(e); return e; };
    const video = new FakeVideo();
    video.play();
    const groups = () => require("./dub-sim.js").lectureGroups();
    const [a, b] = await Promise.all([                      // hai nơi cùng bật lại (đổi giọng)
        env.CST_DUB.start({ video, getGroups: groups }),
        env.CST_DUB.start({ video, getGroups: groups })
    ]);
    assert.ok(a || b, "ít nhất một lượt phải bật được");
    const running = made.filter(e => e.running);
    assert.equal(running.length, 1, `${running.length} bộ đọc cùng chạy (giọng chồng nhau)`);
    assert.equal(env.CST_DUB.dub.engine, running[0], "bộ đọc đang chạy phải là bộ mới nhất");
    env.CST_DUB.stop();
    assert.equal(made.filter(e => e.running).length, 0);
});
