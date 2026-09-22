// So sánh thuật toán cũ và mới trên toàn bộ bộ ca kiểm thử.
// Chạy: node tests/compare.js        (thêm --verbose để in từng cue)
const cases = require("./fixtures");
const { evaluate, greedyWrap } = require("./quality");
const seg = require("../vi-segmenter.js");
const legacy = require("./legacy/old-splitter.js");

const verbose = process.argv.includes("--verbose");

function runOld(tc) {
    const parts = legacy.distributeTranslation(tc.vi, tc.src.map(c => c.text));
    return parts.map((p, i) => ({ start: tc.src[i].start, end: tc.src[i].end, text: p, lines: greedyWrap(p) }))
        .filter(c => c.text);
}

function runNew(tc) {
    return seg.segmentGroupSafe(tc.vi, tc.src);
}

let oldTotal = 0, newTotal = 0;
const byType = { old: {}, new: {} };
for (const tc of cases) {
    const o = runOld(tc);
    const n = runNew(tc);
    const io = evaluate(tc, o);
    const inw = evaluate(tc, n);
    oldTotal += io.length;
    newTotal += inw.length;
    io.forEach(x => { byType.old[x.type] = (byType.old[x.type] || 0) + 1; });
    inw.forEach(x => { byType.new[x.type] = (byType.new[x.type] || 0) + 1; });
    console.log(`\n■ ${tc.name}  (cũ: ${io.length} lỗi, mới: ${inw.length} lỗi)`);
    if (verbose || io.length || inw.length) {
        console.log("  CŨ :", o.map(c => c.lines.join(" / ")).join("  ‖  "));
        console.log("  MỚI:", n.map(c => `[${c.start.toFixed(1)}-${c.end.toFixed(1)}] ${c.lines.join(" / ")}`).join("  ‖  "));
    }
    inw.forEach(x => console.log("   ✗ mới:", x.type, x.detail));
}
console.log(`\nTỔNG VI PHẠM  cũ: ${oldTotal}  |  mới: ${newTotal}`);
console.log("Theo loại (cũ):", byType.old);
console.log("Theo loại (mới):", byType.new);
