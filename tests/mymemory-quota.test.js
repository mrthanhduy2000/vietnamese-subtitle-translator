// MyMemory answers HTTP 200 with its quota/error notice as the "translation". It must never reach the screen.
const test = require("node:test");
const assert = require("node:assert/strict");
const { bgEnv } = require("./bg-env.js");

const REQ = { action: "translateUnit", sentences: ["Hello there."], context: { domain: "AI" } };
const mm = (translatedText, responseStatus) => ({ ok: true, status: 200, json: async () => ({ responseData: { translatedText }, responseStatus }) });
const server = body => async u => {
    if (u.includes("mymemory")) return body;
    return { ok: false, status: 503, statusText: "x", json: async () => ({}) };
};

test("MyMemory quota notice is not used as a translation", async () => {
    const notice = "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN 05 HOURS 12 MINUTES";
    const r = await bgEnv(server(mm(notice, 429)), {}, { timeScale: 0.01 }).send(REQ);
    for (const t of r.translations || []) assert.ok(!/MYMEMORY/i.test(t), "quota notice shown as subtitle: " + t);
});

test("MyMemory real translation still works", async () => {
    const r = await bgEnv(server(mm("Xin chào.", 200)), {}, { timeScale: 0.01 }).send(REQ);
    assert.deepEqual(r.translations, ["Xin chào."]);
});

test("MyMemory echoing a non-English source back is not a translation", async () => {
    const src = "你好，欢迎来到这个课程。";
    const r = await bgEnv(server(mm(src, 200)), {}, { timeScale: 0.01 }).send({ ...REQ, sentences: [src] });
    for (const t of r.translations || []) assert.notEqual(t, src, "source shown as its own translation");
});
