#!/usr/bin/env node
// Builds the ZIP that is uploaded to the Chrome Web Store dashboard: only the files the extension
// loads (manifest, root .js/.html/.css, icons/, images/). No tools/, tests/, docs/ or git data.
// Pure Node (no `zip` binary), so it also runs on Windows.
//   node tools/package-store.js [--out DIR]   writes DIR/dich-phu-de-<version>.zip (default: ./dist)
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.join(__dirname, "..");
const RUNTIME_DIRS = ["icons", "images"];

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
})();
function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function storeFiles(root = ROOT) {
    const files = fs.readdirSync(root).filter(f => (f === "manifest.json" || /\.(js|html|css)$/.test(f)) && fs.statSync(path.join(root, f)).isFile());
    for (const d of RUNTIME_DIRS) {
        for (const f of fs.readdirSync(path.join(root, d))) if (!f.startsWith(".")) files.push(d + "/" + f);
    }
    return files.sort();
}

// Minimal ZIP writer: deflate each entry, fixed DOS timestamp so the same sources give the same bytes.
function zipFiles(root, names) {
    const parts = [], central = [];
    let offset = 0;
    for (const name of names) {
        const raw = fs.readFileSync(path.join(root, name));
        const data = zlib.deflateRawSync(raw, { level: 9 });
        const nameBuf = Buffer.from(name, "utf8");
        const crc = crc32(raw);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
        local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); // 00:00:00, 1980-01-01
        local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBuf.length, 26);
        parts.push(local, nameBuf, data);
        const cen = Buffer.alloc(46);
        cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
        cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0x21, 14);
        cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(raw.length, 24); cen.writeUInt16LE(nameBuf.length, 28);
        cen.writeUInt32LE(offset, 42);
        central.push(cen, nameBuf);
        offset += local.length + nameBuf.length + data.length;
    }
    const cenBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10);
    end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, cenBuf, end]);
}

function build(outDir, root = ROOT) {
    const names = storeFiles(root);
    const version = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")).version;
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `dich-phu-de-${version}.zip`);
    fs.writeFileSync(file, zipFiles(root, names));
    return { file, version, names };
}

if (require.main === module) {
    const i = process.argv.indexOf("--out");
    const { file, names } = build(i > 0 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, "dist"));
    console.log(`${file}\n${names.length} files, ${(fs.statSync(file).size / 1048576).toFixed(2)} MB`);
}

module.exports = { build, storeFiles, zipFiles, crc32 };
