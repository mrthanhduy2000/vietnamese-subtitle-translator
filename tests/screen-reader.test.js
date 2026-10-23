// screen-text.js createReader: the sampler loop against a fake <video> and canvas.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../screen-text.js");

// A caption is a few white bars on black; `frame` names which one is on screen (0 = none).
function setup(over = {}) {
    const scene = { frame: 0 };
    const draw = [];
    const mkCanvas = () => ({
        width: 0, height: 0,
        getContext() {
            const c = this;
            return {
                drawImage: (...a) => draw.push(a),
                getImageData: (x, y, w, h) => {
                    if (scene.taint) throw new Error("tainted");
                    const d = new Uint8ClampedArray(w * h * 4);
                    for (let i = 3; i < d.length; i += 4) d[i] = 255;
                    if (scene.frame) {
                        const x0 = scene.frame === 1 ? 60 : 260;
                        for (let row = 0; row < 3; row++) {
                            for (let yy = 20 + row * 12; yy < 28 + row * 12 && yy < h; yy++) {
                                for (let xx = x0; xx < x0 + 120 && xx < w; xx++) { const p = (yy * w + xx) * 4; d[p] = d[p + 1] = d[p + 2] = 255; }
                            }
                        }
                    }
                    return { data: d };
                }
            };
        },
        toDataURL: () => "data:image/jpeg;base64,AAAA"
    });
    globalThis.document = { createElement: () => mkCanvas() };
    const video = { videoWidth: 1920, videoHeight: 1080, currentTime: 0, paused: false, ...over };
    const shown = [], reads = [];
    return { scene, video, shown, reads, draw };
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

test("reader: a settled caption is read once, a repeat comes from memory, a blank clears", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const env = setup();
    try {
        const r = S.createReader({
            video: env.video,
            read: async img => { env.reads.push(img); return { text: "Hello", vi: "Xin chào" }; },
            show: x => env.shown.push(x)
        });
        const tickMs = async n => { for (let i = 0; i < n; i++) { env.video.currentTime += 0.25; t.mock.timers.tick(S.SAMPLE_MS); await Promise.resolve(); await Promise.resolve(); } };
        env.scene.frame = 1;
        await tickMs(3);
        assert.equal(env.reads.length, 1, "one crop sent");
        assert.match(env.reads[0], /^data:image\/jpeg/);
        assert.equal(env.shown.at(-1).vi, "Xin chào");
        await tickMs(3);
        assert.equal(env.reads.length, 1, "the same caption is not read again");
        env.scene.frame = 0;
        await tickMs(6);
        assert.equal(env.shown.at(-1), null, "blank frames clear the caption");
        env.scene.frame = 1;
        await tickMs(3);
        assert.equal(env.reads.length, 1, "the caption seen before comes from memory");
        assert.equal(env.shown.at(-1).vi, "Xin chào");
        env.scene.frame = 2;
        await tickMs(4);
        assert.equal(env.reads.length, 2, "a different caption is read");
        r.reset();
        assert.equal(env.shown.at(-1), null);
        r.stop();
        const n = env.draw.length;
        await tickMs(4);
        assert.equal(env.draw.length, n, "stopped means no more sampling");
    } finally { delete globalThis.document; }
});

test("reader: skip, paused video, missing size and a tainted canvas", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const env = setup();
    try {
        let skipping = true, err = null;
        const r = S.createReader({
            video: env.video, read: async () => null, show: x => env.shown.push(x),
            skip: () => skipping, onFrameError: e => { err = e; }
        });
        env.scene.frame = 1;
        t.mock.timers.tick(S.SAMPLE_MS * 3);
        assert.equal(env.draw.length, 0, "an ad is not sampled");
        skipping = false;
        env.video.paused = true; env.video.currentTime = 0;
        t.mock.timers.tick(S.SAMPLE_MS);
        const drawn = env.draw.length;
        t.mock.timers.tick(S.SAMPLE_MS * 3);
        assert.equal(env.draw.length, drawn, "paused at the same time: no new sample");
        env.video.videoWidth = 0;
        env.video.currentTime = 5;
        t.mock.timers.tick(S.SAMPLE_MS);
        assert.equal(env.draw.length, drawn, "no frame size yet");
        env.video.videoWidth = 1920;
        env.scene.taint = true;
        env.video.currentTime = 6;
        t.mock.timers.tick(S.SAMPLE_MS);
        assert.equal(err && err.message, "tainted");
        r.stop();
    } finally { delete globalThis.document; }
});

test("reader: a failing read shows nothing and a late answer for an old caption is dropped", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const env = setup();
    try {
        let release;
        let calls = 0;
        const r = S.createReader({
            video: env.video, show: x => env.shown.push(x),
            read: () => { calls++; return calls === 1 ? Promise.reject(new Error("net")) : new Promise(res => { release = () => res({ text: "Old", vi: "Cũ" }); }); }
        });
        const tickMs = async n => { for (let i = 0; i < n; i++) { env.video.currentTime += 0.25; t.mock.timers.tick(S.SAMPLE_MS); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); } };
        env.scene.frame = 1;
        await tickMs(3);
        assert.equal(calls, 1);
        assert.equal(env.shown.at(-1), null, "a failed read shows nothing");
        env.scene.frame = 2;
        await tickMs(3);
        assert.equal(calls, 2);
        env.scene.frame = 0;
        await tickMs(6);
        release();
        await Promise.resolve(); await Promise.resolve();
        assert.equal(env.shown.at(-1), null, "the late answer is not shown over a blank");
        r.stop();
    } finally { delete globalThis.document; }
});

test("onlyDubTranscripts: false without the language helper or a usable track", () => {
    assert.equal(S.onlyDubTranscripts([{}], {}, { kind: "asr" }), false);
    assert.equal(S.onlyDubTranscripts([], {}, { kind: "asr" }), false);
});
