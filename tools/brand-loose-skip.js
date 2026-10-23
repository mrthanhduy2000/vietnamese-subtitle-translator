#!/usr/bin/env node
// Builds CST_LOOSE_BRAND_SKIP in glossary.js: the single-word brands with an inner capital ("PaLM",
// "RoPE", "GoT") whose lower-case form is an English word, so content.js keeps matching them
// case-sensitively. Needs a word list (one word a line), e.g. the `word-list` npm package:
//   npm pack word-list && tar xzf word-list-*.tgz && node tools/brand-loose-skip.js package/words.txt --write
// Rerun after a glossary release that adds many names; without --write it prints the list and the diff.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
require("../glossary.js"); require("../glossary-extra.js"); require("../glossary-data.js");

// Not in a word list but everyday in a caption: slang, first names, programming words
const EXTRA = ["lol", "lisa", "goto", "wow", "mom", "got"];

const file = process.argv[2];
if (!file) { console.error("usage: node tools/brand-loose-skip.js <wordlist> [--write]"); process.exit(1); }
const dict = new Set(fs.readFileSync(file, "utf8").split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean));
const terms = new Set();
for (const g of Object.values(globalThis.CST_GLOSSARY_GROUPS)) for (const t of g.terms || []) terms.add(t);
const skip = [...terms]
    .filter(t => /[a-z][A-Z]/.test(t) && !/\s/.test(t))
    .map(t => t.toLowerCase())
    .filter(low => low.length >= 4 && dict.has(low));
const out = [...new Set([...skip, ...EXTRA.filter(w => w.length >= 4)])].sort();
const block = `// BEGIN CST_LOOSE_BRAND_SKIP (tools/brand-loose-skip.js)\nconst LOOSE_BRAND_SKIP = ${JSON.stringify(out)};\n// END CST_LOOSE_BRAND_SKIP`;
console.log(`${out.length} words`);
if (process.argv.includes("--write")) {
    const gp = path.join(ROOT, "glossary.js");
    let s = fs.readFileSync(gp, "utf8");
    const re = /\/\/ BEGIN CST_LOOSE_BRAND_SKIP[\s\S]*?\/\/ END CST_LOOSE_BRAND_SKIP/;
    if (!re.test(s)) { console.error("markers missing in glossary.js"); process.exit(1); }
    fs.writeFileSync(gp, s.replace(re, () => block));
    console.log("glossary.js updated");
} else console.log(out.join(" "));
