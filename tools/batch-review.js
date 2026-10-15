#!/usr/bin/env node
// Batch review of the user's saved YouTube videos (2.4.2): one row per video with what a review
// reads first, then totals. Translation: the quality check's flags (vi-quality.js assess: lines that
// would ask for a refine, omissions, English left in, empty lines), music notes inside a sentence,
// ">>" kept, speaker labels kept in the subtitle, the same line twice in a row, and (2.4.7) `mended`,
// the groups the free repairs a cached video gets on load changed (a new kind of slip shows here
// first). With --sim, the voice too (tools/playback-sim.js --real on each video: lines spoken,
// dropped, started late, words lost). `node tools/review.js` runs all of this in one go.
//
//   node tools/ext-storage.js --prefix=ytcache4_ --out=$TMPDIR/yt
//   node tools/batch-review.js $TMPDIR/yt                         every saved video
//   node tools/batch-review.js $TMPDIR/yt --since=<ms>            saved after REVIEW_MARK.until (background.js)
//   node tools/batch-review.js $TMPDIR/yt --sim                   + the dubbing simulation (a 3-hour video ~30 s)
//   node tools/batch-review.js $TMPDIR/yt --show=omission,leftover --n=20   the flagged lines themselves
//
// --show takes any flag type of assess (omission, untranslated, empty, calque, repeat, addition) and
// refine, leftover, noteInside, turns, dup, mended, voiceSwitch. voice2 is the second voice's share
// of the talk in % (were it switched on). Read only; nothing is written anywhere.
const fs = require("fs");
const path = require("path");
const REPO = path.join(__dirname, "..");
const Q = require(path.join(REPO, "vi-quality.js"));
// Judged as the user sees a saved video now: with the free fixes ytRepairCachedLeaks applies on load
const SIM = require(path.join(REPO, "tools/playback-sim.js"));

const LABEL = /(?:^|[.!?…-]\s+)\p{Lu}[\p{Lu}.'-]+(?:\s+\p{Lu}[\p{Lu}.'-]+){0,3}:\s/u;
const syllables = t => String(t || "").replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const TEXT_COLS = ["refine", "omission", "untranslated", "empty", "leftover", "noteInside", "turns", "labels", "dup", "mended", "voiceSwitch", "voice2"];
const PLAN = require(path.join(REPO, "dub-planner.js"));
const SIM_COLS = ["spoken", "dropped", "late", "wordsLost", "rateP50", "rateMax"];

function review(file) {
    const v = JSON.parse(fs.readFileSync(file, "utf8"));
    const mended = SIM.realGroups(file);
    const raw = v.g || [];
    const g = raw.map((x, k) => (mended[k] ? [x[0], x[1], mended[k].viText, x[3]] : x));
    const span = g.length ? g[g.length - 1][1] - g[0][0] : 0;
    const row = { video: path.basename(file).replace(/^ytcache4_|\.json$/g, ""), saved: new Date(v.luc || 0).toISOString().slice(0, 16), minutes: +(span / 60).toFixed(1), groups: g.length };
    const n = Object.fromEntries(TEXT_COLS.map(c => [c, 0]));
    const lines = {};
    const keep = (k, x) => (lines[k] = lines[k] || []).push(x);
    let viSyl = 0, prev = "";
    g.forEach(([s, , vi, srcCues], k) => {
        const src = (srcCues || []).map(c => c[2]).join(" ");
        const at = { video: row.video, t: s, src, vi };
        viSyl += syllables(vi);
        if (vi !== raw[k][2]) { n.mended++; keep("mended", { ...at, d: "before: " + raw[k][2] }); }
        const a = Q.assess(src, vi);
        if (a.needsRefine) { n.refine++; keep("refine", { ...at, d: a.issues.filter(i => i.severity >= 3).map(i => i.detail).join("; ") }); }
        for (const i of a.issues) { if (i.type in n) n[i.type]++; keep(i.type, { ...at, d: i.detail }); }
        const left = Q.englishLeftovers(vi).filter(w => new RegExp(`\\b${w}\\b`, "i").test(src));
        if (left.length) { n.leftover += left.length; keep("leftover", { ...at, d: left.join(", ") }); }
        if (/[\p{L}\p{N},]\s+\[Âm nhạc\]\s+\p{Ll}/u.test(vi)) { n.noteInside++; keep("noteInside", at); }
        if (/>>/.test(vi)) { n.turns++; keep("turns", at); }
        if (LABEL.test(vi)) { n.labels++; keep("labels", at); }
        // a run of "[Âm nhạc]" lines is the song going on, not a line shown twice
        if (vi && vi === prev && !/^(?:\s*\[[^\][]*\])+\s*$/.test(vi)) { n.dup++; keep("dup", at); }
        prev = vi;
    });
    row.viSylPerSec = +(viSyl / (span || 1)).toFixed(2);
    // the second voice, if switched on (2.4.8): how often it changes and its share of the talk. A
    // one-person video must show 0 and 0
    const script = PLAN.buildDubScript(mended, { joinGroups: true, segSoft: 8, segHard: 11, speakerTurns: PLAN.speakerTurns(mended) });
    let s2 = 0, all = 0;
    script.forEach((x, k) => {
        if (k && x.speaker !== script[k - 1].speaker) { n.voiceSwitch++; keep("voiceSwitch", { video: row.video, t: x.start, src: x.srcText, vi: `${x.speaker}: ${x.subtitleText}` }); }
        all += x.end - x.start;
        if (x.speaker !== "S1") s2 += x.end - x.start;
    });
    n.voice2 = Math.round(100 * s2 / (all || 1));
    return { row: { ...row, ...n }, lines };
}

// The voice over one saved video. latency: as tools/playback-sim.js LATENCY (undefined, a number of
// ms, or "busy"); engine: another dub-engine.js module to compare against. Voices follow the speakers,
// the shipped default since 2.5.2 (dubbing.js dubSpeakers "auto": a turn ends a take); oneVoice: one
// voice for everyone, as every run before 2.5.2 measured
async function simulate(file, opts = {}) {
    const ENG = opts.engine || require(path.join(REPO, "dub-engine.js"));
    const groups = SIM.realGroups(file);
    if (!groups.length) return null;
    return SIM.run(ENG, { groups, wall: groups[groups.length - 1].end + 5, sps: opts.sps || 3.8, trAhead: 1e9, trLat: () => 0, bgAbort: "queued", latency: opts.latency,
        settings: opts.oneVoice ? undefined : { secondVoice: true } });
}

// The saved videos of one or more dump folders, one file per video (a later folder wins)
function listVideos(dirs, since = 0) {
    const byName = new Map();
    for (const d of [].concat(dirs)) {
        if (!fs.existsSync(d)) continue;
        for (const f of fs.readdirSync(d).filter(x => /^ytcache4_.*\.json$/.test(x))) byName.set(f, path.join(d, f));
    }
    return [...byName.values()].filter(f => !since || (JSON.parse(fs.readFileSync(f, "utf8")).luc || 0) > since);
}

function printTable(rows, cols) {
    console.log(cols.join("\t"));
    for (const r of rows) console.log(cols.map(c => (r[c] == null ? "-" : r[c])).join("\t"));
    const sum = {};
    for (const r of rows) for (const c of cols) if (typeof r[c] === "number" && !/PerSec|rate/.test(c)) sum[c] = +((sum[c] || 0) + r[c]).toFixed(1);
    console.log("TOTAL\t" + Object.entries(sum).map(([k, x]) => `${k} ${x}`).join("  "));
}

function printLines(out, show, showN) {
    for (const k of show) {
        const list = out.flatMap(o => o.lines[k] || []);
        console.log(`\n### ${k} (${list.length})`);
        for (const x of list.slice(0, showN)) console.log(`${x.video} ${x.t.toFixed(1)}${x.d ? "  " + x.d : ""}\n  EN: ${x.src}\n  VI: ${x.vi}`);
    }
}

async function main() {
    const arg = n => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : ""; };
    const dir = process.argv[2];
    if (!dir || dir.startsWith("--")) { console.error("usage: node tools/batch-review.js <dump folder> [--since=<ms>] [--sim] [--show=a,b] [--n=20]"); process.exit(1); }
    const since = Number(arg("since")) || 0;
    const show = arg("show") ? arg("show").split(",") : [];
    const out = listVideos(dir, since).map(review).sort((a, b) => (a.row.saved < b.row.saved ? -1 : 1));
    if (!out.length) { console.log("no saved video" + (since ? " after " + new Date(since).toISOString() : "")); return; }
    if (process.argv.includes("--sim")) {
        for (const o of out) {
            const r = await simulate(path.join(dir, `ytcache4_${o.row.video}.json`), { sps: Number(arg("sps")) || 3.8 });
            if (r) for (const c of SIM_COLS) o.row[c] = r[c];
        }
    }
    printTable(out.map(o => o.row), Object.keys(out[0].row));
    printLines(out, show, Number(arg("n")) || 20);
}

if (require.main === module) main();
module.exports = { review, simulate, listVideos, printTable, printLines, TEXT_COLS, SIM_COLS };
