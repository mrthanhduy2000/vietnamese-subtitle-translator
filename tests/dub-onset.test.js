const test = require('node:test');
const assert = require('node:assert/strict');
const { DubEngine, SYNC } = require(process.env.DUB_ENGINE || '../dub-engine');
const PLAN = require('../dub-planner');
const { Clock, FakeVideo, FakeAudio, lectureGroups } = require('./dub-sim');
function env() {
    const clock = new Clock(), video = new FakeVideo(), made = [];
    const provider = { id: 'fixture', caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, render: async () => [] };
    const engine = new DubEngine({ video, getGroups: lectureGroups, providers: { primary: provider },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        setTimeout: (f, ms) => clock.setTimeout(f, ms),
        createAudio: () => { const a = new FakeAudio(clock, { duration: 2 }); made.push(a); return a; } }, {});
    engine.refresh(true);
    return { engine, clock, video, made };
}
test('first and seek landing takes are decoded before their due time without playing early', () => {
    const { engine: e, made } = env();
    const p = e.plans[0], r = { url: 'blob:first', duration: 2 };
    e.rendered.set(p.id, r);
    e.prewarm(p.start - SYNC.prewarmAhead - 1);
    assert.equal(made.length, 0);
    e.prewarm(p.start - 0.5);
    assert.equal(made.length, 1);
    assert.equal(r.el.paused, true);
    assert.equal(r.el.currentTime, 0);
    const next = e.plans[3], nr = { url: 'blob:seek', duration: 2 };
    e.rendered.set(next.id, nr);
    e.prewarm(next.start + 0.3);
    assert.ok(nr.el);
    assert.equal(nr.el.paused, true);
    assert.equal(made.length, 2, 'only the landing take is decoded');
});
test('paused startup warms the landing take without a prepare-hold caller', () => {
    const { engine: e, video, made, clock } = env();
    e.start();
    const p = e.plans[0];
    e.rendered.set(p.id, { url: 'blob:paused', duration: 2 });
    video.currentTime = Math.max(0, p.start - 0.5);
    e.tick();
    assert.equal(made.length, 1);
    assert.equal(made[0].paused, true);
    assert.equal(e.stats.started.length, 0);
    clock.ms += (SYNC.prewarmIdle + 1) * 1000;
    e.tick();
    assert.equal(made.length, 1, 'a long pause does not repeatedly rebuild idle elements');
    e.stop();
});
test('an already-zero take starts without a redundant seek while nonzero entries remain exact', () => {
    const { engine: e } = env();
    let pos = 0, seeks = [];
    const el = { paused: true, playbackRate: 1, play() { this.paused = false; return Promise.resolve(); },
        get currentTime() { return pos; }, set currentTime(v) { seeks.push(v); pos = v; } };
    e.cueSpeech = () => {};
    const s = { offset: 0, mediaStart: 1, rate: 1 };
    e.driveSpeech(s, { el }, 1, 1, true);
    assert.deepEqual(seeks, []);
    el.paused = true; s.offset = 0.75;
    e.driveSpeech(s, { el }, 1, 1, true);
    assert.deepEqual(seeks, [0.75]);
    el.paused = true; s.offset = 0;
    e.driveSpeech(s, { el }, 1, 1, true);
    assert.deepEqual(seeks, [0.75, 0]);
});

test('playback lateness includes browser startup and is counted once across resume', () => {
    const { engine: e, clock } = env();
    const el = { currentTime: 0.02, volume: 1 };
    const record = { t: 1, lag: 0 };
    const state = { moving: false, cuePos: 0, cueWall: 0, offset: 0, mediaStart: 1, end: 3, rate: 1, startRecord: record };
    clock.ms = 700;
    e.settleSpeech(state, el, 1.7);
    assert.ok(record.playbackLag > 0.65);
    assert.equal(record.startupMs, 700);
    e.stats.started.push(record);
    assert.equal(e.debugSnapshot().delivery.playbackLate, 1);
    assert.ok(e.debugSnapshot().started[0].playbackLag > 0.65);
    assert.equal(e.stats.playbackLate, 1);
    const first = record.playbackStart;
    state.moving = false; state.cuePos = 0.1; el.currentTime = 0.13;
    e.settleSpeech(state, el, 2.5);
    assert.equal(record.playbackStart, first);
    assert.equal(e.stats.playbackLate, 1);
});
