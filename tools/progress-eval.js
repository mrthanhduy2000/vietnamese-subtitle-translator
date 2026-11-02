#!/usr/bin/env node
// Offline fault injection and checkpoint round trips over saved videos. No Chrome writes or API.
// node tools/progress-eval.js /path/to/dump [other/archive/folders]
const fs = require('node:fs');
const vm = require('node:vm');
const { pageEnv } = require('../tests/progress-env');
const { bgEnv } = require('../tests/bg-env');
const { listVideos } = require('./batch-review');
const E = pageEnv({ youtube: true });
const B = bgEnv(() => { throw new Error('Evaluation must remain offline'); });
const plain = x => JSON.parse(JSON.stringify(x));
const reply = t => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ t }) }] }, finishReason: 'STOP' }] });
const decode = (sentences, translations) => {
    B.sandbox.__req = { sentences };
    B.sandbox.__data = reply(translations);
    try { return { answer: vm.runInContext('readUnitAnswer(__data, __req, [])', B.sandbox) }; }
    catch (error) { return { error }; }
};
(async () => {
    const files = listVideos(process.argv.slice(2));
    if (!files.length) throw new Error('No saved videos found');
    const stats = { videos: files.length, groups: 0, windows: 0, blankInjections: 0, preservedPartialAnswers: 0,
        localEmptyHandling: 0, existingInvalidWindows: 0, lostGoodItems: 0, progressRoundTrips: 0, restoredGroups: 0,
        progressMismatches: 0, wrongTrackAccepted: 0, changedSourceAccepted: 0 };
    await new Promise(r => setImmediate(r));
    for (const file of files) {
        const data = JSON.parse(fs.readFileSync(file));
        const groups = (data.g || []).map(g => ({ start: g[0], end: g[1], text: g[3].map(c => c[2]).join(' ') }));
        const translations = (data.g || []).map(g => g[2] || '');
        stats.groups += groups.length;
        for (let start = 0; start < groups.length; start += 8) {
            const sources = groups.slice(start, start + 8).map(g => g.text);
            const target = translations.slice(start, start + 8);
            const baseline = decode(sources, target);
            stats.windows++;
            if (!baseline.answer) { stats.existingInvalidWindows++; continue; }
            for (let i = 0; i < target.length; i++) {
                const altered = target.slice(); altered[i] = '';
                const r = decode(sources, altered);
                stats.blankInjections++;
                if (r.error?.partialTranslations) {
                    stats.preservedPartialAnswers++;
                    for (let j = 0; j < target.length; j++) {
                        if (j !== i && r.error.partialTranslations[j] !== baseline.answer.translations[j]) stats.lostGoodItems++;
                    }
                } else if (r.answer) stats.localEmptyHandling++;
                else stats.lostGoodItems++;
            }
        }
        if (!groups.length) continue;
        const initial = translations.map((v, i) => i % 2 === 0 ? v : '');
        E.sandbox.__groups = groups; E.sandbox.__vi = initial;
        const key = 'cstprogress1_eval';
        await E.run('removeVideoProgress("cstprogress1_eval")');
        const saved = await E.run('saveVideoProgress("cstprogress1_eval", __groups, __vi, "track")');
        if (!saved) throw new Error('Checkpoint rejected within expected bounds: ' + file);
        const restored = plain(await E.run('readVideoProgress("cstprogress1_eval", __groups, "track")'));
        stats.progressRoundTrips++;
        stats.restoredGroups += restored.filter(Boolean).length;
        if (JSON.stringify(restored) !== JSON.stringify(initial)) stats.progressMismatches++;
        if (await E.run('readVideoProgress("cstprogress1_eval", __groups, "other-track")')) stats.wrongTrackAccepted++;
        E.sandbox.__groups = groups.map((g, i) => i === 0 ? { ...g, text: g.text + ' changed' } : g);
        if (await E.run('readVideoProgress("cstprogress1_eval", __groups, "track")')) stats.changedSourceAccepted++;
    }
    console.log(JSON.stringify(stats, null, 2));
    process.exitCode = stats.lostGoodItems || stats.progressMismatches || stats.wrongTrackAccepted || stats.changedSourceAccepted ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
