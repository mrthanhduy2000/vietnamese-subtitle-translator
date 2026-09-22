// Sau khi Tải lại tiện ích, mã CŨ và mã MỚI cùng chạy trong một tab (tới ~1,5 giây). Đo thật
// 22/09/2026: tab YouTube treo cứng (330% CPU) vì hai bên xóa nút của nhau rồi tự tạo lại vô tận
// (bộ theo dõi DOM chạy dạng vi tác vụ -> trang không bao giờ được thở, bộ tự tắt không kịp chạy).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

// DOM tối giản: đủ cho nút trên thanh điều khiển YouTube và bộ theo dõi thêm / bớt phần tử
function miniDom() {
    const observers = [];
    const queue = [];
    const notify = () => observers.forEach(o => { if (o.on) queue.push(o); });
    class El {
        constructor(tag) { this.tagName = tag; this.children = []; this.parent = null; this.dataset = {}; this.style = {}; this.className = ""; this.attrs = {}; this.id = ""; }
        get isConnected() { let e = this; while (e.parent) e = e.parent; return e === doc.documentElement; }
        appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); notify(); return c; }
        insertBefore(c) { return this.appendChild(c); }
        remove() { if (!this.parent) return; this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; notify(); }
        setAttribute(k, v) { this.attrs[k] = v; }
        getAttribute(k) { return this.attrs[k]; }
        addEventListener() {}
        removeEventListener() {}
        getBoundingClientRect() { return { width: 0, height: 0, top: 0, left: 0 }; }
        set innerHTML(v) { this._html = v; }
        get classList() { const e = this; return { add: c => { e.className += " " + c; }, remove() {}, contains: c => e.className.split(/\s+/).includes(c), toggle() {} }; }
        matches(sel) {
            const m = sel.match(/^([.#])([\w-]+)(?:\[data-cst-gen="([^"]+)"\])?$/);
            if (!m) return false;
            if (m[1] === "#") return this.id === m[2];
            if (!this.className.split(/\s+/).includes(m[2])) return false;
            return m[3] == null || this.dataset.cstGen === m[3];
        }
        all() { return this.children.flatMap(c => [c, ...c.all()]); }
        querySelectorAll(sel) { const parts = sel.split(",").map(x => x.trim()); return this.all().filter(e => parts.some(p => e.matches(p))); }
        querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    }
    const doc = {
        documentElement: new El("html"),
        createElement: t => new El(t),
        addEventListener() {}, readyState: "complete", title: "t",
        getElementById: id => doc.documentElement.querySelector("#" + id),
        querySelector: s => doc.documentElement.querySelector(s),
        querySelectorAll: s => doc.documentElement.querySelectorAll(s),
        getElementsByTagName: () => []
    };
    doc.body = doc.documentElement.appendChild(new El("body"));
    doc.head = doc.documentElement.appendChild(new El("head"));
    const player = doc.body.appendChild(new El("div")); player.id = "movie_player"; player.className = "html5-video-player";
    const rc = player.appendChild(new El("div")); rc.className = "ytp-right-controls";
    class MO {
        constructor(cb) { this.cb = cb; this.on = false; observers.push(this); }
        observe() { this.on = true; }
        disconnect() { this.on = false; }
    }
    // Chạy các lượt báo thay đổi như vi tác vụ của trình duyệt; trả về số lượt (quá trần = vòng vô tận)
    const pump = (cap = 500) => {
        let n = 0;
        while (queue.length) { const o = queue.shift(); if (!o.on) continue; if (++n > cap) return n; o.cb([]); }
        return n;
    };
    return { doc, MO, pump, rc };
}

function loadGen(dom, file, connected) {
    const noop = () => {};
    const sb = {
        console: { log: noop, warn: noop, error: noop }, setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
        URL, Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number, TextEncoder,
        location: { href: "https://www.youtube.com/watch?v=abc123", hostname: "www.youtube.com", pathname: "/watch" },
        document: dom.doc, MutationObserver: dom.MO, addEventListener: noop, postMessage: noop, requestAnimationFrame: () => 0,
        getComputedStyle: () => ({ position: "relative" }),
        chrome: {
            storage: { sync: { get: async d => d, set: async () => {} }, local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener: noop } },
            runtime: { get id() { return connected() ? "x" : undefined; }, onMessage: { addListener: noop }, getURL: p => p, sendMessage: noop }
        }
    };
    sb.window = sb; sb.globalThis = sb;
    vm.createContext(sb);
    for (const f of ["cost-policy.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js"]) vm.runInContext(read(f), sb);
    vm.runInContext(file === "youtube.js" ? read(file) : fs.readFileSync(file, "utf8"), sb);
    return sb;
}

test("Tải lại tiện ích khi tab YouTube đang mở: mã cũ và mã mới KHÔNG xóa / tạo lại nút của nhau vô tận (trang không treo)", () => {
    const dom = miniDom();
    let oldAlive = true;
    const A = loadGen(dom, "youtube.js", () => oldAlive);    // mã cũ (thế hệ trước)
    vm.runInContext("ytTaoNutThanhDieuKhien(); ytTheoDoi();", A);
    dom.pump();
    const B = loadGen(dom, "youtube.js", () => true);        // mã mới vừa được nạp vào tab
    vm.runInContext("ytTaoNutThanhDieuKhien(); ytTheoDoi();", B);
    const n = dom.pump();
    assert.ok(n < 50, `hai thế hệ mã xóa / tạo lại nút của nhau ${n} lượt (vòng vô tận -> treo tab)`);
    const visible = dom.rc.children.filter(b => b.style.display !== "none");
    assert.equal(visible.length, 1, "chỉ còn MỘT nút hiện trên thanh điều khiển");
    assert.equal(visible[0].dataset.cstGen, vm.runInContext("YT_GEN", B), "nút hiện là của mã mới");
    // Mã cũ tự tắt: gỡ nút của nó; không tạo lại, không động tới nút của mã mới
    oldAlive = false;
    vm.runInContext("yt.dead = true; if (yt.btnObserver) yt.btnObserver.disconnect(); document.querySelectorAll(YT_BTN).forEach(el => el.remove());", A);
    assert.ok(dom.pump() < 50);
    assert.equal(dom.rc.children.length, 1);
    assert.equal(dom.rc.children[0].dataset.cstGen, vm.runInContext("YT_GEN", B));
});

// Bản vá phải an toàn cả với mã CŨ (1.3.5 trở về trước) đang chạy trong tab lúc người dùng cập nhật
test("mã mới gặp mã CŨ chưa vá (còn xóa nút của thế hệ khác): vẫn dừng, không treo", { skip: !process.env.OLD_YT && "đặt OLD_YT=<đường dẫn youtube.js cũ> để chạy" }, () => {
    const dom = miniDom();
    const A = loadGen(dom, process.env.OLD_YT, () => true);
    vm.runInContext("ytTaoNutThanhDieuKhien(); ytTheoDoi();", A);
    dom.pump();
    const B = loadGen(dom, "youtube.js", () => true);
    vm.runInContext("ytTaoNutThanhDieuKhien(); ytTheoDoi();", B);
    const n = dom.pump();
    assert.ok(n < 50, `${n} lượt`);
});
