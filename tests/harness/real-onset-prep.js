// Prepare speech from saved real-video translations next to exact source-audio clips.
// Usage: node tests/harness/real-onset-prep.js <cache-dump-directory> [voice]
// Source files are *-source.json plus *-original.wav in ignored smooth/real-video/.
const fs = require('node:fs');
const path = require('node:path');
const { bgEnv } = require('../bg-env');
const E = require('../../dub-engine');
const { realGroups } = require('../../tools/playback-sim');
const out = path.join(__dirname, 'smooth', 'real-video');
const dump = process.argv[2], voice = process.argv[3] || 'Kim Thanh';
if (!dump) throw new Error('A real saved-video dump directory is required');
const B = bgEnv((url, init) => {
    if (!String(url).startsWith('http://127.0.0.1:8000/')) throw new Error('Only local speech is allowed');
    return fetch(url, init);
}, { dubProvider: 'vieneu' }, { paidTts: false });
(async () => {
    const fixtures = [];
    for (const name of fs.readdirSync(out).filter(x => x.endsWith('-source.json')).sort()) {
        const source = JSON.parse(fs.readFileSync(path.join(out, name)));
        const cacheFile = path.join(dump, 'ytcache4_' + source.id + '.json');
        const original = require('../../dub-audio').decodeWav(new Uint8Array(fs.readFileSync(path.join(out, source.id + '-original.wav'))));
        const duration = original.samples.length / original.sampleRate;
        if (Math.abs(duration - (source.end - source.start)) > 0.02) throw new Error('Source clip is not sample-exact: ' + source.id);
        const shift = c => ({ ...c, start: c.start - source.start, end: c.end - source.start });
        const groups = realGroups(cacheFile).filter(g => g.start >= source.start && g.end <= source.end)
            .map(g => ({ ...shift(g), srcCues: g.srcCues.map(shift), viCues: g.viCues.map(shift) }));
        if (!groups.length) throw new Error('No complete source groups in clip: ' + source.id);
        const provider = E.createVieneuProvider({ sendMessage: m => B.send(m) }, { localVoice: voice });
        const video = { currentTime: 0, paused: true, playbackRate: 1, addEventListener() {}, removeEventListener() {} };
        const engine = new E.DubEngine({ video, getGroups: () => groups, providers: { primary: provider }, now: () => 0, setInterval: () => 0, clearInterval() {} }, { secondVoice: false });
        engine.headAt = 0; engine.refresh(true);
        const plans = [];
        for (const p of engine.plans) {
            p.tightPauses = engine.denseRatio(p) > E.SYNC.denseRatio;
            p.slackPauses = p.tightPauses ? 0 : engine.looseSlack(p);
            const file = source.id + '-' + p.id + '.wav';
            const recPath = path.join(out, file + '.json');
            let take;
            if (fs.existsSync(recPath)) {
                const previous = JSON.parse(fs.readFileSync(recPath));
                if (previous.key === await provider.audioKey(p) && previous.voice === voice) take = previous;
            }
            if (!take) {
                const [r] = await provider.render([p]);
                fs.writeFileSync(path.join(out, file), r.wav);
                take = { key: await provider.audioKey(p), voice, duration: r.duration, timing: r.timing };
                fs.writeFileSync(recPath, JSON.stringify(take));
            }
            plans.push({ id: p.id, start: p.start, end: p.end, text: p.text, file, ...take });
            console.log(source.id, p.id, take.duration.toFixed(2), JSON.stringify(take.timing));
        }
        const fixture = { source, voice, duration, groups, plans };
        fs.writeFileSync(path.join(out, source.id + '-fixture.json'), JSON.stringify(fixture, null, 2));
        fixtures.push({ id: source.id, title: source.title, start: source.start, end: source.end, voice, plans: plans.length });
    }
    fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(fixtures, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
