// Pages other than YouTube / Coursera: the shared <video> + text-track pipeline, injected only
// when the viewer asks (popup button or shortcut, both grant activeTab). The live check is
// tests/harness/generic.html (case A: <track> element, case B: ?mode=script, addTextTrack only).
const test = require("node:test");
const assert = require("node:assert/strict");
const { bgEnv, read } = require("./bg-env.js");

const iso = () => JSON.parse(read("manifest.json")).content_scripts.find(g => g.world !== "MAIN");

test("a shortcut on an unlisted site injects the content scripts once, then delivers the command", async () => {
    const env = bgEnv(async () => ({ ok: true, json: async () => ({}) }), {});
    const c = env.sandbox.chrome;
    let loaded = false;
    const delivered = [];
    c.tabs.sendMessage = async (id, msg) => { if (!loaded) throw new Error("Could not establish connection"); delivered.push(msg); return { ok: true }; };
    c.scripting.executeScript = async o => {
        env.injected.push(o);
        if (o.func) return [{ result: loaded }];            // the "already injected?" probe
        loaded = true;
        return [];
    };
    await env.commandListeners[0]("bat-tat-phu-de", { id: 9, url: "https://lessons.example.org/video/42" });
    const files = env.injected.filter(o => o.files);
    assert.equal(files.length, 1);
    assert.deepEqual([...files[0].files], iso().js, "the whole ISOLATED group, in manifest order");
    assert.deepEqual(delivered.map(m => m.command), ["bat-tat-phu-de"]);
    // pressed again: the page answers now, nothing is injected twice
    await env.commandListeners[0]("bat-tat-phu-de", { id: 9, url: "https://lessons.example.org/video/42" });
    assert.equal(env.injected.filter(o => o.files).length, 1);
});

test("browser pages that cannot take scripts are left alone", async () => {
    const env = bgEnv(async () => ({ ok: true, json: async () => ({}) }), {});
    env.sandbox.chrome.tabs.sendMessage = async () => { throw new Error("no receiver"); };
    await env.commandListeners[0]("bat-tat-phu-de", { id: 3, url: "chrome://extensions/" });
    assert.equal(env.injected.length, 0);
});

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
    assert.match(cs, /if \(isTrackSite\(site\)\) \{\s*success = await translateTrackSite\(\);/);
    // tracks added with addTextTrack() (no <track> element) are picked up, metadata/chapters are not
    assert.match(cs, /Array\.from\(v\.textTracks \|\| \[\]\)/);
    assert.match(cs, /tt\.kind !== "metadata" && tt\.kind !== "chapters"/);
    // no control bar: a floating button inside a frame laid over the picture
    assert.match(cs, /function csCreateFloatingButton/);
    assert.match(cs, /function csAlignFrame/);
    // native fullscreen: the browser draws the Vietnamese cues, the overlay steps aside
    assert.match(cs, /document\.fullscreenElement === v/);
    // Coursera never auto-translates a generic page; generic never guesses on its own
    assert.match(cs, /if \(getCurrentSite\(\) !== "coursera"\) return null;/);
});

test("cost and edits keys carry the host on generic pages", () => {
    assert.match(read("content.js"), /getCurrentSite\(\) === "generic" \? location\.hostname \+ location\.pathname/);
    assert.match(read("dubbing.js"), /location\.hostname \+ location\.pathname/);
});
