const test = require('node:test');
const assert = require('node:assert/strict');
const { planParagraph, DurationEstimator } = require('../dub-planner');
const { DubEngine } = require('../dub-engine');
const { Clock, FakeVideo, lectureGroups } = require('./dub-sim');
const item = (start, duration, extra = {}) => ({ start, end: start + 5, earliest: start, duration, minRate: 0.95, maxRate: 1.3, reference: 1, rest: 0.18, minRest: 0.12, ...extra });
const plan = (speaker = 'A', text = 'Đây là câu nói để kiểm tra thời lượng của giọng đọc.') => ({ speaker, text });

test('paragraph planning prepares for a dense next sentence before lag arrives', () => {
    const easy = planParagraph([item(0, 5), item(5, 5), item(10, 5)], { time: 0 });
    const dense = planParagraph([item(0, 5), item(5, 9), item(10, 8)], { time: 0 });
    assert.ok(dense.rate > easy.rate, JSON.stringify({ easy, dense }));
    assert.equal(dense.horizon, 3);
});
test('paragraph planning keeps legal rate and rest constraints on every sentence', () => {
    const items = [0, 5, 10, 15, 20, 25].map(t => item(t, 12, { maxRate: 1.05, rest: 0.15, minRest: 0.15 }));
    const result = planParagraph(items, { time: 5 });
    for (const p of result.path) { assert.ok(p.rate >= 0.95 && p.rate <= 1.05); assert.equal(p.rest, 0.15); }
    assert.ok(result.path.at(-1).end > 30, 'overload remains delayed instead of losing content');
});
test('paragraph search preserves first-entry timing and causal FIFO playback', () => {
    const items = [item(0, 4), item(8, 3), item(15, 4)];
    const r = planParagraph(items, { time: 2 });
    assert.equal(r.start, 2);
    r.path.slice(1).forEach((p, i) => {
        assert.ok(p.start >= r.path[i].end + r.path[i].rest - 1e-9);
        assert.ok(p.start >= items[i + 1].earliest);
    });
});
test('natural-speed paragraphs do not accelerate without a delivery benefit', () => {
    const r = planParagraph([item(0, 4), item(5, 4), item(10, 4)], { time: 0 });
    assert.ok(r.rate <= 1.01); assert.ok(r.rate >= 0.95);
});
test('duration estimation resists one abnormal take and separates voices', () => {
    const e = new DurationEstimator(), p = plan();
    for (let i = 0; i < 8; i++) e.observe(p, 5, 5);
    const before = e.predict(p, 5); e.observe(p, 12, 5);
    assert.equal(e.predict(p, 5).duration, before.duration);
    assert.equal(e.predict(plan('B'), 5).samples, 0);
});
test('duration prediction reports uncertainty and learns sustained changes', () => {
    const e = new DurationEstimator(), p = plan();
    for (let i = 0; i < 8; i++) e.observe(p, i % 2 ? 6 : 4, 5);
    assert.ok(e.predict(p, 5).uncertainty > 0.5);
    for (let i = 0; i < 25; i++) e.observe(p, 6, 5);
    assert.ok(Math.abs(e.predict(p, 5).duration - 6) < 0.05);
});
test('duration classes learn numerical and Latin content without overwriting plain speech', () => {
    const e = new DurationEstimator(), plain = plan(), code = { ...plan(), text: 'Đây là GPT phiên bản 5 với 120GB.', subtitleText: 'GPT 5, 120GB' };
    for (let i = 0; i < 6; i++) { e.observe(plain, 4, 4); e.observe(code, 6, 4); }
    assert.equal(e.predict(plain, 4).duration, 4); assert.equal(e.predict(code, 4).duration, 6);
});
test('invalid duration samples cannot poison predictions', () => {
    const e = new DurationEstimator();
    for (const v of [NaN, Infinity, -1, 0.2, 100]) assert.equal(e.observe(plan(), v, 5), false);
    assert.equal(e.predict(plan(), 5).duration, 5);
});
function engine() {
    const clock = new Clock(), video = new FakeVideo();
    const e = new DubEngine({ video, getGroups: lectureGroups, providers: { primary: { caps: { prerender: true }, voiceModel: { sylPerSec: 4.5, rateExp: 1, calibration: 1 } } }, now: () => clock.now() }, { keepAllSpeech: true, maxRate: 1 });
    e.refresh(true); return e;
}
test('engine horizon respects user cap even under unavoidable overload', () => {
    const e = engine(), p = e.plans[0];
    const r = { duration: 20 };
    const rate = e.chooseRate(p, r, p.start, 0, 8);
    assert.ok(rate <= 1); assert.equal(e.paragraph.id, p.id); assert.ok(e.paragraph.horizon > 1);
});
test('a long source silence ends the planning horizon', () => {
    const e = engine(), p = e.plans[0], next = { ...e.plans[1], start: p.end + 20 };
    e.plans = [p, next];
    const r = { duration: 3 };
    assert.equal(e.paragraphRate(p, r, p.start, 0, 1, { floor: 0.95, ceiling: 1.3 }), 1);
    assert.equal(e.paragraph, undefined);
});
test('forecast respects tighter rate steps inside a continuing sentence', () => {
    const items = [item(0, 5), item(5, 10, { stepUp: 0.03 }), item(10, 10, { stepUp: 0.03 })];
    const r = planParagraph(items, { time: 0 });
    assert.ok(r.path[1].rate <= r.path[0].rate + 0.030001);
    assert.ok(r.path[2].rate <= r.path[1].rate + 0.030001);
});
test('paragraph planning stops before an earlier translation that has not arrived', () => {
    const e = engine(), p = e.plans[0], next = e.plans[1];
    e.d.getGroups = () => [{ start: p.end, end: next.start, translated: false }];
    const r = { duration: 3 };
    assert.equal(e.paragraphRate(p, r, p.start, 0, 1, { floor: 0.95, ceiling: 1.3 }), 1);
    assert.equal(e.paragraph, undefined);
});
test('one unusually slow take cannot change the engine voice pace after stable samples', () => {
    const e = engine(), p = e.plans[1]; e.provider.tempo = {};
    const syl = p.phrases.reduce((sum, ph) => sum + ph.syl, 0), duration = syl / 4.5;
    for (let i = 0; i < 8; i++) e.measureVoice(p, duration);
    const before = e.voiceSps.get(p.speaker); e.measureVoice(p, duration * 2);
    assert.equal(e.voiceSps.get(p.speaker), before);
});
test('model calibration limits an isolated duration outlier after stable samples', () => {
    const e = engine(), p = e.plans[1], m = e.provider.voiceModel;
    const base = { ...m, calibration: 1 };
    const P = require('../dub-planner');
    const natural = p.phrases.reduce((sum, ph, i) => sum + P.speechSeconds(ph.syl, 1, base) + (i < p.phrases.length - 1 ? P.pauseSeconds(ph.pauseAfter, 1, base) : 0), 0);
    for (let i = 0; i < 8; i++) e.calibrateFromAudio(p, natural);
    e.calibrateFromAudio(p, natural * 2);
    assert.ok(m.calibration <= 1.05);
});
