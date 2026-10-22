// Translation lab (2.7.1, docs/TESTING.md): the same windows of saved videos translated twice through
// the real service worker (translateUnit), once per variant of the request context, so a prompt
// rule is judged on the same lines. ?ids=a,b (saved ytcache4_ videos) &win=4 (groups a window)
// &max=12 (windows a video) &tag=run. Variant "a" is the request as before, "b" adds
// context.unpunctuated (the machine-caption rule). Results land in chrome.storage.local trLab_<tag>:
// { [id]: [{ i, src: [..], a: [..], b: [..] }] }, read back with tools/ext-storage.js. Paid: two
// Gemini calls a window (each variant has its own cache key); a rerun of the same tag is free.
const log = [];
const say = s => { log.push(s); document.getElementById("log").textContent = log.join("\n"); };

(async () => {
    const q = new URLSearchParams(location.search);
    const ids = (q.get("ids") || "").split(",").map(s => s.trim()).filter(Boolean);
    const win = Math.max(1, Number(q.get("win")) || 4);
    const max = Math.max(1, Number(q.get("max")) || 12);
    const tag = q.get("tag") || "run";
    const out = {};
    for (const id of ids) {
        const key = "ytcache4_" + id;
        const saved = (await chrome.storage.local.get(key))[key];
        if (!saved || !saved.g) { say(`${id} not saved`); continue; }
        const units = saved.g.map(g => g[3].map(c => c[2]).join(" ").replace(/\s+/g, " ").trim());
        out[id] = [];
        for (let w = 0, n = 0; w < units.length && n < max; w += win, n++) {
            const idxs = units.slice(w, w + win);
            const context = {
                topic: "", domain: "Đời sống",
                prevSource: units.slice(Math.max(0, w - 2), w).join(" ").slice(-400),
                nextSource: units.slice(w + win, w + win + 2).join(" ").slice(0, 240)
            };
            const ask = extra => chrome.runtime.sendMessage({ action: "translateUnit", sentences: idxs, context: { ...context, ...extra },
                tier: "cheap", videoKey: "lab:" + id, videoTitle: "translation lab " + tag });
            const [a, b] = await Promise.all([ask({}), ask({ unpunctuated: true })]);
            out[id].push({ i: w, src: idxs, a: (a && a.translations) || [], b: (b && b.translations) || [], ea: a && a.engine, eb: b && b.engine });
            say(`${id} window ${n + 1}: ${a && a.engine} / ${b && b.engine}`);
        }
        await chrome.storage.local.set({ ["trLab_" + tag]: out });
    }
    document.title = "DONE tr-lab";
    say("done");
})();
