// Speaker lab (docs/TESTING.md): sends each caption track prepared in lab-data/speaker-lab-data.js
// (tools/speaker-lab.js --prepare) to the background's analyzeSpeakers, as dubbing.js readSpeakers
// does, and keeps every answer in chrome.storage.local "speakerLab" for tools/speaker-lab.js to
// score (read back with tools/ext-storage.js). ?tag=<name> names the run, ?only=<id.variant>,...
// limits it. A run named in lab-data/speaker-lab-runs.js (SPEAKER_LAB_RUNS[tag]: { system, model,
// variants }) asks with that system prompt or model instead of the extension's own (the background
// takes it from test pages only). Paid: one reading per track not in the cache yet.
// As dubbing.js reads a long video: parts of about `part` lines, each told the speakers found so far
// and who was talking when the part before ended, a part cut off by the token cap going on from where
// its turns end (upTo); one answer with line numbers of the whole track
async function readInParts(x, part, lab, fixed) {
    const n = Math.max(1, Math.ceil(x.lines.length / part));
    // fixed: parts of exactly `part` lines, the last one shorter
    const size = fixed ? part : Math.ceil(x.lines.length / n);
    const out = { ok: true, speakers: [], turns: [], confidence: "high", model: "", fromCache: true, parts: 0, calls: [] };
    const rank = { low: 0, medium: 1, high: 2 };
    for (let from = 0; from < x.lines.length && out.parts < 4 * n + 4;) {
        const last = out.turns.length ? out.turns[out.turns.length - 1].speaker : 0;
        const slice = x.lines.slice(from, from + size);
        const r = await chrome.runtime.sendMessage({
            action: "analyzeSpeakers", lines: slice, roster: out.speakers.map(s => ({ id: s.id, label: s.label, gender: s.gender })),
            last: last ? { id: last } : undefined, videoKey: "lab:" + x.id, videoSec: x.len, videoTitle: x.title,
            lab: lab || (size > 900 ? { maxLines: size } : undefined)
        });
        if (!r || !r.ok) return from ? out : r;
        out.parts++;
        out.calls.push({ from, n: slice.length, upTo: r.upTo || 0, turns: r.turns.length, cache: !!r.fromCache, finish: r.finish || "", out: r.usage ? r.usage.candidatesTokenCount : 0, in: r.usage ? r.usage.promptTokenCount : 0, ...(r.raw ? { raw: r.raw, rawLength: r.rawLength } : {}) });
        const upTo = Number.isInteger(r.upTo) && r.upTo > 0 && r.upTo < slice.length ? r.upTo : slice.length;
        for (const s of r.speakers) if (!out.speakers.some(o => o.id === s.id)) out.speakers.push(s);
        for (const t of r.turns) if (t.line < upTo) out.turns.push({ ...t, line: t.line + from });
        if (rank[r.confidence] < rank[out.confidence]) out.confidence = r.confidence;
        out.model = r.model;
        out.fromCache = out.fromCache && !!r.fromCache;
        from += upTo;
    }
    return out;
}

(async () => {
    const q = new URLSearchParams(location.search);
    const tag = q.get("tag") || "run";
    const only = q.get("only") ? new Set(q.get("only").split(",")) : null;
    const log = document.getElementById("log");
    const run = (window.SPEAKER_LAB_RUNS || {})[tag] || null;
    // run.debug: the extension's own prompt and model, and an unusable answer comes back as it was
    // run.temperature: another sampling temperature than the extension's own
    const lab = run && (run.system || run.model || run.debug || run.temperature != null) ? { system: run.system || "", model: run.model || "", temperature: run.temperature, maxLines: run.part > 900 ? run.part : 0 } : undefined;
    const t0run = Date.now();
    const items = (window.SPEAKER_LAB || []).filter(x => (!only || only.has(x.id + "." + x.variant)) &&
        (!run || !run.variants || run.variants.includes(x.variant)));
    const out = [];
    for (const [k, x] of items.entries()) {
        const t0 = Date.now();
        let r;
        try {
            r = await readInParts(x, (run && run.part) || x.lines.length, lab, !!(run && run.fixed));
        } catch (e) {
            r = { ok: false, reason: "send", error: String(e && e.message || e) };
        }
        const store = (await chrome.storage.local.get("speakerLab")).speakerLab || {};
        store[tag + "|" + x.id + "." + x.variant] = { r, ms: Date.now() - t0, n: x.lines.length, at: Date.now() };
        await chrome.storage.local.set({ speakerLab: store });
        out.push(`${k + 1}/${items.length} ${x.id}.${x.variant} ` + (r && r.ok
            ? `ok ${r.model}${r.fromCache ? " cache" : ""} speakers=${r.speakers.length} turns=${r.turns.length} ${r.confidence}`
            : `FAIL ${JSON.stringify(r)}`) + ` ${Date.now() - t0}ms`);
        log.textContent = out.join("\n");
    }
    log.textContent = out.join("\n") + `\nDONE ${tag}`;
    document.title = `DONE ${tag}`;
})();
