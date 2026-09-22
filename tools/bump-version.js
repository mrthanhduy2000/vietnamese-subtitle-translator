#!/usr/bin/env node
// Tăng phiên bản theo quy tắc của Đàm: mỗi lần cập nhật +0.0.1; chữ số cuối tới 9 thì lần sau
// sang 0.1.0 (1.2.9 -> 1.3.0); chữ số giữa tới 9 thì sang phiên bản chính (1.9.9 -> 2.0.0).
// Ghi đồng thời: manifest.json, package.json, build-info.js (thời gian cập nhật), nhãn phiên bản
// trong options.html và popup.html.
//   node tools/bump-version.js            -> tăng một bậc, thời gian = bây giờ
//   node tools/bump-version.js 1.2.5      -> đặt đúng phiên bản này (sửa lại số sai)
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const file = f => path.join(ROOT, f);

function next(v) {
    let [a, b, c] = v.split(".").map(Number);
    c += 1;
    if (c > 9) { c = 0; b += 1; }
    if (b > 9) { b = 0; a += 1; }
    return `${a}.${b}.${c}`;
}

function valid(v) { return /^\d+\.\d\.\d$/.test(v); }

// Thời gian địa phương (giờ Việt Nam trên máy Đàm) dạng 22/09/2026 13:31
function stamp(d = new Date()) {
    const p = n => String(n).padStart(2, "0");
    return { iso: d.toISOString(), label: `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}` };
}

function main() {
    const manifest = JSON.parse(fs.readFileSync(file("manifest.json"), "utf8"));
    const target = process.argv[2] || next(manifest.version);
    if (!valid(target)) throw new Error(`Phiên bản ${target} sai quy tắc (mỗi chữ số phụ chỉ 0 đến 9)`);
    const t = stamp();
    const sub = (f, re, to) => {
        const s = fs.readFileSync(file(f), "utf8");
        if (!re.test(s)) throw new Error(`Không tìm thấy chỗ ghi phiên bản trong ${f}`);
        fs.writeFileSync(file(f), s.replace(re, to));
    };
    sub("manifest.json", /"version": "[^"]+"/, `"version": "${target}"`);
    sub("package.json", /"version": "[^"]+"/, `"version": "${target}"`);
    sub("options.html", /<span class="header-badge"[^>]*>[^<]*<\/span>/,
        `<span class="header-badge" title="Cập nhật lúc ${t.label}">Phiên bản v${target} · cập nhật ${t.label}</span>`);
    sub("popup.html", /<span class="brand-badge"[^>]*>[^<]*<\/span>/,
        `<span class="brand-badge" title="Cập nhật lúc ${t.label}">v${target}</span>`);
    fs.writeFileSync(file("build-info.js"),
`// Tạo bởi tools/bump-version.js, không sửa tay
(function (root) {
    const info = { version: "${target}", updatedAt: "${t.iso}", updatedLabel: "${t.label}" };
    if (typeof module === "object" && module.exports) module.exports = info;
    if (root) root.CST_BUILD = info;
})(typeof globalThis !== "undefined" ? globalThis : this);
`);
    console.log(`Phiên bản ${manifest.version} -> ${target}, cập nhật ${t.label}`);
}

if (require.main === module) main();
module.exports = { next, valid };
