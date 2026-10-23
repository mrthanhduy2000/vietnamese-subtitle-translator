// Offline benchmark of the per-group hot path: vi-segmenter segmentGroupSafe over tests/fixtures.js,
// and vi-quality assess over the same Vietnamese lines. Prints microseconds per call (median of runs).
// Usage: node tools/bench-segmenter.js [rounds=30]
const path = require("node:path");
const root = path.join(__dirname, "..");
const seg = require(path.join(root, "vi-segmenter.js"));
require(path.join(root, "vi-quality.js"));
const Q = globalThis.CST_QUALITY || require(path.join(root, "vi-quality.js"));
const fixtures = require(path.join(root, "tests", "fixtures.js"));
const ROUNDS = Number(process.argv[2]) || 30;
function time(fn) {
    const times = [];
    for (let r = 0; r < ROUNDS; r++) {
        const a = performance.now();
        for (const tc of fixtures) fn(tc);
        times.push((performance.now() - a) * 1000 / fixtures.length);
    }
    return times.sort((x, y) => x - y)[times.length >> 1];
}
const empty = { terms: [], keep: new Set() };
console.table({
    fixtures: fixtures.length,
    "segmentGroupSafe us/call": Number(time(tc => seg.segmentGroupSafe(tc.vi, tc.src)).toFixed(1)),
    "assess us/call": Number(time(tc => Q.assess(tc.src.map(c => c.text).join(" "), tc.vi, empty)).toFixed(1))
});
