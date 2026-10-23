// Service worker lifecycle: content.js retries a request that hit a sleeping worker, never one
// that hit a dead extension context.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

function env(sendMessage) {
    const noop = () => {};
    const node = tag => ({ tag, style: {}, className: "", children: [], dataset: {}, appendChild(c) { return c; }, querySelector() { return null; }, querySelectorAll() { return []; } });
    const S = {
        console: { log: noop, warn: noop, error: noop }, setTimeout: (f) => setTimeout(f, 0), clearTimeout, setInterval: () => 0, clearInterval: noop, URL,
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number, Error, TextEncoder, crypto: globalThis.crypto,
        location: { href: "https://www.coursera.org/learn/x/lecture/y", hostname: "www.coursera.org", pathname: "/learn/x/lecture/y" },
        document: { readyState: "loading", title: "t", body: node("body"), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], getElementsByTagName: () => [], createElement: node, head: { appendChild: noop }, documentElement: { appendChild: noop }, addEventListener: noop, fonts: null },
        addEventListener: noop, postMessage: noop, MutationObserver: class { observe() {} disconnect() {} }, alert: noop,
        requestAnimationFrame: () => 0, cancelAnimationFrame: noop, getComputedStyle: () => ({ position: "relative" }),
        chrome: {
            storage: { sync: { get: async d => ({ ...(Array.isArray(d) ? {} : d) }), set: async () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener: noop } },
            runtime: { lastError: null, onMessage: { addListener: noop }, getURL: p => p, sendMessage }
        }
    };
    S.window = S; S.globalThis = S;
    vm.createContext(S);
    for (const f of ["glossary.js", "cst-cache.js", "cost-policy.js", "lang-detect.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js"]) vm.runInContext(read(f), S);
    return S;
}

test("sendMessageAsync retries a sleeping worker (receiving end missing) and then succeeds", async () => {
    let calls = 0;
    const S = env(function (m, cb) {
        calls++;
        if (calls < 3) { S.chrome.runtime.lastError = { message: "Could not establish connection. Receiving end does not exist." }; cb(); S.chrome.runtime.lastError = null; }
        else cb({ ok: true, translations: ["x"] });
    });
    const r = await vm.runInContext("sendMessageAsync({ action: 'translate' })", S);
    assert.equal(r.translations[0], "x");
    assert.equal(calls, 3);
});

test("sendMessageAsync retries a port closed mid-request once the worker is back", async () => {
    let calls = 0;
    const S = env(function (m, cb) {
        calls++;
        if (calls === 1) { S.chrome.runtime.lastError = { message: "The message port closed before a response was received." }; cb(); S.chrome.runtime.lastError = null; }
        else cb({ ok: true });
    });
    await vm.runInContext("sendMessageAsync({ action: 'translate' })", S);
    assert.equal(calls, 2);
});

test("sendMessageAsync does not retry a dead extension context and gives up after two retries", async () => {
    let calls = 0;
    const dead = env(() => { calls++; throw new Error("Extension context invalidated."); });
    await assert.rejects(vm.runInContext("sendMessageAsync({ action: 'x' })", dead), /context invalidated/i);
    assert.equal(calls, 1);

    calls = 0;
    const S = env(function (m, cb) { calls++; S.chrome.runtime.lastError = { message: "Could not establish connection. Receiving end does not exist." }; cb(); S.chrome.runtime.lastError = null; });
    await assert.rejects(vm.runInContext("sendMessageAsync({ action: 'x' })", S), /receiving end/i);
    assert.equal(calls, 3);
});

test("sendMessageAsync does not retry a real error answer from the worker", async () => {
    let calls = 0;
    const S = env((m, cb) => { calls++; cb({ ok: false, error: "API Key sai" }); });
    await assert.rejects(vm.runInContext("sendMessageAsync({ action: 'x' })", S), /API Key/);
    assert.equal(calls, 1);
});
