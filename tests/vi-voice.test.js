// Voice from a site's own Vietnamese captions (no translation): the pure helpers, offline.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const LANG = require("../lang-detect.js");
const PLAN = require("../dub-planner.js");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("viVoiceSource offers the voice only when another language shows the speech is not Vietnamese", () => {
    assert.deepEqual(LANG.viVoiceSource(["en", "vi"]), { offer: true, spoken: "en" });
    assert.deepEqual(LANG.viVoiceSource(["vi-VN", "ja"]), { offer: true, spoken: "ja" });
    assert.equal(LANG.viVoiceSource(["vi"]).offer, false);
    assert.equal(LANG.viVoiceSource(["en", "fr"]).offer, false);
    assert.equal(LANG.viVoiceSource(["", "vi"]).offer, false);
    assert.equal(LANG.viVoiceSource(null).offer, false);
});

test("groupsFromViCues makes one dub group per cue in the translator's shape", () => {
    const cues = [
        { startTime: 1, endTime: 3, text: "Xin <i>chào</i>  các bạn." },
        { start: 3, end: 5, text: "Hôm nay học bài mới." },
        { start: 5, end: 5, text: "bad time" },
        { start: 6, end: 7, text: "   " },
    ];
    const g = PLAN.groupsFromViCues(cues);
    assert.equal(g.length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(g[0])), {
        start: 1, end: 3, viText: "Xin chào các bạn.",
        srcCues: [{ start: 1, end: 3, text: "Xin chào các bạn." }],
        viCues: [{ start: 1, end: 3, text: "Xin chào các bạn." }],
    });
    assert.deepEqual(PLAN.groupsFromViCues(null), []);
});

test("track sites start the voice from the Vietnamese track without translating, and YouTube shares the grouping", () => {
    const cs = R("content.js");
    assert.match(cs, /const own = pickBestTrack\(\);\s*if \(own && own\.alreadyVietnamese && csViVoiceSource\(\)\) \{[^}]*await csStartViVoice\(\);\s*return;/);
    assert.match(cs, /PLAN\.groupsFromViCues\(/);
    assert.match(cs, /actionLabel: "Lồng tiếng từ phụ đề Việt"/);
    assert.match(R("youtube.js"), /yt\.dubGroups = window\.CST_DUB_PLAN\.groupsFromViCues\(viCues\)/);
});

test("a toast with an action button stays at least 30 s", () => {
    assert.match(R("content.js"), /const ms = opts\.ms \|\| \(opts\.actionLabel \? 30000 : 6000\);/);
});
