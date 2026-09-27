// A/B of the free voice on the mixed-language corpus (tests/speech-corpus.js): the same sentences are
// prepared by an old version (default HEAD) and by the working tree, each one's text is rendered by
// the real VieNeu server, and each take goes through that version's own pause shaping. Texts that
// come out the same share their takes, so for them only the decisions differ.
//
// Measured per take (all proxies; none replaces listening):
//   inside    stops kept inside an English name / term / model ("Google Ads | API")
//   rawIn     stops the voice itself made there, before shaping
//   langB     pauses kept where an English span meets Vietnamese and the marks allow none
//   WRONG / MISSED / RAN-ON against the marks, as tools/prosody-eval.js
//   longest   longest run of syllables without a kept pause
//   dur, rate total seconds after shaping; syllables per second
//   clip      samples at full scale; clicks: sample jumps > 0.3 inside quiet audio (a cut or a
//             discontinuity); jumps: 10 ms frames of speech whose level changes by > 15 dB
//   runaway   takes the extension would reject as runaway (same rule as background.js)
// Usage (rendering talks to 127.0.0.1: run it with the Bash sandbox off):
//   node tools/speech-ab.js [--split=dev,validation] [--old=HEAD] [--voices="Mỹ Duyên:2,Thái Sơn:1"] [--wav=<dir>] [--detail]
// TAKES defaults to ~/.cache/cst-speech-takes (keyed by voice + exact text, reused across runs).
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), crypto = require("crypto");
const { execFileSync } = require("child_process");
const REPO = path.join(__dirname, "..");
const arg = name => (process.argv.find(a => a.startsWith(`--${name}=`)) || "").slice(name.length + 3);

// ---------------- worker: runs inside one version's modules ----------------
if (arg("worker")) {
    const dir = arg("worker");
    const R = f => { try { return require(path.join(dir, f)); } catch (e) { return null; } };
    const SEG = R("vi-segmenter.js"), PLAN = R("dub-planner.js"), PROS = R("dub-prosody.js"), SPEECH = R("dub-speech.js");
    const A = R("dub-audio.js"), COST = require(path.join(REPO, "cost-policy.js"));
    const L = COST.LOCAL_TTS, SR = L.sampleRate;
    const job = JSON.parse(fs.readFileSync(0, "utf8"));
    const norm = w => String(w).replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
    if (arg("job") === "prep") {
        const out = job.map(it => {
            const words = [], gold = [];
            for (const t of PLAN.adaptForSpeech(it.text).split(/\s+/).filter(Boolean)) {
                if (t === "|" || t === "/") { if (words.length) gold[words.length - 1] = t === "|" ? 2 : 1; continue; }
                words.push(t); gold.push(0);
            }
            const plain = words.join(" ");
            const text = PROS ? PROS.breathText(plain) : plain;
            const speak = SPEECH ? SPEECH.render(text).text : text;
            const bare = words.map(norm);
            const ents = it.ents.map(([surface, kind]) => {
                const want = PLAN.adaptForSpeech(surface).split(/\s+/).map(norm).filter(Boolean);
                for (let a = 0; a + want.length <= bare.length; a++) {
                    if (want.every((w, k) => bare[a + k] === w)) return { surface, kind, a, b: a + want.length - 1 };
                }
                return { surface, kind, a: -1, b: -1 };
            });
            return { id: it.id, split: it.split, words, gold, text, speak, ents };
        });
        process.stdout.write(JSON.stringify(out));
        process.exit(0);
    }
    if (arg("job") === "score") {
        const res = [];
        for (const t of job.takes) {
            const it = job.items[t.item];
            const v = L.voices.find(x => x.id === t.voice);
            const raw = A.pcm16leToFloat(new Uint8Array(fs.readFileSync(t.file)));
            const s = A.cleanTake(raw, SR, { hpHz: v && v.gender === "Nữ" ? L.highPassHz.female : L.highPassHz.male }).samples;
            const al = A.alignStops(s, SR, it.text);
            const r = A.shapePauses(s, SR, it.text, { maxPause: L.maxPause });
            const out = A.prepareSpeech(r.samples, SR);
            const P = r.pauses || [];
            const n = it.words.length;
            const syl = it.words.reduce((x, w) => x + (PLAN.countSyllables(w) || 1), 0);
            const english = it.ents.filter(e => e.a >= 0 && /^(en|letters|model)$/.test(e.kind));
            const insideGap = g => it.ents.some(e => e.a >= 0 && e.b > e.a && g >= e.a && g < e.b);
            const langGap = g => english.some(e => g === e.a - 1 || g === e.b);
            const kept = new Map(), stop = new Map();
            P.forEach((p, j) => {
                const g = al.sil[j] ? al.sil[j].gap : -1;
                if (g < 0 || g >= n - 1) return;
                stop.set(g, Math.max(stop.get(g) || 0, p.dur));
                if (p.keep >= 0.12) kept.set(g, Math.max(kept.get(g) || 0, p.keep));
            });
            const keptG = [...kept.keys()];
            let run = 0, longest = 0;
            it.words.forEach((w, i) => { run += PLAN.countSyllables(w) || 1; if (kept.has(i) || i === n - 1) { longest = Math.max(longest, run); run = 0; } });
            const should = it.gold.map((g, i) => (g === 2 && i < n - 1 ? i : -1)).filter(i => i >= 0);
            // audio proxies on what the listener gets
            let clip = 0, clicks = 0;
            for (let i = 1; i < out.length; i++) {
                if (Math.abs(out[i]) >= 0.999) clip++;
                if (Math.abs(out[i] - out[i - 1]) > 0.3) {
                    let e = 0, c = 0;
                    for (let k = Math.max(0, i - 120); k < Math.min(out.length, i + 120); k++) if (Math.abs(k - i) > 2) { e += out[k] * out[k]; c++; }
                    if (Math.sqrt(e / Math.max(1, c)) < 0.05) clicks++;
                }
            }
            const F = Math.round(SR * 0.01), db = [];
            for (let i = 0; i + F <= out.length; i += F) {
                let e = 0;
                for (let k = i; k < i + F; k++) e += out[k] * out[k];
                db.push(10 * Math.log10(e / F + 1e-12));
            }
            let jumps = 0;
            for (let i = 1; i < db.length; i++) if (db[i] > -40 && db[i - 1] > -40 && Math.abs(db[i] - db[i - 1]) > 15) jumps++;
            const rawSec = raw.length / SR;
            const wc = it.text.split(/\s+/).filter(Boolean).length;
            res.push({
                item: t.item, voice: t.voice, k: t.k, dur: out.length / SR, syl, rawSec,
                kept: keptG.length, inside: keptG.filter(insideGap).length,
                rawIn: [...stop.entries()].filter(([g, d]) => d >= 0.12 && insideGap(g)).length,
                langB: keptG.filter(g => langGap(g) && !it.gold[g]).length,
                wrong: keptG.filter(g => !it.gold[g]).length,
                missed: should.filter(i => !kept.has(i) && (stop.get(i) || 0) >= 0.12).length,
                ranOn: should.filter(i => !kept.has(i) && !((stop.get(i) || 0) >= 0.12)).length,
                should: should.length, longest, clip, clicks, jumps,
                runaway: wc >= 3 && rawSec > 2.5 + wc / 1.6,
                keptAt: keptG.map(g => `${it.words[g]}|${it.words[g + 1]}${it.gold[g] ? "" : "✗"}`)
            });
            if (job.wav && t.k === 0 && t.wavName) {
                fs.mkdirSync(job.wav, { recursive: true });
                fs.writeFileSync(path.join(job.wav, t.wavName), Buffer.from(A.encodeWav(out, SR)));
            }
        }
        process.stdout.write(JSON.stringify(res));
        process.exit(0);
    }
    throw new Error("unknown job");
}

// ---------------- main ----------------
const COST = require(path.join(REPO, "cost-policy.js"));
const L = COST.LOCAL_TTS, SR = L.sampleRate;
const SETS = require(path.join(REPO, "tests", "speech-corpus.js"));
const splits = (arg("split") || "dev,validation").split(",");
const oldRev = arg("old") || "HEAD";
const VOICES = (arg("voices") || "Mỹ Duyên:2,Thái Sơn:1").split(",").map(x => x.split(":"));
const TAKES = process.env.TAKES || path.join(os.homedir(), ".cache", "cst-speech-takes");
const detail = process.argv.includes("--detail");
const wavDir = arg("wav");

function moduleDir(rev) {
    const dir = path.join(os.tmpdir(), `cst-ab-${rev.replace(/[^\w.-]/g, "_")}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ["vi-segmenter.js", "dub-planner.js", "dub-prosody.js", "dub-speech.js", "dub-audio.js", "glossary.js"]) {
        try { fs.writeFileSync(path.join(dir, f), execFileSync("git", ["show", `${rev}:${f}`], { cwd: REPO, stdio: ["ignore", "pipe", "ignore"] })); }
        catch (e) { try { fs.unlinkSync(path.join(dir, f)); } catch (e2) { /* absent in that version */ } }
    }
    return dir;
}
const worker = (dir, job, input) => JSON.parse(execFileSync(process.execPath, [__filename, `--worker=${dir}`, `--job=${job}`],
    { input: JSON.stringify(input), maxBuffer: 1 << 28 }).toString());
const takeFile = (voice, text, k) => path.join(TAKES, crypto.createHash("sha1").update(`${voice}\n${text}`).digest("hex").slice(0, 16) + `__${k}.pcm`);

(async () => {
    const items = [];
    for (const sp of splits) for (const it of SETS[sp]) items.push({ ...it, split: sp });
    const versions = [["old", moduleDir(oldRev)], ["new", REPO]];
    const prep = {};
    for (const [name, dir] of versions) prep[name] = worker(dir, "prep", items);
    // render every distinct (voice, text) the two versions ask for
    fs.mkdirSync(TAKES, { recursive: true });
    let rendered = 0;
    const t0 = Date.now();
    for (const [name] of versions) for (const it of prep[name]) for (const [voice, reps] of VOICES) for (let k = 0; k < Number(reps); k++) {
        const f = takeFile(voice, it.speak, k);
        if (fs.existsSync(f)) continue;
        const res = await fetch(L.url + "/v1/audio/speech", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: L.model, voice, input: it.speak, response_format: "pcm", sample_rate: SR, temperature: L.temperature })
        });
        if (!res.ok) throw new Error(`server ${res.status} for ${it.id}`);
        fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
        rendered++;
    }
    if (rendered) console.log(`rendered ${rendered} takes in ${((Date.now() - t0) / 1000).toFixed(0)} s into ${TAKES}`);
    const changed = new Set(prep.new.filter((it, i) => it.speak !== prep.old[i].speak).map(it => it.id));
    const scores = {};
    for (const [name, dir] of versions) {
        const takes = [];
        prep[name].forEach((it, i) => {
            for (const [voice, reps] of VOICES) for (let k = 0; k < Number(reps); k++) {
                takes.push({ item: i, voice, k, file: takeFile(voice, it.speak, k),
                    wavName: wavDir && changed.has(it.id) && voice === VOICES[0][0] ? `${it.split}-${it.id}-${name}.wav` : null });
            }
        });
        scores[name] = worker(dir, "score", { items: prep[name], takes, wav: wavDir || null });
    }
    // ---- report ----
    const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);
    const pct = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
    const cols = ["takes", "kept", "inside", "rawIn", "langB", "WRONG", "MISSED", "RAN-ON", "longest p50/p90/max", "dur s", "syl/s", "clip", "clicks", "jumps", "runaway"];
    const row = (rs) => {
        const lg = rs.map(r => r.longest);
        const dur = sum(rs, r => r.dur);
        return [rs.length, sum(rs, r => r.kept), sum(rs, r => r.inside), sum(rs, r => r.rawIn), sum(rs, r => r.langB), sum(rs, r => r.wrong),
            `${sum(rs, r => r.missed)}/${sum(rs, r => r.should)}`, `${sum(rs, r => r.ranOn)}/${sum(rs, r => r.should)}`,
            `${pct(lg, 0.5)}/${pct(lg, 0.9)}/${Math.max(...lg)}`, dur.toFixed(1), (sum(rs, r => r.syl) / dur).toFixed(2),
            sum(rs, r => r.clip), sum(rs, r => r.clicks), sum(rs, r => r.jumps), sum(rs, r => r.runaway ? 1 : 0)];
    };
    console.log(`old = ${oldRev}, new = working tree; voices ${VOICES.map(v => v.join("x")).join(", ")}; ${changed.size} of ${items.length} texts differ`);
    for (const group of [...splits, "changed only"]) {
        const pick = (name) => scores[name].filter(r => {
            const it = prep[name][r.item];
            return group === "changed only" ? changed.has(it.id) : it.split === group;
        });
        console.log(`\n== ${group}`);
        console.log(["", ...cols].join(" | "));
        for (const name of ["old", "new"]) console.log([name, ...row(pick(name))].join(" | "));
    }
    if (detail) {
        console.log("\n== per sentence (first take of the first voice), texts that differ");
        prep.new.forEach((it, i) => {
            if (!changed.has(it.id)) return;
            const o = scores.old.find(r => r.item === i && r.k === 0 && r.voice === VOICES[0][0]);
            const n = scores.new.find(r => r.item === i && r.k === 0 && r.voice === VOICES[0][0]);
            console.log(`${it.id}  old: ${prep.old[i].speak}\n      new: ${it.speak}\n      kept old [${o.keptAt.join(" ")}] ${o.dur.toFixed(2)} s · new [${n.keptAt.join(" ")}] ${n.dur.toFixed(2)} s`);
        });
    }
    if (wavDir) console.log(`\nA/B WAVs (first ${VOICES[0][0]} take, texts that differ): ${wavDir}`);
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
