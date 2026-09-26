// 1.7.2: rumble cut, corrected hiss estimate, no gate, pauses at clause openings of long sentences,
// sentence pauses by length, a soft onset for takes that start voiced, a comma's rest between two
// parts of one sentence.
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../dub-audio.js");
const E = require("../dub-engine.js");
const COST = require("../cost-policy.js");
const { read } = require("./bg-env.js");

// amplitude of one sine component (least squares against sin/cos over whole periods)
function amp(x, sr, hz, from = 0.5) {
    let s = 0, c = 0, n = 0;
    for (let i = Math.round(from * sr); i < x.length; i++) {
        s += x[i] * Math.sin(2 * Math.PI * hz * i / sr); c += x[i] * Math.cos(2 * Math.PI * hz * i / sr); n++;
    }
    return 2 * Math.hypot(s, c) / n;
}

test("high-pass: rumble drops, the voice band is untouched (female 80 Hz, male 60 Hz)", () => {
    const sr = 48000, n = sr * 2, x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = 0.05 * Math.sin(2 * Math.PI * 45 * i / sr) + 0.05 * Math.sin(2 * Math.PI * 85 * i / sr) + 0.2 * Math.sin(2 * Math.PI * 250 * i / sr);
    const db = (y, hz) => 20 * Math.log10(amp(y, sr, hz) / amp(x, sr, hz));
    const f = A.highPass(x, sr, COST.LOCAL_TTS.highPassHz.female);
    assert.ok(db(f, 45) < -15, `45 Hz rumble only ${db(f, 45).toFixed(1)} dB`);
    assert.ok(Math.abs(db(f, 250)) < 0.05, `250 Hz changed ${db(f, 250).toFixed(2)} dB`);
    const m = A.highPass(x, sr, COST.LOCAL_TTS.highPassHz.male);
    assert.ok(db(m, 45) < -8, "male cut too weak");
    assert.ok(db(m, 85) > -0.4, `a low male pitch lost ${db(m, 85).toFixed(2)} dB`);
    assert.equal(A.highPass(x, sr, 0), x, "no cut asked, nothing done");
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

test("hiss estimate: the steady hiss in the gaps comes down to the floor, the voice keeps its level", () => {
    // 1.7.1 took the 20th percentile x 1.6 per bin, ~4.5 dB under the true hiss: gaps came down
    // only ~9.5 dB on this take. The mean over pure-noise frames reaches the -12 dB floor.
    const sr = 48000, x = toneWithHiss(sr, 0.004);
    const r = A.denoise(x, sr);
    assert.equal(r.applied, true);
    assert.ok(level(r.samples, sr, 1.35, 1.65) < level(x, sr, 1.35, 1.65) - 11, "gap hiss not down to the floor");
    assert.ok(Math.abs(level(r.samples, sr, 0.5, 1.0) - level(x, sr, 0.5, 1.0)) < 0.2, "voice level changed");
    // cleanTake = rumble cut + the same hiss removal, and says whether it denoised
    const c = A.cleanTake(x, sr, { hpHz: 80 });
    assert.equal(c.denoised, true);
    assert.equal(A.cleanTake(toneWithHiss(sr, 0.00002), sr, { hpHz: 80 }).denoised, false, "a clean take is left alone");
});

test("spoken weight: one per vowel group, one per digit", () => {
    assert.equal(A.spokenWeight("huấn"), 1);
    assert.equal(A.spokenWeight("khuyên,"), 1);
    assert.equal(A.spokenWeight("PyTorch"), 2);
    assert.equal(A.spokenWeight("network."), 2);
    assert.equal(A.spokenWeight("123"), 3);
    assert.equal(A.spokenWeight("—"), 0);
});

const CAPS = { max: 0.4, sentence: 0.4, clause: 0.32, comma: 0.28 };
const soft = t => A.textBreaks(t, CAPS, { soft: true }).filter(b => b.kind === "soft");
const wordAt = (t, at) => {                       // the word right after a break at share `at`
    const w = t.split(/\s+/), wt = w.map(A.spokenWeight), tot = wt.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let i = 0; i < w.length; i++) { acc += wt[i]; if (Math.abs(acc / tot - at) < 1e-9) return w[i + 1]; }
    return null;
};

test("clause openings of a long sentence are soft breaks, short sentences and phrase words are not", () => {
    const long = "Nếu bạn muốn mô hình học nhanh hơn thì bạn có thể tăng tốc độ học nhưng nếu tăng quá nhiều thì mô hình sẽ dao động liên tục và không bao giờ hội tụ được.";
    assert.deepEqual(soft(long).map(b => wordAt(long, b.at)), ["thì", "nhưng", "thì", "và"]);
    assert.ok(soft(long).every(b => b.cap >= 0.1 && b.cap <= 0.2), "a soft break is shorter than a comma");
    const purpose = "Chúng ta cần chia nhỏ dữ liệu thành nhiều lô vì bộ nhớ của máy tính không đủ để chứa toàn bộ dữ liệu cùng một lúc.";
    assert.deepEqual(soft(purpose).map(b => wordAt(purpose, b.at)), ["vì", "để"]);
    // a two-word opening breaks before its first word
    const before = "Chúng ta nên chuẩn hóa toàn bộ dữ liệu trước khi đưa nó vào mạng nơ-ron.";
    assert.deepEqual(soft(before).map(b => wordAt(before, b.at)), ["trước"]);
    // short sentence, phrase words (đôi khi, còn lại, để ý, khi nào), và between nouns: nothing
    assert.equal(soft("Nó học nhanh nhưng dễ quên.").length, 0);
    assert.equal(soft("Chúng ta cần để ý đến những giá trị còn lại của dữ liệu và mô hình.").length, 0);
    assert.equal(soft("Mô hình này đôi khi học rất nhanh trên tập dữ liệu nhỏ.").length, 0);
    assert.equal(soft("Tập huấn luyện gồm ảnh mèo và ảnh chó.").length, 0);
    // punctuation alone: textBreaks without soft is the old punctuationBreaks
    assert.deepEqual(A.punctuationBreaks(long, CAPS), []);
});

test("a full stop rests by the length of its sentence, ? and ! a little longer, never past maxPause", () => {
    const b = A.textBreaks("Đúng vậy! Đây là một ví dụ rất quen thuộc. Tại sao? Câu trả lời nằm ở tốc độ học của mô hình khi huấn luyện trên dữ liệu lớn. Hết", CAPS);
    const [exclaim, stop, question, long] = b.map(x => x.cap);
    assert.equal(exclaim, 0.33);                  // 2 words: 0.28 + 0.02, "!" + 0.03
    assert.equal(stop, 0.36);                     // 8 words
    assert.equal(question, 0.35);                 // 2 words + 0.05
    assert.equal(long, 0.4);                      // 16 words: capped at the sentence pause
    const tight = A.textBreaks("Tại sao lại như vậy nhỉ bạn ơi? Hết", { max: 0.15, sentence: 0.15, clause: 0.15, comma: 0.15 });
    assert.equal(tight[0].cap, 0.15, "tight mode caps a question too");
    // a comma before a short tag leans on
    const tag = A.textBreaks("Mô hình này học nhanh hơn rất nhiều so với trước, đúng không?", CAPS);
    assert.ok(tag[0].cap < 0.25, `comma before a tag ${tag[0].cap}`);
});

const SR = 16000;
function speech(runs, gaps) {
    const parts = [];
    runs.forEach((sec, k) => {
        const a = new Float32Array(Math.round(sec * SR));
        for (let i = 0; i < a.length; i++) a[i] = 0.3 * Math.sin(2 * Math.PI * 180 * i / SR);
        parts.push(a);
        if (k < gaps.length) parts.push(new Float32Array(Math.round(gaps[k] * SR)));
    });
    const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
    let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}
const pauses = x => A.findSilences(x, SR, { minMs: 60 }).filter(s => s.start > 0.05 && s.end < x.length / SR - 0.05).map(s => +s.dur.toFixed(2));

test("the voice's stop at a clause opening keeps a short pause, its stop inside a phrase is closed", () => {
    // 20 words at 0.25 s: a hesitation after word 5, a stop before "nhưng" (after word 10)
    const text = "mô hình này học rất nhanh trên tập huấn luyện nhưng lại cho kết quả kém trên dữ liệu mới.";
    const x = speech([5 * 0.25, 5 * 0.25, 10 * 0.25], [0.35, 0.4]);
    const r = A.shapePauses(x, SR, text, { maxPause: 0.4 });
    const got = pauses(r.samples);
    assert.equal(r.soft, 1);
    assert.equal(r.joined, 1);
    assert.ok(got[0] <= 0.12, `mid-phrase stop kept ${got[0]}`);
    assert.ok(Math.abs(got[1] - 0.18) < 0.03, `clause-opening pause ${got[1]}`);   // 0.1 + 0.008 x 10
    assert.deepEqual(r.pauses.map(p => p.kind), ["joint", "soft"]);
    // soft: false is the 1.7.1 behaviour (both closed)
    const off = A.shapePauses(x, SR, text, { maxPause: 0.4, soft: false });
    assert.equal(off.soft, 0);
    assert.ok(pauses(off.samples).every(p => p <= 0.12));
});

test("positions skip the take's lead silence: a comma right after the first words still finds its stop", () => {
    // 0.5 s of lead silence, "Trước hết," then 14 more words; the stop after word 2
    const text = "Trước hết, hãy nhìn vào biểu đồ này trục ngang là số vòng lặp của mô hình.";
    const lead = new Float32Array(Math.round(0.5 * SR));
    const body = speech([2 * 0.25, 14 * 0.25], [0.4]);
    const x = new Float32Array(lead.length + body.length); x.set(body, lead.length);
    const r = A.shapePauses(x, SR, text, { maxPause: 0.4 });
    assert.equal(r.matched, 1, JSON.stringify(r.pauses));
});

test("a take that starts already voiced gets a 20 ms onset, a quiet start keeps 8 ms", () => {
    const sr = 48000;
    const hot = new Float32Array(sr); for (let i = 0; i < sr; i++) hot[i] = 0.3 * Math.sin(2 * Math.PI * 200 * i / sr);
    assert.equal(A.startsVoiced(A.normalize(hot, sr), sr), true);
    const y = A.prepareSpeech(hot, sr);
    const peak = (a, b) => { let m = 0; for (let i = Math.round(a * sr); i < Math.round(b * sr); i++) m = Math.max(m, Math.abs(y[i])); return m; };
    assert.ok(peak(0.008, 0.009) < peak(0.1, 0.2) * 0.6, "onset still switches on within 8 ms");   // 20 ms raised cosine: ~0.42 at 9 ms
    assert.ok(peak(0.02, 0.025) > peak(0.1, 0.2) * 0.9, "onset longer than 20 ms");
    const quiet = new Float32Array(sr); for (let i = sr * 0.2; i < sr; i++) quiet[i] = hot[i];
    assert.equal(A.startsVoiced(A.normalize(quiet, sr), sr), false);
});

test("engine: a part cut at a comma is followed after a comma's rest, a bare cut at once", () => {
    const plan = (text, cont) => ({ phrases: [{ text, breakKind: null }], continuesNext: cont });
    assert.equal(E.gapAfter(plan("khi chúng ta nhìn vào đường cong sai số,", true)), E.SYNC.joinGapClause);
    assert.equal(E.gapAfter(plan("trục ngang là số vòng lặp;", true)), E.SYNC.joinGapClause);
    assert.equal(E.gapAfter(plan("khi chúng ta nhìn vào đường cong", true)), E.SYNC.joinGap);
    assert.equal(E.gapAfter(plan("Câu đã hết.", false)), E.SYNC.sentenceGap);
    assert.equal(E.gapAfter(null), E.SYNC.sentenceGap);
    assert.ok(E.SYNC.joinGapClause > 0.1 && E.SYNC.joinGapClause < E.SYNC.sentenceGap);
    const eng = read("dub-engine.js");
    assert.match(eng, /this\.lastSpeechGap = gapAfter\(done\);/);
    assert.match(eng, /let endAt = joined \? next\.start - gapAfter\(p\)/);
});

test("wiring: rumble cut by voice gender, no gate after the hiss removal on the VieNeu path", () => {
    assert.deepEqual(COST.LOCAL_TTS.highPassHz, { female: 80, male: 60 });
    const bg = read("background.js");
    assert.match(bg, /return v && v\.gender === "Nữ" \? LOCAL\.highPassHz\.female : LOCAL\.highPassHz\.male;/);
    const split = bg.slice(bg.indexOf("function splitTtsAudio"), bg.indexOf("function partsReply"));
    assert.doesNotMatch(split, /gateNoise/);
    assert.match(split, /AUDIO\.prepareSpeech\(piece, sr\)/);
    assert.equal((bg.match(/clean: true, hpHz: localHighPass\(req\.voice\)/g) || []).length, 2, "dubbing and the settings preview");
});
