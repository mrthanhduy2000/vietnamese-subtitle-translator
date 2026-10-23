// How the free voice (VieNeu) says the glossary's English names and terms, without audio (manual,
// needs ~/VieNeu-TTS). Every term the glossary keeps in English and dub-speech.js treats as a name
// (glossaryName) goes into a Vietnamese carrier sentence, through the extension's VieNeu text path,
// then through the server's own front end (tools/vieneu-g2p.py). The term's phonemes are the
// difference against the same sentence with "cái" in its place. A term is "read Vietnamese" when a
// phoneme word of it carries a Vietnamese mark (tone digit, t̪ ɗ ɣ ɲ aː ɯ ɤ): spelled with
// Vietnamese letter names, or a word read as a Vietnamese syllable.
//   node tools/glossary-pron.js [--limit=N] [--show=40] [--json=<file>] [--write]
// Numbers are said in Vietnamese on purpose (1.7.8: "Llama ba chấm một"), so numeral words do not count.
// --write: for every term still read Vietnamese, tries other spellings in its place (the whole name
// lower-case inside <en>, capitals as English letters, "&" "+" "." said in English, a Vietnamese
// syllable respelled) and writes the first one the front end reads with no Vietnamese mark into the
// GLOSSARY_SAY block of dub-speech.js. Rerun it after the glossary grows.
// Runs twice: with the glossary bridge (now) and without it (dub-speech.js as it was before 2.6.0,
// the lexicon has only its own entries), and prints both.
const path = require("path"), fs = require("fs"), os = require("os");
const { execFileSync } = require("child_process");
const REPO = path.join(__dirname, "..");
const PY = process.env.VIENEU_PY || path.join(os.homedir(), "VieNeu-TTS", ".venv", "bin", "python");
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };

// ---- render mode (child): texts on stdin, with or without the glossary loaded ----
const render = arg("render", null);
if (render) {
    if (render === "with") { require(path.join(REPO, "glossary.js")); require(path.join(REPO, "glossary-extra.js")); require(path.join(REPO, "glossary-data.js")); }
    const PLAN = require(path.join(REPO, "dub-planner.js"));
    const SPEECH = require(path.join(REPO, "dub-speech.js"));
    const texts = JSON.parse(fs.readFileSync(0, "utf8"));
    // no process.exit here: it cuts a piped write at 64 KB
    process.stdout.write(JSON.stringify(texts.map(t => SPEECH.vieneuText(PLAN.adaptForSpeech(t)))));
    return;
}

require(path.join(REPO, "glossary.js")); require(path.join(REPO, "glossary-extra.js")); require(path.join(REPO, "glossary-data.js"));
const SPEECH = require(path.join(REPO, "dub-speech.js"));
// Web addresses ("Claude.ai", "t3.gg") are said the Vietnamese way on purpose ("chấm ai", 2.5.x
// tests): the audit leaves them out, and the writer never fills them
const WEB = /\.(ai|com|org|net|io|gg|js|txt|dev|app|co|me|tv|ly|xyz|fm|so|us|uk|vn|edu|gov)$/i;
const terms = [];
const moneyShorthand = [];
const seen = new Set();
for (const g of Object.values(globalThis.CST_GLOSSARY_GROUPS)) {
    for (const t of g.terms) {
        const k = t.toLowerCase();
        if (seen.has(k) || (g.vi || {})[k] || !SPEECH.glossaryName(t) || WEB.test(t)) continue;
        // 2.6.4: "4K", "8K" are Vietnamese money too ("8K" = 8 nghìn): not an English reading, counted here.
        // Three digits and more ("401k", a retirement plan) stay English
        if (/^\d{1,2}[km]$/i.test(t)) { moneyShorthand.push(t); continue; }
        seen.add(k);
        terms.push(t);
    }
}
const limit = +arg("limit", 0);
const list = limit ? terms.slice(0, limit) : terms;
const carrier = x => `Hôm qua tôi nhắc đến ${x} trong video.`;
const texts = [carrier("cái")].concat(list.map(carrier));
const run = mode => JSON.parse(execFileSync(process.execPath, [__filename, `--render=${mode}`], { input: JSON.stringify(texts), maxBuffer: 1 << 28 }).toString());
// In batches; a batch the front end fails on is retried one text at a time, and a text it cannot read
// at all comes back empty (counted as not judged)
const g2pOnce = arr => JSON.parse(execFileSync(PY, [path.join(__dirname, "vieneu-g2p.py")], { input: JSON.stringify(arr), maxBuffer: 1 << 28, stdio: ["pipe", "pipe", "ignore"] }).toString());
function g2p(arr) {
    const out = [];
    for (let i = 0; i < arr.length; i += 400) {
        const part = arr.slice(i, i + 400);
        try { out.push(...g2pOnce(part)); }
        catch (e) { for (const t of part) { try { out.push(...g2pOnce([t])); } catch (e2) { out.push({ ph: [], failed: t }); } } }
    }
    return out;
}
const VI_MARK = /[0-9]|t̪|ɗ|ɣ|ɲ|aː|ɯ|ɤ/;
// the phoneme words of Vietnamese numerals and "chấm" / "phẩy", which the voice is meant to say
const NUM_PH = new Set(g2p(["không một hai ba bốn năm sáu bảy tám chín mười mươi mốt lăm tư trăm nghìn triệu tỷ lẻ linh chấm phẩy"])[0].ph.join(" ").split(/\s+/));
// 2.6.2: readings written by hand for names that no spelling search finds: the English way the name is
// said, respelled in English letters ("Labubu" lah-boo-boo). Each is still checked by the front end.
const MANUAL_SAY = {
    // 2.6.4: codes with a slash ("CI/CD") are said as English letters, the slash is not read.
    // Bare "4K" and "8K" are left out on purpose: in Vietnamese they also mean money (8K = 8 nghìn)
    // 2.9.1: hand readings for names VieNeu could not spell from the glossary (model numbers, short names)
    "geforce rtx 2080 ti": ["jee force ar tee ex two zero eight zero tee eye"],
    "geforce rtx 3060 ti": ["jee force ar tee ex three zero six zero tee eye"],
    "geforce rtx 3070 ti": ["jee force ar tee ex three zero seven zero tee eye"],
    "geforce rtx 3080 ti": ["jee force ar tee ex three zero eight zero tee eye"],
    "geforce rtx 3090 ti": ["jee force ar tee ex three zero nine zero tee eye"],
    "geforce rtx 4060 ti": ["jee force ar tee ex four zero six zero tee eye"],
    "geforce rtx 4070 ti": ["jee force ar tee ex four zero seven zero tee eye"],
    "geforce rtx 4070 ti super": ["jee force ar tee ex four zero seven zero tee eye super"],
    "geforce rtx 5060 ti": ["jee force ar tee ex five zero six zero tee eye"],
    "geforce rtx 5070 ti": ["jee force ar tee ex five zero seven zero tee eye"],
    "geforce gtx 1080 ti": ["jee force gee tee ex one zero eight zero tee eye"],
    "asus tuf gaming rtx 5070 ti": ["asus tee you eff gaming ar tee ex five zero seven zero tee eye"],
    "ty cobb": ["tie cobb"],
    "teofimo lopez": ["tee oh fee moe lo pez"],
    "dillian whyte": ["dill ee an white"],
    "sao paulo": ["sow pow loo"],
    "louisiana ragin' cajuns": ["loo ee ann ah rage in cajuns"],
    "terminator 2: judgment day": ["terminator two judgment day"],
    "amazfit bip 5": ["amaz fit beep five"],
    "ci/cd": ["see eye see dee"],
    "ui/ux": ["you eye you ex"],
    "ac/dc": ["ay see dee see"],
    "re/max": ["re max"],
    "re/done": ["re done"],
    "care/of": ["care of"],
    "r/askreddit": ["are ask reddit"],
    "async/await": ["ay sink ah wait"],
    "shadcn/ui": ["shad see en you eye"],
    "fate/grand order": ["fate grand order"],
    "apple tv 4k": ["apple tee vee for kay"],
    "caught in 4k": ["caught in for kay"],
    "kep1er": ["kepler"],
    "hometown cha-cha-cha": ["hometown chah chah chah"],
    "la vache qui rit": ["lah vash kee ree"],
    "masala chai": ["masala chy", "masala shy"],
    "tia-clair toomey": ["tia clair toomey", "tie a clair too me"],
    "thai airasia": ["thai air asia", "tie air asia"],
    "thai airways international": ["tie air ways international", "thai air ways international"],
    "thai airways": ["tie air ways", "thai air ways"],
    "lipoprotein(a)": ["lipo protein a"],
    "terence tao": ["terrence tow", "terence tow"],
    "mane 'n tail": ["mane n tale"],
    "% arabica": ["arabica"],
    "rinnai": ["rin eye", "rin ay"],
    "coco gauff": ["koh koh gawf", "coco gaff"],
    "vinfast lux a2.0": ["vin fast lux a two"],
    "vinfast lux sa2.0": ["vin fast lux s a two", "vin fast lux es a two"],
    "(g)i-dle": ["gee i dle", "g i dle"],
    "aryna sabalenka": ["ar ina sabalenka", "a ryna sa ba lenka"],
    "tinx": ["tinks"],
    "prayut chan-o-cha": ["pray oot chahn o chah"],
    "xabi alonso": ["shabi alonso", "zabi alonso"],
    "koh tao": ["koe tow", "koh tow"],
    "short n' sweet": ["short n sweet"],
    "11:11": ["eleven eleven"],
    "haechan": ["hay shahn", "hae shahn", "hie shahn", "hi shan"],
    "changbin": ["chung bin", "chahng bihn", "chang bean"],
    "langfuse": ["langue fyooz", "lang fyooz", "langue fuse"],
    "k+": ["kay plus", "k plus", "kay"],
    "labubu": ["lah boo boo", "lah bu bu", "luh boo boo"],
    "dabigatran": ["dab ig a trahn", "dab eye gah trahn", "dab ig ah trahn"],
    "laion-5b": ["lion five b", "lie on five b"],
    "veo 3.1": ["veo three point one", "vee oh three point one"],
    "$100m offers": ["one hundred million offers"],
    "stronglifts 5x5": ["strong lifts five by five"],
    "ph.d.": ["p h d", "pee aitch dee"],
    "k-12": ["k twelve", "kay twelve"],
    "comptia security+": ["comp tia security plus"],
    "1.5\u00b0c": ["one point five degrees c", "one point five celsius"],
    "2% bha liquid exfoliant": ["two percent bha liquid exfoliant"],
    "joe & the juice": ["joe and the juice"],
    "11.11": ["eleven eleven"],
    "99% invisible": ["ninety nine percent invisible"],
    "e.t. the extra-terrestrial": ["e t the extra terrestrial"],
    "2001: a space odyssey": ["two thousand one a space odyssey"],
    "the witcher 3: wild hunt": ["the witcher three wild hunt"],
    "2 days & 1 night": ["two days and one night"],
    "e=mc\u00b2": ["e equals m c squared"],
    "e = mc2": ["e equals m c squared"],
    "e=mc2": ["e equals m c squared"],
    "h-1b": ["h one b", "aitch one b"],
    "casio f-91w": ["casio f ninety one w"],
    "f-91w": ["f ninety one w"],
    "t3.gg": ["t three dot g g"],
    "mark tuan": ["mark twan", "mark too an"],
    "laifen": ["lie fen", "lie fehn"],
};
const viWords = span => span.filter(x => VI_MARK.test(x) && !NUM_PH.has(x));
function judge(mode) {
    const rendered = run(mode);
    const ph = g2p(rendered).map(x => x.ph.join(" ").split(/\s+/));
    const base = ph[0];
    const out = [];
    for (let i = 1; i < ph.length; i++) {
        const w = ph[i];
        let a = 0; while (a < w.length && a < base.length && w[a] === base[a]) a++;
        let b = 0; while (b < w.length - a && b < base.length - a && w[w.length - 1 - b] === base[base.length - 1 - b]) b++;
        if (!w.length || w.length === 1 && !w[0]) { out.push({ term: list[i - 1], sent: rendered[i], ph: "", vi: false, failed: true }); continue; }
        const span = w.slice(a, w.length - b);
        out.push({ term: list[i - 1], sent: rendered[i], ph: span.join(" "), vi: viWords(span).length > 0 });
    }
    return out;
}
const before = judge("without"), after = judge("with");
const show = +arg("show", 30);
const count = r => r.filter(x => x.vi).length;
if (moneyShorthand.length) console.log(`money shorthand left as Vietnamese (4K, 8K ...): ${moneyShorthand.length}`);
console.log(`terms ${list.length} | read Vietnamese: without the glossary bridge ${count(before)}, with it ${count(after)}`);
const fixed = after.filter((x, i) => before[i].vi && !x.vi), broke = after.filter((x, i) => !before[i].vi && x.vi);
console.log(`fixed ${fixed.length}, newly Vietnamese ${broke.length}, not read by the front end ${after.filter(x => x.failed).length}`);
for (const x of after.filter(x => x.failed).slice(0, 10)) console.log("  FAIL ", x.term, "|", x.sent);
for (const x of broke.slice(0, show)) console.log("  NEW  ", x.term, "|", x.sent, "|", x.ph);
for (const x of after.filter(x => x.vi).slice(0, show)) console.log("  VI   ", x.term, "|", x.ph);
const j = arg("json", null);
if (j) fs.writeFileSync(j, JSON.stringify({ before, after }, null, 1));

// ---- --write: find a spelling the front end reads the English way ----
if (process.argv.includes("--write")) {
    const SEGM = require(path.join(REPO, "vi-segmenter.js"));
    const isViet = w => SEGM.isVietWord(w.toLowerCase());
    const letters = w => w.toLowerCase().split("").join(" ");
    const piece = w => {
        // one word of the name: capitals as letters, camelCase split, "." "+" "&" in English
        if (w === "&") return "and";
        if (/^[A-Z]$/.test(w.replace(/\.$/, ""))) return letters(w.replace(/\.$/, ""));
        const plus = (w.match(/\+*$/) || [""])[0];
        let core = w.slice(0, w.length - plus.length);
        const parts = core.split(".").filter(Boolean).map(p => {
            const pieces = p.match(/[A-Z]{2,}(?![a-z])|[A-Z]?[a-z]+|[A-Z]|\d+/g) || [p];
            return pieces.map(x => /^[A-Z]{2,}$/.test(x) ? letters(x) : x.toLowerCase()).join(" ");
        });
        return parts.join(" dot ") + (plus ? " plus".repeat(plus.length) : "");
    };
    const V = { a: ["ah", "aa", "ae", "au"], o: ["ah", "aw", "oh", "oa"], i: ["ih", "ee", "y"], e: ["eh", "ea", "ay"], u: ["uh", "oo", "ou"], y: ["ie"] };
    function respells(w) {
        const m = w.toLowerCase().match(/^([^aeiouy]*)([aeiouy]+)([^aeiouy]*)$/);
        if (!m) return [];
        const [, c1, v, c2] = m, out = new Set();
        for (const vv of [v].concat(V[v] || [])) for (const cc of c2 ? [c2, c2 + c2.slice(-1), c2 + "e", c2 + "h"] : ["", "h"]) out.add(c1 + vv + cc);
        out.delete(w.toLowerCase());
        return [...out].filter(x => !isViet(x));
    }
    const bad = after.filter(x => x.vi);
    const jobs = [];
    for (const x of bad) {
        const words = x.term.replace(/([&])/g, " $1 ").split(/\s+/).filter(Boolean).map(w => w.replace(/-/g, " "));
        const cands = new Set();
        const tag = s => `<en>${s.replace(/\s+/g, " ").trim()}</en>`;
        // 2.6.2: the hand readings first; a name with a symbol in it is never kept as its own spelling
        if (!/[()%+=²°'’#.]/.test(x.term)) cands.add(tag(x.term.toLowerCase().replace(/&/g, " and ").replace(/-/g, " ")));
        // 2.6.2: a name cut into two English-looking halves at every point ("Langfuse" -> "lang fuse",
        // "Koh Tao" -> "koh tow"), and the hand-written reading for names no cut gives (MANUAL_SAY)
        const flatLower = x.term.toLowerCase().replace(/[^a-z0-9]/g, "");
        // every word of a plain-letter name cut in two at every point ("coco gauff" -> "coco ga uff")
        if (/^[a-z ]+$/.test(x.term.toLowerCase().trim())) {
            const ws = x.term.toLowerCase().trim().split(/\s+/);
            ws.forEach((w, wi) => { for (let k = 2; k < w.length - 1; k++) cands.add(tag(ws.map((y, j) => j === wi ? y.slice(0, k) + " " + y.slice(k) : y).join(" "))); });
        }
        // 2.6.4: a hand reading goes first, so a spelling the search finds later cannot take its place
        for (const m of MANUAL_SAY[x.term.toLowerCase()] || []) jobs.push([x.term, tag(m)]);
        cands.add(tag(words.map(piece).join(" ")));
        cands.add(tag(words.map(w => /^[A-Z]{2,}$/.test(w) ? letters(w) : piece(w)).join(" ")));
        // letters in English, numbers left outside the tag for the Vietnamese numerals ("HTML5", "MP3")
        cands.add(x.term.split(/(\d+(?:[.,]\d+)?)/).map(seg => /^\d/.test(seg) ? ` ${seg} ` :
            seg.replace(/[()$°]/g, " ").trim() ? tag(seg.replace(/[()$°]/g, " ").split(/\s+/).filter(Boolean).map(w => /^[A-Za-z]{1,5}$/.test(w) && (w === w.toUpperCase() || w.length === 1) ? letters(w) : piece(w)).join(" ")) : "").join("").replace(/\s+/g, " ").trim());
        // a Vietnamese syllable inside the name: respelled (one at a time, first few variants)
        const flat = words.map(piece).join(" ").split(" ");
        flat.forEach((w, k) => {
            if (!isViet(w) || w.length < 2) return;
            for (const r of respells(w).slice(0, 8)) cands.add(tag(flat.map((y, j) => j === k ? r : y).join(" ")));
        });
        for (const c of cands) jobs.push([x.term, c]);
    }
    const res = g2p(jobs.map(([, c]) => carrier(c)));
    const base = g2p([carrier("cái")])[0].ph.join(" ").split(/\s+/);
    const say = {};
    jobs.forEach(([term, c], i) => {
        if (say[term.toLowerCase()]) return;
        const w = res[i].ph.join(" ").split(/\s+/);
        if (!w.length || !w[0]) return;
        let a = 0; while (a < w.length && a < base.length && w[a] === base[a]) a++;
        let b = 0; while (b < w.length - a && b < base.length - a && w[w.length - 1 - b] === base[base.length - 1 - b]) b++;
        const span = w.slice(a, w.length - b);
        if (span.length && !viWords(span).length) say[term.toLowerCase()] = c;
    });
    // what an earlier run found stays, for every term still in the glossary (this run only sees the
    // terms still read Vietnamese, which excludes the ones those spellings already fixed)
    const current = new Set(list.map(t => t.toLowerCase()));
    for (const [k, v] of Object.entries(SPEECH.GLOSSARY_SAY || {})) if (current.has(k) && !say[k]) say[k] = v;
    const keys = Object.keys(say).sort();
    const body = keys.map(k => `        ${JSON.stringify(k)}: ${JSON.stringify(say[k])}`).join(",\n");
    const block = `    // @generated glossary-say begin: tools/glossary-pron.js --write, do not edit by hand
    // ${keys.length} glossary names VieNeu read with Vietnamese sounds as written, and the spelling it reads
    // the English way (checked on its front end, sea_g2p, in a Vietnamese carrier sentence)
    const GLOSSARY_SAY = {${keys.length ? "\n" + body + "\n    " : ""}};
    // @generated glossary-say end`;
    const file = path.join(REPO, "dub-speech.js");
    const src = fs.readFileSync(file, "utf8");
    const re = /    \/\/ @generated glossary-say begin[\s\S]*?\/\/ @generated glossary-say end/;
    if (!re.test(src)) throw new Error("no glossary-say block in dub-speech.js");
    fs.writeFileSync(file, src.replace(re, block));
    console.log(`wrote ${keys.length} spellings; still Vietnamese: ${bad.filter(x => !say[x.term.toLowerCase()]).length}`);
    for (const x of bad.filter(x => !say[x.term.toLowerCase()]).slice(0, show)) console.log("  LEFT ", x.term, "|", x.ph);
}
