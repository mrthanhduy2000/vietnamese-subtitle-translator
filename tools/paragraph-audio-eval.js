// Prequential duration prediction on real, already-rendered voice takes. No network or synthesis.
// node tools/paragraph-audio-eval.js [fixture directory] [output JSON]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const P = require('../dub-planner');
const dir = process.argv[2] || path.join(__dirname, '../tests/harness/smooth/real-video');
const files = fs.readdirSync(dir).filter(f => f.endsWith('-fixture.json')).sort();
const estimator = new P.DurationEstimator(), ema = new Map(), rows = [], hashes = {};
for (const file of files) {
    const bytes = fs.readFileSync(path.join(dir, file));
    hashes[file] = crypto.createHash('sha256').update(bytes).digest('hex');
    const fixture = JSON.parse(bytes);
    for (const take of fixture.plans) {
        const plan = { ...take, speaker: fixture.voice }, syllables = P.countSyllables(take.text);
        const base = syllables / 4.5;
        // Predict before learning this take; evaluate every take, including short/abnormal samples.
        const prediction = estimator.predict(plan, base);
        const previous = syllables / (ema.get(fixture.voice) || 4.5);
        rows.push({ fixture: file, id: take.id, voice: fixture.voice, actual: take.duration,
            previous, predicted: prediction.duration, samples: prediction.samples, uncertainty: prediction.uncertainty });
        estimator.observe(plan, take.duration, base);
        const sps = syllables / take.duration;
        if (take.duration >= 1.2 && sps >= 2 && sps <= 9) ema.set(fixture.voice, ema.has(fixture.voice) ? ema.get(fixture.voice) * 0.75 + sps * 0.25 : sps);
    }
}
const mae = key => rows.reduce((sum, r) => sum + Math.abs(r.actual - r[key]), 0) / rows.length;
const result = { method: 'Sequential prediction before observation; one fixed file order, no holdout quality claim. Previous is the syllable/SPS EMA duration formula, without engine tempo/slack shaping.',
    takes: rows.length, voices: [...new Set(rows.map(r => r.voice))], previousMaeSeconds: mae('previous'), predictedMaeSeconds: mae('predicted'), hashes, rows };
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ takes: result.takes, voices: result.voices, previousMaeSeconds: result.previousMaeSeconds, predictedMaeSeconds: result.predictedMaeSeconds }));
