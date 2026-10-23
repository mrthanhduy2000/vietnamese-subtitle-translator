const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../tools/platform-paths.js");

test("platform paths: the Chrome store follows each OS layout", () => {
    const mac = P.extensionStore("darwin", {}, "/Users/a");
    assert.equal(mac, "/Users/a/Library/Application Support/Google/Chrome/Profile 42/Local Extension Settings/" + P.EXT_ID);
    const win = P.extensionStore("win32", { LOCALAPPDATA: "C:\\Users\\Đàm\\AppData\\Local" }, "C:\\Users\\Đàm");
    assert.equal(win, "C:\\Users\\Đàm\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 42\\Local Extension Settings\\" + P.EXT_ID);
    assert.match(P.extensionStore("win32", {}, "C:\\Users\\a"), /^C:\\Users\\a\\AppData\\Local\\Google/);
    assert.match(P.extensionStore("linux", {}, "/home/a"), /^\/home\/a\/\.config\/google-chrome\/Profile 42/);
    assert.match(P.extensionStore("win32", { CHROME_USER_DATA: "D:\\chrome" }, "C:\\x"), /^D:\\chrome\\Profile 42/);
});

test("platform paths: the VieNeu interpreter is Scripts\\python.exe on Windows", () => {
    assert.equal(P.vieneuPython("win32", {}, "C:\\Users\\a"), "C:\\Users\\a\\VieNeu-TTS\\.venv\\Scripts\\python.exe");
    assert.equal(P.vieneuPython("darwin", {}, "/Users/a"), "/Users/a/VieNeu-TTS/.venv/bin/python");
    assert.equal(P.vieneuPython("win32", { VIENEU_DIR: "D:\\v" }, "C:\\a"), "D:\\v\\.venv\\Scripts\\python.exe");
    assert.equal(P.vieneuPython("win32", { VIENEU_PY: "E:\\py.exe" }, "C:\\a"), "E:\\py.exe");
});

test("platform paths: the temp root works without TMPDIR", () => {
    assert.equal(P.tmpRoot({ TEMP: "C:\\t" }), "C:\\t");
    assert.equal(P.tmpRoot({ TMPDIR: "/x", TEMP: "C:\\t" }), "/x");
});

test("the Windows runner lets a user variable pick the GPU, CPU otherwise", () => {
    const s = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "tools", "vieneu-runner.pyw"), "utf8");
    assert.match(s, /os\.environ\.setdefault\(k, v\)/);
    assert.match(s, /"VIENEU_DEVICE", "cpu"/);
});
