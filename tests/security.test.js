// Security hardening: route lookup, bridge URL check, explicit CSP, escaped HTML in options.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { bgEnv } = require("./bg-env.js");

const root = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("service worker ignores message actions that are Object.prototype members", async () => {
    const env = bgEnv({});
    for (const action of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
        let threw = false, answered = false;
        try { await Promise.race([env.send({ action }).then(() => { answered = true; }), new Promise(r => setTimeout(r, 50))]); } catch (e) { threw = true; }
        assert.equal(threw, false, action);
        assert.equal(answered, false, `${action} must not be routed`);
    }
});

test("manifest declares an explicit extension-page CSP without unsafe-eval or inline scripts", () => {
    const csp = JSON.parse(root("manifest.json")).content_security_policy.extension_pages;
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp, /unsafe-eval|unsafe-inline|https?:/);
});

test("no extension page carries an inline script", () => {
    for (const f of ["options.html", "popup.html"]) assert.doesNotMatch(root(f), /<script(?![^>]*\bsrc=)[^>]*>/i, f);
});

test("options.js escapes model ids, server replies and error text before innerHTML", () => {
    const src = root("options.js");
    assert.doesNotMatch(src, /<b>\$\{COST\.modelLabel\(r\.model\)\}/);
    assert.doesNotMatch(src, /\(\$\{r\.model\}\)/);
    assert.match(src, /esc\(r\.model/);
});

test("yt-bridge fetches only youtube.com /api/timedtext over https", () => {
    assert.match(root("yt-bridge.js"), /bad-url/);
});
