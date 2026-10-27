// Worker timing must distinguish global queueing, synthesis and audio processing.
const test = require("node:test");
const assert = require("node:assert/strict");
const { bgEnv } = require("./bg-env.js");
const { createVieneuProvider } = require("../dub-engine.js");
const COST = require("../cost-policy.js");

function pcm(seconds = 2) {
    const data = Buffer.alloc(48000 * seconds * 2);
    for (let i = 0; i < data.length / 2; i++) data.writeInt16LE(Math.round(4000 * Math.sin(i * 0.04)), i * 2);
    return data;
}

test("serialized local jobs report queue wait separately, while cached takes do not create a timing sample", async () => {
    let sent = 0, firstStarted;
    const started = new Promise(resolve => { firstStarted = resolve; });
    const B = bgEnv(async url => {
        if (String(url).endsWith("/health")) return new Response(JSON.stringify({ active: 0, max_streams: 1 }));
        if (String(url).endsWith("/v1/audio/speech")) {
            sent++;
            if (sent === 1) { firstStarted(); await new Promise(resolve => setTimeout(resolve, 150)); }
            return new Response(pcm());
        }
        throw Error(`Unexpected request: ${url}`);
    });
    const req = key => ({ action: "synthesizeSpeech", engine: "vieneu", text: "Đây là một câu kiểm tra thời gian xếp hàng.", parts: [{ key, weight: 1 }] });
    const first = B.send(req("first"));
    await started;
    const second = B.send(req("second"));
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.ok, true, a.error);
    assert.equal(b.ok, true, b.error);
    assert.equal(a.timing.cold, true);
    assert.equal(b.timing.cold, false);
    assert.ok(b.timing.queueMs >= 100, JSON.stringify(b.timing));
    assert.ok(b.timing.generationMs < b.timing.queueMs, JSON.stringify(b.timing));
    assert.equal(b.timing.rawAudioSeconds, 2);
    assert.ok(b.timing.processingMs >= 0);
    const cached = await B.send(req("second"));
    assert.equal(cached.fromCache, true);
    assert.equal(cached.timing, undefined);
    assert.equal(sent, 2);
});

test("VieNeu provider carries worker timing to the scheduler unchanged", async () => {
    const timing = { cold: false, queueMs: 8000, generationMs: 900, processingMs: 20 };
    const provider = createVieneuProvider({ sendMessage: async () => ({ ok: true, timing, parts: [{ wav: Buffer.from([1, 2]).toString("base64"), duration: 2, sampleRate: 48000 }] }) }, { localVoice: COST.LOCAL_TTS.defaultVoice });
    const result = await provider.render([{ id: "p", speaker: "S1", text: "Xin chào.", phrases: [{ text: "Xin chào.", syl: 2 }], audioKey: "test" }]);
    assert.deepEqual(result[0].timing, timing);
});
