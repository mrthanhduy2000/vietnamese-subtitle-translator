// The glossary bridge into the voice (2.6.0): a name the glossary keeps in English is said the
// international way by VieNeu. Its own file, because loading the glossary changes dub-speech.js's
// lexicon for the whole process.
const test = require("node:test");
const assert = require("node:assert");
require("../glossary.js");
require("../glossary-extra.js");
require("../glossary-data.js");
const PLAN = require("../dub-planner.js");
const SPEECH = require("../dub-speech.js");

const voice = s => SPEECH.vieneuText(PLAN.adaptForSpeech(s));

test("2.6.0: a kept glossary name VieNeu would read as Vietnamese syllables is tagged English", () => {
    assert.equal(voice("Tôi mua kem CeraVe ở Sephora."), "Tôi mua kem <en>cerave</en> ở Sephora.");
    assert.equal(voice("Bạn nên dùng CUDA cho việc này."), "Bạn nên dùng <en>cuda</en> cho việc này.");
});

test("2.6.0: names VieNeu already says well, and Vietnamese names and codes, are left alone", () => {
    assert.equal(voice("Tôi học ở Harvard rồi chuyển sang Stanford."), "Tôi học ở Harvard rồi chuyển sang Stanford.");
    assert.equal(voice("Tôi thích Hoàng Thùy Linh."), "Tôi thích Hoàng Thùy Linh.");
    assert.equal(voice("Tôi mở tài khoản SSI và xem VTV."), "Tôi mở tài khoản SSI và xem VTV.");
});

test("2.6.0: & inside an English name is said 'and'; between Vietnamese names it stays 'và'", () => {
    assert.equal(voice("Anh ấy làm ở Johnson & Johnson."), "Anh ấy làm ở Johnson and Johnson.");
    assert.equal(voice("Nam & Lan đi chơi."), "Nam và Lan đi chơi.");
});

test("2.6.0: initials inside an English name are English letters, and their dots are not read", () => {
    assert.equal(voice("Samuel L. Jackson đóng phim đó."), "Samuel <en>l</en> Jackson đóng phim đó.");
    assert.equal(voice("Cô ấy dùng son e.l.f. mỗi ngày."), "Cô ấy dùng son <en>e l f</en> mỗi ngày.");
});

test("2.6.0: every generated respelling belongs to a name the glossary still keeps in English", () => {
    const kept = new Set();
    for (const g of Object.values(globalThis.CST_GLOSSARY_GROUPS))
        for (const t of g.terms) if (!(g.vi || {})[t.toLowerCase()] && SPEECH.glossaryName(t)) kept.add(t.toLowerCase());
    const stale = Object.keys(SPEECH.GLOSSARY_SAY).filter(k => !kept.has(k));
    assert.deepEqual(stale, []);
});

test("2.9.9: a letter of an already tagged English span is not tagged a second time", () => {
    // the glossary has an entry "R" (the language): it must not wrap the r of "<en>c r h</en>"
    assert.equal(voice("Tôi đi tàu CRH3 sáng nay."), "Tôi đi tàu <en>c r h</en> 3 sáng nay.");
    assert.equal(voice("Gen BRCA1 liên quan ung thư."), "Gen <en>b r c a</en> 1 liên quan ung thư.");
    assert.equal(SPEECH.vieneuText("Tôi dùng <en>c r h</en> 3 và Python."), "Tôi dùng <en>c r h</en> 3 và Python.");
});
