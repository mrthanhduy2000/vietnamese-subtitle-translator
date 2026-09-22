// Hiệu chỉnh mô hình thời lượng nói từ số liệu giọng thật (tests/audio/linh-calibration.json).
// Chạy: node tests/tools-fit-voice.js
const P = require("../dub-planner.js");
const data = require("./audio/linh-calibration.json");

const phraseCache = new Map();
function estimate(text, rate, m) {
    if (!phraseCache.has(text)) phraseCache.set(text, P.buildPhrases(P.adaptForSpeech(text)));
    const phrases = phraseCache.get(text);
    let t = m.overhead;
    phrases.forEach((ph, k) => {
        t += P.speechSeconds(ph.syl, rate, { ...m, calibration: 1 });
        if (k < phrases.length - 1) t += ph.pauseAfter * m.pauseFactor / Math.pow(rate, m.rateExp);
    });
    return t;
}

let best = null;
for (let S = 3.2; S <= 4.2; S += 0.05)
    for (let e = 0.5; e <= 1.0; e += 0.025)
      for (const c of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4])
        for (let o = 0.0; o <= 0.4; o += 0.025)
            for (const pf of [1.0, 1.2, 1.4, 1.6, 1.8, 2.0]) {
                const m = { sylPerSec: S, rateExp: e, rateCurve: c, overhead: o, pauseFactor: pf };
                let err = 0;
                for (const d of data) err += Math.abs(estimate(d.text, d.rate, m) - d.duration) / d.duration;
                err /= data.length;
                if (!best || err < best.err) best = { err, m };
            }
const byRate = {};
for (const d of data) { const e = Math.abs(estimate(d.text, d.rate, best.m) - d.duration) / d.duration; (byRate[d.rate] = byRate[d.rate] || []).push(e); }
for (const r of Object.keys(byRate)) console.log(`  tốc độ ${r}x: sai số ${(byRate[r].reduce((a, b) => a + b, 0) / byRate[r].length * 100).toFixed(1)}%`);
console.log("Mô hình tốt nhất:", JSON.stringify(best.m, null, 0), "sai số trung bình", (best.err * 100).toFixed(1) + "%");
let worst = data.map(d => ({ d, e: estimate(d.text, d.rate, best.m) })).sort((a, b) => Math.abs(b.e - b.d.duration) / b.d.duration - Math.abs(a.e - a.d.duration) / a.d.duration).slice(0, 5);
worst.forEach(w => console.log(`  lệch nhiều: ${w.d.rate}x thực ${w.d.duration.toFixed(2)}s ước ${w.e.toFixed(2)}s :: ${w.d.text}`));
