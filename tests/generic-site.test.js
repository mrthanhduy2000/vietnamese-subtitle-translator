// Pages other than YouTube / Coursera: the shared <video> + text-track pipeline, injected only
// when the viewer asks (the popup button, which grants activeTab). The live check is
// tests/harness/generic.html (case A: <track> element, case B: ?mode=script, addTextTrack only).
const test = require("node:test");
const assert = require("node:assert/strict");
const { bgEnv, read } = require("./bg-env.js");

const iso = () => JSON.parse(read("manifest.json")).content_scripts.find(g => g.world !== "MAIN");

test("no broad host permission: other sites only through activeTab", () => {
    const m = JSON.parse(read("manifest.json"));
    assert.ok(m.permissions.includes("activeTab") && m.permissions.includes("scripting"));
    assert.ok(!m.host_permissions.some(h => h === "<all_urls>" || h === "*://*/*"), "no all-sites permission");
    const popup = read("popup.js");
    assert.match(popup, /\/\^https\?:\/\.test\(tab\.url/, "popup accepts any http(s) tab");
    assert.match(popup, /\(g\.js \|\| \[\]\)\.includes\("content\.js"\)/);
});

test("content.js serves generic pages through the Coursera track path", () => {
    const cs = read("content.js");
    assert.match(cs, /return "generic";/);
    assert.match(cs, /if \(isTrackSite\(site\)\) \{\s*success = await translateTrackSite\((?:opts)?\);/);
    // tracks added with addTextTrack() (no <track> element) are picked up, metadata/chapters are not
    assert.match(cs, /Array\.from\(v\.textTracks \|\| \[\]\)/);
    assert.match(cs, /tt\.kind !== "metadata" && tt\.kind !== "chapters"/);
    // no control bar: a floating button inside a frame laid over the picture
    assert.match(cs, /function csCreateFloatingButton/);
    assert.match(cs, /function csAlignFrame/);
    // native fullscreen: the browser draws the Vietnamese cues, the overlay steps aside
    assert.match(cs, /document\.fullscreenElement === v/);
    // Coursera never auto-translates a generic page; generic never guesses on its own
    assert.match(cs, /if \(getCurrentSite\(\) !== "coursera" && !csAdapterSite\(\)\) return null;/);
});

test("cost and edits keys carry the host on generic pages", () => {
    assert.match(read("content.js"), /getCurrentSite\(\) === "generic" \? location\.hostname \+ location\.pathname/);
    assert.match(read("dubbing.js"), /location\.hostname \+ location\.pathname/);
});
