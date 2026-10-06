#!/usr/bin/env node
// A batch review in one command (2.4.7), for "Đã có dữ liệu rà soát mới". Reads the user's saved
// videos straight from Chrome's storage (tools/ext-storage.js, read only), takes the ones saved after
// REVIEW_MARK (background.js), and prints:
//   1. one row per new video: text flags and the voice in the simulator (tools/batch-review.js)
//   2. the batch's rates per 100 groups beside those of every video reviewed before
//   3. the flagged lines, class by class (what to read before changing anything)
//   4. the regression net over every reviewed video (tools/regress.js), unless --no-regress
// Then, once the batch is dealt with:
//   node tools/review.js --close     copies the batch into review-archive/<date>-videos-<a>-<b>,
//                                    moves REVIEW_MARK in background.js, saves a new baseline.
//                                    background.js changed: bump the version (node tools/bump-version.js).
// Options: --dump=<folder> reuse a dump instead of reading Chrome; --dir=<leveldb folder> another
// profile; --n=10 lines per class; --show=a,b only these classes.
const fs = require("fs");
const os = require("os");
const path = require("path");
const REPO = path.join(__dirname, "..");
const STORE = require("./ext-storage.js");
const BR = require("./batch-review.js");
const REG = require("./regress.js");

const arg = n => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : ""; };
const has = n => process.argv.includes(`--${n}`);
const CLASSES = ["refine", "omission", "untranslated", "empty", "leftover", "noteInside", "turns", "labels", "dup", "mended", "voiceSwitch", "calque", "repeat", "addition"];
const MARK_RE = /const REVIEW_MARK = \{ until: (\d+), videos: (\d+) \};[^\n]*/;
const DEFAULT_STORE = path.join(os.homedir(), "Library/Application Support/Google/Chrome/Profile 42/Local Extension Settings/lpknjhmnlocilmkmooomffknibghibao");

function readMark() {
    const m = fs.readFileSync(path.join(REPO, "background.js"), "utf8").match(MARK_RE);
    if (!m) throw new Error("REVIEW_MARK not found in background.js");
    return { until: Number(m[1]), videos: Number(m[2]) };
}

function dumpStore() {
    const given = arg("dump");
    if (given) return given;
    const out = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), "cst-review-"));
    const store = STORE.readStore(arg("dir") || DEFAULT_STORE);
    let n = 0;
    for (const [k, r] of store) if (k.startsWith("ytcache4_")) { fs.writeFileSync(path.join(out, k.replace(/[^\w.-]/g, "_") + ".json"), r.value); n++; }
    console.log(`${n} saved videos read from Chrome into ${out}`);
    return out;
}

const per100 = (rows, cols) => {
    const g = rows.reduce((a, r) => a + r.groups, 0) || 1;
    return Object.fromEntries(cols.map(c => [c, +(rows.reduce((a, r) => a + (r[c] || 0), 0) * 100 / g).toFixed(2)]));
};

async function main() {
    const mark = readMark();
    const dump = dumpStore();
    const files = BR.listVideos(dump, mark.until);
    console.log(`REVIEW_MARK: ${mark.videos} videos reviewed, until ${new Date(mark.until).toISOString()}. New: ${files.length}`);
    if (!files.length) return 0;

    const out = files.map(f => ({ file: f, ...BR.review(f) })).sort((a, b) => (a.row.saved < b.row.saved ? -1 : 1));
    for (const o of out) {
        const r = await BR.simulate(o.file, { latency: "busy" });      // as the baseline, so section 2 compares alike
        if (r) for (const c of BR.SIM_COLS) o.row[c] = r[c];
    }
    console.log("\n## 1. New videos");
    BR.printTable(out.map(o => o.row), Object.keys(out[0].row));

    console.log("\n## 2. Per 100 groups: this batch against every reviewed video");
    const cols = [...BR.TEXT_COLS, "dropped", "late", "wordsLost"];
    const base = fs.existsSync(REG.BASELINE) ? Object.values(JSON.parse(fs.readFileSync(REG.BASELINE, "utf8")).videos) : [];
    const a = per100(base, cols), b = per100(out.map(o => o.row), cols);
    for (const c of cols) console.log(`  ${c.padEnd(13)} ${String(base.length ? a[c] : "-").padStart(7)}  ${String(b[c]).padStart(7)}${base.length && b[c] > a[c] * 1.5 && b[c] - a[c] >= 0.5 ? "   <- higher than before" : ""}`);

    console.log("\n## 3. Flagged lines");
    const show = arg("show") ? arg("show").split(",") : CLASSES.filter(k => out.some(o => (o.lines[k] || []).length));
    BR.printLines(out, show, Number(arg("n")) || 10);

    let code = 0;
    if (!has("no-regress")) {
        console.log("\n## 4. Regression net over the reviewed videos (tools/regress.js)");
        if (!fs.existsSync(REG.BASELINE)) console.log("no baseline yet: node tools/regress.js --save");
        else {
            const baseline = JSON.parse(fs.readFileSync(REG.BASELINE, "utf8"));
            const now = await REG.measure();
            const diff = REG.compare(baseline, now);
            const worse = diff.filter(d => d.worse);
            console.log(`${diff.length} numbers moved since the baseline (${baseline.version}), ${worse.length} worse`);
            for (const d of diff.slice(0, 40)) console.log(`  ${d.worse ? "WORSE" : "     "} ${d.where} ${d.metric}: ${d.before} -> ${d.now}`);
            if (worse.length) code = 1;
        }
    }

    if (has("close")) {
        const first = mark.videos + 1, last = mark.videos + files.length;
        const folder = path.join(REG.ARCHIVE, `${new Date().toISOString().slice(0, 10)}-videos-${first}-${last}`);
        fs.mkdirSync(folder, { recursive: true });
        for (const f of files) fs.copyFileSync(f, path.join(folder, path.basename(f)));
        const until = Math.max(...files.map(f => JSON.parse(fs.readFileSync(f, "utf8")).luc || 0));
        const bgPath = path.join(REPO, "background.js");
        const day = new Date().toISOString().slice(0, 10);
        fs.writeFileSync(bgPath, fs.readFileSync(bgPath, "utf8").replace(MARK_RE,
            `const REVIEW_MARK = { until: ${until}, videos: ${last} };      // ${day}, the ${files.length}-video batch`));
        fs.writeFileSync(REG.BASELINE, JSON.stringify(await REG.measure(), null, 1));
        console.log(`\nclosed: ${files.length} videos in ${path.relative(REPO, folder)}, REVIEW_MARK -> ${last} videos until ${until}, baseline saved.`);
        console.log("background.js changed: node tools/bump-version.js, then the handover.");
    }
    return code;
}

if (require.main === module) main().then(code => process.exit(code), e => { console.error(e); process.exit(1); });
