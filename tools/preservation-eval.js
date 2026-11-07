// Read-only source/translation discrepancy scan plus injected bilingual challenges on saved context.
// node tools/preservation-eval.js <Chrome export directory> <output JSON>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const Q = require('../vi-quality');
const BR = require('./batch-review');
const challenges = require('../tests/preservation-corpus');
const root = path.join(__dirname, '..');
const [dump, output] = process.argv.slice(2);
if (!dump || !output) throw new Error('Expected Chrome export directory and output JSON');
const baseline = new Module(path.join(root, 'preservation-baseline.js'), module);
baseline.filename = path.join(root, 'preservation-baseline.js');
baseline._compile(execFileSync('git', ['show', 'HEAD:vi-quality.js'], { cwd: root, encoding: 'utf8' }), baseline.filename);
const archive = path.join(root, 'review-archive');
const dirs = fs.readdirSync(archive).filter(f => fs.statSync(path.join(archive, f)).isDirectory()).map(f => path.join(archive, f));
const files = BR.listVideos([...dirs, dump]);
const result = { baseline: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), videos: files.length,
    groups: 0, originalRefineFlags: 0, currentRefineFlags: 0, naturalDiscrepancies: [], mutations: {}, inputHashes: {},
    limitations: ['Natural discrepancies compare supplied captions, not original speech. No claim that the source is correct or that the translation must copy it.',
        'Natural recall is unknown: the entire corpus has not been semantically annotated.',
        'Injected corruptions are eighteen authored templates grafted onto real saved context; they are not newly found translation errors or independent unseen examples.'] };
for (const file of files) {
    const bytes = fs.readFileSync(file), id = path.basename(file), data = JSON.parse(bytes);
    result.inputHashes[id] = crypto.createHash('sha256').update(bytes).digest('hex');
    let context = null;
    for (const [item, group] of data.g.entries()) {
        const src = (group[3] || []).map(c => c[2]).join(' '), vi = group[2];
        result.groups++;
        if (baseline.exports.assess(src, vi).needsRefine) result.originalRefineFlags++;
        if (Q.assess(src, vi).needsRefine) result.currentRefineFlags++;
        const p = Q.assessPreservation(src, vi);
        if (p.issues.length) result.naturalDiscrepancies.push({ video: id, item, src, vi, issues: p.issues });
        if (!context && src && vi && !p.source.length && !p.target.length && src.length < 400 && vi.length < 400) context = { src, vi };
    }
    if (!context) {
        for (const group of data.g) {
            const src = (group[3] || []).map(c => c[2]).join(' ').split(/[-−]?\d/)[0];
            const vi = String(group[2] || '').split(/[-−]?\d/)[0];
            if (src.length >= 16 && vi.length >= 16 && !Q.assessPreservation(src, vi).issues.length) { context = { src, vi }; break; }
        }
    }
    for (const c of challenges) {
        const row = result.mutations[c.kind] || (result.mutations[c.kind] = { videos: 0, caught: 0, missed: 0, falseFlags: 0, unavailable: [] });
        if (!context) { row.unavailable.push(id); continue; }
        row.videos++;
        const src = context.src + ' ' + c.src;
        const good = context.vi + ' ' + c.good, bad = context.vi + ' ' + c.bad;
        if (Q.assessPreservation(src, bad).issues.length) row.caught++; else row.missed++;
        if (Q.assessPreservation(src, good).issues.length) row.falseFlags++;
    }
}
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ videos: result.videos, groups: result.groups, oldRefineFlags: result.originalRefineFlags,
    currentRefineFlags: result.currentRefineFlags, naturalDiscrepancies: result.naturalDiscrepancies.length, mutations: result.mutations }, null, 2));
