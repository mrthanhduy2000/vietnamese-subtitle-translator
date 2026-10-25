// Kiểm thử đợt Tối ưu chi phí + Độ tin cậy (1.1.3, 1.1.4):
// LOCAL -> CACHE -> MODEL RẺ -> MODEL MẠNH (khi cần) -> TTS (khi cần, đúng một lần)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const CACHE = require("../cst-cache.js");
const COST = require("../cost-policy.js");
const PLAN = require("../dub-planner.js");
const { DubEngine, SYNC: DubEngineSYNC } = require("../dub-engine.js");
const { Clock, FakeVideo, FakeAudio, lectureGroups } = require("./dub-sim.js");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

// ================= 1. KHO ĐỆM 2 TẦNG =================
test("kho đệm: RAM -> IndexedDB, sống qua 'khởi động lại' (kho mới trên cùng dữ liệu)", async () => {
    const backend = CACHE.memoryBackend();
    const a = new CACHE.TieredCache(backend, "tr", { version: 1 });
    await a.set("k1", { translations: ["Xin chào"] });
    assert.deepEqual(await a.get("k1"), { translations: ["Xin chào"] });
    assert.equal(a.stats.l1, 1);
    const b = new CACHE.TieredCache(backend, "tr", { version: 1 });  // service worker mới, RAM trống
    assert.deepEqual(await b.get("k1"), { translations: ["Xin chào"] });
    assert.equal(b.stats.l2, 1);
});

test("kho đệm: đổi phiên bản (prompt/giọng mới) -> bản cũ không được dùng và bị dọn", async () => {
    const backend = CACHE.memoryBackend();
    await new CACHE.TieredCache(backend, "tr", { version: 3 }).set("k", { t: 1 });
    const v4 = new CACHE.TieredCache(backend, "tr", { version: 4 });
    assert.equal(await v4.get("k"), null);
    assert.equal((await v4.info()).count, 0);
});

test("kho đệm: vượt dung lượng thì xóa mục ÍT DÙNG GẦN ĐÂY NHẤT (LRU), giữ mục vừa dùng", async () => {
    let now = 1000;
    const c = new CACHE.TieredCache(CACHE.memoryBackend(), "audio", { version: 1, maxBytes: 10000, memEntries: 1, now: () => now });
    const blob = n => new Uint8Array(n);
    for (const k of ["a", "b", "c"]) { now += 10; await c.set(k, { wav: blob(2500) }); }
    now += 10;
    await c.get("a");                     // "a" vừa được dùng lại
    await c.flushTouches();
    for (const k of ["d", "e"]) { now += 10; await c.set(k, { wav: blob(2500) }); }
    const info = await c.info();
    assert.ok(info.bytes <= 10000, String(info.bytes));
    c.mem.clear();
    assert.ok(await c.get("a"), "mục vừa dùng bị xóa nhầm");
    assert.equal(await c.get("b"), null, "mục lâu không dùng phải bị xóa trước");
    assert.ok(info.evicted >= 1);
});

test("khóa: cùng câu nhưng ngữ cảnh / model / phiên bản khác thì khóa khác", async () => {
    const k = parts => CACHE.hashKey(parts);
    const base = ["tr", 4, "en", "vi", "m1|m2", ["It runs."], [], "Lập trình", "", "The program starts.", ""];
    const k1 = await k(base);
    assert.equal(k1, await k([...base]));
    assert.notEqual(k1, await k(["tr", 4, "en", "vi", "m1|m2", ["It runs."], [], "Kinh doanh", "", "The company is small.", ""]));
    assert.notEqual(k1, await k(["tr", 5, ...base.slice(2)]));
    assert.notEqual(k1, await k(["tr", 4, "en", "vi", "mX|m2", ...base.slice(5)]));
    assert.equal(CACHE.normalizeText("  Xin   chào\n bạn "), "Xin chào bạn");
});

// ================= 2. ĐỊNH TUYẾN ĐỘ KHÓ (không gọi AI) =================
test("định tuyến: câu dễ -> model rẻ; câu khó (thành ngữ, đại từ, nhiều mệnh đề) -> model mạnh", () => {
    const easy = ["Welcome to the course.", "In this video, we will learn about linear regression.", "Let's get started.", "The model has two layers."];
    for (const s of easy) assert.equal(COST.routeDifficulty({ sentences: [s], context: {} }).tier, "cheap", s);
    const hard = [
        ["It turns out that, at the end of the day, this boils down to whether they can figure it out, which is rarely the case."],
        ["That's why.", "It does, although it only works when they set it up so that it can keep track of them."]
    ];
    for (const s of hard) assert.equal(COST.routeDifficulty({ sentences: s, context: {} }).tier, "strong", s.join(" "));
    const r = COST.routeDifficulty({ sentences: hard[0], context: {} });
    assert.ok(r.reasons.includes("thành ngữ / cụm động từ"));
});

test("chế độ sử dụng: mặc định Cân bằng; Tiết kiệm không dùng Gemini TTS; Chỉ phụ đề tắt lồng tiếng", () => {
    assert.equal(COST.getMode("???").id, "balanced");
    assert.equal(COST.getMode("economy").tts, "local");
    assert.equal(COST.getMode("subtitles").tts, "none");
    assert.equal(COST.getMode("premium").escalate, true);
    assert.equal(COST.getMode("balanced").escalate, false);
    assert.ok(COST.getMode("balanced").prefetch < COST.getMode("premium").prefetch);
    assert.equal(COST.DEFAULT_MODELS.cheap, "auto");
});

// ================= 3. BACKGROUND: CACHE BỀN VỮNG, MODEL, TTS =================
const { bgEnv } = require("./bg-env.js");
const reply = obj => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
const REQ = { action: "translateUnit", sentences: ["The model receives the image."], context: { domain: "Trí tuệ nhân tạo", prevSource: "We load the data." } };

test("bản dịch sống qua khởi động lại service worker: lần hai KHÔNG gọi Gemini", async () => {
    const backend = CACHE.memoryBackend();
    let calls = 0;
    const f = async () => { calls++; return reply({ t: ["Mô hình nhận bức ảnh."] }); };
    const A = bgEnv(f, { geminiApiKey: "k", costMigration113: true }, { backend });
    const r1 = await A.send(REQ);
    assert.equal(r1.fromCache, undefined);
    const B = bgEnv(f, { geminiApiKey: "k", costMigration113: true }, { backend });   // SW mới
    const r2 = await B.send(REQ);
    assert.equal(r2.fromCache, true);
    assert.deepEqual(r2.translations, ["Mô hình nhận bức ảnh."]);
    assert.equal(calls, 1);
});

test("đổi model dịch -> không dùng nhầm bản dịch của model cũ", async () => {
    const backend = CACHE.memoryBackend();
    let calls = 0;
    const f = async () => { calls++; return reply({ t: ["x"] }); };
    await bgEnv(f, { geminiApiKey: "k", costMigration113: true }, { backend }).send(REQ);
    await bgEnv(f, { geminiApiKey: "k", costMigration113: true, geminiModel: "gemini-3.8-flash" }, { backend }).send(REQ);
    assert.equal(calls, 2);
});

test("model: tier cheap -> 2.5 Flash-Lite (mặc định), tier strong -> 3.5 Flash-Lite; chỉ xin 'terms' khi cần", async () => {
    const urls = [], bodies = [];
    const f = async (u, o) => { urls.push(u); bodies.push(JSON.parse(o.body)); return reply({ t: ["a"], terms: [{ en: "model", vi: "mô hình" }] }); };
    const E = bgEnv(f, { geminiApiKey: "k", costMigration113: true });
    await E.send({ ...REQ, sentences: ["A."] });
    await E.send({ ...REQ, sentences: ["B."], tier: "strong", wantTerms: true });
    assert.match(urls[0], /gemini-2\.5-flash-lite:generateContent/);
    assert.match(urls[1], /gemini-3\.5-flash-lite:generateContent/);
    assert.deepEqual(Object.keys(bodies[0].generationConfig.responseSchema.properties), ["t"]);
    assert.deepEqual(Object.keys(bodies[1].generationConfig.responseSchema.properties), ["t", "terms"]);
    assert.ok(!/terms/.test(bodies[0].system_instruction.parts[0].text), "không xin thuật ngữ khi không cần");
});

test("bản dịch lại (tốt hơn) được ghi đè vào cache và đánh dấu đã khôi phục thuật ngữ", async () => {
    let calls = 0;
    const E = bgEnv(async () => { calls++; return reply({ t: ["Nó là quan trọng."] }); }, { geminiApiKey: "k", costMigration113: true });
    const r1 = await E.send(REQ);
    await E.send({ action: "translateUnitStore", cacheKey: r1.cacheKey, translations: ["Điều quan trọng."], tier: "strong" });
    const r2 = await E.send(REQ);
    assert.equal(calls, 1);
    assert.deepEqual(r2.translations, ["Điều quan trọng."]);
    assert.equal(r2.restored, true);
});

test("lỗi 503 kéo dài: thử lại CÓ GIỚI HẠN (3 lượt ở model đầu, 1 lượt mỗi model kế), rồi dùng Google; bản Google KHÔNG lưu bền vững", async () => {
    let gem = 0;
    const f = async u => {
        if (u.includes("generativelanguage")) { gem++; return { ok: false, status: 503, statusText: "x", json: async () => ({ error: { code: 503, status: "UNAVAILABLE", message: "The model is overloaded." } }) }; }
        return { ok: true, status: 200, json: async () => [[["Bản Google", "x"]], null, "en"] };
    };
    const E = bgEnv(f, { geminiApiKey: "k", costMigration113: true });
    const r1 = await E.send(REQ);
    assert.equal(r1.engine, "google_fallback");
    // chain (auto, balanced): 2.5, 3.1, 3.5 Flash-Lite. 1.7.3: an overloaded model hands over to the
    // next one (one attempt each) instead of going straight to Google
    assert.equal(gem, 5, "3 lượt ở model đầu + 1 lượt mỗi model kế");
    await E.send(REQ);
    assert.equal(gem, 10, "lần sau vẫn thử lại Gemini vì bản Google không được lưu");
});

test("free fallback: a sentence every endpoint refuses leaves only that line empty, not the window", async () => {
    const f = async u => {
        if (u.includes("Broken")) return { ok: false, status: 500, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => [[["Bản Google", "x"]], null, "en"] };
    };
    const E = bgEnv(f, { costMigration113: true });          // no key: Google by choice
    const r = await E.send({ ...REQ, sentences: ["Fine one.", "Broken one.", "Fine two."] });
    assert.equal(r.ok, true);
    assert.deepEqual(r.translations, ["Bản Google", "", "Bản Google"]);
    const all = await E.send({ ...REQ, sentences: ["Broken a.", "Broken b."] });
    assert.equal(all.ok, false, "every sentence failed: the window fails as before");
});

test("free fallback: a window goes to Google as one request, split back by line", async () => {
    const urls = [];
    const f = async u => {
        urls.push(u);
        const q = decodeURIComponent(new URL(u).searchParams.get("q"));
        // the real gtx shape: one segment per line, each but the last ending in "\n"
        const segs = q.split("\n").map((s, i, a) => [`VI ${s}${i < a.length - 1 ? "\n" : ""}`, s]);
        return { ok: true, status: 200, json: async () => [segs, null, "en"] };
    };
    const E = bgEnv(f, { costMigration113: true });
    const r = await E.send({ ...REQ, sentences: ["One.", "", "Two\nlines.", "Three."] });
    assert.deepEqual(r.translations, ["VI One.", "", "VI Two lines.", "VI Three."]);
    assert.equal(urls.length, 1, "one request for the window, not one per sentence");
});

test("free fallback: clients5's [[text, lang]] answer is read without the language code", async () => {
    const f = async u => {
        if (u.includes("clients5")) return { ok: true, status: 200, json: async () => [["Cảm ơn đã xem.", "en"]] };
        return { ok: false, status: 503, json: async () => ({}) };
    };
    const E = bgEnv(f, { costMigration113: true });
    const r = await E.send({ ...REQ, sentences: ["Thanks for watching."] });
    assert.deepEqual(r.translations, ["Cảm ơn đã xem."]);
});

test("chuyển model một lần: mặc định cũ (3.5 / 3.1 / 2.5 do bản 1.1.5 tự đặt) -> Tự động; lựa chọn khác giữ nguyên; tên model đã tắt được thay", async () => {
    const A = bgEnv(async () => reply({ t: ["x"] }), { geminiModel: "gemini-3.5-flash-lite" });
    assert.equal(A.syncStore.geminiModel, "auto");
    assert.equal(A.syncStore.geminiStrongModel, "gemini-3.5-flash-lite");
    const B = bgEnv(async () => reply({ t: ["x"] }), { geminiModel: "gemini-3.8-flash", costMigration113: true });
    assert.equal(B.syncStore.geminiModel, "gemini-3.8-flash");
    assert.equal(B.syncStore.modelsVersion, COST.MODELS_VERSION);
    const C = bgEnv(async () => reply({ t: ["x"] }), { geminiModel: "gemini-3.1-flash-lite", costMigration113: true });
    assert.equal(C.syncStore.geminiModel, "auto");
    // 1.1.5 đã đặt 2.5 cho MỌI key (sai với key mới) -> Tự động (vẫn dùng 2.5 nếu key có quyền)
    const C2 = bgEnv(async () => reply({ t: ["x"] }), { geminiModel: "gemini-2.5-flash-lite", modelsVersion: 114 });
    assert.equal(C2.syncStore.geminiModel, "auto");
    const D = bgEnv(async () => reply({ t: ["x"] }), { geminiModel: "gemini-3.1-flash-lite-preview", geminiStrongModel: "gemini-2.0-flash" });
    assert.equal(D.syncStore.geminiModel, "auto");
    assert.equal(D.syncStore.geminiStrongModel, "gemini-3.5-flash-lite");
    // Đã chuyển rồi: người dùng chủ động chọn 2.5 hay 3.1 thì GIỮ NGUYÊN
    for (const id of ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]) {
        const E = bgEnv(async () => reply({ t: ["x"] }), { geminiModel: id, modelsVersion: COST.MODELS_VERSION });
        assert.equal(E.syncStore.geminiModel, id);
    }
});

// Audio PCM 16-bit 24 kHz giả: các đoạn "nói" (sóng sin) ngăn bởi khoảng lặng
function fakePcm(segSeconds, gap = 0.45) {
    const sr = 24000, out = [];
    segSeconds.forEach((d, k) => {
        for (let i = 0; i < d * sr; i++) out.push(Math.round(Math.sin(i / 6) * 9000 * (0.6 + 0.4 * Math.sin(i / 900))));
        if (k < segSeconds.length - 1) for (let i = 0; i < gap * sr; i++) out.push(0);
    });
    const buf = Buffer.alloc(out.length * 2);
    out.forEach((v, i) => buf.writeInt16LE(v, i * 2));
    return buf.toString("base64");
}
const ttsReply = (segs = [1.2]) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;codec=pcm;rate=24000", data: fakePcm(segs) } }] } }] }) });
const TTS_REQ = { action: "synthesizeSpeech", text: "Đọc: Xin chào các bạn.\n\nHôm nay ta học mạng nơ-ron.", voice: "Kore", parts: [{ key: "k-a", weight: 5 }, { key: "k-b", weight: 7 }] };

test("TTS lưu kho NGAY trong service worker (trước khi trả lời): khởi động lại vẫn còn, gửi lại KHÔNG gọi TTS; thống kê & xóa", async () => {
    const backend = CACHE.memoryBackend();
    let calls = 0;
    const f = async () => { calls++; return ttsReply([1.1, 1.6]); };
    const A = bgEnv(f, { geminiApiKey: "k", costMigration113: true }, { backend });
    const r1 = await A.send(TTS_REQ);
    assert.equal(r1.ok, true);
    assert.deepEqual(r1.parts.map(p => p.key), ["k-a", "k-b"]);
    assert.ok(Math.abs(r1.parts[0].duration - 1.1) < 0.25 && Math.abs(r1.parts[1].duration - 1.6) < 0.25, r1.parts.map(p => p.duration).join(","));
    // Service worker mới (trang đã đóng, trả lời cũ bị mất): audio vẫn trong kho
    const B = bgEnv(f, { geminiApiKey: "k", costMigration113: true }, { backend });
    const g = await B.send({ action: "audioCacheGet", keys: ["k-a", "k-b", "nope"] });
    assert.deepEqual(Object.keys(g.hits).sort(), ["k-a", "k-b"]);
    assert.deepEqual([...Buffer.from(g.hits["k-a"].wav, "base64")], [...Buffer.from(r1.parts[0].wav, "base64")]);
    const r2 = await B.send(TTS_REQ);
    assert.equal(r2.fromCache, true);
    assert.equal(calls, 1, "đã có trong kho thì không được gọi TTS lần nữa");
    const st = await B.send({ action: "cacheStats" });
    assert.equal(st.audio.count, 2);
    const cleared = await B.send({ action: "cacheClear", which: "audio" });
    assert.equal(cleared.audio.count, 0);
});

test("TTS: không tự dùng model Pro; lỗi 500 thử lại đúng 1 lần; hủy khi người dùng tua", async () => {
    const urls = [];
    let n = 0;
    const f = async (u, o) => {
        urls.push(u);
        n++;
        if (n === 1) return { ok: false, status: 500, statusText: "x", json: async () => ({ error: { message: "internal" } }) };
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: "AAAA" } }] } }] }) };
    };
    const E = bgEnv(f, { geminiApiKey: "k", costMigration113: true });
    const r = await E.send({ action: "synthesizeSpeech", text: "Xin chào", voice: "Kore" });
    assert.equal(r.ok, true);
    assert.equal(n, 2);
    assert.ok(urls.every(u => !/pro/.test(u)));
    assert.match(urls[0], /gemini-2\.5-flash-preview-tts/);
    // Hủy: fetch bị abort -> trả aborted
    const E2 = bgEnv((u, o) => new Promise((res, rej) => o.signal.addEventListener("abort", () => { const e = new Error("abort"); e.name = "AbortError"; rej(e); })), { geminiApiKey: "k", costMigration113: true });
    const p = E2.send({ action: "synthesizeSpeech", text: "Xin chào", jobId: "j1" });
    await new Promise(r2 => setTimeout(r2, 5));
    await E2.send({ action: "ttsAbort", jobId: "j1" });
    assert.equal((await p).aborted, true);
});

// ================= 4. CONTENT: DỊCH LẠI CÓ KIỂM SOÁT THEO CHẾ ĐỘ =================
function contentEnv(onMsg, mode) {
    const noop = () => {};
    const sandbox = {
        console: { log: noop, warn: noop, error: console.error }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number, TextEncoder, crypto: globalThis.crypto,
        location: { href: "https://www.youtube.com/watch?v=t", hostname: "www.youtube.com", pathname: "/watch" },
        document: { readyState: "complete", title: "t", body: {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], getElementsByTagName: () => [], createElement: () => ({ style: {}, appendChild: noop, addEventListener: noop }), head: { appendChild: noop }, documentElement: { appendChild: noop }, addEventListener: noop },
        addEventListener: noop, postMessage: noop, MutationObserver: class { observe() {} disconnect() {} }, alert: noop,
        requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
        chrome: {
            storage: { sync: { get: async d => ({ ...d, costMode: mode }), set: async () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener: noop } },
            runtime: { lastError: null, onMessage: { addListener: noop }, sendMessage: (m, cb) => Promise.resolve(onMsg(m)).then(cb) }
        }
    };
    sandbox.window = sandbox; sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of ["glossary.js", "cst-cache.js", "cost-policy.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js", "youtube.js"]) vm.runInContext(read(f), sandbox);
    return sandbox;
}
async function ready(env) { for (let i = 0; i < 60 && !env.state?.reExact; i++) await new Promise(r => setTimeout(r, 5)); }
function mkSession(env, units) {
    env.__u = units;
    return vm.runInContext("(() => { const s = new CST_CONTEXT.ContextSession({}); s.setUnits(__u); return s; })()", env);
}

const BAD = "Nó là quan trọng để chuẩn hóa các đầu vào.";
const GOOD = "Điều quan trọng là phải chuẩn hóa dữ liệu đầu vào.";

for (const [mode, expectRefines, expectTier] of [["premium", 1, "strong"], ["balanced", 1, "cheap"], ["economy", 0, null], ["subtitles", 0, null]]) {
    test(`chế độ ${mode}: dịch lại ${expectRefines ? "đúng 1 lần bằng model " + expectTier : "không bao giờ"} khi có lỗi nặng`, async () => {
        const msgs = [];
        const env = contentEnv(m => {
            msgs.push(m);
            if (m.action === "translateUnitStore") return { ok: true };
            return { ok: true, engine: "gemini", model: "x", latency: 1, cacheKey: "K", translations: [m.refine ? GOOD : BAD] };
        }, mode);
        await ready(env);
        env.__s = mkSession(env, ["It is important to normalize the inputs."]);
        const r = await vm.runInContext("translateWindow(__s, [0], { realtime: false })", env);
        const refines = msgs.filter(m => m.action === "translateUnit" && m.refine);
        assert.equal(refines.length, expectRefines);
        if (expectRefines) {
            assert.equal(refines[0].tier, expectTier);
            assert.equal(r.translations[0], GOOD);
            assert.ok(msgs.some(m => m.action === "translateUnitStore" && m.cacheKey === "K"), "không lưu bản cuối vào cache");
        } else {
            assert.equal(r.translations[0], BAD);
        }
    });
}

test("cân bằng: lỗi nhẹ (không nặng) thì KHÔNG dịch lại; cao cấp: câu khó được gửi thẳng model mạnh", async () => {
    const msgs = [];
    const env = contentEnv(m => { msgs.push(m); return { ok: true, engine: "gemini", model: "x", cacheKey: "K", translations: ["Bạn có thể nhìn thấy kết quả ở đây."] }; }, "balanced");
    await ready(env);
    env.__s = mkSession(env, ["You can see the result here."]);
    await vm.runInContext("translateWindow(__s, [0], { realtime: false })", env);
    assert.equal(msgs.filter(m => m.refine).length, 0);

    const msgs2 = [];
    const env2 = contentEnv(m => { msgs2.push(m); return { ok: true, engine: "gemini", model: "x", translations: ["Hóa ra, suy cho cùng, mọi chuyện phụ thuộc vào việc họ có tự tìm ra được hay không."] }; }, "premium");
    await ready(env2);
    env2.__s = mkSession(env2, ["It turns out that, at the end of the day, this boils down to whether they can figure it out, which is rarely the case."]);
    await vm.runInContext("translateWindow(__s, [0], { realtime: false })", env2);
    assert.equal(msgs2[0].tier, "strong");
    // Cân bằng: cùng câu khó vẫn dùng model rẻ
    const msgs3 = [];
    const env3 = contentEnv(m => { msgs3.push(m); return { ok: true, engine: "gemini", model: "x", translations: ["x"] }; }, "balanced");
    await ready(env3);
    env3.__s = mkSession(env3, ["It turns out that, at the end of the day, this boils down to whether they can figure it out, which is rarely the case."]);
    await vm.runInContext("translateWindow(__s, [0], { realtime: false })", env3);
    assert.equal(msgs3[0].tier, "cheap");
});

test("bản dịch từ cache: không kiểm tra/dịch lại; bản đã khôi phục không bị gửi lại Gemini", async () => {
    const msgs = [];
    const env = contentEnv(m => { msgs.push(m); return { ok: true, engine: "gemini", fromCache: true, restored: true, translations: ["Chúng ta dùng PyTorch."] }; }, "premium");
    await ready(env);
    env.__s = mkSession(env, ["We use PyTorch."]);
    const r = await vm.runInContext("translateWindow(__s, [0], { realtime: false })", env);
    assert.equal(msgs.length, 1);
    assert.equal(r.translations[0], "Chúng ta dùng PyTorch.");
});

test("YouTube: chỉ dịch trước quanh vị trí đang xem, không dịch cả video", async () => {
    const translated = [];
    const env = contentEnv(m => {
        if (m.action !== "translateUnit") return { ok: true };
        translated.push(...m.sentences);
        return { ok: true, engine: "gemini", model: "x", translations: m.sentences.map(() => "Câu đã dịch.") };
    }, "balanced");
    await ready(env);
    env.__groups = Array.from({ length: 40 }, (_, i) => ({ text: `Sentence number ${i} of the lecture.`, start: i * 15, end: i * 15 + 4, srcCues: [{ start: i * 15, end: i * 15 + 4, text: `Sentence number ${i} of the lecture.` }], translated: false, viCues: null, cueIndexes: [i] }));
    vm.runInContext(`
        yt.videoEl = { currentTime: 0, paused: false, addEventListener() {}, removeEventListener() {} }; yt.groups = __groups; yt.huyDich = false; yt.inFlightGroups.clear();
        yt.session = (() => { const s = new CST_CONTEXT.ContextSession({}); s.setUnits(__groups.map(g => g.text)); return s; })();
        ytChayTienTrinhPrefetch(__groups);
    `, env);
    await new Promise(r => setTimeout(r, 400));
    vm.runInContext("yt.huyDich = true;", env);
    const done = env.__groups.filter(g => g.translated);
    assert.ok(done.length > 0);
    assert.ok(done.every(g => g.start <= 120), "dịch vượt quá 120 giây phía trước (chế độ Cân bằng)");
    assert.ok(env.__groups.filter(g => g.start > 130).every(g => !g.translated));
});

// ================= 5. LỒNG TIẾNG: KHO AUDIO, TẠO MỘT LẦN, RÚT GỌN CÓ ĐIỀU KIỆN, HỦY KHI TUA =================
function audioStore() {
    const m = new Map();
    return {
        m, gets: 0, puts: 0,
        async get(keys) { this.gets++; const o = {}; for (const k of keys) if (m.has(k)) o[k] = m.get(k); return o; },
        put(k, rec) { this.puts++; m.set(k, rec); return Promise.resolve(); }
    };
}

// Gemini TTS thật đọc ở NHỊP TỰ NHIÊN (không theo hệ số tốc độ của kế hoạch)
function naturalDuration(p, m) {
    const base = { ...m, calibration: 1 };
    return p.phrases.reduce((a, ph, k) => a + PLAN.speechSeconds(ph.syl, 1, base) + (k < p.phrases.length - 1 ? PLAN.pauseSeconds(ph.pauseAfter, 1, base) : 0), 0);
}

function geminiFake(opts = {}) {
    const calls = [], aborted = [];
    const voiceModel = { ...PLAN.DEFAULT_VOICE_MODEL, sylPerSec: 4.6, rateExp: 1, pauseFactor: 1.3 };
    return {
        id: "gemini", label: "Gemini giả", caps: { prerender: true, live: false }, voiceLabel: "Kore",
        voiceModel,
        calls, aborted,
        audioKey: p => CACHE.hashKey(["audio", 1, "m", "Kore", CACHE.normalizeText(p.text).toLowerCase(), p.intent]),
        abort(jobId) { aborted.push(jobId); if (opts.onAbort) opts.onAbort(jobId); },
        async render(plans, ctx) {
            calls.push(plans.map(p => p.id));
            if (opts.hang) await new Promise((res, rej) => { opts.onAbort = () => { const e = new Error("hủy"); e.aborted = true; rej(e); }; });
            await new Promise(r => setTimeout(r, 0));
            return plans.map(p => ({ planId: p.id, wav: new Uint8Array(8), duration: (opts.dur ? opts.dur(p) : naturalDuration(p, voiceModel)), sampleRate: 24000 }));
        }
    };
}

async function dubRun(opts = {}) {
    const clock = new Clock(), video = new FakeVideo();
    const groups = opts.groups || lectureGroups();
    const prov = opts.provider || geminiFake(opts);
    const audios = [];
    const eng = new DubEngine({
        video, getGroups: () => groups, providers: { primary: prov },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        createObjectURL: () => "blob:x", revokeObjectURL() {},
        createAudio: () => { const a = new FakeAudio(clock, { duration: 99 }); audios.push(a); return a; },
        audioCache: opts.store
    }, { prefetchMax: opts.prefetchMax || 18 });
    eng.start();
    const run = async ms => {
        for (let t = 0; t < ms; t += 100) {
            clock.advance(100, st => { video.step(st); audios.forEach(a => a.step(st)); });
            await new Promise(r => setImmediate(r));
        }
    };
    await run(1500);
    return { eng, video, prov, run, clock, groups };
}

test("mỗi đoạn chỉ tạo audio MỘT lần, kể cả khi tua lùi / tua tới / tạm dừng nhiều lần", async () => {
    const store = audioStore();
    const S = await dubRun({ store });
    S.video.play();
    await S.run(40000);
    S.video.seek(5); await S.run(3000);
    S.video.pause(); await S.run(2000); S.video.play();
    S.video.seek(60); await S.run(20000);
    S.video.seek(2); await S.run(10000);
    const all = S.prov.calls.flat();
    assert.equal(new Set(all).size, all.length, "có đoạn bị tạo audio hai lần");
    assert.ok(store.puts >= all.length, "audio đã tạo phải được lưu kho");
});

test("mở lại video (engine mới, cùng kho audio): KHÔNG gọi TTS lần nào cho phần đã nghe", async () => {
    const store = audioStore();
    const A = await dubRun({ store });
    A.video.play();
    await A.run(30000);
    const heard = A.video.currentTime;
    A.eng.stop();
    assert.ok(A.prov.calls.length > 0);
    const B = await dubRun({ store, groups: A.groups });
    B.video.play();
    await B.run((heard - 12) * 1000);
    assert.equal(B.prov.calls.length, 0, `gọi TTS ${B.prov.calls.length} lượt dù đã có trong kho`);
    assert.ok(B.eng.stats.cacheHits > 0);
    assert.ok([...B.eng.rendered.keys()].length > 0, "audio từ kho phải được phát");
});

test("revisit: a stored segment just past an unheard stretch is not paid for again (batch spill)", async () => {
    const store = audioStore();
    const A = await dubRun({ store });
    A.video.play();
    await A.run(20000);
    A.video.seek(44);                        // skip a few seconds: the next stored segment sits right after the gap
    await A.run(25000);
    A.eng.stop();
    const B = await dubRun({ store, groups: A.groups });
    const again = [];
    const render = B.prov.render.bind(B.prov);
    B.prov.render = async (plans, ctx) => {
        for (const p of plans) if (store.m.has(await B.prov.audioKey(p))) again.push(p.start.toFixed(1));
        return render(plans, ctx);
    };
    B.video.play();
    await B.run(85000);
    assert.ok(B.prov.calls.length > 0, "the unheard stretch is rendered");
    assert.deepEqual(again, [], "segments already in the audio store were rendered again");
});

test("tạo trước thích ứng: không tạo audio xa hơn trần của chế độ (+ phần gộp nhỏ)", async () => {
    for (const cap of [18, 30]) {
        const S = await dubRun({ store: audioStore(), prefetchMax: cap });
        S.video.play();
        let worst = 0;
        for (let i = 0; i < 300; i++) {
            await S.run(100);
            for (const ids of S.prov.calls) for (const id of ids) {
                const p = S.eng.planById.get(id);
                if (p && !p._seen) { p._seen = S.video.currentTime; worst = Math.max(worst, p.start - p._seen); }
            }
        }
        assert.ok(worst <= cap + 6 + 0.5, `tạo trước ${worst.toFixed(1)} giây với trần ${cap}`);
    }
});

test("tua đi chỗ khác: hủy lượt TTS không còn liên quan, không tính là lỗi", async () => {
    const prov = geminiFake({ hang: true });
    const S = await dubRun({ store: audioStore(), provider: prov });
    assert.equal(S.eng.pending.size > 0, true, "phải có lượt đang chạy");
    S.video.seek(140);
    await S.run(500);
    assert.ok(prov.aborted.length >= 1, "không hủy lượt cũ");
    assert.equal(S.eng.stats.errors, 0);
    assert.ok(S.eng.stats.aborted >= 1);
});

test("audio dài hơn khung sau khi tạo: chỉ co giãn cục bộ (<= 1,15x), không rút gọn rồi tạo lại", async () => {
    const S = await dubRun({ store: audioStore(), dur: p => p.targetDuration * 1.35 });
    S.video.play();
    await S.run(30000);
    const all = S.prov.calls.flat();
    assert.equal(new Set(all).size, all.length);
    for (const r of S.eng.rendered.values()) assert.ok(r.stretch <= PLAN.LIMITS.maxStretch + 1e-9);
});

test("giọng Gemini: tự hiệu chỉnh tốc độ nói từ audio thật -> ước lượng khớp dần", async () => {
    // Giọng thật chậm hơn giả định 25%
    const prov = geminiFake({ dur: p => p.phrases.reduce((a, ph) => a + ph.syl, 0) / (4.6 * 0.75) + 0.3 });
    const S = await dubRun({ store: audioStore(), provider: prov });
    S.video.play();
    await S.run(60000);
    const cal = prov.voiceModel.calibration;
    assert.ok(cal > 1.15 && cal < 1.6, `hệ số ${cal}`);
});

// ================= 6. XỬ LÝ LỖI API, THỬ LẠI CÓ GIỚI HẠN, CHỐNG GỌI TRÙNG =================
const gErr = (status, statusName, message, details) => ({ ok: false, status, statusText: statusName, json: async () => ({ error: { code: status, status: statusName, message, details } }) });
const GOOGLE_OK = { ok: true, status: 200, json: async () => [[["Bản Google", "x"]], null, "en"] };
const cfgK = { geminiApiKey: "k", costMigration113: true };

test("429 (giới hạn tốc độ): không thử lại dồn dập; tạm ngưng ĐÚNG model đó, model kế trong chuỗi dịch thay (không rơi về Google)", async () => {
    const seen = [];
    const f = async u => {
        if (!u.includes("generativelanguage")) return GOOGLE_OK;
        seen.push(u.match(/models\/([^:]+)/)[1]);
        if (u.includes("2.5-flash-lite")) return gErr(429, "RESOURCE_EXHAUSTED", "Resource has been exhausted", [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "20s" }]);
        return reply({ t: ["Bản model mạnh."] });
    };
    const E = bgEnv(f, cfgK);
    const r1 = await E.send({ ...REQ, sentences: ["First."] });
    assert.equal(r1.engine, "gemini", "the next model of the chain translates, with context");
    assert.equal(r1.fallbackFrom, "gemini-2.5-flash-lite");
    assert.deepEqual(seen, ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"], "429 không được thử lại ngay");
    const r2 = await E.send({ ...REQ, sentences: ["Second."] });
    assert.equal(r2.engine, "gemini");
    assert.deepEqual(seen.filter(m => m === "gemini-2.5-flash-lite").length, 1, "trong thời gian tạm ngưng không gọi lại model bị giới hạn");
    const r3 = await E.send({ ...REQ, sentences: ["Third."], tier: "strong" });
    assert.equal(r3.engine, "gemini");
    assert.equal(seen[seen.length - 1], "gemini-3.5-flash-lite");
    // economy caps the chain at the cheapest usable model: a rate limit there still goes to Google
    const seenE = [];
    const E2 = bgEnv(async u => {
        if (!u.includes("generativelanguage")) return GOOGLE_OK;
        seenE.push(u.match(/models\/([^:]+)/)[1]);
        return gErr(429, "RESOURCE_EXHAUSTED", "Resource has been exhausted", []);
    }, { ...cfgK, costMode: "economy" });
    assert.equal((await E2.send({ ...REQ, sentences: ["Cheap."] })).engine, "google_fallback");
    assert.deepEqual(seenE, ["gemini-2.5-flash-lite"], "Tiết kiệm: never a pricier model");
});

test("a line the next model translated (first one rate-limited) is a cache hit on the revisit, not a new call", async () => {
    const backend = CACHE.memoryBackend();
    const seen = [];
    const limited = u => u.includes("2.5-flash-lite") ? gErr(429, "RESOURCE_EXHAUSTED", "Resource has been exhausted", []) : null;
    const f = rateLimited => async u => {
        if (!u.includes("generativelanguage")) return GOOGLE_OK;
        seen.push(u.match(/models\/([^:]+)/)[1]);
        return (rateLimited && limited(u)) || reply({ t: [`Bản của ${u.match(/models\/([^:]+)/)[1]}.`] });
    };
    const E1 = bgEnv(f(true), cfgK, { backend });
    const r1 = await E1.send(REQ);
    assert.equal(r1.model, "gemini-3.1-flash-lite");
    seen.length = 0;
    // same service worker, first model still paused: the stored line answers
    assert.equal((await E1.send(REQ)).fromCache, true);
    assert.deepEqual(seen, []);
    // new service worker (the pause is gone, 2.5 would answer now): the stored line still answers
    const E2 = bgEnv(f(false), cfgK, { backend });
    const r2 = await E2.send(REQ);
    assert.equal(r2.fromCache, true, "paid Gemini again for a line it had translated");
    assert.equal(r2.translations[0], "Bản của gemini-3.1-flash-lite.");
    assert.deepEqual(seen, []);
    // a request meant for the strong model is never answered by a cheaper model's line
    await E2.send({ ...REQ, sentences: ["Cheap line."] });
    seen.length = 0;
    const strong = await bgEnv(f(false), { ...cfgK, costMode: "premium" }, { backend }).send({ ...REQ, sentences: ["Cheap line."], tier: "strong" });
    assert.equal(strong.fromCache, undefined);
    assert.deepEqual(seen, ["gemini-3.5-flash-lite"]);
});

test("400 yêu cầu sai: gọi đúng 1 lần, không thử lại, không ghi gì vào kho", async () => {
    const backend = CACHE.memoryBackend();
    let gem = 0;
    const E = bgEnv(async u => { if (!u.includes("generativelanguage")) return GOOGLE_OK; gem++; return gErr(400, "INVALID_ARGUMENT", "Invalid value at 'contents'"); }, cfgK, { backend });
    const r = await E.send(REQ);
    assert.equal(r.engine, "google_fallback");
    assert.equal(gem, 1);
    assert.equal((await backend.listMeta("tr")).length, 0, "lỗi không được làm bẩn kho");
});

test("401/403 khóa sai: dừng gọi Gemini (không tốn thêm yêu cầu) cho tới khi người dùng đổi API Key", async () => {
    let gem = 0;
    const E = bgEnv(async u => { if (!u.includes("generativelanguage")) return GOOGLE_OK; gem++; return gem === 1 ? gErr(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.") : reply({ t: ["Được rồi."] }); }, cfgK);
    await E.send({ ...REQ, sentences: ["A."] });
    await E.send({ ...REQ, sentences: ["B."] });
    await E.send({ ...REQ, sentences: ["C."], tier: "strong" });
    assert.equal(gem, 1, "khóa sai thì mọi model đều không gọi được: không gửi thêm");
    vm.runInContext('chrome.storage.sync.set({ geminiApiKey: "k2" })', E.sandbox);
    const r = await E.send({ ...REQ, sentences: ["D."] });
    assert.equal(r.engine, "gemini");
    assert.equal(gem, 2);
});

test("404 model mạnh không tồn tại: lùi về model rẻ ngay trong yêu cầu đó; lần sau không gọi lại model hỏng", async () => {
    const seen = [];
    const f = async u => {
        const m = u.match(/models\/([^:]+)/)[1];
        seen.push(m);
        if (m === "gemini-9-typo") return gErr(404, "NOT_FOUND", "models/gemini-9-typo is not found for API version v1beta, or is not supported for generateContent.");
        return reply({ t: ["Ổn."] });
    };
    const E = bgEnv(f, { ...cfgK, geminiStrongModel: "gemini-9-typo" });
    const r = await E.send({ ...REQ, tier: "strong" });
    assert.equal(r.engine, "gemini");
    assert.equal(r.model, "gemini-2.5-flash-lite");
    assert.equal(r.fallbackFrom, "gemini-9-typo");
    await E.send({ ...REQ, sentences: ["Other."], tier: "strong" });
    assert.deepEqual(seen, ["gemini-9-typo", "gemini-2.5-flash-lite", "gemini-2.5-flash-lite"]);
});

test("503 rồi thành công: thử lại sau khi chờ, kết quả hợp lệ mới được lưu kho", async () => {
    let gem = 0;
    const E = bgEnv(async () => { gem++; return gem === 1 ? gErr(503, "UNAVAILABLE", "The model is overloaded.") : reply({ t: ["Mô hình nhận bức ảnh."] }); }, cfgK);
    const r = await E.send(REQ);
    assert.equal(r.engine, "gemini");
    assert.equal(gem, 2);
    assert.equal((await E.send(REQ)).fromCache, true);
    assert.equal(gem, 2);
});

test("bản dịch bị cắt cụt vì chạm trần token: gửi lại ĐÚNG 1 lần với trần gấp đôi", async () => {
    const caps = [];
    const E = bgEnv(async (u, o) => {
        const b = JSON.parse(o.body);
        caps.push(b.generationConfig.maxOutputTokens);
        if (caps.length === 1) return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '{"t": ["Mô hình nh' }] } }] }) };
        return reply({ t: ["Mô hình nhận bức ảnh."] });
    }, cfgK);
    const r = await E.send(REQ);
    assert.deepEqual(r.translations, ["Mô hình nhận bức ảnh."]);
    assert.equal(caps.length, 2);
    assert.equal(caps[1], caps[0] * 2);
});

test("model Flash thế hệ 3 (không Lite): xin mức suy nghĩ THẤP (token suy nghĩ tính tiền như đầu ra); model không nhận thì tự bỏ", async () => {
    const bodies = [];
    const E = bgEnv(async (u, o) => {
        const b = JSON.parse(o.body);
        bodies.push(b);
        if (b.generationConfig.thinkingConfig && u.includes("3.9")) return gErr(400, "INVALID_ARGUMENT", "Thinking level is not supported for this model.");
        return reply({ t: ["Ổn."] });
    }, { ...cfgK, geminiModel: "gemini-3.8-flash" });
    await E.send(REQ);
    assert.equal(bodies[0].generationConfig.thinkingConfig.thinkingLevel, "low");
    const E2 = bgEnv(async (u, o) => { const b = JSON.parse(o.body); bodies.push(b); return b.generationConfig.thinkingConfig ? gErr(400, "INVALID_ARGUMENT", "Thinking level is not supported for this model.") : reply({ t: ["Ổn."] }); }, { ...cfgK, geminiModel: "gemini-3.9-flash" });
    const r = await E2.send(REQ);
    assert.equal(r.engine, "gemini");
    assert.equal(bodies[bodies.length - 1].generationConfig.thinkingConfig, undefined);
});

test("hai yêu cầu dịch GIỐNG HỆT nhau cùng lúc (luồng dịch trước + thời gian thực): chỉ gọi Gemini 1 lần", async () => {
    let gem = 0;
    const E = bgEnv(async () => { gem++; await new Promise(r => setTimeout(r, 20)); return reply({ t: ["Mô hình nhận bức ảnh."] }); }, cfgK);
    const [a, b] = await Promise.all([E.send(REQ), E.send(REQ)]);
    assert.deepEqual(a.translations, b.translations);
    assert.equal(gem, 1);
});

// 2.3.9: Settings counts the saved videos and the ones saved since the last quality review
test("cache stats: saved videos, their size, and how many are new since the review mark", async () => {
    const mark = Number(fs.readFileSync(path.join(__dirname, "../background.js"), "utf8").match(/const REVIEW_MARK = \{ until: (\d+), videos: (\d+) \}/)[1]);
    const local = {
        ytcache4_old: { luc: mark - 1000, cues: [], vi: [], g: [] },
        ytcache4_last: { luc: mark, cues: [], vi: [], g: [] },
        ytcache4_new1: { luc: mark + 1, cues: [], vi: [[0, 1, "xin chào"]], g: [] },
        ytcache4_new2: { luc: mark + 5000, cues: [], vi: [], g: [] },
        ytcache_legacy: { luc: mark + 9000 },
        ctxterms_yt_a: { luc: mark + 9000, v: 2, terms: [] }
    };
    const st = await bgEnv(async () => reply({ t: ["x"] }), cfgK, { local }).send({ action: "cacheStats" });
    assert.equal(st.ok, true);
    assert.equal(st.videos.count, 4);
    assert.equal(st.videos.fresh, 2, "the video the review ended on is not new");
    assert.equal(st.videos.max, 100);
    assert.equal(st.audio.maxBytes, 3 * 1024 ** 3, "the audio store holds 3 GB");
    assert.ok(st.videos.reviewed >= 21 && st.videos.until === mark);
    assert.ok(st.videos.bytes > 100 && st.videos.bytes < 1000);
    assert.equal(st.local.count, 6, "the older total still counts every cache key");
    const js = fs.readFileSync(path.join(__dirname, "../options.js"), "utf8"), html = fs.readFileSync(path.join(__dirname, "../options.html"), "utf8");
    assert.match(html, /id="cacheVideos"/);
    assert.match(html, /id="cacheReview"/);
    assert.match(js, /Video mới chưa rà soát: \$\{v\.fresh\} \/ \$\{v\.max\}/);
    // 2.4.1: one button removes the reviewed videos only; the new batch, the terms and the audio stay
    const E = bgEnv(async () => reply({ t: ["x"] }), cfgK, { local });
    const cleared = await E.send({ action: "cacheClear", which: "reviewed" });
    assert.equal(cleared.removed, 2);
    assert.equal(cleared.videos.count, 2);
    assert.equal(cleared.videos.fresh, 2);
    assert.deepEqual(Object.keys(local).sort(), ["ctxterms_yt_a", "ytcache4_new1", "ytcache4_new2", "ytcache_legacy"]);
    assert.match(html, /id="clearReviewedVideos">Xóa video đã rà soát</);
    assert.match(js, /which: "reviewed"/);
});

test("IndexedDB hỏng (mọi thao tác lỗi): vẫn dịch bằng API bình thường, không làm chết tiện ích", async () => {
    const broken = new Proxy({}, { get: () => async () => { throw new Error("QuotaExceededError"); } });
    let gem = 0;
    const E = bgEnv(async () => { gem++; return reply({ t: ["Mô hình nhận bức ảnh."] }); }, cfgK, { backend: broken });
    const r = await E.send(REQ);
    assert.equal(r.ok, true);
    assert.equal(r.engine, "gemini");
    const st = await E.send({ action: "cacheStats" });
    assert.equal(st.ok, true);
    const tts = await bgEnv(async () => ttsReply([1.1, 1.6]), cfgK, { backend: broken }).send(TTS_REQ);
    assert.equal(tts.ok, true, "lưu kho lỗi không được làm hỏng audio vừa tạo");
});

test("IndexedDB treo (không phản hồi): tra kho quá 1,5 giây thì bỏ qua và gọi API", async () => {
    const hanging = new Proxy({}, { get: () => () => new Promise(() => {}) });
    const E = bgEnv(async () => reply({ t: ["Mô hình nhận bức ảnh."] }), cfgK, { backend: hanging });
    const t0 = Date.now();
    const r = await E.send(REQ);
    assert.equal(r.engine, "gemini");
    assert.ok(Date.now() - t0 < 4000, `mất ${Date.now() - t0} ms`);
});

test("TTS: nhiều yêu cầu giống hệt nhau cùng lúc chỉ tạo audio MỘT lần; hủy của một bên không làm hỏng bên kia", async () => {
    let calls = 0;
    const E = bgEnv(async () => { calls++; await new Promise(r => setTimeout(r, 30)); return ttsReply([1.1, 1.6]); }, cfgK);
    const p1 = E.send({ ...TTS_REQ, jobId: "tab1" });
    const p2 = E.send({ ...TTS_REQ, jobId: "tab2" });
    await new Promise(r => setTimeout(r, 5));
    await E.send({ action: "ttsAbort", jobId: "tab1" });
    const [a, b] = await Promise.all([p1, p2]);
    assert.equal(calls, 1);
    assert.equal(b.ok, true, "tab 2 vẫn cần audio nên lượt chung không bị hủy");
    // 1.8.9: tab 1's own stop may land before its request is registered; it then gets "aborted"
    // itself (it asked to stop), otherwise the shared take. Either way one generation, tab 2 served
    assert.ok(a.ok || a.errorType === "aborted", a.errorType);
    assert.equal((await E.send(TTS_REQ)).fromCache, true);
    assert.equal(calls, 1);
});

test("TTS quá thời gian chờ: báo 'timeout' (không phải 'đã hủy'), KHÔNG tự gửi lại, không ghi kho", async () => {
    const backend = CACHE.memoryBackend();
    let calls = 0;
    const E = bgEnv((u, o) => { calls++; return new Promise((res, rej) => o.signal.addEventListener("abort", () => { const e = new Error("abort"); e.name = "AbortError"; rej(e); })); }, cfgK, { backend, fastTimeouts: true });
    const r = await E.send(TTS_REQ);
    assert.equal(r.ok, false);
    assert.equal(r.errorType, "timeout");
    assert.ok(!r.aborted);
    assert.equal(calls, 1);
    assert.equal((await backend.listMeta("audio")).length, 0);
});

test("TTS 429: tạm ngưng model, KHÔNG chuyển sang model TTS đắt hơn; 400 không thử lại, không ghi kho", async () => {
    const urls = [];
    const E = bgEnv(async u => { urls.push(u); return gErr(429, "RESOURCE_EXHAUSTED", "Quota exceeded for metric: generate_content_free_tier_requests, limit: 15"); }, cfgK);
    const r = await E.send(TTS_REQ);
    assert.equal(r.errorType, "rate_limit");
    const r2 = await E.send({ ...TTS_REQ, parts: [{ key: "x", weight: 1 }] });
    assert.equal(r2.errorType, "rate_limit");
    assert.equal(urls.length, 1);
    assert.ok(urls.every(u => /2\.5-flash-preview-tts/.test(u)));

    const backend = CACHE.memoryBackend();
    let n = 0;
    const E2 = bgEnv(async () => { n++; return gErr(400, "INVALID_ARGUMENT", "Invalid voice name"); }, cfgK, { backend });
    assert.equal((await E2.send(TTS_REQ)).errorType, "invalid");
    assert.equal(n, 1);
    assert.equal((await backend.listMeta("audio")).length, 0);
});

test("TTS model trả chữ thay vì audio: thử lại đúng 1 lần (theo tài liệu Gemini TTS)", async () => {
    let n = 0;
    const E = bgEnv(async () => { n++; return n === 1 ? { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "Xin chào" }] } }] }) } : ttsReply([1.1, 1.6]); }, cfgK);
    const r = await E.send(TTS_REQ);
    assert.equal(r.ok, true);
    assert.equal(n, 2);
});

// ================= 7. CHẾ ĐỘ TIẾT KIỆM & DÙNG LẠI AUDIO GIỮA CÁC VIDEO =================
function dubbingEnv(mode, msgs) {
    const noop = () => {};
    const voices = [{ name: "Linh", lang: "vi-VN", localService: true }];
    const sandbox = {
        console: { log: noop, warn: noop, error: console.error }, setTimeout, clearTimeout, setInterval: () => 1, clearInterval: noop,
        Promise, Map, Set, Math, JSON, Date, TextEncoder, crypto: globalThis.crypto, atob, btoa, alert: m => msgs.push({ alert: m }),
        performance: { now: () => Date.now() }, URL,
        location: { href: "https://www.youtube.com/watch?v=abc", pathname: "/watch" },
        document: { title: "t", querySelector: () => null, querySelectorAll: () => [] },
        speechSynthesis: { getVoices: () => voices, speak: noop, cancel: noop, addEventListener: noop },
        SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
        chrome: {
            storage: { sync: { get: async d => ({ ...d, geminiApiKey: "k", useAi: true, costMode: mode }) }, onChanged: { addListener: noop } },
            runtime: { lastError: null, sendMessage: (m, cb) => { msgs.push(m); cb({ ok: false }); } }
        }
    };
    sandbox.window = sandbox; sandbox.globalThis = sandbox;
    // Báo bằng thẻ nhỏ trên trình phát (không dùng hộp thoại chặn trang)
    sandbox.CST_UI = { toast: m => msgs.push({ alert: m }) };
    vm.createContext(sandbox);
    for (const f of ["cst-cache.js", "cost-policy.js", "vi-segmenter.js", "dub-planner.js", "dub-prosody.js", "dub-speech.js", "dub-audio.js", "dub-engine.js", "dubbing.js"]) vm.runInContext(read(f), sandbox);
    sandbox.CST_COST.PAID_TTS = true;   // 1.8.1: paid voice ships off; this suite tests its machinery
    return sandbox;
}

for (const [mode, expect] of [["economy", "system"], ["balanced", "gemini"], ["premium", "gemini"]]) {
    test(`chế độ ${mode}: lồng tiếng bằng ${expect === "system" ? "giọng hệ thống, KHÔNG BAO GIỜ gọi Gemini TTS" : "giọng Gemini AI"}`, async () => {
        const msgs = [];
        const env = dubbingEnv(mode, msgs);
        const video = new FakeVideo();
        video.play();
        const groups = lectureGroups();
        const ok = await env.CST_DUB.start({ video, getGroups: () => groups });
        assert.equal(ok, true);
        const eng = env.CST_DUB.dub.engine;
        assert.equal(eng.provider.id, expect);
        for (let i = 0; i < 30; i++) { video.currentTime += 0.5; eng.tick(); await new Promise(r => setImmediate(r)); }
        const tts = msgs.filter(m => m.action === "synthesizeSpeech" || m.action === "condenseSpeech");
        if (expect === "system") assert.equal(tts.length, 0, "Tiết kiệm không được gọi Gemini TTS / rút gọn");
        else {
            // The engine answers through timers and promises: under a slow runner the 30 ticks above can
            // end before its first cache lookup is posted. Wait for it, up to 2 s, instead of a fixed count
            const asked = () => msgs.some(m => m.action === "audioCacheGet" || m.action === "synthesizeSpeech");
            for (let i = 0; i < 200 && !asked(); i++) await new Promise(r => setTimeout(r, 10));
            assert.ok(asked());
        }
        env.CST_DUB.stop();
    });
}

test("chế độ Chỉ phụ đề: không bật lồng tiếng, báo bằng thẻ nhỏ (KHÔNG hộp thoại chặn trang)", async () => {
    const msgs = [];
    const env = dubbingEnv("subtitles", msgs);
    assert.equal(await env.CST_DUB.start({ video: new FakeVideo(), getGroups: () => lectureGroups() }), false);
    assert.ok(msgs.some(m => m.alert));
    assert.equal(msgs.filter(m => m.action).length, 0);
});

test("a dubbing start that gives up (Chỉ phụ đề mode, an error) hands back dub.starting, so a later auto-dub is not skipped", async () => {
    const env = dubbingEnv("subtitles", []);
    assert.equal(await env.CST_DUB.start({ video: new FakeVideo(), getGroups: () => lectureGroups() }), false);
    assert.equal(env.CST_DUB.dub.starting, false, "ytTuBatLongTieng would skip every later video");
    const env2 = dubbingEnv("balanced", []);
    env2.CST_DUB_ENGINE.DubEngine = function () { throw new Error("boom"); };
    await assert.rejects(env2.CST_DUB.start({ video: new FakeVideo(), getGroups: () => lectureGroups() }));
    assert.equal(env2.CST_DUB.dub.starting, false);
});

test("cùng câu dịch ở VIDEO KHÁC (mốc thời gian khác), cùng giọng & kiểu đọc: dùng lại audio, 0 lượt TTS", async () => {
    const E = require("../dub-engine.js");
    const real = E.createGeminiProvider({ sendMessage: async () => ({ ok: false }) }, { geminiVoice: "Kore" });
    const store = audioStore();
    const provA = geminiFake();
    provA.audioKey = real.audioKey;
    const A = await dubRun({ store, provider: provA });
    A.video.play();
    await A.run(30000);
    A.eng.stop();
    assert.ok(provA.calls.length > 0);
    // Video khác: cùng lời thoại nhưng lùi mốc thời gian 200 giây
    const shifted = A.groups.map(g => ({ ...g, start: g.start + 200, end: g.end + 200, srcCues: g.srcCues.map(c => ({ ...c, start: c.start + 200, end: c.end + 200, words: undefined })), viCues: g.viCues.map(c => ({ ...c, start: c.start + 200, end: c.end + 200 })) }));
    const provB = geminiFake();
    provB.audioKey = real.audioKey;
    const B = await dubRun({ store, provider: provB, groups: shifted });
    B.video.seek(200);
    B.video.play();
    await B.run(14000);
    assert.equal(provB.calls.length, 0, `video khác vẫn gọi TTS ${provB.calls.length} lượt`);
    assert.ok(B.eng.stats.cacheHits > 0);
});

test("tua đi khi lượt TTS đã chạy gần xong: KHÔNG hủy (đã tốn tiền), vị trí mới vẫn được tạo ngay; audio cũ vào kho; tối đa 3 lượt cùng lúc", async () => {
    const pendingRenders = [];
    const prov = geminiFake();
    const base = prov.render.bind(prov);
    prov.render = (plans, ctx) => new Promise((resolve, reject) => {
        prov.calls.push(plans.map(p => p.id));
        pendingRenders.push({ plans, ctx, resolve: () => resolve(plans.map(p => ({ planId: p.id, wav: new Uint8Array(8), duration: naturalDuration(p, prov.voiceModel), sampleRate: 24000 }))), reject });
    });
    prov.abort = jobId => { prov.aborted.push(jobId); const r = pendingRenders.find(x => x.ctx.jobId === jobId); if (r) { const e = new Error("hủy"); e.aborted = true; r.reject(e); } };
    void base;
    const store = audioStore();
    const S = await dubRun({ store, provider: prov });
    // Lượt đầu nhỏ (1 câu) + tối đa 1 lượt bắt kịp chạy song song
    const startCalls = prov.calls.length;
    assert.ok(startCalls >= 1 && startCalls <= 2, `bắt đầu với ${startCalls} lượt`);
    // Lượt đầu nhỏ để có tiếng sớm: một câu, hoặc vài câu ngắn trong trần âm tiết của lượt đầu
    const firstSyl = prov.calls[0].map(id => S.eng.planById.get(id)).reduce((a, p) => a + p.phrases.reduce((b, ph) => b + ph.syl, 0), 0);
    assert.ok(prov.calls[0].length === 1 || firstSyl <= DubEngineSYNC.firstBatchSyl, `lượt đầu ${firstSyl} âm tiết`);
    S.eng.renderLatency = 1;                 // lượt TTS thường mất ~1 giây
    let maxJobs = 0;
    const watch = async ms => { for (let t = 0; t < ms; t += 100) { await S.run(100); maxJobs = Math.max(maxJobs, S.eng.jobs.size); } };
    await watch(1200);                        // lượt đầu đã chạy 1,2 giây (> 60% thường lệ)
    S.video.seek(90);                         // bài giảng mô phỏng dài ~125 giây
    await watch(400);
    assert.equal(prov.aborted.length, 0, "lượt gần xong không được hủy");
    assert.equal(prov.calls.length, startCalls + 1, "vị trí mới phải được tạo audio ngay, không chờ lượt cũ");
    // Tua tiếp ngay: lượt thứ hai vừa gửi -> hủy để nhường chỗ
    S.video.seek(40);
    await watch(400);
    assert.equal(prov.aborted.length, 1);
    assert.ok(maxJobs <= 3, `có ${maxJobs} lượt TTS cùng lúc`);
    // Lượt đầu về: audio được giữ (kho + RAM), dùng được khi quay lại
    const firstIds = pendingRenders[0].plans.map(p => p.id);
    pendingRenders[0].resolve();
    await watch(300);
    assert.ok(firstIds.every(id => S.eng.rendered.has(id)));
    assert.ok(store.puts >= firstIds.length);
});

// ================= 8. DANH MỤC MODEL: GEMINI 2.5 FLASH-LITE =================
const modelOf = u => (u.match(/models\/([^:]+):generateContent/) || [])[1];
// Máy chủ giả trả bản dịch MANG TÊN model đã tạo ra nó -> phát hiện dùng nhầm cache
const byModel = (seen, missing = []) => async u => {
    if (!u.includes("generativelanguage")) return GOOGLE_OK;
    const m = modelOf(u);
    seen.push(m);
    if (missing.includes(m)) return gErr(404, "NOT_FOUND", `models/${m} is not found for API version v1beta, or is not supported for generateContent.`);
    return reply({ t: [`bản của ${m}`] });
};

test("danh mục: 2.5 Flash-Lite có trong danh sách, rẻ nhất nhưng CHỈ cho key có quyền; mặc định = Tự động (rẻ nhất key gọi được)", () => {
    const ids = COST.TRANSLATION_MODELS.map(m => m.id);
    assert.ok(ids.includes("gemini-2.5-flash-lite"));
    assert.equal(COST.findModel("gemini-2.5-flash-lite").access, "restricted");
    assert.equal(COST.DEFAULT_MODELS.cheap, "auto");
    assert.equal(COST.AUTO_CANDIDATES[0], "gemini-2.5-flash-lite");
    assert.equal(COST.modelLabel("gemini-2.5-flash-lite"), "Gemini 2.5 Flash-Lite");
    assert.equal(Math.min(...COST.TRANSLATION_MODELS.map(m => m.costRank)), COST.costRank("gemini-2.5-flash-lite"));
    assert.ok(COST.costRank(COST.DEFAULT_MODELS.strong) > COST.costRank(COST.AUTO_CANDIDATES[0]));
    assert.equal(COST.findModel("gemini-3.1-flash-lite").shutdown, "2027-05-07");
    assert.equal(COST.findModel("gemini-3.1-flash-lite").replacement, "gemini-3.5-flash-lite");
    assert.equal(COST.thinkingLevelFor("gemini-2.5-flash-lite"), null, "2.5 Flash-Lite không gửi cấu hình suy nghĩ");
    for (const id of Object.keys(COST.RETIRED_MODELS)) assert.ok(!ids.includes(id), "model đã tắt không được có trong danh sách");
});

test("danh mục tập trung: không file nào ngoài cost-policy.js ghi cứng tên model Gemini", () => {
    const files = ["background.js", "content.js", "youtube.js", "dubbing.js", "dub-engine.js", "dub-planner.js", "context-engine.js", "options.js", "options.html", "popup.js", "popup.html"];
    for (const f of files) {
        const hits = read(f).match(/gemini-\d[\w.-]*/g) || [];
        assert.deepEqual(hits, [], `${f} còn ghi cứng: ${hits.join(", ")}`);
    }
});

test("chọn 2.5 -> yêu cầu thật gửi tới models/gemini-2.5-flash-lite; chọn 3.1 -> gửi 3.1 (lựa chọn có tác dụng thật)", async () => {
    for (const id of ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"]) {
        const seen = [];
        const r = await bgEnv(byModel(seen), { ...cfgK, geminiModel: id, modelsVersion: COST.MODELS_VERSION }).send(REQ);
        assert.deepEqual(seen, [id]);
        assert.equal(r.model, id);
        assert.deepEqual(r.translations, [`bản của ${id}`]);
    }
});

test("bộ nhớ đệm tách theo model: 2.5 và 3.1 không bao giờ dùng nhầm bản của nhau; quay lại 2.5 thì trúng cache của 2.5", async () => {
    const backend = CACHE.memoryBackend();
    const seen = [];
    const env = id => bgEnv(byModel(seen), { ...cfgK, geminiModel: id, modelsVersion: COST.MODELS_VERSION }, { backend });
    const a = await env("gemini-2.5-flash-lite").send(REQ);
    const b = await env("gemini-3.1-flash-lite").send(REQ);
    const c = await env("gemini-2.5-flash-lite").send(REQ);
    const d = await env("gemini-3.1-flash-lite").send(REQ);
    assert.deepEqual(a.translations, ["bản của gemini-2.5-flash-lite"]);
    assert.deepEqual(b.translations, ["bản của gemini-3.1-flash-lite"], "3.1 dùng nhầm bản dịch của 2.5");
    assert.equal(c.fromCache, true);
    assert.deepEqual(c.translations, ["bản của gemini-2.5-flash-lite"]);
    assert.equal(d.fromCache, true);
    assert.deepEqual(d.translations, ["bản của gemini-3.1-flash-lite"]);
    assert.deepEqual(seen, ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"]);
    assert.notEqual(a.cacheKey, b.cacheKey);
});

test("2.5 không dùng được (404), chế độ Cân bằng: lùi sang model rẻ kế tiếp (3.1), báo rõ, không lên model đắt nhất; lần sau trúng cache, không gọi lại 2.5", async () => {
    const backend = CACHE.memoryBackend();
    const seen = [];
    const E = bgEnv(byModel(seen, ["gemini-2.5-flash-lite"]), { ...cfgK, geminiModel: "gemini-2.5-flash-lite", costMode: "balanced", modelsVersion: COST.MODELS_VERSION }, { backend });
    const r = await E.send(REQ);
    assert.equal(r.model, "gemini-3.1-flash-lite");
    assert.equal(r.fallbackFrom, "gemini-2.5-flash-lite");
    assert.deepEqual(seen, ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"]);
    const r2 = await E.send(REQ);
    assert.equal(r2.fromCache, true);
    assert.deepEqual(seen, ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"], "không gọi lại 2.5 đã biết là không có");
    const r3 = await E.send({ ...REQ, sentences: ["New sentence."] });
    assert.equal(r3.model, "gemini-3.1-flash-lite");
    assert.ok(!seen.includes("gemini-3.8-flash"));
    // Cả chuỗi (trừ model nâng cấp đã chấp nhận) đều hỏng -> Google, không bao giờ lên 3.8 Flash
    const seen2 = [];
    const E2 = bgEnv(byModel(seen2, ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]), { ...cfgK, costMode: "balanced", modelsVersion: COST.MODELS_VERSION });
    assert.equal((await E2.send(REQ)).engine, "google_fallback");
    assert.deepEqual(seen2, ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]);
});

test("2.5 không dùng được, chế độ Tiết kiệm: lùi sang 3.1 (model Gemini rẻ nhất còn gọi được), KHÔNG lên 3.5, không rơi xuống Google", async () => {
    const seen = [];
    const E = bgEnv(byModel(seen, ["gemini-2.5-flash-lite"]), { ...cfgK, geminiModel: "gemini-2.5-flash-lite", costMode: "economy", modelsVersion: COST.MODELS_VERSION });
    const r = await E.send(REQ);
    assert.equal(r.engine, "gemini");
    assert.equal(r.model, "gemini-3.1-flash-lite");
    assert.deepEqual(seen, ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"]);
    // Key chỉ gọi được 3.5: Tiết kiệm dùng 3.5 (rẻ nhất key gọi được), KHÔNG BAO GIỜ 3.8 Flash
    const seen2 = [];
    const r2 = await bgEnv(byModel(seen2, ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"]), { ...cfgK, costMode: "economy", modelsVersion: COST.MODELS_VERSION }).send(REQ);
    assert.equal(r2.model, "gemini-3.5-flash-lite");
    const seen4 = [];
    const r4 = await bgEnv(byModel(seen4, ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]), { ...cfgK, costMode: "economy", modelsVersion: COST.MODELS_VERSION }).send(REQ);
    assert.equal(r4.engine, "google_fallback");
    assert.ok(!seen4.includes("gemini-3.8-flash"));
    // Tiết kiệm + người dùng chọn 3.1: 3.1 hỏng thì chỉ được lùi xuống model RẺ HƠN (2.5)
    const seen3 = [];
    const r3 = await bgEnv(byModel(seen3, ["gemini-3.1-flash-lite"]), { ...cfgK, geminiModel: "gemini-3.1-flash-lite", costMode: "economy", modelsVersion: COST.MODELS_VERSION }).send(REQ);
    assert.equal(r3.model, "gemini-2.5-flash-lite");
    assert.deepEqual(seen3, ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]);
});

test("chế độ Tiết kiệm tôn trọng lựa chọn: câu khó vẫn gửi đúng model đã chọn, không tự nâng cấp", async () => {
    const msgs = [];
    const env = contentEnv(m => { msgs.push(m); return { ok: true, engine: "gemini", model: "x", translations: ["Hóa ra mọi chuyện phụ thuộc vào việc họ có tự tìm ra hay không."] }; }, "economy");
    await ready(env);
    env.__s = mkSession(env, ["It turns out that, at the end of the day, this boils down to whether they can figure it out, which is rarely the case."]);
    await vm.runInContext("translateWindow(__s, [0], { realtime: false })", env);
    assert.deepEqual(msgs.map(m => m.tier), ["cheap"]);
    const seen = [];
    await bgEnv(byModel(seen), { ...cfgK, geminiModel: "gemini-2.5-flash-lite", costMode: "economy", modelsVersion: COST.MODELS_VERSION }).send({ ...REQ, tier: "cheap" });
    assert.deepEqual(seen, ["gemini-2.5-flash-lite"]);
});

// 1.8.8: a page lookup of several keys on a wedged IndexedDB. Each read waits up to 1.5 s; read one
// after another, 8 keys held the dubbing scheduler 12 s. Read together: one 1.5 s wait.
test("audio store lookup: keys are read together, a wedged store costs one read timeout, bad keys are ignored", async () => {
    const hanging = new Proxy({}, { get: () => () => new Promise(() => {}) });
    const E = bgEnv(async () => ({ ok: true, status: 200, json: async () => ({}) }), cfgK, { backend: hanging });
    const t0 = Date.now();
    const r = await E.send({ action: "audioCacheGet", keys: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", null, 42, "", "x".repeat(300)] });
    const ms = Date.now() - t0;
    assert.equal(r.ok, true);
    assert.equal(Object.keys(r.hits).length, 0);
    assert.ok(ms < 3500, `lookup took ${ms} ms`);
});

test("audio store delete: a non-array is refused, bad and repeated keys are dropped before IndexedDB", async () => {
    const E = bgEnv(async () => ({ ok: true, status: 200, json: async () => ({}) }), cfgK);
    const bad = await E.send({ action: "audioCacheDelete", keys: "k1" });
    assert.equal(bad.errorType, "invalid");
    const r = await E.send({ action: "audioCacheDelete", keys: ["a", "a", 7, "", "x".repeat(300), null, "b"] });
    assert.equal(r.ok, true);
});

// BACKLOG 12 (1.9.4): every full scan of the store's meta records is a cursor over the whole
// IndexedDB store. An eviction scanned twice (once to pick victims, once more for the totals it had
// just computed), and removing one video's audio threw the totals away, so the next write scanned
// again. Totals now follow from what was scanned.
test("audio store: an eviction or a video delete scans the meta records once, and totals stay right", async () => {
    const backend = CACHE.memoryBackend();
    let scans = 0;
    const list = backend.listMeta.bind(backend);
    backend.listMeta = s => { scans++; return list(s); };
    const au = new CACHE.TieredCache(backend, "audio", { version: 1, maxBytes: 100000 });
    for (let i = 0; i < 12; i++) await au.set("a" + i, { wav: new Uint8Array(10000) });
    const truth = async () => { const l = await list("audio"); return { bytes: l.reduce((a, m) => a + m.size, 0), count: l.length }; };
    scans = 0;
    await au.set("a12", { wav: new Uint8Array(10000) });          // over the cap: evicts
    assert.ok(au.stats.evicted > 0);
    assert.equal(scans, 1, `${scans} scans for one eviction`);
    assert.deepEqual(au.totals, await truth());
    scans = 0;
    await au.remove(["a12", "a11", "nope"]);
    await au.set("b0", { wav: new Uint8Array(100) });
    assert.equal(scans, 1, `${scans} scans for a delete then a write`);
    assert.deepEqual(au.totals, await truth());
});
