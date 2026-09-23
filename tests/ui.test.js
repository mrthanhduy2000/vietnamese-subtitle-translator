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
    for (const f of ["glossary.js", "cst-cache.js", "cost-policy.js", "lang-detect.js", "vi-segmenter.js", "subtitle-style.js", "player-ui.js", "context-engine.js", "vi-quality.js", "content.js", "youtube.js"]) vm.runInContext(read(f), sb);
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
    assert.match(R("dubbing.js"), /rtf < 0\.8/, "ngưỡng cảnh báo");
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
