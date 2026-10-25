const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// WCAG 2.x relative luminance and contrast ratio for #RRGGBB colours
const lum = hex => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

// Pull the custom properties of one block out of the stylesheet, by its selector text
const block = (css, selector) => {
    const start = css.indexOf(selector + " {");
    assert.ok(start >= 0, `block ${selector} exists`);
    const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
    return Object.fromEntries([...body.matchAll(/(--tc-[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
};

const css = R("theme-colors.css");
const light = block(css, ":root,\n:root:not([data-theme=\"dark\"])");
const dark = block(css, ":root[data-theme=\"dark\"]");

test("theme-colors: light and dark define the same token names", () => {
    assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
});

test("theme-colors: every text token passes WCAG AA on its background (light and dark)", () => {
    const pairs = [
        ["light", light, "--tc-success", "--tc-success-bg"],
        ["light", light, "--tc-warning", "--tc-warning-bg"],
        ["light", light, "--tc-danger", "--tc-danger-bg"],
        ["light", light, "--tc-accent-text", "#FFFFFF"],
        ["light", light, "--tc-accent-fill-text", "--tc-accent-fill"],
        ["dark", dark, "--tc-success", "--tc-success-bg"],
        ["dark", dark, "--tc-warning", "--tc-warning-bg"],
        ["dark", dark, "--tc-danger", "--tc-danger-bg"],
        ["dark", dark, "--tc-accent-text", "#1E1C19"],
        ["dark", dark, "--tc-accent-fill-text", "--tc-accent-fill"],
    ];
    for (const [mode, tokens, fg, bg] of pairs) {
        const f = tokens[fg], b = bg.startsWith("--") ? tokens[bg] : bg;
        assert.ok(ratio(f, b) >= 4.5, `${mode} ${fg} on ${bg}: ${ratio(f, b).toFixed(2)}:1`);
    }
});

test("theme-colors: focus ring keeps 3:1 against the page (non-text contrast)", () => {
    assert.ok(ratio(light["--tc-focus"], "#F2EFE8") >= 3);
    assert.ok(ratio(dark["--tc-focus"], "#2A2723") >= 3);
});

test("theme-colors: both pages load it before their own styles", () => {
    for (const page of ["popup.html", "options.html"]) {
        const html = R(page);
        const at = html.indexOf('href="theme-colors.css"');
        assert.ok(at > 0, `${page} links theme-colors.css`);
    }
});
