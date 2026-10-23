// A glossary update must not re-bill windows that are already translated (next release). The window cache
// key reads the original source text, not the text with [[__T0__]] codes, and the entry carries the
// terms it was translated with. Offline: the service worker is the real background.js, Gemini is faked.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const CACHE = require("../cst-cache.js");
const { bgEnv } = require("./bg-env.js");

const reply = obj => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
const cfg = { geminiApiKey: "k", costMigration113: true };
const SRC = ["We deploy it on Kubernetes with Terraform."];
const ctx = { domain: "Kỹ thuật phần mềm", prevSource: "Next, the setup." };
// what the page sends: the protected text, the original text, and the terms behind the codes
const asPage = (terms, extra = {}) => {
    let text = SRC[0];
    terms.forEach((t, i) => { text = text.replace(t, ` [[__T${i}__]] `); });
    return { action: "translateUnit", sentences: [text.replace(/\s{2,}/g, " ").trim()], source: SRC, context: ctx,
        placeholders: terms.map((term, id) => ({ id, term })), protectFp: "u1", ...extra };
};

test("cache key: the protected terms and codes are not part of it, the source text and the user's own choices are", async () => {
    const bg = bgEnv(async () => { throw new Error("offline"); });
    const key = r => bg.sandbox.unitCacheKey(r, "gemini-3.1-flash-lite");
    const k0 = await key(asPage(["Kubernetes"]));
    assert.equal(await key(asPage(["Kubernetes", "Terraform"])), k0, "a glossary that grew: same window, same key");
    assert.equal(await key(asPage([])), k0, "a glossary that lost the term: same key");
    assert.notEqual(await key(asPage(["Kubernetes"], { protectFp: "u2" })), k0, "the user's own renderings changed: miss");
    assert.notEqual(await key({ ...asPage(["Kubernetes"]), source: ["Something else."] }), k0, "other source text: miss");
    // a request without source (old page) keeps reading the sentences
    const bare = { sentences: SRC, context: ctx };
    assert.equal(await key(bare), await key({ ...bare, source: SRC }));
});

test("a glossary that grew between visits: the window comes from the cache and is restored with the terms it was made with", async () => {
    const backend = CACHE.memoryBackend();
    let calls = 0;
    const f = async () => { calls++; return reply({ t: ["Chúng tôi triển khai nó trên [[__T0__]]."] }); };
    const A = bgEnv(f, cfg, { backend });
    const r1 = await A.send(asPage(["Kubernetes"]));
    assert.equal(calls, 1);
    assert.equal(r1.fromCache, undefined);
    // a later release also protects Terraform: the codes of this window now differ
    const B = bgEnv(f, cfg, { backend });
    const r2 = await B.send(asPage(["Kubernetes", "Terraform"]));
    assert.equal(calls, 1, "no second Gemini call");
    assert.equal(r2.fromCache, true);
    assert.deepEqual(r2.translations, ["Chúng tôi triển khai nó trên [[__T0__]]."]);
    assert.deepEqual(r2.placeholders.map(p => p.term), ["Kubernetes"], "the terms of the translation, not of this run");
});

test("noCache: a broken entry is asked again and replaced", async () => {
    const backend = CACHE.memoryBackend();
    let n = 0;
    const f = async () => reply({ t: [++n === 1 ? "Chúng tôi triển khai nó." : "Chúng tôi triển khai nó trên Kubernetes."] });
    const A = bgEnv(f, cfg, { backend });
    await A.send(asPage(["Kubernetes"]));
    const again = await A.send({ ...asPage([]), noCache: true });
    assert.equal(again.fromCache, undefined);
    assert.deepEqual(again.translations, ["Chúng tôi triển khai nó trên Kubernetes."]);
    const next = await A.send(asPage([]));
    assert.equal(next.fromCache, true);
    assert.deepEqual(next.translations, ["Chúng tôi triển khai nó trên Kubernetes."], "the new answer replaced the broken one");
});

test("a window saved under the pre-change key is found there and copied to the new key", async () => {
    const page = asPage(["Kubernetes"]);
    // which model the chain starts with: learn it from a throwaway run
    const model = (await bgEnv(async () => reply({ t: ["x [[__T0__]]"] }), cfg, { backend: CACHE.memoryBackend() }).send(page)).model;
    const backend = CACHE.memoryBackend();
    let calls = 0;
    const B = bgEnv(async () => { calls++; return reply({ t: ["new"] }); }, cfg, { backend });
    const legacyKey = await B.sandbox.unitCacheKey(page, model, true);
    const newKey = await B.sandbox.unitCacheKey(page, model);
    assert.notEqual(legacyKey, newKey);
    const store = new CACHE.TieredCache(backend, "tr", { version: 4 });
    await store.set(legacyKey, { translations: ["Bản cũ [[__T0__]]."], terms: [], engine: "gemini", model, tier: "cheap" });
    const r = await B.send(page);
    assert.equal(calls, 0);
    assert.equal(r.fromCache, true);
    assert.deepEqual(r.translations, ["Bản cũ [[__T0__]]."]);
    assert.equal(r.cacheKey, newKey);
    // copied: now a later glossary (other codes) still hits
    const C = bgEnv(async () => { calls++; return reply({ t: ["new"] }); }, cfg, { backend });
    const r2 = await C.send(asPage(["Kubernetes", "Terraform"]));
    assert.equal(calls, 0);
    assert.deepEqual(r2.placeholders.map(p => p.term), ["Kubernetes"]);
});

// ---- the page side: content.js sends the source and restores with the terms of a cached entry ----
// A fake node: every property is another fake node, and calling one returns a fake node too
function stubNode() {
    const own = { style: {}, dataset: {}, children: [] };
    return new Proxy(function () {}, {
        get: (f, k) => (k in own ? own[k] : k === "querySelectorAll" ? () => [] : k === "querySelector" ? () => null
            : k === Symbol.toPrimitive ? () => "" : stubNode()),
        set: (f, k, v) => { own[k] = v; return true; },
        apply: () => stubNode()
    });
}
function pageEnv(onMsg, stored = {}) {
    const noop = () => {};
    const sb = {
        console: { log: noop, warn: noop, error: noop }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
        requestAnimationFrame: f => f(), URL, Promise, Map, Set, Math, JSON, Date, RegExp, TextEncoder, crypto: globalThis.crypto,
        location: { href: "https://www.coursera.org/learn/x", hostname: "www.coursera.org", pathname: "/learn/x" },
        document: stubNode(),
        MutationObserver: class { observe() {} disconnect() {} }, addEventListener: noop, postMessage: noop,
        getComputedStyle: () => ({ position: "relative" }),
        chrome: {
            storage: { sync: { get: async d => ({ ...d, ...stored }), set: async () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener: noop } },
            runtime: { lastError: null, id: "x", onMessage: { addListener: noop }, getURL: p => p, sendMessage: (m, cb) => Promise.resolve(onMsg(m)).then(cb) }
        }
    };
    sb.window = sb; sb.globalThis = sb;
    vm.createContext(sb);
    for (const f of ["glossary.js", "glossary-extra.js", "glossary-data.js", "cst-cache.js", "cost-policy.js", "lang-detect.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js"]) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), sb);
    }
    return sb;
}
const settle = async sb => { for (let i = 0; i < 80 && !(sb.state && sb.state.reExact); i++) await new Promise(r => setTimeout(r, 5)); };

test("page: sends the original text and the user's glossary fingerprint; restores a cached window with its own terms", async () => {
    const seen = [];
    const sb = pageEnv(m => {
        seen.push(m);
        // the window was cached when the glossary held only "Kubernetes"; today it also holds Terraform
        return { ok: true, fromCache: true, engine: "gemini", translations: ["Triển khai trên [[__T0__]] bằng Terraform."], placeholders: [{ id: 0, term: "Kubernetes" }] };
    });
    await settle(sb);
    const out = await vm.runInContext("requestUnit({ sentences: ['We deploy on Kubernetes with Terraform.'], context: {} })", sb);
    assert.deepEqual(out.translations, ["Triển khai trên Kubernetes bằng Terraform."]);
    assert.deepEqual([...seen[0].source], ["We deploy on Kubernetes with Terraform."]);
    assert.ok(seen[0].protectFp, "fingerprint present");
    assert.equal(seen[0].noCache, undefined);
});

test("page: codes lost by the model resend the original text with noCache set", async () => {
    const seen = [];
    const sb = pageEnv(m => {
        seen.push(m);
        return { ok: true, engine: "gemini", translations: [seen.length === 1 ? "Triển khai ở đâu đó." : "Triển khai trên Kubernetes."] };
    });
    await settle(sb);
    const out = await vm.runInContext("requestUnit({ sentences: ['We deploy on Kubernetes.'], context: {} })", sb);
    assert.equal(seen.length, 2);
    assert.equal(seen[1].noCache, true);
    assert.deepEqual([...seen[1].placeholders], []);
    assert.deepEqual(out.translations, ["Triển khai trên Kubernetes."]);
});

test("page: the fingerprint follows the user's own glossary choices only", async () => {
    const fp = async stored => { const sb = pageEnv(() => ({ ok: true, translations: [""] }), stored); await settle(sb); return vm.runInContext("state.glossaryFp", sb); };
    const a = await fp({});
    assert.equal(await fp({}), a);
    assert.notEqual(await fp({ userNormalize: "kubernetes => cụm Kubernetes" }), a);
    assert.notEqual(await fp({ userKeep: "Foobar" }), a);
    assert.notEqual(await fp({ glossaryEnabled: false }), a);
});

test("matcher warm-up: building every bucket ahead of time changes no match and finishes", async () => {
    const sb = pageEnv(() => ({ ok: true, translations: [""] }));
    await settle(sb);
    const text = "We use Python and Docker with the Kubernetes cluster. Interest rates rose; case studies help.";
    const before = vm.runInContext(`JSON.stringify(protectGlossary(${JSON.stringify(text)}))`, sb);
    let rounds = 0;
    for (const name of ["reExact", "reLoose"]) {
        while (!vm.runInContext(`state.${name}.warm(5)`, sb)) assert.ok(++rounds < 5000, "warm never finishes");
        assert.equal(vm.runInContext(`state.${name}.warm(5)`, sb), true, "nothing left to build");
    }
    assert.equal(vm.runInContext(`JSON.stringify(protectGlossary(${JSON.stringify(text)}))`, sb), before);
    assert.ok(JSON.parse(before).terms.length >= 3);
});
