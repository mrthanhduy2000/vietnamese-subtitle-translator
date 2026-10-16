// The voice follows a changed translation, and the hand-correction feature (subtitle-edits.js,
// removed in 2.5.6) leaves nothing behind.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const seg = require("../vi-segmenter.js");
const { DubEngine } = require("../dub-engine.js");
const { Clock, FakeVideo, FakeAudio } = require("./dub-sim.js");

function group(vi, src) {
    return { start: src[0].start, end: src[src.length - 1].end, srcCues: src, viText: vi, viCues: seg.segmentGroupSafe(vi, src) };
}

function lecture() {
    return [
        group("Vì vậy, trong thực tế, khi huấn luyện một mạng sâu, bạn thường bắt đầu với tốc độ học nhỏ, theo dõi hàm mất mát trên tập xác thực sau mỗi epoch.", [
            { start: 0, end: 2.4, text: "So in practice, when you train a deep network," },
            { start: 2.4, end: 4.6, text: "you usually start with a small learning rate," },
            { start: 4.6, end: 6.8, text: "monitor the validation loss after every epoch." }
        ]),
        group("Đây là bước đầu tiên. Giờ ta chuyển sang bước thứ hai của quy trình.", [
            { start: 8, end: 9.8, text: "This is the first step." },
            { start: 11, end: 13.6, text: "Now we move to the second step of the process." }
        ])
    ];
}

test("voice: a refined translation of the same length is picked up without a forced refresh", () => {
    const groups = lecture();
    const clock = new Clock();
    const video = new FakeVideo();
    const released = [];
    const provider = {
        id: "vieneu", label: "VieNeu", caps: { prerender: true, live: false, free: true }, voiceLabel: "x",
        voiceModel: { sylPerSec: 4.3, rateExp: 1, pauseFactor: 1.3, calibration: 1 },
        tempo: { targetSps: 4.6, minSps: 3.9, maxTempo: 1.25, maxFloor: 1.15 },
        naturalSps: () => 4.3, audioKey: async p => "k" + p.id, abort() {}, render: async () => []
    };
    const eng = new DubEngine({
        video, getGroups: () => groups, providers: { primary: provider },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        setTimeout: (f, ms) => clock.setTimeout(f, ms), createObjectURL: () => "blob:x", revokeObjectURL() {},
        createAudio: () => new FakeAudio(clock, { duration: 1 })
    });
    eng.refresh(true);
    for (const p of eng.plans) eng.rendered.set(p.id, { url: "blob:" + p.id, duration: 1, stretch: 1, text: p.text, el: { pause() { released.push(p.id); } } });
    // the refine pass swaps a word for another of the same length ("bước" -> "khâu"): the old
    // signature (step, group count, text lengths) did not change, so the voice kept the old words
    const g = groups[1];
    const before = g.viText;
    g.viText = before.replace("bước đầu tiên", "khâu đầu tiên");
    assert.equal(g.viText.length, before.length);
    g.viCues = seg.segmentGroupSafe(g.viText, g.srcCues);
    assert.equal(eng.refresh(), true, "the same-length change was not noticed");
    assert.ok(eng.plans.some(p => /khâu đầu tiên/.test(p.text)));
    const stale = [...released];
    assert.ok(stale.length >= 1, "the replaced line's preloaded audio element was not released");
    assert.equal(eng.refresh(), false, "nothing changed since: no rebuild");
});

test("hand-corrected lines are gone: no module, no pencil, no Settings card, old records cleaned", () => {
    assert.equal(fs.existsSync(path.join(__dirname, "..", "subtitle-edits.js")), false);
    assert.doesNotMatch(R("manifest.json"), /subtitle-edits/);
    assert.doesNotMatch(R("options.html"), /subtitle-edits|editsList|Phụ đề đã sửa/);
    for (const f of ["youtube.js", "content.js", "transcript.js", "options.js", "dubbing.js", "player-ui.js"]) {
        assert.doesNotMatch(R(f), /CST_EDITS|saveEdit|cst-tr-edit|cstOrig/, f);
    }
    assert.match(R("background.js"), /startsWith\("edits:"\)/, "stored corrections are not removed once");
});
