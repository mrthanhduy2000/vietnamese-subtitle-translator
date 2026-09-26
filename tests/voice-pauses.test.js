// 1.6.7: the voice pauses only where the text has punctuation (the hiss gate tested here was removed
// in 1.7.3), a sentence split across two translation groups is read in one go (free voice), 48 kHz.
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../dub-audio.js");
const PLAN = require("../dub-planner.js");
const { read } = require("./bg-env.js");

const SR = 16000;
// synthetic speech: a 180 Hz tone for each word run, silences of the given lengths between runs
function speech(runs, gaps, noise = 0) {
    const parts = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
    runs.forEach((sec, k) => {
        const n = Math.round(sec * SR);
        const a = new Float32Array(n);
        for (let i = 0; i < n; i++) a[i] = 0.3 * Math.sin(2 * Math.PI * 180 * i / SR) + noise * rnd();
        parts.push(a);
        if (k < gaps.length) {
            const g = new Float32Array(Math.round(gaps[k] * SR));
            for (let i = 0; i < g.length; i++) g[i] = noise * rnd();
            parts.push(g);
        }
    });
    const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
    let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}
const pauses = x => A.findSilences(x, SR, { minMs: 60 }).filter(s => s.start > 0.05 && s.end < x.length / SR - 0.05).map(s => +s.dur.toFixed(2));

test("a stop the text does not ask for is closed; the comma and the full stop keep their pause", () => {
    // 8 equal words per run: "... lớn [stop] ... gian, [stop] ... học. [stop] ... cao [stop] ..."
    const text = "một hai ba bốn năm sáu bảy tám chín mười một hai ba bốn năm sáu, bảy tám chín mười một hai ba bốn. năm sáu bảy tám chín mười một hai ba bốn năm sáu bảy tám chín mười";
    const words = text.split(" ").length;               // 40 words -> breaks at 16/40, 24/40
    const run = 0.25;                                   // 0.25 s per word, runs split at words 8, 16, 24, 32
    const x = speech([8 * run, 8 * run, 8 * run, 8 * run, (words - 32) * run], [0.35, 0.5, 0.6, 0.3]);
    const r = A.shapePauses(x, SR, text, { maxPause: 0.4 });
    const got = pauses(r.samples);
    assert.equal(r.matched, 2, JSON.stringify(got));
    assert.equal(r.joined, 2);
    // order: stop at word 8 (no punct) closed, comma kept ~0.26, full stop kept ~0.4, word 32 closed
    assert.ok(got[0] <= 0.12 && got[3] <= 0.12, `unpunctuated stops closed: ${got}`);
    // v2: a comma after a 16-word clause earns the full comma pause (0.14 + 0.012 x 12, capped 0.28)
    assert.ok(Math.abs(got[1] - 0.28) < 0.04, `comma pause ${got[1]}`);
    assert.ok(Math.abs(got[2] - 0.4) < 0.04, `full stop pause ${got[2]}`);
});

test("a long run with no punctuation still gets one short breath", () => {
    const words = Array.from({ length: 40 }, () => "chữ").join(" ");
    const x = speech([2.4, 2.4, 2.4, 2.4], [0.4, 0.4, 0.4]);
    const r = A.shapePauses(x, SR, words, { maxPause: 0.4 });
    assert.equal(r.matched, 0);
    assert.ok(r.breaths >= 1, "no breath at all in 10 s of speech");
    assert.ok(pauses(r.samples).every(p => p <= 0.2), "a breath is short, not a full stop");
});

test("tight mode caps every kept pause at maxPause", () => {
    const text = "một hai ba bốn, năm sáu bảy tám. chín mười một hai";
    const x = speech([1, 1, 1], [0.6, 0.6]);
    const got = pauses(A.shapePauses(x, SR, text, { maxPause: 0.15 }).samples);
    assert.ok(got.every(p => p <= 0.17), JSON.stringify(got));
});

function mkGroup(start, cues) {
    const viCues = cues.map(([s, e, t]) => ({ start: s, end: e, text: t, lines: [t] }));
    return { start, end: viCues[viCues.length - 1].end, viText: cues.map(c => c[2]).join(" "), viCues,
        srcCues: cues.map(([s, e]) => ({ start: s, end: e, text: "src" })) };
}

test("a sentence split across two groups is one segment for the free voice, two for a paid one", () => {
    const groups = [
        mkGroup(1, [[1, 3, "Khi huấn luyện một mô hình ngôn ngữ lớn"]]),
        mkGroup(3.1, [[3.1, 5.5, "chúng ta cần rất nhiều dữ liệu."]]),
        mkGroup(7, [[7, 9, "Câu tiếp theo bắt đầu ở đây."]])
    ];
    const free = PLAN.buildDubScript(groups, { joinGroups: true });
    const paid = PLAN.buildDubScript(groups, {});
    assert.equal(free.length, 2);
    assert.match(free[0].subtitleText, /lớn chúng ta/);
    assert.equal(free[0].continuesNext, false);
    assert.equal(paid.length, 3, "paid voices keep the per-group cut");
    // a full stop, a real pause or another speaker still separates groups
    const stop = PLAN.buildDubScript([mkGroup(1, [[1, 3, "Câu này đã hết."]]), mkGroup(3.1, [[3.1, 5, "Câu mới."]])], { joinGroups: true });
    assert.equal(stop.length, 2);
    const gap = PLAN.buildDubScript([mkGroup(1, [[1, 3, "câu chưa hết"]]), mkGroup(4, [[4, 6, "sau một quãng lặng."]])], { joinGroups: true });
    assert.equal(gap.length, 2);
});

test("wiring: 48 kHz, shaping and cleanup on the VieNeu path, engine joins groups for free voices only", () => {
    const COST = require("../cost-policy.js");
    assert.equal(COST.LOCAL_TTS.sampleRate, 48000);
    const bg = read("background.js");
    assert.match(bg, /splitTtsAudio\(bytes, mime, sr, parts, \{ maxPause, text, clean: true, hpHz: localHighPass\(req\.voice\) \}\)/);
    assert.match(bg, /AUDIO\.shapePauses\(piece, sr, opts\.text/);
    const eng = read("dub-engine.js");
    assert.match(eng, /speakerState, \.\.\.\(free \? FREE_SEGMENTS : \{\}\) \}/);
    assert.match(eng, /const FREE_SEGMENTS = \{ joinGroups: true, segSoft: 8, segHard: 11 \};/);
    assert.match(eng, /const LOCAL_STYLE_VERSION = 7;/);
    assert.match(eng, /const natural = ph\.breakKind === "opener";/);
});

// ---- 1.6.8: smoothness ----
test("pause v2: a short lead-in comma is light, a comma before a joining word leans on", () => {
    const caps = { max: 0.4, sentence: 0.4, clause: 0.32, comma: 0.28 };
    const b = A.punctuationBreaks("Vâng, hôm nay chúng ta học một điều rất quan trọng về dữ liệu, và mô hình. Thật sao? Đúng vậy", caps);
    const [lead, joiner, stop, question] = b;
    assert.ok(lead.cap < 0.18, `lead-in comma ${lead.cap}`);
    assert.ok(joiner.cap < 0.28 && joiner.cap >= 0.12, `comma before "và" ${joiner.cap}`);
    assert.equal(stop.cap, 0.4);
    // v3 (1.7.2): a sentence rests by its length, so the two-word "Thật sao?" rests less than the
    // 17-word sentence before it, and the question mark still adds a little
    assert.ok(question.cap > 0.3 && question.cap < 0.4, `short question ${question.cap}`);
});

test("a voice that starts late is not chased: no playbackRate churn while it plays", () => {
    const { DubEngine } = require("../dub-engine.js");
    const eng = Object.create(DubEngine.prototype);
    eng.settings = { volume: 1 };
    eng.stats = { corrections: 0 };
    let sets = 0, rate = 1;
    const el = { paused: false, currentTime: 0, volume: 1, get playbackRate() { return rate; }, set playbackRate(v) { rate = v; sets++; } };
    const S = { mediaStart: 10, offset: 0, rate: 1, end: 15 };
    // Chrome-like: the element starts 70 ms late and reports its time in ~20 ms steps
    for (let k = 1; k <= 100; k++) {
        const t = 10 + k * 0.05;
        el.currentTime = Math.max(0, Math.floor((t - 10 - 0.07) / 0.02) * 0.02);
        eng.driveSpeech(S, { el }, t, 1);
    }
    assert.equal(sets, 0, `playbackRate changed ${sets} times (1.6.7 measured ~21 per sentence)`);
    assert.equal(eng.stats.corrections, 0);
});

test("a sentence close to natural speed plays at exactly 1.0", () => {
    const eng = require("../dub-engine.js");
    assert.equal(eng.SYNC.snapToNatural, 0.05);
    assert.match(read("dub-engine.js"), /if \(natural === 1 && lag < 0\.3 && smoothOk && Math\.abs\(rate - 1\) <= SYNC\.snapToNatural/);
});
