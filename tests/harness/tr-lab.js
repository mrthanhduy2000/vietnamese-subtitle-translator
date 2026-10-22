// Translation lab (2.7.1, docs/TESTING.md): the same windows of saved videos translated twice through
// the real service worker (translateUnit), once per variant of the request context, so a prompt
// rule is judged on the same lines. ?ids=a,b (saved ytcache4_ videos) &win=4 (groups a window)
// &max=12 (windows a video) &tag=run &rule=selfRef. Each variant walks the video in order with a
// ContextSession of its own (context-engine.js), so it carries its own previous translation, as a
// real run does. Variant "a" is the request without the rule's field, "b" with it (2.7.4: selfRef,
// the speaker's pronoun; 2.7.1 tried "unpunctuated", since removed). The tag goes into the topic, so
// both variants miss the cache and are fresh answers. Results land in chrome.storage.local
// trLab_<tag>: { [id]: [{ i, src: [..], a: [..], b: [..], hint }] } (&add=register:talk tries a line the
// session does not make: b only), read back with
// tools/ext-storage.js. Paid: two Gemini calls a window; a rerun of the same tag is free.
const log = [];
const say = s => { log.push(s); document.getElementById("log").textContent = log.join("\n"); };

(async () => {
    const q = new URLSearchParams(location.search);
    const ids = (q.get("ids") || "").split(",").map(s => s.trim()).filter(Boolean);
    const win = Math.max(1, Number(q.get("win")) || 4);
    const max = Math.max(1, Number(q.get("max")) || 12);
    const tag = q.get("tag") || "run";
    const rule = q.get("rule") || "selfRef";
    // &add=field:value puts a field the session does not make into variant b only (a prompt line on trial)
    const add = (q.get("add") || "").split(":");
    const out = {};
    for (const id of ids) {
        const key = "ytcache4_" + id;
        const saved = (await chrome.storage.local.get(key))[key];
        if (!saved || !saved.g) { say(`${id} not saved`); continue; }
        const units = saved.g.map(g => g[3].map(c => c[2]).join(" ").replace(/\s+/g, " ").trim());
        const session = () => { const s = new CST_CONTEXT.ContextSession({ title: `lab ${tag}` }); s.setUnits(units); return s; };
        const sa = session(), sb = session();
        out[id] = [];
        for (let w = 0, n = 0; w < units.length && n < max; w += win, n++) {
            const idxs = units.slice(w, w + win).map((_, k) => w + k);
            const ask = (s, keep) => {
                const req = s.buildRequest(idxs);
                if (!keep) delete req.context[rule];
                else if (add[0]) req.context[add[0]] = add.slice(1).join(":");
                req.context.topic = `${req.context.topic || ""} #${tag}`;      // fresh answers for both
                return chrome.runtime.sendMessage({ action: "translateUnit", sentences: req.sentences, context: req.context,
                    tier: "cheap", videoKey: "lab:" + id, videoTitle: "translation lab " + tag }).then(r => ({ r, hint: req.context[rule] }));
            };
            const [a, b] = await Promise.all([ask(sa, false), ask(sb, true)]);
            if (a.r && a.r.translations) sa.record(idxs, a.r);
            if (b.r && b.r.translations) sb.record(idxs, b.r);
            out[id].push({ i: w, src: idxs.map(i => units[i]), a: (a.r && a.r.translations) || [], b: (b.r && b.r.translations) || [], ea: a.r && a.r.engine, eb: b.r && b.r.engine, hint: b.hint || "" });
            say(`${id} window ${n + 1}: ${a.r && a.r.engine} / ${b.r && b.r.engine} ${b.hint || ""}`);
        }
        await chrome.storage.local.set({ ["trLab_" + tag]: out });
    }
    document.title = "DONE tr-lab";
    say("done");
})();
