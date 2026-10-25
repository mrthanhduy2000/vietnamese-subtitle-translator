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

const SYNC_MAX_LAG = 4.5;               // the engine's drop threshold (SYNC.maxQueueLag)
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

test("a lapsed refusal mark: Settings name the model that really translates (3.1) and the one retried once (2.5)", async () => {
    const local = {};
    await bgEnv(server([]), cfg(), { local }).send(REQ);
    for (const kh of Object.keys(local.modelAccess)) local.modelAccess[kh]["gemini-2.5-flash-lite"].until = Date.now() - 1;
    const E = bgEnv(server([]), cfg(), { local });
    const cost = await E.send({ action: "costStats" });
    assert.equal(cost.model.id, "gemini-3.1-flash-lite");
    assert.equal(cost.model.retry, "gemini-2.5-flash-lite");
    const st = await E.send({ action: "modelStatus" });
    assert.equal(st.effective.cheap, "gemini-3.1-flash-lite");
    assert.equal(st.effective.cheapRetry, "gemini-2.5-flash-lite");
    assert.equal(st.models["gemini-2.5-flash-lite"].state, "retry");
    // Another key never refused: nothing to retry, auto still names 2.5
    const other = await E.send({ action: "modelStatus", key: "KEY-OLD-USER" });
    assert.equal(other.effective.cheapRetry, "");
    assert.equal(other.models["gemini-2.5-flash-lite"].state, "unknown");
});

test("a model refused again after its mark lapsed is remembered twice as long each time, capped at 30 days", async () => {
    const local = {};
    const day = 24 * 3600 * 1000;
    await bgEnv(server([]), cfg(), { local }).send(REQ);
    const mark = () => Object.values(local.modelAccess)[0]["gemini-2.5-flash-lite"];
    assert.equal(mark().ttl, 3 * day);
    const spans = [];
    for (let i = 0; i < 5; i++) {
        mark().until = Date.now() - 1;
        const seen = [];
        await bgEnv(server(seen), cfg(), { local }).send({ ...REQ, sentences: [`Lapse ${i}.`] });
        assert.equal(seen[0], "gemini-2.5-flash-lite", "a lapsed mark is retried");
        spans.push(Math.round(mark().ttl / day));
    }
    assert.deepEqual(spans, [6, 12, 24, 30, 30]);
    assert.ok(mark().until - Date.now() > 29 * day);
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

test("key test after fixing billing: it asks Google again instead of repeating the 10-minute block", async () => {
    let paid = false, calls = 0;
    const f = async () => {
        calls++;
        if (!paid) return { ok: false, status: 402, json: async () => ({ error: { code: 402, message: "Prepaid credits exhausted" } }) };
        return reply({ t: ["Trí tuệ nhân tạo"] });
    };
    const E = bgEnv(f, { geminiApiKey: "K", costMigration113: true });
    const r1 = await E.send({ action: "testKey", key: "K", model: "auto" });
    assert.equal(r1.errorType, "payment");
    paid = true;                                        // the viewer tops up in AI Studio
    const r2 = await E.send({ action: "testKey", key: "K", model: "auto" });
    assert.equal(r2.ok, true);
    assert.equal(calls, 2, "the second test reached Google");
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

test("an auto start whose captions came back empty tries again (on a timer, at once when the tab is shown) and stops when turned off", async () => {
    const run = async ({ showTab, turnOff }) => {
        const P = pageEnv({ sync: { autoTranslate: true } });
        const S = P.sandbox;
        await new Promise(r => setTimeout(r, 20));
        S.__calls = 0; S.__vis = null;
        S.document.addEventListener = (n, f) => { if (n === "visibilitychange") S.__vis = f; };
        S.document.removeEventListener = () => {};
        S.document.hidden = true;
        vm.runInContext(`
            YT_EMPTY_RETRY_MS[0] = ${showTab ? 60000 : 30}; YT_EMPTY_RETRY_MS[1] = 30; YT_EMPTY_RETRY_MS[2] = 30;
            ytLayMaVideo = () => "abc123";
            ytHoiDanhSachPhuDe = async () => ({ tracks: [{ baseUrl: "u", languageCode: "en", kind: "asr" }], videoId: "abc123" });
            ytBatDauDich = async () => { __calls++; if (__calls < 3) { yt.emptyCaptionsFor = "abc123"; return false; } yt.active = true; return true; };
            ytTuBatLongTieng = async () => false;
            ytDatTrangThaiNut = () => {};
            yt.autoTried = ""; yt.active = false; yt.busy = false;
        `, S);
        await vm.runInContext("ytNapCaiDatKieu()", S);
        await vm.runInContext("ytTuDongDich()", S);
        if (turnOff) vm.runInContext("ytTatDich()", S);
        if (showTab) { S.document.hidden = false; await new Promise(r => setTimeout(r, 5)); S.__vis(); }
        await new Promise(r => setTimeout(r, 200));
        return S.__calls;
    };
    assert.equal(await run({}), 3, "two empty answers, the third start succeeds");
    assert.equal(await run({ showTab: true }), 3, "showing the tab asks at once, not after the long wait");
    assert.equal(await run({ turnOff: true }), 1, "turned off by hand: no retry");
});

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

// Voice server slower than real time (process starved of CPU, machine busy): a segment's audio
// lands after its subtitle is gone. Before 1.4.7 the engine waited 4.5s per segment before
// dropping it, and kept rendering segments it had already dropped. Simulated on the real timeline
// of an 11-minute video: 12/61 sentences spoken with a 63s silence; after the fix, 30/61.
test("slow voice server: keeps speaking, skips to a reachable segment, renders nothing for dropped ones", async () => {
    const groups = [];
    // Wall-to-wall speech, one sentence straight into the next, like a real talk: the engine has
    // no gap to catch up in, so a slow server shows immediately
    for (let i = 0; i < 20; i++) groups.push(mkGroup(`Câu số ${i + 1} nói về việc dọn dẹp lại căn phòng cho gọn gàng.`, i * 4, i * 4 + 4, "Line."));
    const clock = new Clock(), video = new FakeVideo();
    const audios = [];
    const calls = [];                       // per TTS request: the segments asked for + the queue mark then
    let busyUntil = 0;
    let eng = null;
    const provider = {
        id: "vieneu", label: "giả", caps: { prerender: true, live: false, free: true }, voiceLabel: "Thục Đoan",
        voiceModel: { sylPerSec: 4.3, rateExp: 1, pauseFactor: 1.3, calibration: 1 },
        tempo: { targetSps: 4.6, minSps: 3.9, maxTempo: 1.25, maxFloor: 1.15 },
        naturalSps: () => 4.3,
        audioKey: async p => "k" + p.id,
        abort() {},
        render(plans) {
            calls.push({ ids: plans.map(p => p.id), mark: eng.lastSpokenStart });
            const dur = plans.map(p => p.phrases.reduce((a, ph) => a + ph.syl, 0) / 4.3 + 0.3);
            const gen = dur.reduce((a, b) => a + b, 0) * 900 + 250;       // 0.9s to generate 1s of speech
            const at = Math.max(clock.now(), busyUntil);                  // the real server has 1 stream
            busyUntil = at + gen;
            return new Promise(res => clock.setTimeout(() => res(plans.map((p, i) => ({
                planId: p.id, wav: new Uint8Array(Math.round(dur[i] * 1000)), duration: dur[i], sampleRate: 24000
            }))), at - clock.now() + gen));
        }
    };
    eng = new DubEngine({
        video, getGroups: () => groups, providers: { primary: provider },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        setTimeout: (f, ms) => clock.setTimeout(f, ms),
        createObjectURL: b => "blob:" + b.length, revokeObjectURL() {},
        createAudio: url => { const a = new FakeAudio(clock, { duration: Number(url.slice(5)) / 1000 }); audios.push(a); return a; }
    }, { prefetchMax: 30 });
    eng.start();
    video.play();
    for (let i = 0; i < 1600; i++) {          // 80 seconds of video
        clock.advance(50, st => { video.step(st); audios.forEach(a => a.step(st)); });
        await new Promise(r => setImmediate(r));
    }
    assert.ok(eng.stats.started.length >= 8, `only ${eng.stats.started.length} segments spoken on a slow server`);
    assert.ok((eng.stats.skipped || 0) >= 1, "must skip to a reachable segment instead of waiting one by one");
    const wasted = calls.filter(c => c.mark != null && c.ids.every(id => {
        const p = eng.planById.get(id);
        return p && p.start <= c.mark;
    }));
    assert.equal(wasted.length, 0, "rendered audio for a dropped segment (steals a slot from the next one)");
    const lags = eng.stats.started.map(x => x.t - x.due);
    assert.ok(Math.max(...lags) <= SYNC_MAX_LAG, `a segment started ${Math.max(...lags).toFixed(1)}s late`);
});

// Cold start: VieNeu idle for days had its model swapped out by macOS. The first render ran at 3.5x
// real time, later ones at ~0.25x. Before 1.7.7 that one sample set the speed estimate and the page
// dropped 7 sentences as unreachable; the fixed request overhead was also counted twice.
test("render speed: first sample capped, overhead counted once, a recovered server stops drops at once", () => {
    const E = { renderRtf: null, lastRtf: null };
    const dropRtf = DubEngine.prototype.dropRtf;
    assert.equal(dropRtf.call(E), 0.5, "no sample yet: the default guess");
    // the formula renderBatch applies to one finished job (seconds spent, seconds of speech)
    const sample = (secs, audio) => {
        let rtf = Math.max(0.05, secs - 0.6) / audio;
        if (E.renderRtf == null) rtf = Math.min(rtf, 1);
        E.lastRtf = rtf;
        E.renderRtf = E.renderRtf == null ? rtf : E.renderRtf * 0.7 + rtf * 0.3;
    };
    sample(0.6 + 3 * 3.5, 3);                          // cold: 3 s of speech took 11.1 s
    assert.equal(E.renderRtf, 1, "one cold render must not read as 3.5x");
    sample(0.6 + 3 * 0.25, 3);                         // warm again
    assert.ok(Math.abs(dropRtf.call(E) - 0.25) < 1e-9, `recovered server still judged slow: ${dropRtf.call(E)}`);
    sample(0.6 + 3 * 3.5, 3); sample(0.6 + 3 * 3.5, 3); // a server that stays slow still shows it
    assert.ok(dropRtf.call(E) > 2, `slow server not seen: ${dropRtf.call(E)}`);
    // the engine really uses these numbers
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "dub-engine.js"), "utf8");
    assert.match(src, /renderOverhead: 0\.6/);
    assert.match(src, /own - this\.renderOver\(\)\) \/ audioSecs/);
    assert.match(src, /if \(this\.renderRtf == null\) rtf = Math\.min\(rtf, SYNC\.firstRtfCap\)/);
    assert.match(src, /const rtf = this\.dropRtf\(\);/);
});

// BACKLOG 33 (1.9.7): with a server near real time the reach decisions ran on a wrong speed. A real
// VieNeu take costs 0.07 s + 0.21 s per second of audio (measured); the fixed 0.6 s guess made a
// 0.6 s take read as RTF 0.08, and a take the worker's store answered at once read as ~0.1.
test("render speed: the request overhead is fitted from real takes, a short take is never the latest sample", () => {
    const E = { renderTakes: [], fittedOver: null };
    const note = (a, s) => DubEngine.prototype.noteTake.call(E, a, s);
    const over = () => DubEngine.prototype.renderOver.call(E);
    assert.equal(over(), 0.6, "no takes yet: the default guess");
    note(0.64, 0.068 + 0.21 * 0.64); note(0.9, 0.068 + 0.21 * 0.9); note(1.0, 0.068 + 0.21 * 1.0);
    assert.equal(over(), 0.6, "three takes of similar length do not make a fit");
    note(8.4, 0.068 + 0.21 * 8.4);
    assert.ok(Math.abs(E.fittedOver - 0.068) < 0.01, `fitted overhead ${E.fittedOver}`);
    assert.ok(Math.abs(over() - 0.368) < 0.01, "the reach decisions add SYNC.overFitPad (0.3) to the fit");
    for (let i = 0; i < 12; i++) note(3, 5);                     // one length only: no line to fit
    assert.equal(over(), 0.6);
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "dub-engine.js"), "utf8");
    assert.match(src, /o\.cached \? 0 : o\.duration/, "a store answer counted as generated audio");
    assert.match(src, /audioSecs >= SYNC\.rtfShortAudio \|\| this\.lastRtf == null\) this\.lastRtf = rtf/);
    assert.match(src, /cached: !!res\.fromCache/);
    // a take queued behind another job on a serial server: the predicted rest of that job is taken out
    assert.match(src, /const own = Math\.max\(0, secs - \(job\.ahead \|\| 0\)\)/);
});

test("reach: a job left running for the old place still keeps a serial server busy after the plans are rebuilt", () => {
    const now = 10000;
    const E = Object.assign(Object.create(DubEngine.prototype), {
        d: { video: { playbackRate: 1 }, now: () => now }, renderRtf: 0.9, lastRtf: 0.9, fittedOver: -0.2, renderTakes: [],
        provider: { caps: { serial: true } }, planById: new Map(),
        jobs: new Map([["old", { planIds: ["gone"], t0: now - 1000, orphan: true, est: 6 }]])
    });
    const w = E.waitAudio({ id: "p", estDuration: 2 });
    // overhead -0.2 + 0.3 pad = 0.1. 6 s at 0.9 + 0.1, 1 s already spent: 4.5 s left, then 1.9 s for this line
    assert.ok(Math.abs(w - 6.4) < 1e-9, `wait ${w}`);
});

test("reach: a late line is given up for the next one on a serial server only when that gains more than it loses", () => {
    const mk = (serial, plans) => Object.assign(Object.create(DubEngine.prototype), {
        renderRtf: 0.9, lastRtf: 0.9, fittedOver: 0.1, renderTakes: [], provider: { caps: { serial } },
        plans, rendered: new Map(), pending: new Map()
    });
    const p = { id: "p", start: 64, end: 66.2, estDuration: 2.2 }, q = { id: "q", start: 66.2, end: 70.5, estDuration: 3.9 };
    // audio for p lands at 65.6 (late, 0.6 s of its slot left); q behind it lands at 69.2
    assert.equal(mk(true, [p, q]).crowdsNext(p, 60.2, 5.4, 1), true);
    assert.equal(mk(false, [p, q]).crowdsNext(p, 60.2, 5.4, 1), false, "a parallel provider is not queued");
    assert.equal(mk(true, [p, q]).crowdsNext(p, 60.2, 3.5, 1), false, "p on time: kept whole");
    const long = { ...p, end: 69 };                                   // 3.4 s of p still to be heard
    assert.equal(mk(true, [long, { ...q, start: 69 }]).crowdsNext(long, 60.2, 5.4, 1), false, "more heard than gained");
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

// The four late-answer tests below run the service worker's timers at LATE_SCALE and scale their own
// waits by the same factor, so "our timeout fires, then the answer arrives" keeps its order
// (~4.7 s vs 5.6 s becomes ~1.2 s vs 1.4 s) at a quarter of the wall time.
const LATE_SCALE = 0.25;

test("cost ledger charges every billed request: a thrown-away answer and a timed-out one count, with real token numbers", async () => {
    let n = 0;
    const usage = { promptTokenCount: 1000, candidatesTokenCount: 100, thoughtsTokenCount: 20 };
    const fetchImpl = async (u, o) => {
        if (!u.includes("generativelanguage")) return GOOGLE_OK;
        n++;
        // 1st answer is not JSON (billed, thrown away, next model tried); 2nd is fine
        if (n === 1) return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "oops" }] }, finishReason: "STOP" }], usageMetadata: usage }) };
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ t: ["bản dịch"] }) }] }, finishReason: "STOP" }], usageMetadata: usage }) };
    };
    const E = bgEnv(fetchImpl, cfg({ geminiApiKey: "KEY-OLD-USER" }));
    const r = await E.send({ ...REQ, videoKey: "yt:v1" });
    assert.equal(r.engine, "gemini");
    const st = await E.send({ action: "costStats" });
    assert.equal(st.day.trCalls, 2, "the unusable answer was billed too");
    assert.equal(st.day.inTok, 2000);
    assert.equal(st.day.outTok, 240, "thinking tokens are billed as output");
    assert.equal(st.day.estCalls, 0);
    assert.equal(st.day.thoughtTok, 40);
    assert.ok(st.model && st.model.price, "the card is told which model and price the estimate uses");
    // the unusable answer came from the first model of the chain, the kept one from the next
    const per = st.day.byModel;
    assert.deepEqual(Object.keys(per).sort(), ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"]);
    for (const id of Object.keys(per)) {
        assert.deepEqual([per[id].calls, per[id].inTok, per[id].outTok], [1, 1000, 120], id);
        assert.ok(Math.abs(per[id].usd - COST.estimateTextCost(id, 1000, 120)) < 1e-12, id);
    }
    const want = COST.estimateTextCost("gemini-2.5-flash-lite", 1000, 120) + COST.estimateTextCost("gemini-3.1-flash-lite", 1000, 120);
    assert.ok(Math.abs(st.day.trUsd - want) < 1e-12);
    const pd = st.history[st.today];
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(st.today) && st.today === st.day.day && pd, "the per-day history uses the same day as the today card");
    assert.ok(Object.values(st.videos).every(v => v.days && v.days[st.today] > 0) || !Object.keys(st.videos).length, "spend per video per day");
    assert.deepEqual([pd.trCalls, pd.inTok, pd.outTok], [2, 2000, 240]);
    // costReset clears today and the session, keeps the per-day history for comparing with Google
    const cleared = await E.send({ action: "costReset" });
    assert.equal(cleared.day.trCalls, 0);
    assert.equal(cleared.history[cleared.today].trCalls, 2);

    // A request our timer drops still runs at Google: charged with an estimate
    let counted = null;
    const T = bgEnv(async (u, o) => {
        if (!u.includes("generativelanguage")) return GOOGLE_OK;
        if (u.includes(":countTokens")) {
            counted = JSON.parse(o.body);
            return { ok: true, status: 200, json: async () => ({ totalTokens: 1234 }) };
        }
        return new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    }, cfg({ geminiApiKey: "KEY-OLD-USER" }), { timeScale: LATE_SCALE });
    await T.send(REQ);
    const st2 = await T.send({ action: "costStats" });
    assert.ok(st2.day.trCalls >= 1 && st2.day.estCalls === st2.day.trCalls, `timed-out calls ${JSON.stringify(st2.day)}`);
    assert.ok(st2.day.trUsd > 0 && st2.day.inTok > 0);
    assert.ok(Math.abs(st2.day.estUsd - st2.day.trUsd) < 1e-12, "all of it is an estimate");
    await new Promise(r => setTimeout(r, 50));
    const st3 = await T.send({ action: "costStats" });
    assert.equal(st3.day.inTok, 1234 * st3.day.trCalls, "the prompt of a lost answer is counted exactly by countTokens");
    assert.equal(st3.day.countedCalls, st3.day.trCalls);
    assert.equal(st3.day.estCalls, st3.day.trCalls, "its output is still an estimate");
    const g = counted.generateContentRequest;
    assert.ok(/^models\/gemini-/.test(g.model) && g.contents[0].parts[0].text.includes("CẦN DỊCH") && g.systemInstruction.parts[0].text, "the same prompt is counted");
});

test("cost ledger: a timed-out request whose answer still arrives is re-charged with its real token counts", async () => {
    const usage = { promptTokenCount: 777, candidatesTokenCount: 55, thoughtsTokenCount: 5 };
    let aborted = false;
    const E = bgEnv(async (u, o) => {
        if (!u.includes("generativelanguage")) return GOOGLE_OK;
        if (u.includes(":countTokens")) return { ok: true, status: 200, json: async () => ({ totalTokens: 650 }) };
        o.signal.addEventListener("abort", () => { aborted = true; });
        await new Promise(r => setTimeout(r, 5600 * LATE_SCALE));           // past the ~4.7 s timeout
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ t: ["muộn"] }) }] }, finishReason: "STOP" }], usageMetadata: usage }) };
    }, cfg({ geminiApiKey: "KEY-OLD-USER" }), { timeScale: LATE_SCALE });
    const r = await E.send(REQ);
    assert.notEqual(r.engine, "gemini", "the viewer does not wait for it");
    const early = await E.send({ action: "costStats" });
    assert.equal(early.day.estCalls, early.day.trCalls, "charged with an estimate at the timeout");
    await new Promise(r => setTimeout(r, 1200 * LATE_SCALE));
    const st = await E.send({ action: "costStats" });
    assert.equal(aborted, false, "the request is not cut off, so its bill can be read");
    assert.equal(st.day.trCalls, 1);
    assert.equal(st.day.estCalls, 0);
    assert.equal(st.day.lateCalls, 1);
    assert.ok(Math.abs(st.day.estUsd) < 1e-12, "the estimate became real numbers");
    assert.deepEqual([st.day.inTok, st.day.outTok, st.day.thoughtTok], [777, 60, 5]);
    const id = Object.keys(st.day.byModel)[0];
    assert.ok(Math.abs(st.day.trUsd - COST.estimateTextCost(id, 777, 60)) < 1e-12, "the estimate is replaced, not added to");
    assert.equal(st.history[st.today].inTok, 777);
});

// 2.5.5 kept the per-day history by Google's Pacific day, so the morning's spend sat under
// yesterday's date beside a today card with today's date (seen 16/10: "Hôm nay (16/10)" 790 calls,
// the table's latest row "15/10" 790 calls)
test("cost history: a Pacific-day history moves onto local days once, today taken from the ledger", async () => {
    const d = new Date();
    const fmt = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    const today = fmt(d);
    const y = new Date(d); y.setDate(y.getDate() - 1);
    const o = new Date(d); o.setDate(o.getDate() - 2);
    const pacific = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
    const ledgerToday = { day: today, trUsd: 1.1, trCalls: 790, inTok: 1500000, outTok: 470000, byModel: { m: { calls: 790, inTok: 1500000, outTok: 470000, usd: 1.1 } }, videos: { "yt:a": { usd: 0.3, audioSec: 0, videoSec: 60, title: "A", t: 1 } } };
    // the Pacific day holding this morning: yesterday's date before 14:00 here, today's after
    const old = { [fmt(o)]: { trCalls: 8, trUsd: 0.0035, byModel: {} } };
    old[pacific] = { trCalls: 790, trUsd: 1.1, inTok: 1500000, outTok: 470000, byModel: {} };
    const local = { costLedger: ledgerToday, costHistory: old };
    const E = bgEnv(server([]), cfg(), { local });
    const st = await E.send({ action: "costStats" });
    assert.equal(st.today, today);
    assert.equal(st.history[today].trCalls, 790, "today's row is the today card");
    assert.equal(st.history[fmt(y)], undefined, "the morning is not counted again under yesterday");
    assert.equal(st.history[fmt(o)].trCalls, 8, "older days are kept");
    assert.equal(st.videos["yt:a"].days[today], 0.3, "today's videos seed the per-video record");
    await new Promise(r => setTimeout(r, 10));
    assert.equal(local.costHistoryTz, "local");
});

test("late answer is not wasted: a twin request waits for it instead of paying again, and it is cached for the next visit", async () => {
    let calls = 0;
    const E = bgEnv(async (u, o) => {
        if (!u.includes("generativelanguage")) return GOOGLE_OK;
        if (u.includes(":countTokens")) return { ok: true, status: 200, json: async () => ({ totalTokens: 650 }) };
        calls++;
        await new Promise(r => setTimeout(r, 5600 * LATE_SCALE));           // past the ~4.7 s timeout
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ t: ["bản muộn"] }) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 40 } }) };
    }, cfg({ geminiApiKey: "KEY-OLD-USER" }), { timeScale: LATE_SCALE });
    const first = await E.send(REQ);
    assert.equal(first.engine, "google_fallback", "the viewer is not kept waiting");
    const twin = await E.send(REQ);                                          // sent while the answer is on its way
    assert.equal(twin.engine, "gemini");
    assert.deepEqual(twin.translations, ["bản muộn"]);
    assert.equal(calls, 1, "no second paid call for the same window");
    const again = await E.send(REQ);
    assert.ok(again.fromCache && again.engine === "gemini", "kept in the cache");
    assert.equal(calls, 1);
    const st = await E.send({ action: "costStats" });
    assert.equal(st.day.trCalls, 1);
    assert.equal(st.day.estCalls, 0);
});

test("late answer that is unusable is billed, not cached, and a twin request is not kept waiting for it", async () => {
    let calls = 0;
    const E = bgEnv(async (u, o) => {
        if (!u.includes("generativelanguage")) return GOOGLE_OK;
        if (u.includes(":countTokens")) return { ok: true, status: 200, json: async () => ({ totalTokens: 650 }) };
        calls++;
        await new Promise(r => setTimeout(r, 5600 * LATE_SCALE));
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "không phải JSON" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 40 } }) };
    // one model only (economy): with a next model, the twin goes there while the first one rests (2.7.4)
    }, cfg({ geminiApiKey: "KEY-OLD-USER", costMode: "economy" }), { timeScale: LATE_SCALE });
    await E.send(REQ);
    await new Promise(r => setTimeout(r, 1200 * LATE_SCALE));                // the unusable answer has come
    const t0 = Date.now();
    const next = await E.send(REQ);
    assert.ok(Date.now() - t0 < 2000 * LATE_SCALE, `waited ${Date.now() - t0} ms for nothing`);
    assert.notEqual(next.fromCache, true, "nothing unusable was cached");
    const st = await E.send({ action: "costStats" });
    assert.equal(st.day.trCalls, calls, "every call Google answered is billed");
    assert.equal(st.day.estCalls, 0);
});

test("a model resting after a slow answer hands the next windows to the next model, not to Google", async () => {
    const seen = [];
    const E = bgEnv(async (u, o) => {
        if (!u.includes("generativelanguage")) return GOOGLE_OK;
        if (u.includes(":countTokens")) return { ok: true, status: 200, json: async () => ({ totalTokens: 650 }) };
        const model = u.match(/models\/([^:]+)/)[1];
        seen.push(model);
        if (model === "gemini-2.5-flash-lite") return new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ t: ["bản kế"] }) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 40 } }) };
    }, cfg({ geminiApiKey: "KEY-OLD-USER" }), { timeScale: LATE_SCALE });
    const first = await E.send(REQ);
    assert.equal(first.engine, "google_fallback", "the slow window itself is not kept waiting for a second model");
    const next = await E.send({ ...REQ, sentences: ["Another window."] });
    assert.equal(next.engine, "gemini", "the resting model is skipped, the next model translates");
    assert.equal(next.model, "gemini-3.1-flash-lite");
    assert.equal(seen.filter(m => m === "gemini-2.5-flash-lite").length, 1, "the resting model is not called");
});

test("an item left empty that is a name or a few words keeps its source; a longer one still fails the window", async () => {
    const answer = t => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ t }) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 40 } }) });
    const sentences = ["What's your name?", "vanmathi", "What are you doing these days?", "I am working in a bank."];
    const E = bgEnv(async u => (u.includes("generativelanguage") ? answer(["Bạn tên gì?", "", "Dạo này bạn làm gì?", "Tôi làm ở ngân hàng."]) : GOOGLE_OK), cfg({ geminiApiKey: "KEY-OLD-USER" }));
    const r = await E.send({ ...REQ, sentences });
    assert.equal(r.engine, "gemini", "the window stays Gemini's");
    assert.deepEqual(r.translations, ["Bạn tên gì?", "vanmathi", "Dạo này bạn làm gì?", "Tôi làm ở ngân hàng."]);
    const long = ["What's your name?", "I have been working in the insurance team of the bank for three years.", "Okay.", "Fine."];
    const L = bgEnv(async u => (u.includes("generativelanguage") ? answer(["Bạn tên gì?", "", "Được.", "Ổn."]) : GOOGLE_OK), cfg({ geminiApiKey: "KEY-OLD-USER" }));
    assert.equal((await L.send({ ...REQ, sentences: long })).engine, "google_fallback", "a sentence of meaning left empty is no translation");
    const many = ["a b", "c d", "e f", "g h"];
    const M = bgEnv(async u => (u.includes("generativelanguage") ? answer(["", "", "x", "y"]) : GOOGLE_OK), cfg({ geminiApiKey: "KEY-OLD-USER" }));
    assert.equal((await M.send({ ...REQ, sentences: many })).engine, "google_fallback", "more than a quarter empty");
});

test("bracketed notes left empty keep their source in any number; the window stays Gemini's", async () => {
    const answer = t => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ t }) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 40 } }) });
    // a Persian window: three notes the list did not know, one line of speech
    const sentences = ["[ناشناخته]", "[صدای در]", ">> [ناشناخته]", "امروز می‌خواهم آشپزی کنم"];
    const E = bgEnv(async u => (u.includes("generativelanguage") ? answer(["", "", "", "Hôm nay mình muốn nấu ăn."]) : GOOGLE_OK), cfg({ geminiApiKey: "KEY-OLD-USER" }));
    const r = await E.send({ ...REQ, sentences });
    assert.equal(r.engine, "gemini");
    assert.deepEqual(r.translations, ["[ناشناخته]", "[صدای در]", ">> [ناشناخته]", "Hôm nay mình muốn nấu ăn."]);
});

test("price of a typed model id: release suffixes, family by generation, unknown kind flagged", () => {
    const how = id => { const p = COST.priceOf(id); return [p.how, p.base]; };
    assert.deepEqual(how("gemini-3.1-flash-lite"), ["exact", "gemini-3.1-flash-lite"]);
    for (const id of ["gemini-3.1-flash-lite-preview", "models/gemini-3.1-flash-lite-preview-09-2026", "gemini-3.1-flash-lite-001", "gemini-3.1-flash-lite-latest"])
        assert.deepEqual(how(id), ["variant", "gemini-3.1-flash-lite"], id);
    assert.deepEqual(how("gemini-3.5-flash-lite-preview"), ["variant", "gemini-3.5-flash-lite"]);
    assert.equal(COST.priceOf("gemini-9-flash-lite").how, "family", "a newer generation: dearest of its kind");
    assert.ok(COST.priceOf("gemini-9-flash-lite").price.out >= Math.max(...COST.TRANSLATION_MODELS.filter(m => m.id.includes("flash-lite")).map(m => m.estPrice.out)));
    assert.equal(COST.priceOf("gemini-3.5-pro").how, "unknown");
    const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);
    close(COST.estimateTextCost("gemini-3.1-flash-lite-preview", 1e6, 1e6), 1.75);
});

test("money display: đồng with USD beside it, Vietnamese number format, bad settings fall back", () => {
    const o = COST.moneyOpts({});
    assert.deepEqual(o, { rate: COST.FX.usdVnd, extraPct: 0 });
    assert.equal(COST.money(1, { costUsdVnd: 26500 }).text, "26.500 đ (1,00 USD)");
    assert.equal(COST.money(0.2126, { costCurrency: "usd", costUsdVnd: 26000 }).text, "5.528 đ (0,213 USD)", "an old stored currency is ignored");
    assert.equal(COST.money(0.0004, { costUsdVnd: 26000 }).vnd, "10,4 đ", "one call never rounds to 0");
    assert.equal(COST.money(1, { costUsdVnd: 26000, costExtraPct: 10 }).vnd, "28.600 đ");
    assert.equal(COST.money(1234.5, {}).usd, "1.235 USD");
    for (const bad of [{ costUsdVnd: 12 }, { costUsdVnd: "abc" }, { costExtraPct: -5 }, { costExtraPct: 500 }]) {
        const b = COST.moneyOpts(bad);
        assert.ok(b.rate === COST.FX.usdVnd && b.extraPct === 0, JSON.stringify(bad));
    }
});

test("cost estimate: implicit-cache tokens are billed at the cache rate, never below zero or above the prompt", () => {
    const id = "gemini-3.1-flash-lite";
    const p = COST.findModel(id).estPrice;
    assert.equal(p.in, 0.25); assert.equal(p.out, 1.5); assert.equal(p.cache, 0.025);
    const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);
    close(COST.estimateTextCost(id, 1e6, 1e6), 1.75);
    close(COST.estimateTextCost(id, 1e6, 0, 4e5), 0.6 * 0.25 + 0.4 * 0.025);
    close(COST.estimateTextCost(id, 1000, 0, 5000), 1000 * 0.025 / 1e6);
    for (const m of COST.TRANSLATION_MODELS) assert.ok(m.estPrice.cache < m.estPrice.in, m.id);
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

// 2.3.1: Chrome answers storage reads asynchronously, and the worker sleeps after ~30 s idle. The
// first message after it wakes lands before the stored ledger has loaded; the load used to replace
// whatever that message did.
test("cost ledger: a reset or a charge that reaches a waking worker before its ledger loads is kept", async () => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    // Reset from Settings: the reply and the saved ledger are both the cleared one, history stays
    const local = {
        costLedger: { day: today, trUsd: 0.02, trCalls: 5, videos: { "yt:a": { usd: 0.02, audioSec: 0, videoSec: 60, title: "A", t: 1 } } },
        costHistory: { "2026-09-28": { trCalls: 5, trUsd: 0.02, byModel: {} } }
    };
    const E = bgEnv(server([]), cfg(), { local, asyncLocal: 20, timeScale: 0.01 });
    const r = await E.send({ action: "costReset" });
    assert.equal(r.day.trCalls, 0, "the reply shows the reset, not the ledger loaded after it");
    assert.deepEqual(Object.keys(r.day.videos), []);
    assert.equal(r.history["2026-09-28"].trCalls, 5, "the per-day history is kept");
    await wait(60);
    assert.equal(local.costLedger.trCalls, 0, "and the reset is what gets saved");
    // A charge before the load (a cached voice line fetched right as the worker wakes) is added
    // to the stored numbers, not dropped by the load
    const A = bgEnv(server([]), cfg());
    await vm.runInContext("caches.audio.set('k1', { wav: new Uint8Array([1, 2, 3, 4]), duration: 1, sampleRate: 24000 })", A.sandbox);
    const local2 = { costLedger: { day: today, hitsAudio: 3, avoided: 3, videos: {} } };
    const B = bgEnv(server([]), cfg(), { local: local2, backend: A.backend, asyncLocal: 20, timeScale: 0.01 });
    const g = await B.send({ action: "audioCacheGet", keys: ["k1"] });
    assert.deepEqual(Object.keys(g.hits), ["k1"]);
    const st = await B.send({ action: "costStats" });
    assert.equal(st.day.hitsAudio, 4, "the stored 3 plus the hit counted before the load");
    await wait(60);
    assert.equal(local2.costLedger.hitsAudio, 4);
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
    // open tabs get the new code from reinjectOpenTabs: the viewer is not sent to press F5
    assert.doesNotMatch(box.children[2].textContent, /F5/);
    assert.match(box.children[2].textContent, /không cần tải lại trang/);
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
test("kiểu mặc định: cỡ 100% (thang 1.7.0 = 70% cũ), độ đậm 400, viền quầng mờ, lề 1% (một nguồn duy nhất)", () => {
    const S = require("../subtitle-style.js");
    const d = S.DEFAULT_STYLE;
    assert.equal(d.fontSize, 100);
    assert.equal(S.sizeFactor(100), 0.7, "100% now draws what the old 70% drew");
    assert.equal(d.fontWeight, "400");
    assert.equal(d.strokeStyle, "glow");
    assert.equal(d.offset, 1);
    assert.equal(S.normalizeStyle({}).offset, 1);
    assert.ok(!/fontSize:\s*130|offset:\s*3\b/.test(read("youtube.js")), "youtube.js còn bản sao kiểu mặc định cũ");
});

test("chuyển kiểu đã lưu một lần: mục còn giá trị mặc định cũ -> mặc định mới; mục đã tự chỉnh giữ nguyên", async () => {
    const E = bgEnv(async () => reply({}), cfg({ subStyle: { fontSize: 130, fontWeight: "500", strokeStyle: "thick", offset: 3, fontColor: "#ffee00" } }));
    const s = E.syncStore.subStyle;
    // 1.1.8 moved 130 -> 90, then 1.7.0 rescales 90 -> 130 (same look on the new scale)
    assert.equal(s.fontSize, 130);
    assert.equal(s.fontWeight, "400");
    assert.equal(s.strokeStyle, "thick", "viền đã tự chọn phải giữ");
    assert.equal(s.offset, 1);
    assert.equal(s.fontColor, "#ffee00");
    assert.equal(E.syncStore.styleDefaults118, true);
    const again = bgEnv(async () => reply({}), cfg({ subStyle: { fontSize: 130 }, styleDefaults118: true, fontScale170: true }));
    assert.equal(again.syncStore.subStyle.fontSize, 130, "chỉ chuyển một lần");
    // the user's 70% becomes 100%, once
    const u = bgEnv(async () => reply({}), cfg({ subStyle: { fontSize: 70 }, styleDefaults118: true }));
    assert.equal(u.syncStore.subStyle.fontSize, 100);
    assert.equal(u.syncStore.fontScale170, true);
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
    // none at all now: no content script loads a packaged file (the player button's icon is a data: URI)
    assert.ok(!(manifest.web_accessible_resources || []).some(w => w.matches.includes("<all_urls>")));
    // web fonts come in through a <link> the page loads, which needs no host permission
    assert.match(read("subtitle-style.js"), /createElement\("link"\)/);
    assert.ok(!manifest.host_permissions.some(h => /fonts\.(googleapis|gstatic)\.com/.test(h)));
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
    assert.deepEqual({ ...calls[0] }, { model: "vieneu-v3-turbo", voice: "Thùy Dung", input: "Xin chào các bạn.", response_format: "pcm", sample_rate: 48000, temperature: 0.6 });
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

// cst-start.command exists on a Mac only: a Windows user told to open it has nothing to open
test("VieNeu start hint: Windows is sent to the autostart installer, never to the Mac launcher", async () => {
    const L = COST.LOCAL_TTS;
    for (const p of ["Win32", "Windows"]) {
        assert.doesNotMatch(L.startHint(p), /cst-start\.command/, p);
        assert.match(L.startHint(p), /tools\\vieneu-autostart\.cmd/, p);
    }
    for (const p of ["MacIntel", "macOS", "", null]) assert.match(L.startHint(p), /cst-start\.command/, String(p));
    assert.doesNotMatch(L.startHint("Linux x86_64"), /vieneu-autostart\.cmd/);
    // the service worker's reply when the server is down follows the browser's platform
    const E = bgEnv(vieneuServer([], { down: true }), cfg());
    E.sandbox.navigator = { platform: "Win32" };
    const req = { action: "synthesizeSpeech", engine: "vieneu", text: "Xin chào.", voice: "Thùy Dung", parts: [{ key: "w1", weight: 3 }] };
    const r = await E.send(req);
    assert.equal(r.errorType, "local_unavailable");
    assert.doesNotMatch(r.error, /cst-start\.command/);
    assert.match(r.error, /vieneu-autostart\.cmd/);
    E.sandbox.navigator = { platform: "Win32", userAgentData: { platform: "macOS" } };   // userAgentData wins
    assert.match((await E.send({ ...req, parts: [{ key: "w2", weight: 3 }] })).error, /cst-start\.command/);
    // the page's toast when dubbing starts with the server down
    for (const [platform, want, not] of [["Win32", /vieneu-autostart\.cmd/, /cst-start\.command/], ["MacIntel", /cst-start\.command/, /vieneu-autostart/]]) {
        const msgs = [], toasts = [];
        const env = dubbingEnvFor("premium", "vieneu", msgs, m => (m.action === "localTtsStatus" ? { ok: true, running: false } : { ok: true }), false, { dubSystemFallback: false });
        env.navigator = { platform };
        env.CST_UI = { toast: (text, o) => toasts.push({ text, o }) };
        assert.equal(await env.CST_DUB.start({ video: new FakeVideo(), getGroups: () => [] }), false);
        assert.equal(toasts.length, 1, platform);
        assert.match(toasts[0].text, want, platform);
        assert.doesNotMatch(toasts[0].text, not, platform);
        assert.equal(toasts[0].o.actionLabel, "Mở Cài đặt");
        toasts[0].o.onAction();
        assert.ok(msgs.some(m => m.action === "openOptions"), "the toast's button opens Settings");
        env.CST_DUB.stop();
    }
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
function dubbingEnvFor(mode, dubProvider, msgs, onMsg, paid = true, extra = {}) {
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
            storage: { sync: { get: async d => ({ ...d, geminiApiKey: "k", useAi: true, costMode: mode, dubProvider, ...extra }) }, onChanged: { addListener: noop } },
            runtime: { lastError: null, sendMessage: (m, cb) => { msgs.push(m); cb(onMsg(m)); } }
        }
    };
    sandbox.window = sandbox; sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of ["cst-cache.js", "cost-policy.js", "vi-segmenter.js", "dub-planner.js", "dub-prosody.js", "dub-speech.js", "dub-audio.js", "dub-engine.js", "dubbing.js"]) vm.runInContext(read(f), sandbox);
    sandbox.CST_COST.PAID_TTS = paid;   // 1.8.1: paid voice ships off; this suite tests its machinery
    return sandbox;
}

// ---- 1.8.1: the paid voice is switched off; VieNeu is the only voice ----
test("paid voice off as shipped: every mode and every stored source dubs with VieNeu first, no Gemini, the browser voice only as a fallback", async () => {
    assert.equal(COST.PAID_TTS, false);
    for (const mode of ["premium", "balanced", "economy"]) for (const provider of ["gemini", "auto", "system", "vieneu"]) {
        const msgs = [];
        const env = dubbingEnvFor(mode, provider, msgs, m => (m.action === "localTtsStatus" ? { ok: true, running: true } : { ok: false }), false);
        assert.equal(await env.CST_DUB.start({ video: new FakeVideo(), getGroups: () => [] }), true, `${mode}/${provider}`);
        assert.equal(env.CST_DUB.dub.engine.provider.id, "vieneu", `${mode}/${provider}`);
        assert.equal(env.CST_DUB.dub.engine.fallback && env.CST_DUB.dub.engine.fallback.id, "system", "browser voice behind VieNeu");
        assert.ok(!msgs.some(m => m.action === "modelStatus"), "Gemini TTS model is never asked for");
        env.CST_DUB.stop();
    }
    // VieNeu server not running: the browser voice speaks, never Gemini
    const msgs = [];
    const env = dubbingEnvFor("premium", "gemini", msgs, m => (m.action === "localTtsStatus" ? { ok: true, running: false } : { ok: false }), false);
    await env.CST_DUB.start({ video: new FakeVideo(), getGroups: () => [] });
    assert.ok(!env.CST_DUB.dub.engine || env.CST_DUB.dub.engine.provider.id !== "gemini");
    assert.ok(!msgs.some(m => m.action === "synthesizeSpeech" && m.engine !== COST.LOCAL_TTS.id));
    env.CST_DUB.stop();
});

test("no VieNeu: the browser Vietnamese voice speaks and the option can turn it off", async () => {
    const down = m => (m.action === "localTtsStatus" ? { ok: true, running: false } : { ok: false });
    const on = dubbingEnvFor("balanced", "vieneu", [], down, false);
    assert.equal(await on.CST_DUB.start({ video: new FakeVideo(), getGroups: () => [] }), true);
    assert.equal(on.CST_DUB.dub.engine.provider.id, "system");
    assert.equal(on.CST_DUB.dub.engine.fallback, null, "no second voice behind the browser voice");
    on.CST_DUB.stop();
    const off = dubbingEnvFor("balanced", "vieneu", [], down, false, { dubSystemFallback: false });
    assert.equal(await off.CST_DUB.start({ video: new FakeVideo(), getGroups: () => [] }), false);
    assert.ok(!off.CST_DUB.dub.engine, "VieNeu-only: waits for the server, no browser voice");
    off.CST_DUB.stop();
    // VieNeu running but the option off: no fallback voice behind it
    const up = dubbingEnvFor("balanced", "vieneu", [], m => (m.action === "localTtsStatus" ? { ok: true, running: true } : { ok: false }), false, { dubSystemFallback: false });
    await up.CST_DUB.start({ video: new FakeVideo(), getGroups: () => [] });
    assert.equal(up.CST_DUB.dub.engine.provider.id, "vieneu");
    assert.equal(up.CST_DUB.dub.engine.fallback, null);
    up.CST_DUB.stop();
    const R = n => require("fs").readFileSync(require("path").join(__dirname, "..", n), "utf8");
    assert.match(R("options.html"), /id="dubSystemFallback" checked/);
    assert.match(R("options.js"), /dubSystemFallback: document\.getElementById\("dubSystemFallback"\)/);
});

test("paid voice off as shipped: the service worker refuses Gemini TTS without a network call, and a stored Gemini source becomes VieNeu once", async () => {
    const { bgEnv } = require("./bg-env.js");
    const calls = [];
    const E = bgEnv(async u => { calls.push(String(u)); return { ok: false, status: 500, json: async () => ({}), text: async () => "" }; },
        { geminiApiKey: "k", useAi: true, dubProvider: "gemini", dubProvider1113: true }, { paidTts: false });
    await new Promise(r => setTimeout(r, 20));
    const r = await E.send({ action: "synthesizeSpeech", text: "Xin chào các bạn.", voice: "Kore" });
    assert.equal(r.ok, false);
    assert.equal(r.errorType, "disabled");
    assert.ok(!calls.some(u => /generativelanguage/.test(u)), "no Gemini request");
    assert.equal(E.syncStore.dubProvider, "vieneu");
    // Settings offers no other voice (2.5.5: no voice source picker at all, VieNeu is the only one)
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "options.html"), "utf8");
    for (const id of ["dubProvider", "dubGeminiVoice", "dubGeminiVoice2", "dubVoice", "dubTtsModel"]) assert.doesNotMatch(html, new RegExp(`id="${id}"`), id);
    // and saving the page keeps the stored source on VieNeu
    assert.match(require("fs").readFileSync(require("path").join(__dirname, "..", "options.js"), "utf8"), /dubProvider: providerSel \? providerSel\.value : "vieneu"/);
});

test("VieNeu là giọng chính (chế độ Cân bằng, có API key): KHÔNG rút gọn lời thoại, không hỏi model Gemini TTS", async () => {
    const msgs = [];
    const env = dubbingEnvFor("balanced", "vieneu", msgs, m => (m.action === "localTtsStatus" ? { ok: true, running: true } : { ok: false }));
    const video = new FakeVideo();
    video.play();
    assert.equal(await env.CST_DUB.start({ video, getGroups: () => require("./dub-sim.js").lectureGroups() }), true);
    const eng = env.CST_DUB.dub.engine;
    assert.equal(eng.provider.id, "vieneu");
    assert.equal(eng.d.condense, undefined, "Đàm: KHÔNG BAO GIỜ rút gọn lời thoại (the engine has no condense path)");
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
    // 1.6.7: the source speaker's pause earns no comma any more (it landed mid-phrase and the voice
    // stopped where the Vietnamese has no break); only the text's own punctuation makes a pause
    assert.equal(plainScript({ continuesNext: false, phrases: [{ text: "hôm nay chúng ta sẽ học", breakKind: "source", pauseAfter: 0.4, syl: 6 }, { text: "cách huấn luyện mô hình", breakKind: "end" }] }),
        "hôm nay chúng ta sẽ học cách huấn luyện mô hình.");
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
        // Ceiling (1.6.1): 1.3x normally, raised by how fast the video speaks up to 1.55x (1.65x while
        // lagging), and never so fast that the voice says more than 5.8 syllables per second.
        // This scenario needs ~1.8x per sentence, so a slow voice now uses the raised ceiling.
        const cap = Math.max(1.3, Math.min(1.55, 5.8 / sps));
        const lagCap = Math.max(1.4, Math.min(1.65, 5.8 / sps));
        assert.ok(rates.every((r, i) => r >= floor - 1e-9 && r <= (st[i].lag > 1 || (i > 0 && rates[i - 1] > cap) ? lagCap : cap) + 1e-9), `ngoài dải [${floor.toFixed(2)} ; ${cap.toFixed(2)}/${lagCap.toFixed(2)}]: ${JSON.stringify(rates)}`);
        for (let i = 1; i < rates.length; i++) {
            // (2.8.5) after a pause of rateMemory or more a new sentence starts at a fresh pace
            if (st[i].t - st[i - 1].speechEnd >= E_ENGINE.SYNC.rateMemory) continue;
            const d = rates[i] - rates[i - 1];
            assert.ok(d <= 0.1 + 1e-9 && d >= -0.06 - 1e-9, `nhịp nhảy ${rates[i - 1]} -> ${rates[i]}`);
        }
        assert.equal(S.eng.stats.dropped, 0);
        // The voice does not run ahead of the subtitle: a line ends over 0.6 s before its cue only
        // when the rate was held: at the voice's floor, or only SYNC.rateStepDown below the line
        // before (smoothing, a deliberate trade so the pace does not change abruptly)
        const stepDown = E_ENGINE.SYNC.rateStepDown;
        const early = st.filter((x, i) => x.speechEnd < x.cueEnd - 0.6 && x.rate > floor + 1e-6 && !(i > 0 && Math.abs(x.rate - (st[i - 1].rate - stepDown)) < 1e-6));
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

test("VieNeu warm-up (BACKLOG 20): one tiny take when the server is cold, none once it is warm", async () => {
    const calls = [];
    const E = bgEnv(vieneuServer(calls), cfg());
    const r1 = await E.send({ action: "localWarm", voice: "Mỹ Duyên" });
    assert.equal(r1.warmed, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, "Xin chào.");
    assert.equal(calls[0].voice, "Mỹ Duyên");
    const r2 = await E.send({ action: "localWarm", voice: "Mỹ Duyên" });
    assert.equal(r2.warmed, false, "a warm server is left alone (the 1.2.6 measurement)");
    assert.equal(calls.length, 1);
    // a real take right after is not held back by the cold 60 s path: the server is known warm
    const st = await E.send({ action: "costStats" });
    assert.ok(!(st.day.localSec > 0), "the warm-up is not counted as dubbing");
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
    assert.doesNotMatch(html, /id="dubProvider"/, "VieNeu is the only voice: no source picker");
    assert.doesNotMatch(html, /dubLocalModel|Model VieNeu/);
});

test("audio twice as long as its slot: the voice keeps going, nothing holds the audio queue", async () => {
    const groups = Array.from({ length: 8 }, (_, i) => mkGroup(`Đây là một câu khá dài số ${i + 1} trong bài giảng về trí tuệ nhân tạo và dữ liệu lớn.`, 1 + i * 3, 3 + i * 3, `S${i}.`));
    // audio twice the slot: the kind of line the removed condense path (1.7.3) used to hold up
    const S = speechRun(groups, groups.map(() => 4.2));
    await S.run(300);
    S.video.play();
    await S.run(12000);
    const first = S.eng.stats.started[0];
    assert.ok(first && first.t < 4, `câu đầu tiên có tiếng lúc ${first && first.t}`);
    assert.ok(S.eng.stats.started.length >= 4, `chỉ đọc ${S.eng.stats.started.length} câu trong 12 giây`);
    // lag comes only from audio longer than its slot
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
    // 1.6.8: the free voice may run a segment to 11 s (FREE_SEGMENTS in dub-engine.js); paid stays 8
    assert.ok(longest <= 11.01, `đoạn đọc dài ${longest.toFixed(1)} giây (trước đây cả nhóm 20 giây)`);
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
    // Between two parts of one sentence: the voice never runs more than 0.35 s ahead of the
    // speaker (2.6.9: 0.8 s ahead on every chain was "lồng tiếng trước khi người thật nói"), and the
    // silence that lead used to hide stays short (this Vietnamese is shorter than its slot)
    const gaps = st.slice(1).map((x, i) => ({ gap: x.t - st[i].speechEnd, lead: x.due - x.t, cont: S.eng.planById.get(st[i].id).continuesNext })).filter(x => x.cont);
    assert.ok(gaps.length >= 2);
    const early = gaps.filter(x => x.lead > 0.35);
    assert.equal(early.length, 0, `ahead of the speaker: ${JSON.stringify(early.map(x => x.lead.toFixed(2)))}`);
    const bad = gaps.filter(x => x.gap > 0.9);
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

test("VieNeu: mọi yêu cầu (nhiều tab, nghe thử trong Cài đặt) xếp hàng trong service worker, máy chủ không bao giờ nhận 2 yêu cầu cùng lúc", async () => {
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
        E.send({ action: "synthesizeSpeech", engine: "vieneu", text: "Xin chào, đây là giọng nghe thử.", voice: "Thái Sơn" }),
        ...[1, 2, 3, 4].map(i => E.send({ action: "synthesizeSpeech", engine: "vieneu", text: `Câu thử số ${i} cho hàng đợi.`, voice: "Mỹ Duyên", parts: [{ key: "q" + i, weight: 6 }] }))
    ]);
    assert.ok(rs.every(r => r.ok), JSON.stringify(rs.map(r => r.error)));
    assert.equal(peak, 1, `máy chủ nhận ${peak} yêu cầu cùng lúc`);
    // 1.7.3: the unused warm-up route is gone
    assert.doesNotMatch(require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "background.js"), "utf8"), /localTtsWarm/);
});

// 1.8.6: VieNeu keeps its only stream slot ~4-5 s after a client leaves mid-request, so cutting a
// request the server has started made the line the viewer seeked to wait for it. Such a request is
// let finish (its take is stored); one still waiting in the service worker's queue is dropped unsent.
test("VieNeu: a dropped request the server has started finishes and is stored; a queued one is never sent", async () => {
    const calls = [];
    const inner = vieneuServer(calls);
    let release = null;
    const E = bgEnv(async (u, o) => {
        if (!String(u).endsWith("/v1/audio/speech")) return inner(u, o);
        if (calls.length === 0) await new Promise(r => { release = r; });
        return inner(u, o);
    }, cfg());
    const req = key => ({ action: "synthesizeSpeech", engine: "vieneu", text: "Câu này đang được máy chủ tạo.", voice: "Mỹ Duyên", jobId: "job-" + key, parts: [{ key, weight: 7 }] });
    const running = E.send(req("run1"));
    // the second request is sent once the server holds the first: sent together, the two hash
    // their keys concurrently and under load the second could reach the queue first (2.4.7: the
    // test then dropped the request the server had not started and failed 2 runs in 12)
    for (let i = 0; i < 200 && !release; i++) await new Promise(r => setTimeout(r, 5));
    assert.ok(release, "the first request never reached the server");
    const queued = E.send({ ...req("wait1"), text: "Câu này còn chờ trong hàng." });
    for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));
    await E.send({ action: "ttsAbort", jobId: "job-run1" });
    await E.send({ action: "ttsAbort", jobId: "job-wait1" });
    release();
    const [a, b] = await Promise.all([running, queued]);
    assert.equal(a.ok, true, `started request was cut: ${a.error}`);
    assert.equal(b.ok, false);
    assert.equal(b.errorType, "aborted");
    assert.equal(calls.length, 1, "the queued request reached the server");
    assert.equal((await E.send(req("run1"))).fromCache, true, "the finished take was not stored");
    assert.match(read("background.js"), /LOCAL_KEEP_RUNNING_S = 4;/);
});

// 1.8.9: races and error codes in the service worker's VieNeu path, each reproduced on 1.8.8 first.
const tick = ms => new Promise(r => setTimeout(r, ms));
const vnReq = (key, extra = {}) => ({ action: "synthesizeSpeech", engine: "vieneu", text: "Câu này dùng để thử hàng đợi.", voice: "Mỹ Duyên", jobId: "job-" + key, parts: [{ key, weight: 7 }], ...extra });
function heldServer(calls) {
    const inner = vieneuServer(calls);
    const gate = { release: null };
    const fetchImpl = async (u, o) => {
        if (!String(u).endsWith("/v1/audio/speech")) return inner(u, o);
        if (calls.length === 0) await new Promise(r => { gate.release = r; });
        return inner(u, o);
    };
    return { gate, fetchImpl };
}

test("VieNeu: a queued request dropped by a seek answers at once, not when the queue reaches it", async () => {
    const calls = [];
    const { gate, fetchImpl } = heldServer(calls);
    const E = bgEnv(fetchImpl, cfg());
    const running = E.send(vnReq("q-run"));
    for (let i = 0; i < 200 && !gate.release; i++) await tick(5);
    let answered = null;
    E.send(vnReq("q-wait", { text: "Câu này còn chờ trong hàng." })).then(r => { answered = r; });
    await tick(20);
    await E.send({ action: "ttsAbort", jobId: "job-q-wait" });
    await tick(20);
    assert.ok(answered, "the dropped request waited for the one ahead of it");
    assert.equal(answered.errorType, "aborted");
    gate.release();
    assert.equal((await running).ok, true);
    assert.equal(calls.length, 1);
});

test("VieNeu: a line dropped while queued and asked for again (seek away and back) is made once, not refused", async () => {
    const calls = [];
    const { gate, fetchImpl } = heldServer(calls);
    const E = bgEnv(fetchImpl, cfg());
    const running = E.send(vnReq("b-run"));
    for (let i = 0; i < 200 && !gate.release; i++) await tick(5);
    const line = { text: "Câu người xem tua đi rồi tua lại." };
    const first = E.send(vnReq("b-line", line));
    await tick(20);
    await E.send({ action: "ttsAbort", jobId: "job-b-line" });
    const again = E.send({ ...vnReq("b-line", line), jobId: "job-b-line-2" });
    await tick(20);
    gate.release();
    const [, a, b] = await Promise.all([running, first, again]);
    assert.equal(a.errorType, "aborted");
    assert.equal(b.ok, true, `the line asked for again was refused: ${b.errorType}`);
    assert.equal(calls.length, 2, "the line was generated twice or not at all");
});

test("VieNeu: a stop sent before the service worker has registered the request still cancels it", async () => {
    const calls = [];
    const E = bgEnv(vieneuServer(calls), cfg());
    const r = E.send(vnReq("early"));
    E.send({ action: "ttsAbort", jobId: "job-early" });
    const out = await r;
    assert.equal(out.errorType, "aborted");
    assert.equal(calls.length, 0, "a request stopped before it was registered reached the server");
    // the stop is used once: the same job id asked for later is served
    assert.equal((await E.send({ ...vnReq("early"), jobId: "job-early-2" })).ok, true);
});

test("VieNeu: a take whose connection drops mid-body is retried and never reported as 'server not running'", async () => {
    const calls = [];
    const inner = vieneuServer(calls);
    let n = 0;
    const E = bgEnv(async (u, o) => {
        const r = await inner(u, o);
        if (String(u).endsWith("/v1/audio/speech") && n++ === 0) return { ok: true, status: 200, arrayBuffer: async () => { throw new TypeError("network error"); } };
        return r;
    }, cfg());
    const out = await E.send(vnReq("drop1"));
    assert.equal(out.ok, true, `${out.errorType}: ${out.error}`);
    assert.equal(n, 2);
    // dropped on every try: its own code, which does not switch the video to the system voice
    const E2 = bgEnv(async (u, o) => String(u).endsWith("/v1/audio/speech")
        ? { ok: true, status: 200, arrayBuffer: async () => { throw new TypeError("network error"); } }
        : vieneuServer([])(u, o), cfg());
    const out2 = await E2.send(vnReq("drop2"));
    assert.equal(out2.errorType, "dropped");
});

test("VieNeu: a hung /health does not hold a dropped request", async () => {
    const calls = [];
    const inner = vieneuServer(calls);
    const E = bgEnv(async (u, o) => String(u).endsWith("/health")
        ? new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(new Error("aborted"))))
        : inner(u, o), cfg());
    const t0 = Date.now();
    const r = E.send(vnReq("hh"));
    await tick(50);
    E.send({ action: "ttsAbort", jobId: "job-hh" });
    const out = await r;
    assert.equal(out.errorType, "aborted");
    assert.ok(Date.now() - t0 < 600, `took ${Date.now() - t0} ms`);
    assert.equal(calls.length, 0);
});

test("VieNeu: malformed parts are refused before any read or request", async () => {
    const calls = [];
    const E = bgEnv(vieneuServer(calls), cfg());
    for (const parts of [[{ key: 5 }], [{ key: "" }], [{ key: "x".repeat(300) }], [{ key: "a", weight: -1 }], [null], Array.from({ length: 40 }, (_, i) => ({ key: "k" + i }))]) {
        const out = await E.send(vnReq("bad", { parts }));
        assert.equal(out.errorType, "invalid", JSON.stringify(parts).slice(0, 60));
    }
    assert.equal((await E.send(vnReq("bad", { jobId: { x: 1 } }))).errorType, "invalid");
    assert.equal(calls.length, 0);
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
    // 1.7.0: the user asked for Mỹ Duyên as the voice, set once over any earlier choice
    const B = bgEnv(async () => reply({}), cfg({ dubLocalVoice: "Kim Thanh", dubLocalVoice2: "Đức Trí" }));
    assert.equal(B.syncStore.dubLocalVoice, "Mỹ Duyên");
    const C = bgEnv(async () => reply({}), cfg({ dubLocalVoice: "Kim Thanh", voiceMyDuyen170: true }));
    assert.equal(C.syncStore.dubLocalVoice, "Kim Thanh", "a choice made after 1.7.0 is kept");
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

test("who speaks: one Gemini reading per video, the cheapest model the key can call, kept; nothing without a key", async () => {
    const LINES = ["What are you making right now?", "About $3,000 a month.", "From what?", "Uber, but I'm losing money.", "Roll the clip.", "Okay."];
    const answer = { speakers: [{ id: 1, label: "host", gender: "male" }, { id: 2, label: "guest", gender: "female" }],
        turns: [{ line: 0, speaker: 1 }, { line: 1, speaker: 2 }, { line: 1, speaker: 2 }, { line: 2, speaker: 1 }, { line: 3, speaker: 2, at: "but" }, { line: 9, speaker: 1 }, { line: 4, speaker: 7 }],
        confidence: "high" };
    const seen = [];
    const bodies = [];
    const fetchImpl = async (u, o) => {
        const m = modelOf(u);
        seen.push(m);
        if (m === "gemini-2.5-flash-lite") return NEW_USER_404(m);
        bodies.push(JSON.parse(o.body));
        return reply(answer);
    };
    const E = bgEnv(fetchImpl, cfg());
    const req = { action: "analyzeSpeakers", lines: LINES, videoTitle: "Money show", videoKey: "yt:abc" };
    const r = JSON.parse(JSON.stringify(await E.send(req)));      // out of the sandbox's realm
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.model, "gemini-3.1-flash-lite");
    assert.deepEqual(seen, ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"]);
    // one turn per change of speaker, real lines only; an unknown speaker number is added
    assert.deepEqual(r.turns.map(x => [x.line, x.speaker]), [[0, 1], [1, 2], [2, 1], [3, 2], [4, 7]]);
    assert.equal(r.turns[3].at, "but");
    assert.ok(r.speakers.some(x => x.id === 7));
    assert.equal(r.confidence, "high");
    const b = bodies[0];
    assert.equal(b.generationConfig.temperature, 0);
    assert.equal(b.generationConfig.responseMimeType, "application/json");
    assert.match(b.contents[0].parts[0].text, /^Video title: Money show\nLines \(6\):\n0\| What are you making right now\?/);
    assert.match(b.system_instruction.parts[0].text, /Quoted or reported speech/);
    // a second viewing: from the store, no call
    const again = await E.send(req);
    assert.equal(again.fromCache, true);
    assert.equal(seen.length, 2);
    // the call is charged as text, on this video
    const st = await E.send({ action: "costStats" });
    assert.ok(st.day.trCalls >= 1 && st.day.videos["yt:abc"].usd > 0, JSON.stringify(st.day));
    // no key, or AI off: no call at all
    const none = [];
    for (const c of [cfg({ geminiApiKey: "" }), cfg({ useAi: false })]) {
        const r2 = await bgEnv(async u => { none.push(u); return reply(answer); }, c).send(req);
        assert.equal(r2.ok, false);
        assert.equal(r2.reason, "no_key");
    }
    assert.deepEqual(none, []);
    // an unusable answer is no reading
    const bad = await bgEnv(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }) }), cfg({ geminiApiKey: "KEY-OLD-USER" })).send(req);
    assert.equal(bad.ok, false);
    assert.equal(bad.reason, "bad_output");
});

test("who speaks: an answer cut off by the token cap keeps its whole turns and says where the page reads on", async () => {
    const LINES = Array.from({ length: 40 }, (_, i) => `Line ${i} of a long panel.`);
    // pretty-printed JSON stopped in the middle of a turn (yF1rzzxe2vc, 2026-10-16 speaker lab)
    const raw = JSON.stringify({ speakers: [{ id: 1, label: "host", gender: "female" }, { id: 2, label: "guest", gender: "female" }],
        turns: [{ line: 0, speaker: 1 }, { line: 4, speaker: 2, at: "Line 4" }, { line: 9, speaker: 1 }, { line: 12, speaker: 2 }] }, null, 2)
        .replace(/\s*\]\s*\}\s*$/, ",\n    {\n      \"line\": 15,\n      \"spea");
    const bodies = [];
    const cut = { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: raw }] }, finishReason: "MAX_TOKENS" }] }) };
    const E = bgEnv(async (u, o) => { bodies.push(JSON.parse(o.body)); return cut; }, cfg({ geminiApiKey: "KEY-OLD-USER" }));
    const r = JSON.parse(JSON.stringify(await E.send({ action: "analyzeSpeakers", lines: LINES, videoKey: "yt:cut", last: { id: 2 } })));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.turns.map(x => [x.line, x.speaker]), [[0, 1], [4, 2], [9, 1], [12, 2]]);
    assert.equal(r.upTo, 13, "the part read ends with the last whole turn's line");
    assert.equal(r.confidence, "medium");
    assert.equal(r.speakers.length, 2);
    // room for a turn on every line; the page's next part says who was talking where this one ends
    assert.equal(bodies[0].generationConfig.maxOutputTokens, 2048 + 40 * 32);
    assert.match(bodies[0].contents[0].parts[0].text, /Speaker 2 was talking when the part before ended/);
    // cut before 8 lines were read: no reading
    const short = raw.slice(0, raw.indexOf('"line": 9'));
    const E2 = bgEnv(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: short }] }, finishReason: "MAX_TOKENS" }] }) }), cfg({ geminiApiKey: "KEY-OLD-USER" }));
    const r2 = await E2.send({ action: "analyzeSpeakers", lines: LINES, videoKey: "yt:cut2" });
    assert.equal(r2.ok, false);
    assert.equal(r2.reason, "bad_output");
    // the page goes on from upTo with the last speaker, and asks no more than it needs
    const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "dubbing.js"), "utf8");
    assert.match(src, /from \+= upTo/);
    assert.match(src, /last: said \? \{ id: said\.speaker \} : null/);
});

test("who speaks: a reading the timer gave up on is charged as a reading writes, then at its real counts, and kept", async () => {
    // JBvcMfa7K6E, 2026-10-16: a part was dropped live twice after 22.5 s and charged as 20 output
    // tokens each time; read in the lab, the same part wrote 16,368
    const LINES = Array.from({ length: 40 }, (_, i) => `Line ${i} of a long panel.`);
    const answer = { speakers: [{ id: 1, label: "host", gender: "female" }, { id: 2, label: "guest", gender: "male" }], turns: [{ line: 0, speaker: 1 }, { line: 9, speaker: 2 }], confidence: "high" };
    let calls = 0, aborted = false;
    const scale = 0.01;
    const E = bgEnv(async (u, o) => {
        if (!u.includes("generativelanguage")) return GOOGLE_OK;
        calls++;
        o.signal.addEventListener("abort", () => { aborted = true; });
        // past the timeout: 15 s + 0.4 ms a character + 4 ms a token of the cap (~28.8 s here)
        await new Promise(r => setTimeout(r, 40000 * scale));
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 16000 } }) };
    }, cfg({ geminiApiKey: "KEY-OLD-USER" }), { timeScale: scale });
    const r = await E.send({ action: "analyzeSpeakers", lines: LINES, videoKey: "yt:late" });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "timeout");
    const early = await E.send({ action: "costStats" });
    assert.equal(early.day.estCalls, 1);
    assert.ok(early.day.outTok >= 400 + 40 * 3, "charged as a reading writes, not as 20 tokens: " + early.day.outTok);
    await new Promise(res => setTimeout(res, 25000 * scale));
    const st = await E.send({ action: "costStats" });
    assert.equal(aborted, false, "the request runs on, so its bill can be read");
    assert.equal(st.day.estCalls, 0);
    assert.equal(st.day.lateCalls, 1);
    assert.deepEqual([st.day.inTok, st.day.outTok], [900, 16000]);
    // the paid reading is kept: the next ask is answered from the store
    const again = await E.send({ action: "analyzeSpeakers", lines: LINES, videoKey: "yt:late" });
    assert.equal(again.ok, true);
    assert.equal(again.fromCache, true);
    assert.equal(calls, 1);
});

test("a first install opens the onboarding page; an update or a reload opens nothing", async () => {
    const E = bgEnv(async () => reply({}), cfg(), { tabs: [] });
    E.installedListeners[0]({ reason: "update" });
    E.installedListeners[0]({ reason: "chrome_update" });
    await new Promise(r => setTimeout(r, 20));
    assert.deepEqual(E.opened, []);
    E.installedListeners[0]({ reason: "install" });
    await new Promise(r => setTimeout(r, 20));
    assert.deepEqual(E.opened, ["chrome-extension://test-id/onboarding.html"]);
    const R = f => require("node:fs").readFileSync(require("node:path").join(__dirname, "..", f), "utf8");
    const html = R("options.html");
    // The old welcome card in Settings was unreachable (nothing opens #welcome) and is gone
    assert.doesNotMatch(html, /welcomeCard/);
    assert.doesNotMatch(R("options.js"), /#welcome/);
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
    // 2.6.9: the next part waits until chainLead before its subtitle, so a shorter take leaves a
    // silence; the timer must still start it on time, not a whole slowed tick (1 s) late
    const worst = Math.max(...gaps.map(x => x.gap));
    assert.ok(worst <= 0.9, `hụt ${worst.toFixed(2)} giây giữa hai đoạn của cùng câu`);
    const late = st.slice(1).filter(x => x.lag > 0.15);
    assert.equal(late.length, 0, `started late: ${JSON.stringify(late.map(x => x.lag.toFixed(2)))}`);
});

// ================= CHỜ CHUẨN BỊ (tối đa 3,5 giây) khi mở video mới / tua tới đoạn mới =================
function holdEnv() {
    const msgs = [];
    const env = dubbingEnvFor("balanced", "vieneu", msgs, () => ({ ok: false }));
    env.setInterval = setInterval; env.clearInterval = clearInterval;
    env.document.createElement = () => ({ style: {}, remove() {}, setAttribute() {}, appendChild(c) { return c; }, set textContent(v) { this.text = v; } });
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
        assert.equal(env.CST_DUB.dub.engine.d.condense, undefined, `chế độ ${mode}`);
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
    // 1.6.1: the ceiling follows the video's pace but never passes 5.8 syllables per second
    assert.ok(st.every(x => x.rate <= Math.max(1.4, Math.min(1.65, 5.8 / sps)) + 1e-9), JSON.stringify(st.map(x => x.rate)));
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

test("page audio cache is capped by bytes: 48 kHz takes cannot pile up tens of MB in the tab (1.7.3)", async () => {
    const msgs = [];
    const env = dubbingEnvFor("balanced", "vieneu", msgs, m => (m.action === "localTtsStatus" ? { ok: true, running: true } : { ok: true, hits: {} }));
    const video = new FakeVideo();
    assert.equal(await env.CST_DUB.start({ video, getGroups: () => [] }), true);
    const cache = env.CST_DUB.dub.engine.d.audioCache;
    const MB = 1024 * 1024;
    for (let i = 0; i < 30; i++) cache.put(`k${i}`, { wav: new Uint8Array(MB), duration: 10, sampleRate: 48000 });
    const newest = await cache.get(["k29"]);
    assert.ok(newest.k29, "the newest take stays in the page");
    msgs.length = 0;
    const oldest = await cache.get(["k0"]);
    assert.ok(!oldest.k0, "the oldest take was dropped (16 MB cap), it comes back from the service worker");
    assert.ok(msgs.some(m => m.action === "audioCacheGet"), "a dropped take is asked from the service worker");
    // small takes still reach the entry cap of 40, not the byte cap
    for (let i = 0; i < 40; i++) cache.put(`s${i}`, { wav: new Uint8Array(1000), duration: 0.1, sampleRate: 48000 });
    assert.ok((await cache.get(["s0"])).s0);
    env.CST_DUB.stop();
});

// 1.8.9: one corrupt record in a store reply threw out the whole lookup (every hit lost, the lines
// generated again), and a take replayed from the page cache was still the first one evicted
test("page audio cache: a corrupt stored record is skipped, the others are used; a take read back stays longest", async () => {
    const msgs = [];
    const good = Buffer.from(new Uint8Array(4000)).toString("base64");
    const env = dubbingEnvFor("balanced", "vieneu", msgs, m => (m.action === "localTtsStatus" ? { ok: true, running: true }
        : { ok: true, hits: { a: { wav: good, duration: 1, sampleRate: 48000 }, b: { wav: "%%not base64%%", duration: 1, sampleRate: 48000 }, c: null, d: { wav: good, duration: 1, sampleRate: 48000 } } }));
    const video = new FakeVideo();
    assert.equal(await env.CST_DUB.start({ video, getGroups: () => [] }), true);
    const cache = env.CST_DUB.dub.engine.d.audioCache;
    const got = await cache.get(["a", "b", "c", "d"]);
    assert.deepEqual(Object.keys(got).sort(), ["a", "d"]);
    const MB = 1024 * 1024;
    cache.put("keep", { wav: new Uint8Array(MB), duration: 10, sampleRate: 48000 });
    for (let i = 0; i < 24; i++) {
        cache.put(`f${i}`, { wav: new Uint8Array(MB), duration: 10, sampleRate: 48000 });
        await cache.get(["keep"]);                          // replayed (rewind) while new takes arrive
    }
    msgs.length = 0;
    assert.ok((await cache.get(["keep"])).keep, "a take read back was evicted before older unread ones");
    assert.ok(!msgs.some(m => m.action === "audioCacheGet"));
    env.CST_DUB.stop();
});

// 1.9.9: a slow voice on a fast talk falls behind and loses lines. The quick menu names quicker
// voices of the same kind (measured: late starts 59 -> 3 with Thục Đoan instead of Mỹ Duyên)
test("quick menu: a voice too slow for the video suggests quicker ones by name", () => {
    const env = dubbingEnvFor("economy", "vieneu", [], () => ({ ok: true, running: true }), false);
    const D = env.CST_DUB;
    assert.deepEqual([...D.fasterVoices("Mỹ Duyên")], ["Thùy Dung", "Thục Đoan"]);
    assert.deepEqual([...D.fasterVoices("Thùy Dung")], [], "already among the quickest");
    assert.deepEqual([...D.fasterVoices("no such voice")], []);
    const health = { live: false, ahead: 40, rtf: 0.3, dropped: 2, errors: 0, pace: 1.2, paceHigh: 1.45 };
    D.dub.enabled = true;
    D.dub.lastStatus = { voice: "Mỹ Duyên" };
    D.dub.engine = { health: () => health, d: { video: { currentTime: 10, paused: false } } };
    let h = D.describeHealth();
    assert.match(h.text, /thử Thùy Dung hoặc Thục Đoan/);
    assert.equal(h.warn, true);
    health.paceHigh = 1.2; health.dropped = 0;
    h = D.describeHealth();
    assert.doesNotMatch(h.text, /thử /);
    assert.match(h.text, /người nói nhanh/);
    assert.equal(h.warn, false);
    // "Chép chẩn đoán" copies one JSON text: the engine's snapshot and events, never the API key
    D.dub.engine.debugSnapshot = () => ({ events: [{ at: 1, t: 2, k: "drop", id: "t1", why: "lag" }] });
    D.dub.engine.settings = { maxRate: null, secondVoice: false, prefetchMax: 30 };
    const diag = JSON.parse(D.diagnostics());
    assert.equal(diag.video, "abc");
    assert.equal(diag.engine.events[0].why, "lag");
    assert.equal(diag.player.t, 10);
    assert.doesNotMatch(D.diagnostics(), /apiKey/i);
    D.dub.engine = null;
});
