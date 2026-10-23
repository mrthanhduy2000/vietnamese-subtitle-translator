// cst-cache.js against a small in-memory indexedDB double: the real backend path
// (open, upgrade, transactions, LRU listing, version-change reopen) that the memory backend skips.
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../cst-cache.js");

function fakeIndexedDB({ failOpen = false } = {}) {
    const stores = {};         // name -> { map, keyPath }
    const tick = fn => setTimeout(fn, 0);
    const dbObj = {
        opened: 0,
        objectStoreNames: { contains: n => n in stores },
        createObjectStore(n, o = {}) { stores[n] = { map: new Map(), keyPath: o.keyPath }; return { createIndex() {} }; },
        close() { this.closed = true; },
        transaction(names) {
            const tx = { pending: 0 };
            const done = () => tick(() => { if (!tx.pending && !tx.finished) { tx.finished = true; tx.oncomplete && tx.oncomplete(); } });
            const request = fn => {
                const r = {}; tx.pending++;
                tick(() => { r.result = fn(); tx.pending--; r.onsuccess && r.onsuccess(); done(); });
                return r;
            };
            tx.objectStore = n => {
                assert.ok(names.includes(n), `store ${n} not in transaction`);
                const s = stores[n];
                return {
                    get: k => request(() => s.map.get(k)),
                    put: (v, k) => request(() => { s.map.set(s.keyPath ? v[s.keyPath] : k, v); }),
                    delete: k => request(() => { s.map.delete(k); }),
                    clear: () => request(() => { s.map.clear(); }),
                    index: () => ({
                        openCursor: () => {
                            const rows = [...s.map.values()].sort((a, b) => a.t - b.t);
                            let i = 0;
                            const r = {};
                            tx.pending++;
                            const fire = () => tick(() => {
                                const row = rows[i];
                                r.result = row ? { value: row, continue() { i++; fire(); } } : null;
                                tx.pending--; r.onsuccess && r.onsuccess(); if (row) tx.pending++; done();
                            });
                            fire();
                            return r;
                        }
                    })
                };
            };
            done();
            return tx;
        }
    };
    return {
        stores, dbObj,
        open() {
            const req = {};
            tick(() => {
                if (failOpen) { req.error = new Error("blocked"); return req.onerror && req.onerror(); }
                req.result = dbObj; dbObj.opened++;
                req.onupgradeneeded && req.onupgradeneeded();
                req.onsuccess && req.onsuccess();
            });
            return req;
        }
    };
}

test("idb backend: put, get, touch, ordered listing, delete, clear", async () => {
    const idb = fakeIndexedDB();
    globalThis.indexedDB = idb;
    try {
        const b = C.idbBackend(["tr", "audio"]);
        assert.equal(await b.get("tr", "a"), null);
        await b.put("tr", "a", "VA", { t: 30, size: 2, v: 1 });
        await b.put("tr", "b", "VB", { t: 10, size: 2, v: 1 });
        await b.put("audio", "a", "AUDIO", { t: 5, size: 5, v: 1 });
        assert.deepEqual(await b.get("tr", "a"), { meta: { t: 30, size: 2, v: 1, k: "a" }, value: "VA" });
        assert.deepEqual((await b.listMeta("tr")).map(m => m.k), ["b", "a"], "oldest use first");
        await b.touch("tr", "b", 99);
        await b.touch("tr", "missing", 1);
        assert.deepEqual((await b.listMeta("tr")).map(m => m.k), ["a", "b"]);
        await b.del("tr", ["a"]);
        assert.equal(await b.get("tr", "a"), null);
        assert.equal((await b.get("audio", "a")).value, "AUDIO", "stores do not mix");
        await b.clear("tr");
        assert.deepEqual(await b.listMeta("tr"), []);
        assert.equal(idb.dbObj.opened, 1, "one connection is reused");
    } finally { delete globalThis.indexedDB; }
});

test("idb backend: a failed open is retried next call, a closed connection is reopened", async () => {
    const bad = fakeIndexedDB({ failOpen: true });
    globalThis.indexedDB = bad;
    try {
        const b = C.idbBackend(["tr"]);
        await assert.rejects(b.get("tr", "k"), /blocked/);
        const good = fakeIndexedDB();
        globalThis.indexedDB = good;
        await b.put("tr", "k", "v", { t: 1, v: 1 });
        assert.equal((await b.get("tr", "k")).value, "v");
        good.dbObj.onversionchange();
        assert.equal(good.dbObj.closed, true);
        await b.get("tr", "k");
        assert.equal(good.dbObj.opened, 2, "reopened after the version change");
        good.dbObj.onclose();
        await b.get("tr", "k");
        assert.equal(good.dbObj.opened, 3);
    } finally { delete globalThis.indexedDB; }
});

test("tiered cache over idb: survives a fresh instance, old versions are dropped", async () => {
    const idb = fakeIndexedDB();
    globalThis.indexedDB = idb;
    try {
        const b = C.idbBackend(["tr"]);
        const a = new C.TieredCache(b, "tr", { version: 1 });
        assert.equal(await a.set("k", "value"), true);
        const again = new C.TieredCache(b, "tr", { version: 1 });
        assert.equal(await again.get("k"), "value");
        assert.equal(again.stats.l2, 1);
        const newer = new C.TieredCache(b, "tr", { version: 2 });
        assert.equal(await newer.get("k"), null, "version mismatch is a miss");
        await new Promise(r => setTimeout(r, 30));
        assert.equal(await b.get("tr", "k"), null, "the stale record was removed");
    } finally { delete globalThis.indexedDB; }
});

test("createCaches picks the idb backend when indexedDB exists, memory otherwise", async () => {
    const mem = C.createCaches();
    assert.equal(typeof mem.backend.listMeta, "function");
    assert.equal(await mem.tr.set("x", "y"), true);
    assert.equal(await mem.tr.get("x"), "y");
    globalThis.indexedDB = fakeIndexedDB();
    try {
        const c = C.createCaches();
        assert.notEqual(c.backend, mem.backend);
        await c.audio.set("s", "t");
        assert.equal(await new C.TieredCache(c.backend, "audio").get("s"), "t");
    } finally { delete globalThis.indexedDB; }
});
