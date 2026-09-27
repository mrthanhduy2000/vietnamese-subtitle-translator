// Text-only prosody evaluation (1.8.0; manual, not in npm test; no server, no audio). Scores what the
// prosody model decides from the text alone against the marks of tests/prosody-corpus.js (| a pause
// is expected, / one is fine, unmarked a pause is wrong):
//   WRONG     the text-only breath groups (breathGroups) pause where the marks say none
//   MISSED    a "|" the text-only choice does not pause at
//   INVITE    an unmarked gap the model rates a phrase boundary (value >= 0.3): a stop of the voice
//             there is likely kept. Lower is better, 0 is not the goal (the voice rarely stops there)
//   BLOCKED   a "|" the model forbids outright (value < 0): the voice's stop there is closed
//   HARD      an unmarked gap inside a unit (name, number + unit, term) the model does NOT forbid
// and, for sentences given as subtitle lines (tests/blind-corpus.js "cues"), where the free voice's
// segments are cut (a cut restarts the voice: a pause at the cut), with lines back to back (0.1 s)
// and with a 0.7 s gap between lines (the speaker paused there):
//   CUT-WRONG a segment cut at an unmarked gap
// This is a proxy: it measures agreement with one reader's marks, not how the speech sounds. Real
// takes: tools/prosody-eval.js.
//   node tools/syntax-eval.js [--set=syntax,syntaxval] [--old=<git rev>] [--detail]
//   node tools/syntax-eval.js --corpus=tests/blind-corpus.js     (its "prosody" and "cues" lists)
const path = require("path"), fs = require("fs"), os = require("os");
const { execFileSync } = require("child_process");
const REPO = path.join(__dirname, "..");
const arg = name => (process.argv.find(a => a.startsWith(`--${name}=`)) || "").split("=").slice(1).join("=");
const detail = process.argv.includes("--detail");

function load(dir) {
    // modules install globals: one set per process
    return { PLAN: require(path.join(dir, "dub-planner.js")), P: require(path.join(dir, "dub-prosody.js")) };
}

function parse(PLAN, marked) {
    const words = [], gold = [];
    for (const t of PLAN.adaptForSpeech(marked).split(/\s+/).filter(Boolean)) {
        if (t === "|" || t === "/") { if (words.length) gold[words.length - 1] = t === "|" ? 2 : 1; continue; }
        words.push(t); gold.push(0);
    }
    return { words, gold, text: words.join(" ") };
}

function scoreSentences(M, items) {
    const out = { n: 0, wrong: 0, missed: 0, invite: 0, blocked: 0, hard: 0, gaps: 0, faults: [] };
    for (const [id, , m] of items) {
        const { words, gold, text } = parse(M.PLAN, m);
        const a = M.P.analyze(text);
        if (a.words.length !== words.length) { out.faults.push(`${id}: tokenisation differs, skipped`); continue; }
        out.n++;
        const chosen = new Set(M.P.breathGroups(text).map(b => b.gap));
        a.gaps.forEach((g, i) => {
            if (g.punct) return;
            out.gaps++;
            const mark = gold[i], at = `${words[i]} | ${words[i + 1]}`;
            if (chosen.has(i) && mark === 0) { out.wrong++; out.faults.push(`${id} WRONG   ${at}`); }
            if (!chosen.has(i) && mark === 2) { out.missed++; out.faults.push(`${id} MISSED  ${at}`); }
            if (mark === 0 && g.value >= 0.3) { out.invite++; out.faults.push(`${id} INVITE  ${at} (${g.value.toFixed(2)})`); }
            if (mark === 2 && g.value < 0) { out.blocked++; out.faults.push(`${id} BLOCKED ${at} (${g.value.toFixed(2)})`); }
            if (mark === 0 && g.unit && g.value >= 0) { out.hard++; out.faults.push(`${id} HARD    ${at}`); }
        });
    }
    return out;
}

// cues: [{ id, cues: [...], marked }] -> segment cuts of the free voice
function scoreCues(M, items) {
    const out = { n: 0, cuts: 0, wrong: 0, faults: [] };
    const SEG = require(path.join(REPO, "vi-segmenter.js"));
    for (const gap of [0.1, 0.7]) {
        for (const it of items) {
            const { words, gold } = parse(M.PLAN, it.marked);
            let t = 10;
            const groups = it.cues.map(text => {
                const dur = Math.max(0.8, M.PLAN.countSyllables(text) / 4.6);
                const g = { start: t, end: t + dur, viText: text, viCues: [{ start: t, end: t + dur, text, lines: [text] }], srcCues: [{ start: t, end: t + dur, text: "" }] };
                t += dur + gap;
                return g;
            });
            const segs = M.PLAN.buildDubScript(groups, { joinGroups: true, segSoft: 8, segHard: 11 });
            out.n++;
            // word index where each segment after the first starts
            let w = 0;
            segs.forEach((s, k) => {
                const n = SEG.tokenize(M.PLAN.adaptForSpeech(SEG.cleanText(s.subtitleText || s.speechSource || ""))).length;
                if (k > 0) {
                    out.cuts++;
                    const i = w - 1;
                    if (i >= 0 && i < gold.length - 1 && gold[i] === 0 && !/[.,;:!?…]$/.test(words[i])) {
                        out.wrong++; out.faults.push(`${it.id} (gap ${gap}s) CUT-WRONG ${words[i]} | ${words[i + 1]}`);
                    }
                }
                w += n;
            });
        }
    }
    return out;
}

function run(dir, spec) {
    const M = load(dir);
    const res = {};
    for (const [name, items] of Object.entries(spec.sets)) res[name] = scoreSentences(M, items);
    if (spec.cues) res.cues = scoreCues(M, spec.cues);
    return res;
}

function spec() {
    const c = arg("corpus");
    if (c) { const B = require(path.resolve(REPO, c)); return { sets: { blind: B.prosody || [] }, cues: B.cues || [] }; }
    const SETS = require(path.join(REPO, "tests", "prosody-corpus.js"));
    const names = (arg("set") || Object.keys(SETS).join(",")).split(",");
    return { sets: Object.fromEntries(names.map(n => [n, SETS[n]])), cues: null };
}

// child mode: score with the modules in a directory, print JSON
const modArg = arg("modules");
if (modArg) { process.stdout.write(JSON.stringify(run(modArg, spec()))); process.exit(0); }

function moduleDir(rev) {
    const dir = path.join(os.tmpdir(), `cst-syntax-${rev.replace(/[^\w.-]/g, "_")}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ["vi-segmenter.js", "dub-planner.js", "dub-prosody.js", "dub-speech.js"]) {
        try { fs.writeFileSync(path.join(dir, f), execFileSync("git", ["show", `${rev}:${f}`], { cwd: REPO, stdio: ["ignore", "pipe", "ignore"] })); }
        catch (e) { try { fs.unlinkSync(path.join(dir, f)); } catch (e2) { /* absent */ } }
    }
    return dir;
}
const child = dir => JSON.parse(execFileSync(process.execPath, [__filename, `--modules=${dir}`, ...process.argv.slice(2).filter(a => !a.startsWith("--old="))], { maxBuffer: 1 << 26 }).toString());

const runs = [];
if (arg("old")) runs.push([`old (${arg("old")})`, child(moduleDir(arg("old")))]);
runs.push(["current", child(REPO)]);
for (const [label, res] of runs) {
    console.log(`\n== ${label}`);
    for (const [name, r] of Object.entries(res)) {
        if (name === "cues") console.log(`cues: ${r.n} runs, ${r.cuts} cuts, CUT-WRONG ${r.wrong}`);
        else console.log(`${name}: ${r.n} sentences, ${r.gaps} gaps | WRONG ${r.wrong}  MISSED ${r.missed}  INVITE ${r.invite}  BLOCKED ${r.blocked}  HARD ${r.hard}`);
        if (detail) for (const f of r.faults) console.log("   " + f);
    }
}
