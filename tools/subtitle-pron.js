// How the free voice (VieNeu) says the English the translation kept, on real subtitles (manual, needs
// ~/VieNeu-TTS). Every Vietnamese line of the reviewed videos (review-archive/, plus --dir=<folder>
// of ytcache4_*.json) is sent through the extension's VieNeu text path exactly as the engine sends
// it (adaptForSpeech, breathing commas, render with the English source lines of the same time as
// evidence), then through the server's own front end (tools/vieneu-g2p.py).
// An "English span" is a run of words with no Vietnamese diacritics that either are not Vietnamese
// syllables or appear, written the same way, in the English source of that line ("Tom", "AI",
// "Marie Kondo"). Its phonemes are the difference against the same line with "cái" in its place. A
// span is "read Vietnamese" when a phoneme word carries a Vietnamese mark (tone digit, t̪ ɗ ɣ ɲ aː ɯ
// ɤ): spelled with Vietnamese letter names, or a word read as a Vietnamese syllable. Numerals are
// read in Vietnamese on purpose and do not count.
//   node tools/subtitle-pron.js [--old=<rev>] [--dir=<folder>] [--show=40] [--json=<file>] [--words]
// --old: the same lines through the text path of a git revision too, and both counts.
// --words: also list every span word by how often it is read Vietnamese.
const path = require("path"), fs = require("fs"), os = require("os");
const { execFileSync } = require("child_process");
const REPO = path.join(__dirname, "..");
const PY = process.env.VIENEU_PY || path.join(os.homedir(), "VieNeu-TTS", ".venv", "bin", "python");
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };

// ---- render mode (child): [{ text, source }] on stdin, rendered with the code under --root ----
const render = arg("render", null);
if (render) {
    const root = render;
    for (const f of ["glossary.js", "glossary-extra.js", "glossary-data.js"]) if (fs.existsSync(path.join(root, f))) require(path.join(root, f));
    const PLAN = require(path.join(root, "dub-planner.js"));
    const SPEECH = require(path.join(root, "dub-speech.js"));
    const items = JSON.parse(fs.readFileSync(0, "utf8"));
    // render, not vieneuText: breathing commas change no reading, and they would move between a line and
    // its variant and blur the difference
    process.stdout.write(JSON.stringify(items.map(x => SPEECH.render(PLAN.adaptForSpeech(x.text), { source: x.source }).text)));
    return;
}

const SEGM = require(path.join(REPO, "vi-segmenter.js"));
const isViet = w => SEGM.isVietWord(w.toLowerCase());
const DIACRITIC = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

// ---- the lines ----
const dirs = [];
const archive = path.join(REPO, "review-archive");
if (fs.existsSync(archive)) for (const f of fs.readdirSync(archive)) if (fs.statSync(path.join(archive, f)).isDirectory()) dirs.push(path.join(archive, f));
if (arg("dir", null)) dirs.push(path.resolve(arg("dir")));
const files = new Map();
for (const d of dirs) for (const f of fs.readdirSync(d)) if (/^ytcache\d*_.+\.json$/.test(f) && !files.has(f)) files.set(f, path.join(d, f));
const lines = [];
for (const [name, file] of files) {
    let data; try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { continue; }
    if (!Array.isArray(data.vi) || !Array.isArray(data.cues)) continue;
    for (const [s, e, vi] of data.vi) {
        const text = String(vi || "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        const source = data.cues.filter(c => c[1] > s - 0.5 && c[0] < e + 0.5).map(c => c[2]).join(" ");
        lines.push({ video: name, text, source });
    }
}

// ---- the English spans of each line ----
// Vietnamese written with Latin letters only: loanwords and units the translator chose, said the
// Vietnamese way on purpose ("5 kg" is "năm ki lô gam")
const VI_LOAN = new Set(("axit oxy siro tivi gara magie photpho canxi kali natri sắt video internet " +
    "kg g mg mcg km m cm mm ml l h s ph").split(" "));
const UNIT = /^\d+(?:[.,]\d+)?(?:kg|g|mg|mcg|km|m|cm|mm|ml|l|h|s|m\d+)$/i;
const core = w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}+#]+$/gu, "");
const spans = [];
for (const [li, ln] of lines.entries()) {
    const words = ln.text.split(" ");
    const srcWords = new Set(ln.source.split(/[^\p{L}\p{N}'+#.&-]+/u).map(core).filter(Boolean));
    const eng = words.map(w => {
        const c = core(w);
        if (!c || DIACRITIC.test(c) || !/[A-Za-z]/.test(c) || !/^[A-Za-z0-9.'&+#-]+$/.test(c)) return false;
        const bare = c.replace(/'s$/i, "");
        if (VI_LOAN.has(c.toLowerCase()) || UNIT.test(c)) return false;
        const viet = isViet(bare.replace(/[^A-Za-z]/g, ""));
        // a Vietnamese word in lower case is Vietnamese even when the source has it ("to", "do", "than")
        if (viet && !/[A-Z]/.test(bare)) return false;
        return !viet || srcWords.has(c) || srcWords.has(bare);
    });
    for (let i = 0; i < words.length; i++) {
        if (!eng[i]) continue;
        let j = i; while (j + 1 < words.length && eng[j + 1] && !/[,.;:!?]$/.test(words[j])) j++;
        const span = words.slice(i, j + 1).join(" ");
        const lead = words[i].match(/^[^\p{L}\p{N}]*/u)[0], trail = words[j].match(/[^\p{L}\p{N}+#]*$/u)[0];
        const variant = words.slice(0, i).concat([lead + "cái" + trail], words.slice(j + 1)).join(" ");
        spans.push({ line: li, span: core(span) || span, variant });
        i = j;
    }
}

// ---- render and read back ----
function renderWith(root, items) {
    return JSON.parse(execFileSync(process.execPath, [__filename, `--render=${root}`], { input: JSON.stringify(items), maxBuffer: 1 << 29 }).toString());
}
const g2pOnce = arr => JSON.parse(execFileSync(PY, [path.join(__dirname, "vieneu-g2p.py")], { input: JSON.stringify(arr), maxBuffer: 1 << 29, stdio: ["pipe", "pipe", "ignore"] }).toString());
function g2p(arr) {
    const out = [];
    for (let i = 0; i < arr.length; i += 400) {
        const part = arr.slice(i, i + 400);
        try { out.push(...g2pOnce(part)); }
        catch (e) { for (const t of part) { try { out.push(...g2pOnce([t])); } catch (e2) { out.push({ ph: [] }); } } }
    }
    return out.map(x => x.ph.join(" ").split(/\s+/).map(w => w.replace(/[.,;:!?"“”]+/g, "")).filter(Boolean));
}
const VI_MARK = /[0-9]|t̪|ɗ|ɣ|ɲ|aː|ɯ|ɤ/;
const NUM_PH = new Set(g2p(["không một hai ba bốn năm sáu bảy tám chín mười mươi mốt lăm tư trăm nghìn triệu tỷ lẻ linh chấm phẩy"])[0]);
function judge(root) {
    const used = [...new Set(spans.map(s => s.line))];
    const full = renderWith(root, used.map(i => lines[i]));
    const fullOf = new Map(used.map((i, k) => [i, full[k]]));
    const vars = renderWith(root, spans.map(s => ({ text: s.variant, source: lines[s.line].source })));
    const ph = g2p(used.map(i => fullOf.get(i)).concat(vars));
    const phOf = new Map(used.map((i, k) => [i, ph[k]]));
    return spans.map((s, k) => {
        const w = phOf.get(s.line), base = ph[used.length + k];
        let a = 0; while (a < w.length && a < base.length && w[a] === base[a]) a++;
        let b = 0; while (b < w.length - a && b < base.length - a && w[w.length - 1 - b] === base[base.length - 1 - b]) b++;
        const mine = w.slice(a, w.length - b);
        const viw = mine.filter(x => VI_MARK.test(x) && !NUM_PH.has(x));
        return { span: s.span, sent: fullOf.get(s.line), ph: mine.join(" "), vi: viw.length > 0 && mine.length > 0 };
    });
}

let oldRoot = null;
if (arg("old", null)) {
    oldRoot = fs.mkdtempSync(path.join(os.tmpdir(), "subpron-"));
    execFileSync("sh", ["-c", `git -C "${REPO}" archive "${arg("old")}" | tar -x -C "${oldRoot}"`]);
}
const now = judge(REPO);
const before = oldRoot ? judge(oldRoot) : null;
const count = r => r.filter(x => x.vi).length;
const pct = r => (100 * count(r) / Math.max(1, r.length)).toFixed(1);
console.log(`videos ${files.size} | lines ${lines.length} | English spans ${spans.length} (${new Set(spans.map(s => s.span)).size} distinct)`);
if (before) console.log(`read Vietnamese: ${arg("old")} ${count(before)} (${pct(before)}%) -> now ${count(now)} (${pct(now)}%)`);
else console.log(`read Vietnamese: ${count(now)} (${pct(now)}%)`);
const show = +arg("show", 30);
if (before) {
    const fixed = now.filter((x, i) => before[i].vi && !x.vi).length, broke = now.filter((x, i) => !before[i].vi && x.vi);
    console.log(`fixed ${fixed}, newly Vietnamese ${broke.length}`);
    for (const x of broke.slice(0, show)) console.log("  NEW ", x.span, "|", x.ph, "|", x.sent);
}
const byWord = new Map();
for (const x of now.filter(x => x.vi)) byWord.set(x.span, (byWord.get(x.span) || 0) + 1);
const top = [...byWord].sort((a, b) => b[1] - a[1]);
console.log(`distinct spans read Vietnamese: ${top.length}`);
for (const [w, n] of top.slice(0, process.argv.includes("--words") ? 1e9 : show)) {
    const ex = now.find(x => x.vi && x.span === w);
    console.log(`  ${String(n).padStart(3)}  ${w} | ${ex.ph}`);
}
const j = arg("json", null);
if (j) fs.writeFileSync(j, JSON.stringify({ now, before }, null, 1));
if (oldRoot) fs.rmSync(oldRoot, { recursive: true, force: true });
