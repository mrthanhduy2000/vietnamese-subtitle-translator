// Compare the current speech engine against a committed engine over all archived/current captions.
// node tools/session-corpus.js <Chrome export directory> <output JSON> [baseline revision]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const BR = require('./batch-review');
const root = path.join(__dirname, '..');
async function main() {
    const [dump, output, revision = 'HEAD'] = process.argv.slice(2);
    if (!dump || !output) throw new Error('Expected Chrome export directory and output JSON');
    const source = execFileSync('git', ['show', `${revision}:dub-engine.js`], { cwd: root, encoding: 'utf8' });
    const baseline = new Module(path.join(root, 'baseline-session-engine.js'), module);
    baseline.filename = path.join(root, 'baseline-session-engine.js');
    baseline.paths = module.paths;
    baseline._compile(source, baseline.filename);
    const archive = path.join(root, 'review-archive');
    const dirs = fs.readdirSync(archive).filter(f => fs.statSync(path.join(archive, f)).isDirectory()).map(f => path.join(archive, f));
    const files = BR.listVideos([...dirs, dump]);
    const metrics = ['spoken', 'dropped', 'wordsLost', 'wordsTwice', 'late', 'gapN', 'gapSum', 'cuts', 'hardStarts', 'serverRuns', 'lagP95', 'lagSum', 'rateJumps'];
    const result = { baseline: execFileSync('git', ['rev-parse', revision], { cwd: root, encoding: 'utf8' }).trim(), latency: 'busy', drain: true,
        videos: files.length, totals: { before: {}, after: {} }, changed: [], inputHashes: {} };
    for (const file of files) {
        const id = path.basename(file);
        result.inputHashes[id] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        const before = await BR.simulate(file, { engine: baseline.exports, latency: 'busy', keepStarted: true });
        const after = await BR.simulate(file, { latency: 'busy', keepStarted: true });
        if (!before || !after) throw new Error(`Empty saved captions: ${id}`);
        for (const row of [before, after]) {
            const lags = row.started.map(x => Math.max(0, x.lag || 0)).sort((a, b) => a - b);
            row.lagP95 = +(lags[Math.max(0, Math.ceil(lags.length * 0.95) - 1)] || 0).toFixed(3);
            row.lagSum = +lags.reduce((a, b) => a + b, 0).toFixed(3);
            row.rateJumps = row.started.slice(1).filter((x, i) => Math.abs(x.rate / row.started[i].rate - 1) > 0.15).length;
        }
        for (const m of metrics) {
            for (const [side, row] of [['before', before], ['after', after]]) result.totals[side][m] = +( (result.totals[side][m] || 0) + (row[m] || 0)).toFixed(3);
            if (before[m] !== after[m]) result.changed.push({ id, metric: m, before: before[m], after: after[m] });
        }
    }
    result.byMetric = Object.fromEntries(metrics.map(metric => [metric, {
        better: result.changed.filter(x => x.metric === metric && x.after < x.before).length,
        worse: result.changed.filter(x => x.metric === metric && x.after > x.before).length
    }]));
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ videos: result.videos, totals: result.totals, changed: result.changed }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
