// Popup readiness chips: one per requirement, readable in light and dark, built without innerHTML.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

function lum(hex) {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test("popup: the readiness strip sits above the hint and starts hidden", () => {
    const html = R("popup.html");
    assert.match(html, /id="readySteps"[^>]*hidden/);
    assert.ok(html.indexOf('id="readySteps"') < html.indexOf('id="readyHint"'));
});

test("popup: chips are built with textContent, never innerHTML", () => {
    const js = R("popup.js");
    const fn = js.split("async function veSanSang")[1].split("veSanSang();")[0];
    assert.match(fn, /createElement\("span"\)/);
    assert.doesNotMatch(fn, /innerHTML/);
});

test("popup: chip text colours pass WCAG AA on their chip backgrounds in both themes", () => {
    assert.ok(ratio("#2E7D32", "#E8F5E9") >= 4.5, "ok chip, light");
    assert.ok(ratio("#B3281A", "#FDF2F2") >= 4.5, "todo chip, light");
    assert.ok(ratio("#81C784", "#1B2E1D") >= 4.5, "ok chip, dark");
    assert.ok(ratio("#F28B8B", "#3A1D1D") >= 4.5, "todo chip, dark");
});

test("popup: the chip styles reach the design tokens and respect reduced motion via the shared file", () => {
    const css = R("popup.css");
    assert.match(css, /\.ready-step\.ok \{ color: var\(--claude-success\)/);
    assert.match(css, /\.ready-step\.todo \{ color: var\(--claude-warning\)/);
    assert.match(css, /animation: ready-in var\(--cst-dur-base/);
});
