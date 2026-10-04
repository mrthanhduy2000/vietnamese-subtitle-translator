#!/usr/bin/env node
// Batch review of the user's saved YouTube videos (2.4.2): one row per video with what a review
// reads first, then totals. Translation: the quality check's flags (vi-quality.js assess: lines that
// would ask for a refine, omissions, English left in, empty lines), music notes inside a sentence,
// ">>" kept, speaker labels kept in the subtitle, the same line twice in a row. With --sim, the voice
// too (tools/playback-sim.js --real on each video: lines spoken, dropped, started late, words lost).
//
//   node tools/ext-storage.js --prefix=ytcache4_ --out=$TMPDIR/yt
//   node tools/batch-review.js $TMPDIR/yt                         every saved video
//   node tools/batch-review.js $TMPDIR/yt --since=<ms>            saved after REVIEW_MARK.until (background.js)
//   node tools/batch-review.js $TMPDIR/yt --sim                   + the dubbing simulation (a 3-hour video ~30 s)
//   node tools/batch-review.js $TMPDIR/yt --show=omission,leftover --n=20   the flagged lines themselves
//
// --show takes any flag type of assess (omission, untranslated, empty, calque, repeat, addition) and
// leftover, noteInside, turns, dup. Read only; nothing is written anywhere.
const fs = require("fs");
const path = require("path");
const REPO = path.join(__dirname, "..");
const Q = require(path.join(REPO, "vi-quality.js"));

const arg = n => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : ""; };
const dir = process.argv[2];
if (!dir || dir.startsWith("--")) { console.error("usage: node tools/batch-review.js <dump folder> [--since=<ms>] [--sim] [--show=a,b] [--n=20]"); process.exit(1); }
const since = Number(arg("since")) || 0;
const show = arg("show") ? arg("show").split(",") : [];
const showN = Number(arg("n")) || 20;

const LABEL = /(?:^|[.!?…-]\s+)\p{Lu}[\p{Lu}.'-]+(?:\s+\p{Lu}[\p{Lu}.'-]+){0,3}:\s/u;
const syllables = t => String(t || "").replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

// Judged as the user sees a saved video now: with the free fixes ytRepairCachedLeaks applies on load
const SIM = require(path.join(REPO, "tools/playback-sim.js"));

function review(file) {
    const v = JSON.parse(fs.readFileSync(file, "utf8"));
    const mended = SIM.realGroups(file);
    const g = (v.g || []).map((x, k) => (mended[k] ? [x[0], x[1], mended[k].viText, x[3]] : x));
    const span = g.length ? g[g.length - 1][1] - g[0][0] : 0;
    const row = { video: path.basename(file).replace(/^ytcache4_|\.json$/g, ""), saved: new Date(v.luc || 0).toISOString().slice(0, 16), minutes: +(span / 60).toFixed(1), groups: g.length };
    const n = { refine: 0, omission: 0, untranslated: 0, empty: 0, leftover: 0, noteInside: 0, turns: 0, labels: 0, dup: 0 };
    const lines = {};
    const keep = (k, x) => (lines[k] = lines[k] || []).push(x);
    let viSyl = 0, prev = "";
    for (const [s, e, vi, srcCues] of g) {
        const src = (srcCues || []).map(c => c[2]).join(" ");
        const at = { video: row.video, t: s, src, vi };
        viSyl += syllables(vi);
        const a = Q.assess(src, vi);
        if (a.needsRefine) n.refine++;
        for (const i of a.issues) { if (i.type in n) n[i.type]++; keep(i.type, { ...at, d: i.detail }); }
        const left = Q.englishLeftovers(vi).filter(w => new RegExp(`\\b${w}\\b`, "i").test(src));
        if (left.length) { n.leftover += left.length; keep("leftover", { ...at, d: left.join(", ") }); }
        if (/[\p{L}\p{N},]\s+\[Âm nhạc\]\s+\p{Ll}/u.test(vi)) { n.noteInside++; keep("noteInside", at); }
        if (/>>/.test(vi)) { n.turns++; keep("turns", at); }
        if (LABEL.test(vi)) n.labels++;
        if (vi && vi === prev) { n.dup++; keep("dup", at); }
        prev = vi;
        void e;
    }
    row.viSylPerSec = +(viSyl / (span || 1)).toFixed(2);
    return { row: { ...row, ...n }, lines };
}

(async () => {
    const files = fs.readdirSync(dir).filter(f => /^ytcache4_.*\.json$/.test(f)).map(f => path.join(dir, f))
        .filter(f => !since || (JSON.parse(fs.readFileSync(f, "utf8")).luc || 0) > since);
    const out = files.map(review).sort((a, b) => (a.row.saved < b.row.saved ? -1 : 1));
    if (process.argv.includes("--sim")) {
        const ENG = require(path.join(REPO, "dub-engine.js"));
        for (const o of out) {
            const groups = SIM.realGroups(path.join(dir, `ytcache4_${o.row.video}.json`));
            if (!groups.length) continue;
            const r = await SIM.run(ENG, { groups, wall: groups[groups.length - 1].end + 5, sps: Number(arg("sps")) || 3.8, trAhead: 1e9, trLat: () => 0, bgAbort: "queued" });
            Object.assign(o.row, { spoken: r.spoken, dropped: r.dropped, late: r.late, wordsLost: r.wordsLost, rateP50: r.rateP50, rateMax: r.rateMax });
        }
    }
    if (!out.length) { console.log("no saved video" + (since ? " after " + new Date(since).toISOString() : "")); return; }
    const cols = Object.keys(out[0].row);
    console.log(cols.join("\t"));
    for (const o of out) console.log(cols.map(c => (o.row[c] == null ? "-" : o.row[c])).join("\t"));
    const sum = {};
    for (const o of out) for (const c of cols) if (typeof o.row[c] === "number" && !/PerSec|rate/.test(c)) sum[c] = +((sum[c] || 0) + o.row[c]).toFixed(1);
    console.log("TOTAL\t" + Object.entries(sum).map(([k, x]) => `${k} ${x}`).join("  "));
    for (const k of show) {
        const list = out.flatMap(o => o.lines[k] || []);
        console.log(`\n### ${k} (${list.length})`);
        for (const x of list.slice(0, showN)) console.log(`${x.video} ${x.t.toFixed(1)}${x.d ? "  " + x.d : ""}\n  EN: ${x.src}\n  VI: ${x.vi}`);
    }
})();
