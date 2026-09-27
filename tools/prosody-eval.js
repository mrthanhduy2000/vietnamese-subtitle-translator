// Prosody evaluation on real VieNeu takes (manual, not in npm test; needs the local server only for
// takes not yet rendered). Renders each marked sentence of tests/prosody-corpus.js (Mỹ Duyên x3,
// Thái Sơn x2 by default) once into TAKES, then scores the pause shaping of dub-audio.js on those
// same takes against the marks:
//   kept     pauses kept >= 0.12 s          WRONG   kept where the marks say none (severe: inside a
//   MISSED   "|" the voice stopped at, closed         unit, or segmenter cost >= 20)
//   RAN-ON   "|" the voice did not stop at   longest  longest run of syllables without a kept pause
// OLD=<path to an older dub-audio.js> scores that one on the same takes too (A/B). Both are placed
// on the text with the current alignStops, so only the decisions differ.
//   node tools/prosody-eval.js [--set=corpus,holdout3] [--detail] [--tight]
//   git show 3204613:dub-audio.js > $TMPDIR/dub-audio-175.js && OLD=$TMPDIR/dub-audio-175.js node tools/prosody-eval.js
// TAKES defaults to ~/.cache/cst-prosody-takes (about 1 MB per take; 840 takes for all four sets).
// Rendering talks to 127.0.0.1: run it with the Bash sandbox off.
const path = require("path"), fs = require("fs"), os = require("os");
const REPO = path.join(__dirname, "..");
const PLAN = require(path.join(REPO, "dub-planner.js")), COST = require(path.join(REPO, "cost-policy.js"));
const NEW = require(path.join(REPO, "dub-audio.js"));
const OLD = process.env.OLD ? require(path.resolve(process.env.OLD)) : null;
const SETS = require(path.join(REPO, "tests", "prosody-corpus.js"));
const L = COST.LOCAL_TTS, SR = L.sampleRate;
const TAKES = process.env.TAKES || path.join(os.homedir(), ".cache", "cst-prosody-takes");
const VOICES = (process.env.VOICES || "Mỹ Duyên:3,Thái Sơn:2").split(",").map(x => x.split(":"));
const arg = name => (process.argv.find(a => a.startsWith(`--${name}=`)) || "").split("=")[1];
const setNames = (arg("set") || Object.keys(SETS).join(",")).split(",");
const detail = process.argv.includes("--detail"), tight = process.argv.includes("--tight");

// marked text -> words as the voice gets them + mark after each word (2 "|", 1 "/", 0 none)
function parse(marked) {
    const words = [], gold = [];
    for (const t of PLAN.adaptForSpeech(marked).split(/\s+/).filter(Boolean)) {
        if (t === "|" || t === "/") { if (words.length) gold[words.length - 1] = t === "|" ? 2 : 1; continue; }
        words.push(t); gold.push(0);
    }
    return { words, gold, text: words.join(" ") };
}
const takeFile = (set, id, voice, k) => path.join(TAKES, set, `${id}__${voice.replace(/\s/g, "_")}__${k}.pcm`);

async function render() {
    let n = 0;
    for (const set of setNames) {
        fs.mkdirSync(path.join(TAKES, set), { recursive: true });
        for (const [voice, reps] of VOICES) for (const [id, , m] of SETS[set]) for (let k = 0; k < Number(reps); k++) {
            const f = takeFile(set, id, voice, k);
            if (fs.existsSync(f)) continue;
            const res = await fetch(L.url + "/v1/audio/speech", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: L.model, voice, input: parse(m).text, response_format: "pcm", sample_rate: SR, temperature: L.temperature })
            });
            if (!res.ok) throw new Error(`server ${res.status} for ${id}`);
            fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
            n++;
        }
    }
    if (n) console.log(`rendered ${n} takes into ${TAKES}`);
}

function score(set) {
    const agg = {};
    for (const [voice, reps] of VOICES) for (const [id, , m] of SETS[set]) for (let k = 0; k < Number(reps); k++) {
        const v = L.voices.find(x => x.id === voice);
        const { words, gold, text } = parse(m);
        let s = NEW.pcm16leToFloat(new Uint8Array(fs.readFileSync(takeFile(set, id, voice, k))));
        s = NEW.cleanTake(s, SR, { hpHz: v && v.gender === "Nữ" ? L.highPassHz.female : L.highPassHz.male }).samples;
        const al = NEW.alignStops(s, SR, text);
        for (const [name, A] of [["new", NEW], ["old", OLD]]) {
            if (!A) continue;
            const r = A.shapePauses(s, SR, text, { maxPause: tight ? L.tightPause : L.maxPause });
            const P = r.pauses || [];
            if (al.sil.length !== P.length) throw new Error(`stop count differs on ${id}: is ${name} built on the same findSilences?`);
            const kept = [], stopAt = new Map();
            P.forEach((p, j) => {
                const g = al.sil[j].gap;
                if (g < 0) return;
                stopAt.set(g, Math.max(stopAt.get(g) || 0, p.dur));
                if (p.keep >= 0.12) kept.push({ g, keep: p.keep, dur: p.dur, kind: p.kind });
            });
            const keptAt = new Set(kept.map(x => x.g));
            let run = 0, longest = 0;
            words.forEach((w, i) => { run += PLAN.countSyllables(w) || 1; if (keptAt.has(i) || i === words.length - 1) { longest = Math.max(longest, run); run = 0; } });
            const wrong = kept.filter(x => !gold[x.g]);
            const severe = wrong.filter(x => al.A.gaps[x.g].unit || al.A.gaps[x.g].cost >= 20);
            const should = gold.map((g, i) => (g === 2 && i < words.length - 1 ? i : -1)).filter(i => i >= 0);
            const missed = should.filter(i => !keptAt.has(i) && (stopAt.get(i) || 0) >= 0.12);
            const ranOn = should.filter(i => !keptAt.has(i) && !((stopAt.get(i) || 0) >= 0.12));
            const a = agg[name] = agg[name] || { takes: 0, kept: 0, sum: 0, wrong: 0, severe: 0, missed: 0, ranOn: 0, should: 0, dur: 0, longest: [], keeps: [] };
            a.takes++; a.kept += kept.length; a.wrong += wrong.length; a.severe += severe.length; a.missed += missed.length;
            a.ranOn += ranOn.length; a.should += should.length; a.dur += NEW.prepareSpeech(r.samples, SR).length / SR; a.longest.push(longest);
            kept.forEach(x => { a.sum += x.keep; a.keeps.push(x.keep); });
            if (detail) {
                const mark = g => (gold[g] === 2 ? "✓" : gold[g] === 1 ? "~" : "✗");
                console.log(`${name} ${set} ${id} ${voice} ${k} | kept ${kept.map(x => `${words[x.g]}|${words[x.g + 1]} ${x.kind} ${x.dur.toFixed(2)}→${x.keep.toFixed(2)}${mark(x.g)}`).join("  ")}` +
                    `${missed.length ? " | MISSED " + missed.map(i => words[i]).join(",") : ""}${ranOn.length ? " | RAN-ON " + ranOn.map(i => words[i]).join(",") : ""}`);
            }
        }
    }
    const pct = (xs, q) => xs.slice().sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor(q * xs.length))];
    for (const [name, a] of Object.entries(agg)) {
        console.log(`${set} ${name}: ${a.takes} takes, kept ${a.kept} (mean ${(a.sum / Math.max(1, a.kept)).toFixed(3)} s, min ${Math.min(...a.keeps).toFixed(2)} max ${Math.max(...a.keeps).toFixed(2)}), ` +
            `WRONG ${a.wrong} (severe ${a.severe}), MISSED ${a.missed}/${a.should}, RAN-ON ${a.ranOn}/${a.should}, ` +
            `longest run p50 ${pct(a.longest, 0.5)} p90 ${pct(a.longest, 0.9)} max ${Math.max(...a.longest)}, total ${a.dur.toFixed(1)} s`);
    }
}

(async () => {
    await render();
    for (const set of setNames) score(set);
})().catch(e => { console.error(e.message); process.exit(1); });
