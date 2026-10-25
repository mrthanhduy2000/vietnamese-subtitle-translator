// Shared design tokens: motion, radius and elevation for the extension pages.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("ui-tokens: defines the motion, radius and elevation scales", () => {
    const css = R("ui-tokens.css");
    for (const name of ["--cst-ease-out", "--cst-ease-spring", "--cst-dur-fast", "--cst-dur-base", "--cst-dur-slow",
        "--cst-radius-sm", "--cst-radius-md", "--cst-radius-lg", "--cst-elev-1", "--cst-elev-2", "--cst-elev-3"]) {
        assert.ok(css.includes(name + ":"), name);
    }
});

test("ui-tokens: reduced motion zeroes the duration tokens and every animation", () => {
    const css = R("ui-tokens.css");
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*--cst-dur-base: 0\.001ms/);
    assert.match(css, /animation-duration: 0\.001ms !important/);
    assert.match(css, /transition-duration: 0\.001ms !important/);
});

test("ui-tokens: colours stay out of the shared file", () => {
    assert.doesNotMatch(R("ui-tokens.css"), /--claude-|#[0-9A-Fa-f]{6}\b/);
});

test("ui-tokens: popup loads the tokens before its own stylesheet", () => {
    const html = R("popup.html");
    assert.ok(html.indexOf('href="ui-tokens.css"') > 0);
    assert.ok(html.indexOf('href="ui-tokens.css"') < html.indexOf('href="popup.css"'));
});
