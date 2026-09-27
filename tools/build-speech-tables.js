// Build the two data tables of dub-speech.js from the VieNeu server's own front end (offline, never at
// run time). Rewrites the block between "@generated speech-tables" markers in dub-speech.js.
//
//   1. CAPS: how the server reads every all-caps code of 2 to 4 letters, in a Vietnamese carrier
//      sentence: already English ("<en>a p i</en>"), expanded to Vietnamese words ("CLB" câu lạc bộ,
//      "TP" thành phố), or read as a word ("RAM", "NASA"). Anything else it spells with Vietnamese
//      letter names ("CPC" xê phê xê): that is the only class dub-speech.js changes.
//   2. RESPELL: English names that are also Vietnamese syllables ("Tom", "Dan"). Target = the
//      server's English reading of the possessive ("tom's" is not a Vietnamese syllable, so its English
//      engine reads it) minus the s; a spelling is kept only when the server reads it, alone, inside
//      <en> in a Vietnamese sentence, exactly as that target.
//
// Usage: node tools/build-speech-tables.js [--dry]    (needs ~/VieNeu-TTS, or VIENEU_DIR)
"use strict";
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const REPO = path.join(__dirname, "..");
const SEG = require(path.join(REPO, "vi-segmenter.js"));
const VIENEU = process.env.VIENEU_DIR || path.join(require("os").homedir(), "VieNeu-TTS");
const PY = path.join(VIENEU, ".venv/bin/python");
const front = input => JSON.parse(execFileSync(PY, [path.join(REPO, "tools/vieneu-g2p.py")],
    { input: JSON.stringify(input), maxBuffer: 1 << 30, env: { ...process.env, VIENEU_DIR: VIENEU } }).toString());

// ---- 1. all-caps codes ----
const LET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const codes = [...LET];
for (const a of LET) for (const b of LET) { codes.push(a + b); for (const c of LET) { codes.push(a + b + c); for (const d of LET) codes.push(a + b + c + d); } }
const said = front({ normalize: codes.map(x => `tôi thấy ${x} ở đây`) }).map(s => s.replace(/^tôi thấy /, "").replace(/ ở đây$/, ""));
const read = {};
codes.forEach((k, i) => { read[k] = said[i]; });
const classes = { en: [], vi: [], word: [] };
let spelled = 0;
for (const k of codes) {
    if (k.length < 2) continue;
    const s = read[k];
    if (s.includes("<en>")) classes.en.push(k);
    else if (s === k.split("").map(c => read[c]).join(" ")) spelled++;
    else if (s === k.toLowerCase()) classes.word.push(k);
    else classes.vi.push(k);
}

// ---- 2. respellings ----
// Common English given names, surnames and place words; a name is a candidate only if it is also a
// Vietnamese syllable. A name in a split still to be scored can be held out here so that split measures
// the fallback; "sam" was held out for the 1.7.8 unseen split, released in 1.8.0 (tests/blind-corpus.js,
// written by a separate agent, is the unseen split now and does not steer this list).
const UNSEEN_HOLDOUT = new Set([]);
const NAMES = `tom tim sam kim dan ben don ron jon ann anne lin lee van long san la le de del da di do du bo mo lo co ho
hang man con bin tan min nan lan hon ton son bon mon phan chan an in on can to me go so no be he we ma pa na ca ta
mia leo max ray roy guy kay may mae sue lou joe jo cody toby tony cole dale gale hale kyle lyle nick rick mick vic
pam nina tina lena dana gina kate dave steve pete mike luke jake nate adam ethan mason logan noah liam lucas owen
evan ian alan allan bill will phil neil paul saul carl earl hal cal mel nell bell dell tess bess jess chris ross
moss vance lance chance grant hunt hart burt kurt curt glen ken len hanks cruise diego francisco jose antonio
monica barbara santa mesa vegas angeles beach bay lake hill king queen prince duke marco polo nemo bond bourne
holmes watson`.split(/\s+/).filter(w => w && !UNSEEN_HOLDOUT.has(w));
// Spellings found by hand where the search below finds none; verified the same way. "ben" has no
// English-only phoneme (bɛn), so it is kept when the voice says it differently from the plain word in a
// Vietnamese sentence (there "bˈen"; inside <en> "ben" becomes "bɛnz")
const MANUAL = { san: "sanne", la: "lah", kim: "kym", ben: "benn" };
const cands = [...new Set(NAMES)].filter(w => SEG.isVietWord(w));
const bare = p => p.replace(/[ˈˌ.]/g, "");
const EN_RE = /æ|ɑ|ɪ|ʊ|ʌ|ɚ|ɝ|ɜ|ɹ|θ|ð|ʒ|ᵻ|ɐ|eɪ|aɪ|oʊ|aʊ|ɔɪ|iː|uː|ɔː|ɡ|(?<!t)ʃ|dʒ/;
const targets = {};
front({ words: cands.map(w => w + "'s") }).forEach((p, i) => {
    const t = bare(p).replace(/(z|s)$/, "");
    if (EN_RE.test(t)) targets[cands[i]] = t;
});
function variants(w) {
    const out = new Set();
    const V = { a: ["a", "ah", "aa", "ae", "au"], o: ["o", "ah", "aw", "oh", "au", "oa"], i: ["i", "ih", "ee", "y"], e: ["e", "eh", "ea", "ay"], u: ["u", "uh", "oo", "ou"], y: ["y", "ie"] };
    const m = w.match(/^([^aeiouy]*)([aeiouy]+)([^aeiouy]*)$/);
    if (!m) return [];
    const [, c1, v, c2] = m;
    const vs = v.length === 1 && V[v] ? V[v] : [v];
    const c2s = c2 ? [c2, c2 + c2.slice(-1), c2 + "e", c2 + "h", c2 + c2.slice(-1) + "e"] : ["", "h", "e"];   // "kenne"
    const c1s = c1 ? [c1, c1 + "h", c1 + c1.slice(-1)] : [""];   // "lleo"
    for (const a of c1s) for (const b of vs) for (const c of c2s) out.add(a + b + c);
    out.delete(w);
    return [...out].filter(x => !SEG.isVietWord(x));
}
const jobs = [];
for (const w of Object.keys(targets)) for (const v of variants(w)) jobs.push([w, v]);
const carrier = v => `Tôi gặp <en>${v}</en> hôm qua.`;
const got = front(jobs.map(([, v]) => carrier(v)));
const respell = {};
jobs.forEach(([w, v], i) => {
    const words = got[i].ph.join(" ").split(/\s+/);
    if (words.length !== 5 || bare(words[2]) !== targets[w]) return;        // one word, the English reading
    if (!respell[w] || v.length < respell[w].length) respell[w] = v;
});
// manual entries: checked to be one English word each
const manual = front(Object.values(MANUAL).map(carrier));
const plain = front(Object.keys(MANUAL).map(w => `Tôi gặp ${w} hôm qua.`));
Object.keys(MANUAL).forEach((w, i) => {
    const words = manual[i].ph.join(" ").split(/\s+/), vi = plain[i].ph.join(" ").split(/\s+/);
    if (words.length === 5 && (EN_RE.test(words[2]) || bare(words[2]) !== bare(vi[2] || "")) && !respell[w]) respell[w] = MANUAL[w];
});

// ---- write ----
const G2P_VERSION = execFileSync(PY, ["-c", "import importlib.metadata as m; print(m.version('sea_g2p'))"]).toString().trim();
const wrap = (list, width = 100) => {
    const lines = [];
    let line = "";
    for (const w of list) {
        if (line && line.length + w.length + 1 > width) { lines.push(line); line = ""; }
        line += (line ? " " : "") + w;
    }
    if (line) lines.push(line);
    return lines.map(l => `        "${l} "`).join(" +\n").replace(/ "$/, "\"");
};
const rs = Object.keys(respell).sort().map(k => `${k}: "${respell[k]}"`);
const respellLines = list => {
    const lines = [];
    let line = [];
    for (const e of list) {
        if (line.length && (line.join(", ").length + e.length + 2) > 100) { lines.push(line); line = []; }
        line.push(e);
    }
    if (line.length) lines.push(line);
    return lines.map((l, i) => `        ${l.join(", ")}${i < lines.length - 1 ? "," : ""}`).join("\n");
};
const block = `    // @generated speech-tables begin: tools/build-speech-tables.js, do not edit by hand
    // How VieNeu (sea_g2p ${G2P_VERSION}) reads each all-caps code of 2-4 letters, in a Vietnamese sentence.
    // Already English: left as is. Expanded to Vietnamese words ("CLB" câu lạc bộ): left as is. Read as a
    // word ("RAM", "NASA"): left as is. Every other code it spells with Vietnamese letter names.
    const CAPS_EN = new Set((
${wrap(classes.en.sort())}).split(" "));
    const CAPS_VI = new Set((
${wrap(classes.vi.sort())}).split(" "));
    const CAPS_WORD = new Set((
${wrap(classes.word.sort())}).split(" "));
    // Vietnamese-syllable spellings of English name words -> a spelling VieNeu's English engine reads the
    // English way ("tom" -> tˈɑːm). Used only inside an English span ("Tom Hanks", "San Francisco").
    const RESPELL = {
${respellLines(rs)}
    };
    // @generated speech-tables end`;
const file = path.join(REPO, "dub-speech.js");
const src = fs.readFileSync(file, "utf8");
const re = /    \/\/ @generated speech-tables begin[\s\S]*?\/\/ @generated speech-tables end/;
console.log(`caps: ${classes.en.length} English, ${classes.vi.length} Vietnamese expansions, ${classes.word.length} words, ${spelled} spelled with Vietnamese letter names`);
console.log(`respell: ${Object.keys(respell).length} of ${Object.keys(targets).length} (missing: ${Object.keys(targets).filter(w => !respell[w]).join(" ")})`);
if (process.argv.includes("--dry")) { console.log(block); process.exit(0); }
if (!re.test(src)) { console.error("markers not found in dub-speech.js"); process.exit(1); }
fs.writeFileSync(file, src.replace(re, block));
console.log("dub-speech.js updated");
