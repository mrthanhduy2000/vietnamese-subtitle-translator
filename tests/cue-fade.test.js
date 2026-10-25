// subtitle-style.js: fadeInCue, the short fade when a subtitle line changes (YouTube and Coursera overlays).
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../subtitle-style.js");

// Minimal overlay: children are the line blocks, animate() records each call
function overlay(children = []) {
    const calls = [];
    const ov = {
        children: children.map(() => ({ animate: (frames, opts) => { calls.push({ frames, opts }); } })),
        calls
    };
    return ov;
}

test("the first line on an empty overlay is left to the overlay's own fade", () => {
    const ov = overlay([{}]);
    ov.children = [{ animate: () => assert.fail("must not animate the first line") }];
    S.fadeInCue(ov, "Xin chào");
    assert.equal(ov.cstCueKey, "Xin chào");
});

test("a changed line fades in over 160 ms", () => {
    const ov = overlay();
    S.fadeInCue(ov, "line one");
    ov.children = [{ animate: (frames, opts) => ov.calls.push({ frames, opts }) }];
    S.fadeInCue(ov, "line two");
    assert.equal(ov.calls.length, 1);
    assert.equal(ov.calls[0].opts.duration, 160);
    assert.equal(ov.calls[0].frames[0].opacity, 0);
    assert.equal(ov.calls[0].frames[1].opacity, 1);
});

test("a repaint of the same line does not animate again (resize, style change)", () => {
    const ov = overlay();
    S.fadeInCue(ov, "same");
    ov.children = [{ animate: () => assert.fail("same text must not animate") }];
    S.fadeInCue(ov, "same");
});

test("an empty overlay resets the key so the next line is treated as a first line", () => {
    const ov = overlay();
    S.fadeInCue(ov, "a");
    S.fadeInCue(ov, "");
    assert.equal(ov.cstCueKey, "");
    ov.children = [{ animate: () => assert.fail("first line after a gap must not animate") }];
    S.fadeInCue(ov, "b");
});

test("without Web Animations the fade is skipped and nothing throws", () => {
    const ov = overlay();
    S.fadeInCue(ov, "a");
    ov.children = [{}];
    S.fadeInCue(ov, "b");
    assert.equal(ov.cstCueKey, "b");
});

test("the fade keeps the opacity change under reduced motion and drops only the rise", () => {
    const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "subtitle-style.js"), "utf8");
    assert.match(src, /prefersReducedMotion\(\) \? "none" : "translateY/);
    assert.match(src, /\[\{ opacity: 0, transform: rise \}, \{ opacity: 1, transform: "none" \}\]/);
});
