#!/usr/bin/env node
// Keeps the counts the docs quote true to the repo:
// - docs/MAP.md: the "Lines" column, the "(N files, ~M lines)" source heading, the tests heading and
//   the number of files in `npm test`;
// - docs/TESTING.md: the "~Tests" column (test( / it( calls per file), and every file in `npm test`
//   must have a row there (reported, not written: the row needs a description);
// - CLAUDE.md: file sizes quoted there that drifted by more than 15% (reported, the wording is prose).
// Usage: node tools/doc-sizes.js           rewrite MAP.md and TESTING.md, report the rest
//        node tools/doc-sizes.js --check   change nothing, exit 1 if anything is off
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const check = process.argv.includes("--check");
const lines = f => fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").length - 1;
const exists = f => fs.existsSync(path.join(ROOT, f));

// MAP.md: rows are "| `file` | <lines> | role | export |"
const mapPath = path.join(ROOT, "docs", "MAP.md");
const map = fs.readFileSync(mapPath, "utf8");
const changed = [];
let rows = 0, total = 0;
let next = map.replace(/^\| `([^`]+)` \| (~?)(\d+) \|/gm, (row, file, approx, n) => {
    if (!exists(file)) return row;
    const real = lines(file);
    rows++;
    total += real;
    if (Number(n) === real && !approx) return row;
    changed.push(`${file}: ${approx}${n} -> ${real}`);
    return `| \`${file}\` | ${real} |`;
});
next = next.replace(/^## Source \((\d+) files, ~([\d,]+) lines\)/m, (h, nFiles, nLines) => {
    const want = `## Source (${rows} files, ~${(Math.round(total / 100) * 100).toLocaleString("en-US")} lines)`;
    if (want !== h) changed.push(`heading: ${h.slice(3)} -> ${want.slice(3)}`);
    return want;
});

// MAP.md tests heading and the npm test file count
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const npmFiles = (pkg.scripts.test.match(/tests\/[\w.-]+\.test\.js/g) || []);
const testJs = fs.readdirSync(path.join(ROOT, "tests")).filter(f => f.endsWith(".js"));
const testLines = testJs.reduce((a, f) => a + lines("tests/" + f), 0);
next = next.replace(/^## Tests and tooling \(`tests\/\*\.js`: (\d+) files, ~([\d,]+) lines\)/m, h => {
    const want = `## Tests and tooling (\`tests/*.js\`: ${testJs.length} files, ~${(Math.round(testLines / 100) * 100).toLocaleString("en-US")} lines)`;
    if (want !== h) changed.push(`heading: ${h.slice(3)} -> ${want.slice(3)}`);
    return want;
});
next = next.replace(/Short version: (\d+) files in `npm test`/, (h, n) => {
    if (Number(n) === npmFiles.length) return h;
    changed.push(`npm test files: ${n} -> ${npmFiles.length}`);
    return `Short version: ${npmFiles.length} files in \`npm test\``;
});

// TESTING.md: rows are "| `name.test.js` | <tests> | covers |"
const testingPath = path.join(ROOT, "docs", "TESTING.md");
const testing = fs.readFileSync(testingPath, "utf8");
const countTests = f => (fs.readFileSync(path.join(ROOT, f), "utf8").match(/^\s*(?:test|it)(?:\.skip|\.only|\.todo)?\(/gm) || []).length;
const tChanged = [];
const listed = new Set();
const testingNext = testing.replace(/^\| `([\w.-]+\.test\.js)` \| (\d+) \|/gm, (row, file, n) => {
    listed.add(file);
    if (!exists("tests/" + file)) return row;
    const real = countTests("tests/" + file);
    if (Number(n) === real) return row;
    tChanged.push(`${file}: ${n} -> ${real}`);
    return `| \`${file}\` | ${real} |`;
});
const unlisted = npmFiles.map(f => f.slice(6)).filter(f => !listed.has(f));

// CLAUDE.md quotes sizes as "`file` (1234" in its read protocol: only reported, the wording is prose
const claude = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");
const drift = [];
for (const m of claude.matchAll(/`([\w./-]+\.(?:js|html|css))` \(~?([\d,]+)/g)) {
    const file = m[1], quoted = Number(m[2].replace(/,/g, ""));
    if (!exists(file)) { drift.push(`${file}: quoted ${quoted}, file missing`); continue; }
    const real = lines(file);
    if (Math.abs(real - quoted) / real > 0.15) drift.push(`${file}: quoted ${quoted}, now ${real}`);
}

if (changed.length) console.log(`MAP.md${check ? " is off" : " updated"}:\n  ${changed.join("\n  ")}`);
if (tChanged.length) console.log(`TESTING.md${check ? " is off" : " updated"}:\n  ${tChanged.join("\n  ")}`);
if (unlisted.length) console.log(`TESTING.md has no row for (add one by hand):\n  ${unlisted.join("\n  ")}`);
if (drift.length) console.log(`CLAUDE.md sizes off by more than 15% (edit by hand):\n  ${drift.join("\n  ")}`);
const off = changed.length || tChanged.length || unlisted.length || drift.length;
if (!off) console.log("MAP.md, TESTING.md and CLAUDE.md counts are current.");
if (!check && changed.length) fs.writeFileSync(mapPath, next);
if (!check && tChanged.length) fs.writeFileSync(testingPath, testingNext);
if (check && off) process.exit(1);
