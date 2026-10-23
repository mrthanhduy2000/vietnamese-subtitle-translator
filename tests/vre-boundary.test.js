// vre() rewrites "\b" to a one-sided check next to a letter (fast) and keeps the full unicode boundary
// otherwise. The rewrite must find exactly the matches the full boundary finds.
const test = require("node:test");
const assert = require("node:assert/strict");
const { vre } = require("../vi-quality.js");

const B = "(?:(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}])|(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}]))";
const full = re => new RegExp(re.source.split("\\b").join(B), re.flags.includes("u") ? re.flags : re.flags + "u");
const matches = (re, text) => [...text.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))].map(m => m.index + ":" + m[0]);

// small seeded generator, so a failure repeats
let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)];

const SHAPES = [
    /\btrong thứ tự để\b/i,
    /\b(?:lấy|có) một cái nhìn\b/i,
    /\b(?:được|bị)\b/gi,
    /(?:^|[.!?]\s+)Nó\b/,
    /\b(?:a|b\b)c/i,          // boundary inside an alternative: kept in full form
    /\bx?y\b/i,               // optional first letter: kept in full form
    /\b(?:foo|bar)?baz\b/i,   // optional group: kept in full form
    /\b\d+ điểm\b/i,          // starts with an escape: kept in full form
    /\bcủa nó(?:\s|$)/i,      // no closing boundary
];
const AROUND = ["", " ", "a", "é", "1", ".", ", ", "ư", "_", "(", "Ừ", "-"];
const WORDS = ["trong thứ tự để", "lấy một cái nhìn", "có một cái nhìn", "được", "bị", "Nó", "ac", "bc", "xy", "y", "baz", "foobaz", "12 điểm", "của nó", "x"];

test("vre finds the same matches as the full unicode boundary", () => {
    for (const re of SHAPES) {
        const a = full(re), b = vre(re);
        for (let i = 0; i < 300; i++) {
            const text = pick(AROUND) + pick(WORDS) + pick(AROUND) + (rnd() < 0.4 ? pick(WORDS) + pick(AROUND) : "");
            assert.deepEqual(matches(b, text), matches(a, text), `${re} on ${JSON.stringify(text)}`);
        }
    }
});

test("vre keeps the full boundary where one side is not a plain letter", () => {
    assert.match(vre(/\bx?y\b/i).source, /\(\?<=\[/);
    assert.doesNotMatch(vre(/\btrong thứ tự để\b/i).source, /\(\?<=\[/);
});
