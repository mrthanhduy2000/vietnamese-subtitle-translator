// Subtitle edits: the viewer's own corrections to a translated line, kept per video and laid over
// the machine translation every time the video is shown. Shared by both players (content.js,
// youtube.js), the transcript panel and the Settings page.
//
// Storage: chrome.storage.local, one key per video, "edits:<videoKey>" ->
//   { title, url, updated, lines: { "<startMs>": { text, orig } } }
// videoKey is currentVideoMeta().videoKey from content.js ("yt:<id>" or a Coursera lecture path).
// A line is found again by its start time, with a small tolerance: a re-translation can move a
// Vietnamese cue by a few milliseconds.
//
// The original machine translation is never lost: the first edit of a cue parks it on the cue as
// cstOrig (and the whole group text as cstOrigViText), so reverting restores it exactly and the
// translation cache keeps storing the machine version.
(function (root) {
    "use strict";

    const PREFIX = "edits:";
    const TOLERANCE = 0.06;            // seconds; cue starts are rounded to 1 ms in the caches
    const HINT = "¦";                  // pause hint the translator leaves in viText (vi-segmenter)

    const keyOf = videoKey => PREFIX + videoKey;
    const msOf = t => String(Math.round(Number(t) * 1000));
    const clean = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

    function storage() {
        try { return root.chrome && root.chrome.storage && root.chrome.storage.local; } catch (e) { return null; }
    }

    async function load(videoKey) {
        const st = storage();
        if (!st || !videoKey) return null;
        try {
            const r = await st.get(keyOf(videoKey));
            return (r && r[keyOf(videoKey)]) || null;
        } catch (e) { return null; }
    }

    // text === orig (or empty) removes the edit: that is a revert, not an edit.
    async function save(videoKey, meta, start, text, orig) {
        const st = storage();
        if (!st || !videoKey) return null;
        const rec = (await load(videoKey)) || { title: "", url: "", lines: {} };
        if (meta && meta.title) rec.title = String(meta.title).slice(0, 120);
        if (meta && meta.url) rec.url = meta.url;
        const t = clean(text);
        const k = msOf(start);
        if (!t || t === clean(orig)) delete rec.lines[k];
        else rec.lines[k] = { text: t, orig: clean(orig) };
        rec.updated = Date.now();
        if (!Object.keys(rec.lines).length) await st.remove(keyOf(videoKey));
        else await st.set({ [keyOf(videoKey)]: rec });
        return rec;
    }

    async function removeLine(videoKey, start) {
        const rec = await load(videoKey);
        if (!rec || !rec.lines[msOf(start)]) return rec;
        return save(videoKey, null, start, "", "");
    }

    async function clearVideo(videoKey) {
        const st = storage();
        if (st && videoKey) await st.remove(keyOf(videoKey));
    }

    // Every video with at least one edit, newest first: [{ videoKey, title, url, updated, lines }]
    async function listAll() {
        const st = storage();
        if (!st) return [];
        let all = {};
        try { all = (await st.get(null)) || {}; } catch (e) { return []; }
        return Object.keys(all).filter(k => k.startsWith(PREFIX))
            .map(k => ({ videoKey: k.slice(PREFIX.length), ...all[k] }))
            .filter(r => r.lines && Object.keys(r.lines).length)
            .sort((a, b) => (b.updated || 0) - (a.updated || 0));
    }

    function editFor(lines, start) {
        if (!lines) return null;
        const exact = lines[msOf(start)];
        if (exact) return exact;
        for (const k of Object.keys(lines)) if (Math.abs(Number(k) / 1000 - start) <= TOLERANCE) return lines[k];
        return null;
    }

    function breakInto(text) {
        const seg = root.CST_VI_SEG;
        return seg && seg.breakLines ? seg.breakLines(text) : [text];
    }

    // Rebuild a group's viText after one of its cues changed. The dubbing planner hands each cue
    // the next N tokens of viText, N = the token count of that cue's text, so the text must stay
    // aligned cue by cue. Untouched cues keep their tokens (and pause hints) as they were.
    function rebuildGroupText(g, prevTexts) {
        const seg = root.CST_VI_SEG;
        if (g.viCues.every(c => !c.cstOrig || c.text === c.cstOrig.text) && g.cstOrigViText != null) {
            g.viText = g.cstOrigViText;               // everything reverted: the exact original
            return;
        }
        if (!seg || !seg.tokenize) { g.viText = g.viCues.map(c => c.text).join(" "); return; }
        const tokens = seg.tokenize(g.viText);
        const out = [];
        let ti = 0;
        g.viCues.forEach((c, k) => {
            const n = seg.tokenize(prevTexts[k]).length;
            const part = tokens.slice(ti, ti + n);
            ti += n;
            if (c.text === prevTexts[k]) out.push(part.map(t => (t.hint ? HINT + " " : "") + t.raw).join(" "));
            else out.push(c.text);
        });
        g.viText = out.filter(Boolean).join(" ");
    }

    function setCue(c, text) {
        if (c.text === text) return false;
        if (!c.cstOrig) c.cstOrig = { text: c.text, lines: (c.lines || [c.text]).slice() };
        if (text === c.cstOrig.text) {
            c.text = c.cstOrig.text;
            c.lines = c.cstOrig.lines.slice();
        } else {
            c.text = text;
            c.lines = breakInto(text);
        }
        c.cstEdited = text !== c.cstOrig.text;
        return true;
    }

    // Lay the stored edits over the live data, and take back any edit that is gone (reverted here or
    // in Settings). groups: what the dubbing reads ({ viText, viCues }); display: what the overlay
    // and the transcript read. On YouTube's live path they share cue objects, on the cache path they
    // do not, so both are walked. Returns the number of cues that changed.
    function sync(rec, { groups = [], display = [] } = {}) {
        const lines = rec && rec.lines;
        const want = c => {
            const e = editFor(lines, c.start);
            return e ? e.text : (c.cstOrig ? c.cstOrig.text : c.text);
        };
        let changed = 0;
        for (const g of groups || []) {
            if (!g || !g.viCues || !g.viCues.length || !g.viText) continue;
            // Re-translated group (the refine pass): fresh cue objects, so the parked original is stale
            if (g.cstOrigViText != null && !g.viCues.some(c => c.cstOrig)) g.cstOrigViText = null;
            const prev = g.viCues.map(c => c.text);
            let touched = false;
            for (const c of g.viCues) if (setCue(c, want(c))) touched = true;
            if (touched) {
                if (g.cstOrigViText == null) g.cstOrigViText = g.viText;
                rebuildGroupText(g, prev);
                changed++;
            }
        }
        for (const c of display || []) if (c && setCue(c, want(c))) changed++;
        return changed;
    }

    // After the text changed under a running page: the voice re-renders only the changed lines
    // (dub-engine drops audio whose text no longer matches), the transcript panel redraws.
    function notify() {
        try { if (root.CST_DUB && root.CST_DUB.refreshText) root.CST_DUB.refreshText(); } catch (e) { /* bỏ qua */ }
        try { if (root.CST_TRANSCRIPT && root.CST_TRANSCRIPT.invalidate) root.CST_TRANSCRIPT.invalidate(); } catch (e) { /* bỏ qua */ }
    }

    const api = { PREFIX, load, save, removeLine, clearVideo, listAll, sync, editFor, keyOf, notify };
    root.CST_EDITS = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
