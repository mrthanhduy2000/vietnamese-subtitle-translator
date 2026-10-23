const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

function lum(hex) {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test("popup text colours that carry a message pass WCAG AA on their cards", () => {
    const css = R("popup.css");
    assert.ok(ratio("#8A5A0C", "#FFFFFF") >= 4.5, "warn line on a light card");
    assert.ok(ratio("#B3281A", "#FDF2F2") >= 4.5, "error text on the error background");
    assert.ok(ratio("#F28B8B", "#3A1D1D") >= 4.5, "error text on the dark error background");
    assert.ok(ratio("#B4573A", "#FFFFFF") >= 4.5, "site name on a light card");
    assert.match(css, /\.now-voice\.warn \{ color: #8A5A0C/);
    assert.doesNotMatch(css, /\.link-btn \{[^}]*opacity: 0\.8/, "faded links lose contrast");
});

test("a toast without a button stays as long as its text takes to read", () => {
    const src = R("content.js").split("function cstToast")[1].split("\nfunction ")[0];
    assert.match(src, /length \* 70/);
    assert.match(src, /opts\.warn[\s\S]*aria-hidden/, "a warning carries a mark, not only a border colour");
});

test("the popup can turn subtitles off and says what is missing before the first click", () => {
    const html = R("popup.html"), js = R("popup.js");
    assert.match(html, /id="stopBtn"[^>]*hidden/);
    assert.match(html, /id="readyHint"[^>]*hidden/);
    assert.match(js, /method: "phimTat", command: "bat-tat-phu-de"/);
    assert.match(js, /localTtsStatus/);
    assert.match(js, /geminiApiKey/);
});

test("Settings keeps no unreachable welcome card and names one autostart file", () => {
    assert.doesNotMatch(R("options.html"), /welcome/i);
    const js = R("options.js");
    assert.match(js, /function autostartSteps/);
    assert.doesNotMatch(js, /\(máy Mac\) hoặc/);
});
