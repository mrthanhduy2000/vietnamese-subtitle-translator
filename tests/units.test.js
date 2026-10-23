// Pure helpers in transcript.js and subtitle-style.js: the paths no other suite reaches.
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../transcript.js");
const S = require("../subtitle-style.js");

test("srt clock: whole milliseconds, never a four-digit fraction", () => {
    assert.equal(T.srtClock(0), "00:00:00,000");
    assert.equal(T.srtClock(1.9996), "00:00:02,000");
    assert.equal(T.srtClock(3661.5), "01:01:01,500");
    assert.equal(T.srtClock(-5), "00:00:00,000");
    assert.equal(T.srtClock(undefined), "00:00:00,000");
});

test("buildSrt: numbers only non-empty cues, bilingual on request", () => {
    const lines = [
        { start: 0, end: 1, vi: "Xin chào", en: "Hello" },
        { start: 1, end: 2, vi: "", en: "" },
        { start: 2, end: 3, vi: "", en: "Only source" },
    ];
    const plain = T.buildSrt(lines);
    assert.match(plain, /^1\n00:00:00,000 --> 00:00:01,000\nXin chào\n/);
    assert.match(plain, /\n2\n00:00:02,000 --> 00:00:03,000\nOnly source\n/);
    assert.doesNotMatch(plain, /Hello/);
    assert.match(T.buildSrt(lines, { keepOriginal: true }), /Xin chào\nHello\n/);
    assert.equal(T.buildSrt(null), "");
});

test("fileName: strips Vietnamese marks and symbols, keeps a fallback", () => {
    assert.equal(T.fileName("Đường đến Việt Nam!"), "Duong-den-Viet-Nam.srt");
    assert.equal(T.fileName(""), "ban-chep-loi.srt");
    assert.equal(T.fileName("???"), "ban-chep-loi.srt");
    assert.ok(T.fileName("a".repeat(200)).length <= 64);
});

test("mergeLines: a source line goes to the one row it overlaps most", () => {
    const vi = [{ start: 0, end: 2, text: "Một" }, { start: 2, end: 4, lines: ["Hai", "ba"] }];
    const src = [
        { start: 1.5, end: 3.5, text: "crossing" },   // 0.5 in row 0, 1.5 in row 1
        { start: 0, end: 1, text: "first" },
        { start: 3, end: 3.5, text: "   " },
    ];
    const out = T.mergeLines(vi, src);
    assert.deepEqual(out.map(r => [r.vi, r.en]), [["Một", "first"], ["Hai ba", "crossing"]]);
    assert.equal(T.mergeLines(vi, src), out, "same arrays return the memoised answer");
    assert.deepEqual(T.mergeLines(null, null), []);
});

test("normalizeStyle: clamps numbers, repairs ids, maps legacy font names", () => {
    const d = S.normalizeStyle();
    assert.deepEqual(d, S.normalizeStyle(S.DEFAULT_STYLE));
    const s = S.normalizeStyle({ fontSize: 9999, bgOpacity: -4, offset: "x", lineHeight: 0, origScale: 1, fontFamily: "Segoe UI", strokeStyle: "nope", pinBottom: "yes", fontWeight: 700 });
    assert.equal(s.fontSize, 300);
    assert.equal(s.bgOpacity, 0);
    assert.equal(s.offset, S.DEFAULT_STYLE.offset);
    assert.equal(s.lineHeight, 1.1);
    assert.equal(s.origScale, 50);
    assert.equal(s.fontFamily, "system");
    assert.equal(s.strokeStyle, S.DEFAULT_STYLE.strokeStyle);
    assert.equal(s.pinBottom, false);
    assert.equal(s.fontWeight, "700");
    assert.equal(S.normalizeStyle({ fontFamily: "unknown font" }).fontFamily, S.DEFAULT_STYLE.fontFamily);
});

test("fontStack and getFont: no duplicate family, unknown id falls back to the first font", () => {
    assert.equal(S.getFont("zzz"), S.FONTS[0]);
    const stack = S.fontStack("be-vietnam-pro");
    assert.equal(stack.split(", ").filter(x => x === '"Be Vietnam Pro"').length, 1);
    assert.match(S.fontStack("system"), /^system-ui/);
    assert.ok(S.FONTS.every(f => S.fontStack(f.id).length > 0 && ["sans", "serif", "mono"].includes(f.kind)));
    assert.equal(S.googleFontsUrl(S.getFont("roboto-mono")), "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@300;400;500;700&display=swap");
});

test("colors: hex forms, shadows per stroke style, transparent background", () => {
    assert.equal(S.hexToRgba("#fff", 0.5), "rgba(255, 255, 255, 0.5)");
    assert.equal(S.hexToRgba("#102030", 1), "rgba(16, 32, 48, 1)");
    assert.equal(S.hexToRgba(undefined, 1), "rgba(0, 0, 0, 1)");
    assert.equal(S.textShadow({ strokeStyle: "none" }), "none");
    for (const k of S.STROKES.map(x => x.id).filter(x => x !== "none")) {
        const sh = S.textShadow({ strokeStyle: k, strokeColor: "#112233" });
        assert.match(sh, /em/, k);
        assert.match(sh, /rgba\(17, 34, 51|#112233/, k);
    }
    assert.equal(S.textShadow({ strokeStyle: "thin" }).split("0 #000000").length - 1, 12);
    assert.equal(S.backgroundColor({ bgOpacity: 0 }), "transparent");
    assert.equal(S.backgroundColor({ bgColor: "transparent" }), "transparent");
    assert.equal(S.backgroundColor({ bgColor: "#000000", bgOpacity: 50 }), "rgba(0, 0, 0, 0.50)");
});

test("sizeFactor and resolveDual", () => {
    assert.equal(S.sizeFactor(100), 0.7);
    assert.ok(Math.abs(S.sizeFactor(200) - 1.4) < 1e-9);
    assert.equal(S.sizeFactor("junk"), 0.7);
    assert.equal(S.resolveDual(null), false);
    assert.equal(S.resolveDual({ dualMode: false, subStyle: { mode: "dual" } }), false);
    assert.equal(S.resolveDual({ subStyle: { mode: "dual" } }), true);
    assert.equal(S.resolveDual({ dualMode: 1 }), true);
});

test("lingerCues: stretches into silence, never past the next cue, idempotent", () => {
    const mk = () => [{ start: 0, end: 1 }, { start: 1.1, end: 2 }, { start: 5, end: 6 }];
    const a = S.lingerCues(mk());
    assert.equal(a[0].end, 1.1, "a 0.1 s blink is bridged");
    assert.equal(a[1].end, 2.7);
    assert.equal(a[2].end, 6.7);
    const again = S.lingerCues(a.map(c => ({ ...c })));
    assert.deepEqual(again.map(c => c.end), a.map(c => c.end));
});

test("fitLines: returns input when it cannot measure, estimates width without a canvas", () => {
    const lines = ["một dòng rất dài ".repeat(6).trim()];
    assert.equal(S.fitLines(lines, lines[0], null), lines);
    assert.equal(S.textWidth("abcd", "16px x", 20), 40);
    const overlay = { style: { fontSize: "20" }, parentElement: { clientWidth: 400 } };
    globalThis.CST_VI_SEG = { breakLines: (t, o) => [`cut@${o.maxLineChars}/${o.maxLines}`] };
    try {
        assert.deepEqual(S.fitLines(lines, lines[0], overlay), ["cut@" + Math.max(12, Math.floor((400 * 0.88 - 26) / 10) - 1) + "/4"]);
        assert.equal(S.fitLines(["ngắn"], "ngắn", overlay)[0], "ngắn", "a short line already fits");
    } finally { delete globalThis.CST_VI_SEG; }
});
