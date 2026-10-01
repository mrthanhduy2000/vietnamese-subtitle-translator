// Headless Chrome runner for the harness pages (manual). Serves the repo root on a free loopback port,
// opens PAGE in a fresh headless Chrome (own profile, autoplay allowed), evaluates EXPR, then evaluates
// POLL every 2 s until it returns an object with `done`, and prints that object. Real Chrome media
// (start-up, time-stretch, volume steps) without the user's browser; see docs/TESTING.md.
//   PAGE=tests/harness/smooth.html EXPR='runSmooth(60)' POLL='summary()' node tests/harness/headless.js
//   CPU=6 ...            DevTools CPU throttling of the renderer (x6)
//   CHROME=<binary> ...  another Chrome (default: the macOS app)
// From Claude's sandbox: run with the sandbox off (listening on loopback is refused inside it).
const fs = require("fs");
const path = require("path");
const http = require("http");
const os = require("os");
const { spawn } = require("child_process");

const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, "..", ".."));
const { PAGE, EXPR, POLL } = process.env;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".wav": "audio/wav", ".vtt": "text/vtt" };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    if (!PAGE || !EXPR || !POLL) throw new Error("PAGE, EXPR and POLL are required (see the header)");
    const srv = http.createServer((req, res) => {
        const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
        if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-store" });
        fs.createReadStream(p).pipe(res);
    });
    await new Promise(r => srv.listen(0, "127.0.0.1", r));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cst-headless-"));
    const chrome = spawn(CHROME, ["--headless=new", `--user-data-dir=${profile}`, "--remote-debugging-port=0",
        "--autoplay-policy=no-user-gesture-required", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
        "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
    // Chrome writes the DevTools port it picked into the profile
    let devPort;
    for (let i = 0; i < 100 && !devPort; i++) {
        await wait(200);
        try { devPort = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch (e) { /* not yet */ }
    }
    if (!devPort) throw new Error("Chrome did not start: " + CHROME);
    const targets = await (await fetch(`http://127.0.0.1:${devPort}/json/list`)).json();
    const ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener("open", r));
    let lastId = 0;
    const pending = new Map();
    ws.addEventListener("message", e => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise(r => { const id = ++lastId; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => {
        const m = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
        if (m.result && m.result.exceptionDetails) throw new Error(JSON.stringify(m.result.exceptionDetails).slice(0, 800));
        return m.result && m.result.result && m.result.result.value;
    };
    await send("Page.enable");
    await send("Runtime.enable");
    if (process.env.CPU) await send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU) });
    await send("Page.navigate", { url: `http://127.0.0.1:${srv.address().port}/${PAGE}` });
    await wait(2000);
    console.log("start:", JSON.stringify(await evaluate(EXPR)));
    let result = null;
    for (let i = 0; i < 900 && !(result && result.done); i++) {
        await wait(2000);
        result = await evaluate(POLL);
    }
    console.log(JSON.stringify(result));
    ws.close();
    await new Promise(r => { chrome.once("exit", r); chrome.kill(); });
    srv.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* left in the temp dir */ }
    process.exit(result && result.done ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
