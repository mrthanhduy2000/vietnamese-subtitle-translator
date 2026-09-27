// Delivery matrix over tools/playback-sim.js (manual, offline, no API, no server). One scenario swings
// with the timing of a single seek, so engine changes are judged on many runs:
//   slow    RTF 0.8/0.9/1.0/1.1 x rate 1/1.5/2 x 12 seek pairs (144 runs)
//   rapid   RTF 0.25/0.35/0.5 x rate 1/1.25 x 10 bursts of 4 quick seeks and one more (60 runs)
//   node tools/sim-matrix.js [slow|rapid]                      the current engine
//   node tools/sim-matrix.js slow <old dub-engine.js> ...     the same runs on other engines too
// An old engine must sit where its require("./cost-policy.js") resolves: in a copy of the repo
// (git archive HEAD | tar -x -C dir) or in the repo root under another name.
const path = require("path");
const { run } = require("./playback-sim.js");

const MATRICES = {
    slow: function* () {
        for (const rtf of [0.8, 0.9, 1.0, 1.1]) for (const rate of [1, 1.5, 2]) for (let s = 1; s <= 12; s++) {
            const a = 10 + (s * 7) % 15;
            yield { wall: 75, rtf: () => rtf, rate, seed: s, steps: [{ at: a, do: "seek", v: 30 + (s * 37) % 220 }, { at: a + 25, do: "seek", v: 15 + (s * 53) % 180 }] };
        }
    },
    rapid: function* () {
        for (const rtf of [0.25, 0.35, 0.5]) for (const rate of [1, 1.25]) for (let s = 1; s <= 10; s++) {
            const a = 8 + (s * 5) % 10, pts = [30 + (s * 37) % 200, 15 + (s * 53) % 180, 60 + (s * 71) % 220, 20 + (s * 29) % 250];
            const steps = pts.map((v, k) => ({ at: a + k * (0.7 + (s % 3) * 0.4), do: "seek", v }));
            steps.push({ at: a + 20, do: "seek", v: 40 + (s * 97) % 280 });
            yield { wall: a + 45, rtf: () => rtf, rate, seed: s, steps };
        }
    }
};

(async () => {
    const which = process.argv[2] || "slow";
    const engines = [["current", path.join(__dirname, "..", "dub-engine.js")], ...process.argv.slice(3).map(f => [path.basename(path.dirname(path.resolve(f))) + "/" + path.basename(f), path.resolve(f)])];
    console.log("engine\tspoken\tlate\tgaps_s\trecover_mean\trecover_p90\trecover_max");
    for (const [label, file] of engines) {
        const M = require(file);
        const g = { spoken: 0, late: 0, gaps: 0, rec: [], worst: [] };
        for (const sc of MATRICES[which]()) {
            const r = await run(M, { ...sc, bgAbort: "queued" });
            g.spoken += r.spoken; g.late += r.late; g.gaps += r.gapSum;
            if (r.seekRecover != null) { g.rec.push(r.seekRecover); g.worst.push(r.seekRecoverMax); }
        }
        const sorted = [...g.worst].sort((a, b) => a - b);
        console.log([label, g.spoken, g.late, g.gaps.toFixed(0), (g.rec.reduce((a, b) => a + b, 0) / g.rec.length).toFixed(2),
            sorted[Math.floor(0.9 * (sorted.length - 1))].toFixed(1), Math.max(...g.worst).toFixed(1)].join("\t"));
    }
})().catch(e => { console.error(e); process.exit(1); });
