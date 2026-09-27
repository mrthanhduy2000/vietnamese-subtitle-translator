#!/usr/bin/env node
// Keeps the "Lines" column of docs/MAP.md and its "(N files, ~M lines)" heading true to the repo,
// and reports the file sizes CLAUDE.md quotes that have drifted by more than 15%.
// Usage: node tools/doc-sizes.js           rewrite MAP.md, report CLAUDE.md drift
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
if (drift.length) console.log(`CLAUDE.md sizes off by more than 15% (edit by hand):\n  ${drift.join("\n  ")}`);
if (!changed.length && !drift.length) console.log("MAP.md and CLAUDE.md sizes are current.");
if (!check && changed.length) fs.writeFileSync(mapPath, next);
if (check && (changed.length || drift.length)) process.exit(1);
