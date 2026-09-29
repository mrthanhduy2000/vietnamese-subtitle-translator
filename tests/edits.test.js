// Subtitle edits (subtitle-edits.js): the viewer corrects a translated line in the transcript panel,
// the correction is stored per video, laid over the machine translation on every load, read aloud by
// the voice, and can always be taken back.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const seg = require("../vi-segmenter.js");
const PLAN = require("../dub-planner.js");
const { DubEngine } = require("../dub-engine.js");
const E = require("../subtitle-edits.js");
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

// A chrome.storage.local stand-in with the promise API the module uses
function fakeLocal() {
    const data = {};
    return {
        data,
        get: async k => (k == null ? { ...data } : (k in data ? { [k]: data[k] } : {})),
        set: async obj => { Object.assign(data, JSON.parse(JSON.stringify(obj))); },
        remove: async k => { delete data[k]; }
    };
}

test("store: a line moved a few ms by a re-translation is replaced or reverted, not duplicated", async () => {
    const local = fakeLocal();
    globalThis.chrome = { storage: { local } };
    try {
        await E.save("yt:mv", {}, 2.4, "sửa lần một", "máy");
        // the cue now starts at 2.43 s: a second edit replaces the first instead of adding a key
        let rec = await E.save("yt:mv", {}, 2.43, "sửa lần hai", "máy");
        assert.deepEqual(Object.keys(rec.lines), ["2430"]);
        assert.equal(E.editFor(rec.lines, 2.43).text, "sửa lần hai");
        // a revert at the moved time removes it (before, the edit at 2.4 kept showing)
        await E.save("yt:mv", {}, 2.4, "sửa lần một", "máy");
        rec = await E.save("yt:mv", {}, 2.41, "máy", "máy");
        assert.equal(rec.lines && Object.keys(rec.lines).length || 0, 0);
        assert.equal(local.data["edits:yt:mv"], undefined);
        await E.save("yt:mv", {}, 5, "x", "y");
        await E.removeLine("yt:mv", 5.02);
        assert.equal(local.data["edits:yt:mv"], undefined, "removeLine finds a moved line too");
        // two stored lines in range: the nearest one answers
        assert.equal(E.editFor({ "1000": { text: "a" }, "1050": { text: "b" } }, 1.04).text, "b");
    } finally { delete globalThis.chrome; }
});

test("store: save, find again by start time, revert by saving the machine text, list all videos", async () => {
    const local = fakeLocal();
    globalThis.chrome = { storage: { local } };
    try {
        let rec = await E.save("yt:abc", { title: "Bài 1", url: "https://youtu.be/abc" }, 2.4, "  dòng   đã sửa ", "dòng máy");
        assert.deepEqual(rec.lines["2400"], { text: "dòng đã sửa", orig: "dòng máy" });
        assert.equal(rec.title, "Bài 1");
        // a re-translation can move the cue a few ms: still the same line
        assert.equal(E.editFor(rec.lines, 2.43).text, "dòng đã sửa");
        assert.equal(E.editFor(rec.lines, 2.6), null);

        await E.save("cs:/learn/x/lecture/y", { title: "Coursera" }, 1, "khác", "máy");
        const all = await E.listAll();
        assert.equal(all.length, 2);

        // saving the machine text back is a revert: the line goes, and an empty video goes too
        rec = await E.save("yt:abc", null, 2.4, "dòng máy", "dòng máy");
        assert.equal(Object.keys(rec.lines).length, 0);
        assert.ok(!("edits:yt:abc" in local.data), "an empty record must not linger in storage");
        assert.equal((await E.listAll()).length, 1);
    } finally {
        delete globalThis.chrome;
    }
});

test("sync: the edit reaches both the overlay and the voice text, other cues keep their pause hints", () => {
    const groups = lecture();
    const g = groups[0];
    // the translator leaves pause hints (¦) in viText; the planner depends on them
    g.viText = g.viText.replace("trong thực tế,", "trong thực tế, ¦");
    const display = groups.flatMap(x => x.viCues);           // YouTube live path: shared objects
    const target = g.viCues[1];
    const before0 = g.viCues[0].text;
    const rec = { lines: { [String(Math.round(target.start * 1000))]: { text: "bạn nên khởi đầu bằng tốc độ học thật nhỏ,", orig: target.text } } };

    const n = E.sync(rec, { groups, display });
    assert.ok(n >= 1);
    assert.equal(target.text, "bạn nên khởi đầu bằng tốc độ học thật nhỏ,");
    assert.ok(target.lines.length >= 1 && target.lines.join(" ") === target.text);
    assert.equal(target.cstEdited, true);
    assert.equal(g.viCues[0].text, before0, "an untouched cue changed");
    assert.match(g.viText, /bạn nên khởi đầu bằng tốc độ học thật nhỏ,/);
    assert.match(g.viText, /¦/, "the pause hint of an untouched cue was lost");

    // the planner still lines the text up cue by cue
    const script = PLAN.buildDubScript(groups);
    assert.ok(script.some(s => /khởi đầu bằng tốc độ học thật nhỏ/.test(s.subtitleText)), JSON.stringify(script.map(s => s.subtitleText)));

    // applying twice changes nothing
    assert.equal(E.sync(rec, { groups, display }), 0);

    // revert (the record is gone): exact original text, exact original viText
    const origViText = g.cstOrigViText;
    E.sync(null, { groups, display });
    assert.equal(target.text, target.cstOrig.text);
    assert.equal(target.cstEdited, false);
    assert.equal(g.viText, origViText);
});

test("sync: cache path with separate overlay and voice objects gets the edit in both", () => {
    const groups = lecture();
    const display = groups.flatMap(x => x.viCues).map(c => ({ start: c.start, end: c.end, text: c.text, lines: c.lines.slice() }));
    const c = display[display.length - 1];
    const rec = { lines: { [String(Math.round(c.start * 1000))]: { text: "Giờ ta sang bước hai.", orig: c.text } } };
    E.sync(rec, { groups, display });
    assert.equal(c.text, "Giờ ta sang bước hai.");
    const gc = groups[1].viCues[groups[1].viCues.length - 1];
    assert.equal(gc.text, "Giờ ta sang bước hai.", "the voice would still read the machine line");
});

test("voice: after an edit only the edited sentence loses its audio, the rest is kept", () => {
    const groups = lecture();
    const clock = new Clock();
    const video = new FakeVideo();
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
    assert.ok(eng.plans.length >= 2, "need several spoken segments");
    for (const p of eng.plans) eng.rendered.set(p.id, { url: "blob:" + p.id, duration: 1, stretch: 1, text: p.text });

    const last = groups[1].viCues[groups[1].viCues.length - 1];
    E.sync({ lines: { [String(Math.round(last.start * 1000))]: { text: "Giờ ta sang bước hai của quy trình này.", orig: last.text } } },
        { groups, display: [] });
    eng.refresh(true);
    const gone = eng.plans.filter(p => !eng.rendered.has(p.id));
    assert.ok(gone.length >= 1, "the edited sentence kept its old audio");
    assert.ok(gone.every(p => /bước hai của quy trình này/.test(p.text)), `re-rendering more than the edit: ${gone.map(p => p.text).join(" | ")}`);
    assert.ok(eng.plans.some(p => eng.rendered.has(p.id)), "untouched sentences lost their audio");
});

// ---- the transcript panel in a small DOM ----
function panelDom() {
    class El {
        constructor(tag) { this.tagName = tag; this.children = []; this.parent = null; this.dataset = {}; this.style = {}; this.className = ""; this.attrs = {}; this.listeners = {}; this.text = ""; this.value = ""; }
        appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
        replaceChildren(...k) { this.children = []; this.text = ""; k.forEach(x => this.appendChild(x)); }
        remove() { if (this.parent) { this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; } }
        setAttribute(k, v) { this.attrs[k] = v; }
        getAttribute(k) { return this.attrs[k]; }
        addEventListener(n, f) { (this.listeners[n] = this.listeners[n] || []).push(f); }
        emit(n, ev = {}) { (this.listeners[n] || []).slice().forEach(f => f({ stopPropagation() {}, preventDefault() {}, ...ev })); }
        set textContent(v) { this.text = v; this.children = []; }
        get textContent() { return this.text + this.children.map(c => c.textContent).join(""); }
        all() { return this.children.flatMap(c => [c, ...c.all()]); }
        querySelectorAll(sel) { const cls = sel.replace(/^\./, ""); return this.all().filter(e => e.className.split(/\s+/).includes(cls)); }
        querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
        focus() {}
    }
    const doc = { createElement: t => new El(t), head: new El("head"), documentElement: new El("html"), getElementById: () => null };
    return { doc, El };
}

test("transcript panel: pencil opens an edit box, Enter saves, the video pauses and plays on", async t => {
    const { doc, El } = panelDom();
    const sb = { document: doc, setInterval: () => 0, clearInterval() {}, setTimeout, console, Promise, Math, String, Number, Object, Array, JSON, Date };
    sb.window = sb; sb.globalThis = sb;
    vm.createContext(sb);
    vm.runInContext(R("player-ui.js"), sb);
    vm.runInContext(R("transcript.js"), sb);
    t.after(() => sb.CST_TRANSCRIPT.close());

    const box = new El("div");
    const video = { currentTime: 3, paused: false, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
    const viCues = [{ start: 0, end: 2, text: "Câu một." }, { start: 2, end: 4, text: "Câu hai bị dịch sai." }];
    const NO_SOURCE = [];
    const saved = [];
    const adapter = {
        box: () => box, videoEl: () => video, title: () => "t", dual: () => false, theme: () => "dark",
        lines: () => sb.CST_TRANSCRIPT.mergeLines(viCues, NO_SOURCE),   // same arrays each call, like the players
        saveEdit: async (line, text) => {
            saved.push({ start: line.start, text, machine: line.machine });
            E.sync({ lines: { [String(line.start * 1000)]: { text, orig: line.machine } } }, { display: viCues });
        }
    };
    sb.CST_TRANSCRIPT.toggle(adapter);
    const panel = box.querySelector(".cst-tr-panel");
    let rows = panel.querySelectorAll(".cst-tr-row");
    assert.equal(rows[1].getAttribute("role"), "button", "a row must still act as a button for the keyboard");
    const pen = rows[1].querySelector(".cst-tr-edit");
    assert.ok(pen, "no edit button on the row");
    pen.emit("click");
    assert.equal(video.paused, true, "the video should pause while the viewer types");
    const input = rows[1].querySelector(".cst-tr-input");
    assert.ok(input, "no edit box");
    assert.equal(input.value, "Câu hai bị dịch sai.");

    // clicking the row while editing must not seek
    rows[1].emit("click");
    assert.equal(video.currentTime, 3);

    input.value = "Câu hai đã sửa đúng.";
    input.emit("keydown", { key: "Enter", shiftKey: false });
    await new Promise(r => setTimeout(r, 10));
    assert.deepEqual(saved, [{ start: 2, text: "Câu hai đã sửa đúng.", machine: "Câu hai bị dịch sai." }]);
    assert.equal(video.paused, false, "the video should play on after saving");
    rows = panel.querySelectorAll(".cst-tr-row");
    assert.match(rows[1].textContent, /Câu hai đã sửa đúng\./);
    assert.match(rows[1].textContent, /đã sửa/, "an edited line should be marked");

    // Esc cancels without saving
    rows[1].querySelector(".cst-tr-edit").emit("click");
    const again = rows[1].querySelector(".cst-tr-input");
    assert.ok(panel.querySelectorAll(".cst-tr-act").some(b => b.textContent === "Dùng bản dịch máy"), "an edited line offers the machine text back");
    again.emit("keydown", { key: "Escape" });
    await new Promise(r => setTimeout(r, 10));
    assert.equal(saved.length, 1);
});

test("wiring: loaded before the players, cache keeps the machine text, both sites save and listen", () => {
    const m = JSON.parse(R("manifest.json"));
    const js = m.content_scripts.find(c => c.js.includes("content.js")).js;
    assert.ok(js.indexOf("subtitle-edits.js") > -1 && js.indexOf("subtitle-edits.js") < js.indexOf("transcript.js"));
    assert.ok(/subtitle-edits\.js/.test(R("options.html")), "Settings cannot list the edits");
    const yt = R("youtube.js");
    const cs = R("content.js");
    assert.ok(/c\.cstOrig \? c\.cstOrig\.lines : c\.lines/.test(yt), "the translation cache would store the viewer's edits");
    assert.ok(/g\.cstOrigViText != null \? g\.cstOrigViText : g\.viText/.test(yt));
    for (const [name, src] of [["youtube.js", yt], ["content.js", cs]]) {
        assert.ok(/saveEdit: async/.test(src), `${name}: the panel cannot save`);
        assert.ok(/CST_EDITS\.keyOf\(/.test(src), `${name}: does not listen for edits made elsewhere`);
    }
    assert.ok(/ytApplyEdits\(\);\n\}/.test(yt), "ytGhepViCues must lay edits over newly translated groups");
});
