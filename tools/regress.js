#!/usr/bin/env node
// Regression net over every video a review already covered (2.4.7). Each saved video in
// review-archive/ (git-ignored, local only; the newest dump of a video wins) is judged as the user
// would see it now: the text flags of tools/batch-review.js and the voice in the dubbing simulator
// (Chrome's start-up latency on, LATENCY=busy). The simulator's own scenarios (seeks, pauses, rates,
// slow servers) run too, with and without that latency. Everything is compared with the numbers saved
// in review-archive/baseline.json and every number that moved is listed; one that got worse fails.
// Deterministic: the simulator's randomness is seeded, so any move is a real change.
//
//   node tools/regress.js                 compare with the baseline (exit 1 if anything got worse)
//   node tools/regress.js --save          write the current numbers as the new baseline
//   node tools/regress.js --videos-only   skip the scenarios (faster)
//   OLD=<old dub-engine.js> ...           not used here: the baseline is the old side
//
// Save a new baseline only when every listed change is understood and wanted (or after a review adds
// a folder: tools/review.js --close does that itself).
const fs = require("fs");
const path = require("path");
const REPO = path.join(__dirname, "..");
const BR = require("./batch-review.js");
const SIM = require("./playback-sim.js");

const ARCHIVE = path.join(REPO, "review-archive");
const BASELINE = path.join(ARCHIVE, "baseline.json");
const FORMAT = 1;                   // bump when a metric changes meaning; an old baseline is then refused
// lower is better, except these
const HIGHER_BETTER = new Set(["spoken"]);
// reported when they move, never a failure: a repair count or a size says nothing good or bad alone
const NEUTRAL = new Set(["mended", "voiceSwitch", "voice2", "groups", "minutes", "viSylPerSec", "rateP50", "rateP90", "rateMax", "firstAudio", "generated", "serverRuns", "storeHits", "maxRendered", "maxHeld", "joined"]);
const VIDEO_SIM = ["spoken", "dropped", "late", "wordsLost", "wordsTwice", "gapN", "gapSum", "cuts", "hardStarts", "elSeeks", "skippedS", "rateP50", "rateMax"];
const SCEN_COLS = ["spoken", "dropped", "late", "wordsLost", "wordsTwice", "gapN", "gapSum", "gapMax", "seekRecover", "seekRecoverMax", "overlapTicks", "reseeks", "elSeeks", "skippedS", "cuts", "hardStarts", "cutRunning", "duplicateGen", "unplayedGen", "maxEls", "maxUrls"];

const round = x => (typeof x === "number" ? +x.toFixed(3) : x);
const pick = (r, cols) => Object.fromEntries(cols.filter(c => r && r[c] != null).map(c => [c, round(r[c])]));

async function measure(opts = {}) {
    const folders = fs.existsSync(ARCHIVE) ? fs.readdirSync(ARCHIVE).filter(f => fs.statSync(path.join(ARCHIVE, f)).isDirectory()).sort() : [];
    const files = BR.listVideos(folders.map(f => path.join(ARCHIVE, f)));
    const videos = {};
    for (const file of files) {
        const { row } = BR.review(file);
        const sim = await BR.simulate(file, { latency: "busy" });
        videos[row.video] = { ...pick(row, ["minutes", "groups", ...BR.TEXT_COLS]), ...pick(sim, VIDEO_SIM) };
    }
    const scenarios = {};
    if (!opts.videosOnly) {
        const ENG = require(path.join(REPO, "dub-engine.js"));
        for (const latency of [0, "busy"]) {
            for (const [name, sc] of Object.entries(SIM.SCENARIOS)) {
                const r = await SIM.run(ENG, { ...sc, bgAbort: "queued", latency });
                scenarios[`${name}${latency ? "@busy" : ""}`] = pick(r, SCEN_COLS);
            }
        }
    }
    const version = JSON.parse(fs.readFileSync(path.join(REPO, "manifest.json"), "utf8")).version;
    return { format: FORMAT, version, saved: new Date().toISOString(), folders, videos, scenarios };
}

// Every number that moved: [{ where, metric, before, now, worse }]
function compare(base, now) {
    const out = [];
    for (const kind of ["videos", "scenarios"]) {
        const a = base[kind] || {}, b = now[kind] || {};
        for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
            if (!a[id] || !b[id]) { if (kind === "videos" || Object.keys(b).length) out.push({ where: `${kind}/${id}`, metric: a[id] ? "gone" : "new", before: "", now: "", worse: false }); continue; }
            for (const m of new Set([...Object.keys(a[id]), ...Object.keys(b[id])])) {
                const x = a[id][m], y = b[id][m];
                if (x === y) continue;
                const worse = !NEUTRAL.has(m) && typeof x === "number" && typeof y === "number" && (HIGHER_BETTER.has(m) ? y < x : y > x);
                out.push({ where: `${kind}/${id}`, metric: m, before: x, now: y, worse });
            }
        }
    }
    return out;
}

function totals(set) {
    const t = {};
    for (const r of Object.values(set || {})) for (const [k, v] of Object.entries(r)) if (typeof v === "number" && !NEUTRAL.has(k)) t[k] = round((t[k] || 0) + v);
    return t;
}

function report(base, now, diff) {
    for (const kind of ["videos", "scenarios"]) {
        if (!Object.keys(now[kind]).length) continue;
        const a = totals(base[kind]), b = totals(now[kind]);
        console.log(`\n${kind} (${Object.keys(now[kind]).length}), baseline ${base.version} -> now ${now.version}`);
        for (const k of Object.keys(b)) console.log(`  ${k.padEnd(16)} ${String(a[k] != null ? a[k] : "-").padStart(9)} -> ${String(b[k]).padStart(9)}${a[k] !== b[k] ? "   *" : ""}`);
    }
    const worse = diff.filter(d => d.worse);
    console.log(`\n${diff.length} numbers moved, ${worse.length} worse`);
    for (const d of diff.slice(0, 200)) console.log(`  ${d.worse ? "WORSE" : "     "} ${d.where} ${d.metric}: ${d.before} -> ${d.now}`);
    return worse.length;
}

async function main() {
    const save = process.argv.includes("--save");
    const now = await measure({ videosOnly: process.argv.includes("--videos-only") });
    if (!Object.keys(now.videos).length) console.log(`no saved video under ${ARCHIVE}`);
    if (save) {
        fs.mkdirSync(ARCHIVE, { recursive: true });
        fs.writeFileSync(BASELINE, JSON.stringify(now, null, 1));
        console.log(`baseline saved: ${Object.keys(now.videos).length} videos, ${Object.keys(now.scenarios).length} scenarios, ${now.version}`);
        return 0;
    }
    if (!fs.existsSync(BASELINE)) { console.log("no baseline yet: node tools/regress.js --save"); return 1; }
    const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    if (base.format !== FORMAT) { console.log(`baseline format ${base.format}, this tool ${FORMAT}: save a new one from the commit before your change`); return 1; }
    if (!Object.keys(now.scenarios).length) base.scenarios = {};
    return report(base, now, compare(base, now)) ? 1 : 0;
}

if (require.main === module) main().then(code => process.exit(code), e => { console.error(e); process.exit(1); });
module.exports = { measure, compare, totals, BASELINE, ARCHIVE };
