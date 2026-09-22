// Kiểm thử tích hợp: chạy content.js và background.js THẬT trong môi trường
// giả lập (chrome API, DOM tối thiểu, Gemini giả) để kiểm chứng luồng dịch.
// Chạy: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---------------- Môi trường content script ----------------
function makeContentEnv(onTranslate, opts = {}) {
    const listeners = [];
    const noop = () => {};
    const sandbox = {
        console: { log: noop, warn: noop, error: console.error },
        setTimeout, clearTimeout,
        setInterval: () => 0, clearInterval: noop,
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number,
        location: { href: "https://www.youtube.com/watch?v=test", hostname: "www.youtube.com", pathname: "/watch" },
        document: {
            readyState: "complete",
            title: "Test video - YouTube",
            body: {},
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            getElementsByTagName: () => [],
            createElement: () => ({ style: {}, appendChild: noop, addEventListener: noop }),
            head: { appendChild: noop },
            documentElement: { appendChild: noop },
            addEventListener: noop
        },
        addEventListener: noop,
        postMessage: noop,
        MutationObserver: class { observe() {} disconnect() {} },
        alert: noop,
        chrome: {
            storage: {
                sync: { get: async d => (typeof d === "object" && !Array.isArray(d) ? { ...d } : {}), set: async () => {} },
                local: { get: async () => ({}), set: async () => {}, remove: async () => {} },
                onChanged: { addListener: noop }
            },
            runtime: {
                lastError: null,
                onMessage: { addListener: fn => listeners.push(fn) },
                sendMessage: (msg, cb) => {
                    Promise.resolve(onTranslate(msg)).then(r => cb(r));
                }
            }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    const files = ["glossary.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js"];
    if (opts.youtube) files.push("youtube.js");
    for (const f of files) vm.runInContext(read(f), sandbox, { filename: f });
    return sandbox;
}

async function withGlossary(env) {
    // loadSettings() là async trong init(): chờ cho từ điển được nạp
    for (let i = 0; i < 50 && !env.state?.reExact; i++) await new Promise(r => setTimeout(r, 5));
    vm.runInContext("state.glossaryEnabled = true;", env);
}

// Gemini giả: trả lời theo hàm answer(msg) -> mảng bản dịch
function fakeGemini(answer, extra = {}) {
    const calls = [];
    const fn = msg => {
        calls.push(JSON.parse(JSON.stringify(msg)));
        const out = answer(msg, calls.length);
        return { ok: true, engine: "gemini", model: "fake", latency: 1, terms: [], note: "", ...extra, ...(Array.isArray(out) ? { translations: out } : out) };
    };
    fn.calls = calls;
    return fn;
}

function session(env, meta, units) {
    env.__meta = meta; env.__units = units;
    return vm.runInContext("(() => { const s = new CST_CONTEXT.ContextSession(__meta); s.setUnits(__units); return s; })()", env);
}

test("content: bản dịch không có thuật ngữ mà mô hình tự bịa [[__T0__]] thì bị lọc (lỗi ảnh 1.0.4)", async () => {
    const gem = fakeGemini(() => ["[[__T0__]]Nhưng với cá nhân tôi,"]);
    const env = makeContentEnv(gem);
    await withGlossary(env);
    env.__s = session(env, {}, ["But for me personally,"]);
    const r = await vm.runInContext("translateWindow(__s, [0])", env);
    assert.equal(r.translations[0], "Nhưng với cá nhân tôi,");
});

test("content: thuật ngữ được bảo vệ KÈM bảng giải nghĩa mã, khôi phục đúng, mã bịa bị xóa", async () => {
    const gem = fakeGemini(msg => {
        const ids = [...msg.sentences[0].matchAll(/\[\[__T(\d+)__\]\]/g)].map(m => m[1]);
        return [`Chúng ta sẽ dùng [[__T${ids[0]}__]] để huấn luyện [[__T7__]] mô hình.`];
    });
    const env = makeContentEnv(gem);
    await withGlossary(env);
    env.__s = session(env, {}, ["We will use PyTorch to train the model."]);
    const r = await vm.runInContext("translateWindow(__s, [0])", env);
    assert.equal(r.translations[0], "Chúng ta sẽ dùng PyTorch để huấn luyện mô hình.");
    // Mô hình được biết mã giữ chỗ là "PyTorch" (trước đây chỉ thấy mã trống nghĩa)
    assert.ok(gem.calls[0].placeholders.some(p => p.term === "PyTorch"), JSON.stringify(gem.calls[0].placeholders));
});

test("ngữ cảnh: câu có đại từ 'It' được gửi kèm câu trước, bản dịch câu trước, chủ đề và lĩnh vực", async () => {
    const gem = fakeGemini((msg, n) => (n === 1 ? { translations: ["Mô hình nhận vào bức ảnh."] } : ["Sau đó, mô hình xử lý ảnh qua nhiều lớp."]));
    const env = makeContentEnv(gem);
    await withGlossary(env);
    env.__s = session(env, { title: "Convolutional Neural Networks", channel: "DeepLearning.AI" },
        ["The model receives the image.", "It then processes it through several layers.", "Each layer extracts features."]);
    await vm.runInContext("translateWindow(__s, [0])", env);
    await vm.runInContext("translateWindow(__s, [1])", env);
    const ctx = gem.calls[1].context;
    assert.deepEqual(gem.calls[1].sentences, ["It then processes it through several layers."]);
    assert.match(ctx.prevSource, /The model receives the image/);
    assert.match(ctx.prevTranslation, /Mô hình nhận vào bức ảnh/);
    assert.match(ctx.topic, /Convolutional Neural Networks/);
    assert.match(ctx.domain, /học máy/);
    assert.match(ctx.nextSource, /Each layer extracts features/);
});

test("thuật ngữ mô hình chọn ở câu trước được gửi lại ở câu sau (nhất quán)", async () => {
    const gem = fakeGemini((msg, n) => (n === 1
        ? { translations: ["Hãy cùng xem xét lượt truyền xuôi."], terms: [{ en: "forward pass", vi: "lượt truyền xuôi" }] }
        : ["Lượt truyền xuôi tính đầu ra của mạng."]));
    const env = makeContentEnv(gem);
    await withGlossary(env);
    env.__s = session(env, { title: "Deep Learning" }, ["Let's examine the forward pass.", "The forward pass computes the output of the network."]);
    await vm.runInContext("translateWindow(__s, [0])", env);
    await vm.runInContext("translateWindow(__s, [1])", env);
    assert.deepEqual(gem.calls[1].context.terms, [{ en: "forward pass", vi: "lượt truyền xuôi" }]);
});

test("dịch máy bị phát hiện -> tự dịch lại kèm danh sách vấn đề, nhận bản tốt hơn", async () => {
    const gem = fakeGemini((msg, n) => (n === 1 ? ["Nó là quan trọng để chuẩn hóa các đầu vào."] : ["Điều quan trọng là phải chuẩn hóa dữ liệu đầu vào."]));
    const env = makeContentEnv(gem);
    await withGlossary(env);
    env.__s = session(env, { title: "ML" }, ["It is important to normalize the inputs."]);
    const r = await vm.runInContext("translateWindow(__s, [0], { realtime: false })", env);
    assert.equal(gem.calls.length, 2);
    assert.ok(gem.calls[1].refine && gem.calls[1].refine.issues.some(i => /It is/.test(i)), JSON.stringify(gem.calls[1].refine));
    assert.deepEqual(gem.calls[1].refine.draft, ["Nó là quan trọng để chuẩn hóa các đầu vào."]);
    assert.equal(r.translations[0], "Điều quan trọng là phải chuẩn hóa dữ liệu đầu vào.");
    assert.equal(r.refined, true);
});

test("dịch lại mà không tốt hơn thì giữ bản đầu (không bao giờ làm tệ đi)", async () => {
    const gem = fakeGemini(() => ["Nó là quan trọng để chuẩn hóa các đầu vào."]);
    const env = makeContentEnv(gem);
    await withGlossary(env);
    env.__s = session(env, {}, ["It is important to normalize the inputs."]);
    const r = await vm.runInContext("translateWindow(__s, [0], { realtime: false })", env);
    assert.equal(gem.calls.length, 2);
    assert.equal(r.refined, undefined);
});

test("thời gian thực: hiện bản đầu ngay, bản dịch lại chạy nền rồi thay thế", async () => {
    const gem = fakeGemini((msg, n) => (n === 1 ? ["Hãy để chúng ta lấy một cái nhìn vào kết quả."] : ["Hãy cùng xem qua kết quả."]));
    const env = makeContentEnv(gem);
    await withGlossary(env);
    env.__s = session(env, {}, ["Let's take a look at the results."]);
    let refined = null;
    env.__onRefined = r => { refined = r; };
    const first = await vm.runInContext("translateWindow(__s, [0], { realtime: true, onRefined: __onRefined })", env);
    assert.equal(first.translations[0], "Hãy để chúng ta lấy một cái nhìn vào kết quả.");
    for (let i = 0; i < 40 && !refined; i++) await new Promise(r => setTimeout(r, 5));
    assert.ok(refined, "chưa nhận bản dịch lại");
    assert.equal(refined.translations[0], "Hãy cùng xem qua kết quả.");
});

test("không bắt Gemini chèn dấu ngắt nghỉ ¦: ngắt dòng / ngắt nghỉ do engine tiếng Việt cục bộ", async () => {
    const gem = fakeGemini(() => ["Nếu tốc độ học quá lớn, thuật toán có thể không hội tụ và mất rất nhiều thời gian huấn luyện."]);
    const env = makeContentEnv(gem);
    await withGlossary(env);
    env.__s = session(env, {}, ["If the learning rate is too large, the algorithm may not converge and training takes a long time."]);
    const r = await vm.runInContext("translateWindow(__s, [0])", env);
    assert.equal(gem.calls[0].hints, undefined, "không còn yêu cầu dấu gợi ý");
    assert.ok(!r.translations[0].includes("¦"));
    env.__g = { start: 0, end: 5, srcCues: [{ start: 0, end: 5, text: "If the learning rate is too large, the algorithm may not converge and training takes a long time." }] };
    env.__vi = r.translations[0];
    const segs = vm.runInContext("segmentGroupVi(__g, __vi)", env);
    const lines = segs.flatMap(x => x.lines);
    assert.ok(lines.length >= 2);
    assert.ok(!/tốc \| độ|hội \| tụ|huấn \| luyện/.test(lines.join(" | ")), lines.join(" | "));
});

test("Coursera: dịch theo cửa sổ nhiều nhóm liền mạch, kết thúc cửa sổ ở cuối câu", async () => {
    const gem = fakeGemini(msg => msg.sentences.map(s => "VI: " + s));
    const env = makeContentEnv(gem);
    await withGlossary(env);
    const texts = [];
    for (let i = 0; i < 30; i++) texts.push(i % 3 === 2 ? `sentence part ${i} ends here with enough words.` : `this is part ${i} of a longer sentence that continues`);
    env.__groups = texts.map(t => ({ text: t }));
    env.__s = session(env, { title: "Lecture" }, texts);
    const res = await vm.runInContext("translateAllGroups(__s, __groups)", env);
    assert.equal(res.length, 30);
    assert.ok(res.every((r, i) => r === "VI: " + texts[i]));
    assert.ok(gem.calls.length >= 2 && gem.calls.length <= 8, String(gem.calls.length));
    for (const c of gem.calls.slice(0, -1)) {
        assert.ok(/\.$/.test(c.sentences[c.sentences.length - 1]) || c.sentences.join(" ").length >= 1100, c.sentences.slice(-1)[0]);
    }
});

test("YouTube: nhóm chưa hết câu được dịch CHUNG với nhóm kế (không dịch mảnh câu độc lập)", async () => {
    const env = makeContentEnv(() => ({ ok: true, translations: [] }), { youtube: true });
    await withGlossary(env);
    env.__g = [
        { text: "because we need to", translated: false },
        { text: "understand how the model works.", translated: false },
        { text: "Next topic.", translated: false }
    ];
    const idx = vm.runInContext("yt.groups = __g; yt.inFlightGroups.clear(); ytChonCuaSo(0)", env);
    assert.deepEqual([...idx], [0, 1]);
    // Bắt đầu từ mảnh sau: lùi lại lấy mảnh trước
    const idx2 = vm.runInContext("ytChonCuaSo(1)", env);
    assert.deepEqual([...idx2], [0, 1]);
});

test("YouTube -> lồng tiếng: dùng CHÍNH bản dịch có ngữ cảnh của nhóm câu (không dịch lại từng phụ đề)", async () => {
    const gem = fakeGemini(msg => msg.sentences.map(() => "Bây giờ, ¦ điều chúng ta cần hiểu là cách mô hình xử lý dữ liệu."));
    const env = makeContentEnv(gem, { youtube: true });
    await withGlossary(env);
    env.__g = [{ text: "Now, what we need to understand is how the model processes data.", start: 0, end: 4, srcCues: [{ start: 0, end: 4, text: "Now, what we need to understand is how the model processes data." }], translated: false }];
    vm.runInContext("yt.groups = __g; yt.inFlightGroups.clear(); yt.huyDich = false; yt.session = (() => { const s = new CST_CONTEXT.ContextSession({}); s.setUnits(__g.map(g => g.text)); return s; })();", env);
    const ok = await vm.runInContext("ytDichNhom(0)", env);
    assert.equal(ok, true);
    const groups = vm.runInContext("ytNhomLongTieng()", env);
    assert.equal(groups[0].viText, "Bây giờ, ¦ điều chúng ta cần hiểu là cách mô hình xử lý dữ liệu.", "lồng tiếng phải nhận bản dịch còn dấu ngắt nghỉ");
    assert.ok(groups[0].viCues.length >= 1 && groups[0].srcCues.length === 1);
    // Tạo kịch bản lồng tiếng từ đúng nguồn này: không có lượt dịch thêm nào
    const before = gem.calls.length;
    env.__P = require("../dub-planner.js");
    const script = vm.runInContext("__P.buildDubScript(ytNhomLongTieng())", env);
    assert.equal(script.length, 1);
    assert.equal(gem.calls.length, before);
});

test("ví dụ của Đàm: 3 cue một ý được gom thành MỘT đơn vị dịch", () => {
    const env = makeContentEnv(() => ({}));
    env.__c = [
        { start: 0, end: 2.2, text: "Now that we have set up our environment," },
        { start: 2.2, end: 4.0, text: "let us examine the forward pass" },
        { start: 4.0, end: 6.4, text: "of this two-layer convolutional neural network." }
    ];
    const groups = vm.runInContext("groupCuesIntoSentences(__c, false)", env);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].text, "Now that we have set up our environment, let us examine the forward pass of this two-layer convolutional neural network.");
});

// ---------------- Gom cue thành câu ----------------
test("gom nhóm: theo câu trọn vẹn, không cắt cứng ở 3 cue như bản cũ", () => {
    const env = makeContentEnv(() => ({}));
    const cues = [
        { start: 0, end: 1.5, text: "So in practice, when you train" },
        { start: 1.5, end: 3, text: "a deep network, you usually start" },
        { start: 3, end: 4.5, text: "with a small learning rate" },
        { start: 4.5, end: 6, text: "and increase it slowly." },
        { start: 6, end: 7, text: "Okay." }
    ];
    env.__c = cues;
    const groups = vm.runInContext(`groupCuesIntoSentences(__c, false)`, env);
    assert.equal(groups.length, 2);
    assert.deepEqual([...groups[0].cueIndexes], [0, 1, 2, 3]);
    assert.equal(groups[0].start, 0);
    assert.equal(groups[0].end, 6);
    assert.equal(groups[0].srcCues.length, 4);
});

test("gom nhóm: phụ đề tự động không dấu câu được cắt ở khoảng lặng", () => {
    const env = makeContentEnv(() => ({}));
    const cues = [];
    let t = 0;
    for (let i = 0; i < 14; i++) {
        cues.push({ start: t, end: t + 2, text: "this is some automatically generated caption text" });
        t += 2 + (i === 5 ? 0.6 : 0.05);
    }
    env.__c = cues;
    const groups = vm.runInContext(`groupCuesIntoSentences(__c, false)`, env);
    assert.ok(groups.length >= 2, String(groups.length));
    for (const g of groups) {
        assert.ok(g.text.length <= 520, String(g.text.length));
        assert.ok(g.cueIndexes.length <= 12);
    }
    // Nhóm đầu kết thúc đúng ở khoảng lặng 0,6 giây sau cue thứ 6
    assert.deepEqual([...groups[0].cueIndexes], [0, 1, 2, 3, 4, 5]);
});

test("gom nhóm: khoảng lặng dài tách ý, không gộp hai câu khác nhau", () => {
    const env = makeContentEnv(() => ({}));
    env.__c = [{ start: 0, end: 2, text: "and that is the end of" }, { start: 5, end: 7, text: "the next topic is here" }];
    const groups = vm.runInContext(`groupCuesIntoSentences(__c, false)`, env);
    assert.equal(groups.length, 2);
});

// ---------------- Coursera: thay cue trong track ----------------
test("Coursera: cue tiếng Việt thay cue gốc, số cue không bị ép theo tiếng Anh, tắt dịch thì khôi phục", () => {
    const env = makeContentEnv(() => ({}));
    class FakeCue { constructor(s, e, t) { this.startTime = s; this.endTime = e; this.text = t; this.line = "auto"; this.id = ""; } }
    env.VTTCue = FakeCue;
    const track = {
        cues: [],
        addCue(c) { this.cues.push(c); this.cues.sort((a, b) => a.startTime - b.startTime); },
        removeCue(c) { this.cues = this.cues.filter(x => x !== c); }
    };
    const originals = [
        new FakeCue(0, 1.8, "Let's take a look at"),
        new FakeCue(1.8, 4.6, "convolutional neural networks with two layers.")
    ];
    originals.forEach(c => track.addCue(c));
    env.__t = track;
    env.__o = originals;
    vm.runInContext(`
        state.originalCues = __o;
        state.originalCueTexts = new Map(__o.map((c, i) => [i, c.text]));
        state.originalCueLines = new Map(__o.map((c, i) => [i, c.line]));
        state.activeTrack = { track: __t };
        state.dualMode = false;
        const groups = groupCuesIntoSentences(__o, false);
        applyTranslation(__t, groups, ["Chúng ta hãy xem xét mạng nơ-ron tích chập hai lớp."]);
    `, env);
    assert.equal(track.cues.length, 1, track.cues.map(c => c.text).join(" | "));
    assert.equal(track.cues[0].text, "Chúng ta hãy xem xét\nmạng nơ-ron tích chập hai lớp.");
    assert.ok(track.cues[0].id.startsWith("cst-vi"));
    vm.runInContext(`restoreOriginalCues()`, env);
    assert.deepEqual([...track.cues.map(c => c.text)], ["Let's take a look at", "convolutional neural networks with two layers."]);
});

// ---------------- Background: câu lệnh Gemini ----------------
// opts.backend: kho lưu trữ dùng chung để mô phỏng "service worker khởi động lại"
function makeBackgroundEnv(fetchImpl, stored = {}, opts = {}) {
    const listeners = [];
    const local = opts.local || {};
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout, clearTimeout, AbortController, Promise, Date, Math, JSON, Map, Set, Uint8Array, ArrayBuffer,
        TextEncoder, crypto: globalThis.crypto, atob, btoa,
        encodeURIComponent,
        fetch: fetchImpl,
        chrome: {
            runtime: { onMessage: { addListener: fn => listeners.push(fn) } },
            storage: {
                sync: { get: (defaults, cb) => cb({ ...defaults, costMigration113: true, ...stored }), set: (x, cb) => cb && cb() },
                local: { get: (k, cb) => cb({ ...local }), remove: (keys, cb) => { keys.forEach(k => delete local[k]); cb && cb(); } }
            }
        }
    };
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    vm.createContext(sandbox);
    // Service worker thật nạp cst-cache.js + cost-policy.js bằng importScripts
    sandbox.importScripts = (...files) => files.forEach(f => vm.runInContext(read(f), sandbox, { filename: f }));
    if (opts.backend) {
        sandbox.importScripts("cst-cache.js");
        const orig = sandbox.CST_CACHE.createCaches;
        sandbox.CST_CACHE.createCaches = o => orig({ ...o, backend: opts.backend });
        sandbox.importScripts = (...files) => files.filter(f => f !== "cst-cache.js").forEach(f => vm.runInContext(read(f), sandbox, { filename: f }));
    }
    vm.runInContext(read("background.js"), sandbox, { filename: "background.js" });
    const send = msg => new Promise(resolve => listeners[0](msg, {}, resolve));
    return { sandbox, send };
}

function geminiReply(text) {
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) };
}

test("background: mặc định dùng Gemini 2.5 Flash-Lite (rẻ nhất), khóa API gửi qua header, trần token đủ cho lô dài", async () => {
    let url, body, headers;
    const { send } = makeBackgroundEnv(async (u, opts) => {
        url = u; body = JSON.parse(opts.body); headers = opts.headers;
        const n = (body.contents[0].parts[0].text.match(/^\d+\. /gm) || []).length;
        return geminiReply(JSON.stringify({ t: Array.from({ length: n }, () => "ok") }));
    }, { geminiApiKey: "SECRET-KEY" });
    const long = Array.from({ length: 12 }, (_, i) => `This is lecture sentence number ${i} about gradient descent.`);
    const r = await send({ action: "translateUnit", sentences: long, context: {} });
    assert.ok(url.includes("/models/gemini-2.5-flash-lite:generateContent"), url);
    assert.ok(!url.includes("SECRET-KEY") && !/[?&]key=/.test(url), "khóa API không được nằm trong URL");
    assert.equal(headers["x-goog-api-key"], "SECRET-KEY");
    assert.ok(body.generationConfig.maxOutputTokens >= long.join(" ").length, "đủ chỗ cho bản dịch tiếng Việt dài hơn");
    assert.equal(body.generationConfig.thinkingConfig, undefined, "Flash-Lite giữ mức suy nghĩ tối thiểu mặc định");
    assert.equal(r.engine, "gemini");
});

test("background: giữ mã thuật ngữ thật, xóa mã bịa, bỏ ngoặc kép và markdown", async () => {
    const { send } = makeBackgroundEnv(async () => geminiReply(JSON.stringify({ t: ['"Dùng **[[__T0__]]** và [[__T3__]] để huấn luyện."'] })), { geminiApiKey: "k" });
    const r = await send({ action: "translateUnit", sentences: ["Use [[__T0__]] to train."], context: {}, placeholders: [{ id: 0, term: "PyTorch" }] });
    assert.deepEqual(r.translations, ["Dùng [[__T0__]] và để huấn luyện."]);
});

// ---------------- Background: dịch theo đoạn có ngữ cảnh ----------------
function unitReply(obj) {
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) };
}

test("background: câu lệnh theo đoạn có quy trình hiểu nghĩa, đủ các phần ngữ cảnh, yêu cầu JSON", async () => {
    let body;
    const { send } = makeBackgroundEnv(async (u, opts) => { body = JSON.parse(opts.body); return unitReply({ t: ["a", "b"] }); }, { geminiApiKey: "k" });
    const r = await send({
        action: "translateUnit",
        sentences: ["Now that we have set up our environment,", "let us examine the forward pass of this network."],
        context: { topic: "Tiêu đề: CNN", domain: "Trí tuệ nhân tạo", summary: "Đang cài môi trường", prevSource: "We installed PyTorch.", prevTranslation: "Ta đã cài PyTorch.", nextSource: "It has two layers.", terms: [{ en: "forward pass", vi: "lượt truyền xuôi" }], senseHints: ["pass: lượt truyền"], phraseHints: ["set up: thiết lập"] },
        placeholders: [{ id: 0, term: "PyTorch" }],
        hints: true
    });
    const sys = body.system_instruction.parts[0].text;
    const user = body.contents[0].parts[0].text;
    for (const needle of ["Làm trong đầu", "đại từ", "từ đa nghĩa", "không dịch từng chữ", "mảnh của cùng một câu", "[[__T0__]] = PyTorch", "JSON"]) {
        assert.ok(sys.toLowerCase().includes(needle.toLowerCase()), "thiếu trong câu lệnh hệ thống: " + needle);
    }
    for (const needle of ["[CHỦ ĐỀ]", "[LĨNH VỰC]", "[THUẬT NGỮ ĐÃ THỐNG NHẤT] forward pass = lượt truyền xuôi", "[GỢI Ý NGHĨA]", "[CỤM TỪ, THÀNH NGỮ]", "[NGỮ CẢNH TRƯỚC]", "[BẢN DỊCH ĐOẠN TRƯỚC]", "[CẦN DỊCH]\n1. Now that", "2. let us examine", "[NGỮ CẢNH SAU]"]) {
        assert.ok(user.includes(needle), "thiếu trong nội dung: " + needle);
    }
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.deepEqual(r.translations, ["a", "b"]);
    // Đầu ra tối giản: chỉ bản dịch, không "note", không "terms" khi không xin, không yêu cầu "¦"
    assert.equal(r.note, undefined);
    assert.ok(!sys.includes("¦"));
    assert.deepEqual(Object.keys(body.generationConfig.responseSchema.properties), ["t"]);
});

test("background: phần ngữ cảnh rỗng thì không gửi (tiết kiệm token)", async () => {
    let body;
    const { send } = makeBackgroundEnv(async (u, opts) => { body = JSON.parse(opts.body); return unitReply({ translations: ["Xin chào."] }); }, { geminiApiKey: "k" });
    await send({ action: "translateUnit", sentences: ["Hello."], context: {} });
    const user = body.contents[0].parts[0].text;
    assert.equal(user, "[CẦN DỊCH]\n1. Hello.");
    assert.ok(!body.system_instruction.parts[0].text.includes("[[__T"));
});

test("background: số mục trả về không khớp -> dùng Google dự phòng thay vì lệch phụ đề", async () => {
    let n = 0;
    const { send } = makeBackgroundEnv(async (u) => {
        n++;
        if (u.includes("generativelanguage")) return unitReply({ translations: ["chỉ một mục"] });
        return { ok: true, status: 200, json: async () => [[["Bản Google", "x"]], null, "en"] };
    }, { geminiApiKey: "k" });
    const r = await send({ action: "translateUnit", sentences: ["One.", "Two."], context: {} });
    assert.equal(r.engine, "google_fallback");
    assert.equal(r.translations.length, 2);
    assert.match(r.fallbackReason, /không khớp/);
});

test("background: model không hỗ trợ JSON schema -> tự thử lại bằng chỉ dẫn trong câu lệnh", async () => {
    const bodies = [];
    const { send } = makeBackgroundEnv(async (u, opts) => {
        const b = JSON.parse(opts.body);
        bodies.push(b);
        if (b.generationConfig.responseSchema) return { ok: false, status: 400, statusText: "Bad", json: async () => ({ error: { message: "responseSchema is not supported" } }) };
        return geminiReply('{"translations":["Được rồi."]}');
    }, { geminiApiKey: "k" });
    const r = await send({ action: "translateUnit", sentences: ["Okay."], context: {} });
    assert.equal(bodies.length, 2);
    assert.deepEqual(r.translations, ["Được rồi."]);
});

test("background: bộ nhớ đệm phân biệt ngữ cảnh (cùng câu, ngữ cảnh khác thì dịch lại)", async () => {
    let n = 0;
    const { send } = makeBackgroundEnv(async () => { n++; return unitReply({ translations: ["x" + n] }); }, { geminiApiKey: "k" });
    const a = await send({ action: "translateUnit", sentences: ["It runs."], context: { prevSource: "The program starts.", domain: "Lập trình" } });
    const b = await send({ action: "translateUnit", sentences: ["It runs."], context: { prevSource: "The program starts.", domain: "Lập trình" } });
    const c = await send({ action: "translateUnit", sentences: ["It runs."], context: { prevSource: "The company is small.", domain: "Kinh doanh" } });
    assert.equal(a.translations[0], b.translations[0]);
    assert.notEqual(a.translations[0], c.translations[0]);
    assert.equal(n, 2);
});
