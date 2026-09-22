// Môi trường giả lập service worker (background.js) cho kiểm thử: chạy CHÍNH mã của tiện ích
// trong vm, chỉ giả lập chrome.* và fetch. Dùng chung cho các file kiểm thử.
//   stored : chrome.storage.sync ban đầu
//   opts.local : đối tượng chrome.storage.local (truyền cùng một đối tượng để mô phỏng
//                "tải lại tiện ích / service worker khởi động lại" mà dữ liệu còn nguyên)
//   opts.backend : kho IndexedDB giả dùng chung
//   opts.fastTimeouts : thời gian chờ >= 30 giây (ví dụ TTS 60 giây) rút còn 40 ms
//   opts.timeScale    : nhân MỌI thời gian chờ với hệ số này (ví dụ 0,01: 8 giây -> 80 ms)
//   opts.openOptionsPage : giả lập chrome.runtime.openOptionsPage
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const CACHE = require("../cst-cache.js");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

function storageArea(obj) {
    return {
        get: (k, cb) => {
            let out;
            if (k == null) out = { ...obj };
            else if (typeof k === "string") out = { [k]: obj[k] };
            else if (Array.isArray(k)) out = Object.fromEntries(k.map(x => [x, obj[x]]));
            else out = Object.fromEntries(Object.entries(k).map(([x, d]) => [x, obj[x] !== undefined ? obj[x] : d]));
            cb(JSON.parse(JSON.stringify(out)));
        },
        set: (x, cb) => { Object.assign(obj, JSON.parse(JSON.stringify(x))); cb && cb(); },
        remove: (keys, cb) => { [].concat(keys).forEach(k => delete obj[k]); cb && cb(); }
    };
}

function bgEnv(fetchImpl, stored = {}, opts = {}) {
    const listeners = [];
    const changeListeners = [];
    const local = opts.local || {};
    const syncStore = { ...stored };
    const opened = [];
    const installedListeners = [];
    const injected = [];
    const commandListeners = [];
    const tabMessages = [];
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: opts.timeScale ? (f, ms, ...a) => setTimeout(f, (ms || 0) * opts.timeScale, ...a)
            : opts.fastTimeouts ? (f, ms, ...a) => setTimeout(f, ms >= 30000 ? 40 : ms, ...a) : setTimeout,
        clearTimeout, AbortController, Promise, Date, Math, JSON, Map, Set, Uint8Array, ArrayBuffer,
        TextEncoder, crypto: globalThis.crypto, atob, btoa, encodeURIComponent, URL,
        fetch: fetchImpl,
        chrome: {
            runtime: {
                onMessage: { addListener: fn => listeners.push(fn) },
                getURL: p => `chrome-extension://test-id/${p}`,
                openOptionsPage: opts.openOptionsPage || (async () => { opened.push("openOptionsPage"); }),
                onInstalled: { addListener: fn => installedListeners.push(fn) },
                lastError: null,
                getManifest: () => JSON.parse(read("manifest.json"))
            },
            commands: { onCommand: { addListener: fn => commandListeners.push(fn) } },
            tabs: {
                create: async o => { opened.push(o.url); return { id: 1 }; },
                query: async () => opts.tabs || [],
                sendMessage: async (id, msg) => { tabMessages.push({ id, msg }); return { ok: true }; }
            },
            scripting: { executeScript: async o => { injected.push(o); if (opts.injectFail && opts.injectFail(o)) throw new Error("không chèn được"); return []; } },
            storage: {
                sync: {
                    get: (d, cb) => cb({ ...d, ...syncStore }),
                    set: (x, cb) => {
                        const changes = Object.fromEntries(Object.entries(x).map(([k, v]) => [k, { oldValue: syncStore[k], newValue: v }]));
                        Object.assign(syncStore, x);
                        changeListeners.forEach(fn => fn(changes, "sync"));
                        cb && cb();
                    }
                },
                local: storageArea(local),
                onChanged: { addListener: fn => changeListeners.push(fn) }
            }
        }
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(read("cst-cache.js"), sandbox);
    const orig = sandbox.CST_CACHE.createCaches;
    const backend = opts.backend || CACHE.memoryBackend();
    sandbox.CST_CACHE.createCaches = o => orig({ ...o, backend });
    sandbox.importScripts = (...files) => files.filter(f => f !== "cst-cache.js").forEach(f => vm.runInContext(read(f), sandbox));
    vm.runInContext(read("background.js"), sandbox);
    const send = msg => new Promise(resolve => { listeners[0](msg, {}, resolve); });
    return { send, sandbox, syncStore, backend, local, opened, installedListeners, injected, commandListeners, tabMessages };
}

module.exports = { bgEnv, read, ROOT };
