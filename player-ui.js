// Shared player UI: the product mark, the control-bar button and the quick-menu stylesheet.
// Both players draw from here, so the button on YouTube and the button on Coursera cannot drift
// apart again. Loaded before content.js and youtube.js (see manifest.json).
(function (root) {
    "use strict";

    // The product mark, drawn inline where we own the container (menu header, popup, Settings).
    const MARK_SVG = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" aria-hidden="true" focusable="false">
        <path d="M4.2 4.6h15.6c1.55 0 2.8 1.25 2.8 2.8v7.9c0 1.55-1.25 2.8-2.8 2.8h-6.6l-4.3 3.2c-.62.46-1.5.02-1.5-.75V18.1H4.2c-1.55 0-2.8-1.25-2.8-2.8V7.4c0-1.55 1.25-2.8 2.8-2.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path>
        <g transform="translate(12 11.35) scale(0.42) translate(-12 -12)">
            <path d="M12 2C12.4 7.2 16.8 11.6 22 12C16.8 12.4 12.4 16.8 12 22C11.6 16.8 7.2 12.4 2 12C7.2 11.6 11.6 7.2 12 2Z" fill="currentColor"></path>
        </g>
    </svg>`;

    // The same mark inside a speech bubble, for the button that sits in a player's control bar.
    // It is painted as a background image: measured on a real YouTube page, their stylesheet
    // computes an inline <svg> inside .ytp-button to width 0 and the button goes blank.
    const BTN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
        <path d="M4.2 4.6h15.6c1.55 0 2.8 1.25 2.8 2.8v7.9c0 1.55-1.25 2.8-2.8 2.8h-6.6l-4.3 3.2c-.62.46-1.5.02-1.5-.75V18.1H4.2c-1.55 0-2.8-1.25-2.8-2.8V7.4c0-1.55 1.25-2.8 2.8-2.8Z" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
        <g transform="translate(12 11.35) scale(0.42) translate(-12 -12)">
            <path d="M12 2C12.4 7.2 16.8 11.6 22 12C16.8 12.4 12.4 16.8 12 22C11.6 16.8 7.2 12.4 2 12C7.2 11.6 11.6 7.2 12 2Z" fill="#FFFFFF"/>
        </g>
    </svg>`;
    const BTN_ICON_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(BTN_ICON_SVG)}`;

    const MENU_CSS = `
/* One visual language across the three surfaces: the popup, the Settings page and this menu.
   The tokens mirror popup.css; light or dark follows the uiTheme setting (auto = the machine). */
.cst-yt-menu {
    --cst-bg:rgba(31,30,27,.975); --cst-card:#282622; --cst-card-hover:#312E2A; --cst-soft:#23211E;
    --cst-text:#ECE8E1; --cst-text-2:#A8A39A; --cst-muted:#78736B;
    --cst-border:#3A3732; --cst-border-2:#48453F;
    --cst-accent:#D97757; --cst-accent-hover:#E08567; --cst-accent-soft:#33241F;
    --cst-accent-shadow:rgba(217,119,87,.35); --cst-warn:#E8B84B;
    --cst-shadow:0 18px 46px rgba(0,0,0,.55);
    --cst-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    --cst-serif:"Newsreader","Tiempos Headline","Iowan Old Style",Charter,Georgia,serif;
}
.cst-yt-menu[data-cst-theme="light"], .cst-yt-menu[data-cst-theme="auto"] {
    --cst-bg:rgba(250,249,245,.985); --cst-card:#FFFFFF; --cst-card-hover:#F2EFE8; --cst-soft:#F6F4EE;
    --cst-text:#262420; --cst-text-2:#6B665E; --cst-muted:#969086;
    --cst-border:#E8E4DC; --cst-border-2:#DDD8CE;
    --cst-accent:#D97757; --cst-accent-hover:#C56646; --cst-accent-soft:#FAF1EC;
    --cst-accent-shadow:rgba(217,119,87,.22); --cst-warn:#B4791C;
    --cst-shadow:0 18px 46px rgba(38,36,32,.28);
}
@media (prefers-color-scheme: dark) {
    .cst-yt-menu[data-cst-theme="auto"] {
        --cst-bg:rgba(31,30,27,.975); --cst-card:#282622; --cst-card-hover:#312E2A; --cst-soft:#23211E;
        --cst-text:#ECE8E1; --cst-text-2:#A8A39A; --cst-muted:#78736B;
        --cst-border:#3A3732; --cst-border-2:#48453F;
        --cst-accent:#D97757; --cst-accent-hover:#E08567; --cst-accent-soft:#33241F;
        --cst-accent-shadow:rgba(217,119,87,.35); --cst-warn:#E8B84B;
        --cst-shadow:0 18px 46px rgba(0,0,0,.55);
    }
}
.cst-yt-menu { position:absolute; bottom:58px; right:12px; width:312px; max-height:min(72%,462px); overflow-y:auto;
    background:var(--cst-bg); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
    border:1px solid var(--cst-border); border-radius:16px; padding:12px;
    box-shadow:var(--cst-shadow); color:var(--cst-text); font:13px/1.45 var(--cst-sans);
    z-index:1000; user-select:none; }
.cst-yt-menu * { box-sizing:border-box; }
.cst-menu-head { display:flex; align-items:center; gap:9px; padding:1px 2px 11px; }
.cst-menu-mark { flex-shrink:0; width:24px; height:24px; border-radius:8px; background:var(--cst-accent);
    display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px var(--cst-accent-shadow); }
.cst-menu-mark svg { width:15px; height:15px; display:block; }
.cst-menu-title { flex:1; font-family:var(--cst-serif); font-size:15.5px; font-weight:500; letter-spacing:-.2px; color:var(--cst-text); }
.cst-menu-x { background:none; border:none; color:var(--cst-muted); font-size:14px; line-height:1; cursor:pointer;
    padding:5px 7px; border-radius:8px; transition:background-color .18s ease,color .18s ease; }
.cst-menu-x:hover { color:var(--cst-text); background:var(--cst-card-hover); }
.cst-row { display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:10px 12px;
    border:1px solid var(--cst-border); border-radius:12px; background:var(--cst-card); color:var(--cst-text);
    font:inherit; cursor:pointer; margin-bottom:8px; transition:background-color .18s ease,border-color .18s ease; }
.cst-row:hover { background:var(--cst-card-hover); border-color:var(--cst-border-2); }
.cst-row[aria-disabled="true"] { opacity:.55; cursor:default; }
.cst-row-label { flex:1; font-weight:500; font-size:13px; }
.cst-row-sub { display:block; font-weight:400; font-size:11.5px; color:var(--cst-text-2); margin-top:3px; }
.cst-kbd { flex-shrink:0; font-family:var(--cst-sans); font-size:10.5px; color:var(--cst-text-2);
    border:1px solid var(--cst-border); background:var(--cst-soft); border-radius:4px; padding:2px 6px; }
.cst-sw { flex-shrink:0; width:36px; height:20px; border-radius:999px; background:var(--cst-border-2);
    position:relative; transition:background-color .22s cubic-bezier(.16,1,.3,1); }
.cst-sw::after { content:""; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%;
    background:#FFFFFF; box-shadow:0 1px 3px rgba(0,0,0,.18); transition:transform .25s cubic-bezier(.34,1.56,.64,1); }
.cst-row[aria-checked="true"] .cst-sw { background:var(--cst-accent); }
.cst-row[aria-checked="true"] .cst-sw::after { transform:translateX(16px); }
.cst-sep { height:1px; background:var(--cst-border); margin:10px 2px; }
.cst-field { padding:0 2px 10px; }
.cst-field-label { font-size:11px; letter-spacing:.2px; text-transform:uppercase; color:var(--cst-muted); margin-bottom:7px; }
.cst-seg { display:flex; gap:3px; padding:3px; border-radius:999px; background:var(--cst-soft); border:1px solid var(--cst-border); }
.cst-seg button { flex:1; padding:6px 0; border-radius:999px; border:none; background:none; color:var(--cst-text-2);
    font:inherit; font-size:12.5px; cursor:pointer; transition:background-color .18s ease,color .18s ease; }
.cst-seg button:hover { color:var(--cst-text); }
.cst-seg button[aria-pressed="true"] { background:var(--cst-card); color:var(--cst-text); font-weight:600;
    box-shadow:0 1px 3px rgba(0,0,0,.18); }
.cst-select { width:100%; padding:9px 10px; border-radius:8px; border:1px solid var(--cst-border);
    background:var(--cst-card); color:var(--cst-text); font:inherit; font-size:13px; cursor:pointer; }
.cst-select:hover { border-color:var(--cst-border-2); }
.cst-select option, .cst-select optgroup { background:var(--cst-card); color:var(--cst-text); }
.cst-note-line { padding:0 2px 10px; font-size:11.5px; line-height:1.45; color:var(--cst-warn); }
.cst-menu-foot { display:flex; gap:8px; }
.cst-menu-foot button { flex:1; padding:9px 0; border-radius:8px; border:1px solid var(--cst-border);
    background:var(--cst-soft); color:var(--cst-text); font:inherit; font-size:13px; font-weight:500; cursor:pointer;
    transition:background-color .18s ease,border-color .18s ease; }
.cst-menu-foot button:hover { background:var(--cst-card-hover); border-color:var(--cst-border-2); }
.cst-yt-menu :focus-visible { outline:2px solid var(--cst-accent); outline-offset:2px; }
@media (prefers-reduced-motion: reduce) { .cst-yt-menu *, .cst-yt-menu *::after { transition-duration:.001ms !important; } }
`;

    function napCss(doc) {
        if (!doc || doc.getElementById("cst-yt-menu-css")) return;
        const st = doc.createElement("style");
        st.id = "cst-yt-menu-css";
        st.textContent = MENU_CSS;
        (doc.head || doc.documentElement).appendChild(st);
    }

    // The badge inside the button: accent square, the mark painted on it, a status dot on top.
    function badgeCss(size) {
        return `width:${size}px;height:${size}px;border-radius:9px;background-color:#D97757;` +
            `background-image:url("${BTN_ICON_URL}");background-repeat:no-repeat;background-position:center;` +
            `background-size:${Math.round(size * 0.63)}px ${Math.round(size * 0.63)}px;` +
            `box-shadow:0 2px 8px rgba(217, 119, 87, 0.45);` +
            `transition:transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;`;
    }

    function dotCss(size) {
        return `display:none;position:absolute;top:${Math.round(size * 0.17)}px;right:${Math.round(size * 0.17)}px;` +
            `width:8px;height:8px;border-radius:50%;background:#22C55E;border:1.5px solid #1F1E1B;` +
            `box-shadow:0 0 4px rgba(34, 197, 94, 0.8);`;
    }

    // doc: the document to build in. size: the badge's side in px (the control bars differ).
    function taoNut(doc, { size = 30, title = "", className = "", onClick, onDblClick } = {}) {
        const btn = doc.createElement("button");
        btn.type = "button";
        if (className) btn.className = className;
        btn.setAttribute("title", title);
        btn.setAttribute("aria-label", title);
        btn.style.cssText = "position:relative;display:inline-flex;align-items:center;justify-content:center;" +
            "cursor:pointer;border:none;background:transparent;padding:0;outline:none;flex-shrink:0;";
        const badge = doc.createElement("div");
        badge.className = "cst-btn-badge";
        badge.style.cssText = badgeCss(size);
        const dot = doc.createElement("span");
        dot.className = "cst-btn-dot";
        dot.style.cssText = dotCss(size);
        btn.appendChild(badge);
        btn.appendChild(dot);
        btn.addEventListener("mouseenter", () => {
            badge.style.transform = "scale(1.08)";
            badge.style.boxShadow = "0 4px 14px rgba(217, 119, 87, 0.55)";
        });
        btn.addEventListener("mouseleave", () => {
            badge.style.transform = "scale(1)";
            badge.style.boxShadow = btn.dataset.cstOn === "1"
                ? "0 0 12px rgba(217, 119, 87, 0.75)" : "0 2px 8px rgba(217, 119, 87, 0.45)";
        });
        if (onClick) btn.addEventListener("click", e => { e.stopPropagation(); e.preventDefault(); onClick(e); });
        if (onDblClick) btn.addEventListener("dblclick", e => { e.stopPropagation(); e.preventDefault(); onDblClick(e); });
        return btn;
    }

    // Two states only, the same two the popup shows: amber while it works, green while it is on.
    // What exactly is on goes in the title, where a screen reader can read it.
    function datTrangThai(btn, { busy = false, on = false, title = "" } = {}) {
        if (!btn) return;
        const badge = btn.querySelector(".cst-btn-badge");
        const dot = btn.querySelector(".cst-btn-dot");
        btn.dataset.cstOn = on ? "1" : "0";
        btn.setAttribute("aria-pressed", String(!!on));
        if (title) {
            btn.setAttribute("title", title);
            btn.setAttribute("aria-label", title);
        }
        if (dot) {
            const mau = busy ? "#E8B84B" : on ? "#22C55E" : null;
            dot.style.display = mau ? "block" : "none";
            if (mau) {
                dot.style.backgroundColor = mau;
                dot.style.boxShadow = `0 0 5px ${mau}`;
            }
        }
        if (badge) {
            badge.style.backgroundColor = on ? "#E08567" : "#D97757";   // never the shorthand: it drops the icon
            badge.style.boxShadow = on ? "0 0 12px rgba(217, 119, 87, 0.75)" : "0 2px 8px rgba(217, 119, 87, 0.45)";
        }
    }

    root.CST_PLAYER_UI = { MARK_SVG, BTN_ICON_SVG, BTN_ICON_URL, MENU_CSS, napCss, taoNut, datTrangThai };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) module.exports = globalThis.CST_PLAYER_UI;
