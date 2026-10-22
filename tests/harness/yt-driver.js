// YouTube driver (docs/TESTING.md "Fresh translations"): has the extension translate whole videos the
// way a viewer's playback would, so a session can measure real translations of new videos
// (ytcache4_<id>, read back with tools/ext-storage.js). Each video of ?ids=a,b,c plays in a window
// of its own (shown once, then the focus goes back; the video stays audible to Chrome), its tab muted, at ?rate= (4), paused just
// before its end (no autoplay into the next video). youtube.js translates only around the playhead
// and saves a video once every group is translated; a group passed untranslated is picked up by a
// second pass from the start. Dubbing is off while it runs (the sync setting dubEnabled, put back
// at the end, or when this page is opened again after an interruption). Paid: the translation of
// every video not yet saved (?again re-translates nothing: a saved video is skipped).
const log = [];
const say = s => { log.push(s); document.getElementById("log").textContent = log.join("\n"); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function waitKey(key, ms) {
    return new Promise(resolve => {
        let timer = null;
        const on = (changes, area) => {
            if (area === "local" && changes[key] && changes[key].newValue) { finish(true); }
        };
        const finish = ok => { clearTimeout(timer); chrome.storage.onChanged.removeListener(on); resolve(ok); };
        chrome.storage.onChanged.addListener(on);
        timer = setTimeout(() => finish(false), ms);
        chrome.storage.local.get(key).then(v => { if (v[key]) finish(true); });
    });
}

function waitComplete(tabId, ms) {
    return new Promise(resolve => {
        const t = setTimeout(() => { chrome.tabs.onUpdated.removeListener(on); resolve(false); }, ms);
        const on = (id, info) => { if (id === tabId && info.status === "complete") { clearTimeout(t); chrome.tabs.onUpdated.removeListener(on); resolve(true); } };
        chrome.tabs.onUpdated.addListener(on);
    });
}

// In the page's own world: keep the video fast and playing, from `from` seconds, and stop it 1.5 s
// before its end. Returns the duration once known. The element is NOT muted (its volume is left to
// YouTube, which saves it; the tab is muted, so nothing is heard): Chrome slows a muted video in a hidden tab (~70 s of video in
// 3 min, 2026-10-22, the user working in another window) and the pass ran out; audible media
// plays on at its rate when the window is covered
function drive(rate, from) {
    if (window.__cstDrive) clearInterval(window.__cstDrive);
    let started = false;
    const tick = () => {
        const v = document.querySelector("video");
        if (!v || !Number.isFinite(v.duration) || !v.duration) return;
        if (v.muted) v.muted = false;
        if (!started) { started = true; if (from != null) v.currentTime = from; }
        // a hidden tab runs this tick about once a second, 4 s of video at 4x: stop early enough
        // that YouTube's autoplay never takes the tab to another video (2026-10-22)
        if (v.currentTime > v.duration - Math.max(1.5, rate * 2.5)) { if (!v.paused) v.pause(); return; }
        if (v.playbackRate !== rate) v.playbackRate = rate;
        if (v.paused) v.play().catch(() => {});
    };
    window.__cstDrive = setInterval(tick, 500);
    tick();
    const v = document.querySelector("video");
    return v && Number.isFinite(v.duration) ? v.duration : 0;
}

async function durationOf(tabId) {
    for (let i = 0; i < 40; i++) {
        const [r] = await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: () => { const v = document.querySelector("video"); return v && Number.isFinite(v.duration) ? v.duration : 0; } });
        if (r && r.result) return r.result;
        await sleep(500);
    }
    return 0;
}

async function hasUploadedVi(tabId) {
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: () => {
        try {
            const pr = document.querySelector("#movie_player").getPlayerResponse();
            const c = pr.captions && pr.captions.playerCaptionsTracklistRenderer;
            return ((c && c.captionTracks) || []).some(t => /^vi/.test(t.languageCode) && t.kind !== "asr");
        } catch (e) { return false; }
    } }).catch(() => [null]);
    return !!(r && r.result);
}

(async () => {
    const q = new URLSearchParams(location.search);
    const ids = (q.get("ids") || "").split(",").map(s => s.trim()).filter(Boolean);
    const rate = Math.max(1, Math.min(8, Number(q.get("rate")) || 4));
    // an interrupted run left dubbing off: put it back first
    const left = (await chrome.storage.local.get("ytDriverDub")).ytDriverDub;
    if (left && left.restore) {
        await chrome.storage.sync.set({ dubEnabled: left.value });
        await chrome.storage.local.remove("ytDriverDub");
        say(`dubbing put back to ${left.value} (left by an interrupted run)`);
    }
    if (!ids.length) { say("no ?ids="); document.title = "DONE yt-driver"; return; }
    const before = (await chrome.storage.sync.get("dubEnabled")).dubEnabled;
    await chrome.storage.local.set({ ytDriverDub: { restore: true, value: before !== false } });
    await chrome.storage.sync.set({ dubEnabled: false });
    say(`dubbing off for the run (was ${before !== false}); ${ids.length} videos at ${rate}x`);
    try {
        for (const [k, id] of ids.entries()) {
            const key = "ytcache4_" + id;
            if ((await chrome.storage.local.get(key))[key]) { say(`${k + 1}/${ids.length} ${id} already saved`); continue; }
            const t0 = Date.now();
            // Shown once (Chrome defers media in a tab never shown), then the viewer's window gets
            // the focus back as soon as the video plays: the run no longer needs to stay in front
            const back = await chrome.windows.getLastFocused().catch(() => null);
            const win = await chrome.windows.create({ url: `https://www.youtube.com/watch?v=${id}`, focused: true, left: 40, top: 40, width: 960, height: 640 });
            const tabId = win.tabs[0].id;
            await chrome.tabs.update(tabId, { muted: true });
            await waitComplete(tabId, 30000);
            let dur = await durationOf(tabId);
            // An uploaded Vietnamese track is shown as is and never saved (by design): playing it
            // twice to the save timeout cost 700-1100 s per video on a long-vlog batch (2026-10-23)
            if (await hasUploadedVi(tabId)) {
                await chrome.windows.remove(win.id).catch(() => {});
                if (back && back.id !== win.id && back.type === "normal") await chrome.windows.update(back.id, { focused: true }).catch(() => {});
                say(`${k + 1}/${ids.length} ${id} skipped: uploaded Vietnamese track`);
                continue;
            }
            if (back && back.id !== win.id && back.type === "normal") await chrome.windows.update(back.id, { focused: true }).catch(() => {});
            let ok = false;
            for (let pass = 0; pass < 2 && !ok; pass++) {
                await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: drive, args: [rate, pass ? 0 : null] });
                // a player slow to load (the first window after a reload, 2026-10-23) had no duration
                // yet: the pass waited the 60 s floor and the video was logged "0 s, NOT SAVED"
                if (!dur) dur = await durationOf(tabId);
                ok = await waitKey(key, Math.max(60000, (dur / rate + 90) * 1000));
                if (!ok) say(`   ${id} pass ${pass + 1} ended without a save`);
            }
            if (ok) await sleep(4000);       // a refine landing just after the save writes it again
            await chrome.windows.remove(win.id).catch(() => {});
            say(`${k + 1}/${ids.length} ${id} ${ok ? "saved" : "NOT SAVED"} (${Math.round(dur)} s of video, ${Math.round((Date.now() - t0) / 1000)} s)`);
        }
    } finally {
        await chrome.storage.sync.set({ dubEnabled: before !== false });
        await chrome.storage.local.remove("ytDriverDub");
        say(`dubbing put back to ${before !== false}`);
        document.title = "DONE yt-driver";
    }
})();
