// popup.js: the Settings link fallbacks, the shortcut hint, "forget audio", and the activation errors.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));

function popup({ url = "https://www.youtube.com/watch?v=abc", chromeOver = {}, sync = {}, loadShortcuts = true, tabMessage } = {}) {
    const els = new Map();
    const made = [];
    const mk = id => {
        const handlers = {}, cls = new Set(), kids = [];
        return {
            id, hidden: false, textContent: "", innerHTML: "", checked: false, disabled: false, style: {}, dataset: {}, className: "",
            classList: { add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), toggle: (c, on = !cls.has(c)) => (on ? cls.add(c) : cls.delete(c), on), contains: c => cls.has(c) },
            addEventListener: (t, f) => { handlers[t] = f; }, handlers, setAttribute() {}, getAttribute: () => null,
            querySelector: () => el(`${id} >`), querySelectorAll: () => [], appendChild(k) { kids.push(k); }, kids,
            append(...a) { a.forEach(x => kids.push(x)); }
        };
    };
    const el = id => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); };
    const ready = [], opened = [], created = [], injected = [];
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: (f, ms) => setTimeout(f, (ms || 0) / 100), clearTimeout, setInterval: () => 0, clearInterval() {},
        Promise, Math, JSON, Date, URLSearchParams,
        open: (...a) => opened.push(a),
        document: {
            addEventListener: (t, f) => { if (t === "DOMContentLoaded") ready.push(f); },
            getElementById: el, querySelector: s => el(s), querySelectorAll: () => [],
            createElement: tag => { const e = mk("new:" + tag); made.push(e); return e; }, body: el("body")
        },
        chrome: {
            storage: { sync: { get: async d => ({ ...d, ...sync }), set: async () => {} }, onChanged: { addListener() {} } },
            tabs: {
                query: async () => [{ id: 7, url }],
                sendMessage: tabMessage || (async (id, m) => (m.method === "getStatus" ? null : { ok: true })),
                create: o => created.push(o)
            },
            scripting: { executeScript: async o => { injected.push(o); } },
            runtime: {
                lastError: null, sendMessage: (m, cb) => cb && cb({ ok: false }), getURL: p => "chrome-extension://x/" + p, openOptionsPage: cb => cb && cb(),
                getManifest: () => ({ version: "x", content_scripts: [{ js: ["content.js"] }] })
            },
            ...chromeOver
        }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    if (loadShortcuts) vm.runInContext(read("shortcuts.js"), sandbox);
    vm.runInContext(read("popup.js"), sandbox);
    return { el, made, opened, created, injected, sandbox, run: () => ready[0]() };
}

test("settings link: openOptionsPage, then tabs.create, then window.open, then the error path", async () => {
    const a = popup();
    await a.run();
    a.el("headerSettingsBtn").handlers.click({ preventDefault() {} });
    assert.equal(a.created.length, 0, "openOptionsPage worked, nothing else was needed");

    const b = popup();
    b.sandbox.chrome.runtime.openOptionsPage = cb => { b.sandbox.chrome.runtime.lastError = { message: "x" }; cb(); };
    await b.run();
    b.el("headerSettingsBtn").handlers.click({ preventDefault() {} });
    assert.equal(b.created[0].url, "chrome-extension://x/options.html", "lastError falls back to a new tab");

    const c = popup();
    delete c.sandbox.chrome.runtime.openOptionsPage;
    await c.run();
    c.el("headerSettingsBtn").handlers.click({ preventDefault() {} });
    assert.equal(c.created.length, 1);

    const d = popup();
    delete d.sandbox.chrome.runtime.openOptionsPage;
    delete d.sandbox.chrome.tabs.create;
    await d.run();
    d.el("headerSettingsBtn").handlers.click({ preventDefault() {} });
    assert.deepEqual([...d.opened[0]], ["options.html", "_blank"]);

    const e = popup();
    e.sandbox.chrome.runtime.openOptionsPage = () => { throw new Error("boom"); };
    e.sandbox.chrome.tabs.create = () => { throw new Error("boom2"); };
    await e.run();
    e.el("headerSettingsBtn").handlers.click({ preventDefault() {} });
    assert.equal(e.opened.length, 1, "every route failed: the last resort opens the page");
});

test("shortcut hint: a pointer to Settings when none is set, the keys when some are", async () => {
    const none = popup();
    await none.run();
    const hint = none.el("shortcutHint");
    assert.equal(hint.kids.length, 2, "text and the 'set shortcuts' button");
    const btn = none.made.find(m => m.textContent === "Đặt phím tắt");
    assert.ok(btn, "the link button exists");
    btn.handlers.click();

    const SC = require("../shortcuts.js");
    const some = popup({ sync: { [SC.KEY]: { "bat-tat-phu-de": { code: "KeyS", alt: true }, "bat-tat-long-tieng": { code: "KeyD", alt: true } } } });
    await some.run();
    const kids = some.el("shortcutHint").kids;
    assert.equal(kids[0], "Phím tắt: ");
    assert.ok(kids.includes(" · "), "two shortcuts are separated");
    assert.ok(some.made.filter(m => m.textContent).length >= 2, "one <kbd> per shortcut");
    assert.ok(kids.some(k => typeof k === "string" && k.includes("phụ đề")));
});

test("forget audio: reports the count, the page's error, or that dubbing is off", async () => {
    const run = async reply => {
        const P = popup({ tabMessage: async (id, m) => { if (m.method === "getStatus") return null; if (reply instanceof Error) throw reply; return reply; } });
        await P.run();
        await P.el("forgetAudio").handlers.click();
        return P.el("status").textContent;
    };
    assert.match(await run({ ok: true, removed: 12 }), /Đã xóa 12 đoạn audio/);
    assert.equal(await run({ ok: false, error: "Không có video" }), "Không có video");
    assert.equal(await run(null), "Chưa bật lồng tiếng trên tab này.");
    assert.equal(await run(new Error("no receiver")), "Chưa bật lồng tiếng trên tab này.");
});

test("translate button: a page that blocks scripts, a dead tab, and an unknown error each get a plain message", async () => {
    const attempt = async (url, { sendFails, injectFails }) => {
        const P = popup({
            url,
            tabMessage: async (id, m) => { if (m.method === "getStatus") return null; if (sendFails) throw new Error(sendFails); return { status: "ok" }; },
            chromeOver: { scripting: { executeScript: async () => { if (injectFails) throw new Error(injectFails); } } }
        });
        await P.run();
        await P.el("translateBtn").handlers.click();
        return P;
    };
    let P = await attempt("chrome://extensions", {});
    assert.match(P.el("status").textContent, /Hãy mở một trang có video/);
    P = await attempt("https://www.youtube.com/watch?v=a", { sendFails: "no receiver", injectFails: "Cannot access contents of the page" });
    assert.match(P.el("status").textContent, /không cho tiện ích chạy/);
    P = await attempt("https://www.youtube.com/watch?v=a", { sendFails: "no receiver", injectFails: "Receiving end does not exist" });
    assert.match(P.el("status").textContent, /Tải lại trang \(F5\)/);
    P = await attempt("https://example.com/v", { sendFails: "no receiver", injectFails: "weird failure" });
    assert.equal(P.el("status").textContent, "Không thể kích hoạt: weird failure");
    P = await attempt("https://example.com/v", { sendFails: "no receiver", injectFails: "" });
    assert.equal(P.el("status").textContent, "Không thể kích hoạt: no receiver", "scripts injected, the retry failed too");
});

test("translate button: when the first message fails the scripts are injected and the message is sent again", async () => {
    let first = true;
    const P = popup({
        tabMessage: async (id, m) => { if (m.method === "getStatus") return null; if (first) { first = false; throw new Error("no receiver"); } return { status: "ok" }; }
    });
    await P.run();
    await P.el("translateBtn").handlers.click();
    assert.deepEqual(P.injected.map(i => i.world || "iso"), ["MAIN", "iso"], "the YouTube bridge first, then the content scripts");
    assert.deepEqual([...P.injected[1].files], ["content.js"]);
    assert.match(P.el("status").textContent, /Đang xử lý/);
    await tick(40);
});
