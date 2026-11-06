const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SpeechSession } = require('../dub-session');
const { DubEngine } = require('../dub-engine');
const PLAN = require('../dub-planner');
const { Clock, FakeVideo, lectureGroups } = require('./dub-sim');

function session() {
    const s = new SpeechSession();
    s.transition('start', { sourceId: 'source', time: 0 });
    s.plans = [1, 4, 8].map(start => ({ id: `t${start}`, start, end: start + 2, text: `Words ${start}`, phrases: [{ offset: 0, dur: 2 }] }));
    s.planById = new Map(s.plans.map(p => [p.id, p]));
    return s;
}
function env() {
    const clock = new Clock(), video = new FakeVideo();
    const provider = { id: 'fixture', caps: { prerender: true, free: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL,
        render: async () => [], audioKey: async p => p.id, abort() {} };
    const e = new DubEngine({ video, getGroups: lectureGroups, providers: { primary: provider },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        setTimeout: (f, ms) => clock.setTimeout(f, ms), clearTimeout: id => clock.clear(id),
        createObjectURL: () => 'blob:fixture', revokeObjectURL() {} }, { keepAllSpeech: true });
    e.start();
    return { e, provider, video, clock };
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('session lifecycle gates pause, buffering, ads, EOF and stop', () => {
    const s = session();
    for (const [event, args, phase] of [
        ['pause', { paused: true }, 'paused'], ['waiting', { waiting: true }, 'buffering'],
        ['play', {}, 'playing'], ['ad-start', {}, 'ad'], ['frame', { ended: true }, 'ad'],
        ['ad-end', { ended: true }, 'draining'], ['stop', {}, 'stopped']
    ]) { s.transition(event, args); assert.equal(s.phase, phase); }
});
test('seek invalidates playback callbacks but preserves reusable matching synthesis', () => {
    const s = session(), provider = {}, p = s.plans[0];
    const playback = s.token(true), work = s.lease(p, provider);
    s.transition('reset', { reason: 'seek', time: 8 });
    assert.equal(s.current(playback), false);
    assert.equal(s.accepts(work, provider), true);
    assert.equal(s.queued(p), false);
    assert.equal(s.entryPlan(8, 0).plan.id, 't8');
});
test('source changes and stop/start reject old work even with identical plan IDs', () => {
    const s = session(), p = s.plans[0], provider = {};
    const a = s.lease(p, provider);
    s.transition('reset', { sourceId: 'other' }); assert.equal(s.accepts(a, provider), false);
    const b = s.lease(p, provider);
    s.transition('stop'); s.transition('start', { sourceId: 'other' });
    assert.equal(s.accepts(b, provider), false);
});
test('changed text, timing, voice or provider rejects old synthesized content', () => {
    for (const patch of [{ text: 'Refined words' }, { end: 9 }, { voiceTag: 'another' }]) {
        const s = session(), provider = {}, p = s.plans[0], lease = s.lease(p, provider);
        s.planById.set(p.id, { ...p, ...patch }); assert.equal(s.accepts(lease, provider), false);
    }
    const s = session(); assert.equal(s.accepts(s.lease(s.plans[0], {}), {}), false);
});
test('out-of-order translation blocks later speech and remains pending at EOF', () => {
    const s = session();
    s.observe([{ start: 0, end: 1, translated: false }]);
    assert.equal(s.translationBefore(s.plans[0], 0), true);
    s.transition('frame', { ended: true });
    s.plans = []; s.planById.clear();
    const status = s.snapshot({ time: 20 });
    assert.equal(status.phase, 'draining'); assert.equal(status.wait, 'translation');
    s.observe([]); assert.equal(s.snapshot({ time: 20 }).phase, 'complete');
});
test('ad resume preserves FIFO only when the source returns to the same position', () => {
    const s = session(); s.lastSpokenStart = 1; s.lastSpokenId = 't1';
    assert.ok(s.transition('reset', { reason: 'ad', time: 30, adSourceTime: 30, adResumeWithin: 1 }));
    assert.equal(s.lastSpokenId, 't1'); assert.equal(s.entryAt, 0);
    assert.equal(s.transition('reset', { reason: 'ad', time: 60, adSourceTime: 30, adResumeWithin: 1 }), null);
    assert.equal(s.lastSpokenId, null); assert.equal(s.entryAt, 60);
});
test('EOF clock integrates speed changes and resets after replay', () => {
    const s = session(), v = { ended: true, currentTime: 10, playbackRate: 1 };
    assert.equal(s.timeline(v, 1000), 10); assert.equal(s.timeline(v, 2000), 11);
    v.playbackRate = 2; assert.equal(s.timeline(v, 2500), 12);
    s.transition('reset', { time: 0 }); v.ended = false; v.currentTime = 0;
    assert.equal(s.timeline(v, 3000), 0);
});
test('render horizon crosses source silence without moving the retention cursor', () => {
    const s = session(); s.lastSpokenStart = 4; s.plans[2].start = 300;
    assert.equal(s.queueAt(400), 4); assert.equal(s.renderAt(400), 300);
});
test('cache result after engine restart cannot populate the new session', async () => {
    const { e, provider } = env(), d = deferred(), p = e.plans[0];
    e.d.audioCache = { get: () => d.promise }; provider.audioKey = async () => 'same';
    const pending = e.lookupCache([p]); await Promise.resolve();
    e.stop(); e.start();
    d.resolve({ same: { wav: new Uint8Array([1]), duration: 2 } }); await pending;
    assert.equal(e.rendered.size, 0); assert.equal(e.cacheChecked.size, 0); assert.equal(e.busyLookup, false); e.stop();
});
test('old render completion after restart cannot populate or calibrate the new session', async () => {
    const { e, provider } = env(), d = deferred(), p = e.plans[0]; provider.render = () => d.promise;
    const pending = e.renderBatch([p]); e.stop(); e.start();
    d.resolve([{ planId: p.id, wav: new Uint8Array([1]), duration: 2 }]); await pending;
    assert.equal(e.rendered.size, 0); assert.equal(e.renderSamples, 0); assert.equal(e.voiceSps.size, 0); e.stop();
});
test('old render failure cannot penalize a refined replacement with the same ID', async () => {
    const { e, provider } = env(), d = deferred(), p = e.plans[0]; provider.render = () => d.promise;
    const pending = e.renderBatch([p]); e.planById.set(p.id, { ...p, text: 'New translation' });
    d.reject(new Error('Old request failed')); await pending;
    assert.equal(e.failed.size, 0); assert.equal(e.stats.errors, 0); assert.equal(e.consecutiveErrors, 0); e.stop();
});
test('late cache timeout does not mark a replacement plan as checked', async () => {
    const { e, provider, clock } = env(), d = deferred(), p = e.plans[0];
    provider.audioKey = () => d.promise; e.d.audioCache = { get: async () => ({}) };
    const pending = e.lookupCache([p]); e.planById.set(p.id, { ...p, text: 'New translation' });
    e.d.clearInterval(e.timer); clock.advance(10000);
    assert.equal(e.cacheChecked.has(p.id), false); d.resolve('key'); await pending; e.stop();
});
test('invalid group timing is reported and excluded from planning', () => {
    const { e } = env(); e.d.getGroups = () => [{ ...lectureGroups()[0], start: NaN }];
    e.refresh(true); assert.equal(e.plans.length, 0); assert.equal(e.session().input.invalidTiming, 1); e.stop();
});
test('all browser loaders load the session before the engine exactly once', () => {
    const root = path.join(__dirname, '..');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    for (const entry of manifest.content_scripts.filter(x => x.js.includes('dub-engine.js'))) {
        assert.equal(entry.js.filter(x => x === 'dub-session.js').length, 1);
        assert.ok(entry.js.indexOf('dub-session.js') < entry.js.indexOf('dub-engine.js'));
    }
    for (const f of ['options.html', ...fs.readdirSync(path.join(root, 'tests/harness')).filter(f => f.endsWith('.html')).map(f => 'tests/harness/' + f)]) {
        const text = fs.readFileSync(path.join(root, f), 'utf8');
        if (!text.includes('dub-engine.js')) continue;
        assert.equal((text.match(/dub-session\.js/g) || []).length, 1, f);
        assert.ok(text.indexOf('dub-session.js') < text.indexOf('dub-engine.js'), f);
    }
});

test('manual pause takes precedence over a previous buffering signal', () => {
    const s = session(); s.transition('frame', { paused: true, waiting: true });
    assert.equal(s.phase, 'paused');
});
test('delayed live-provider callbacks after seek cannot finish or fail new speech', () => {
    const { e, video } = env(), callbacks = [];
    e.provider = { caps: { live: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL,
        speak(text, opts, cb) { callbacks.push(cb); return { cancel() {} }; } };
    const p = e.plans[0]; e.tickLive(p.start + 1, 1);
    assert.equal(callbacks.length, 1);
    video.currentTime = p.start; e.hardReset('seek'); e.tickLive(p.start + 1, 1);
    const current = e.live;
    callbacks[0].onstart(); callbacks[0].onend(); callbacks[0].onerror({ error: 'late' });
    assert.equal(e.live, current); assert.equal(current.finished, false); assert.equal(e.stats.errors, 0); e.stop();
});
test('a pending synthesis failure after provider change cannot disable the new provider', async () => {
    const { e, provider } = env(), d = deferred(), p = e.plans[0]; provider.render = () => d.promise;
    const pending = e.renderBatch([p]); e.provider = { ...provider, id: 'replacement' };
    d.reject({ type: 'budget' }); await pending;
    assert.equal(e.provider.id, 'replacement'); assert.equal(e.stats.errors, 0); assert.equal(e.failed.size, 0); e.stop();
});
test('old synthesis success cannot clear errors on a replacement provider', async () => {
    const { e, provider } = env(), d = deferred(), p = e.plans[0]; provider.render = () => d.promise;
    const pending = e.renderBatch([p]); e.provider = { ...provider, id: 'replacement' }; e.consecutiveErrors = 2;
    d.resolve([{ planId: p.id, wav: new Uint8Array([1]), duration: 2 }]); await pending;
    assert.equal(e.consecutiveErrors, 2); assert.equal(e.rendered.size, 0); e.stop();
});
test('a seek near the end of an uncached entry still schedules that entry', () => {
    const { e, video, provider } = env();
    const p = e.plans[0]; video.currentTime = p.end - 0.1; e.hardReset('seek');
    e.plans = [p]; e.planById = new Map([[p.id, p]]); e.headProbe = null;
    provider.audioKey = null;
    const batches = []; e.renderBatch = batch => batches.push(batch);
    e.schedule(video.currentTime);
    assert.ok(batches.flat().some(x => x.id === p.id), 'the FIFO entry must not be excluded from synthesis'); e.stop();
});
