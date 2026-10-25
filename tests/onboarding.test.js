// First-run onboarding page: opened on install, key test, voice check, sample video, contrast.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

function fakeDom(ids) {
    const els = {};
    for (const id of ids) {
        const listeners = {};
        els[id] = {
            id, value: "", textContent: "", className: "", hidden: false, disabled: false, dataset: {},
            classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
            addEventListener(t, fn) { listeners[t] = fn; }, focus() {}, listeners
        };
    }
    return els;
}

function run({ reply, stored = {} }) {
    const els = fakeDom(["apiKey", "btnTest", "keyStatus", "stepKey", "voiceStatus", "voiceHelp", "voiceCmd", "stepVoice", "btnVoice", "stepper", "dotKey", "dotVoice"]);
    const saved = {};
    const sandbox = {
        document: { getElementById: id => els[id] },
        window: {},
        chrome: {
            runtime: { lastError: null, sendMessage: (msg, cb) => Promise.resolve(reply(msg)).then(cb) },
            storage: { sync: { set: async o => Object.assign(saved, o), get: (d, cb) => cb({ ...d, ...stored }) } }
        },
        setTimeout
    };
    sandbox.window = sandbox;
    vm.runInNewContext(R("onboarding.js"), sandbox);
    return { els, saved };
}
const tick = () => new Promise(r => setTimeout(r, 10));

test("onboarding: page is wired to its script, theme, shim and the shared cost policy; no inline script", () => {
    const html = R("onboarding.html");
    for (const s of ["chrome-shim.js", "theme.js", "cost-policy.js", "onboarding.js"]) assert.ok(html.includes(`src="${s}"`), s);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, "extension CSP forbids inline script");
    assert.match(html, /https:\/\/aistudio\.google\.com\/apikey/);
    assert.match(html, /youtube\.com\/watch\?v=[\w-]{11}/, "sample video link");
});

test("onboarding: a good key is saved only after the test passes, and the step turns done", async () => {
    const { els, saved } = run({ reply: m => (m.action === "testKey" ? { ok: true, model: "gemini-x" } : { ok: true, running: false }) });
    els.apiKey.value = "  AIzaTest  ";
    els.btnTest.listeners.click();
    await tick();
    assert.equal(saved.geminiApiKey, "AIzaTest");
    assert.ok(els.stepKey.classList.contains("done"));
    assert.match(els.keyStatus.textContent, /hoạt động.*gemini-x/);
});

test("onboarding: a rejected key is not saved and the reason is plain Vietnamese", async () => {
    const { els, saved } = run({ reply: m => (m.action === "testKey" ? { ok: false, errorType: "auth", error: "x" } : { ok: true, running: false }) });
    els.apiKey.value = "bad";
    els.btnTest.listeners.click();
    await tick();
    assert.equal(saved.geminiApiKey, undefined);
    assert.match(els.keyStatus.className, /err/);
    assert.match(els.keyStatus.textContent, /không nhận khóa/);
    assert.equal(els.btnTest.disabled, false);
});

test("onboarding: an empty field asks for a key without calling the service worker", async () => {
    let calls = 0;
    const { els } = run({ reply: m => { if (m.action === "testKey") calls++; return { ok: true, running: false }; } });
    els.btnTest.listeners.click();
    await tick();
    assert.equal(calls, 0);
    assert.match(els.keyStatus.textContent, /Chưa dán/);
});

test("onboarding: voice server running marks the step done; not running shows how to start it", async () => {
    const up = run({ reply: () => ({ ok: true, running: true }) });
    await tick();
    assert.ok(up.els.stepVoice.classList.contains("done"));
    assert.equal(up.els.voiceHelp.hidden, true);
    const down = run({ reply: () => ({ ok: true, running: false }) });
    await tick();
    assert.equal(down.els.voiceHelp.hidden, false);
    assert.doesNotMatch(down.els.voiceStatus.className, /err/, "no voice is not an error");
});

test("onboarding: the stepper dot and the line follow the set-up steps", async () => {
    const { els } = run({ reply: () => ({ ok: true, running: true }), stored: { geminiApiKey: "AIzaSECRET" } });
    await tick();
    assert.ok(els.dotKey.classList.contains("done"));
    assert.ok(els.dotVoice.classList.contains("done"));
    assert.equal(els.stepper.dataset.done, "2");
});

test("onboarding: a rejected key after a saved one clears the done state on card and dot", async () => {
    const { els } = run({ reply: m => (m.action === "testKey" ? { ok: false, errorType: "auth" } : { ok: true, running: false }), stored: { geminiApiKey: "AIzaOLD" } });
    await tick();
    els.apiKey.value = "bad";
    els.btnTest.listeners.click();
    await tick();
    assert.equal(els.stepKey.classList.contains("done"), false);
    assert.equal(els.dotKey.classList.contains("done"), false);
    assert.equal(els.stepper.dataset.done, "0");
});

test("onboarding: an existing saved key shows the step as done without echoing the key", async () => {
    const { els } = run({ reply: () => ({ ok: true, running: false }), stored: { geminiApiKey: "AIzaSECRET" } });
    await tick();
    assert.ok(els.stepKey.classList.contains("done"));
    assert.equal(els.apiKey.value, "");
    assert.doesNotMatch(els.keyStatus.textContent, /SECRET/);
});

test("onboarding: text and button colours reach 4.5:1 in light and dark", () => {
    const html = R("onboarding.html");
    const lum = hex => {
        const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const tokens = block => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
    const lightStart = html.indexOf(":root {");
    const light = tokens(html.slice(lightStart, html.indexOf("@media", lightStart)));
    const darkStart = html.indexOf(':root[data-theme="dark"]');
    const dark = tokens(html.slice(darkStart, html.indexOf("* {", darkStart)));
    const darkMedia = tokens(html.slice(html.indexOf("@media (prefers-color-scheme: dark)"), darkStart));
    assert.deepEqual(dark, darkMedia, "forced dark and system dark must agree");
    for (const [name, t] of [["light", light], ["dark", dark]]) {
        for (const fg of ["text", "text-2", "link"]) for (const bg of ["bg", "card", "subtle"]) assert.ok(ratio(t[fg], t[bg]) >= 4.5, `${name}: ${fg} on ${bg}`);
        assert.ok(ratio("#FFFFFF", t["accent-fill"]) >= 4.5 && ratio("#FFFFFF", t["accent-fill-hover"]) >= 4.5, `${name}: white on primary button`);
        assert.ok(ratio(t.ok, t["ok-bg"]) >= 4.5, `${name}: ok status`);
        assert.ok(ratio(t.err, t["err-bg"]) >= 4.5, `${name}: error status`);
        assert.ok(ratio(t["on-ok"], t.ok) >= 4.5, `${name}: text on the done check`);
    }
});
