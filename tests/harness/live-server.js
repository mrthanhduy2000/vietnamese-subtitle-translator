// Live playback harness server (manual). Serves the repo for tests/harness/live.html and answers the
// page's runtime messages with the REAL background.js (run through tests/bg-env.js), whose only
// network is the local VieNeu server: every other host is refused here, so no paid API can be called.
//   node tests/harness/live-server.js [port]          then open http://127.0.0.1:8766/tests/harness/live.html
//   node tests/harness/live-server.js 8767 0.9       VieNeu replies held back to RTF 0.9 (BACKLOG 33)
// Needs the VieNeu server (127.0.0.1:8000) and, from Claude's sandbox, loopback allowed.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { bgEnv, ROOT } = require("../bg-env.js");

const PORT = Number(process.argv[2]) || 8766;
const LOCAL = "http://127.0.0.1:8000/";
const SLOW_RTF = Number(process.argv[3] || process.env.SLOW_RTF) || 0;
const seen = { local: 0, refused: [] };

// the only door out of background.js
async function guardedFetch(url, init) {
    const u = String(url && url.url || url);
    if (!u.startsWith(LOCAL)) { seen.refused.push(u); throw new TypeError("live harness: only the local VieNeu server is reachable"); }
    seen.local++;
    const t0 = Date.now();
    const res = await fetch(u, init);
    if (!SLOW_RTF || !u.includes("/v1/audio/speech") || !res.ok) return res;
    const body = new Uint8Array(await res.arrayBuffer());
    const audio = body.length / 2 / 48000;
    const hold = SLOW_RTF * audio * 1000 - (Date.now() - t0);
    if (hold > 0) await new Promise((r, j) => {
        const t = setTimeout(r, hold);
        if (init && init.signal) init.signal.addEventListener("abort", () => { clearTimeout(t); j(Object.assign(new Error("aborted"), { name: "AbortError" })); }, { once: true });
    });
    return new Response(body, { status: res.status, headers: res.headers });
}

const env = bgEnv(guardedFetch, { dubProvider: "vieneu" }, { paidTts: false });

// a 6-minute lecture: the fixture lecture repeated, as tools/playback-sim.js does
function lecture(minutes) {
    const { lectureGroups } = require("../dub-sim.js");
    const base = lectureGroups();
    const span = base[base.length - 1].end + 2;
    const out = [];
    for (let k = 0; out.length === 0 || out[out.length - 1].end < minutes * 60; k++) base.forEach(g => {
        const o = k * span;
        out.push({ ...g, start: g.start + o, end: g.end + o, srcCues: g.srcCues.map(c => ({ ...c, start: c.start + o, end: c.end + o })), viCues: g.viCues.map(c => ({ ...c, start: c.start + o, end: c.end + o })) });
    });
    return out;
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json" };
http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/msg") {
        let body = "";
        req.on("data", c => { body += c; });
        req.on("end", async () => {
            let out;
            try { out = await env.send(JSON.parse(body)); } catch (e) { out = { ok: false, error: String(e && e.message || e) }; }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(out === undefined ? null : out));
        });
        return;
    }
    if (req.url === "/groups.json") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(lecture(7))); return; }
    if (req.url === "/seen.json") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(seen)); return; }
    const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log(`live harness on http://127.0.0.1:${PORT}/tests/harness/live.html${SLOW_RTF ? ` (VieNeu held to RTF ${SLOW_RTF})` : ""}`));
