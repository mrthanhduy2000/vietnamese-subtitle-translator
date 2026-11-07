// Offline context policy audit over saved captions, plus explicitly authored topic-switch controls.
// node tools/local-context-eval.js <Chrome cache export> <output JSON> [term export directory]
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const C = require('../context-engine'), BR = require('./batch-review');
const { bgEnv } = require('../tests/bg-env');
const [dump, output, termDump] = process.argv.slice(2);
if (!dump || !output) throw new Error('Expected caption export directory and output JSON');
const root = path.join(__dirname, '..');
const baseline = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const previous = file => execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8' });
const old = { module: { exports: {} } }; vm.createContext(old); vm.runInContext(previous('context-engine.js'), old);
const Old = old.module.exports;
const bg = bgEnv(async () => { throw new Error('offline'); }).sandbox;
const newPrompt = bg.buildUnitPrompt;
const bgSource = previous('background.js');
vm.runInContext(bgSource.slice(bgSource.indexOf('function buildUnitPrompt('), bgSource.indexOf('\nfunction parseUnitJson(')), bg);
const oldPrompt = bg.buildUnitPrompt;
const dirs = fs.readdirSync(path.join(root, 'review-archive'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(root, 'review-archive', d.name));
const files = BR.listVideos([...dirs, dump]);
const stats = { baseline, videos: files.length, units: 0, windows: 0, localDomains: {}, localConfidence: {},
    changedFromGlobal: 0, technicalToGeneral: 0, hintCounts: { before: 0, after: 0 }, inputPromptChars: { before: 0, after: 0 },
    setupMs: { total: 0, max: 0 }, controlled: {}, legacyMemory: { records: 0, entries: 0, agreed: 0 }, inputHashes: {},
    limits: ['Saved source sections have no human domain/sense labels. Changes in natural data are observations, not right catches or false catches.',
        'Controls are authored topic shifts appended to each saved source excerpt; they are not natural errors or a blinded translation evaluation.',
        'Prompts are measured with four saved source groups per window, no learned term history or actual provider call; characters are not billed tokens.',
        'Two attested source/output uses establish usage consistency, not semantic correctness. Domain confidence is keyword evidence, not a calibrated probability.',
        'No cache deletion, forced retranslation, glossary expansion or paid model evaluation is performed.'] };
const controls = [
    ['technology', 'The neural network model trains on a dataset with gradient loss and embedding layers.', 'ml'],
    ['finance', 'The company business model increases revenue and profit through investment, pricing and customer sales.', 'business'],
    ['everyday', 'I run along the river after breakfast and remember my family at home.', 'general']
];
for (const [name] of controls) stats.controlled[name] = { correct: 0, falseAssignments: 0 };
for (const file of files) {
    const bytes = fs.readFileSync(file), data = JSON.parse(bytes);
    stats.inputHashes[path.basename(file)] = crypto.createHash('sha256').update(bytes).digest('hex');
    const units = data.g?.length ? data.g.map(g => (g[3] || []).map(c => c[2]).join(' ')) : (data.cues || []).map(c => c[2]);
    const s = new C.ContextSession({}), before = new Old.ContextSession({});
    const start = performance.now(); s.setUnits(units); const elapsed = performance.now() - start;
    stats.setupMs.total += elapsed; stats.setupMs.max = Math.max(stats.setupMs.max, elapsed);
    before.setUnits(units); stats.units += units.length;
    for (const d of s.localDomains) {
        stats.localDomains[d.primary] = (stats.localDomains[d.primary] || 0) + 1;
        stats.localConfidence[d.confidence] = (stats.localConfidence[d.confidence] || 0) + 1;
        if (d.primary !== before.domain.primary) stats.changedFromGlobal++;
        if (d.primary === 'general' && before.domain.primary !== 'general') stats.technicalToGeneral++;
    }
    for (let i = 0; i < units.length; i += 4) {
        const idxs = Array.from({ length: Math.min(4, units.length - i) }, (_, k) => i + k);
        const a = before.buildRequest(idxs), b = s.buildRequest(idxs);
        stats.windows++;
        stats.hintCounts.before += a.context.senseHints.length; stats.hintCounts.after += b.context.senseHints.length;
        const ap = oldPrompt(a), bp = newPrompt(b);
        stats.inputPromptChars.before += ap.sys.length + ap.user.length;
        stats.inputPromptChars.after += bp.sys.length + bp.user.length;
    }
    const probe = new C.ContextSession({ title: before.domain.primary });
    const prefix = units.slice(0, 3);
    probe.setUnits([...prefix, ...controls.map(c => c[1])]);
    controls.forEach(([name, , expected], k) => stats.controlled[name][probe.localDomains[prefix.length + k].primary === expected ? 'correct' : 'falseAssignments']++);
}
if (termDump && fs.existsSync(termDump)) for (const file of fs.readdirSync(termDump).filter(f => f.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(termDump, file)));
    const list = data.terms || []; stats.legacyMemory.records++; stats.legacyMemory.entries += list.length;
    const s = new C.ContextSession({}); s.importTerms(list); s.setUnits(list.map(t => `The neural dataset model gradient ${t[0]}`));
    stats.legacyMemory.agreed += s.buildRequest(s.units.map((_, i) => i)).context.terms.length;
}
fs.writeFileSync(output, JSON.stringify(stats, null, 2) + '\n');
console.log(JSON.stringify({ ...stats, inputHashes: undefined }, null, 2));
