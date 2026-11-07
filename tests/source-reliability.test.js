const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const L = require('../lang-detect');
const text = 'The researchers explain how the new process works and why people can use the results to improve their work.';
const cues = (n = 30) => Array.from({ length: n }, (_, i) => ({ start: i * 3, end: i * 3 + 2, text: `${text} Section ${i}.` }));
const report = (rows, extra = {}) => L.assessSource(rows, { metaLang: 'en', asr: true, ...extra });

test('healthy structure never certifies that text matches audible speech', () => {
    const r = report(cues()); assert.equal(r.status, 'unverified'); assert.equal(r.audioVerified, false);
    assert.equal(r.integrityScore, 100); assert.equal(r.independentCheck, 'not-run');
});
test('empty sources and widespread invalid speech timing are structurally unusable', () => {
    assert.equal(report([]).status, 'unusable');
    const bad = cues().map(c => ({ ...c, end: c.start - 1 }));
    assert.equal(report(bad).status, 'unusable'); assert.equal(report(bad).metrics.invalidTiming, bad.length);
});
test('overlapping cues and word timestamps are not treated as corruption', () => {
    assert.equal(report(cues().map(c => ({ ...c, end: c.start + 4 }))).status, 'unverified');
    const words = Array.from({ length: 60 }, (_, i) => ({ start: i * 0.2, end: i * 0.2 + 0.2, text: 'word' }));
    assert.equal(report(words).status, 'unverified'); assert.equal(report(words).metrics.fragmentationRatio, 1);
});
test('zero-duration sound-note events do not poison speech timing', () => {
    const notes = [1, 2, 3].map(start => ({ start, end: start, text: '[Music]' }));
    assert.equal(report([...notes, ...cues()]).metrics.invalidTiming, 0);
    assert.notEqual(report([...notes, ...cues()]).status, 'unusable');
});
test('sparse or music-only sources remain limited rather than asserted to be wrong', () => {
    const r = report([{ start: 0, end: 300, text: '[Music]' }], { duration: 300 });
    assert.equal(r.status, 'limited'); assert.equal(r.audioVerified, false);
});
test('a repeated chorus can generate a repetition observation without a failure verdict', () => {
    const r = report(cues().map(c => ({ ...c, text })));
    assert.ok(r.signals.some(s => s.code === 'repeat-loop'));
    assert.equal(r.status, 'unverified');
});
test('impossible text density is a review signal rather than proof of incorrect words', () => {
    const r = report(cues().map(c => ({ ...c, end: c.start + 0.1 })));
    assert.equal(r.status, 'suspect'); assert.ok(r.signals.some(s => s.code === 'dense-timing'));
    assert.equal(r.audioVerified, false);
});
test('wrong-script ASR evidence is distinguished from an authored translated track', () => {
    assert.equal(report(cues(), { metaLang: 'ko' }).status, 'suspect');
    assert.notEqual(report(cues(), { metaLang: 'ko', asr: false }).status, 'unusable');
});
test('shared writing systems do not falsely assert Russian or Arabic language identity', () => {
    const ru = cues().map(c => ({ ...c, text: 'Привіт усім я дуже рада що ви дивитесь мій канал і бажаю вам доброго дня.' }));
    assert.equal(report(ru, { metaLang: 'uk' }).signals.some(s => s.code === 'language-label'), false);
    const fa = cues().map(c => ({ ...c, text: 'من امروز خانه را تمیز می‌کنم و این غذا را برای خانواده آماده می‌کنم.' }));
    assert.equal(report(fa, { metaLang: 'fa' }).signals.some(s => s.code === 'language-label'), false);
});
test('unknown provenance cannot become a wrong-script claim based on an old cache key', () => {
    assert.equal(report(cues(), { metaLang: '', asr: false }).status, 'unverified');
});
test('live infinite duration uses available caption extent rather than infinite silence', () => {
    assert.notEqual(report(cues(), { duration: Infinity }).status, 'limited');
});
test('same-language temporally overlapping evidence can corroborate without certifying audio', () => {
    const r = L.compareSources(cues(), cues(), { firstLang: 'en-US', secondLang: 'en', independent: true });
    assert.equal(r.status, 'corroborated'); assert.equal(r.agreement, 1); assert.equal(r.audioVerified, false);
});
test('independent text disagreement does not decide which transcript is correct', () => {
    const a = [{ start: 0, end: 20, text: 'volcano basalt mineral tectonic geology magma sediment erosion mountain crystalline seismic terrain stratigraphy'.repeat(2) }];
    const b = [{ start: 0, end: 20, text: 'keyboard software compiler database internet ethernet algorithm repository debugger server protocol terminal framework'.repeat(2) }];
    const r = L.compareSources(a, b, { firstLang: 'en', secondLang: 'en', independent: true });
    assert.equal(r.status, 'conflict'); assert.equal(r.audioVerified, false);
});
test('different languages, short samples and disjoint time windows remain unknown', () => {
    assert.equal(L.compareSources(cues(), cues(), { firstLang: 'en', secondLang: 'fr' }).status, 'unknown');
    assert.equal(L.compareSources([{ start: 0, end: 2, text: 'Hello' }], [{ start: 0, end: 2, text: 'Hello' }], { firstLang: 'en', secondLang: 'en' }).status, 'unknown');
    assert.equal(L.compareSources(cues(), cues().map(c => ({ ...c, start: c.start + 500, end: c.end + 500 })), { firstLang: 'en', secondLang: 'en' }).status, 'unknown');
});
test('matching vocabulary alone cannot approve a track that omits most repetitions', () => {
    const r = L.compareSources([{ start: 0, end: 90, text: text.repeat(20) }], [{ start: 0, end: 90, text }], { firstLang: 'en', secondLang: 'en' });
    assert.notEqual(r.status, 'corroborated');
});
test('soft warnings cannot replace a track without positive comparable evidence', () => {
    const a = report(cues().map(c => ({ ...c, end: c.start + 0.1 }))), b = report(cues());
    assert.equal(L.preferSource(a, b), false);
    assert.equal(L.preferSource(a, b, { sameLanguage: true, comparison: { status: 'corroborated' } }), true);
    assert.equal(L.preferSource(b, a, { sameLanguage: true, comparison: { status: 'corroborated' } }), false);
});
const ytSource = fs.readFileSync(require('node:path').join(__dirname, '../youtube.js'), 'utf8');
function findTrack() {
    const code = ytSource.slice(ytSource.indexOf('function ytChonTrack('), ytSource.indexOf('// ---------- Tai va doc ban chep loi'));
    return new Function('window', code + ';return ytFindUsableTrack;')({ CST_LANG: L });
}
test('YouTube checks a same-language alternate and keeps the primary on conflict', async () => {
    const first = { languageCode: 'en', kind: '' }, alt = { languageCode: 'en', kind: 'asr' }, reviews = [];
    const r = await findTrack()(first, cues(), [first, alt], { broken: () => false, stale: () => false, load: async () => cues().map(c => ({ ...c, text: 'volcano tectonic basalt magma seismic geology mineral'.repeat(3) })), onReview: x => reviews.push(x) });
    assert.equal(r, null); assert.equal(reviews.length, 1); assert.equal(reviews[0].comparison.status, 'conflict');
});
test('YouTube rejects invalid timed alternates and selects a structurally usable source', async () => {
    const first = { languageCode: 'en', kind: 'asr' }, bad = { languageCode: 'en', kind: '' }, good = { languageCode: 'en', kind: 'asr' };
    const invalid = cues().map(c => ({ ...c, end: -1 }));
    const r = await findTrack()(first, invalid, [first, bad, good], { broken: () => false, stale: () => false, load: async t => t === bad ? invalid : cues() });
    assert.equal(r.track, good); assert.equal(r.quality.status, 'unverified');
});
test('track loading is bounded and stale navigation cannot switch a source', async () => {
    const first = { languageCode: 'en', kind: 'asr' }, alternatives = Array.from({ length: 8 }, () => ({ languageCode: 'en', kind: '' }));
    let requests = 0;
    await findTrack()(first, [], [first, ...alternatives], { broken: () => false, stale: () => false, load: async () => { requests++; return []; } });
    assert.ok(requests <= 4);
    const r = await findTrack()(first, [], [first, alternatives[0]], { broken: () => false, stale: () => true, load: async () => cues() });
    assert.equal(r, null);
});
test('generic pages select the best already-loaded structural source without extra fetching', () => {
    const source = fs.readFileSync(require('node:path').join(__dirname, '../content.js'), 'utf8');
    const code = source.slice(source.indexOf('function pickBestTrack('), source.indexOf('// The site\'s own Vietnamese track'));
    const a = { srclang: 'en', track: { cues: cues().map(c => ({ ...c, end: -1 })) } }, b = { srclang: 'en', track: { cues: cues() } };
    const r = new Function('window', 'pageTracks', 'state', code + ';return pickBestTrack();')({ CST_LANG: L }, () => [a, b], { skipSameLang: false });
    assert.equal(r.track, b);
});
test('cache records keep first-choice identity separate from actual source provenance', async () => {
    const code = ytSource.slice(ytSource.indexOf('async function ytGhiCache('), ytSource.indexOf('// (2.7.3) A video not saved'));
    for (const known of [true, false]) {
        let saved;
        const yt = { srcTrack: 'ko|asr|2', trackInfo: { languageCode: 'en', kind: '', provenanceKnown: known }, groups: [], cues: cues(1), viCues: [{ start: 0, end: 2, lines: ['Dòng dịch'] }] };
        const write = new Function('yt', 'chrome', 'YT_CACHE_PREFIX', 'removeVideoProgress', 'VIDEO_PROGRESS_PREFIX', 'ytStoredVideos', code + ';return ytGhiCache;')(yt, { storage: { local: { set: async data => { saved = data; } } } }, 'cache_', () => {}, 'progress_', new Set(['id']));
        await write('id');
        assert.equal(saved.cache_id.src, 'ko|asr|2');
        assert.equal(saved.cache_id.sourceTrack?.languageCode || null, known ? 'en' : null);
    }
});
test('a corrupt alternate cannot downgrade a structurally healthy primary via cross-track conflict', async () => {
    const first = { languageCode: 'en', kind: '' }, alt = { languageCode: 'en', kind: 'asr' }, reviews = [];
    const r = await findTrack()(first, cues(), [first, alt], { broken: () => true, stale: () => false,
        load: async () => cues().map(c => ({ ...c, end: -1 })), onReview: x => reviews.push(x) });
    // The injected broken predicate would judge ASR only; the primary is authored and healthy.
    assert.equal(r, null); assert.equal(reviews.length, 0);
});
test('music symbols without duration are not invalid spoken timestamps', () => {
    const symbols = Array.from({ length: 20 }, (_, i) => ({ start: i, end: i, text: '♪' }));
    assert.equal(report(symbols).metrics.invalidTiming, 0);
    assert.notEqual(report(symbols).status, 'unusable');
});
test('a broad caption cue and a short reference cannot establish text conflict', () => {
    const broad = [{ start: 0, end: 600, text: text.repeat(100) }];
    const short = [{ start: 20, end: 40, text: 'volcano basalt mineral tectonic geology magma sediment erosion mountain crystalline seismic terrain stratigraphy' }];
    assert.equal(L.compareSources(broad, short, { firstLang: 'en', secondLang: 'en', independent: true }).status, 'unknown');
});
test('a healthy primary is not held by an alternate that never returns', async () => {
    const first = { languageCode: 'en', kind: '' }, alt = { languageCode: 'en', kind: 'asr' };
    const r = await findTrack()(first, cues(), [first, alt], { broken: () => false, stale: () => false,
        comparisonWaitMs: 1, load: () => new Promise(() => {}) });
    assert.equal(r, null);
});
