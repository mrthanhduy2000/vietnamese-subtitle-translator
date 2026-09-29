// Settings added in 1.6.6: backup/restore, the voice's top reading speed, and whether a video's
// own Vietnamese captions are used as they are.
const test = require("node:test");
const assert = require("node:assert/strict");
const { read } = require("./bg-env.js");
const BK = require("../settings-backup.js");
const { DubEngine } = require("../dub-engine.js");
const PLAN = require("../dub-planner.js");
const { Clock, FakeVideo, lectureGroups } = require("./dub-sim.js");

test("backup keeps every setting and the edits, drops caches, and the key only on request", () => {
    const sync = { dualMode: true, geminiApiKey: "AIza-secret", dubLocalVoice: "Kim Thanh", userKeep: "PyTorch\nNumPy", subStyle: { fontSize: 110 } };
    const local = { "edits:yt:abc": { title: "T", lines: { "1200": { text: "sửa", orig: "máy" } } }, ytcache4_abc: { big: 1 }, costLedger: {}, modelAccess: {} };
    const withKey = BK.buildBackup(sync, local, { includeKey: true, appVersion: "1.6.6", now: "2026-09-26T12:00:00Z" });
    assert.equal(withKey.sync.geminiApiKey, "AIza-secret");
    assert.equal(withKey.hasKey, true);
    assert.deepEqual(Object.keys(withKey.local), ["edits:yt:abc"], "caches are not backed up");
    const noKey = BK.buildBackup(sync, local, { includeKey: false });
    assert.equal(noKey.sync.geminiApiKey, undefined);
    assert.equal(noKey.sync.dubLocalVoice, "Kim Thanh");

    const back = BK.parseBackup(JSON.stringify(withKey));
    assert.equal(back.ok, true);
    assert.deepEqual(back.sync, withKey.sync);
    assert.deepEqual(back.local, withKey.local);
    assert.equal(back.summary.edits, 1);
    assert.equal(back.summary.hasKey, true);
});

test("restore refuses foreign or broken files and filters what it writes", () => {
    assert.equal(BK.parseBackup("").ok, false);
    assert.equal(BK.parseBackup("{not json").ok, false);
    assert.equal(BK.parseBackup(JSON.stringify({ hello: 1 })).ok, false);
    assert.equal(BK.parseBackup(JSON.stringify({ format: BK.FORMAT, version: 99, sync: {} })).ok, false, "newer format");
    const r = BK.parseBackup(JSON.stringify({ format: BK.FORMAT, version: 1,
        sync: { costMode: "economy", "bad key": 1, __proto__x: 2, nul: null },
        local: { "edits:/learn/x": { lines: {} }, ytcache4_zz: { x: 1 }, costLedger: {} } }));
    assert.equal(r.ok, true);
    assert.deepEqual(r.sync, { costMode: "economy" });
    assert.deepEqual(Object.keys(r.local), ["edits:/learn/x"], "only edits reach storage.local");
});

test("Settings page wires backup, max rate and skipSameLang", () => {
    const html = read("options.html"), js = read("options.js");
    assert.ok(html.indexOf("settings-backup.js") < html.indexOf("options.js"));
    for (const id of ["backupExport", "backupImport", "backupFile", "backupIncludeKey", "dubMaxRate", "skipSameLang"]) {
        assert.match(html, new RegExp(`id="${id}"`), id);
    }
    assert.match(js, /dubMaxRate: maxRateSel \? Number\(maxRateSel\.value\) \|\| 0 : 0/);
    assert.match(js, /skipSameLang: skipSameLangBox \? skipSameLangBox\.checked : true/);
    // ticking the key box or picking a file is not a settings change
    assert.match(js, /e\.target\.dataset\.noSave/);
    assert.match(html, /id="backupIncludeKey" data-no-save="1"/);
    // an import freezes the autosave before writing: a pending save or the pagehide flush on the
    // reload would otherwise write the stale form over the imported settings
    assert.match(js, /saveFrozen = true;[\s\S]{0,200}storage\.sync\.set\(parsed\.sync\)/);
    assert.match(js, /async function saveNow\(\) \{[\s\S]{0,120}if \(saveFrozen\) return;/);
});

function engineAt(maxRate) {
    const clock = new Clock(), video = new FakeVideo();
    const groups = lectureGroups();
    const prov = { id: "gemini", caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, render: async () => [] };
    const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: prov },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id) }, { maxRate });
    eng.refresh(true);
    return eng;
}

test("dubMaxRate caps every rate the voice may take, automatic leaves the adaptive ceiling alone", () => {
    const auto = engineAt(null);
    const p = auto.plans[5];
    const r = { duration: (p.targetDuration || 2) * 2.2 };            // far too long: wants > 2x
    const free = auto.chooseRate(p, r, p.start, 0, 3);                  // 3 s behind: lag boost
    assert.ok(free > 1.3, `automatic may exceed 1.3 when behind (got ${free})`);
    for (const cap of [1.1, 1.2, 1.4]) {
        const eng = engineAt(cap);
        const q = eng.plans[5];
        const rate = eng.chooseRate(q, { duration: (q.targetDuration || 2) * 2.2 }, q.start, 0, 3);
        assert.ok(rate <= cap + 1e-9, `cap ${cap} broken: ${rate}`);
        const lim = eng.paceLimits(q, q.start);
        assert.ok(lim.ceiling <= cap + 1e-9 && lim.lagCeiling <= cap + 1e-9);
    }
    assert.equal(engineAt(0).userMaxRate(), null, "0 means automatic");
    assert.equal(engineAt(3).userMaxRate(), null, "nonsense values are ignored");
});

test("dubbing.js passes dubMaxRate to the engine and applies a change live", () => {
    const d = read("dubbing.js");
    assert.match(d, /maxRate: Number\(s\.dubMaxRate\) \|\| null/);
    assert.match(d, /if \(changes\.dubMaxRate\) e\.settings\.maxRate = /);
});

test("skipSameLang off: Coursera and generic pages translate from the source track", () => {
    const cs = read("content.js");
    assert.match(cs, /if \(viTrack && state\.skipSameLang !== false\) return \{ track: viTrack, alreadyVietnamese: true \};/);
    assert.match(cs, /if \(viTrack && others\.length\) pool = others;/);
    assert.match(cs, /if \(changes\.skipSameLang\) state\.skipSameLang = /);
    assert.match(read("youtube.js"), /if \(changes\.skipSameLang\) ytSettings\.skipSameLang = /);
});
