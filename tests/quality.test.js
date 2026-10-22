// 1.7.0: subtitle size rescale (old 70% = new 100%), reading time (lines linger), hiss removal.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../subtitle-style.js");
const A = require("../dub-audio.js");
const { read } = require("./bg-env.js");

test("size scale: the new 100% draws what the old 70% drew, the pickers use the new scale", () => {
    assert.equal(S.DEFAULT_STYLE.fontSize, 100);
    assert.equal(S.sizeFactor(100), 0.7);
    assert.ok(Math.abs(S.sizeFactor(130) - 0.91) < 1e-9);
    assert.equal(S.normalizeStyle({ fontSize: 300 }).fontSize, 300);
    const html = read("options.html");
    assert.match(html, /<option value="100" selected>100% \(Khuyên dùng\)<\/option>/);
    for (const f of ["youtube.js", "content.js"]) assert.match(read(f), /label: "Cỡ chữ", min: 50, max: 300, step: 10/, f);
    // every place that turns the size into pixels goes through sizeFactor
    assert.match(read("youtube.js"), /window\.CST_STYLE\.sizeFactor\(ytSubStyle\.fontSize\)/);
    assert.match(read("content.js"), /base \* S\.sizeFactor\(s\.fontSize\)/);
    assert.match(read("options.js"), /15\.5 \* S\.sizeFactor\(s\.fontSize\)/);
    assert.doesNotMatch(read("options.js"), /15\.5 \* \(s\.fontSize \/ 100\)/);
});

test("lines linger into the gap after them, never over the next line, and only once", () => {
    const cues = [{ start: 0, end: 1 }, { start: 1.3, end: 2 }, { start: 5, end: 6 }];
    S.lingerCues(cues);
    // (2.7.1) 0.06 before the next line would blank the screen for 60 ms: the line stays until it
    assert.equal(+cues[0].end.toFixed(2), 1.3, "no blink before the next line");
    const far = S.lingerCues([{ start: 0, end: 1 }, { start: 2, end: 3 }]);
    assert.equal(+far[0].end.toFixed(2), 1.7, "a long silence still blanks after 0.7 s");
    const near = S.lingerCues([{ start: 0, end: 1 }, { start: 1.03, end: 2 }]);
    assert.equal(+near[0].end.toFixed(2), 1.03, "a 30 ms gap in the subtitle closes too");
    assert.equal(+cues[1].end.toFixed(2), 2.7, "up to 0.7 s into a long gap");
    assert.equal(+cues[2].end.toFixed(2), 6.7);
    S.lingerCues(cues);
    assert.equal(+cues[1].end.toFixed(2), 2.7, "idempotent");
    assert.equal(cues[1].baseEnd, 2);
    // the cache stores the subtitle's own end, the voice keeps its timing
    assert.match(read("youtube.js"), /r\(c\.baseEnd != null \? c\.baseEnd : c\.end\)/);
    assert.match(read("youtube.js"), /lingerCues\(all\.map\(c => \(\{ \.\.\.c \}\)\)\)/);
});

function toneWithHiss(sr, hiss) {
    const n = sr * 3, x = new Float32Array(n);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
    for (let i = 0; i < n; i++) {
        const t = i / sr;
        const on = (t > 0.3 && t < 1.2) || (t > 1.8 && t < 2.6);
        x[i] = (on ? 0.25 * Math.sin(2 * Math.PI * 200 * t) + 0.12 * Math.sin(2 * Math.PI * 400 * t) : 0) + hiss * rnd();
    }
    return x;
}
const level = (y, sr, a, b) => { let q = 0; for (let i = Math.round(a * sr); i < Math.round(b * sr); i++) q += y[i] * y[i]; return 10 * Math.log10(q / ((b - a) * sr)); };

test("denoise pulls a steady hiss down in the gaps and keeps the voice", () => {
    const sr = 16000;
    const x = toneWithHiss(sr, 0.004);
    const r = A.denoise(x, sr);
    assert.equal(r.applied, true);
    assert.ok(level(r.samples, sr, 1.35, 1.65) < level(x, sr, 1.35, 1.65) - 8, "gap hiss not reduced");
    assert.ok(Math.abs(level(r.samples, sr, 0.5, 1.0) - level(x, sr, 0.5, 1.0)) < 0.5, "voice level changed");
});

test("denoise leaves a clean take alone", () => {
    const r = A.denoise(toneWithHiss(16000, 0.00002), 16000);
    assert.equal(r.applied, false);
    assert.equal(r.reason, "clean");
});

test("fft round trip is exact", () => {
    const re = Float64Array.from({ length: 64 }, (_, i) => Math.sin(i) + (i % 5)), im = new Float64Array(64);
    const orig = Float64Array.from(re);
    A.fft(re, im, false); A.fft(re, im, true);
    assert.ok(orig.every((v, i) => Math.abs(v - re[i]) < 1e-9));
});

test("wiring: VieNeu takes are cleaned before they are cut, Mỹ Duyên set once", () => {
    const bg = read("background.js");
    assert.match(bg, /if \(opts\.clean && AUDIO\.cleanTake\) samples = AUDIO\.cleanTake\(samples, sr, \{ hpHz: opts\.hpHz \}\)\.samples;/);
    assert.ok(bg.indexOf("AUDIO.cleanTake(samples, sr") < bg.indexOf("AUDIO.splitBySilence(samples, sr"));
    assert.match(bg, /voiceMyDuyen170: true, dubLocalVoice: COST\.LOCAL_TTS\.defaultVoice/);
});
