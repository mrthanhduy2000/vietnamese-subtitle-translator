const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { bgEnv } = require("./bg-env");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
// Browser boundary for progress tests: real content and YouTube code, isolated storage.
function pageEnv(opts = {}) {
    const noop = () => {};
    const calls = { localGet: [], localSet: [], localRemove: [], selector: 0 };
    const changeListeners = [];
    const el = () => ({ style: {}, dataset: {}, appendChild: noop, addEventListener: noop, setAttribute: noop, remove: noop });
    const store = { ...(opts.local || {}) };
    const worker = bgEnv(() => { throw new Error("Unexpected network request"); }, {}, { local: store });
    const intervals = [], msgListeners = [];
    const sandbox = {
        console: { log: noop, warn: noop, error: console.error },
        // opts.timers: real timers, 100x faster (a 1500 ms wait takes 15 ms); intervals are recorded
        // and never fire on their own (E.intervals)
        setTimeout: opts.timers ? (f, ms) => setTimeout(f, (ms || 0) / 100) : () => 0, clearTimeout: opts.timers ? clearTimeout : noop,
        setInterval: f => { intervals.push(f); return intervals.length; }, clearInterval: noop,
        ...(opts.timers ? { requestAnimationFrame: () => 0, URL } : {}),
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number,
        performance: { now: () => opts.now ? opts.now() : 0 },
        location: opts.location || { href: "https://www.youtube.com/watch?v=abc", hostname: "www.youtube.com", pathname: "/watch" },
        document: {
            readyState: "complete", title: "t", body: el(), head: el(), documentElement: el(), getElementById: () => null,
            querySelector: s => { calls.selector++; return opts.querySelector ? opts.querySelector(s) : null; },
            querySelectorAll: () => [], getElementsByTagName: t => (t === "track" && opts.tracks ? opts.tracks() : []),
            createElement: el, addEventListener: noop
        },
        VTTCue: class { constructor(start, end, text) { Object.assign(this, { startTime: start, endTime: end, text }); } },
        addEventListener: noop, postMessage: noop,
        MutationObserver: class { observe() {} disconnect() {} },
        chrome: {
            storage: {
                sync: { get: async d => ({ ...d, autoTranslate: false, ...(opts.sync || {}) }), set: async () => {} },
                local: {
                    get: async k => { calls.localGet.push(k); return k === null ? { ...store } : typeof k === "object" && k ? { ...k, ...store } : store; },
                    set: async o => { calls.localSet.push(o); Object.assign(store, o); },
                    remove: async k => { calls.localRemove.push(k); for (const x of [].concat(k)) delete store[x]; }
                },
                onChanged: { addListener: fn => changeListeners.push(fn) }
            },
            runtime: { id: "ext", lastError: null, onMessage: { addListener: fn => msgListeners.push(fn) }, sendMessage: opts.sendMessage || ((msg, cb) => { worker.send(msg).then(cb); }) }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of ["glossary.js", "subtitle-style.js", "vi-segmenter.js", ...(opts.files || []), "content.js", ...(opts.youtube ? ["youtube.js"] : [])]) vm.runInContext(read(f), sandbox);
    return { sandbox, calls, changeListeners, store, intervals, msgListeners, run: code => vm.runInContext(code, sandbox) };
}

module.exports = { pageEnv };
