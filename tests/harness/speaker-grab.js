// Speaker lab grab (docs/TESTING.md "Speaker lab"): run in the page world of a YouTube watch tab
// (the built-in browser's javascript_tool; Control_Chrome's isolated world cannot see the player).
// It takes the video's ".en", ".en-US" and "a.en" caption tracks up to MAX_SEC, with the same
// proof-of-origin token the player itself sent (docs/DANGER.md §pot: a timedtext URL without it
// answers empty), and returns "SUM <id> ... LABDATA<<base64 gzip json>>LABDATA" for
// `node tools/speaker-lab.js extract`. "SKIP" when the video has no ".en-US" track (no named
// transcript to score against), "NOPOT" when the player sent no caption request to copy from.
(async (MAX_SEC) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const id = new URL(location.href).searchParams.get("v");
    const p = document.getElementById("movie_player");
    for (let i = 0; i < 30 && !(p && p.getPlayerResponse && p.getPlayerResponse() && p.getPlayerResponse().videoDetails && p.getPlayerResponse().videoDetails.videoId === id); i++) await sleep(300);
    const r = p.getPlayerResponse();
    const v = document.querySelector("video");
    if (v) v.muted = true;
    const tracks = (((r.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks) || [];
    const want = tracks.filter(t => t.vssId === ".en" || t.vssId === ".en-US" || t.vssId === "a.en");
    if (!want.some(t => t.vssId === ".en-US")) return "SKIP " + id + " no en-US (" + tracks.map(t => t.vssId).join(",") + ")";
    // the player's own caption request carries the token: switch captions on and off until it is sent
    performance.setResourceTimingBufferSize(10000);
    const potUrl = () => performance.getEntriesByType("resource").map(e => e.name)
        .filter(n => n.includes("/api/timedtext") && n.includes("pot=") && n.includes("v=" + id)).pop();
    const b = document.querySelector(".ytp-subtitles-button");
    for (let k = 0; k < 4 && !potUrl(); k++) {
        if (b) { b.click(); await sleep(700); b.click(); }
        await sleep(2000);
    }
    const ent = potUrl();
    if (!ent) return "NOPOT " + id;
    const base = new URL(ent);
    const vd = r.videoDetails || {};
    const out = { id, title: vd.title, channel: vd.author, len: +vd.lengthSeconds, desc: String(vd.shortDescription || "").slice(0, 400), tracks: [] };
    for (const t of want) {
        const u = new URL(t.baseUrl);
        for (const k of ["pot", "potc", "c", "cver", "cplayer", "cos", "cosver", "cplatform", "cbrand", "cbr", "cbrver", "xorb", "xobt", "xovt"]) {
            if (base.searchParams.has(k)) u.searchParams.set(k, base.searchParams.get(k));
        }
        u.searchParams.set("fmt", "json3");
        const txt = await (await fetch(u.toString(), { credentials: "include" })).text();
        if (!txt) { out.tracks.push({ vss: t.vssId, empty: true }); continue; }
        const j = JSON.parse(txt);
        // events as [start, duration] in tenths of a second, and the text
        const ev = (j.events || []).filter(e => e.segs && e.tStartMs / 1000 < MAX_SEC)
            .map(e => [Math.round(e.tStartMs / 100), Math.round((e.dDurationMs || 0) / 100), e.segs.map(s => s.utf8).join("").replace(/\s+/g, " ").trim()])
            .filter(e => e[2]);
        out.tracks.push({ vss: t.vssId, ev });
    }
    const us = out.tracks.find(t => t.vss === ".en-US");
    const names = us && us.ev ? us.ev.filter(e => /^[A-Z][A-Z.'\- ]{2,}(,[^:]{0,60})?:/.test(e[2])).length : 0;
    const cs = new CompressionStream("gzip");
    const w = cs.writable.getWriter();
    w.write(new TextEncoder().encode(JSON.stringify(out)));
    w.close();
    const buf = new Uint8Array(await new Response(cs.readable).arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return "SUM " + id + " " + out.len + "s names=" + names + " " + out.tracks.map(t => t.vss + ":" + (t.ev ? t.ev.length : "empty")).join(",") + " LABDATA<<" + btoa(s) + ">>LABDATA";
})(480);
