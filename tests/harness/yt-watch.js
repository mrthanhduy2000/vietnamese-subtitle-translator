// Live check (docs/TESTING.md "Live measurement in the user's Chrome"): plays one video with dubbing
// as the viewer has it set, its tab muted, and keeps what the engine reports (the data-cst-dub
// snapshot, cstDubDebug) in chrome.storage.local "ytWatch" for tools/ext-storage.js. ?id= the video,
// ?from= the second to start at (60), ?seconds= how long to watch (90). The window is focused: a
// hidden tab's timers are throttled and the engine would not run as it does for a viewer. Paid: a
// video not saved yet is translated, and a conversation's speakers are read once (cached after).
const log = [];
const say = s => { log.push(s); document.getElementById("log").textContent = log.join("\n"); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function waitComplete(tabId, ms) {
    return new Promise(resolve => {
        const t = setTimeout(() => { chrome.tabs.onUpdated.removeListener(on); resolve(false); }, ms);
        const on = (id, info) => { if (id === tabId && info.status === "complete") { clearTimeout(t); chrome.tabs.onUpdated.removeListener(on); resolve(true); } };
        chrome.tabs.onUpdated.addListener(on);
    });
}
const inPage = (tabId, func, args = []) => chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func, args }).then(r => r && r[0] ? r[0].result : null);

(async () => {
    const q = new URLSearchParams(location.search);
    const id = q.get("id");
    const from = Number(q.get("from") || 60), seconds = Number(q.get("seconds") || 90);
    if (!id) { say("no ?id="); document.title = "DONE yt-watch"; return; }
    const win = await chrome.windows.create({ url: `https://www.youtube.com/watch?v=${id}&t=${from}s`, focused: true, left: 40, top: 40, width: 960, height: 640 });
    const tabId = win.tabs[0].id;
    await chrome.tabs.update(tabId, { muted: true });
    await waitComplete(tabId, 30000);
    // the engine writes its snapshot only with this flag, read when dubbing starts: set it, reload
    await inPage(tabId, () => { localStorage.setItem("cstDubDebug", "1"); });
    await chrome.tabs.reload(tabId);
    await waitComplete(tabId, 30000);
    const t0 = Date.now();
    const seen = { lines: {}, speakers: {}, snapshots: 0, last: null, reads: [] };
    try {
        while (Date.now() - t0 < seconds * 1000) {
            await sleep(2000);
            const raw = await inPage(tabId, () => {
                const v = document.querySelector("video");
                if (v && v.paused && !v.ended && document.visibilityState === "visible") v.play().catch(() => {});
                return document.documentElement.getAttribute("data-cst-dub");
            }).catch(() => null);
            if (!raw) continue;
            const snap = JSON.parse(raw);
            seen.snapshots++;
            seen.last = snap;
            for (const p of snap.plans || []) seen.lines[p.id] = p.sp;
            seen.speakers = snap.speakers;
            // each new state of the AI reading of who speaks (dubbing.js readSpeakers)
            const r = snap.speakerRead;
            if (r && !seen.reads.some(x => x.at === r.at)) seen.reads.push(r);
            await chrome.storage.local.set({ ytWatch: { id, at: Date.now(), ...seen } });
            say(`t=${snap.t} spoken=${snap.spoken} dropped=${snap.dropped} errors=${snap.errors} ${JSON.stringify(snap.speakers)} read=${JSON.stringify(r)} lines=${Object.keys(seen.lines).length}`);
        }
    } finally {
        await inPage(tabId, () => { localStorage.removeItem("cstDubDebug"); }).catch(() => {});
        await chrome.windows.remove(win.id).catch(() => {});
        const counts = {};
        for (const sp of Object.values(seen.lines)) counts[sp] = (counts[sp] || 0) + 1;
        say(`lines by voice ${JSON.stringify(counts)}; cast ${JSON.stringify(seen.last && seen.last.voices)}`);
        document.title = "DONE yt-watch";
    }
})();
