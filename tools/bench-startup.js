// Offline startup benchmark: parse+run time of each glossary file, glossary merge cost, content.js
// loadGlossary (term sets + master regexes), first/steady protectGlossary on a sample window, and
// heap after load. Usage: node --expose-gc tools/bench-startup.js [runs=5]  (prints medians)
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const RUNS = Number(process.argv[2]) || 5;
const SAMPLE = "So today we use Claude Code with GitHub Copilot and the Kubernetes dashboard, then deploy to Amazon Web Services. " +
    "Interest rates and case studies matter in machine learning, and Tom Brady joined the Los Angeles Lakers at Madison Square Garden.";

async function once() {
    const noop = () => {};
    const el = () => ({ style: {}, dataset: {}, appendChild: noop, addEventListener: noop, setAttribute: noop, remove: noop });
    const sb = {
        console: { log: noop, warn: noop, error: console.error },
        setTimeout: () => 0, clearTimeout: noop, setInterval: () => 1, clearInterval: noop,
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number, performance,
        location: { href: "https://www.youtube.com/watch?v=abc", hostname: "www.youtube.com", pathname: "/watch" },
        document: { readyState: "complete", title: "t", body: el(), head: el(), documentElement: el(), getElementById: () => null,
            querySelector: () => null, querySelectorAll: () => [], getElementsByTagName: () => [], createElement: el, addEventListener: noop },
        addEventListener: noop, postMessage: noop, MutationObserver: class { observe() {} disconnect() {} },
        chrome: { storage: { sync: { get: async d => ({ ...d, autoTranslate: false }), set: async () => {} },
            local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener: noop } },
            runtime: { id: "ext", lastError: null, onMessage: { addListener: noop }, sendMessage: noop } }
    };
    sb.window = sb; sb.globalThis = sb;
    vm.createContext(sb);
    const t = {};
    if (global.gc) global.gc();
    const h0 = process.memoryUsage().heapUsed;
    for (const f of ["glossary.js", "glossary-extra.js", "glossary-data.js", "subtitle-style.js", "vi-segmenter.js", "content.js"]) {
        const a = performance.now();
        vm.runInContext(read(f), sb, { filename: f });
        t[f] = performance.now() - a;
    }
    await new Promise(r => setImmediate(r));
    let a = performance.now();
    await vm.runInContext("loadGlossary()", sb);
    t.loadGlossary = performance.now() - a;
    a = performance.now();
    vm.runInContext(`protectGlossary(${JSON.stringify(SAMPLE)})`, sb);
    t.protectFirst = performance.now() - a;
    a = performance.now();
    for (let i = 0; i < 20; i++) vm.runInContext(`protectGlossary(${JSON.stringify(SAMPLE)})`, sb);
    t.protectSteady = (performance.now() - a) / 20;
    if (global.gc) global.gc();
    t.heapMB = (process.memoryUsage().heapUsed - h0) / 1048576;
    t.terms = vm.runInContext("state.glossaryKeep.length", sb);
    return t;
}

(async () => {
    const rows = [];
    for (let i = 0; i < RUNS; i++) rows.push(await once());
    const med = k => rows.map(r => r[k]).sort((x, y) => x - y)[Math.floor(rows.length / 2)];
    const out = {};
    for (const k of Object.keys(rows[0])) out[k] = k === "terms" ? rows[0][k] : Number(med(k).toFixed(1));
    console.table(out);
})();
