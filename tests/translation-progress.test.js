const test = require('node:test');
const assert = require('node:assert/strict');
const { bgEnv } = require('./bg-env');
const { pageEnv } = require('./progress-env');
const copy = x => JSON.parse(JSON.stringify(x));
const groups = [0, 1, 2].map(i => ({ start: i * 5, end: i * 5 + 4, text: `Source sentence number ${i}.`, srcCues: [{ start: i * 5, end: i * 5 + 4, text: `Source sentence number ${i}.` }], cueIndexes: [i] }));
const answer = t => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ t }) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30 } }) });
const config = { geminiApiKey: 'test-key', geminiModel: 'gemini-2.5-flash-lite', modelsVersion: 116, costMode: 'economy', costMigration113: true };
const req = { action: 'translateUnit', sentences: groups.map(g => g.text), context: {} };

test('empty Gemini items use fallback only for missing positions and keep good translations', async () => {
    const asked = []; let gemini = 0;
    const E = bgEnv(async url => {
        if (url.includes('generativelanguage')) { gemini++; return answer(['Câu thứ nhất.', '', 'Câu thứ ba.']); }
        asked.push(new URL(url).searchParams.get('q'));
        return { ok: true, status: 200, json: async () => [[['Câu thứ hai.', 'x']], null, 'en'] };
    }, config);
    const r = await E.send(req);
    assert.deepEqual(copy(r.translations), ['Câu thứ nhất.', 'Câu thứ hai.', 'Câu thứ ba.']);
    assert.deepEqual(copy(r.fallbackIndexes), [1]);
    assert.equal(gemini, 1);
    assert.deepEqual(asked, [req.sentences[1]]);
    assert.equal(r.engine, 'google_fallback');
    await E.send(req);
    assert.equal(gemini, 2, 'mixed answers must not be cached as complete Gemini results');
});

test('a failed repair leaves only its missing line pending', async () => {
    const E = bgEnv(async url => url.includes('generativelanguage') ? answer(['Câu một.', '', 'Câu ba.']) : { ok: false, status: 400, json: async () => ({}) }, config);
    const r = await E.send(req);
    assert.deepEqual(copy(r.translations), ['Câu một.', '', 'Câu ba.']);
    assert.deepEqual(copy(r.fallbackIndexes), [1]);
});

test('unknown output alignment never salvages items at guessed positions', async () => {
    const asked = [];
    const E = bgEnv(async url => {
        if (url.includes('generativelanguage')) return answer(['Wrong count']);
        asked.push(new URL(url).searchParams.get('q'));
        return { ok: true, status: 200, json: async () => [[['Một.\nHai.\nBa.', 'x']], null, 'en'] };
    }, config);
    const r = await E.send(req);
    assert.deepEqual(copy(r.fallbackIndexes), [0, 1, 2]);
    assert.ok(asked[0].includes(req.sentences[0]) && asked[0].includes(req.sentences[2]));
});

function env(local = {}) {
    const E = pageEnv({ youtube: true, local });
    E.sandbox.inputGroups = copy(groups);
    return E;
}

test('progress snapshots survive navigation, reload and complementary saves', async () => {
    const E = env();
    const save = E.run('saveVideoProgress("cstprogress1_yt_test", inputGroups, ["Một.", "", ""], "track")');
    E.sandbox.inputGroups[0].text = 'Changed after queueing';
    await save;
    const R = env(E.store);
    assert.deepEqual(copy(await R.run('readVideoProgress("cstprogress1_yt_test", inputGroups, "track")')), ['Một.', '', '']);
    await R.run('saveVideoProgress("cstprogress1_yt_test", inputGroups, ["", "Hai.", ""], "track")');
    assert.deepEqual(copy(await R.run('readVideoProgress("cstprogress1_yt_test", inputGroups, "track")')), ['Một.', 'Hai.', '']);
    assert.equal(await R.run('readVideoProgress("cstprogress1_yt_test", inputGroups, "other-track")'), null);
    R.sandbox.inputGroups[1].end += 0.01;
    assert.equal(await R.run('readVideoProgress("cstprogress1_yt_test", inputGroups, "track")'), null);
});

test('YouTube checkpoints omit fallback and empty groups while keeping good Gemini groups', async () => {
    const E = env();
    await new Promise(r => setImmediate(r));
    E.run('yt.groups = inputGroups; yt.currentVideoId = "test"; yt.srcTrack = "en"; yt.cues = inputGroups.flatMap(g => g.srcCues); yt.huyDich = false;');
    E.run('ytGanBanDich(inputGroups, [0,1], ["Một.", "Tạm."], "google_fallback", [1])');
    await E.run('videoProgressQueue');
    assert.deepEqual(copy(E.store.cstprogress1_yt_test.vi), ['Một.', '', '']);
    assert.equal(E.store.ytcache4_test, undefined);
    const restored = await E.run('readVideoProgress(ytProgressKey(), inputGroups, ytProgressScope())');
    assert.equal(restored.filter(Boolean).length, 1);
    await E.run('ytGhiCache("test")');
    assert.equal(E.store.ytcache4_test, undefined, 'fallback must still block complete cache');
});

test('completed YouTube cache removes its checkpoint after pending writes', async () => {
    const E = env();
    E.run('yt.groups = inputGroups; yt.currentVideoId = "test"; yt.srcTrack = "en"; yt.cues = inputGroups.flatMap(g => g.srcCues); yt.huyDich = false;');
    E.run('ytGanBanDich(inputGroups, [0], ["Một."], "gemini")');
    await E.run('videoProgressQueue');
    E.run('ytGanBanDich(inputGroups, [1,2], ["Hai.", "Ba."], "gemini")');
    await new Promise(r => setImmediate(r));
    await E.run('videoProgressQueue');
    assert.ok(E.store.ytcache4_test);
    assert.equal(E.store.cstprogress1_yt_test, undefined);
    await E.run('ytSaveProgress()');
    assert.equal(E.store.cstprogress1_yt_test, undefined, 'stop after completion cannot recreate a checkpoint');
});

test('progress expiry, malformed records and capacity are bounded', async () => {
    const E = env();
    for (let i = 0; i < 23; i++) await E.run(`saveVideoProgress("cstprogress1_${i}", inputGroups, ["Một.", "", ""], "track")`);
    assert.equal(Object.keys(E.store).filter(k => k.startsWith('cstprogress1_')).length, 20);
    assert.equal(E.store.cstprogress1_0, undefined);
    E.store.cstprogress1_22.luc = Date.now() - 31 * 864e5;
    assert.equal(await E.run('readVideoProgress("cstprogress1_22", inputGroups, "track")'), null);
    E.store.cstprogress1_21.vi[0] = {};
    assert.equal(await E.run('readVideoProgress("cstprogress1_21", inputGroups, "track")'), null);
});

test('translation cache clear also removes progress without touching settings or audio', async () => {
    const local = { cstprogress1_test: { vi: ['Một.'] }, cstprogressIndex: [], unrelated: 1 };
    const E = bgEnv(() => {}, {}, { local });
    await E.send({ action: 'cacheClear', which: 'tr' });
    assert.equal(local.cstprogress1_test, undefined);
    assert.equal(local.cstprogressIndex, undefined);
    assert.equal(local.unrelated, 1);
});

test('Coursera resumes only missing groups from a partial result', async () => {
    const E = env();
    const calls = [];
    E.sandbox.capture = idxs => { calls.push([...idxs]); };
    E.run('translateWindow = async (_, idxs) => { capture(idxs); return { translations: idxs.map(i => "Dịch " + i), engine: "gemini" }; };');
    const r = await E.run('translateAllGroups({}, inputGroups, null, () => true, { initial: ["Đã lưu.", "", "Đã lưu ba."] })');
    assert.deepEqual(copy(r), ['Đã lưu.', 'Dịch 1', 'Đã lưu ba.']);
    assert.deepEqual(calls, [[1]]);
});


test('worker serializes checkpoints from different tabs and merges complementary results', async () => {
    const local = {};
    const E = bgEnv(() => { throw new Error('Unexpected network'); }, {}, { local, asyncLocal: 2 });
    const record = vi => ({ version: 1, source: 'same-source', scope: 'same-track', vi });
    await Promise.all([
        E.send({ action: 'videoProgress', key: 'cstprogress1_yt_shared', record: record(['One', '']) }),
        E.send({ action: 'videoProgress', key: 'cstprogress1_cs_other', record: record(['Other', '']) }),
        E.send({ action: 'videoProgress', key: 'cstprogress1_yt_shared', record: record(['', 'Two']) })
    ]);
    assert.deepEqual(copy(local.cstprogress1_yt_shared.vi), ['One', 'Two']);
    assert.equal(local.cstprogressIndex.length, 2);
    assert.equal(new Set(local.cstprogressIndex.map(e => e[0])).size, 2);
    const invalid = await E.send({ action: 'videoProgress', key: 'settings', record: record(['Bad']) });
    assert.equal(invalid.ok, false);
    assert.equal(local.settings, undefined);
    await E.send({ action: 'videoProgress', key: 'cstprogress1_yt_shared', remove: true });
    assert.equal(local.cstprogress1_yt_shared, undefined);
    assert.equal(local.cstprogressIndex.length, 1);
});
