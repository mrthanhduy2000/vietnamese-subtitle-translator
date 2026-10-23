// Pronunciation evaluation without audio (manual, not in npm test: needs ~/VieNeu-TTS). Every
// sentence of tests/speech-corpus.js goes through the extension's VieNeu text path, then through the
// VieNeu server's own front end (tools/vieneu-g2p.py: the same normalizer, chunker and phonemizer),
// and each marked span is judged on the phonemes the voice model will be given:
//   en        every phoneme word English (no Vietnamese tone digits, t̪ ɗ ɣ ɲ aː ư), not spelled out
//   letters   English letter names, one per letter
//   model     no "phẩy", "gạch ngang", "dash", "dot"; numbers in Vietnamese; names not Vietnamised
//   num       a quantity: Vietnamese numerals ("phẩy" allowed), the unit as the voice reads it
//   vi        nothing English; vletters: Vietnamese letter names
//   hold      the language cannot be told from the sentence: the extension must leave the word as
//             it is (no respelling, no <en> tag), whatever the voice then does with it
// A span's phonemes are found by rendering the sentence a second time with the span replaced by
// "cái" and diffing the two phoneme strings. Consistency: the same span in several sentences must
// get the same phonemes. The phonemes are what the model reads; how well it voices them is not
// measured here (tools/speech-ab.js renders audio).
//   node tools/pron-eval.js [--split=dev,validation] [--old=<git rev>] [--detail] [--json=<file>]
// --old renders the same sentences with that revision's modules (in a separate process: the modules
// install globals, two versions in one process would mix).
const path = require("path"), fs = require("fs"), os = require("os");
const { execFileSync } = require("child_process");
const REPO = path.join(__dirname, "..");

// ---- render mode: one module set per process ----
const renderArg = process.argv.find(a => a.startsWith("--render="));
if (renderArg) {
    const dir = renderArg.slice(9);
    const PLAN = require(path.join(dir, "dub-planner.js"));
    const PROS = require(path.join(dir, "dub-prosody.js"));
    let SPEECH = null;
    try { SPEECH = require(path.join(dir, "dub-speech.js")); } catch (e) { /* before 1.7.7 */ }
    const texts = JSON.parse(fs.readFileSync(0, "utf8"));
    // an item is a text, or [text, English source line] (evidence for a name's language)
    const out = texts.map(item => {
        const [raw, source] = Array.isArray(item) ? item : [item, ""];
        let s = PLAN.adaptForSpeech(raw);
        if (s && !/[.!?…]$/.test(s)) s += ".";
        return SPEECH && SPEECH.vieneuText ? SPEECH.vieneuText(s, { source }) : PROS.breathText(s);
    });
    process.stdout.write(JSON.stringify(out));
    process.exit(0);
}

const arg = name => (process.argv.find(a => a.startsWith(`--${name}=`)) || "").split("=").slice(1).join("=");
// --corpus=tests/blind-corpus.js scores that file's "speech" list as the split "blind"
const SETS = arg("corpus") ? { blind: require(path.resolve(REPO, arg("corpus"))).speech } : require(path.join(REPO, "tests", "speech-corpus.js"));
const splits = (arg("split") || (arg("corpus") ? "blind" : "dev,validation")).split(",");
const detail = process.argv.includes("--detail");
const PY = require("./platform-paths.js").vieneuPython();

function moduleDir(rev) {
    if (!rev) return REPO;
    const dir = path.join(os.tmpdir(), `cst-pron-${rev.replace(/[^\w.-]/g, "_")}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ["vi-segmenter.js", "dub-planner.js", "dub-prosody.js", "dub-speech.js"]) {
        try { fs.writeFileSync(path.join(dir, f), execFileSync("git", ["show", `${rev}:${f}`], { cwd: REPO, stdio: ["ignore", "pipe", "ignore"] })); }
        catch (e) { try { fs.unlinkSync(path.join(dir, f)); } catch (e2) { /* absent then and now */ } }
    }
    return dir;
}
const render = (dir, texts) => JSON.parse(execFileSync(process.execPath, [__filename, `--render=${dir}`], { input: JSON.stringify(texts), maxBuffer: 1 << 26 }).toString());
const g2p = texts => JSON.parse(execFileSync(PY, [path.join(__dirname, "vieneu-g2p.py")], { input: JSON.stringify(texts), maxBuffer: 1 << 26 }).toString());

// ---- phoneme word tools ----
const words = ph => ph.split(/\s+/).map(w => w.replace(/^[.,!?;:…"'()]+|[.,!?;:…"'()]+$/g, "")).filter(Boolean);
const bare = w => w.replace(/[ˈˌ]/g, "");
const VI_RE = /[0-9]|t̪|ɗ|ɣ|ɲ|aː|ɤ|ɯ|y/;
// "ɜ" alone is VieNeu's sắc tone ("ích" ˈiɜc, "quốc" kˈuəɜc); English has "ɜː" (1.8.0 fix: Vietnamese
// abbreviations were scored "read as English")
const EN_RE = /æ|ɑ|ɪ|ʊ|ʌ|ɚ|ɝ|ɜː|ɹ|θ|ð|ʒ|ᵻ|ɐ|eɪ|aɪ|oʊ|aʊ|ɔɪ|iː|uː|ɔː|ɡ|(?<!t)ʃ|dʒ/;
// Every Vietnamese syllable the segmenter accepts (onset x rime x tone), as VieNeu reads it: a word
// in this set is a Vietnamese reading even without a tone digit ("zˈi" is "di"). Cached per machine.
function vietReadings() {
    const cache = path.join(os.tmpdir(), "cst-vi-readings.json");
    try { return new Set(JSON.parse(fs.readFileSync(cache, "utf8"))); } catch (e) { /* build it */ }
    const SEG = require(path.join(REPO, "vi-segmenter.js"));
    const onsets = ["", "b", "c", "ch", "d", "đ", "g", "gh", "gi", "h", "k", "kh", "l", "m", "n", "ng", "ngh", "nh", "p", "ph", "qu", "r", "s", "t", "th", "tr", "v", "x"];
    const nuclei = ["a", "ă", "â", "e", "ê", "i", "o", "ô", "ơ", "u", "ư", "y", "ia", "iê", "ya", "yê", "ua", "uô", "ưa", "ươ", "oa", "oă", "oe", "uê", "uy", "uâ", "uơ", "oo"];
    const codas = ["", "c", "ch", "m", "n", "ng", "nh", "p", "t", "i", "y", "o", "u"];
    const TONES = { a: "aàáảãạ", ă: "ăằắẳẵặ", â: "âầấẩẫậ", e: "eèéẻẽẹ", ê: "êềếểễệ", i: "iìíỉĩị", o: "oòóỏõọ", ô: "ôồốổỗộ", ơ: "ơờớởỡợ", u: "uùúủũụ", ư: "ưừứửữự", y: "yỳýỷỹỵ" };
    const out = new Set();
    for (const o of onsets) for (const n of nuclei) for (const c of codas) for (let t = 0; t < 6; t++) {
        const base = n.split("");
        const k = base.length === 1 ? 0 : (c || base.length === 3 ? base.length - 1 : 0);
        base[k] = TONES[base[k]] ? TONES[base[k]][t] : base[k];
        const w = o + base.join("") + c;
        if (SEG.isVietWord(w)) out.add(w);
    }
    const list = [...out];
    const ph = JSON.parse(execFileSync(PY, [path.join(__dirname, "vieneu-g2p.py")], { input: JSON.stringify({ words: list }), maxBuffer: 1 << 26 }).toString());
    const set = [...new Set(ph.map(p => p.replace(/[ˈˌ.]/g, "")).filter(p => !EN_RE.test(p)))];
    fs.writeFileSync(cache, JSON.stringify(set));
    return new Set(set);
}
let VI_SET = null;
const langOf = w => {
    if (!VI_SET) VI_SET = vietReadings();
    return VI_RE.test(w) || VI_SET.has(bare(w)) ? "vi" : EN_RE.test(w) ? "en" : "?";
};
const EN_LETTER = { a: "eɪ", b: "biː", c: "siː", d: "diː", e: "iː", f: "ɛf", g: "dʒiː", h: "eɪtʃ", i: "aɪ", j: "dʒeɪ", k: "keɪ", l: "ɛl", m: "ɛm", n: "ɛn", o: "oʊ", p: "piː", q: "kjuː", r: "ɑːɹ", s: "ɛs", t: "tiː", u: "juː", v: "viː", w: "dʌbəljuː", x: "ɛks", y: "waɪ", z: "ziː" };
const LETTER_SET = new Set(Object.values(EN_LETTER));
const FORBIDDEN = ["fəɪ4", "ɣe-6c", "ŋaːŋ", "dæʃ", "dɑːt", "pɔɪnt"];   // phẩy, gạch ngang, dash, dot, point
const QUANTITY = ["ŋi2n", "tʃam"];                                          // nghìn, trăm
const EN_NUMBERS = /^(wʌn|tuː|θɹiː|fɔːɹ|faɪv|sɪks|sɛvən|eɪt|naɪn|tɛn|ɪlɛvən|twɛlv|.*tiːn|.*ti|hʌndɹəd|θaʊzənd)$/;

// the part of `full` that differs from `probe` (same sentence, span replaced by "cái")
function region(full, probe) {
    let a = 0;
    while (a < full.length && a < probe.length && bare(full[a]) === bare(probe[a])) a++;
    let b = 0;
    while (b < full.length - a && b < probe.length - a && bare(full[full.length - 1 - b]) === bare(probe[probe.length - 1 - b])) b++;
    return { got: full.slice(a, full.length - b), rest: probe.slice(a, probe.length - b) };
}

function judge(kind, surface, got, sent) {
    if (kind === "hold") return new RegExp(`(^|[^\\p{L}<>])${surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}<]|$)`, "u").test(sent) ? null : "rewritten";
    const langs = got.map(langOf);
    const joined = got.map(bare).join("");
    if (!got.length) return "not found";
    if (kind === "letters") {
        const want = surface.replace(/[^A-Za-z]/g, "").toLowerCase().split("").map(c => EN_LETTER[c]).join("");
        return joined === want ? null : "not English letter names";
    }
    if (kind === "vi" || kind === "vletters") return langs.includes("en") ? "read as English" : null;
    // a quantity's decimal point is "phẩy", never the version's "chấm" (tʃəɜm)
    if (kind === "num") return got.map(bare).some(w => EN_NUMBERS.test(w) || FORBIDDEN.slice(1).includes(w)) ? "English numerals or dash/dot" :
        got.map(bare).includes("tʃəɜm") ? "decimal read as a version (chấm)" : null;
    const forb = got.map(bare).filter(w => FORBIDDEN.includes(w));
    if (forb.length) return `says ${forb.join(" ")}`;
    if (kind === "model") {
        const b = got.map(bare);
        if (b.some(w => EN_NUMBERS.test(w) && !/^[a-z]+$/.test(surface))) return "English numerals";
        // "RTX 5090" read as an amount ("năm nghìn không trăm chín mươi"), not a model number
        if (/\b[A-Z]{2,5} \d{4}\b/.test(surface) && b.some(w => QUANTITY.includes(w))) return "model number read as a quantity";
        // the letter of "M3", "S25" said with its Vietnamese name ("mờ ba")
        for (const c of surface.match(/\b[A-Z](?=\d)/g) || []) if (!b.includes(EN_LETTER[c.toLowerCase()])) return `letter ${c} not English`;
        const nameVi = surface.split(/[\s-]+/).filter(p => /^[A-Za-z]{2,}$/.test(p) && !/^(phiên|bản|version)$/i.test(p));
        if (nameVi.length && !langs.includes("en")) return "name read as Vietnamese";
        return null;
    }
    // en
    if (langs.includes("vi")) return "Vietnamese reading: " + got.filter(w => langOf(w) === "vi").join(" ");
    const spelled = got.every(w => LETTER_SET.has(bare(w)));
    if (spelled && !/[A-Z]{2,}.*[a-z]|[a-z].*[A-Z]{2,}/.test(surface) && surface.length > 1) return "spelled letter by letter";
    return null;
}

function evaluate(dir, label) {
    const items = [];
    for (const split of splits) for (const it of SETS[split]) {
        const plain = it.text.replace(/\s[|/](?=\s)/g, "");
        items.push({ split, it, plain, probes: it.ents.map(([surface]) => plain.replace(surface, "cái")) });
    }
    const texts = [];
    items.forEach(x => { x.at = texts.length; texts.push([x.plain, x.it.src || ""], ...x.probes.map(p => [p, x.it.src || ""])); });
    const rendered = render(dir, texts);
    const ph = g2p(rendered);
    const res = [];
    let maxTags = 0, artifacts = 0;
    items.forEach(x => {
        const full = words(ph[x.at].ph.join(" "));
        for (const c of ph[x.at].chunks) maxTags = Math.max(maxTags, (c.match(/<en>/g) || []).length);
        if (/gạch ngang|\bdash\b|\bdot\b/.test(ph[x.at].chunks.join(" ")) && !/gạch|dash|dot/i.test(x.plain)) artifacts++;
        x.it.ents.forEach(([surface, kind], k) => {
            const probe = words(ph[x.at + 1 + k].ph.join(" "));
            const r = region(full, probe);
            const fault = judge(kind, surface, r.got, rendered[x.at]);
            res.push({ split: x.split, id: x.it.id, surface, kind, got: r.got.join(" "), fault, sent: rendered[x.at] });
        });
    });
    // consistency: one surface, one reading
    const bySurface = new Map();
    for (const r of res) { if (!bySurface.has(r.surface)) bySurface.set(r.surface, new Set()); bySurface.get(r.surface).add(r.got.replace(/[ˈˌ]/g, "")); }
    const repeated = [...bySurface].filter(([s]) => res.filter(r => r.surface === s).length > 1);
    const inconsistent = repeated.filter(([, v]) => v.size > 1).map(([s]) => s);
    return { label, res, maxTags, artifacts, repeated: repeated.length, inconsistent };
}

function report(e) {
    const kinds = ["en", "letters", "model", "num", "vi", "vletters", "hold"];
    console.log(`\n== ${e.label}`);
    for (const split of splits) {
        const rs = e.res.filter(r => r.split === split);
        const line = kinds.map(k => { const ks = rs.filter(r => r.kind === k); return ks.length ? `${k} ${ks.filter(r => !r.fault).length}/${ks.length}` : null; }).filter(Boolean).join(", ");
        console.log(`${split}: correct ${rs.filter(r => !r.fault).length}/${rs.length} (${line})`);
    }
    console.log(`consistency: ${e.repeated - e.inconsistent.length}/${e.repeated} repeated spans read one way${e.inconsistent.length ? " (not: " + e.inconsistent.join(", ") + ")" : ""}; most <en> tags in one chunk ${e.maxTags}; sentences saying dash/dot/gạch ngang ${e.artifacts}`);
    const faults = e.res.filter(r => r.fault);
    if (detail) for (const r of faults) console.log(`  ✗ ${r.split} ${r.id} ${r.surface} [${r.kind}]: ${r.fault} | ${r.got} | ${r.sent}`);
    if (process.argv.includes("--all")) for (const r of e.res.filter(x => !x.fault)) console.log(`  ✓ ${r.split} ${r.id} ${r.surface} [${r.kind}]: ${r.got}`);
}

const runs = [];
const oldRev = arg("old");
if (oldRev) runs.push(evaluate(moduleDir(oldRev), `old (${oldRev})`));
runs.push(evaluate(REPO, "current"));
runs.forEach(report);
if (arg("json")) fs.writeFileSync(arg("json"), JSON.stringify(runs, null, 1));
