// Transcript panel: the whole talk as text beside the video, in both languages, with the line that
// is playing highlighted. Click a line to jump there, search inside it, export it as .srt.
// Site-independent: each player hands over an adapter (see csTranscriptAdapter in content.js and
// ytTranscriptAdapter in youtube.js). Styling comes from player-ui.js, so the panel follows the
// same light/dark choice as the quick menu.
(function (root) {
    "use strict";

    const GEN = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let open = null;        // { panel, adapter, rows, key, follow, lastRow, timer }

    function el(tag, cls, txt) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (txt != null) e.textContent = txt;
        return e;
    }

    function shortClock(seconds) {
        const s = Math.max(0, seconds || 0);
        return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    }

    // .srt wants hh:mm:ss,mmm
    function srtClock(seconds) {
        const s = Math.max(0, seconds || 0);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.round((s - Math.floor(s)) * 1000);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
    }

    // lines: [{ start, end, vi, en }]. keepOriginal puts the source line under the Vietnamese one.
    function buildSrt(lines, { keepOriginal = false } = {}) {
        const out = [];
        let n = 0;
        for (const l of lines || []) {
            const vi = (l.vi || "").trim();
            const en = (l.en || "").trim();
            const text = keepOriginal && en && vi ? `${vi}\n${en}` : (vi || en);
            if (!text) continue;
            n++;
            out.push(`${n}\n${srtClock(l.start)} --> ${srtClock(l.end)}\n${text}\n`);
        }
        return out.join("\n");
    }

    // Both players hold two lists: the Vietnamese cues we built and the source cues. A row is one
    // Vietnamese cue plus whatever source text overlaps it, so the two columns line up even though
    // the two languages are cut into different numbers of cues.
    function mergeLines(viCues, srcCues) {
        const vi = viCues || [];
        const src = (srcCues || []).slice().sort((a, b) => a.start - b.start);
        const out = [];
        let i = 0;
        for (const c of vi) {
            const text = (c.text || (c.lines || []).join(" ") || "").trim();
            while (i < src.length && src[i].end <= c.start) i++;
            const parts = [];
            for (let k = i; k < src.length && src[k].start < c.end; k++) {
                const t = (src[k].text || "").trim();
                if (t) parts.push(t);
            }
            out.push({ start: c.start, end: c.end, vi: text, en: parts.join(" ") });
        }
        return out;
    }

    function fileName(title) {
        const base = String(title || "")
            .normalize("NFD").replace(/[̀-ͯ]/g, "")
            .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
        return `${base || "ban-chep-loi"}.srt`;
    }

    function download(name, text) {
        const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
    }

    // Rebuilt only when the line count or the search box changes: translation arrives group by
    // group, and rebuilding every tick would throw away the reader's scroll position.
    function buildRows(panel, adapter) {
        const lines = adapter.lines() || [];
        const search = panel.querySelector(".cst-tr-search");
        const needle = ((search && search.value) || "").trim().toLowerCase();
        const key = `${lines.length}|${lines.length ? lines[lines.length - 1].end : 0}|${needle}`;
        if (key === open.key) return;
        open.key = key;
        const list = panel.querySelector(".cst-tr-list");
        const rows = [];
        list.replaceChildren();
        for (const l of lines) {
            const vi = (l.vi || "").trim();
            const en = (l.en || "").trim();
            if (needle && !(vi.toLowerCase().includes(needle) || en.toLowerCase().includes(needle))) continue;
            const row = el("button", "cst-tr-row");
            row.type = "button";
            row.setAttribute("aria-current", "false");   // a screen reader should hear "not this one" too
            row.appendChild(el("span", "cst-tr-time", shortClock(l.start)));
            const body = el("span", "cst-tr-text");
            body.appendChild(el("span", "cst-tr-vi", vi || en));
            if (vi && en) body.appendChild(el("span", "cst-tr-en", en));
            row.appendChild(body);
            row.addEventListener("click", () => {
                const v = adapter.videoEl && adapter.videoEl();
                if (!v) return;
                v.currentTime = Math.max(0, l.start);
                if (v.paused && v.play) v.play().catch(() => {});
            });
            row.cstStart = l.start;
            row.cstEnd = l.end;
            list.appendChild(row);
            rows.push(row);
        }
        open.rows = rows;
        open.lastRow = null;
        if (!rows.length) {
            list.appendChild(el("div", "cst-tr-empty", needle
                ? "Không có dòng nào khớp."
                : "Chưa có lời thoại. Bật phụ đề tiếng Việt rồi chờ dịch."));
        }
    }

    function highlightNow(panel, adapter) {
        const v = adapter.videoEl && adapter.videoEl();
        if (!v || !open.rows) return;
        const t = v.currentTime;
        let now = null;
        for (const r of open.rows) {
            const on = t >= r.cstStart && t < r.cstEnd;
            if (on !== (r.dataset.cstNow === "1")) {
                r.dataset.cstNow = on ? "1" : "0";
                r.setAttribute("aria-current", on ? "true" : "false");
            }
            if (on) now = r;
        }
        // Follow the video, but stop following the moment the reader scrolls by hand
        if (now && open.follow && now !== open.lastRow) {
            open.lastRow = now;
            const list = panel.querySelector(".cst-tr-list");
            if (list && list.scrollTo) {
                const top = (now.offsetTop || 0) - (list.clientHeight || 0) / 2 + (now.clientHeight || 0) / 2;
                list.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
            }
        }
    }

    function close() {
        if (!open) return;
        clearInterval(open.timer);
        open.panel.remove();
        open = null;
    }

    // adapter: { box(), videoEl(), lines(), title?(), dual?(), theme?() }
    function toggle(adapter) {
        const kit = root.CST_PLAYER_UI;
        const box = adapter && adapter.box && adapter.box();
        if (open) { close(); return null; }
        if (!kit || !box) return null;
        kit.napCss(document);

        const panel = el("div", "cst-tr-panel");
        panel.dataset.cstGen = GEN;
        panel.dataset.cstTheme = adapter.theme ? adapter.theme() : "auto";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", "Bản chép lời");

        const head = el("div", "cst-tr-head");
        head.appendChild(el("span", "cst-tr-title", "Bản chép lời"));
        const btnSrt = el("button", "cst-tr-act", "Xuất .srt");
        btnSrt.type = "button";
        btnSrt.title = "Tải về tệp phụ đề .srt";
        const btnClose = el("button", "cst-menu-x", "✕");
        btnClose.type = "button";
        btnClose.setAttribute("aria-label", "Đóng bản chép lời");
        head.appendChild(btnSrt);
        head.appendChild(btnClose);
        panel.appendChild(head);

        const search = el("input", "cst-tr-search");
        search.type = "search";
        search.placeholder = "Tìm trong lời thoại…";
        search.setAttribute("aria-label", "Tìm trong lời thoại");
        panel.appendChild(search);

        const list = el("div", "cst-tr-list");
        panel.appendChild(list);
        box.appendChild(panel);

        open = { panel, adapter, rows: [], key: "", follow: true, lastRow: null, timer: 0 };
        buildRows(panel, adapter);

        search.addEventListener("input", () => buildRows(panel, adapter));
        btnClose.addEventListener("click", close);
        btnSrt.addEventListener("click", () => {
            const lines = adapter.lines() || [];
            if (!lines.length) {
                if (root.CST_UI && root.CST_UI.toast) root.CST_UI.toast("Chưa có lời thoại để xuất.", { warn: true });
                return;
            }
            download(fileName(adapter.title ? adapter.title() : ""),
                buildSrt(lines, { keepOriginal: !!(adapter.dual && adapter.dual()) }));
        });
        list.addEventListener("wheel", () => { open.follow = false; }, { passive: true });
        list.addEventListener("touchmove", () => { open.follow = false; }, { passive: true });
        panel.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); close(); } });

        open.timer = setInterval(() => {
            // the player can tear its own DOM down under us (navigation, theatre mode). A host with
            // no isConnected at all (test harness) reports undefined, which is not "removed".
            if (panel.isConnected === false) { close(); return; }
            buildRows(panel, adapter);
            highlightNow(panel, adapter);
        }, 150);
        return panel;
    }

    root.CST_TRANSCRIPT = { toggle, close, isOpen: () => !!open, buildSrt, srtClock, fileName, mergeLines };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) module.exports = globalThis.CST_TRANSCRIPT;
