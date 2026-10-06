// 2.4.7: the live paths of the slid-run realignment, run in content.js and youtube.js themselves (not
// read as text), and the review tools' contracts (tools/review.js, tools/regress.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

// rtAi3qa8UtQ at 841 s (the user's 2026-10-05 batch): the second speaker turn of item 0 was answered
// in item 1, every next answer sat one item late, and the last two were merged
const SRC = ["There's many other forms, but the only downfall with all these marketed forms is it's never been shown to be safer or more effective than creatine monohydrate. >> [snorts] >> The other big thing for your viewers is make sure it has Creapure or some form of creatine monohydrate on uh the label and then and that it's also third-party tested. >> Creapure?",
    ">> Creapure is from Germany.", "It has the highest um standard uh of qualification and and um a scrutiny.",
    "And then NSF certified or another third-party certified.", "So those are the three things that I personally would look for."];
const SLID = ["Còn nhiều dạng khác nữa, nhưng nhược điểm duy nhất của tất cả các loại được quảng cáo này là chưa bao giờ chứng minh được chúng an toàn hay hiệu quả hơn creatine monohydrate.",
    "Một điều quan trọng nữa cho khán giả của bạn là hãy đảm bảo trên nhãn có ghi Creapure hoặc một dạng creatine monohydrate nào đó, đồng thời sản phẩm phải được kiểm định bởi bên thứ ba.",
    "Creapure là thương hiệu đến từ Đức.", "Nó đạt tiêu chuẩn chất lượng và quy trình kiểm định khắt khe nhất.",
    "Tiếp theo là chứng nhận NSF hoặc chứng nhận từ bên thứ ba khác. Đó là ba yếu tố mà cá nhân tôi sẽ tìm kiếm."];
const RIGHT = [SLID[0] + " " + SLID[1], SLID[2], SLID[3], "Tiếp theo là chứng nhận NSF hoặc chứng nhận từ bên thứ ba khác.", "Đó là ba yếu tố mà cá nhân tôi sẽ tìm kiếm."];

function pageEnv(onMsg) {
    const noop = () => {};
    const el = () => ({ style: {}, classList: { add: noop, remove: noop, contains: () => false, toggle: noop }, appendChild: noop, addEventListener: noop, setAttribute: noop, removeAttribute: noop });
    const sandbox = {
        console: { log: noop, warn: noop, error: console.error }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number, TextEncoder, crypto: globalThis.crypto,
        location: { href: "https://www.youtube.com/watch?v=t", hostname: "www.youtube.com", pathname: "/watch" },
        document: { readyState: "complete", title: "t", body: el(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], getElementsByTagName: () => [], createElement: el, head: el(), documentElement: el(), addEventListener: noop },
        addEventListener: noop, postMessage: noop, MutationObserver: class { observe() {} disconnect() {} }, alert: noop,
        requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
        chrome: {
            storage: { sync: { get: async d => ({ ...d, costMode: "balanced" }), set: async () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener: noop } },
            runtime: { lastError: null, onMessage: { addListener: noop }, sendMessage: (m, cb) => Promise.resolve(onMsg(m)).then(cb) }
        }
    };
    sandbox.window = sandbox; sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of ["glossary.js", "cst-cache.js", "cost-policy.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js", "youtube.js"]) vm.runInContext(read(f), sandbox);
    return sandbox;
}

test("live translation: a slid window is realigned before the quality check and pays no refine", async () => {
    const msgs = [];
    const env = pageEnv(m => {
        msgs.push(m);
        if (m.action === "translateUnitStore") return { ok: true };
        return { ok: true, engine: "gemini", model: "x", latency: 1, cacheKey: "K", translations: SLID };
    });
    for (let i = 0; i < 60 && !env.state?.reExact; i++) await new Promise(r => setTimeout(r, 5));
    env.__u = SRC;
    env.__s = vm.runInContext("(() => { const s = new CST_CONTEXT.ContextSession({}); s.setUnits(__u); return s; })()", env);
    const r = await vm.runInContext("translateWindow(__s, [0, 1, 2, 3, 4], { realtime: false })", env);
    assert.deepEqual([...r.translations], RIGHT);
    assert.equal(msgs.filter(m => m.action === "translateUnit" && m.refine).length, 0, "a refine was paid for what is mended for free");
});

test("YouTube: a run slid across a window seam is realigned when the second window lands, cues redrawn", async () => {
    const env = pageEnv(() => ({ ok: true }));
    const cues = [[841.535, 861.8], [861.8, 863.386], [863.386, 867.514], [867.514, 870.692], [870.692, 873.28]];
    env.__groups = cues.map(([start, end], k) => ({ start, end, text: SRC[k], srcCues: [{ start, end, text: SRC[k] }] }));
    vm.runInContext("yt.groups = __groups", env);
    // the first window holds items 0-2, the second 3-4: the slide runs over the seam
    vm.runInContext(`ytGanBanDich(__groups, [0, 1, 2], ${JSON.stringify(SLID.slice(0, 3))}, "gemini")`, env);
    vm.runInContext(`ytGanBanDich(__groups, [3, 4], ${JSON.stringify(SLID.slice(3))}, "gemini")`, env);
    const groups = env.__groups;
    assert.deepEqual(groups.map(g => g.viText), RIGHT);
    // each group's cues hold its own text again, inside its own time
    groups.forEach((g, k) => {
        assert.equal(g.viCues.map(c => c.text).join(" ").replace(/\s+/g, " "), RIGHT[k].replace(/\s+/g, " "), `group ${k}`);
        assert.ok(g.viCues.every(c => c.start >= g.start - 1e-6), `group ${k} starts early`);
    });
    // the 1.6 s group no longer carries a 40-word sentence
    assert.equal(groups[1].viText, "Creapure là thương hiệu đến từ Đức.");
    const shown = vm.runInContext("yt.viCues", env);
    assert.ok(shown.length >= 5);
});

test("review tools: the mark is found and rewritten, the regression net names what got worse", () => {
    const MARK_RE = /const REVIEW_MARK = \{ until: (\d+), videos: (\d+) \};[^\n]*/;
    assert.match(read("background.js"), MARK_RE, "tools/review.js --close could not move REVIEW_MARK");
    assert.match(read("tools/review.js"), /const MARK_RE = \/const REVIEW_MARK = \\\{ until: \(\\d\+\), videos: \(\\d\+\) \\\};\[\^\\n\]\*\/;/);
    const REG = require("../tools/regress.js");
    const base = { videos: { a: { spoken: 10, dropped: 0, late: 3, mended: 2 } }, scenarios: { s: { cuts: 0 } } };
    const now = { videos: { a: { spoken: 9, dropped: 0, late: 2, mended: 5 }, b: { spoken: 1 } }, scenarios: { s: { cuts: 1 } } };
    const d = REG.compare(base, now);
    const worse = d.filter(x => x.worse).map(x => `${x.where} ${x.metric}`).sort();
    assert.deepEqual(worse, ["scenarios/s cuts", "videos/a spoken"]);
    assert.ok(d.some(x => x.metric === "late" && !x.worse), "fewer late lines is better");
    assert.ok(d.some(x => x.metric === "mended" && !x.worse), "a repair count is neither");
    assert.ok(d.some(x => x.where === "videos/b" && x.metric === "new"));
    assert.deepEqual(REG.compare(base, base), []);
});
