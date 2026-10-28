const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const CACHE = require("../cst-cache.js");
const { bgEnv, read } = require("./bg-env.js");
const copy = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));

async function truth(backend, store = "tr") {
    const records = await backend.listMeta(store);
    return { bytes: records.reduce((n, r) => n + r.size, 0), count: records.length };
}

test("cache counts the first write once and keeps all records below its cap", async () => {
    const backend = CACHE.memoryBackend();
    const cache = new CACHE.TieredCache(backend, "tr", { maxBytes: 100 });
    for (const key of ["a", "b", "c"]) {
        assert.equal(await cache.set(key, "x".repeat(15)), true);
        assert.deepEqual(cache.totals, await truth(backend));
    }
    assert.deepEqual(cache.totals, { bytes: 90, count: 3 });
    assert.equal(cache.stats.evicted, 0);
    await cache.set("d", "x".repeat(15));
    assert.deepEqual(cache.totals, { bytes: 60, count: 2 });
    assert.equal(cache.stats.evicted, 2, "a real overflow evicts down to 85 percent");
});

test("cache replacement after a worker restart counts only the size difference", async () => {
    const backend = CACHE.memoryBackend();
    await new CACHE.TieredCache(backend, "tr").set("a", "old");
    const restarted = new CACHE.TieredCache(backend, "tr");
    await restarted.set("a", "longer");
    assert.deepEqual(restarted.totals, { bytes: 12, count: 1 });
    await restarted.set("a", "x");
    assert.deepEqual(restarted.totals, { bytes: 2, count: 1 });
});

test("concurrent writes, replacements, info and removal keep exact cache totals", async () => {
    const backend = CACHE.memoryBackend();
    for (const method of ["get", "put", "del", "listMeta", "clear"]) {
        const original = backend[method].bind(backend);
        backend[method] = async (...args) => { await tick(); return original(...args); };
    }
    const cache = new CACHE.TieredCache(backend, "tr");
    await Promise.all([
        cache.set("same", "a"), cache.set("same", "abc"), cache.set("other", "xx"),
        cache.info(), cache.remove(["other"]), cache.set("last", "z")
    ]);
    assert.deepEqual(cache.totals, { bytes: 8, count: 2 });
    assert.deepEqual(cache.totals, await truth(backend));
    assert.equal((await backend.get("tr", "same")).value, "abc");
    await Promise.all([cache.set("before", "x"), cache.clear(), cache.set("after", "yy")]);
    assert.deepEqual(cache.totals, { bytes: 4, count: 1 });
    assert.deepEqual([...cache.mem.keys()], ["after"]);
});

test("failed cache writes do not poison totals or prevent the next write", async () => {
    const backend = CACHE.memoryBackend();
    const put = backend.put.bind(backend);
    let fail = true;
    backend.put = async (...args) => { if (fail) { fail = false; throw new Error("disk full"); } return put(...args); };
    const cache = new CACHE.TieredCache(backend, "tr");
    assert.equal(await cache.set("a", "xx"), false);
    assert.equal(await cache.set("b", "y"), true);
    assert.deepEqual(cache.totals, { bytes: 2, count: 1 });
    assert.deepEqual(cache.totals, await truth(backend));
});

test("a timed-out cache write finishes before a later clear and write", async () => {
    const sandbox = vm.createContext({ module: { exports: {} }, setTimeout: (f, ms) => setTimeout(f, ms === 3000 ? 15 : ms), clearTimeout, Map, Set, ArrayBuffer, Uint8Array });
    vm.runInContext(read("cst-cache.js"), sandbox);
    const C = sandbox.module.exports;
    const backend = CACHE.memoryBackend();
    const put = backend.put.bind(backend);
    let release;
    backend.put = async (...args) => {
        if (args[1] === "slow") await new Promise(resolve => { release = resolve; });
        return put(...args);
    };
    const cache = new C.TieredCache(backend, "tr");
    assert.equal(await cache.set("slow", "xx"), false);
    const clear = cache.clear();
    const next = cache.set("next", "y");
    release();
    await Promise.all([clear, next]);
    assert.deepEqual(copy(cache.totals), { bytes: 2, count: 1 });
    assert.equal(await backend.get("tr", "slow"), null);
});

// Execute the actual autosave block, with a mutable form and the real worker router.
function formEnv(initial, send) {
    const source = read("options.js");
    const form = copy(initial);
    const messages = [];
    const sandbox = vm.createContext({
        clearTimeout, Promise, Date, JSON, Object, Error,
        statusEl: { textContent: "", classList: { add() {} } },
        collectSettings: () => copy(form),
        bgSend: async msg => { messages.push(copy(msg)); return send(msg); }
    });
    vm.runInContext(source.slice(source.indexOf("    let saveTimer = null;"), source.indexOf("    function scheduleSave()")), sandbox);
    sandbox.initial = JSON.stringify(initial);
    vm.runInContext("lastSaved = initial", sandbox);
    return { form, messages, save: () => sandbox.saveNow(), sandbox };
}

const initial = { dualMode: true, dubEnabled: true, geminiApiKey: "test-key", subStyle: { mode: "dual", fontSize: 100, fontColor: "white" } };

test("an unrelated Settings edit preserves newer popup choices and the API key", async () => {
    const bg = bgEnv(() => { throw new Error("No network expected"); }, copy(initial));
    const page = formEnv(initial, bg.send);
    Object.assign(bg.syncStore, { dualMode: false, geminiApiKey: "new-key" });
    page.form.dubEnabled = false;
    await page.save();
    assert.equal(bg.syncStore.dualMode, false);
    assert.equal(bg.syncStore.geminiApiKey, "new-key");
    assert.equal(bg.syncStore.dubEnabled, false);
    assert.deepEqual(page.messages[0].values, { dubEnabled: false });
    await page.save();
    assert.equal(page.messages.length, 1, "an unchanged form makes no write");
});

test("two Settings pages and a player merge independent style edits", async () => {
    const bg = bgEnv(() => {}, copy(initial));
    // Force reads to overlap unless the worker serializes the entire read/merge/write.
    const get = bg.sandbox.chrome.storage.sync.get;
    bg.sandbox.chrome.storage.sync.get = (keys, cb) => get(keys, data => setImmediate(() => cb(copy(data))));
    const a = formEnv(initial, bg.send), b = formEnv(initial, bg.send);
    a.form.subStyle.fontSize = 140;
    b.form.subStyle.fontColor = "yellow";
    await Promise.all([a.save(), b.save(), bg.send({ action: "settingsPatch", values: { subStyle: { mode: "single" }, dualMode: false } })]);
    assert.deepEqual(copy(bg.syncStore.subStyle), { mode: "single", fontSize: 140, fontColor: "yellow" });
    assert.equal(bg.syncStore.dualMode, false);
});

test("rapid Settings edits persist the newest value after a slow save", async () => {
    const bg = bgEnv(() => {}, copy(initial));
    let release;
    const page = formEnv(initial, async msg => {
        if (!release) await new Promise(resolve => { release = resolve; });
        return bg.send(msg);
    });
    page.form.subStyle.fontSize = 120;
    const first = page.save();
    await tick();
    page.form.subStyle.fontSize = 160;
    const second = page.save();
    release();
    await Promise.all([first, second]);
    assert.equal(bg.syncStore.subStyle.fontSize, 160);
    assert.equal(page.messages.length, 2);
});

test("a failed Settings save stays dirty and can retry; frozen forms cannot write", async () => {
    let fail = true;
    const bg = bgEnv(() => {}, copy(initial));
    const page = formEnv(initial, msg => fail ? { ok: false, error: "quota" } : bg.send(msg));
    page.form.dubEnabled = false;
    await page.save();
    assert.match(page.sandbox.statusEl.textContent, /quota/);
    assert.equal(bg.syncStore.dubEnabled, true);
    fail = false;
    await page.save();
    assert.equal(bg.syncStore.dubEnabled, false);
    vm.runInContext("saveFrozen = true", page.sandbox);
    page.form.dubEnabled = true;
    await page.save();
    assert.equal(bg.syncStore.dubEnabled, false);
});

test("worker settings writes recover after storage failure and reject unsafe keys", async () => {
    const bg = bgEnv(() => {}, copy(initial));
    const set = bg.sandbox.chrome.storage.sync.set;
    bg.sandbox.chrome.storage.sync.set = (data, cb) => {
        bg.sandbox.chrome.runtime.lastError = { message: "quota" };
        cb();
        bg.sandbox.chrome.runtime.lastError = null;
    };
    assert.equal((await bg.send({ action: "settingsPatch", values: { dubEnabled: false } })).ok, false);
    bg.sandbox.chrome.storage.sync.set = set;
    assert.equal((await bg.send({ action: "settingsPatch", values: { dubEnabled: false } })).ok, true);
    for (const values of [[], { subStyle: [] }, JSON.parse('{"__proto__":{"bad":true}}')]) {
        assert.equal((await bg.send({ action: "settingsPatch", values })).ok, false);
    }
});

test("a stale-version read cannot delete a newer replacement", async () => {
    const backend = CACHE.memoryBackend();
    await new CACHE.TieredCache(backend, "tr", { version: 1 }).set("key", "old");
    const original = backend.get.bind(backend);
    let release, delayed = false;
    backend.get = async (...args) => {
        const result = await original(...args);
        if (!delayed) {
            delayed = true;
            await new Promise(resolve => { release = resolve; });
        }
        return result;
    };
    const cache = new CACHE.TieredCache(backend, "tr", { version: 2 });
    const stale = cache.get("key");
    await tick();
    await cache.set("key", "newer");
    release();
    assert.equal(await stale, null);
    await cache.info();
    assert.equal((await original("tr", "key")).value, "newer");
    assert.deepEqual(cache.totals, { bytes: 10, count: 1 });
});

test("queued form saves are discarded after a restore freezes the form", async () => {
    const bg = bgEnv(() => {}, copy(initial));
    let release;
    const page = formEnv(initial, async msg => {
        await new Promise(resolve => { release = resolve; });
        return bg.send(msg);
    });
    page.form.dubEnabled = false;
    const first = page.save();
    await tick();
    page.form.geminiApiKey = "unsaved-form-key";
    const queued = page.save();
    vm.runInContext("saveFrozen = true", page.sandbox);
    release();
    await Promise.all([first, queued]);
    assert.equal(page.messages.length, 1);
    assert.equal(bg.syncStore.geminiApiKey, "test-key");
});

test("a failed settings read never replaces an existing style with a partial object", async () => {
    const bg = bgEnv(() => {}, copy(initial));
    const before = copy(bg.syncStore.subStyle);
    bg.sandbox.chrome.storage.sync.get = (keys, cb) => {
        bg.sandbox.chrome.runtime.lastError = { message: "read failed" };
        cb(undefined);
        bg.sandbox.chrome.runtime.lastError = null;
    };
    const result = await bg.send({ action: "settingsPatch", values: { subStyle: { fontSize: 200 } } });
    assert.equal(result.ok, false);
    assert.deepEqual(copy(bg.syncStore.subStyle), before);
});
