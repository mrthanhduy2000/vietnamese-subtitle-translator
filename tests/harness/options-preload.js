// Runs before the real options.html in headless Chrome (tests/harness/headless.js PRELOAD=), 2.4.7.
// It stands in for the extension: chrome.storage holds 8 saved videos around REVIEW_MARK, and the
// "cacheStats" / "cacheClear" messages are answered by background.js's own code (the saved-video
// section is cut out of the real file and run here), so the Settings counter and the "Xóa video đã
// rà soát" button are seen end to end in a real browser. chrome.runtime.id makes chrome-shim.js
// stand aside. __runOptionsCheck() reads the counter, clicks the button, reads it again.
(function () {
    const getText = url => { const x = new XMLHttpRequest(); x.open("GET", url, false); x.send(); return x.responseText; };
    const errors = window.__errors = [];
    window.addEventListener("error", e => errors.push(String(e.message || e)));
    window.addEventListener("unhandledrejection", e => errors.push("unhandled: " + String(e.reason && (e.reason.stack || e.reason.message) || e.reason)));
    const msgs = window.__msgs = [];
    window.confirm = () => true;
    window.alert = () => {};

    const listeners = [];
    function area(name, data) {
        const pickKeys = keys => {
            if (keys == null) return { ...data };
            if (typeof keys === "string") return keys in data ? { [keys]: data[keys] } : {};
            if (Array.isArray(keys)) return Object.fromEntries(keys.filter(k => k in data).map(k => [k, data[k]]));
            return Object.fromEntries(Object.entries(keys).map(([k, d]) => [k, k in data ? data[k] : d]));
        };
        const done = (cb, v) => { if (cb) { setTimeout(() => cb(v), 0); return undefined; } return Promise.resolve(v); };
        const changed = ch => listeners.forEach(f => { try { f(ch, name); } catch (e) { errors.push("onChanged: " + e.message); } });
        return {
            get: (keys, cb) => done(cb, pickKeys(keys)),
            set: (obj, cb) => {
                const ch = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { oldValue: data[k], newValue: v }]));
                Object.assign(data, obj); changed(ch); return done(cb);
            },
            remove: (keys, cb) => {
                const ch = {};
                for (const k of [].concat(keys)) { ch[k] = { oldValue: data[k] }; delete data[k]; }
                changed(ch); return done(cb);
            },
            clear: cb => { for (const k of Object.keys(data)) delete data[k]; return done(cb); },
            getBytesInUse: (k, cb) => done(cb, 0)
        };
    }

    const bg = getText("/background.js");
    const from = bg.indexOf("// ---- Quản lý bộ nhớ đệm"), to = bg.indexOf("// ---- Chuyển đổi cài đặt model cũ");
    const mark = bg.match(/const REVIEW_MARK = \{ until: (\d+), videos: (\d+) \}/);
    const until = Number(mark[1]);
    // 5 videos the last review covered, 3 saved after it
    const local = { ctxterms_yt_x: { v: 2, terms: [] } };
    const video = k => ({ luc: until + (k - 4) * 3600e3, cues: [[0, 2, "Hello there."]], vi: [[0, 2, ["Xin chào."]]], g: [[0, 2, "Xin chào.", [[0, 2, "Hello there."]], [[0, 2, "Xin chào."]], 0]] });
    for (let k = 0; k < 8; k++) local[`ytcache4_vid${k}`] = video(k);
    window.__local = local;

    const chromeStub = {
        storage: { sync: area("sync", { costMode: "balanced" }), local: area("local", local), session: area("session", {}), onChanged: { addListener: f => listeners.push(f), removeListener: () => {} } },
        runtime: {
            id: "harness-options", lastError: null,
            getManifest: () => JSON.parse(getText("/manifest.json")),
            getURL: p => "/" + p,
            onMessage: { addListener: () => {} },
            openOptionsPage: () => {},
            sendMessage: (msg, cb) => {
                msgs.push(msg && msg.action);
                const p = (async () => {
                    if (msg.action === "settingsPatch") return patchSettings(msg);
                    if (msg.action === "cacheStats") return handlers.handleCacheStats();
                    if (msg.action === "cacheClear") return handlers.handleCacheClear(msg);
                    return { ok: false, error: "harness" };
                })().catch(e => { errors.push(msg.action + ": " + e.message); return { ok: false }; });
                if (cb) { p.then(cb); return undefined; }
                return p;
            }
        },
        tabs: { query: async () => [], create: async () => ({}), sendMessage: async () => ({}) }
    };
    const caches = { tr: { info: async () => ({ bytes: 2e6, count: 40, maxBytes: 5e8 }), clear: async () => {} }, audio: { info: async () => ({ bytes: 64e6, count: 300, maxBytes: 3e9 }), clear: async () => {} } };
    // background.js's saved-video section, run as it is
    const handlers = new Function("chrome", "caches", bg.slice(from, to) + "\nreturn { handleCacheStats, handleCacheClear, REVIEW_MARK };")(chromeStub, caches);
    const patchSettings = new Function("chrome", "getSyncCfg",
        bg.slice(bg.indexOf("let settingsWriteChain ="), bg.indexOf("const ROUTES =")) + "\nreturn handleSettingsPatch;"
    )(chromeStub, defaults => new Promise(resolve => chromeStub.storage.sync.get(defaults, resolve)));
    window.chrome = chromeStub;

    const wait = ms => new Promise(r => setTimeout(r, ms));
    window.__runOptionsCheck = async () => {
        const text = id => (document.getElementById(id) || {}).textContent || "";
        for (let i = 0; i < 50 && !/Video mới chưa rà soát/.test(text("cacheReview")); i++) await wait(100);
        const before = { review: text("cacheReview"), videos: text("cacheVideos"), tr: text("cacheTr") };
        // the counter and the button sit on the Gemini tab, as the user reaches them
        const tab = document.querySelector('[data-tab="tab-gemini"]');
        if (tab) tab.click();
        await wait(100);
        const button = document.getElementById("clearReviewedVideos");
        const visible = !!button && button.getClientRects().length > 0;
        if (button) button.click();
        for (let i = 0; i < 50 && text("cacheReview") === before.review; i++) await wait(100);
        await wait(200);
        const after = { review: text("cacheReview"), videos: text("cacheVideos") };
        const left = Object.keys(local).filter(k => /^ytcache4_/.test(k)).sort();
        const status = [...document.querySelectorAll("[role=status], .status, #status")].map(e => e.textContent.trim()).filter(Boolean);
        return { done: true, reviewed: handlers.REVIEW_MARK.videos, before, after, buttonVisible: visible, left, status, msgs: [...new Set(msgs)], errors };
    };
    window.__runStorageCheck = async () => {
        const checks = [];
        const check = (name, pass, detail) => {
            checks.push({ name, pass: !!pass, detail });
            if (!pass) console.error(name + ": " + JSON.stringify(detail));
        };
        const store = chromeStub.storage.sync;
        const style = window.CST_STYLE.normalizeStyle({ fontSize: 100 });
        await store.set({ dualMode: true, dubEnabled: false, geminiApiKey: "test-only-key", subStyle: style });
        await wait(50);
        check("external toggle refreshes the Settings control", !document.getElementById("autoDub").checked);
        const size = document.getElementById("subFontSize");
        size.value = "150";
        size.dispatchEvent(new Event("change", { bubbles: true }));
        await patchSettings({ values: { subStyle: { fontColor: "#ffcc00" } } });
        await wait(700);
        const saved = await store.get(null);
        check("local size and external color survive autosave", saved.subStyle.fontSize === 150 && saved.subStyle.fontColor === "#ffcc00", saved.subStyle);
        check("unrelated settings and key survive autosave", saved.dualMode === true && saved.subStyle.mode === "dual" && saved.dubEnabled === false && saved.geminiApiKey === "test-only-key");
        check("external color is reflected in the form", document.getElementById("subFontColorPicker").value === "#ffcc00");
        await Promise.all([
            patchSettings({ values: { subStyle: { fontSize: 180 } } }),
            patchSettings({ values: { subStyle: { fontColor: "#ffffff" } } })
        ]);
        await wait(50);
        check("two worker patches merge in real Chrome", (await store.get("subStyle")).subStyle.fontSize === 180 && size.value === "180");
        await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "/cst-cache.js";
            script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
        });
        const C = window.CST_CACHE;
        const backend = C.idbBackend(["tr", "audio"]);
        const cache = new C.TieredCache(backend, "tr", { maxBytes: 100 });
        await cache.clear();
        await Promise.all([cache.set("a", "x".repeat(15)), cache.set("b", "x".repeat(15)), cache.set("c", "x".repeat(15))]);
        check("real IndexedDB keeps 90 bytes below a 100-byte cap", cache.totals.bytes === 90 && cache.totals.count === 3 && cache.stats.evicted === 0, cache.totals);
        const restarted = new C.TieredCache(backend, "tr", { maxBytes: 100 });
        await restarted.set("a", "xx");
        check("real IndexedDB replacement after restart", restarted.totals.bytes === 64 && restarted.totals.count === 3, restarted.totals);
        await Promise.all([restarted.remove(["b"]), restarted.set("d", "xxx"), restarted.info()]);
        check("real IndexedDB remove/write/scan stay consistent", restarted.totals.bytes === 40 && restarted.totals.count === 3, restarted.totals);
        await restarted.clear();
        return { done: true, checks, errors };
    };
})();
