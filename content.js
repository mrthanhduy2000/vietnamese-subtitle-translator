// ============================================================
// Coursera Subtitle Translator v3
// Sua loi phu de tran man hinh: ban dich duoc phan bo ve tung dong
// theo ty le do dai, thay vi gan ca cau vao moi dong.
// ============================================================

const TARGET_LANG = "vi";
const MAX_CHUNK_CHARS = 1200;      // gioi han ky tu moi lan goi API
// Gom cue thanh CAU tron ven truoc khi dich: cau tron ven thi Gemini dich tu nhien
// hon va bo phan doan tieng Viet co du tu do chon diem cat. Cac nguong mem/cung
// chi dung khi phu de khong co dau cau (phu de tu dong).
const GROUP_SOFT_CHARS = 170;      // tu day tro di, dong nhom o cho ngat nghi
const GROUP_HARD_CHARS = 520;      // cau dai van giu tron trong mot nhom (khong dich thanh 2 manh)
const GROUP_HARD_CUES = 12;
const GROUP_MAX_SECONDS = 24;
const GROUP_PAUSE_SECONDS = 1.5;   // lang lau hon muc nay la sang y khac

const state = {
    active: false,
    dualMode: false,
    perCueMode: false,
    styleOriginal: false,
    glossaryKeep: [],
    glossaryNormalize: [],
    glossaryEnabled: true,
    glossaryMisses: 0,
    glossaryTranslateAs: new Map(),
    reExact: null,
    reLoose: null,
    reRisky: null,
    dubEnabled: true,
    dubVoiceName: "",
    dubDuck: 0.12,
    dubAutoRate: true,
    originalFirst: false,
    originalCueTexts: null,
    originalCues: null,
    glossaryMultiTerms: [],
    costMode: "balanced",
    activeTrack: null,
    intervals: [],
    observers: [],
    currentUrl: location.href,
    busy: false
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------- Thông báo nhỏ trên trình phát (thay hộp thoại chặn trang) ----------
// Hộp thoại alert() chặn cả trang cho tới khi người xem bấm OK (video vẫn chạy, mất lời).
// Thay bằng một thẻ nhỏ góc trên trình phát: tự ẩn, đọc được bằng trình đọc màn hình
// (role=status), có thể kèm MỘT nút thao tác (ví dụ "Mở Cài đặt").
function cstToast(message, opts = {}) {
    try {
        document.querySelectorAll(".cst-toast").forEach(t => t.remove());
        const host = document.querySelector("#movie_player") || document.querySelector(".html5-video-player")
            || document.querySelector("video")?.parentElement || document.body;
        const box = document.createElement("div");
        box.className = "cst-toast";
        box.setAttribute("role", "status");
        box.setAttribute("aria-live", "polite");
        const inPlayer = host !== document.body;
        // Same palette as the popup, the Settings page and the on-player menu. It stays dark in both
        // themes because it sits on top of a video, where a cream panel would glare.
        box.style.cssText = `position:${inPlayer ? "absolute" : "fixed"};top:${inPlayer ? "58px" : "16px"};left:50%;transform:translateX(-50%);
            max-width:min(620px,84%);display:flex;align-items:center;gap:12px;z-index:2147483001;
            padding:11px 14px;border-radius:12px;background:rgba(40,38,34,.965);color:#ECE8E1;
            font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
            box-shadow:0 18px 46px rgba(0,0,0,.5);
            border:1px solid ${opts.warn ? "rgba(232,184,75,.55)" : "#3A3732"};opacity:0;transition:opacity .25s`;
        const text = document.createElement("span");
        text.textContent = message;
        text.style.cssText = "flex:1;white-space:pre-line";
        box.appendChild(text);
        if (opts.actionLabel && opts.onAction) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = opts.actionLabel;
            btn.style.cssText = "flex-shrink:0;padding:6px 12px;border-radius:8px;border:none;background:#D97757;color:#FFFFFF;font:inherit;font-weight:500;cursor:pointer";
            btn.addEventListener("click", () => { box.remove(); try { opts.onAction(); } catch (e) { /* bỏ qua */ } });
            box.appendChild(btn);
        }
        const close = document.createElement("button");
        close.type = "button";
        close.setAttribute("aria-label", "Đóng thông báo");
        close.textContent = "✕";
        close.style.cssText = "flex-shrink:0;background:none;border:none;color:#A8A39A;font-size:13px;cursor:pointer;padding:2px 4px;border-radius:6px";
        close.addEventListener("click", () => box.remove());
        box.appendChild(close);
        host.appendChild(box);
        requestAnimationFrame(() => { box.style.opacity = "1"; });
        const ms = opts.ms || (opts.actionLabel ? 12000 : 6000);
        setTimeout(() => { box.style.opacity = "0"; setTimeout(() => box.remove(), 300); }, ms);
        return box;
    } catch (e) {
        console.warn("[AI Subtitle]", message);
        return null;
    }
}
window.CST_UI = { toast: cstToast };

function getCurrentSite() {
    const url = location.href;
    if (url.includes("coursera.org")) return "coursera";
    // YouTube do youtube.js lo, vi phu de o do hoat dong theo co che khac han
    if (url.includes("youtube.com")) return "youtube";
    return null;
}

// ---------- Chen CSS gioi han kich thuoc phu de ----------
// Ngan phu de phu kin man hinh khi mot dong lo bi dai
function injectCueStyle() {
    const existing = document.getElementById("cst-cue-style");
    if (existing) existing.remove();
    const S = window.CST_STYLE;
    if (!S) return;

    const s = S.normalizeStyle(state.subStyle);
    // Nap phong web (Be Vietnam Pro, Inter...) neu duoc chon; bi chan thi dung bo du phong
    S.ensureFont(document, s.fontFamily, s.fontWeight);

    const style = document.createElement("style");
    style.id = "cst-cue-style";
    // 130% la co chuan cua trinh phat (giu nguyen quy uoc cu cua ban 1.0.4)
    const fontEm = (s.fontSize / 130).toFixed(2);
    style.textContent = `
        video::cue {
            font-family: ${S.fontStack(s.fontFamily)} !important;
            font-size: ${fontEm}em !important;
            font-weight: ${s.fontWeight} !important;
            line-height: ${s.lineHeight} !important;
            background-color: ${S.backgroundColor(s)} !important;
            color: ${s.fontColor} !important;
            text-shadow: ${S.textShadow(s)} !important;
            white-space: pre-line !important;
        }
        video::cue(.cst-orig) {
            font-size: ${(s.origScale / 100).toFixed(2)}em;
            color: ${s.origColor};
        }
    `;
    (document.head || document.documentElement).appendChild(style);
}

// The control-bar button's state. Kept as a named function because the whole file calls it.
function setIconState(status) {
    csUpdateButton(status);
}

// ---------- Bao ve thuat ngu va danh tu rieng ----------
// Y tuong: truoc khi gui di dich, thay moi thuat ngu can giu nguyen
// bang mot ma danh dau tam (vi du ZQ0QZ). May dich khong hieu ma nay
// nen giu nguyen no. Dich xong thi thay ma do tro lai bang thuat ngu goc.
//
// Toc do: thay vi quet van ban mot lan cho MOI thuat ngu (hang tram lan),
// gom tat ca thuat ngu vao MOT bieu thuc duy nhat va chi quet hai lan.

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Muc co chu hoa -> phai so khop dung chu hoa (tranh "Excel" bat nham "excel")
function needsExactCase(term) {
    return /[A-Z]/.test(term);
}

// Bien mot thuat ngu thanh mau nhan dien, co chap nhan dang so nhieu.
// Day la phan sua loi quan trong: truoc day "landing page" khong bat duoc
// "landing pages", "AI agent" khong bat duoc "AI agents".
function termToPattern(term) {
    // Ket thuc bang phu am + y  ->  chap nhan ca "y" va "ies"
    // (case study / case studies, category / categories)
    if (/[bcdfghjklmnpqrstvwxz]y$/i.test(term)) {
        return escapeRegex(term.slice(0, -1)) + "(?:y|ies)";
    }
    // Ket thuc bang chu cai  ->  cho phep them "s" hoac "es"
    // (agent / agents, box / boxes). Neu tu von khong co dang so nhieu
    // thi phan them nay khong khop gi ca, hoan toan vo hai.
    if (/[a-z0-9]$/i.test(term)) {
        return escapeRegex(term) + "(?:e?s)?";
    }
    return escapeRegex(term);
}

// Dung bieu thuc gop tu danh sach thuat ngu, sap xep cum dai truoc
// de "Claude Code" duoc bat truoc "Claude"
function buildMasterRegex(terms, flags) {
    if (terms.length === 0) return null;
    const sorted = [...terms].sort((a, b) => b.length - a.length);
    const parts = sorted.map(termToPattern);
    // Khong cho khop khi ky tu lien ke la chu hoac so
    return new RegExp(`(?<![\\w])(?:${parts.join("|")})(?![\\w])`, flags);
}

// ---------- Thuat ngu phu thuoc ngu canh ----------
// Mot so tu chi la thuat ngu khi doan van dang noi ve linh vuc do.
// "agent" trong bai giang AI la AI agent, nhung trong bai giang bao hiem
// lai la dai ly that. Chi bao ve khi doan van co dau hieu cua linh vuc.
function buildContextualRegex(text) {
    const danhSach = (typeof CST_CONTEXTUAL_TERMS !== "undefined") ? CST_CONTEXTUAL_TERMS : [];
    if (danhSach.length === 0) return null;

    const phuHop = danhSach.filter(muc =>
        muc.context.some(tuKhoa => text.toLowerCase().includes(tuKhoa.toLowerCase()))
    );
    if (phuHop.length === 0) return null;

    const parts = phuHop
        .map(m => m.term)
        .sort((a, b) => b.length - a.length)
        .map(termToPattern);

    try {
        return new RegExp(`(?<![\\w])(?:${parts.join("|")})(?![\\w])`, "gi");
    } catch (e) {
        return null;
    }
}

function rebuildGlossaryRegex() {
    const risky = new Set(
        (typeof CST_RISKY_PROPER !== "undefined" ? CST_RISKY_PROPER : [])
    );

    const exact = [];
    const loose = [];
    const riskyList = [];

    for (const term of state.glossaryKeep) {
        if (!term || term.length < 2) continue;
        if (risky.has(term)) riskyList.push(term);
        else if (needsExactCase(term)) exact.push(term);
        else loose.push(term);
    }

    try {
        state.reExact = buildMasterRegex(exact, "g");
        state.reLoose = buildMasterRegex(loose, "gi");

        // Tang thu ba: ten rieng trung tu tieng Anh thong dung.
        // Chi bao ve khi KHONG dung dau cau, tranh bat nham
        // "Notion of freedom" hay "Excel at your job" o dau cau.
        if (riskyList.length > 0) {
            const sorted = [...riskyList].sort((a, b) => b.length - a.length);
            const parts = sorted.map(escapeRegex);
            state.reRisky = new RegExp(
                `(?<![.!?]["')\\]]?\\s)(?<!^)(?<![\\w])(?:${parts.join("|")})(?![\\w])`,
                "g"
            );
        } else {
            state.reRisky = null;
        }
    } catch (err) {
        console.warn("Khong dung duoc bieu thuc tu dien:", err.message);
        state.reExact = null;
        state.reLoose = null;
        state.reRisky = null;
    }

    console.log(`Tu dien: ${exact.length} muc dung chu hoa, ${loose.length} muc khong phan biet, ${riskyList.length} ten rieng can than trong`);
}

function protectGlossary(text) {
    if (!state.glossaryEnabled) return { text, terms: [] };

    let out = text;

    // Buoc 1: chuan hoa cac bien the ve dang chuan
    for (const [pattern, canonical] of state.glossaryNormalize) {
        try {
            out = out.replace(new RegExp(pattern, "gi"), canonical);
        } catch (e) { /* mau khong hop le thi bo qua */ }
    }

    // Buoc 2: thay thuat ngu bang ma danh dau
    const terms = [];
    const replaceWithToken = (match) => {
        // Neu nguoi dung khai bao dang "tu goc => dang muon hien"
        // thi dien dang muon hien, nguoc lai giu nguyen ban goc
        const custom = state.glossaryTranslateAs.get(match.toLowerCase());
        const id = terms.length;
        terms.push(custom !== undefined ? custom : match);
        // Dung token an toan co khoang trang bao boc de may dich khong dinh tu lien vao token
        return ` [[__T${id}__]] `;
    };

    if (state.reExact) {
        state.reExact.lastIndex = 0;
        out = out.replace(state.reExact, replaceWithToken);
    }
    if (state.reLoose) {
        state.reLoose.lastIndex = 0;
        out = out.replace(state.reLoose, replaceWithToken);
    }
    if (state.reRisky) {
        state.reRisky.lastIndex = 0;
        out = out.replace(state.reRisky, replaceWithToken);
    }

    // Tang thu tu: thuat ngu chi co nghia trong dung linh vuc
    const reContext = buildContextualRegex(text);
    if (reContext) {
        out = out.replace(reContext, replaceWithToken);
    }

    return { text: out, terms };
}

// Buoc loc cuoi cho MOI ban dich: xoa ma giu cho bi sot, markdown, ngoac kep
// bao ngoai. Giu lai dau goi y ngat nghi "¦" cho bo phan doan (se bi xoa khi hien thi).
function finalizeTranslation(text) {
    if (window.CST_VI_SEG) return window.CST_VI_SEG.cleanText(text, { keepHints: true });
    return String(text || "").replace(/\[\[[^\]]*\]\]|__T\d+__|ZQ\d+QZ/gi, " ").replace(/\s{2,}/g, " ").trim();
}

function stripHints(text) {
    return String(text || "").split("¦").join(" ").replace(/\s{2,}/g, " ").trim();
}

function restoreGlossary(text, terms) {
    if (terms.length === 0) return finalizeTranslation(text);

    // Regex da dang: bat ca format moi [[__T0__]] va format cu ZQ0QZ / Z Q 0 Q Z
    let restored = text.replace(/(?:\[\[\s*__\s*T\s*(\d+)\s*__\s*\]\]|__T\s*(\d+)\s*__|Z\s*Q\s*(\d+)\s*Q\s*Z)/gi, (match, p1, p2, p3) => {
        const num = p1 !== undefined ? p1 : (p2 !== undefined ? p2 : p3);
        const idx = parseInt(num, 10);
        return terms[idx] !== undefined ? terms[idx] : match;
    });

    // Don dep khoang trang thua sinh ra boi token
    restored = restored.replace(/[ \t]{2,}/g, " ").trim();

    const leftover = restored.match(/(?:\[\[\s*__\s*T\s*\d+\s*__\s*\]\]|__T\s*\d+\s*__|Z\s*Q\s*\d+\s*Q\s*Z)/gi);
    if (leftover) {
        state.glossaryMisses += leftover.length;
    }

    // Ma nao con sot (vi du mo hinh doi so thu tu) thi xoa, khong de lot ra man hinh
    return finalizeTranslation(restored);
}

function glossaryIntact(translatedText, terms) {
    if (terms.length === 0) return true;
    const found = (translatedText.match(/(?:\[\[\s*__\s*T\s*\d+\s*__\s*\]\]|__T\s*\d+\s*__|Z\s*Q\s*\d+\s*Q\s*Z)/gi) || []).length;
    return found >= Math.ceil(terms.length * 0.4);
}

// ---------- Tang goi dich thuat (co ngu canh) ----------
// SOURCE CONTEXT -> CONTEXT UNDERSTANDING -> TERMINOLOGY -> TRANSLATION
// -> NATURALIZATION (kiem tra dich may + dich lai) -> (phan doan, ngat dong o buoc sau)

// Bao ve thuat ngu tren CA DOAN: ma giu cho danh so chung cho moi muc,
// kem bang giai nghia de mo hinh van hieu tung ma dai dien cho tu gi
// (loi cu: mo hinh chi thay "[[__T0__]]" nen khong biet cau noi ve gi).
function protectMany(sentences) {
    const joined = sentences.join("\n");
    const res = protectGlossary(joined);
    const texts = res.text.split("\n").map(t => t.replace(/[ \t]{2,}/g, " ").trim());
    if (texts.length !== sentences.length) return { texts: sentences, terms: [] };
    return { texts, terms: res.terms };
}

function sendMessageAsync(msg) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(msg, response => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (!response || !response.ok) reject(new Error(response ? response.error : "Khong co phan hoi"));
            else resolve(response);
        });
    });
}

function logEngine(response, n) {
    window.CST_LAST_AI_INFO = response;
    state.lastTranslationInfo = response;
    if (response.engine === "gemini") {
        const fb = response.fallbackFrom ? `, ${response.fallbackFrom} không dùng được nên lùi sang model này` : "";
        console.log(`%c[AI Subtitle]%c 🤖 GEMINI (${response.model}) ${n} đoạn, ${response.latency}ms${response.fromCache ? " (bộ nhớ đệm)" : ""}${fb}`,
            "background:#D97757;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold;", "color:#D97757;font-weight:bold;");
    } else if (response.engine === "google_fallback") {
        console.warn(`[AI Subtitle] ⚠️ Gemini lỗi ("${response.fallbackReason || "Không xác định"}"), dùng Google Translate (không có ngữ cảnh)`);
    }
}

// Gui mot cua so gom cac doan phu de lien tiep + goi ngu canh.
// opts: { hints, refine: { draft:[], issues:[] } }
// opts: { tier: "cheap" | "strong", wantTerms, refine: { draft:[], issues:[] } }
// Video đang xem (để tính chi phí ước tính theo từng video, chỉ lưu trên máy)
function currentVideoMeta() {
    let key = location.pathname;
    try { const v = new URL(location.href).searchParams.get("v"); if (v) key = "yt:" + v; } catch (e) { /* bỏ qua */ }
    const video = document.querySelector("video");
    return { videoKey: key, videoSec: video && isFinite(video.duration) ? Math.round(video.duration) : 0, videoTitle: String(document.title || "").slice(0, 80) };
}

async function requestUnit(req, opts = {}) {
    // Nội dung đã là tiếng Việt (track gắn nhãn sai, phụ đề trộn): giữ nguyên, không gọi Gemini
    const LANG = window.CST_LANG;
    if (LANG && !opts.refine) {
        const d = LANG.detectText(req.sentences.join(" "));
        if (d.lang === "vi" && d.confidence >= 0.9) return { ok: true, engine: "same-language", translations: req.sentences.slice(), terms: [] };
    }
    const prot = protectMany(req.sentences);
    const placeholders = prot.terms.map((term, id) => ({ id, term }));
    const msg = {
        action: "translateUnit",
        sentences: prot.texts,
        context: req.context,
        placeholders,
        tier: opts.tier || "cheap",
        wantTerms: !!opts.wantTerms,
        refine: opts.refine || null,
        ...currentVideoMeta()
    };
    let res = await sendMessageAsync(msg);
    let translations = res.translations || [];

    if (res.restored) {
        // Bản cuối từ cache (đã khôi phục thuật ngữ từ trước)
        translations = translations.map(finalizeTranslation);
    } else if (prot.terms.length) {
        const joined = translations.join(" ");
        if (!glossaryIntact(joined, prot.terms)) {
            // Ma bi hong: gui lai ban goc khong bao ve (van giu ngu canh)
            console.warn("Ma danh dau bi hong, dich lai khong bao ve thuat ngu");
            res = await sendMessageAsync({ ...msg, sentences: req.sentences, placeholders: [] });
            translations = (res.translations || []).map(finalizeTranslation);
        } else {
            translations = translations.map(t => restoreGlossary(t, prot.terms));
        }
    } else {
        translations = translations.map(finalizeTranslation);
    }
    logEngine(res, req.sentences.length);
    return { ...res, translations };
}

function qualityKeepSet() {
    if (!state._qualityKeep || state._qualityKeepSrc !== state.glossaryKeep) {
        state._qualityKeep = new Set(state.glossaryKeep.flatMap(t => String(t).toLowerCase().split(/\s+/)));
        state._qualityKeepSrc = state.glossaryKeep;
    }
    return state._qualityKeep;
}

function assessAll(req, translations) {
    const Q = window.CST_QUALITY;
    if (!Q) return translations.map(() => ({ score: 0, issues: [], needsRefine: false }));
    return translations.map((vi, k) => Q.assess(req.sentences[k], vi, {
        terms: req.context.terms,
        keep: qualityKeepSet()
    }));
}

function costMode() {
    const C = window.CST_COST;
    return C ? C.getMode(state.costMode) : { id: "balanced", escalate: false, refine: "cheap" };
}

// Có nên dịch lại không, và bằng model nào (tối đa MỘT lần cho mỗi cửa sổ):
//   Cao cấp  : có dấu hiệu dịch máy -> dịch lại bằng model mạnh
//   Cân bằng : chỉ khi lỗi NẶNG (mức 3) -> dịch lại bằng model rẻ
//   Tiết kiệm / Chỉ phụ đề: không dịch lại
function refinePlan(first, quality) {
    if (first.engine !== "gemini" || first.fromCache) return null;
    const mode = costMode();
    if (mode.refine === "strong" && quality.some(q => q.needsRefine)) return { tier: "strong" };
    if (mode.refine === "cheap" && quality.some(q => q.issues.some(i => i.severity >= 3))) return { tier: "cheap" };
    return null;
}

// Dich lai co huong dan khi phat hien dau hieu "dich may". Chi nhan ban
// dich lai neu diem chat luong tot hon (khong bao gio lam te di), va luu
// ban cuoi vao cache de lan sau khong phai dich lai.
async function refineUnit(req, first, quality, plan) {
    const issues = [];
    quality.forEach((q, k) => q.issues.forEach(i => issues.push(`mục ${k + 1}: ${i.detail}${i.fix ? ` (${i.fix})` : ""}`)));
    try {
        const again = await requestUnit(req, {
            tier: plan.tier,
            refine: { draft: first.translations.map(stripHints), issues: issues.slice(0, 10) }
        });
        const q2 = assessAll(req, again.translations);
        const pick = first.translations.map((t, k) => (q2[k].score < quality[k].score ? again.translations[k] : t));
        const improved = pick.some((t, k) => t !== first.translations[k]);
        if (!improved) return null;
        if (first.cacheKey) {
            sendMessageAsync({ action: "translateUnitStore", cacheKey: first.cacheKey, translations: pick, terms: first.terms || [], model: again.model, tier: plan.tier }).catch(() => {});
        }
        return { ...first, translations: pick, refined: true, tier: plan.tier };
    } catch (e) {
        console.warn("Dich lai that bai, giu ban dau:", e.message);
        return null;
    }
}

// Dich cac nhom idxs (lien tiep) cua mot phien ngu canh.
// LOCAL (ngữ cảnh, định tuyến) -> CACHE -> MODEL RẺ -> MODEL MẠNH khi câu khó / lỗi.
// realtime = true: tra ban dau ngay (khong de nguoi xem cho), viec dich lai
// chay nen va goi onRefined khi co ban tot hon.
async function translateWindow(session, idxs, opts = {}) {
    const req = session.buildRequest(idxs);
    const mode = costMode();
    // Định tuyến tất định: chỉ câu khó mới lên model mạnh (và chỉ ở chế độ Cao cấp)
    const route = window.CST_COST ? window.CST_COST.routeDifficulty(req) : { tier: "cheap" };
    const tier = mode.escalate && route.tier === "strong" ? "strong" : "cheap";
    // Thuật ngữ chỉ xin khi đoạn có thuật ngữ mới (không phải mọi cửa sổ)
    const wantTerms = typeof session.wantsTerms === "function" ? session.wantsTerms(req) : false;
    const first = await requestUnit(req, { tier, wantTerms });
    if (first.fromCache) {
        session.record(idxs, first);
        return first;
    }
    const quality = assessAll(req, first.translations);
    const plan = refinePlan(first, quality);

    if (plan && !opts.realtime) {
        const better = await refineUnit(req, first, quality, plan);
        const result = better || first;
        session.record(idxs, result);
        saveSessionTermsSoon(session);
        return result;
    }

    session.record(idxs, first);
    saveSessionTermsSoon(session);
    if (plan && opts.realtime && typeof opts.onRefined === "function") {
        refineUnit(req, first, quality, plan).then(better => {
            if (!better) return;
            session.record(idxs, better);
            opts.onRefined(better);
        });
    }
    return first;
}

// Luu thuat ngu da thong nhat theo khoa hoc / kenh de nhat quan giua cac bai
let termSaveTimer = null;
function saveSessionTermsSoon(session) {
    if (!session || !session.storageKey) return;
    clearTimeout(termSaveTimer);
    termSaveTimer = setTimeout(() => {
        try { chrome.storage.local.set({ [session.storageKey]: { luc: Date.now(), terms: session.exportTerms() } }); } catch (e) { /* bo qua */ }
    }, 1500);
}

async function createContextSession(meta, storageKey) {
    const C = window.CST_CONTEXT;
    if (!C) return null;
    const session = new C.ContextSession(meta);
    session.storageKey = storageKey ? `ctxterms_${storageKey}`.slice(0, 120) : "";
    if (session.storageKey) {
        try {
            const kq = await chrome.storage.local.get(session.storageKey);
            if (kq && kq[session.storageKey]) session.importTerms(kq[session.storageKey].terms);
        } catch (e) { /* bo qua */ }
    }
    return session;
}

function groupEndsSentence(g) {
    return /[.!?…]["')\]]?$/.test(String(g && g.text || "").trim());
}

// Dich toan bo nhom (Coursera): chia thanh cac cua so lien tiep 600-1200 ky tu,
// uu tien ket thuc cua so o cuoi cau de moi lan goi la mot doan tron y.
async function translateAllGroups(session, groups, onProgress) {
    const results = new Array(groups.length).fill("");
    const windows = [];
    let cur = [];
    let chars = 0;
    for (let i = 0; i < groups.length; i++) {
        cur.push(i);
        chars += groups[i].text.length + 1;
        // Chi cat cung khi qua dai; binh thuong luon dung o cuoi cau
        const full = chars >= 1200 || cur.length >= 16;
        const soft = groupEndsSentence(groups[i]) && (chars >= 600 || cur.length >= 8);
        if (full || soft) { windows.push(cur); cur = []; chars = 0; }
    }
    if (cur.length) windows.push(cur);

    let done = 0;
    let next = 0;
    const worker = async () => {
        while (next < windows.length) {
            const idxs = windows[next++];
            try {
                const r = await translateWindow(session, idxs, { realtime: false });
                idxs.forEach((gi, k) => { results[gi] = r.translations[k] || ""; });
            } catch (err) {
                console.warn("Loi dich cua so, dich tung nhom:", err.message);
                for (const gi of idxs) {
                    try {
                        const r = await translateWindow(session, [gi], { realtime: false });
                        results[gi] = r.translations[0] || "";
                    } catch (e2) {
                        results[gi] = "";
                    }
                }
            }
            done += idxs.length;
            if (onProgress) onProgress(done, groups.length);
        }
    };
    await Promise.all([worker(), worker()]);
    return results;
}

// ---------- Chon track phu de ----------
function pickBestTrack() {
    const tracks = Array.from(document.getElementsByTagName("track"));
    if (tracks.length === 0) return null;

    const usable = tracks.filter(t => {
        const kind = (t.kind || "").toLowerCase();
        return kind === "" || kind === "subtitles" || kind === "captions";
    });
    const pool = usable.length > 0 ? usable : tracks;

    const viTrack = pool.find(t => (t.srclang || "").toLowerCase().startsWith("vi"));
    if (viTrack) return { track: viTrack, alreadyVietnamese: true };

    const enTrack = pool.find(t => (t.srclang || "").toLowerCase().startsWith("en"));
    const chosen = enTrack || pool[0];
    console.log("Dung track phu de ngon ngu:", chosen.srclang || "(khong ro)");
    return { track: chosen, alreadyVietnamese: false };
}

async function waitForCues(track, maxWaitMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        if (track.cues && track.cues.length > 0) return track.cues;
        await sleep(250);
    }
    return null;
}

// ---------- Gom dong phu de thanh cau ----------
// Nhom = don vi DICH. Uu tien cau tron ven (dau ket cau). Voi phu de tu dong
// khong co dau cau: dong nhom o khoang lang dai, hoac khi da du dai va gap
// cho ngat nghi (dau phay, khoang lang ngan truoc cue ke tiep).
function cueStart(c) { return c.startTime !== undefined ? c.startTime : c.start; }
function cueEnd(c) { return c.endTime !== undefined ? c.endTime : c.end; }
function plainCueText(c) {
    return String((c && c.text) || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function makeGroup(cues, idxs) {
    const srcCues = idxs.map(i => ({
        start: cueStart(cues[i]),
        end: cueEnd(cues[i]),
        text: plainCueText(cues[i]),
        words: cues[i].words
    }));
    return {
        text: srcCues.map(c => c.text).join(" "),
        cueIndexes: [...idxs],
        cueTexts: srcCues.map(c => c.text),
        srcCues,
        start: srcCues[0].start,
        end: Math.max(...srcCues.map(c => c.end))
    };
}

function groupCuesIntoSentences(cues, perCueMode) {
    const groups = [];

    // Che do dich tung dong rieng: moi dong la mot nhom
    if (perCueMode) {
        for (let i = 0; i < cues.length; i++) {
            if (plainCueText(cues[i])) groups.push(makeGroup(cues, [i]));
        }
        return groups;
    }

    let cur = [];
    let chars = 0;
    const closeGroup = () => {
        if (cur.length) groups.push(makeGroup(cues, cur));
        cur = [];
        chars = 0;
    };

    for (let i = 0; i < cues.length; i++) {
        const text = plainCueText(cues[i]);
        if (!text) continue;

        if (cur.length > 0) {
            const prev = cues[cur[cur.length - 1]];
            const gap = cueStart(cues[i]) - cueEnd(prev);
            const span = cueEnd(cues[i]) - cueStart(cues[cur[0]]);
            // Khoang lang dai (chuyen slide, doi y) hoac nhom da cham gioi han cung
            if ((typeof gap === "number" && gap > GROUP_PAUSE_SECONDS) ||
                chars + text.length + 1 > GROUP_HARD_CHARS ||
                cur.length >= GROUP_HARD_CUES ||
                span > GROUP_MAX_SECONDS) {
                closeGroup();
            }
        }

        cur.push(i);
        chars += text.length + 1;

        const isAbbr = /\b(?:e\.g|i\.e|vs|fig|dr|prof|mr|ms|approx|dept|vol|no|etc|al|eq|sec|pp?)\.$/i.test(text);
        const isEllipsis = /(?:\.{3,}|…)$/.test(text);
        const endsSentence = /[.!?]["')\]]?$/.test(text) && !isAbbr && !isEllipsis;
        if (endsSentence) {
            closeGroup();
            continue;
        }

        if (chars >= GROUP_SOFT_CHARS) {
            const next = cues[i + 1];
            const gapNext = next ? cueStart(next) - cueEnd(cues[i]) : Infinity;
            if (/[,;:–—-]["')\]]?$/.test(text) || gapNext >= 0.35) closeGroup();
        }
    }
    closeGroup();

    return groups;
}

// ============================================================
// PHAN DOAN & NGAT DONG TIENG VIET
// Toan bo thuat toan nam trong vi-segmenter.js (CST_VI_SEG):
//   - quyet dinh so cue tieng Viet va diem cat (khong ep theo so cue tieng Anh)
//   - ngat moi cue thanh 1-2 dong theo cu phap tieng Viet
//   - gan thoi gian bam theo nhip noi cua cue nguon
// ============================================================
// A translation that carries the next units' content too (see CST_QUALITY.trimContextLeak) shows
// that content twice and makes the voice read it twice. Compare each unit with the next two.
function trimTranslationLeaks(translations) {
    const Q = window.CST_QUALITY;
    if (!Q || !Q.trimContextLeak) return { list: translations, trimmed: 0 };
    let trimmed = 0;
    const list = translations.map((t, i) => {
        if (!t) return t;
        const next = [translations[i + 1], translations[i + 2]].filter(Boolean).join(" ");
        if (!next) return t;
        const out = Q.trimContextLeak(t, next);
        if (out !== t) trimmed++;
        return out;
    });
    if (trimmed) console.warn(`[AI Subtitle] Bỏ phần dịch lấn sang câu sau ở ${trimmed} nhóm`);
    return { list, trimmed };
}

function segmentGroupVi(group, viText, nextStart) {
    // Cho phep cue cuoi keo dai vao khoang lang phia sau neu qua day chu,
    // nhung khong de len nhom ke tiep.
    const limit = group.end + 1.5;
    const maxEnd = typeof nextStart === "number" ? Math.min(limit, Math.max(group.end, nextStart - 0.04)) : limit;
    const seg = window.CST_VI_SEG;
    if (!seg) {
        const t = stripHints(viText);
        return [{ start: group.start, end: group.end, text: t, lines: [t] }];
    }
    return seg.segmentGroupSafe(viText, group.srcCues, {
        maxEnd,
        keepTerms: state.glossaryMultiTerms || []
    });
}

// ---------- Ap ban dich len phu de (Coursera) ----------
// Thay toan bo cue tieng Anh bang cue tieng Viet moi (so luong va thoi gian
// do bo phan doan quyet dinh). Cue goc duoc giu lai de khoi phuc khi tat dich.
function removeAllCues(track) {
    if (!track || !track.cues) return;
    const list = Array.from(track.cues);
    for (const c of list) {
        try { track.removeCue(c); } catch (e) { /* bo qua */ }
    }
}

// Vị trí + lề (Cài đặt) cho phụ đề Coursera. Trình phát Coursera dùng track phụ đề của
// trình duyệt, nên đặt qua thuộc tính của từng cue:
//   - một dòng: line theo % khung video (snapToLines = false), căn theo mép dưới/trên
//   - song ngữ: giữ xếp theo hàng (-1/-3 từ dưới, 0/2 từ trên) để hai cue không chồng nhau
// role: "vi" | "orig"
function placeCue(cue, role) {
    const S = window.CST_STYLE;
    const s = S ? S.normalizeStyle(state.subStyle) : { position: "bottom", offset: 1 };
    const top = s.position === "top";
    try {
        if (state.dualMode) {
            // Dòng đọc trước (nằm trên): bản gốc nếu bật "gốc trước", ngược lại là bản dịch
            const readFirst = (role === "orig") === !!state.originalFirst;
            cue.snapToLines = true;
            cue.line = top ? (readFirst ? 0 : 2) : (readFirst ? -3 : -1);
        } else {
            cue.snapToLines = false;
            cue.line = top ? s.offset : 100 - s.offset;
            cue.lineAlign = top ? "start" : "end";
        }
    } catch (e) { /* trình duyệt không cho đặt: giữ vị trí mặc định */ }
}

// Đổi vị trí / lề trong Cài đặt khi đang xem: đặt lại các cue đã hiển thị
function repositionCues() {
    const track = state.activeTrack && state.activeTrack.track;
    if (!track || !track.cues) return;
    for (const cue of Array.from(track.cues)) placeCue(cue, /^cst-vi-/.test(cue.id) ? "vi" : "orig");
}

function applyTranslation(track, groups, translations) {
    translations = trimTranslationLeaks(translations).list;
    const originals = state.originalCues || [];
    removeAllCues(track);
    state.dubGroups = [];

    let longestLine = 0;
    let viCount = 0;
    const CueCtor = window.VTTCue || window.TextTrackCue;

    groups.forEach((group, gi) => {
        const vi = translations[gi];
        if (!vi) {
            // Nhom dich loi: giu cue goc de nguoi xem khong mat phu de
            group.cueIndexes.forEach(ci => { if (originals[ci]) track.addCue(originals[ci]); });
            return;
        }
        const nextStart = groups[gi + 1] ? groups[gi + 1].start : undefined;
        const segs = segmentGroupVi(group, vi, nextStart);
        // Nguồn cho lồng tiếng: nhóm câu + bản dịch có ngữ cảnh + mốc thời gian
        state.dubGroups.push({ start: group.start, end: group.end, srcCues: group.srcCues, viText: vi, viCues: segs });
        segs.forEach((s, k) => {
            const cue = new CueCtor(s.start, s.end, s.lines.join("\n"));
            cue.id = `cst-vi-${gi}-${k}`;
            placeCue(cue, "vi");
            track.addCue(cue);
            viCount++;
            for (const l of s.lines) longestLine = Math.max(longestLine, l.length);
        });
    });

    if (state.dualMode) {
        // Song ngu: dua cue goc tro lai, boc lop cst-orig de dinh dang rieng
        originals.forEach((cue, i) => {
            const original = plainCueText({ text: state.originalCueTexts.get(i) });
            if (!original) return;
            cue.text = `<c.cst-orig>${original}</c>`;
            placeCue(cue, "orig");
            track.addCue(cue);
        });
    }

    // Our own overlay paints from here on. The track keeps the cues (the dubbing engine and the
    // "restore original" path read them) but goes to "hidden", so the browser draws nothing:
    // its cue boxes and Coursera's own caption box used to land on top of each other.
    cs.viCues = [];
    cs.origCues = [];
    for (const g of state.dubGroups) for (const c of (g.viCues || [])) {
        cs.viCues.push({ start: c.start, end: c.end, lines: c.lines || [c.text], text: c.text || (c.lines || []).join(" ") });
    }
    cs.viCues.sort((a, b) => a.start - b.start);
    for (let i = 1; i < cs.viCues.length; i++) {
        if (cs.viCues[i].start < cs.viCues[i - 1].end) cs.viCues[i - 1].end = Math.max(cs.viCues[i - 1].start + 0.05, cs.viCues[i].start);
    }
    originals.forEach((cue, i) => {
        const text = plainCueText({ text: state.originalCueTexts.get(i) });
        if (text) cs.origCues.push({ start: cue.startTime, end: cue.endTime, text });
    });
    cs.origCues.sort((a, b) => a.start - b.start);
    try { track.mode = "hidden"; } catch (e) { /* bỏ qua */ }
    cs.renderKey = "";
    csStartRender();
    csLoadEdits();

    console.log(`Da ap ban dich: ${originals.length} cue goc -> ${viCount} cue tieng Viet, dong dai nhat ${longestLine} ky tu`);
    if (state.glossaryMisses > 0) {
        console.warn(`Co ${state.glossaryMisses} thuat ngu khong khoi phuc duoc dung cach`);
    }
}

function restoreOriginalCues() {
    if (!state.activeTrack || !state.originalCues) return;
    const track = state.activeTrack.track;
    if (!track) return;
    removeAllCues(track);
    state.originalCues.forEach((cue, idx) => {
        if (state.originalCueTexts.has(idx)) cue.text = state.originalCueTexts.get(idx);
        if (state.originalCueLines && state.originalCueLines.has(idx)) {
            try { cue.line = state.originalCueLines.get(idx); } catch (e) { /* bo qua */ }
        }
        track.addCue(cue);
    });
    console.log("Da khoi phuc phu de goc");
}

// ---------- Luong chinh ----------
function courseraMeta() {
    const m = location.pathname.match(/\/learn\/([^/]+)/) || location.pathname.match(/\/courses?\/([^/]+)/);
    const slug = m ? m[1] : location.hostname;
    const h1 = document.querySelector("h1");
    const title = (h1 && h1.textContent.trim()) || document.title.replace(/\s*[|\-]\s*Coursera.*$/i, "").trim();
    return {
        title,
        course: slug.replace(/[-_]+/g, " "),
        channel: "Coursera",
        courseKey: `${getCurrentSite()}_${slug}`
    };
}

async function translateCoursera() {
    const picked = pickBestTrack();
    if (!picked) {
        cstToast("Không tìm thấy phụ đề cho video này. Hãy bật phụ đề (CC) trên trình phát rồi bấm dịch lại.", { warn: true });
        return false;
    }
    if (picked.alreadyVietnamese) {
        cstToast("Khóa học này đã có phụ đề tiếng Việt chính thức, chất lượng tốt hơn dịch máy. Hãy chọn Vietnamese trong menu phụ đề của trình phát.");
        return false;
    }

    const trackEl = picked.track;
    trackEl.track.mode = "showing";

    const cues = await waitForCues(trackEl.track);
    if (!cues) {
        cstToast("Phụ đề chưa nạp xong. Hãy phát video vài giây rồi bấm dịch lại.", { warn: true });
        return false;
    }

    state.originalCues = Array.from(cues);
    state.originalCueTexts = new Map();
    state.originalCueLines = new Map();
    state.originalCues.forEach((cue, i) => {
        state.originalCueTexts.set(i, cue.text);
        state.originalCueLines.set(i, cue.line);
    });
    state.activeTrack = trackEl;

    const groups = groupCuesIntoSentences(state.originalCues, state.perCueMode);
    console.log(`Da gom ${cues.length} dong phu de thanh ${groups.length} nhom dich`);

    // Ngu canh bai giang: tieu de, ten khoa hoc (tu duong dan), thuat ngu da dung o cac bai truoc
    const meta = courseraMeta();
    const session = await createContextSession(meta, meta.courseKey);
    session.setUnits(groups.map(g => g.text));
    state.contextSession = session;
    console.log(`Linh vuc nhan dien: ${session.domain.primary}${session.domain.secondary ? " + " + session.domain.secondary : ""}`);

    const translations = await translateAllGroups(
        session,
        groups,
        (done, total) => {
            const btn = document.querySelector(CS_BTN);
            if (btn) btn.setAttribute("title", `Đang dịch ${done}/${total} nhóm…`);
        }
    );

    applyTranslation(trackEl.track, groups, translations);
    return true;
}

async function enableTranslation() {
    if (state.busy) return;
    state.busy = true;
    state.glossaryMisses = 0;
    injectCueStyle();
    setIconState("loading");

    try {
        const site = getCurrentSite();
        let success = false;
        if (site === "coursera") {
            success = await translateCoursera();
        } else if (site === "youtube") {
            if (typeof ytBatDauDich === "function") {
                success = await ytBatDauDich();
                if (success && typeof ytTuBatLongTieng === "function") ytTuBatLongTieng();
            } else {
                console.warn("ytBatDauDich chưa sẵn sàng trên trang YouTube");
            }
        } else {
            cstToast("Trang web này chưa được hỗ trợ.", { warn: true });
        }

        state.active = success;
        setIconState(success ? "on" : "idle");
    } catch (err) {
        console.error("Dịch thất bại:", err);
        state.active = false;
        setIconState("error");
        cstToast(`Dịch thất bại: ${err.message}\nHãy kiểm tra kết nối mạng rồi thử lại.`, { warn: true });
    } finally {
        state.busy = false;
    }
}

function disableTranslation() {
    const site = getCurrentSite();
    if (site === "youtube") {
        if (typeof ytTatDich === "function") {
            ytTatDich();
        }
        state.active = false;
        setIconState("idle");
        return;
    }

    // Tat long tieng truoc vi no doc tu phu de da dich
    if (window.CST_DUB && window.CST_DUB.dub.enabled) {
        window.CST_DUB.stop();
        csUpdateButton();
    }
    csStopRender();
    restoreOriginalCues();
    state.active = false;
    state.originalCueTexts = null;
    state.originalCues = null;
    state.activeTrack = null;
    setIconState("idle");
}

// ---------- Nut bam tren trinh phat ----------
// Mã thế hệ của lần nạp mã này (xem YT_GEN trong youtube.js): nút của mã cũ đã mất kết nối
// với tiện ích (sau khi Tải lại) bị thay bằng nút còn sống
const CS_GEN = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);


// ---------- Coursera: control-bar button, subtitle overlay, quick menu ----------
// Same shape as YouTube. Two things used to go wrong here: the Vietnamese was handed to the
// browser's own cue renderer, which Coursera paints too, so the two boxes overlapped; and the
// controls were two circles floating over the picture instead of a button in the player's bar.

const CS_BTN = `.cst-cs-btn[data-cst-gen="${CS_GEN}"]`;
const CS_OVERLAY = `.cst-cs-overlay[data-cst-gen="${CS_GEN}"]`;
const cs = { viCues: [], origCues: [], renderKey: "", raf: 0, timer: 0, styleKey: "", panelOpen: false, edits: null };

function csVideo() {
    return document.querySelector("video");
}

// Coursera's class names are hashed and change between deploys, so the control bar is found by
// geometry. Measured trap: searching the whole document catches the buttons of any dialog that
// happens to overlap the picture, so the search climbs the video's own ancestors and stops at the
// first one holding at least three controls of its own, never at <body>.
function csPlayerParts() {
    const v = csVideo();
    if (!v) return null;
    const r = v.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const inBar = b => {
        const br = b.getBoundingClientRect();
        return br.width > 10 && br.height > 10
            && br.top > r.top + r.height * 0.55 && br.bottom < r.bottom + 90
            && br.left >= r.left - 24 && br.right <= r.right + 24;
    };
    let box = v.parentElement;
    let btns = [];
    while (box && box !== document.body) {
        btns = [...box.querySelectorAll("button")].filter(b => !b.classList.contains("cst-cs-btn") && inBar(b));
        if (btns.length >= 3) break;
        box = box.parentElement;
    }
    if (!box || box === document.body || btns.length < 3) return null;
    // the rightmost control is the anchor (fullscreen); ours goes in front of it
    const last = btns.reduce((a, b) => (b.getBoundingClientRect().left > a.getBoundingClientRect().left ? b : a));
    const wrap = last.parentElement;
    const group = wrap && wrap.parentElement;
    if (!group || group.children.length < 2) return null;
    return { box, group, before: wrap, height: Math.round(wrap.getBoundingClientRect().height) || 48 };
}

function csControlGroup() {
    return csPlayerParts();
}

// The container holding both the picture and the control bar: the overlay goes in there so it
// lines up with the video and rides along into fullscreen.
function csPlayerBox() {
    const parts = csPlayerParts();
    if (parts) return parts.box;
    const v = csVideo();
    return v ? v.parentElement : null;
}

// Elements from an older generation of this script (after Reload) cannot work any more. Hide them,
// never remove them: removing makes the old code rebuild and remove ours, and the tab spins.
function csHideOlderGen(root, selector) {
    if (!root) return;
    root.querySelectorAll(selector).forEach(el => {
        if (el.dataset.cstGen !== CS_GEN && el.style.display !== "none") el.style.display = "none";
    });
}

function csCreateButton() {
    const kit = window.CST_PLAYER_UI;
    const ctl = csControlGroup();
    if (!kit || !ctl) return null;
    csHideOlderGen(document, ".cst-translate-icon, .cst-dub-icon, .cst-cs-btn");
    const existing = document.querySelector(CS_BTN);
    if (existing && existing.isConnected) {
        csUpdateButton();
        return existing;
    }
    const size = Math.max(26, Math.min(32, ctl.height - 16));
    const btn = kit.taoNut(document, {
        size,
        title: "Dịch phụ đề & lồng tiếng tiếng Việt",
        className: "cst-cs-btn",
        onClick: () => csOpenMenu(btn),
        onDblClick: () => { if (state.active) disableTranslation(); else enableTranslation(); }
    });
    btn.dataset.cstGen = CS_GEN;
    btn.style.width = `${ctl.height}px`;
    btn.style.height = `${ctl.height}px`;
    const wrap = document.createElement("div");
    wrap.className = "cst-cs-btn-wrap";
    wrap.dataset.cstGen = CS_GEN;
    wrap.style.cssText = "display:flex;align-items:center;justify-content:center;";
    wrap.appendChild(btn);
    ctl.group.insertBefore(wrap, ctl.before);
    csUpdateButton();
    return btn;
}

function csUpdateButton(status) {
    const kit = window.CST_PLAYER_UI;
    const btn = document.querySelector(CS_BTN);
    if (!kit || !btn) return;
    const isDub = !!(window.CST_DUB && window.CST_DUB.dub && window.CST_DUB.dub.enabled);
    const busy = status === "loading" || state.busy;
    const on = status === "on" || state.active || isDub;
    kit.datTrangThai(btn, {
        busy,
        on: on && !busy,
        title: busy ? "Đang dịch phụ đề…"
            : status === "error" ? "Dịch thất bại. Bấm để thử lại"
                : state.active && isDub ? "Đang bật phụ đề Việt và lồng tiếng"
                    : state.active ? "Đang bật phụ đề tiếng Việt"
                        : isDub ? "Đang lồng tiếng Việt"
                            : "Dịch phụ đề & lồng tiếng tiếng Việt"
    });
}

// ---- The subtitle overlay: our own box on the picture, never the browser's cue renderer ----
function csOverlay() {
    const box = csPlayerBox();
    if (!box) return null;
    csHideOlderGen(box, ".cst-cs-overlay");
    let ov = box.querySelector(CS_OVERLAY);
    if (ov && ov.isConnected) return ov;
    if (getComputedStyle(box).position === "static") box.style.position = "relative";
    ov = document.createElement("div");
    ov.className = "cst-cs-overlay";
    ov.dataset.cstGen = CS_GEN;
    // Same box as the YouTube overlay: the lines are already fitted to the width, so the browser
    // must not wrap them again (white-space:pre), and the box hugs the text (width:max-content).
    ov.style.cssText = "position:absolute;left:50%;transform:translateX(-50%);max-width:92%;" +
        "width:max-content;box-sizing:border-box;text-align:center;pointer-events:none;" +
        "white-space:pre;opacity:0;z-index:60;transition:opacity .12s ease;";
    box.appendChild(ov);
    cs.styleKey = "";
    csApplyOverlayStyle(ov);
    return ov;
}

function csApplyOverlayStyle(ov) {
    const S = window.CST_STYLE;
    if (!ov || !S) return;
    const s = S.normalizeStyle(state.subStyle);
    const box = csPlayerBox();
    const width = (box && box.clientWidth) || 640;
    const height = (box && box.clientHeight) || 360;
    const base = Math.max(14, Math.min(width * 0.026, 40));
    ov.style.fontFamily = S.fontStack(s.fontFamily);
    ov.style.fontSize = `${(base * (s.fontSize || 90) / 100).toFixed(1)}px`;
    ov.style.fontWeight = s.fontWeight;
    ov.style.lineHeight = String(s.lineHeight);
    ov.style.color = s.fontColor;
    ov.style.backgroundColor = S.backgroundColor(s);
    ov.style.borderRadius = `${s.borderRadius}px`;
    ov.style.textShadow = S.textShadow(s);
    ov.style.padding = S.backgroundColor(s) === "transparent" ? "2px 6px" : "0.18em 0.6em 0.22em";
    // With the transcript panel open the picture is narrower: keep the subtitles inside what is left
    if (cs.panelOpen) {
        ov.style.maxWidth = "min(92%, calc(100% - 452px))";
        ov.style.transform = "translateX(calc(-50% - 212px))";
    } else {
        ov.style.maxWidth = "92%";
        ov.style.transform = "translateX(-50%)";
    }
    const margin = height * (s.offset || 0) / 100 + 6;
    const ctl = csControlGroup();
    const bar = s.pinBottom ? 0 : (ctl ? ctl.height + 16 : 64);
    if (s.position === "top") {
        ov.style.top = `${Math.round(margin)}px`;
        ov.style.bottom = "auto";
    } else {
        ov.style.top = "auto";
        ov.style.bottom = `${Math.round(Math.max(margin, bar))}px`;
    }
    S.ensureFont(document, s.fontFamily, s.fontWeight).then(() => { cs.renderKey = ""; });
    cs.styleKey = `${width}x${height}|${JSON.stringify(s)}`;
    cs.renderKey = "";
}

// A style change (Settings page, the size buttons in the quick menu) must show at once. csRender
// only re-applies the style when the player changes size, so without this a new font size waited
// for the next resize.
function csRestyle() {
    const ov = document.querySelector(CS_OVERLAY);
    if (ov) csApplyOverlayStyle(ov);
    cs.renderKey = "";
}

function csFindCue(list, t) {
    let lo = 0, hi = list.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (list[mid].start > t) hi = mid - 1;
        else if (list[mid].end <= t) lo = mid + 1;
        else return list[mid];
    }
    return null;
}

function csPaint(ov, vi, origText) {
    const S = window.CST_STYLE;
    const s = S ? S.normalizeStyle(state.subStyle) : { origScale: 80, origColor: "#d4d4d8" };
    const box = csPlayerBox();
    const blocks = [];
    const block = (lines, css) => {
        const d = document.createElement("div");
        if (css) d.style.cssText = css;
        d.textContent = lines.join("\n");
        return d;
    };
    // The segmenter cuts by syntax, not by pixels. Without this the browser wraps an over-wide line
    // wherever it likes, which is how "... mà bạn có thể thực / hiện," showed up on a real lecture.
    const rong = cs.panelOpen ? 0.5 : 0.92;          // the transcript panel takes the right half
    const vua = (lines, text, scale) => (S && S.fitLines
        ? S.fitLines(lines, text, ov, { scale, box, widthRatio: rong })
        : lines);
    if (vi) {
        const lines = vi.lines && vi.lines.length ? vi.lines : [vi.text];
        blocks.push(block(vua(lines, vi.text || lines.join(" "), 1)));
    }
    if (origText && (state.dualMode || !vi)) {
        const scale = vi ? (s.origScale || 80) / 100 : 1;
        const css = vi
            ? `font-size:${scale.toFixed(2)}em;color:${s.origColor};font-weight:400;margin-top:0.12em;`
            : "opacity:0.85;";
        const b = block(vua([origText], origText, scale), css);
        if (vi && state.originalFirst) {
            b.style.marginTop = "0";
            b.style.marginBottom = "0.12em";
            blocks.unshift(b);
        } else {
            blocks.push(b);
        }
    }
    ov.replaceChildren(...blocks);
    ov.style.opacity = blocks.length ? "1" : "0";
}

function csRender() {
    const v = csVideo();
    const ov = document.querySelector(CS_OVERLAY);
    if (!v || !ov) return;
    // Coursera can switch its own captions back on; only one of us should be painting
    const track = state.activeTrack && state.activeTrack.track;
    if (track && track.mode !== "hidden") track.mode = "hidden";
    const box = csPlayerBox();
    if (box && cs.styleKey && !cs.styleKey.startsWith(`${box.clientWidth}x${box.clientHeight}|`)) csApplyOverlayStyle(ov);
    const t = v.currentTime;
    const vi = csFindCue(cs.viCues, t);
    const orig = csFindCue(cs.origCues, t);
    const key = `${vi ? vi.start : -1}|${state.dualMode && orig ? orig.start : -1}`;
    if (key === cs.renderKey) return;
    cs.renderKey = key;
    csPaint(ov, vi, orig ? orig.text : "");
}

// One frame per repaint while the tab is visible. A test harness (and any context without
// requestAnimationFrame) falls back to a plain 100 ms timer.
function csStartRender() {
    csOverlay();
    if (cs.raf || cs.timer) return;
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
    if (!raf) {
        cs.timer = setInterval(csRender, 100);
        return;
    }
    const tick = () => {
        if (!cs.raf) return;
        csRender();
        cs.raf = raf(tick);
    };
    cs.raf = raf(tick);
}

function csStopRender() {
    if (cs.raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(cs.raf);
    if (cs.timer) clearInterval(cs.timer);
    cs.timer = 0;
    cs.raf = 0;
    cs.renderKey = "";
    const ov = document.querySelector(CS_OVERLAY);
    if (ov) ov.remove();
    const track = state.activeTrack && state.activeTrack.track;
    if (track && track.mode === "hidden") track.mode = "showing";
}

// What the transcript panel needs from this player: the same two lists the overlay draws from.
// ---- The viewer's own corrections (subtitle-edits.js) ----
function csEditKey() {
    return currentVideoMeta().videoKey;
}

// Lay the stored edits over what the overlay draws (cs.viCues) and what the voice reads
// (state.dubGroups). They are separate objects on Coursera, so both lists are walked.
function csApplyEdits() {
    const E = window.CST_EDITS;
    if (!E) return 0;
    const n = E.sync(cs.edits, { groups: state.dubGroups, display: cs.viCues });
    if (n) { cs.renderKey = ""; E.notify(); }
    return n;
}

async function csLoadEdits() {
    const E = window.CST_EDITS;
    if (!E) return;
    cs.edits = await E.load(csEditKey());
    csApplyEdits();
}

function csTranscriptAdapter() {
    return {
        box: () => csPlayerBox(),
        videoEl: () => csVideo(),
        lines: () => (window.CST_TRANSCRIPT ? window.CST_TRANSCRIPT.mergeLines(cs.viCues, cs.origCues) : []),
        title: () => (document.querySelector("h1") || {}).textContent || document.title.replace(/\s*\|\s*Coursera.*$/i, ""),
        dual: () => !!state.dualMode,
        theme: () => state.uiTheme || "auto",
        saveEdit: async (line, text) => {
            cs.edits = await window.CST_EDITS.save(csEditKey(),
                { title: (document.querySelector("h1") || {}).textContent || document.title, url: location.href },
                line.start, text, line.machine);
            csApplyEdits();
        },
        onPanel: on => {
            cs.panelOpen = !!on;
            const ov = document.querySelector(CS_OVERLAY);
            if (ov) csApplyOverlayStyle(ov);
            cs.renderKey = "";
        }
    };
}

// How trustworthy the source captions are. Coursera labels machine-heard tracks "(auto)".
function csSubtitleSource() {
    const el = state.activeTrack;
    if (!el) return null;
    const label = `${el.label || ""} ${el.srclang || ""}`.toLowerCase();
    if (/auto/.test(label)) return { nhan: "Phụ đề máy nghe tự động", canhBao: true };
    return { nhan: "Phụ đề của khoá học", canhBao: false };
}

// ---- The quick menu, the same panel YouTube shows ----
function csOpenMenu(btn) {
    const box = csPlayerBox();
    const kit = window.CST_PLAYER_UI;
    if (!box || !kit) return;
    const open = box.querySelector(".cst-yt-menu");
    if (open) {
        if (open.cstDong) open.cstDong(); else open.remove();
        return;
    }
    kit.napCss(document);

    const el = (tag, cls, txt) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (txt != null) e.textContent = txt;
        return e;
    };
    const congTac = (nhan, onToggle) => {
        const row = el("button", "cst-row");
        row.type = "button";
        row.setAttribute("role", "switch");
        const label = el("span", "cst-row-label");
        label.appendChild(document.createTextNode(nhan));
        const sub = el("span", "cst-row-sub");
        label.appendChild(sub);
        row.appendChild(label);
        row.appendChild(el("span", "cst-sw"));
        row.addEventListener("click", () => { if (row.getAttribute("aria-disabled") !== "true") onToggle(row); });
        row.cstSub = sub;
        return row;
    };

    const menu = el("div", "cst-yt-menu");
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", "Dịch phụ đề và lồng tiếng");
    menu.dataset.cstGen = CS_GEN;
    menu.dataset.cstTheme = state.uiTheme || "auto";
    menu.style.bottom = `${(csControlGroup() || { height: 48 }).height + 22}px`;

    const head = el("div", "cst-menu-head");
    const mark = el("span", "cst-menu-mark");
    mark.innerHTML = kit.MARK_SVG;
    mark.style.color = "#FFFFFF";
    head.appendChild(mark);
    head.appendChild(el("span", "cst-menu-title", "Dịch & lồng tiếng Việt"));
    const x = el("button", "cst-menu-x", "✕");
    x.type = "button";
    x.setAttribute("aria-label", "Đóng");
    head.appendChild(x);
    menu.appendChild(head);

    const rowSub = congTac("Phụ đề tiếng Việt", async row => {
        if (state.active) { disableTranslation(); capNhat(); return; }
        row.setAttribute("aria-disabled", "true");
        capNhat();
        await enableTranslation();
        row.removeAttribute("aria-disabled");
        capNhat();
    });
    const rowDub = congTac("Lồng tiếng Việt", async row => {
        row.setAttribute("aria-disabled", "true");
        capNhat();
        await toggleDubbing(csPlayerBox() || document.body);
        row.removeAttribute("aria-disabled");
        capNhat();
    });
    menu.appendChild(rowSub);
    menu.appendChild(rowDub);

    const voiceBox = el("div", "cst-field");
    voiceBox.appendChild(el("div", "cst-field-label", "Chọn giọng"));
    const voiceSel = el("select", "cst-select");
    voiceSel.setAttribute("aria-label", "Giọng đọc tiếng Việt");
    const LOCAL = window.CST_COST && window.CST_COST.LOCAL_TTS;
    if (LOCAL) {
        for (const region of ["Nam", "Bắc", "Trung"]) {
            const ds = LOCAL.voices.filter(v => v.region === region);
            if (!ds.length) continue;
            const g = document.createElement("optgroup");
            g.label = `Giọng miền ${region}`;
            for (const v of ds) {
                const op = document.createElement("option");
                op.value = v.id;
                op.textContent = window.CST_COST && window.CST_COST.voiceLabel ? window.CST_COST.voiceLabel(v) : `${v.id} (${v.gender.toLowerCase()}, ${v.style})`;
                g.appendChild(op);
            }
            voiceSel.appendChild(g);
        }
        voiceSel.value = LOCAL.defaultVoice;
        try {
            chrome.storage.sync.get({ dubLocalVoice: "" }, r => { if (r && r.dubLocalVoice) voiceSel.value = r.dubLocalVoice; });
        } catch (e) { /* bỏ qua */ }
    }
    voiceSel.addEventListener("change", async () => {
        try { await chrome.storage.sync.set({ dubLocalVoice: voiceSel.value }); } catch (e) { /* bỏ qua */ }
        cstToast(`Đang chuyển sang giọng ${voiceSel.value}…`);
    });
    voiceBox.appendChild(voiceSel);
    menu.appendChild(voiceBox);
    const volume = kit.buildVolumeControls(document);
    menu.appendChild(volume.el);

    const modeBox = el("div", "cst-field");
    modeBox.appendChild(el("div", "cst-field-label", "Kiểu hiển thị"));
    const seg = el("div", "cst-seg");
    const btnSingle = el("button", null, "Chỉ tiếng Việt");
    const btnDual = el("button", null, "Song ngữ");
    [btnSingle, btnDual].forEach(b => { b.type = "button"; seg.appendChild(b); });
    modeBox.appendChild(seg);
    menu.appendChild(modeBox);

    const S = window.CST_STYLE;
    const size = kit.buildStepper(document, {
        label: "Cỡ chữ", min: 50, max: 250, step: 10,
        get: () => (S ? S.normalizeStyle(state.subStyle).fontSize : 90),
        set: n => {
            // carry the current display mode: the storage listener reads subStyle.mode back into
            // dualMode, and a stale mode here would silently flip bilingual off (BACKLOG item 2)
            state.subStyle = { ...(state.subStyle || {}), fontSize: n, mode: state.dualMode ? "dual" : "single" };
            csRestyle();
            try { return chrome.storage.sync.set({ subStyle: state.subStyle }); } catch (e) { return null; }
        },
        format: n => `${n}%`
    });
    menu.appendChild(size.el);

    const foot = el("div", "cst-menu-foot");
    const btnTranscript = el("button", null, "Bản chép lời");
    btnTranscript.type = "button";
    btnTranscript.title = "Xem toàn bộ lời thoại, bấm một dòng để nhảy tới, xuất tệp .srt";
    btnTranscript.addEventListener("click", () => {
        if (window.CST_TRANSCRIPT) window.CST_TRANSCRIPT.toggle(csTranscriptAdapter());
        dong();
    });
    const btnOptions = el("button", null, "Cài đặt");
    btnOptions.type = "button";
    foot.appendChild(btnTranscript);
    foot.appendChild(btnOptions);
    menu.appendChild(foot);

    const datKieuHienThi = async dual => {
        state.dualMode = dual;
        cs.renderKey = "";
        try { await chrome.storage.sync.set({ dualMode: dual }); } catch (e) { /* bỏ qua */ }
        capNhat();
    };
    btnSingle.addEventListener("click", () => datKieuHienThi(false));
    btnDual.addEventListener("click", () => datKieuHienThi(true));
    btnOptions.addEventListener("click", () => {
        try { chrome.runtime.sendMessage({ action: "openOptions" }); } catch (e) { /* bỏ qua */ }
    });

    function capNhat() {
        const dubApi = window.CST_DUB;
        const isDub = !!(dubApi && dubApi.dub && dubApi.dub.enabled);
        rowSub.setAttribute("aria-checked", String(!!state.active));
        const nguon = csSubtitleSource();
        const hauTo = state.active && nguon ? ` · ${nguon.nhan.toLowerCase()}` : "";
        rowSub.cstSub.textContent = (state.busy ? "Đang dịch…" : state.active ? "Đang bật" : "Đang tắt") + hauTo;
        rowSub.cstSub.style.color = state.active && nguon && nguon.canhBao ? "var(--cst-warn)" : "";
        rowDub.setAttribute("aria-checked", String(isDub));
        const st = dubApi && dubApi.dub ? dubApi.dub.lastStatus : null;
        const suc = isDub && dubApi.describeHealth ? dubApi.describeHealth() : null;
        rowDub.cstSub.textContent = isDub ? (suc ? suc.text : "Đang bật") : "Đang tắt";
        rowDub.cstSub.style.color = suc && suc.warn ? "var(--cst-warn)" : "";
        volume.el.style.display = isDub ? "block" : "none";
        volume.refresh();
        size.refresh();
        btnSingle.setAttribute("aria-pressed", String(!state.dualMode));
        btnDual.setAttribute("aria-pressed", String(!!state.dualMode));
        const localProv = !st || st.provider === "vieneu";
        voiceBox.style.display = localProv ? "block" : "none";
        if (localProv && st && st.voice && voiceSel.value !== st.voice) voiceSel.value = st.voice;
        csUpdateButton();
    }
    capNhat();
    const nhip = setInterval(capNhat, 700);

    // Two sections, each holding only its own controls: what is on the page, then what is spoken
    if (kit.buildSection) {
        [head, kit.buildSection(document, "Phụ đề"), rowSub, modeBox, size.el,
            kit.buildSection(document, "Giọng đọc"), rowDub, voiceBox, volume.el, foot].forEach(n => menu.appendChild(n));
    }
    box.appendChild(menu);
    btn.setAttribute("aria-expanded", "true");
    const dong = () => {
        clearInterval(nhip);
        menu.remove();
        document.removeEventListener("click", onDocClick);
        document.removeEventListener("keydown", onKeyDown);
        btn.setAttribute("aria-expanded", "false");
        try { btn.focus(); } catch (e) { /* bỏ qua */ }
    };
    menu.cstDong = dong;
    const onDocClick = e => { if (!menu.contains(e.target) && !btn.contains(e.target)) dong(); };
    const onKeyDown = e => { if (e.key === "Escape") { e.stopPropagation(); dong(); } };
    setTimeout(() => {
        document.addEventListener("click", onDocClick);
        document.addEventListener("keydown", onKeyDown);
    }, 0);
    x.addEventListener("click", dong);
}

async function toggleDubbing(container) {
    const api = window.CST_DUB;
    if (!api) {
        cstToast("Không nạp được phần lồng tiếng. Hãy tải lại trang rồi thử lại.", { warn: true });
        return;
    }

    if (api.dub.enabled) {
        api.stop();
        csUpdateButton();
        rememberDub(false);
        return;
    }

    // Long tieng doc tu ban dich co ngu canh, nen phai dich truoc
    if (!state.active) {
        // Không hỏi bằng hộp thoại chặn trang: người dùng vừa bấm lồng tiếng nghĩa là đồng ý dịch
        cstToast("Đang dịch phụ đề để lồng tiếng…");
        await enableTranslation();
        if (!state.active) return;
    }

    const videoEl = container.querySelector("video") || document.querySelector("video");
    const ok = await api.start({ video: videoEl, container, getGroups: () => state.dubGroups || [] });
    csUpdateButton();
    if (ok) rememberDub(true);
}

// Nhớ bật/tắt lồng tiếng (cùng khóa với ô trong popup) để bài sau tự bật
function rememberDub(on) {
    state.dubEnabled = !!on;
    try { chrome.storage.sync.set({ dubEnabled: !!on }); } catch (e) { /* bỏ qua */ }
}

// Coursera: đã dịch xong và lồng tiếng đang được bật -> tự bật, không hộp thoại
async function courseraAutoDub() {
    const api = window.CST_DUB;
    if (getCurrentSite() !== "coursera" || !state.dubEnabled || !api || api.dub.enabled || state.dubStarting || !state.active) return false;
    const videoEl = document.querySelector("video");
    if (!videoEl) return false;
    const icon = document.querySelector(`.cst-dub-icon[data-cst-gen="${CS_GEN}"]`);
    const container = (icon && icon.parentElement) || videoEl.parentElement;
    state.dubStarting = true;
    try {
        const ok = await api.start({ video: videoEl, container, getGroups: () => state.dubGroups || [], quiet: true });
        csUpdateButton();
        return ok;
    } finally {
        state.dubStarting = false;
    }
}

function watchNavigation() {
    const checkUrl = () => {
        if (location.href !== state.currentUrl) {
            console.log("Da chuyen bai giang, dat lai trang thai");
            state.currentUrl = location.href;
            if (window.CST_DUB && window.CST_DUB.dub.enabled) window.CST_DUB.stop();
            state.active = false;
            state.originalCueTexts = null;
            state.activeTrack = null;
            csStopRender();
            setTimeout(() => { csCreateButton(); courseraAutoTranslate(); }, 1500);
        }
    };
    const interval = setInterval(checkUrl, 1000);
    state.intervals.push(interval);
    window.addEventListener("popstate", checkUrl);
}


// Nap tu dien: gop cac nhom nganh dang bat voi danh sach nguoi dung tu them
async function loadGlossary() {
    const groups = (typeof CST_GLOSSARY_GROUPS !== "undefined") ? CST_GLOSSARY_GROUPS : {};
    const defaultNorm = (typeof CST_DEFAULT_NORMALIZE !== "undefined") ? CST_DEFAULT_NORMALIZE : [];
    const allGroupKeys = Object.keys(groups);

    try {
        const saved = await chrome.storage.sync.get({
            glossaryEnabled: true,
            enabledGroups: allGroupKeys,
            userKeep: "",
            userNormalize: ""
        });

        state.glossaryEnabled = saved.glossaryEnabled;

        // Gom thuat ngu tu cac nhom nganh dang bat
        const fromGroups = [];
        for (const key of saved.enabledGroups) {
            if (groups[key] && Array.isArray(groups[key].terms)) {
                fromGroups.push(...groups[key].terms);
            }
        }

        // Thuat ngu nguoi dung tu them, moi dong mot tu
        const userKeep = saved.userKeep
            .split("\n")
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith("#"));

        // Quy tac dich rieng: "tu goc => dang muon hien"
        // Ve trai duoc bao ve, khi khoi phuc thi dien ve phai
        state.glossaryTranslateAs = new Map();
        const userTerms = [];
        saved.userNormalize
            .split("\n")
            .map(s => s.trim())
            .filter(s => s.includes("=>"))
            .forEach(line => {
                const [from, to] = line.split("=>").map(p => p.trim());
                if (!from || !to) return;
                userTerms.push(from);
                state.glossaryTranslateAs.set(from.toLowerCase(), to);
            });

        state.glossaryKeep = [...new Set([...userKeep, ...userTerms, ...fromGroups])];
        // Thuat ngu nhieu tu (dang hien thi cuoi cung) de bo phan doan khong cat doi
        state.glossaryMultiTerms = [...new Set([
            ...state.glossaryKeep,
            ...state.glossaryTranslateAs.values()
        ])].filter(t => /\s/.test(String(t).trim()));
        state.glossaryNormalize = defaultNorm;

        rebuildGlossaryRegex();
    } catch (err) {
        console.warn("Khong nap duoc tu dien:", err.message);
        state.glossaryKeep = [];
        state.glossaryNormalize = defaultNorm;
    }
}

async function loadSettings() {
    try {
        const saved = await chrome.storage.sync.get({
            dualMode: false, perCueMode: false, styleOriginal: false, originalFirst: false,
            dubVoiceName: "", dubDuck: 0.12, dubAutoRate: true,
            subStyle: null, costMode: "balanced", autoTranslate: true, dubEnabled: true,
            uiTheme: "auto"
        });
        state.dubEnabled = saved.dubEnabled !== false;
        state.costMode = saved.costMode;
        state.autoTranslate = saved.autoTranslate !== false;
        state.dualMode = saved.dualMode;
        state.uiTheme = saved.uiTheme || "auto";
        state.perCueMode = saved.perCueMode;
        state.styleOriginal = saved.styleOriginal;
        state.originalFirst = saved.originalFirst;
        state.dubVoiceName = saved.dubVoiceName;
        state.dubDuck = saved.dubDuck;
        state.dubAutoRate = saved.dubAutoRate;
        if (saved.subStyle) {
            state.subStyle = saved.subStyle;
            if (saved.subStyle.mode) {
                state.dualMode = saved.subStyle.mode === "dual";
            }
        }
        await loadGlossary();
    } catch (err) {
        console.warn("Khong doc duoc tuy chon da luu:", err.message);
    }
}

async function init() {
    await loadSettings();

    // Lắng nghe thay đổi cài đặt từ options để cập nhật ngay
    try {
        // An edit saved in another tab or in Settings shows here at once (reverts included)
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== "local" || !window.CST_EDITS) return;
            const ch = changes[window.CST_EDITS.keyOf(csEditKey())];
            if (!ch) return;
            cs.edits = ch.newValue || null;
            csApplyEdits();
        });
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "sync") {
                if (changes.subStyle) {
                    state.subStyle = changes.subStyle.newValue;
                    if (changes.subStyle.newValue?.mode) {
                        state.dualMode = changes.subStyle.newValue.mode === "dual";
                    }
                    injectCueStyle();
                    repositionCues();
                    csRestyle();
                }
                if (changes.dualMode) {
                    state.dualMode = changes.dualMode.newValue;
                    cs.renderKey = "";            // repaint now, not at the next cue
                }
                if (changes.costMode) state.costMode = changes.costMode.newValue;
                if (changes.autoTranslate) state.autoTranslate = changes.autoTranslate.newValue !== false;
                // Tu dien thay doi: ap dung cho cac cau dich tiep theo, khong can tai lai trang
                if (changes.glossaryEnabled || changes.enabledGroups || changes.userKeep || changes.userNormalize) {
                    loadGlossary();
                }
                // Long tieng: cap nhat giong, muc giam am va toc do doc ngay
                if (changes.dubVoiceName) state.dubVoiceName = changes.dubVoiceName.newValue;
                if (changes.dubDuck) state.dubDuck = changes.dubDuck.newValue;
                if (changes.dubAutoRate) state.dubAutoRate = changes.dubAutoRate.newValue;
                if (changes.dubEnabled) {
                    state.dubEnabled = changes.dubEnabled.newValue !== false;
                    if (getCurrentSite() === "coursera") {
                        if (state.dubEnabled) courseraAutoDub();
                        else if (window.CST_DUB && window.CST_DUB.dub.enabled) { window.CST_DUB.stop(); csUpdateButton(); }
                    }
                }
                // (dubbing.js tự áp dụng thay đổi giọng / mức âm cho engine lồng tiếng đang chạy)
            }
        });
    } catch (e) {}

    // Tren YouTube, youtube.js dam nhiem phan giao dien va dich
    if (getCurrentSite() === "youtube") {
        console.log("Dang o YouTube, phan xu ly do youtube.js dam nhiem");
        return;
    }
    injectCueStyle();
    csCreateButton();

    const observer = new MutationObserver(() => {
        if (state.dead) return;
        // Coursera rebuilds its control bar on navigation; put the button back when it does
        if (!document.querySelector(CS_BTN)) csCreateButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    state.observers.push(observer);

    watchNavigation();
    courseraAutoTranslate();
    // Tiện ích vừa được Tải lại: mã này mất kết nối -> tự tắt gọn (mã mới được nạp lại vào tab)
    const kt = setInterval(() => {
        let ok = false;
        try { ok = !!(chrome.runtime && chrome.runtime.id); } catch (e) { ok = false; }
        if (ok) return;
        clearInterval(kt);
        state.dead = true;
        try { if (window.CST_DUB) window.CST_DUB.stop(); } catch (e) { /* bỏ qua */ }
        try { if (state.active) disableTranslation(); } catch (e) { /* bỏ qua */ }
        state.observers.forEach(o => { try { o.disconnect(); } catch (e) { /* bỏ qua */ } });
        document.querySelectorAll(`[data-cst-gen="${CS_GEN}"]`).forEach(el => el.remove());
        state.autoTranslate = false;
    }, 1500);
}

// ---------- Tự động dịch bài giảng (Coursera) ----------
// Chỉ khi phụ đề KHÔNG phải tiếng Việt và nhận diện đủ chắc (nhận diện trên máy,
// không gọi Gemini). Tắt "Tự động dịch" thì vẫn bấm nút dịch tay được.
async function courseraAutoTranslate() {
    if (!state.autoTranslate || state.active || state.busy) return null;
    const url = location.href;
    if (state.autoTriedUrl === url) return null;
    let picked = null;
    for (let i = 0; i < 30 && !(picked = pickBestTrack()); i++) await sleep(500);   // chờ trình phát nạp track
    if (location.href !== url || state.active || state.busy) return null;
    state.autoTriedUrl = url;
    if (!picked) return null;
    const LANG = window.CST_LANG;
    let decision;
    if (picked.alreadyVietnamese) {
        decision = { lang: "vi", confidence: 0.9, source: "metadata", action: "skip" };
    } else {
        const tr = picked.track.track;
        const was = tr.mode;
        if (was === "disabled") tr.mode = "hidden";              // nạp nội dung để lấy mẫu, không hiện lên
        const cues = await waitForCues(tr, 6000);
        if (was === "disabled" && !state.active) tr.mode = was;
        const sample = cues ? Array.from(cues).slice(0, 40).map(plainCueText).join(" ") : "";
        decision = LANG ? LANG.decide({ metaLang: picked.track.srclang, sample }) : { lang: "unknown", confidence: 0, source: "none", action: "unsure" };
    }
    state.langDecision = decision;
    console.log(`[AI Subtitle] Ngôn ngữ phụ đề: ${decision.lang} (${Math.round(decision.confidence * 100)}%, theo ${decision.source}) -> ${decision.action === "translate" ? "tự động dịch" : decision.action === "skip" ? "đã là tiếng Việt, không dịch" : "chưa chắc chắn, không tự dịch"}`);
    if (decision.action === "translate") {
        await enableTranslation();
        if (state.active) await courseraAutoDub();
    }
    return decision;
}

// Phím tắt: bật/tắt phụ đề (Alt+S) và lồng tiếng (Alt+D) ngay trên trang đang xem,
// luôn báo lại bằng một thẻ nhỏ để người dùng biết phím vừa ăn
async function xuLyPhimTat(command, site) {
    const dubApi = window.CST_DUB;
    if (site === "youtube") {
        if (typeof yt === "undefined" || !yt.videoEl) { cstToast("Hãy mở một video YouTube trước."); return { ok: false }; }
        if (command === "bat-tat-phu-de") {
            if (yt.active) { ytTatDich(); cstToast("Đã tắt phụ đề tiếng Việt."); return { ok: true, on: false }; }
            cstToast("Đang dịch phụ đề sang tiếng Việt…");
            const ok = await ytBatDauDich();
            ytDatTrangThaiNut(ok ? "on" : "idle");
            if (ok) cstToast("Đã bật phụ đề tiếng Việt.");
            return { ok };
        }
        if (command === "bat-tat-long-tieng") {
            const player = document.querySelector("#movie_player") || document.querySelector(".html5-video-player");
            const dangBat = !!(dubApi && dubApi.dub.enabled);
            if (!dangBat) cstToast("Đang chuẩn bị lồng tiếng Việt…");
            await ytChuyenLongTieng(player);
            cstToast(dubApi && dubApi.dub.enabled ? "Đã bật lồng tiếng Việt." : "Đã tắt lồng tiếng Việt.");
            return { ok: true };
        }
        return { ok: false };
    }
    if (command === "bat-tat-phu-de") {
        if (state.active) { disableTranslation(); cstToast("Đã tắt phụ đề tiếng Việt."); return { ok: true, on: false }; }
        cstToast("Đang dịch phụ đề sang tiếng Việt…");
        await enableTranslation();
        return { ok: true };
    }
    if (command === "bat-tat-long-tieng") {
        if (!dubApi) { cstToast("Trang này chưa bật được lồng tiếng."); return { ok: false }; }
        if (dubApi.dub.enabled) { dubApi.stop(); rememberDub(false); cstToast("Đã tắt lồng tiếng Việt."); return { ok: true, on: false }; }
        cstToast("Đang chuẩn bị lồng tiếng Việt…");
        const videoEl = document.querySelector("video");
        await toggleDubbing((videoEl && videoEl.parentElement) || document.body);
        const on = !!(window.CST_DUB && window.CST_DUB.dub.enabled);
        cstToast(on ? "Đã bật lồng tiếng Việt." : "Chưa bật được lồng tiếng trên trang này.", { warn: !on });
        return { ok: on };
    }
    return { ok: false };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const site = getCurrentSite();
    if (request.method === "translate") {
        state.dualMode = !!request.dualMode;
        state.perCueMode = !!request.perCueMode;
        state.styleOriginal = !!request.styleOriginal;
        state.originalFirst = !!request.originalFirst;
        if (request.dubEnabled !== undefined) {
            state.dubEnabled = !!request.dubEnabled;

        }
        injectCueStyle();

        if (site === "youtube") {
            if (typeof ytNapCaiDatKieu === "function") ytNapCaiDatKieu();
            if (typeof ytBatDauDich === "function") {
                ytBatDauDich().then(ok => {
                    if (ok && typeof ytTuBatLongTieng === "function") ytTuBatLongTieng();
                    sendResponse({ method: "translate", status: ok ? "success" : "failed" });
                }).catch(err => {
                    console.error("Lỗi kích hoạt YouTube:", err);
                    sendResponse({ method: "translate", status: "error", message: err.message });
                });
                return true;
            }
        }

        if (!state.active) enableTranslation();
        sendResponse({ method: "translate", status: "success" });
        return true;
    }
    if (request.method === "phimTat") {
        xuLyPhimTat(request.command, site).then(sendResponse, () => sendResponse({ ok: false }));
        return true;
    }
    if (request.method === "forgetVideoAudio") {
        if (!window.CST_DUB || !window.CST_DUB.forgetVideoAudio) { sendResponse({ ok: false, error: "Chưa bật lồng tiếng" }); return true; }
        window.CST_DUB.forgetVideoAudio().then(sendResponse, e => sendResponse({ ok: false, error: e.message }));
        return true;
    }
    if (request.method === "getStatus") {
        // Bảng điều khiển hiện trạng thái THẬT của trang đang xem: đang dịch tới đâu, đang đọc
        // bằng giọng nào (trước đây chỉ có bật/tắt nên bấm xong không biết chuyện gì đang xảy ra)
        const dubApi = window.CST_DUB;
        const st = dubApi && dubApi.dub ? dubApi.dub.lastStatus : null;
        const health = dubApi && dubApi.describeHealth ? dubApi.describeHealth() : null;
        const dub = { on: !!(dubApi && dubApi.dub && dubApi.dub.enabled), voice: (st && st.voice) || "", label: (st && st.label) || "", health: health ? health.text : "", warn: !!(health && health.warn) };
        const title = site === "youtube"
            ? document.title.replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube\s*$/i, "").trim()
            : ((document.querySelector("h1") || {}).textContent || document.title.replace(/\s*\|\s*Coursera.*$/i, "")).trim();
        const demXong = gs => (gs || []).filter(g => g && g.viText).length;
        if (site === "youtube" && typeof yt !== "undefined") {
            const gs = (typeof ytNhomLongTieng === "function" ? ytNhomLongTieng() : yt.groups) || [];
            sendResponse({ site, title, active: yt.active, busy: yt.busy, dub, xong: demXong(gs), tong: gs.length });
            return true;
        }
        const gs = state.dubGroups || [];
        sendResponse({ site, title, active: state.active, busy: state.busy, dub, xong: demXong(gs), tong: gs.length });
        return true;
    }
});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
