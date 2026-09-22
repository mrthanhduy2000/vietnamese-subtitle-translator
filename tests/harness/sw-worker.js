// Chạy CHÍNH background.js trong một Web Worker thật (importScripts, IndexedDB,
// crypto.subtle, AbortController của trình duyệt). Chỉ giả lập chrome.* và máy chủ Gemini.
const origImport = self.importScripts.bind(self);
self.importScripts = (...files) => origImport(...files.map(f => "../../" + f));

const listeners = [];
const sync = { geminiApiKey: "TEST-KEY", useAi: true, costMigration113: true };
// chrome.storage.local của "service worker": truyền vào qua ?local=... để mô phỏng tải lại tiện ích
const local = JSON.parse(new URLSearchParams(self.location.search).get("local") || "{}");
const area = obj => ({
    get: (k, cb) => {
        const out = k == null ? { ...obj } : typeof k === "object" && !Array.isArray(k)
            ? Object.fromEntries(Object.entries(k).map(([x, d]) => [x, obj[x] !== undefined ? obj[x] : d]))
            : Object.fromEntries([].concat(k).map(x => [x, obj[x]]));
        cb(JSON.parse(JSON.stringify(out)));
    },
    set: (x, cb) => { Object.assign(obj, JSON.parse(JSON.stringify(x))); cb && cb(); },
    remove: (k, cb) => { [].concat(k).forEach(x => delete obj[x]); cb && cb(); }
});
self.chrome = {
    runtime: { onMessage: { addListener: fn => listeners.push(fn) } },
    storage: {
        sync: { get: (d, cb) => cb({ ...d, ...sync }), set: (x, cb) => { Object.assign(sync, x); cb && cb(); } },
        local: area(local),
        onChanged: { addListener() {} }
    }
};

const log = { gemini: 0, urls: [], keyInHeader: 0, mode: "ok" };
function pcm(segs) {
    const sr = 24000, out = [];
    segs.forEach((d, k) => {
        for (let i = 0; i < d * sr; i++) out.push(Math.round(Math.sin(i / 6) * 9000));
        if (k < segs.length - 1) for (let i = 0; i < 0.45 * sr; i++) out.push(0);
    });
    const b = new Uint8Array(out.length * 2);
    const dv = new DataView(b.buffer);
    out.forEach((v, i) => dv.setInt16(i * 2, v, true));
    let s = "";
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
}
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
self.fetch = async (url, opts) => {
    if (!String(url).includes("generativelanguage")) return json(200, [[["Bản Google", "x"]], null, "en"]);
    log.gemini++;
    log.urls.push(String(url));
    if (opts.headers && opts.headers["x-goog-api-key"] === "TEST-KEY") log.keyInHeader++;
    if (log.mode === "503") return json(503, { error: { code: 503, status: "UNAVAILABLE", message: "The model is overloaded." } });
    const model = (String(url).match(/models\/([^:]+):/) || [])[1];
    // Đúng thông báo Google trả cho API key mới (07/2026)
    if (log.mode === "newuser:" + model) return json(404, { error: { code: 404, status: "NOT_FOUND", message: `This model models/${model} is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite.` } });
    if (log.mode === "404:" + model) return json(404, { error: { code: 404, status: "NOT_FOUND", message: `models/${model} is not found for API version v1beta, or is not supported for generateContent.` } });
    const body = JSON.parse(opts.body);
    if (body.generationConfig.responseModalities) {
        await new Promise(r => setTimeout(r, 30));
        return json(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;codec=pcm;rate=24000", data: pcm([1.1, 1.6]) } }] } }] });
    }
    const n = (body.contents[0].parts[0].text.match(/^\d+\. /gm) || []).length;
    return json(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ t: Array.from({ length: n }, (_, i) => `Bản dịch ${i + 1} của ${model}.`) }) }] } }] });
};

self.importScripts("background.js");
const send = msg => new Promise(resolve => listeners[0](msg, {}, resolve));

self.onmessage = async e => {
    const { id, cmd, msg, mode } = e.data;
    try {
        if (cmd === "mode") { log.mode = mode; self.postMessage({ id, result: true }); return; }
        // Nạp cài đặt thật đọc từ trang Cài đặt (chrome.storage.sync) vào service worker
        if (cmd === "sync") { Object.assign(sync, e.data.settings); self.postMessage({ id, result: true }); return; }
        if (cmd === "local") { self.postMessage({ id, result: local }); return; }
        if (cmd === "log") { self.postMessage({ id, result: { ...log, urlHasKey: log.urls.some(u => u.includes("TEST-KEY") || /[?&]key=/.test(u)) } }); return; }
        self.postMessage({ id, result: await send(msg) });
    } catch (err) {
        self.postMessage({ id, error: String(err && err.stack || err) });
    }
};
self.postMessage({ ready: true });
