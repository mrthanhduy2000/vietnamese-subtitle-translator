// 1.7.2: rumble cut, corrected hiss estimate, no gate, pauses at clause openings of long sentences,
// sentence pauses by length, a soft onset for takes that start voiced, a comma's rest between two
// parts of one sentence. 1.7.6: the pause cases run on the prosody model (dub-prosody.js).
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

// 1.7.6: the text side of pause shaping moved to dub-prosody.js (tests/prosody.test.js). These are
// the 1.7.2 / 1.7.5 cases rewritten against it: same sentences, same intent.
const P = require("../dub-prosody.js");
const open = t => { const a = P.analyze(t); return a.gaps.filter(g => !g.punct && !g.unit && g.value >= 0.5).map(g => a.words[g.i + 1].bare); };

test("clause openings of a long sentence are its strongest boundaries; phrase words and a short và are none", () => {
    const long = "Nếu bạn muốn mô hình học nhanh hơn thì bạn có thể tăng tốc độ học nhưng nếu tăng quá nhiều thì mô hình sẽ dao động liên tục và không bao giờ hội tụ được.";
    assert.deepEqual(open(long), ["thì", "nhưng", "thì", "và"]);
    assert.deepEqual(open("Chúng ta cần chia nhỏ dữ liệu thành nhiều lô vì bộ nhớ của máy tính không đủ để chứa toàn bộ dữ liệu cùng một lúc."), ["vì", "để"]);
    assert.deepEqual(open("Chúng ta nên chuẩn hóa toàn bộ dữ liệu trước khi đưa nó vào mạng nơ-ron."), ["trước"]);
    for (const t of ["Chúng ta cần để ý đến những giá trị còn lại của dữ liệu và mô hình.", "Mô hình này đôi khi học rất nhanh trên tập dữ liệu nhỏ.",
        "Tập huấn luyện gồm ảnh mèo và ảnh chó.", "Chúng ta xây dựng mô hình dựa trên dữ liệu.", "Kết quả được tính bằng cách lấy trung bình các giá trị."]) {
        assert.deepEqual(open(t), [], t);
        assert.deepEqual(P.breathGroups(t), [], t);
    }
    // "dựa vào" as a verb and "trước đó" as "earlier" are no openings
    assert.deepEqual(P.breathGroups("Điều này phụ thuộc vào cách chúng ta dựa vào kết quả trước đó của mô hình."), []);
    // an adjunct opener in a long sentence is where the text breathes
    assert.deepEqual(P.breathGroups("Chúng ta có thể cải thiện độ chính xác của mô hình thông qua việc tăng thêm dữ liệu huấn luyện.").map(b => b.word), ["hình"]);
});

test("a full stop rests by the length of its sentence, ? and ! a little longer; a comma before a short tag leans on", () => {
    const a = P.analyze("Đúng vậy! Đây là một ví dụ rất quen thuộc. Tại sao? Câu trả lời nằm ở tốc độ học của mô hình khi huấn luyện trên dữ liệu lớn. Hết");
    assert.deepEqual(a.gaps.filter(g => g.punct).map(g => g.pause), [0.33, 0.36, 0.35, 0.4]);   // 2 words + "!", 8 words, 2 words + "?", 16 words
    const tag = P.analyze("Mô hình này học nhanh hơn rất nhiều so với trước, đúng không?").gaps.find(g => g.punct === "comma");
    assert.ok(tag.pause < 0.25, `comma before a tag ${tag.pause}`);
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
    // 1.7.6: 0.1 + up to 0.05 by boundary value + 0.025 per voiced second before it (1.7.5: 0.18)
    assert.ok(Math.abs(got[1] - 0.21) < 0.03, `clause-opening pause ${got[1]}`);
    assert.deepEqual(r.pauses.map(p => p.kind), ["joint", "soft"]);
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
    // 1.7.6: the next part is passed so a bare cut at a clause boundary rests like a comma
    assert.match(eng, /this\.lastSpeechGap = gapAfter\(done, done \? this\.plans\[this\.plans\.indexOf\(done\) \+ 1\] : null\);/);
    assert.match(eng, /let endAt = joined \? next\.start - gapAfter\(p, next\)/);
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
