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

test("phím tắt: manifest khai báo Alt+S (phụ đề) và Alt+D (lồng tiếng), có mô tả tiếng Việt", () => {
    const m = JSON.parse(R("manifest.json"));
    assert.ok(m.commands, "manifest chưa khai báo phím tắt nào");
    assert.equal(m.commands["bat-tat-phu-de"].suggested_key.default, "Alt+S");
    assert.equal(m.commands["bat-tat-long-tieng"].suggested_key.default, "Alt+D");
    assert.ok(Object.values(m.commands).every(c => c.description && /[\u00C0-\u1EF9]/.test(c.description)), "mô tả phím tắt phải bằng tiếng Việt");
    assert.ok(Object.keys(m.commands).length <= 4, "Chrome chỉ cho phép ít phím tắt gợi ý");
    // Không thêm quyền nào cho phím tắt (chrome.commands không cần quyền)
    assert.equal(JSON.stringify(m.permissions), JSON.stringify(["storage", "activeTab", "scripting"]));
    // Người dùng phải biết là có phím tắt
    assert.match(R("options.html"), /Alt\+S/);
    assert.match(R("popup.html"), /Alt<\/kbd>\+<kbd>S/);
});

test("phím tắt: service worker chuyển lệnh tới tab đang xem (không cần quyền tabs)", async () => {
    const env = bgEnv(async () => ({ ok: true }), {}, { tabs: [{ id: 7, url: "https://www.youtube.com/watch?v=abc" }] });
    assert.equal(env.commandListeners.length, 1, "chưa lắng nghe phím tắt");
    await env.commandListeners[0]("bat-tat-long-tieng", { id: 7, url: "https://www.youtube.com/watch?v=abc" });
    // So sánh bằng JSON: đối tượng do mã trong máy ảo tạo ra không cùng "khuôn" với đối tượng của bài kiểm tra
    assert.equal(JSON.stringify(env.tabMessages), JSON.stringify([{ id: 7, msg: { method: "phimTat", command: "bat-tat-long-tieng" } }]));
    // Không có tab kèm theo (một số hệ điều hành): tự tìm tab đang xem
    await env.commandListeners[0]("bat-tat-phu-de", null);
    assert.equal(JSON.stringify(env.tabMessages[1]), JSON.stringify({ id: 7, msg: { method: "phimTat", command: "bat-tat-phu-de" } }));
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
    assert.match(src, /e\.key !== "Tab"/, "Tab phải chạy vòng trong thực đơn");
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
    assert.equal(rows.length, 3, "phải có 3 dòng: phụ đề, lồng tiếng, bỏ qua khi cùng ngôn ngữ");
    assert.ok(rows.every(r => r.attrs["role"] === "switch" && r.tagName === "button"), "mỗi dòng phải là công tắc bấm được bằng bàn phím");
    assert.ok(rows.every(r => r.attrs["aria-checked"] === "true" || r.attrs["aria-checked"] === "false"), "công tắc phải báo đang bật hay tắt");
    assert.ok(!/BẬT|TẮT/.test(menu.textContent), "không dùng nhãn chữ 'BẬT' trông như nút bấm");
    assert.match(menu.textContent, /Alt\+S/);
    assert.match(menu.textContent, /Alt\+D/);

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
    for (const f of ["glossary.js", "cst-cache.js", "cost-policy.js", "lang-detect.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "content.js", "youtube.js"]) vm.runInContext(read(f), sb);
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

test("phím tắt mở bảng điều khiển", () => {
    const m = JSON.parse(R("manifest.json"));
    assert.equal(m.commands["_execute_action"].suggested_key.default, "Alt+Shift+V");
    assert.match(R("options.html"), /Alt\+Shift\+V/);
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
    for (const f of ["cst-cache.js", "cost-policy.js", "vi-segmenter.js", "dub-planner.js", "dub-audio.js", "dub-engine.js", "dubbing.js"]) vm.runInContext(read(f), sb);
    return sb;
}
