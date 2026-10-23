#!/usr/bin/env node
// Collects docs/changes/*.md into one version bump: parses the notes, prepends a single entry to
// version-history.js, bumps the version through tools/bump-version.js and deletes the notes.
//   node tools/release-changes.js           -> preview only
//   node tools/release-changes.js --apply   -> write everything
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { next } = require("./bump-version.js");
const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "docs", "changes");

// "# Title" then "- bullet" lines; indented lines continue the previous bullet.
function parseNote(text, name = "note") {
    const lines = text.replace(/\r/g, "").split("\n");
    const head = lines.find(l => l.trim());
    if (!head || !/^#\s+\S/.test(head)) throw new Error(`${name}: first line must be "# <title>"`);
    const ten = head.replace(/^#\s+/, "").trim();
    const y = [];
    for (const l of lines.slice(lines.indexOf(head) + 1)) {
        if (/^\s*-\s+\S/.test(l)) y.push(l.replace(/^\s*-\s+/, "").trim());
        else if (/^\s+\S/.test(l) && y.length) y[y.length - 1] += " " + l.trim();
    }
    // Free-form notes (no "- " bullets): each non-empty body paragraph becomes one item.
    if (!y.length) {
        const body = lines.slice(lines.indexOf(head) + 1).join("\n").split(/\n\s*\n/).map(p => p.replace(/\s+/g, " ").trim()).filter(Boolean);
        y.push(...body);
    }
    if (!y.length) throw new Error(`${name}: no bullets or body text`);
    return { ten, y };
}

function readNotes(dir = DIR) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith(".md") && f.toLowerCase() !== "readme.md").sort()
        .map(f => ({ file: f, ...parseNote(fs.readFileSync(path.join(dir, f), "utf8"), f) }));
}

// One entry for the whole batch: the single title, or the first title plus a count when several.
function buildEntry(notes, version, luc) {
    const ten = notes.length === 1 ? notes[0].ten : `${notes[0].ten} và ${notes.length - 1} cải tiến khác`;
    return { v: version, luc, ten, y: notes.flatMap(n => n.y) };
}

const q = s => JSON.stringify(s);
function renderEntry(e) {
    return `        {\n            v: ${q(e.v)}, luc: ${q(e.luc)}, ten: ${q(e.ten)},\n            y: [\n${e.y.map(s => "                " + q(s)).join(",\n")}\n            ]\n        },\n`;
}

function main() {
    const apply = process.argv.includes("--apply");
    const notes = readNotes();
    if (!notes.length) return console.log("No notes in docs/changes: nothing to release.");
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
    const version = next(manifest.version);
    const d = new Date();
    const luc = [d.getDate(), d.getMonth() + 1, d.getFullYear()].map((n, i) => i === 2 ? n : String(n).padStart(2, "0")).join("/");
    const entry = buildEntry(notes, version, luc);
    console.log(`${notes.length} notes -> v${version}: ${entry.ten}`);
    for (const n of notes) console.log(`  ${n.file} (${n.y.length} bullets)`);
    if (!apply) return console.log("Preview only. Add --apply to write.");
    const hf = path.join(ROOT, "version-history.js");
    const src = fs.readFileSync(hf, "utf8");
    const marker = "const HISTORY = [\n";
    if (!src.includes(marker)) throw new Error("version-history.js: HISTORY marker not found");
    fs.writeFileSync(hf, src.replace(marker, marker + renderEntry(entry)));
    execFileSync(process.execPath, [path.join(__dirname, "bump-version.js"), version], { stdio: "inherit" });
    for (const n of notes) fs.unlinkSync(path.join(DIR, n.file));
    console.log(`Done: v${version}. Run npm test, then commit on release/${version}.`);
    console.log("After the merge, CI tags v" + version + " and attaches the zip (.github/workflows/release.yml). Friends install from the public share repo: tell the user it is stale until `node tools/publish-share.js --stage` then `--promote` is run (docs/MAP.md, Share build).");
}

if (require.main === module) main();
module.exports = { parseNote, readNotes, buildEntry, renderEntry };
