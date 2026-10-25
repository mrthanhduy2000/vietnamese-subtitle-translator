const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("the settings page shows Gemini and VieNeu readiness as chips that jump to their tab", () => {
    const html = R("options.html");
    assert.match(html, /id="readyGemini"[^>]*data-goto="navtab-tab-gemini"/);
    assert.match(html, /id="readyVieneu"[^>]*data-goto="navtab-tab-dubbing"/);
    assert.ok(html.includes('id="navtab-tab-gemini"') && html.includes('id="navtab-tab-dubbing"'), "the jump targets exist");
});

test("a Gemini chip turns green only for the key that passed the last check", () => {
    const js = R("options.js");
    assert.match(js, /geminiTest = \{ key, ok: !!\(r && r\.ok\) \};/);
    assert.match(js, /geminiTest\.key === key/, "a changed key falls back to 'chưa kiểm tra'");
    assert.match(js, /geminiKeyInput\?\.addEventListener\("input", renderReadiness\)/);
});

test("the VieNeu chip follows the server check and starts pending", () => {
    const js = R("options.js");
    assert.match(js, /vieneuRunning = running;\s*renderReadiness\(\);/);
    assert.match(R("options.html"), /data-state="pending"/);
});

test("the readiness state is in the text, and motion respects reduced-motion", () => {
    const html = R("options.html");
    assert.match(html, /\.ready-chip\[data-state="pending"\] \.ready-dot \{ animation: ready-pulse/);
    assert.match(html, /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: \.001ms/);
    assert.match(html, /\.ready-chip\[data-state="err"\] \.ready-dot \{ background: #b3281a/, "the error dot is the only fixed colour");
});
