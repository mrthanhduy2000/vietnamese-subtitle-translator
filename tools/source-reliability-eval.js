// Read-only source structure/provenance scan and controlled corruption checks. No network or ASR calls.
// node tools/source-reliability-eval.js <Chrome dump> <output JSON> [saved ASR fixture directory]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const L = require('../lang-detect');
const BR = require('./batch-review');
const root = path.join(__dirname, '..');
const [dump, output, references] = process.argv.slice(2);
if (!dump || !output) throw new Error('Expected Chrome export directory and output JSON');
const archive = path.join(root, 'review-archive');
const dirs = fs.readdirSync(archive).filter(f => fs.statSync(path.join(archive, f)).isDirectory()).map(f => path.join(archive, f));
const files = BR.listVideos([...dirs, dump]);
const result = { videos: files.length, cues: 0, provenanceUnknown: 0, states: {}, observations: [], inputHashes: {},
    controlled: { timing: { caught: 0, missed: 0 }, density: { caught: 0, missed: 0 }, order: { caught: 0, missed: 0 }, validControls: { cases: 0, falseWarnings: 0 } },
    independentReferences: [], automaticASR: false, freshASRCalls: 0,
    limitations: ['Integrity score is not a probability of matching audible speech. Natural source truth and recall are unannotated.',
        'Old src cache keys name the first choice, not necessarily the actually used fallback. Missing sourceTrack is unknown provenance.',
        'Controlled corruptions use normalized windows with an appended speech sentence, not natural errors or independent blind data.',
        'Independent references reuse prior saved ASR artifacts; this run neither recognizes audio nor establishes ASR accuracy, real-time cost or a full-video verdict.'] };
for (const file of files) {
    const bytes = fs.readFileSync(file), data = JSON.parse(bytes), id = path.basename(file);
    result.inputHashes[id] = crypto.createHash('sha256').update(bytes).digest('hex');
    const rows = (data.cues || []).map(c => ({ start: c[0], end: c[1], text: c[2] }));
    result.cues += rows.length;
    const meta = data.sourceTrack;
    if (!meta) result.provenanceUnknown++;
    const r = L.assessSource(rows, { metaLang: meta?.languageCode || '', asr: meta?.kind === 'asr' });
    result.states[r.status] = (result.states[r.status] || 0) + 1;
    if (r.signals.length) result.observations.push({ video: id, report: r });
    // Keep actual text context but normalize its clock, bound length and add explicit speech.
    const window = Array.from({ length: 20 }, (_, i) => ({ start: i * 4, end: i * 4 + 3,
        text: String(rows[i % Math.max(1, rows.length)]?.text || '').slice(0, 160) + ' The speaker explains this sentence for the source check.' }));
    const options = { metaLang: '', asr: false };
    result.controlled.validControls.cases++;
    if (['suspect', 'unusable'].includes(L.assessSource(window, options).status)) result.controlled.validControls.falseWarnings++;
    const probes = {
        timing: window.map(c => ({ ...c, end: c.start - 1 })),
        density: window.map(c => ({ ...c, end: c.start + 0.01 })),
        order: window.slice().reverse()
    };
    for (const [kind, probe] of Object.entries(probes)) {
        const q = L.assessSource(probe, options);
        if (['suspect', 'unusable'].includes(q.status)) result.controlled[kind].caught++;
        else result.controlled[kind].missed++;
    }
}
if (references && fs.existsSync(references)) {
    for (const file of fs.readdirSync(references).filter(f => f.endsWith('-asr.json')).sort()) {
        const id = file.replace(/-asr\.json$/, ''), fixturePath = path.join(references, id + '-fixture.json');
        if (!fs.existsSync(fixturePath)) continue;
        const asrBytes = fs.readFileSync(path.join(references, file)), fixtureBytes = fs.readFileSync(fixturePath);
        const a = JSON.parse(asrBytes), fixture = JSON.parse(fixtureBytes);
        const cues = fixture.groups.flatMap(g => g.srcCues);
        result.independentReferences.push({ id, model: a.model, sourceHash: crypto.createHash('sha256').update(fixtureBytes).digest('hex'),
            referenceHash: crypto.createHash('sha256').update(asrBytes).digest('hex'),
            comparison: L.compareSources(cues, a.segments, { firstLang: fixture.source.language, secondLang: a.language, independent: true }) });
    }
}
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ videos: result.videos, cues: result.cues, provenanceUnknown: result.provenanceUnknown, states: result.states, controlled: result.controlled, independentReferences: result.independentReferences.map(r => ({ id: r.id, ...r.comparison })) }, null, 2));
