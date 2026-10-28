// GIAO DIỆN & THAO TÁC (1.4.0): phím tắt, thông báo không chặn trang, bàn phím.
// Hướng dẫn của Chrome: tiện ích phải dùng được bằng bàn phím, thấy rõ phần tử đang chọn,
// có phím tắt cho việc hay dùng và nói cho người dùng biết phím tắt đó trong trang Cài đặt.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { bgEnv, read } = require("./bg-env.js");

const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// 2.5.7: no shortcut out of the box. The viewer sets each one in Settings ("Tùy chỉnh"), and the
// page itself reads the keys (Chrome's own command shortcuts cannot be set from an extension page).
const SC = require("../shortcuts.js");

test("shortcuts: none by default, no Chrome command keys, the page reads them, Settings records them", () => {
    const m = JSON.parse(R("manifest.json"));
    assert.equal(m.commands, undefined, "a fixed default key came back");
    // "unlimitedStorage" (2.4.0): 100 saved videos pass the 10 MB of storage.local; no install warning
    assert.equal(JSON.stringify(m.permissions), JSON.stringify(["storage", "unlimitedStorage", "activeTab", "scripting"]));
    const js = m.content_scripts.find(g => (g.js || []).includes("content.js")).js;
    assert.ok(js.indexOf("shortcuts.js") > -1 && js.indexOf("shortcuts.js") < js.indexOf("content.js"));
    assert.match(R("content.js"), /K\.actionFor\(e, cstShortcuts\)/);
    assert.match(R("options.html"), /id="shortcutList"/);
    assert.match(R("options.js"), /Tùy chỉnh/);
    for (const f of ["options.html", "popup.html", "youtube.js", "content.js"]) assert.doesNotMatch(R(f), /"Alt\+S"|<b>Alt\+S<\/b>|Alt<\/kbd>\+<kbd>S/, f);
    assert.deepEqual(SC.clean(undefined), {}, "nothing set means nothing listens");
});

test("shortcuts: physical keys, shown the Mac way or the Windows way", () => {
    // Option+S types "ß" on a Mac: the key code is what counts
    const ev = { code: "KeyS", key: "ß", altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, target: { tagName: "DIV" } };
    const combo = SC.fromEvent(ev);
    assert.equal(SC.format(combo, true), "⌥S");
    assert.equal(SC.format(combo, false), "Alt+S");
    assert.equal(SC.format({ code: "KeyD", ctrl: true, shift: true, meta: true }, true), "⌃⇧⌘D");
    assert.equal(SC.format({ code: "Digit1", ctrl: true, shift: true }, false), "Ctrl+Shift+1");
    assert.equal(SC.actionFor(ev, { "bat-tat-phu-de": combo }), "bat-tat-phu-de");
    assert.equal(SC.actionFor({ ...ev, target: { tagName: "INPUT" } }, { "bat-tat-phu-de": combo }), "", "typing in a field is not a shortcut");
    assert.equal(SC.actionFor({ ...ev, shiftKey: true }, { "bat-tat-phu-de": combo }), "", "Shift makes another combination");
    assert.equal(SC.fromEvent({ code: "AltLeft", altKey: true }), null, "a lone modifier is no combination");
});

test("shortcuts: a key alone, a browser key or one already used is refused with a reason", () => {
    assert.match(SC.problem({ code: "KeyS" }, {}, "bat-tat-phu-de", true), /⌘ Command/);
    assert.match(SC.problem({ code: "KeyS", shift: true }, {}, "bat-tat-phu-de", false), /Ctrl hoặc Alt/);
    assert.equal(SC.problem({ code: "F8" }, {}, "bat-tat-phu-de", false), "", "a function key alone is fine");
    assert.match(SC.problem({ code: "KeyW", meta: true }, {}, "bat-tat-phu-de", true), /phím của trình duyệt/);
    assert.match(SC.problem({ code: "KeyT", ctrl: true }, {}, "bat-tat-phu-de", false), /phím của trình duyệt/);
    const used = { "bat-tat-long-tieng": { code: "KeyD", alt: true } };
    assert.match(SC.problem({ code: "KeyD", alt: true }, used, "bat-tat-phu-de", false), /lồng tiếng/);
    assert.equal(SC.problem({ code: "KeyD", alt: true }, used, "bat-tat-long-tieng", false), "", "setting the same key again on its own action");
    assert.equal(SC.problem({ code: "KeyS", alt: true }, used, "bat-tat-phu-de", false), "");
    assert.deepEqual(Object.keys(SC.clean({ "bat-tat-phu-de": { code: "KeyS", alt: 1 }, junk: { code: "KeyA" }, "bat-tat-long-tieng": { code: "ShiftLeft" } })), ["bat-tat-phu-de"]);
});

test("không dùng hộp thoại chặn trang (alert / confirm) trên trang người dùng đang xem", () => {
    for (const f of ["content.js", "youtube.js", "dubbing.js"]) {
        const src = R(f);
        assert.doesNotMatch(src, /window\.alert\(/, `${f} còn hộp thoại alert chặn trang`);
        assert.doesNotMatch(src, /(^|[^.\w])confirm\(/m, `${f} còn hộp thoại confirm chặn trang`);
        assert.doesNotMatch(src, /(^|[^.\w])prompt\(/m, `${f} còn hộp thoại prompt`);
    }
    // Trang Cài đặt vẫn được hỏi xác nhận trước khi XÓA dữ liệu (đó là việc đúng)
    assert.match(R("options.js"), /confirm\(/);
});

test("bàn phím: viền tiêu điểm rõ và tôn trọng chế độ giảm chuyển động", () => {
    for (const f of ["popup.css", "options.html"]) {
        const src = R(f);
        assert.match(src, /:focus-visible/, `${f} chưa có viền cho phần tử đang chọn`);
        assert.match(src, /prefers-reduced-motion/, `${f} chưa tôn trọng giảm chuyển động`);
    }
});

test("nút trên thanh điều khiển YouTube: báo trạng thái bật/tắt; thực đơn đóng bằng Esc và bấm được bằng bàn phím", () => {
    const src = R("youtube.js");
    assert.match(src, /aria-pressed/, "nút chưa báo trạng thái cho trình đọc màn hình");
    assert.match(src, /aria-expanded/, "chưa báo thực đơn đang mở");
    assert.match(src, /e\.key === "Escape"/, "thực đơn chưa đóng bằng Esc");
    assert.match(src, /setAttribute\("role", "switch"\)/, "các dòng bật/tắt phải là công tắc thật");
    assert.match(src, /trapTab\(menu, e\)/, "Tab phải chạy vòng trong thực đơn");
});

// Thẻ thông báo dựng bằng DOM thật của trang: phải hiện trong trình phát, đọc được bằng
// trình đọc màn hình, có nút thao tác, và TỰ ẩn (không chặn người xem như alert)
test("thông báo nhỏ: hiện trong trình phát, có role=status, nút thao tác chạy đúng, tự ẩn", async () => {
    const dom = miniDom();
    const sb = loadContent(dom);
    let bam = 0;
    const box = sb.CST_UI.toast("Máy chủ giọng chưa chạy", { warn: true, actionLabel: "Thử lại", onAction: () => bam++, ms: 30 });
    assert.ok(box, "không dựng được thẻ thông báo");
    assert.equal(box.parent.id, "movie_player", "thông báo phải nằm trong trình phát");
    assert.equal(box.attrs["role"], "status");
    assert.equal(box.attrs["aria-live"], "polite");
    const btn = box.children.find(c => c.text === "Thử lại");
    assert.ok(btn, "thiếu nút thao tác");
    btn.fire("click");
    assert.equal(bam, 1, "bấm nút thao tác không chạy");
    assert.equal(box.parent, null, "bấm xong phải đóng thông báo");
    // Thông báo thứ hai không chồng lên thông báo cũ
    sb.CST_UI.toast("Một", { ms: 30 });
    sb.CST_UI.toast("Hai", { ms: 30 });
    assert.equal(dom.doc.querySelectorAll(".cst-toast").length, 1);
    await new Promise(r => setTimeout(r, 400));
    assert.equal(dom.doc.querySelectorAll(".cst-toast").length, 0, "thông báo phải tự ẩn");
});

// ---- DOM tối giản đủ cho thẻ thông báo ----
function miniDom() {
    class El {
        constructor(tag) { this.tagName = tag; this.children = []; this.parent = null; this.dataset = {}; this.style = { cssText: "" }; this.className = ""; this.attrs = {}; this.id = ""; this.listeners = {}; this.text = ""; this.doc = null; this.type = ""; this.value = ""; this.label = ""; }
        removeAttribute(k) { delete this.attrs[k]; }
        appendTextNode(t) { this.text += t; }
        appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
        replaceChildren(...kids) { this.children.forEach(c => { c.parent = null; }); this.children = []; this.text = ""; kids.forEach(k => this.appendChild(k)); }
        scrollTo() {}
        remove() { if (!this.parent) return; this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; }
        setAttribute(k, v) { this.attrs[k] = v; }
        getAttribute(k) { return this.attrs[k]; }
        addEventListener(n, f) { (this.listeners[n] = this.listeners[n] || []).push(f); }
        fire(n) { (this.listeners[n] || []).forEach(f => f({})); }
        set textContent(v) { this.text = v; this.children = []; }
        get textContent() { return this.text + this.children.map(c => c.textContent).join(""); }
        matches(sel) {
            return sel.split(",").map(x => x.trim()).some(one => {
                const m = one.match(/^([.#])([\w-]+)(?:\[([\w-]+)="([^"]*)"\])?$/);
                if (m) {
                    const hop = m[1] === "#" ? this.id === m[2] : this.className.split(/\s+/).includes(m[2]);
                    return hop && (m[3] == null || this.attrs[m[3]] === m[4]);
                }
                return one.toLowerCase() === this.tagName.toLowerCase();
            });
        }
        contains(el) { return el === this || this.all().includes(el); }
        focus() { this.doc.activeElement = this; }
        get classList() { const e = this; return { add: c => { e.className = (e.className + " " + c).trim(); }, remove: c => { e.className = e.className.split(/\s+/).filter(x => x !== c).join(" "); }, contains: c => e.className.split(/\s+/).includes(c), toggle() {} }; }
        all() { return this.children.flatMap(c => [c, ...c.all()]); }
        querySelectorAll(sel) { return this.all().filter(e => e.matches(sel)); }
        querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    }
    const doc = {
        createElement: t => new El(t), addEventListener() {}, readyState: "complete", title: "t",
        createTextNode: t => { const e = new El("#text"); e.text = t; return e; },
        querySelector: s => doc.documentElement.querySelector(s),
        querySelectorAll: s => doc.documentElement.querySelectorAll(s),
        getElementById: id => doc.documentElement.all().find(e => e.id === id) || null,
        getElementsByTagName: () => [],
        keyListeners: []
    };
    doc.documentElement = new El("html");
    doc.body = doc.documentElement.appendChild(new El("body"));
    doc.head = doc.documentElement.appendChild(new El("head"));
    doc.activeElement = null;
    const player = doc.body.appendChild(new El("div"));
    player.id = "movie_player";
    player.className = "html5-video-player";
    doc.addEventListener = (n, f) => { if (n === "keydown") doc.keyListeners.push(f); };
    doc.removeEventListener = (n, f) => { doc.keyListeners = doc.keyListeners.filter(x => x !== f); };
    // Phần tử mới tạo biết mình thuộc tài liệu nào (để focus() ghi lại activeElement)
    const goc = doc.createElement;
    doc.createElement = t => { const e = goc(t); e.doc = doc; return e; };
    return { doc, El, fireKey: key => doc.keyListeners.slice().forEach(f => f({ key, stopPropagation() {}, preventDefault() {}, shiftKey: false })) };
}

function loadContent(dom) {
    const noop = () => {};
    const sb = {
        console: { log: noop, warn: noop, error: noop }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
        requestAnimationFrame: f => f(), URL, Promise, Map, Set, Math, JSON, Date, RegExp, TextEncoder,
        location: { href: "https://www.youtube.com/watch?v=abc", hostname: "www.youtube.com", pathname: "/watch" },
        document: dom.doc, MutationObserver: class { observe() {} disconnect() {} }, addEventListener: noop, postMessage: noop,
        getComputedStyle: () => ({ position: "relative" }),
        chrome: {
            storage: { sync: { get: async d => d, set: async () => {} }, local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener: noop } },
            runtime: { id: "x", onMessage: { addListener: noop }, getURL: p => p, sendMessage: noop }
        }
    };
    sb.window = sb; sb.globalThis = sb;
    vm.createContext(sb);
    for (const f of ["glossary.js", "cst-cache.js", "cost-policy.js", "lang-detect.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js"]) vm.runInContext(read(f), sb);
    return sb;
}


// Thực đơn trên trình phát YouTube (ảnh phản hồi 23/09/2026): hai nhãn "BẬT" trông như nút bấm
// nhưng chỉ là chữ trạng thái, hai màu khác nhau cho cùng một ý, và trạng thái đứng im khi
// tiện ích đổi trạng thái sau lưng. Nay mỗi dòng là công tắc thật, tự cập nhật.
test("thực đơn trên video: dòng bật/tắt là công tắc thật, có chọn giọng, tự cập nhật, Esc đóng", async t => {
    const dom = miniDom();
    const sb = loadYouTube(dom);
    t.after(() => sb.donTimers());
    const player = dom.doc.querySelector("#movie_player");
    const btn = dom.doc.createElement("button");
    player.appendChild(btn);
    sb.ytMoMenuNhanh(player, btn);

    const menu = player.querySelector(".cst-yt-menu");
    assert.ok(menu, "không mở được thực đơn");
    assert.equal(menu.attrs["role"], "dialog");
    assert.equal(btn.attrs["aria-expanded"], "true");
    const rows = menu.querySelectorAll(".cst-row");
    // Reading order shares the subtitle and dubbing switches' keyboard semantics.
    assert.equal(rows.length, 3, "three switches: subtitles, reading order, dubbing");
    assert.ok(rows.every(r => r.attrs["role"] === "switch" && r.tagName === "button"), "mỗi dòng phải là công tắc bấm được bằng bàn phím");
    assert.ok(rows.every(r => r.attrs["aria-checked"] === "true" || r.attrs["aria-checked"] === "false"), "công tắc phải báo đang bật hay tắt");
    assert.ok(!/BẬT|TẮT/.test(menu.textContent), "không dùng nhãn chữ 'BẬT' trông như nút bấm");
    // 2.5.7: no shortcut is set out of the box, so the menu shows none
    assert.doesNotMatch(menu.textContent, /Alt\+|⌥/);

    // Chọn giọng ngay trong thực đơn (trước đây phải mở trang Cài đặt)
    const sel = menu.querySelector("select");
    assert.ok(sel && sel.all().some(o => o.value === "Mỹ Duyên"), "thiếu ô chọn giọng đọc");
    // Hiện GIỌNG ĐANG DÙNG, không phải giọng đầu danh sách
    assert.equal(sel.value, sb.CST_COST.LOCAL_TTS.defaultVoice);
    assert.notEqual(sel.value, sb.CST_COST.LOCAL_TTS.voices[0].id);

    // Trạng thái tự cập nhật: bật phụ đề sau lưng thực đơn thì công tắc phải đổi theo
    const rowSub = rows[0];
    assert.equal(rowSub.attrs["aria-checked"], "false");
    vm.runInContext("yt.active = true", sb);   // khai báo bằng const nên phải đặt từ bên trong máy ảo
    await new Promise(r => setTimeout(r, 900));
    assert.equal(rowSub.attrs["aria-checked"], "true", "công tắc không tự cập nhật khi trạng thái đổi");

    // Esc đóng, trả tiêu điểm về nút và ngừng nhịp cập nhật
    dom.fireKey("Escape");
    assert.equal(player.querySelector(".cst-yt-menu"), null, "Esc chưa đóng thực đơn");
    assert.equal(btn.attrs["aria-expanded"], "false");
    assert.equal(dom.doc.activeElement, btn, "đóng xong phải trả tiêu điểm về nút");
});

function loadYouTube(dom) {
    const noop = () => {};
    const timers = new Set();
    const sb = {
        console: { log: noop, warn: noop, error: noop }, clearTimeout, clearInterval: id => { timers.delete(id); clearInterval(id); },
        setTimeout: (f, ms) => { const id = setTimeout(f, ms); timers.add(id); return id; },
        setInterval: (f, ms) => { const id = setInterval(f, ms); timers.add(id); return id; },
        requestAnimationFrame: f => f(), URL, Promise, Map, Set, Math, JSON, Date, RegExp, TextEncoder, Array, Object, String, Number,
        // hostname KHÔNG phải youtube.com: ytKhoiDong() thoát ngay nên không có bộ đếm giờ nền
        // chạy mãi trong bài kiểm tra; đường dẫn vẫn là trang xem video để mã nhận đúng mã video
        location: { href: "https://www.youtube.com/watch?v=abc123", hostname: "test.local", pathname: "/watch" },
        document: dom.doc, MutationObserver: class { observe() {} disconnect() {} }, addEventListener: noop, postMessage: noop,
        getComputedStyle: () => ({ position: "relative" }), performance: { now: () => Date.now() },
        chrome: {
            storage: { sync: { get: async d => d, set: async () => {} }, local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener: noop } },
            runtime: { id: "x", onMessage: { addListener: noop }, getURL: p => p, sendMessage: noop }
        }
    };
    sb.window = sb; sb.globalThis = sb;
    vm.createContext(sb);
    for (const f of ["glossary.js", "cst-cache.js", "cost-policy.js", "lang-detect.js", "vi-segmenter.js", "subtitle-style.js", "player-ui.js", "transcript.js", "context-engine.js", "vi-quality.js", "content.js", "youtube.js"]) vm.runInContext(read(f), sb);
    sb.donTimers = () => { timers.forEach(id => { clearTimeout(id); clearInterval(id); }); timers.clear(); };
    return sb;
}

// "Luôn sẵn sàng" (1.4.2): máy chủ giọng VieNeu tự chạy cùng máy, và nếu lúc bật lồng tiếng nó
// chưa lên thì tiện ích TỰ chuyển về giọng VieNeu ngay khi máy chủ sẵn sàng, không bắt bấm gì
test("VieNeu chưa chạy: đọc tạm bằng giọng khác rồi TỰ chuyển về VieNeu khi máy chủ sẵn sàng", async t => {
    const msgs = [];
    let chay = false;                                   // máy chủ VieNeu: lúc đầu chưa chạy
    const env = dubbingEnvLocal(msgs, m => (m.action === "localTtsStatus" ? { ok: true, running: chay } : { ok: false }));
    t.after(() => { try { env.CST_DUB.stop(); } catch (e) { /* bỏ qua */ } });   // luôn dọn bộ đếm giờ
    vm.runInContext("window.CST_DUB_WATCH_MS = 30;", env);      // hỏi lại mỗi 30 ms cho nhanh
    const video = new (require("./dub-sim.js").FakeVideo)();
    video.play();
    const groups = () => require("./dub-sim.js").lectureGroups();
    assert.equal(await env.CST_DUB.start({ video, getGroups: groups }), true);
    assert.notEqual(env.CST_DUB.dub.engine.provider.id, "vieneu", "chưa chạy thì phải dùng giọng khác");
    chay = true;                                        // người dùng (hoặc dịch vụ tự khởi động) bật máy chủ
    for (let i = 0; i < 40 && env.CST_DUB.dub.engine.provider.id !== "vieneu"; i++) await new Promise(r => setTimeout(r, 30));
    assert.equal(env.CST_DUB.dub.engine.provider.id, "vieneu", "không tự chuyển về giọng VieNeu");
    env.CST_DUB.stop();
});

test("máy chủ VieNeu tự chạy cùng máy: có sẵn tệp cài đặt một lần, trang Cài đặt hướng dẫn đúng tệp đó", () => {
    const sh = R("tools/vieneu-autostart.command");
    assert.match(sh, /com\.damduy\.vieneu/);
    assert.match(sh, /<key>RunAtLoad<\/key>\s*<true\/>/, "phải chạy khi đăng nhập");
    assert.match(sh, /<key>KeepAlive<\/key>\s*<true\/>/, "phải tự bật lại khi bị tắt");
    assert.match(sh, /--uninstall/, "phải có cách gỡ");
    assert.match(R("options.js"), /vieneu-autostart\.command/, "trang Cài đặt phải chỉ tới tệp cài một lần");
    assert.doesNotMatch(R("options.js"), /Nhấp đúp tệp <b>\$\{LOCAL\.startScript\}/, "không còn bắt người dùng tự bật mỗi lần");
});

test("giao diện Sáng / Tối: chọn tay thắng cài đặt của máy, hai trang dùng chung lựa chọn", () => {
    for (const f of ["popup.css", "options.html"]) {
        const src = R(f);
        assert.match(src, /:root:not\(\[data-theme="light"\]\)/, `${f}: chọn Sáng phải thắng chế độ tối của máy`);
        assert.match(src, /:root\[data-theme="dark"\]/, `${f}: thiếu bảng màu tối khi chọn tay`);
    }
    const th = R("theme.js");
    assert.match(th, /uiTheme/, "phải lưu lựa chọn để hai trang dùng chung");
    assert.match(th, /localStorage/, "phải áp dụng ngay khi mở trang (không nháy màu)");
    for (const f of ["popup.html", "options.html"]) {
        const head = R(f).split("</head>")[0];
        assert.match(head, /theme\.js/, `${f}: phải nạp theme.js trong <head> để không nháy màu`);
    }
    assert.match(R("options.html"), /data-theme-set="light"/);
    assert.match(R("options.html"), /data-theme-set="auto"/);
    // Không còn màu tô cứng làm nút tàng hình ở giao diện sáng
    assert.doesNotMatch(R("popup.html"), /color: #FAF9F5; cursor: pointer/);
});

function dubbingEnvLocal(msgs, onMsg) {
    const noop = () => {};
    const voices = [{ name: "Linh", lang: "vi-VN", localService: true }];
    const sb = {
        console: { log: noop, warn: noop, error: noop }, setTimeout, clearTimeout, setInterval, clearInterval,
        Promise, Map, Set, Math, JSON, Date, TextEncoder, crypto: globalThis.crypto, atob, btoa, URL,
        performance: { now: () => Date.now() }, location: { href: "https://www.youtube.com/watch?v=abc", pathname: "/watch" },
        document: { title: "t", hidden: false, querySelector: () => null, querySelectorAll: () => [] },
        speechSynthesis: { getVoices: () => voices, speak: noop, cancel: noop, addEventListener: noop },
        SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
        chrome: {
            storage: { sync: { get: async d => ({ ...d, geminiApiKey: "", useAi: false, costMode: "balanced", dubProvider: "vieneu" }) }, onChanged: { addListener: noop } },
            runtime: { lastError: null, sendMessage: (m, cb) => { msgs.push(m); cb(onMsg(m)); } }
        }
    };
    sb.window = sb; sb.globalThis = sb;
    vm.createContext(sb);
    for (const f of ["cst-cache.js", "cost-policy.js", "vi-segmenter.js", "dub-planner.js", "dub-prosody.js", "dub-speech.js", "dub-audio.js", "dub-engine.js", "dubbing.js"]) vm.runInContext(read(f), sb);
    sb.CST_COST.PAID_TTS = true;   // 1.8.1: paid voice ships off; this suite tests its machinery
    return sb;
}

// Lịch sử phiên bản (1.4.3): dữ liệu ở version-history.js, hiện trong Cài đặt.
// Bài kiểm tra giữ cho lịch sử không lệch với phiên bản thật của tiện ích.
test("lịch sử phiên bản: bản mới nhất khớp manifest, đủ từ bản gốc, số thứ tự giảm dần, không trùng", () => {
    const { HISTORY } = require("../version-history.js");
    const m = JSON.parse(R("manifest.json"));
    assert.equal(HISTORY[0].v, m.version, "mục đầu phải là phiên bản đang dùng (chạy tools/bump-version.js rồi nhớ thêm mục)");
    assert.match(HISTORY[HISTORY.length - 1].v, /^1\.0\.0/, "mục cuối phải là bản gốc 1.0.0");
    const so = v => v.split(/[^\d]+/).filter(Boolean).slice(0, 3).map(Number);
    const ma = v => so(v)[0] * 10000 + so(v)[1] * 100 + so(v)[2];
    const nums = HISTORY.map(x => ma(x.v));
    assert.equal(new Set(HISTORY.map(x => x.v)).size, HISTORY.length, "có mục trùng số phiên bản");
    for (let i = 1; i < nums.length; i++) assert.ok(nums[i] < nums[i - 1], `sai thứ tự tại ${HISTORY[i].v}`);
    for (const x of HISTORY) {
        assert.ok(x.ten && x.ten.length > 5, `mục ${x.v} thiếu tên`);
        assert.ok(Array.isArray(x.y) && x.y.length, `mục ${x.v} chưa ghi đã sửa gì`);
        if (!x.bang) continue;
        assert.ok(x.bang.cot.length >= 2 && x.bang.hang.length, `bảng của ${x.v} rỗng`);
        for (const h of x.bang.hang) assert.equal(h.length, x.bang.cot.length, `bảng của ${x.v} lệch số cột`);
    }
    // Các mốc lớn phải có mặt
    for (const v of ["1.4.2", "1.4.0", "1.3.1", "1.2.0", "1.1.2", "1.1.0"]) {
        assert.ok(HISTORY.some(x => x.v === v), `thiếu mục ${v}`);
    }
    assert.ok(HISTORY.filter(x => x.bang).length >= 10, "quá ít bảng so sánh trước / sau");
});

test("lịch sử phiên bản: có mục riêng trong Cài đặt, có ô tìm kiếm, nạp đúng dữ liệu", () => {
    const html = R("options.html");
    assert.match(html, /data-tab="tab-history"/, "thiếu thẻ điều hướng Lịch sử phiên bản");
    assert.match(html, /<div id="tab-history"/, "thiếu khung nội dung");
    assert.match(html, /id="historyFilter"/, "thiếu ô tìm trong lịch sử");
    assert.match(html, /<script src="version-history\.js">/, "trang Cài đặt chưa nạp dữ liệu lịch sử");
    // Dựng bằng DOM, không ghép chuỗi HTML (tránh lỗi hiển thị khi nội dung có dấu ngoặc)
    assert.match(R("options.js"), /function veLichSu/);
    assert.doesNotMatch(R("options.js"), /historyList[^\n]*innerHTML\s*=/);
});

// BACKLOG mục 2 (đã sửa ở 1.4.4): bảng điều khiển từng gửi tin nhắn "setOptions" mà không file nào
// xử lý. Bài này bắt mọi tin nhắn bảng điều khiển gửi cho trang phải có người nhận thật.
test("bảng điều khiển: mọi tin nhắn gửi cho trang đều có nơi xử lý", () => {
    const popup = R("popup.js");
    const trang = R("content.js") + R("youtube.js");
    const gui = [...popup.matchAll(/method:\s*"([\w-]+)"/g)].map(m => m[1]);
    assert.ok(gui.length >= 3, "không đọc được danh sách tin nhắn của bảng điều khiển");
    for (const m of new Set(gui)) {
        assert.ok(trang.includes(`request.method === "${m}"`), `không ai xử lý tin nhắn "${m}"`);
    }
    assert.ok(!gui.includes("setOptions"), "setOptions đã bỏ: bật/tắt lồng tiếng đi qua storage.onChanged");
    assert.doesNotMatch(popup, /notifyActiveTab/, "hàm gửi tin nhắn thừa vẫn còn");
});

// Đo thật 23/09/2026: dịch vụ tự khởi động đặt ProcessType Background làm máy chủ giọng chậm gấp
// ~5 lần (RTF 0,23 -> 1,07). Không có gì báo lỗi, chỉ thấy giọng trễ. Ba lớp chặn cho lần sau.
test("máy chủ giọng chạy chậm: dịch vụ chạy ở mức ưu tiên tương tác, tiện ích đo được và báo cho người xem", async () => {
    // 1. Tệp cài dịch vụ không được đặt mức ưu tiên nền
    const sh = R("tools/vieneu-autostart.command");
    assert.match(sh, /<key>ProcessType<\/key><string>Interactive<\/string>/, "dịch vụ phải chạy ở mức Interactive");
    assert.doesNotMatch(sh, /<string>Background<\/string>/, "ProcessType Background làm giọng chậm gấp 5 lần");

    // 2. Service worker đo tốc độ tạo thật và báo ra ngoài
    const { bgEnv } = require("./bg-env.js");
    const wav = new Uint8Array(48000 * 2 * 4);           // 4 giây audio ở 48 kHz, 16 bit
    let cham = false;
    const env = bgEnv(async (url) => {
        if (String(url).includes("/health")) return { ok: true, json: async () => ({ status: "ok", backend: "onnx", active: 0, waiting: 0 }) };
        if (String(url).includes("/v1/models")) return { ok: true, json: async () => ({ data: [{ id: "vieneu" }] }) };
        if (cham) await new Promise(r => setTimeout(r, 120));   // tạo chậm hơn thời lượng audio
        return { ok: true, status: 200, arrayBuffer: async () => wav.buffer, headers: { get: () => null } };
    }, {}, { timeScale: 0.001 });
    const truoc = await env.send({ action: "localTtsStatus" });
    assert.equal(truoc.rtf, 0, "chưa tạo lượt nào thì chưa có số đo");
    await env.send({ action: "synthesizeSpeech", engine: "vieneu", text: "Xin chào các bạn, hôm nay chúng ta học về dữ liệu.", voice: "Mỹ Duyên", parts: [{ key: "k1", weight: 10 }] });
    const sau = await env.send({ action: "localTtsStatus" });
    assert.ok(typeof sau.rtf === "number", "trạng thái phải kèm tốc độ tạo giọng");

    // 3. Trang Cài đặt hiện tốc độ đó, và phần lồng tiếng cảnh báo khi quá chậm
    assert.match(R("options.js"), /Tốc độ tạo giọng đo được/);
    assert.match(R("dubbing.js"), /canhBaoMayChuCham/);
    assert.match(R("dubbing.js"), /slowAdvice/, "cảnh báo khi quá chậm");
    assert.match(R("dub-hardware.js"), /behind: 0\.8/, "ngưỡng cảnh báo");
    // Bài chạy thật phải HỎNG khi máy chủ chậm, thay vì in ĐẠT
    assert.match(R("tests/vieneu.live.js"), /máy chủ VieNeu quá chậm/);
    assert.match(R("tests/vieneu.live.js"), /chỉ đọc \$\{rates\.length\}/, "0 câu được nói từng lọt qua và vẫn in ĐẠT");
});

// Đo thật 23/09/2026: chạy bootout rồi bootstrap liền nhau -> launchd trả "Bootstrap failed: 5:
// Input/output error" và để máy chủ giọng TẮT HẲN. Người dùng mất giọng đọc cho tới khi cài lại.
test("tệp cài dịch vụ: chờ gỡ xong rồi mới nạp, có thử lại, và báo cách dùng tạm khi hỏng", () => {
    const sh = R("tools/vieneu-autostart.command");
    const nap = sh.indexOf("launchctl bootstrap");
    const cho = sh.indexOf("launchctl print");
    assert.ok(cho !== -1 && cho < nap, "phải chờ launchd gỡ xong trước khi nạp lại");
    assert.match(sh, /for i in \{1\.\.5\}/, "phải thử nạp lại vài lần khi launchd báo bận");
    assert.match(sh, /cst-start\.command/, "hỏng thì phải chỉ cách bật máy chủ ngay lập tức");
    assert.match(sh, /exit 1/, "hỏng thì phải thoát với mã lỗi, không báo 'Đã cài'");
    // Không được báo thành công trước khi biết đã nạp được
    const báo = sh.indexOf("Đã cài.");
    assert.ok(báo > nap, "chỉ báo 'Đã cài' sau khi nạp thành công");
});

// One product, three surfaces: the popup, the Settings page and the menu drawn on top of the
// YouTube player. The player menu used to carry its own purple theme, which made the control-bar
// button look like a different extension. The palette now comes from popup.css, so this test reads
// popup.css and fails if the on-player styles drift away from it again.
test("on-player button, menu and toast use the same palette as the popup", () => {
    const popup = R("popup.css");
    const kit = R("player-ui.js");                 // the shared player UI: mark, button, menu stylesheet
    const menuCss = kit.split("const MENU_CSS = `")[1].split("`;")[0];
    // popup.css lists the light value in :root first, then the dark override in the media query
    const token = name => {
        const hits = [...popup.matchAll(new RegExp("--claude-" + name + ":\\s*(#[0-9A-Fa-f]{6})", "g"))].map(m => m[1]);
        assert.ok(hits.length >= 2, `popup.css thiếu token --claude-${name} cho cả hai giao diện`);
        return { light: hits[0], dark: hits[1] };
    };
    const accent = token("accent");
    assert.equal(accent.light, accent.dark, "accent phải giống nhau ở hai giao diện");
    for (const name of ["card", "text", "border"]) {
        const t = token(name);
        assert.ok(menuCss.includes(t.light), `thực đơn trên video thiếu màu ${name} của giao diện sáng (${t.light})`);
        assert.ok(menuCss.includes(t.dark), `thực đơn trên video thiếu màu ${name} của giao diện tối (${t.dark})`);
    }
    assert.ok(menuCss.includes(accent.light), "thực đơn trên video không dùng màu nhấn của bảng điều khiển");
    // The control-bar button wears the same accent and an icon built from the same mark
    assert.ok(kit.includes("const MARK_SVG"), "thiếu biểu tượng dùng chung");
    const btn = kit.split("function badgeCss(")[1].split("\n    }")[0];
    assert.ok(btn.includes(accent.light), "nút trên thanh điều khiển không dùng màu nhấn của bảng điều khiển");
    // Measured on a real YouTube page: their stylesheet computes an inline <svg> inside .ytp-button
    // to width 0, so the button showed an empty coloured square. The icon has to be painted as a
    // background image, which their CSS cannot reach, and it must never be an inline <svg> again.
    assert.ok(kit.includes("const BTN_ICON_URL"), "thiếu biểu tượng dạng ảnh nền cho nút");
    assert.match(kit, /BTN_ICON_URL = `data:image\/svg\+xml;charset=utf-8,\$\{encodeURIComponent\(BTN_ICON_SVG\)\}`/,
        "biểu tượng nút phải dựng từ BTN_ICON_SVG");
    assert.ok(btn.includes("${BTN_ICON_URL}") && /background-image:url/.test(btn),
        "nút phải vẽ biểu tượng bằng ảnh nền (YouTube ép <svg> trong nút về rộng 0)");
    assert.ok(/background-size:/.test(btn), "ảnh nền của nút phải có kích thước");
    assert.ok(!/<svg/.test(btn), "nút không được nhúng <svg> trực tiếp nữa");
    // The state update must not use the "background" shorthand: that would drop the icon
    const capNhat = kit.split("function datTrangThai(")[1].split("\n    }")[0];
    assert.ok(!/badge\.style\.background\s*=/.test(capNhat), "đổi trạng thái bằng background sẽ xóa mất biểu tượng");
    assert.ok(/badge\.style\.backgroundColor\s*=/.test(capNhat), "đổi trạng thái phải dùng backgroundColor");
    // The menu header draws the mark inline, inside our own panel, so it keeps its own size
    const markSvg = kit.split("const MARK_SVG = `")[1].split("`;")[0];
    assert.match(markSvg, /<svg[^>]*width="100%"[^>]*height="100%"/, "biểu tượng trong thực đơn thiếu kích thước");
    // No leftovers of the old purple theme on any of the on-player surfaces
    const purple = /#7c3aed|#6366f1|#9333ea|#7c5cff|#a78bfa|#a855f7/i;
    for (const file of ["player-ui.js", "youtube.js", "content.js"]) {
        assert.ok(!purple.test(R(file)), `${file} còn màu tím của giao diện cũ`);
    }
    // The toast on top of the video stays dark in both themes, but with the same dark tokens
    const toast = R("content.js").split("function cstToast")[1].split("\nfunction ")[0];
    assert.ok(toast.includes(token("border").dark), "thông báo trên video không dùng màu viền của giao diện tối");
    assert.ok(toast.includes(accent.light), "nút thao tác trong thông báo không dùng màu nhấn");
});

// One mark for the whole product: the toolbar icon, the popup header, its primary button, the
// Settings header and the menu drawn on the YouTube player. They used to be four different shapes
// (a sunburst, a play triangle, a speaker), which is why the extension looked like three products.
test("the product mark and the toolbar icons are the same everywhere", () => {
    const BUBBLE = "M4.2 4.6h15.6c1.55 0 2.8 1.25 2.8 2.8v7.9c0 1.55-1.25 2.8-2.8 2.8h-6.6l-4.3 3.2";
    for (const file of ["popup.html", "options.html", "player-ui.js"]) {
        assert.ok(R(file).includes(BUBBLE), `${file} chưa dùng biểu tượng chung`);
    }
    // the Settings header carried a play triangle; the play triangle on "Nghe thử" is a different
    // thing and stays, so this only looks inside the header block
    const brand = R("options.html").split('<div class="brand">')[1].split("</div>")[0];
    assert.ok(brand.includes(BUBBLE), "tiêu đề trang Cài đặt chưa dùng biểu tượng chung");
    assert.ok(!/polygon/.test(brand), "tiêu đề trang Cài đặt còn biểu tượng nút phát cũ");
    // the spark belongs inside the bubble now: a lone spark means an old mark was left behind
    const SPARK = "M12 2C12.4 7.2 16.8 11.6 22 12";
    for (const file of ["popup.html", "options.html", "player-ui.js"]) {
        const src = R(file);
        assert.equal(src.split(SPARK).length, src.split(BUBBLE).length, `${file} còn biểu tượng tia đứng một mình`);
    }
    // the popup draws it twice: header and primary button
    assert.equal(R("popup.html").split(BUBBLE).length - 1, 2, "bảng điều khiển phải dùng biểu tượng chung ở cả hai chỗ");
    // every icon the manifest declares must exist and really be that many pixels across
    const m = JSON.parse(R("manifest.json"));
    const pngSize = rel => {
        const buf = fs.readFileSync(path.join(__dirname, "..", rel));
        assert.equal(buf.toString("ascii", 1, 4), "PNG", `${rel} không phải tệp PNG`);
        return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    };
    for (const set of [m.icons, m.action.default_icon]) {
        for (const [size, rel] of Object.entries(set)) {
            const px = pngSize(rel);
            assert.equal(px.w, Number(size), `${rel} khai báo ${size} nhưng rộng ${px.w}`);
            assert.equal(px.h, Number(size), `${rel} khai báo ${size} nhưng cao ${px.h}`);
        }
    }
    // the drawing script that made them stays in the repo, so the next session can redraw them
    assert.ok(fs.existsSync(path.join(__dirname, "..", "tools", "make-icon.py")), "thiếu tệp vẽ lại biểu tượng");
});

// Coursera used to be the odd one out: two circles floating over the picture, and the Vietnamese
// handed to the browser's own cue renderer, which Coursera paints over. Now it works like YouTube:
// one button inside the player's own control bar, and our own overlay on the picture.
test("Coursera draws its own overlay and puts one button in the player's control bar", () => {
    const src = R("content.js");
    // the two floating circles are gone
    assert.ok(!/class = "cst-translate-icon"|className = "cst-translate-icon"/.test(src), "vẫn còn nút tròn dịch nổi trên video");
    assert.ok(!/function createDubIcon/.test(src), "vẫn còn nút tròn lồng tiếng nổi trên video");
    // the button is the shared one, dropped into Coursera's own control group
    assert.ok(/CST_PLAYER_UI/.test(src), "nút Coursera phải dùng khối giao diện dùng chung");
    const create = src.split("function csCreateButton()")[1].split("\nfunction ")[0];
    assert.ok(/kit\.taoNut\(/.test(create), "nút Coursera phải dựng bằng taoNut của khối dùng chung");
    assert.ok(/insertBefore\(wrap, ctl\.before\)/.test(create), "nút phải chèn vào thanh điều khiển của Coursera");
    // the control bar is found by geometry; two traps found by measuring on the real page
    const parts = src.split("function csPlayerParts()")[1].split("\nfunction ")[0];
    assert.ok(/box !== document\.body/.test(parts), "không được leo tới <body>: sẽ bắt nhầm nút của hộp thoại");
    assert.ok(/btns\.length >= 3/.test(parts), "phải có ít nhất 3 nút mới coi là thanh điều khiển");
    assert.ok(/reduce\(\(a, b\) => \(b\.getBoundingClientRect\(\)\.left/.test(parts), "phải lấy nút phải cùng, không phải nút cuối trong DOM");
    // our own overlay, and the browser's cue renderer silenced
    assert.ok(/class="cst-cs-overlay"|"cst-cs-overlay"/.test(src), "thiếu lớp phủ phụ đề riêng của Coursera");
    assert.ok(/track\.mode = "hidden"/.test(src), "phải tắt phần vẽ cue của trình duyệt");
    const style = src.split("function csApplyOverlayStyle(ov)")[1].split("\nfunction ")[0];
    assert.ok(/CST_STYLE|S\.normalizeStyle/.test(style), "lớp phủ phải dùng chung bộ kiểu phụ đề với YouTube");
    assert.ok(/ctl\.height/.test(style), "lớp phủ phải nâng lên trên thanh điều khiển");
});

// The transcript panel (1.5.4): the talk as text beside the picture. The data is what the overlay
// already draws from, so opening the panel costs no API call and no money.
test("bản chép lời: dựng .srt đúng định dạng và ghép đúng dòng gốc với dòng dịch", () => {
    const T = require("../transcript.js");
    const vi = [{ start: 0, end: 2, text: "Xin chào các bạn." }, { start: 2, end: 5.5, lines: ["Hôm nay ta học", "mạng nơ-ron."] }];
    const en = [{ start: 0, end: 1.9, text: "Hello everyone." }, { start: 2.1, end: 5.5, text: "Today we learn neural networks." }];
    const lines = T.mergeLines(vi, en);
    assert.equal(lines.length, 2);
    assert.equal(lines[0].vi, "Xin chào các bạn.");
    assert.equal(lines[0].en, "Hello everyone.");
    assert.equal(lines[1].vi, "Hôm nay ta học mạng nơ-ron.", "cue nhiều dòng phải gộp lại thành một dòng chép lời");
    assert.equal(lines[1].en, "Today we learn neural networks.");
    // .srt: số thứ tự từ 1, mốc thời gian hh:mm:ss,mmm, một dòng trống giữa các khối
    const srt = T.buildSrt(lines);
    assert.equal(T.srtClock(3661.5), "01:01:01,500");
    assert.equal(T.srtClock(1.9996), "00:00:02,000", "a rounded-up millisecond carries into the second");
    assert.equal(T.srtClock(3599.9999), "01:00:00,000");
    assert.match(srt, /^1\n00:00:00,000 --> 00:00:02,000\nXin chào các bạn\.\n\n2\n/);
    assert.ok(!srt.includes("Hello everyone"), "chế độ một thứ tiếng không được kèm dòng gốc");
    assert.ok(T.buildSrt(lines, { keepOriginal: true }).includes("Hello everyone."), "chế độ song ngữ phải kèm dòng gốc");
    // tên tệp bỏ dấu và ký tự lạ để mọi hệ điều hành nhận
    assert.equal(T.fileName("Bài giảng: Mạng nơ-ron / phần 1"), "Bai-giang-Mang-no-ron-phan-1.srt");
    assert.equal(T.fileName("Đường đi của dữ liệu"), "Duong-di-cua-du-lieu.srt");
});

// 2.3.5: the Vietnamese cues are cut at other times than the source lines, so a source line crossing
// a cue boundary was listed in both rows: 33% of the source lines in the user's 15 videos, 45% more
// English words in the panel and the bilingual .srt than the video has. Now each sits in one row.
test("transcript: each source line sits in the one row it overlaps most, never in two", () => {
    const T = require("../transcript.js");
    const vi = [{ start: 0, end: 3, text: "Một." }, { start: 3, end: 6, text: "Hai." }, { start: 6, end: 9, text: "Ba." }];
    const en = [
        { start: 0, end: 3.4, text: "one" },          // crosses into row 2 by 0.4 s: row 1 only
        { start: 2.2, end: 6.5, text: "two" },        // 0.8 s in row 1, 3 s in row 2
        { start: 5.5, end: 6.5, text: "tie" },        // 0.5 s each: the earlier row
        { start: 6.5, end: 9, text: "three" }
    ];
    const rows = T.mergeLines(vi, en);
    assert.deepEqual(rows.map(r => r.en), ["one", "two tie", "three"]);
    // every source word once, whatever the overlaps
    const words = rows.map(r => r.en).join(" ").split(" ").filter(Boolean);
    assert.equal(words.length, en.length);
    // a source line inside no row (not translated yet) is left out, a row may have no source line
    assert.deepEqual(T.mergeLines([{ start: 0, end: 1, text: "A." }, { start: 1, end: 1.2, text: "B." }], [{ start: 0, end: 1.1, text: "a" }, { start: 20, end: 21, text: "z" }]).map(r => r.en), ["a", ""]);
});

test("bản chép lời: mở trong trình phát, bấm một dòng thì video nhảy tới, dòng đang phát được đánh dấu", async t => {
    const dom = miniDom();
    const sb = loadYouTube(dom);
    t.after(() => { sb.donTimers(); sb.CST_TRANSCRIPT.close(); });
    const player = dom.doc.querySelector("#movie_player");
    const video = { currentTime: 0, paused: true, play: () => Promise.resolve() };
    // yt.viCues is declared with const inside the script, so it is not a sandbox property: feed the
    // panel the same shape of data directly (youtube.js wiring is covered by the next test)
    const viCues = [{ start: 0, end: 2, text: "Câu một." }, { start: 2, end: 4, text: "Câu hai." }];
    const enCues = [{ start: 0, end: 2, text: "Line one." }, { start: 2, end: 4, text: "Line two." }];
    const adapter = {
        box: () => player,
        videoEl: () => video,
        lines: () => sb.CST_TRANSCRIPT.mergeLines(viCues, enCues),
        title: () => "Bài nói thử",
        dual: () => false,
        theme: () => "dark"
    };
    sb.CST_TRANSCRIPT.toggle(adapter);
    const panel = player.querySelector(".cst-tr-panel");
    assert.ok(panel, "không mở được bản chép lời");
    assert.equal(panel.attrs["role"], "dialog");
    const rows = panel.querySelectorAll(".cst-tr-row");
    assert.equal(rows.length, 2, "phải có đủ dòng lời thoại");
    assert.match(rows[0].textContent, /Câu một\./);
    assert.match(rows[0].textContent, /Line one\./, "phải hiện cả dòng gốc");

    // bấm một dòng: video nhảy tới đúng mốc
    rows[1].fire("click");
    assert.equal(video.currentTime, 2, "bấm dòng không nhảy tới đúng mốc");

    // dòng đang phát được đánh dấu để mắt bám theo
    video.currentTime = 2.5;
    await new Promise(r => setTimeout(r, 400));
    assert.equal(rows[1].attrs["aria-current"], "true", "dòng đang phát chưa được đánh dấu");
    assert.equal(rows[0].attrs["aria-current"], "false");

    // bấm nút lần nữa thì đóng (cùng một nút mở và đóng)
    sb.CST_TRANSCRIPT.toggle(adapter);
    assert.equal(player.querySelector(".cst-tr-panel"), null, "bấm lần nữa phải đóng bản chép lời");
});

test("thực đơn nhanh: có nút mở bản chép lời và nói rõ đang đọc phụ đề nguồn nào", () => {
    const ytjs = R("youtube.js");
    const csjs = R("content.js");
    for (const [ten, src] of [["youtube.js", ytjs], ["content.js", csjs]]) {
        assert.ok(/Bản chép lời/.test(src), `${ten} thiếu nút mở bản chép lời`);
        assert.ok(/CST_TRANSCRIPT\.toggle/.test(src), `${ten} chưa gọi bản chép lời`);
    }
    // phụ đề máy nghe tự động là nguyên nhân chính làm bản dịch sai: phải nói cho người xem biết
    assert.ok(/Phụ đề máy nghe tự động/.test(ytjs) && /Phụ đề máy nghe tự động/.test(csjs), "thiếu nhãn phụ đề máy nghe");
    assert.ok(/yt\.trackInfo = \{/.test(ytjs), "youtube.js phải nhớ đang dùng bản chép lời nào");
    assert.ok(/--cst-warn/.test(ytjs) && /--cst-warn/.test(csjs), "nhãn cảnh báo phải dùng màu cảnh báo của bộ giao diện");
});

// Ảnh chụp thật trên Coursera 1.5.4: dòng "Một tính năng khác mà bạn có thể thực hiện," bị trình
// duyệt ngắt giữa cụm thành "... có thể thực / hiện,". Lý do: phần cắt dòng của bộ phân đoạn cắt
// theo cú pháp chứ không theo bề rộng, còn lớp phủ Coursera lại để CSS tự xuống dòng.
test("phụ đề dài hơn khung: cắt lại theo bề rộng THẬT, không để trình duyệt ngắt bừa", () => {
    require("../vi-segmenter.js");
    const S = require("../subtitle-style.js");
    const text = "Một tính năng khác mà bạn có thể thực hiện, cũng là điều mà Claude vừa làm gần đây.";
    const overlay = { style: { fontSize: "24px" } };
    const hep = S.fitLines([text], text, overlay, { box: { clientWidth: 400 }, widthRatio: 0.92 });
    assert.ok(hep.length > 1, "khung hẹp mà vẫn để nguyên một dòng");
    const rongNhat = Math.max(...hep.map(l => l.length));
    assert.ok(rongNhat <= 30, `dòng dài nhất ${rongNhat} ký tự, vẫn tràn khung`);
    // cắt theo cú pháp: không được bỏ chữ, và không tách "thực hiện" làm đôi
    assert.equal(hep.join(" ").replace(/\s+/g, " "), text, "cắt dòng làm mất hoặc thêm chữ");
    assert.ok(!hep.some(l => /\bthực$/.test(l)), "vẫn cắt giữa cụm 'thực hiện'");
    // khung rộng thì giữ nguyên, không cắt vụn
    assert.equal(S.fitLines([text], text, overlay, { box: { clientWidth: 1600 }, widthRatio: 0.92 }).length, 1);

    // cả hai trang phải dùng chung một phép cắt này, và không để CSS tự ngắt dòng nữa
    const ytjs = R("youtube.js");
    const csjs = R("content.js");
    assert.ok(/S\.fitLines\(/.test(ytjs) && /S\.fitLines\(/.test(csjs), "hai trang phải dùng chung phép cắt dòng");
    assert.ok(/white-space:pre;/.test(csjs), "lớp phủ Coursera vẫn để trình duyệt tự ngắt dòng");
    assert.ok(/ytSideRoom\(\)/.test(ytjs) && /csSideRoom\(\)/.test(csjs), "mở bản chép lời thì phụ đề phải thu hẹp");
});

// Settings offers "original track 0%" (mute it under the voice), but dubbing.js read the value
// with `Number(x) || 0.2`, so 0% silently became 20%.
test("a 0% original-track level stays 0%, and bad values fall back", () => {
    const sb = dubbingEnvLocal([], () => ({}));
    const L = sb.CST_DUB.level;
    assert.equal(L(0, 0.2), 0);
    assert.equal(L(0.35, 0.2), 0.35);
    assert.equal(L(undefined, 0.2), 0.2);
    assert.equal(L("", 1), 1);
    assert.equal(L("abc", 1), 1);
    assert.equal(L(3, 1), 1);
    assert.ok(!/Number\([^)]*dubDuck[^)]*\)\s*\|\|/.test(R("dubbing.js")), "dubbing.js still reads dubDuck with ||");
});

test("the quick menu says what the voice is doing: ready ahead, slow server, skipped lines", () => {
    const sb = dubbingEnvLocal([], () => ({}));
    const E = sb.CST_DUB_ENGINE.DubEngine;
    // the engine side: numbers straight from its own buffer and render-speed measurement
    const h = E.prototype.health.call({ provider: { caps: { live: false } }, bufferedAhead: () => 12.4, renderRtf: 0.31, stats: { dropped: 0 } }, 5);
    assert.equal(h.ahead, 12.4);
    assert.equal(h.rtf, 0.31);

    const dub = sb.CST_DUB.dub;
    const video = { currentTime: 5, paused: false };
    const fake = health => ({ d: { video }, health: () => health });
    dub.enabled = true;
    dub.lastStatus = { voice: "Ngọc Huyền" };

    dub.engine = fake({ live: false, ahead: 34.2, rtf: 0.25, dropped: 0 });
    let r = sb.CST_DUB.describeHealth();
    assert.equal(r.text, "Giọng Ngọc Huyền · đã chuẩn bị trước 34 giây");
    assert.equal(r.warn, false);

    dub.engine = fake({ live: false, ahead: 0.2, rtf: 1.1, dropped: 3 });
    r = sb.CST_DUB.describeHealth();
    assert.match(r.text, /máy chủ giọng chậm \(1 giây lời mất 1,1 giây\), đã bỏ 3 câu/);
    assert.equal(r.warn, true);

    dub.engine = fake({ live: false, ahead: 0, rtf: null, dropped: 0 });
    assert.match(sb.CST_DUB.describeHealth().text, /đang tạo giọng/);

    dub.engine = fake({ live: false, ahead: 20, rtf: 0.22, dropped: 0, pace: 1.3 });
    assert.match(sb.CST_DUB.describeHealth().text, /người nói nhanh, đọc nhanh theo/);
    dub.engine = fake({ live: false, ahead: 20, rtf: 0.22, dropped: 0, pace: 0.95 });
    assert.doesNotMatch(sb.CST_DUB.describeHealth().text, /người nói nhanh/);

    dub.engine = fake({ live: true, ahead: 0, rtf: null, dropped: 0 });
    assert.match(sb.CST_DUB.describeHealth().text, /đọc trực tiếp/);

    dub.enabled = false;
    assert.equal(sb.CST_DUB.describeHealth(), null);
    dub.engine = null;
});

test("YouTube quick menu shares saved reading order and preserves it in single mode", async t => {
    const dom = miniDom();
    const sb = loadYouTube(dom);
    t.after(() => sb.donTimers());
    await new Promise(resolve => setImmediate(resolve));
    const saved = [];
    sb.chrome.storage.sync.set = async obj => { saved.push(obj); };
    vm.runInContext('state.originalFirst = true; state.dualMode = true; ytSubStyle.mode = "dual";', sb);
    const player = dom.doc.querySelector("#movie_player");
    const btn = dom.doc.createElement("button");
    player.appendChild(btn);
    sb.ytMoMenuNhanh(player, btn);
    const menu = player.querySelector(".cst-yt-menu");
    const row = menu.querySelectorAll(".cst-row").find(r => /Tiếng Anh ở trên/.test(r.textContent));
    const [single, dual] = menu.querySelector(".cst-seg").querySelectorAll("button");
    assert.equal(row.getAttribute("aria-checked"), "true");
    assert.equal(row.style.display, "flex");
    vm.runInContext('yt.renderKey = "previous cue"', sb);
    row.fire("click");
    assert.equal(vm.runInContext("state.originalFirst", sb), false);
    assert.equal(vm.runInContext("yt.renderKey", sb), "");
    assert.equal(saved.at(-1).originalFirst, false);
    assert.equal(row.getAttribute("aria-checked"), "false");
    row.fire("click");
    single.fire("click");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(row.style.display, "none");
    assert.equal(row.disabled, true);
    assert.equal(vm.runInContext("state.originalFirst", sb), true);
    dual.fire("click");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(row.style.display, "flex");
    assert.equal(row.disabled, false);
    assert.equal(row.getAttribute("aria-checked"), "true");
    // A popup/storage update is reflected while the menu is open.
    vm.runInContext("state.originalFirst = false", sb);
    await new Promise(r => setTimeout(r, 750));
    assert.equal(row.getAttribute("aria-checked"), "false");
});

test("quick menu: subtitle size buttons and the two volume sliders, on both sites", async t => {
    const dom = miniDom();
    const sb = loadYouTube(dom);
    t.after(() => sb.donTimers());
    const saved = [];
    sb.chrome.storage.sync.set = async obj => { saved.push(obj); };
    const player = dom.doc.querySelector("#movie_player");
    const btn = dom.doc.createElement("button");
    player.appendChild(btn);
    sb.ytMoMenuNhanh(player, btn);
    const menu = player.querySelector(".cst-yt-menu");

    const step = menu.querySelector(".cst-step");
    assert.ok(step, "no subtitle size control in the menu");
    const [minus, plus] = step.querySelectorAll("button");
    const val = step.querySelector(".cst-step-val");
    const before = vm.runInContext("ytSubStyle.fontSize", sb);
    assert.equal(val.textContent, `${before}%`);
    plus.fire("click");
    assert.equal(vm.runInContext("ytSubStyle.fontSize", sb), before + 10);
    assert.equal(val.textContent, `${before + 10}%`);
    assert.ok(saved.some(o => o.subStyle && o.subStyle.fontSize === before + 10), "the new size was not stored");
    minus.fire("click");
    minus.fire("click");
    assert.equal(vm.runInContext("ytSubStyle.fontSize", sb), before - 10);

    const ranges = menu.querySelectorAll(".cst-range");
    assert.equal(ranges.length, 2, "expected a voice volume and an original-track slider");
    assert.match(menu.textContent, /Âm lượng giọng/);
    assert.match(menu.textContent, /Tiếng gốc khi đọc/);
    // hidden while dubbing is off: they would do nothing
    assert.equal(ranges[0].parent.parent.style.display, "none");
    ranges[1].value = "0";
    ranges[1].fire("change");
    assert.ok(saved.some(o => o.dubDuck === 0), "0% for the original track must be stored as 0");

    // Coursera builds the same controls from the same kit
    const csjs = R("content.js");
    assert.ok(/kit\.buildStepper\(/.test(csjs) && /kit\.buildVolumeControls\(/.test(csjs), "Coursera menu lacks the new controls");
    assert.ok(/describeHealth\(\)/.test(csjs) && /describeHealth\(\)/.test(R("youtube.js")), "both menus must show the voice status");
});

// On Coursera a style change (font size, colour) waited for the next player resize, because the
// render loop only re-applied the style when the box size changed.
test("Coursera applies a subtitle style change at once, and a bilingual toggle repaints", () => {
    const csjs = R("content.js");
    const listener = csjs.slice(csjs.indexOf("if (changes.subStyle) {"), csjs.indexOf("if (changes.costMode)"));
    assert.ok(/csRestyle\(\)/.test(listener), "the storage listener does not re-apply the overlay style");
    assert.ok(/cs\.renderKey = ""/.test(listener), "a dualMode change does not force a repaint");
    assert.ok(/function csRestyle\(\)[\s\S]{0,200}csApplyOverlayStyle\(ov\)/.test(csjs));
});

test("dubbing badge and the 'preparing' card use the product's dark card, not a bare black box", () => {
    const d = R("dubbing.js");
    assert.ok(!/background: rgba\(0,0,0,0\.65\)/.test(d) && !/background:rgba\(0,0,0,\.7\)/.test(d), "old black boxes still there");
    assert.ok((d.match(/rgba\(40,38,34,\.94\)/g) || []).length >= 2, "badge and note should share the card colour");
});

// 2026-09-23: 21 of the 25 VieNeu voices had no measured pace and shared a guess of 4.8 syllables per
// second; measured on the local server they range from 3.8 to 5.8, so the guess was off by up to 24%.
test("every VieNeu voice has a measured pace, and the pickers say how fast it speaks", () => {
    const C = require("../cost-policy.js");
    for (const v of C.LOCAL_TTS.voices) {
        assert.ok(v.sps >= 3.5 && v.sps <= 6.5, `${v.id}: sps ${v.sps}`);
    }
    assert.equal(C.voiceLabel(C.LOCAL_TTS.voices.find(v => v.id === "Mỹ Duyên")), "Mỹ Duyên (nữ, đọc truyện, nói chậm)");
    assert.match(C.voiceLabel(C.LOCAL_TTS.voices.find(v => v.id === "Thùy Dung")), /nói nhanh\)$/);
    for (const f of ["youtube.js", "content.js", "options.js"]) assert.ok(/CST_COST\.voiceLabel\(v\)/.test(R(f)), f);
});

test("quick menu is two titled sections, subtitles first, voice second, on both sites", async t => {
    const dom = miniDom();
    const sb = loadYouTube(dom);
    t.after(() => sb.donTimers());
    const player = dom.doc.querySelector("#movie_player");
    const btn = dom.doc.createElement("button");
    player.appendChild(btn);
    sb.ytMoMenuNhanh(player, btn);
    const menu = player.querySelector(".cst-yt-menu");
    const kids = menu.children;
    const secs = kids.filter(k => k.className === "cst-sec");
    assert.deepEqual(secs.map(s => s.textContent), ["Phụ đề", "Giọng đọc"]);
    const idx = el => kids.indexOf(el);
    const rows = menu.querySelectorAll(".cst-row");
    assert.ok(idx(secs[0]) < idx(rows[0]) && idx(rows[0]) < idx(secs[1]), "the subtitle switch belongs to the first section");
    assert.ok(idx(menu.querySelector(".cst-step")) < idx(secs[1]), "the size control belongs to the subtitle section");
    const dubRow = rows.find(r => /Lồng tiếng Việt/.test(r.textContent));
    assert.ok(idx(secs[1]) < idx(dubRow), "the dubbing switch belongs to the voice section");
    assert.ok(kids[kids.length - 1].className === "cst-menu-foot", "footer comes last");
    assert.ok(/kit\.buildSection\(document, "Phụ đề"\)[\s\S]{0,120}kit\.buildSection\(document, "Giọng đọc"\)/.test(R("content.js")), "Coursera menu uses the same sections");
});

test("popup shows what the page is doing: title, translation progress, voice status", () => {
    const html = R("popup.html");
    for (const id of ["nowCard", "nowTitle", "nowBar", "nowCount", "nowVoice"]) assert.ok(html.includes(`id="${id}"`), id);
    const js = R("popup.js");
    assert.ok(/function veTheDangXem\(st\)/.test(js));
    const cs = R("content.js");
    assert.ok(/sendResponse\(\{ site, title, active: yt\.active/.test(cs) && /sendResponse\(\{ site, title, active: state\.active/.test(cs), "the page must report its title");
    assert.ok(/describeHealth\(\) : null;[\s\S]{0,200}health: health \? health\.text/.test(cs), "the page must report the voice status");
});


// Seen on a real YouTube page (2026-09-23): the open quick menu hid the end of both subtitle lines,
// and the transcript list stayed at 0:02 while the video played 8:20.
test("the open quick menu pushes the subtitle aside on both sites", () => {
    const yt = R("youtube.js"), cs = R("content.js");
    assert.ok(/yt\.panelOpen \? 404 : 0, yt\.menuOpen \? 352 : 0/.test(yt));
    assert.ok(/cs\.panelOpen \? 404 : 0, cs\.menuOpen \? 352 : 0/.test(cs));
    assert.ok(/nhuongCho\(true\);[\s\S]{0,200}const dongMenu = \(\) => \{[\s\S]{0,200}nhuongCho\(false\);/.test(yt), "YouTube menu must give the room back on close");
    assert.ok(/nhuongCho\(true\);[\s\S]{0,200}const dong = \(\) => \{[\s\S]{0,200}nhuongCho\(false\);/.test(cs), "Coursera menu must give the room back on close");
});

test("transcript keeps following when a scroll was cut short, and measures rows from the list", async t => {
    const dom = miniDom();
    const sb = loadYouTube(dom);
    t.after(() => { sb.donTimers(); sb.CST_TRANSCRIPT.close(); });
    const player = dom.doc.querySelector("#movie_player");
    const video = { currentTime: 30, paused: false, play: () => Promise.resolve() };
    const vi = Array.from({ length: 40 }, (_, i) => ({ start: i * 2, end: i * 2 + 2, text: `Câu số ${i}.` }));
    sb.CST_TRANSCRIPT.toggle({ box: () => player, videoEl: () => video, lines: () => sb.CST_TRANSCRIPT.mergeLines(vi, []), theme: () => "dark" });
    const panel = player.querySelector(".cst-tr-panel");
    const list = panel.querySelector(".cst-tr-list");
    const calls = [];
    list.offsetTop = 112; list.clientHeight = 300; list.scrollTop = 0;
    list.scrollTo = o => { calls.push(o); /* the smooth scroll never lands: scrollTop stays 0 */ };
    panel.querySelectorAll(".cst-tr-row").forEach((r, i) => { r.offsetTop = 112 + i * 50; r.clientHeight = 50; });
    await new Promise(r => setTimeout(r, 400));
    assert.ok(calls.length >= 2, `it gave up after ${calls.length} scroll call(s)`);
    // row 15 (t = 30 s) sits 750 px into the list: centred means 750 - 150 + 25
    assert.equal(calls[calls.length - 1].top, 625);
});


test("menu and transcript open and close with a short animation, and none for reduced motion", () => {
    const kit = R("player-ui.js");
    assert.ok(/\.cst-yt-menu \{ transform-origin:bottom right; animation:cst-pop-in/.test(kit));
    assert.ok(/\.cst-tr-panel \{ animation:cst-slide-in/.test(kit));
    assert.ok(/prefers-reduced-motion: reduce\) \{[\s\S]{0,200}animation:none !important/.test(kit), "reduced motion must switch the animations off");
    assert.ok(/kit\.dismiss\(menu\)/.test(R("content.js")) && /dismiss\(menu\)/.test(R("youtube.js")) && /kit\.dismiss\(open\.panel\)/.test(R("transcript.js")));
    // a menu on its way out is not "the open menu": a quick second click opens a new one
    assert.ok(/if \(menu && menu\.dataset\.cstLeaving\) menu = null;/.test(R("youtube.js")));
    assert.ok(/if \(open && open\.dataset\.cstLeaving\) open = null;/.test(R("content.js")));
});

// 1.9.3: a YouTube ad plays in the lecture's own <video>. The subtitle loop read the ad's clock
// (0 to 30 s) as the lecture's: it drew the lecture's opening lines over the ad and, when those were
// not translated yet, sent them to Gemini, a paid call made only because an ad was on.
test("YouTube ad: no lecture subtitle drawn over it and no translation sent for the ad's clock", async t => {
    const dom = miniDom();
    const sb = loadYouTube(dom);
    t.after(() => { vm.runInContext("yt.active = false", sb); sb.donTimers(); });
    const player = dom.doc.querySelector("#movie_player");
    const video = player.appendChild(dom.doc.createElement("video"));
    let frame = null;
    video.currentTime = 6;
    video.paused = false;
    video.requestVideoFrameCallback = f => { frame = f; return 1; };
    video.cancelVideoFrameCallback = () => {};
    sb.__video = video;
    sb.__overlay = player.appendChild(dom.doc.createElement("div"));
    vm.runInContext(`yt.videoEl = __video; yt.overlay = __overlay; yt.active = true;
        yt.cues = [{ start: 5, end: 8, text: "Welcome to the course." }];
        yt.viCues = [];
        yt.groups = [{ start: 5, end: 8, translated: false }];
        yt.cueToGroupMap = new Map([[0, 0]]);`, sb);
    const sent = [], drawn = [];
    sb.ytDichNhom = g => sent.push(g);
    sb.ytVePhuDe = (o, vi, en) => drawn.push(en);
    player.className = "html5-video-player ad-showing";
    sb.ytBatDauDongBo();
    frame && frame();
    assert.deepEqual(sent, [], "a translation was sent for the ad's clock");
    assert.ok(drawn.every(x => x === ""), `drew ${JSON.stringify(drawn)} over the ad`);
    // ad over: the same position is the lecture's again
    player.className = "html5-video-player";
    frame && frame();
    assert.ok(sent.includes(0), "the lecture's line was not translated after the ad");
    assert.ok(drawn.includes("Welcome to the course."));
});

// BACKLOG 10 (fixed 1.9.4): a background refine landing after the whole video was translated and
// saved was never written to YouTube's per-video copy, so the next visit showed the pre-refine line.
test("YouTube: a refine that lands after the video was saved is written to the per-video copy", async t => {
    const dom = miniDom();
    const sb = loadYouTube(dom);
    t.after(() => sb.donTimers());
    let refine = null;
    const saved = [];
    sb.translateWindow = async (session, idxs, opts) => { refine = opts.onRefined; return { translations: ["bản đầu"], engine: "m" }; };
    sb.ytChonCuaSo = () => [0];
    sb.ytGanBanDich = () => {};
    sb.ytGhiCache = id => { saved.push(id); };
    vm.runInContext(`yt.session = {}; yt.groups = [{ start: 0, end: 3, translated: true }]; yt.currentVideoId = "abc123";`, sb);
    assert.equal(await sb.ytDichNhom(0), true);
    vm.runInContext(`yt.daDichXong = true;`, sb);        // the video finished and was saved meanwhile
    refine({ translations: ["bản tự nhiên hơn"], engine: "m" });
    refine({ translations: ["bản tự nhiên hơn nữa"], engine: "m" });
    await new Promise(r => setTimeout(r, 700));
    assert.deepEqual(saved, ["abc123"], "refines after the save must be saved once, for this video");
    // a refine arriving after the viewer moved to another video writes nothing
    saved.length = 0;
    refine({ translations: ["x"], engine: "m" });
    vm.runInContext(`yt.currentVideoId = "other";`, sb);
    await new Promise(r => setTimeout(r, 700));
    assert.deepEqual(saved, []);
});

test("quick menu: Tab goes round inside it on both players, sliders included", () => {
    const UI = require("../player-ui.js");
    const el = name => ({ name, disabled: false, hidden: false, getAttribute: () => null, getClientRects: () => [1], focus() { doc.activeElement = this; } });
    const btn = el("close"), select = el("voice"), slider = el("volume"), hidden = { ...el("gone"), getClientRects: () => [] };
    const menu = { contains: x => [btn, select, slider, hidden].includes(x), querySelectorAll: () => [btn, select, slider, hidden] };
    const doc = { activeElement: slider };
    const key = (shiftKey = false) => { const e = { key: "Tab", shiftKey, prevented: false, preventDefault() { this.prevented = true; } }; return e; };
    let e = key();
    assert.equal(UI.trapTab(menu, e, doc), true, "Tab on the last control (the slider) wraps");
    assert.equal(doc.activeElement, btn);
    e = key(true);
    assert.equal(UI.trapTab(menu, e, doc), true);
    assert.equal(doc.activeElement, slider, "Shift+Tab on the first wraps to the last visible one");
    doc.activeElement = select;
    assert.equal(UI.trapTab(menu, key(), doc), false, "a middle control: the browser moves the focus");
    const src = read("content.js") + read("youtube.js");
    assert.equal((src.match(/trapTab\(menu, e\)/g) || []).length, 2, "both quick menus use it");
});

// Every raw failure maps to one plain Vietnamese sentence that says what to do next
test("explainError: each failure class gets its own advice, never the raw English", () => {
    const sb = loadContent(miniDom());
    const say = m => sb.CST_UI.explainError(new Error(m));
    const cases = [
        ["Extension context invalidated.", /tải lại trang/i, true],
        ["Could not establish connection. Receiving end does not exist.", /chưa phản hồi/i, true],
        ["Không có phản hồi từ tiện ích", /chưa phản hồi/i, true],
        ["Gemini x HTTP 429: hết hạn mức trong ngày (429)", /hết hạn mức/i, false],
        ["Gemini x HTTP 429: vượt giới hạn tốc độ (429)", /1 phút/i, false],
        ["API Key sai, hết hạn hoặc không đủ quyền", /API Key/i, true],
        ["Failed to fetch", /kiểm tra mạng/i, false],
        ["Gemini x HTTP 503: máy chủ Gemini quá tải", /quá tải/i, false],
        ["something odd", /Chưa dịch được \(something odd\)/, false]
    ];
    for (const [raw, re, hasAction] of cases) {
        const r = say(raw);
        assert.match(r.text, re, raw);
        assert.equal(!!r.actionLabel, hasAction, raw + ": action button");
    }
});

// 2.9.8: popup text tokens must stay readable (WCAG AA, 4.5:1) in both themes.
test("popup contrast: muted and secondary text, white-on-accent button and dark success button reach 4.5:1", () => {
    const css = R("popup.css");
    const lum = hex => {
        const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
            .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const tokens = block => Object.fromEntries([...block.matchAll(/--claude-([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
    const light = tokens(css.slice(0, css.indexOf("@media (prefers-color-scheme: dark)")));
    const darkStart = css.indexOf(':root[data-theme="dark"]');
    const dark = Object.assign({}, light, tokens(css.slice(darkStart, css.indexOf("* {", darkStart))));
    for (const [name, t] of [["light", light], ["dark", dark]]) {
        for (const fg of ["text-secondary", "text-muted"]) {
            for (const bg of ["bg", "card", "card-subtle", "card-hover"]) {
                const r = ratio(t[fg], t[bg]);
                assert.ok(r >= 4.5, `${name}: ${fg} on ${bg} is ${r.toFixed(2)}:1`);
            }
        }
        assert.ok(ratio("#FFFFFF", t["accent-fill"]) >= 4.5, `${name}: white on the primary button`);
        assert.ok(ratio("#FFFFFF", t["accent-fill-hover"]) >= 4.5, `${name}: white on the hovered button`);
        assert.ok(ratio("#FFFFFF", t["success-fill"]) >= 4.5, `${name}: white on the success button`);
    }
});

test("overlay: font never drops under 12 px, motion follows the system setting, both sites share one transition", () => {
    const S = require("../subtitle-style.js");
    assert.equal(S.overlayFontPx(400, 100), 12, "a 400 px mini player used to get 9.8 px text");
    assert.ok(Math.abs(S.overlayFontPx(1920, 100) - 28) < 1e-9, "base is capped at 40 px, scaled by 0.7");
    assert.ok(S.overlayFontPx(1920, 200) > S.overlayFontPx(1920, 100), "the viewer's size still scales it");
    assert.equal(S.overlayFontPx(undefined, 100), S.overlayFontPx(640, 100));
    assert.match(S.overlayTransition(false), /top 0\.18s/, "top animates too");
    assert.doesNotMatch(S.overlayTransition(true), /transform|bottom|top|max-width/);
    assert.match(S.overlayTransition(true), /opacity/);
    for (const f of ["youtube.js", "content.js"]) {
        assert.match(R(f), /overlayTransition\(/, f);
        assert.doesNotMatch(R(f), /cubic-bezier\(\.16,1,\.3,1\)/, f + " kept its own copy of the transition");
    }
    assert.doesNotMatch(R("content.js"), /width \* 0\.026/);
    assert.doesNotMatch(R("youtube.js"), /rong \* 0\.026, 40\)\);\n\s*const scale/);
    assert.equal(S.prefersReducedMotion(), false, "no matchMedia in node means no preference");
});

test("legibility: same-colour box, or no box and no outline, is flagged; the defaults and sane choices are not", () => {
    const S = require("../subtitle-style.js");
    assert.equal(S.legibilityIssue({}), null, "defaults");
    assert.equal(S.legibilityIssue({ bgOpacity: 0, strokeStyle: "thick", strokeColor: "#000000", fontColor: "#ffffff" }), null, "outline only");
    assert.equal(S.legibilityIssue({ bgColor: "#ffffff", bgOpacity: 90, fontColor: "#f5f5f5" }).level, "bad");
    assert.equal(S.legibilityIssue({ bgOpacity: 0, strokeStyle: "none" }).level, "bad");
    assert.equal(S.legibilityIssue({ bgOpacity: 10, strokeStyle: "shadow", strokeColor: "#ffffff", fontColor: "#ffffff" }).level, "warn");
    assert.equal(S.legibilityIssue({ bgOpacity: 50, bgColor: "#ffffff", fontColor: "#ffffff" }), null, "a half-clear box is judged by the outline rule only when absent");
    assert.ok(Math.abs(S.contrastRatio("#000000", "#ffffff") - 21) < 1e-9);
    assert.match(R("options.js"), /legibilityIssue\(s\)/);
    assert.match(R("options.html"), /id="legibilityHint"/);
});

// Settings tabs follow the WAI-ARIA tab pattern, so a screen reader and the arrow keys work.
test("options tabs: tablist, tab and tabpanel roles linked by id, arrow keys wired", () => {
    const html = R("options.html"), js = R("options.js");
    const tabs = [...html.matchAll(/<button class="nav-tab[^"]*" id="navtab-(tab-\w+)" role="tab" aria-selected="(true|false)" aria-controls="(tab-\w+)"/g)];
    assert.equal(tabs.length, 4, "every work tab carries role=tab; About is a plain link to the history panel");
    assert.ok(html.includes('class="nav-about" id="navtab-tab-history"') && html.includes('data-tab="tab-history"'), "About link opens the history panel");
    assert.equal(tabs.filter(t => t[2] === "true").length, 1, "exactly one selected tab");
    for (const t of tabs) {
        assert.equal(t[1], t[3]);
        assert.ok(html.includes(`id="${t[1]}" class="tab-panel`) && html.includes(`aria-labelledby="navtab-${t[1]}"`), `${t[1]} panel is labelled by its tab`);
    }
    assert.ok(html.includes('role="tablist"'));
    for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) assert.ok(js.includes(key), key);
});
