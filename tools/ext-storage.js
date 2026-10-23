#!/usr/bin/env node
// Read-only view of the extension's chrome.storage.local as Chrome keeps it on disk (a LevelDB
// folder), so a session can measure the real translations (ytcache4_*), the cost ledger, the edits.
// Chrome compresses the table files (.ldb) with Snappy, so `strings` shows only fragments; the most
// recent writes sit uncompressed in the write-ahead log (.log). Both are read here, and for each key
// the value with the highest sequence number wins. Nothing is ever written to that folder; reading
// it while Chrome runs is safe (Chrome keeps its lock file, we never open it).
//
//   node tools/ext-storage.js                         list keys with value sizes
//   node tools/ext-storage.js --key=costLedger        print one value (JSON)
//   node tools/ext-storage.js --prefix=ytcache4_ --out=$TMPDIR/yt   one .json file per key
//   --dir=<folder>                                    another profile or extension id
//
// A cached video is { luc, cues: [[start, end, text]], vi: [[start, end, lines]], g: [[start, end,
// viText, srcCues, viCues, midLine]] } (youtube.js ytGhiCache; midLine 1 or 0 from 2.3.2, absent
// before): g[k][2] against g[k][3] is the translation
// of one group against its source lines. The Gemini key is in sync storage, not here; any key whose
// name holds "apikey" is still skipped, whatever folder is given.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_DIR = require("./platform-paths.js").extensionStore();

function varint(buf, pos) {
    let r = 0, s = 0, b;
    do { b = buf[pos++]; r += (b & 0x7f) * 2 ** s; s += 7; } while (b & 0x80);
    return [r, pos];
}

function snappy(src) {
    let [len, p] = varint(src, 0);
    const out = Buffer.alloc(len);
    let o = 0;
    while (p < src.length) {
        const tag = src[p++];
        const t = tag & 3;
        if (t === 0) {
            let l = tag >> 2;
            if (l >= 60) { const n = l - 59; l = 0; for (let i = 0; i < n; i++) l |= src[p++] << (8 * i); }
            l += 1;
            src.copy(out, o, p, p + l);
            o += l; p += l;
        } else {
            let l, off;
            if (t === 1) { l = ((tag >> 2) & 7) + 4; off = ((tag >> 5) << 8) | src[p++]; }
            else if (t === 2) { l = (tag >> 2) + 1; off = src[p] | (src[p + 1] << 8); p += 2; }
            else { l = (tag >> 2) + 1; off = src.readUInt32LE(p); p += 4; }
            for (let i = 0; i < l; i++) { out[o] = out[o - off]; o++; }
        }
    }
    return out;
}

// One block of a table: its entries, keys prefix-compressed against the entry before
function blockEntries(block) {
    const restarts = block.readUInt32LE(block.length - 4);
    const end = block.length - 4 - restarts * 4;
    const out = [];
    let p = 0, last = Buffer.alloc(0);
    while (p < end) {
        let shared, own, vlen;
        [shared, p] = varint(block, p); [own, p] = varint(block, p); [vlen, p] = varint(block, p);
        const key = Buffer.concat([last.subarray(0, shared), block.subarray(p, p + own)]);
        p += own;
        out.push([key, block.subarray(p, p + vlen)]);
        p += vlen;
        last = key;
    }
    return out;
}

function readBlock(buf, off, size) {
    const raw = buf.subarray(off, off + size);
    return buf[off + size] === 1 ? snappy(raw) : raw;
}

// Every record of one .ldb table as { key, seq, live, value }
function readTable(file) {
    const buf = fs.readFileSync(file);
    const footer = buf.subarray(buf.length - 48);
    let p = 0, metaOff, metaSize, indexOff, indexSize;
    [metaOff, p] = varint(footer, p); [metaSize, p] = varint(footer, p);
    [indexOff, p] = varint(footer, p); [indexSize, p] = varint(footer, p);
    const out = [];
    for (const [, handle] of blockEntries(readBlock(buf, indexOff, indexSize))) {
        let q = 0, off, size;
        [off, q] = varint(handle, q); [size, q] = varint(handle, q);
        for (const [ikey, value] of blockEntries(readBlock(buf, off, size))) {
            const tag = ikey.readBigUInt64LE(ikey.length - 8);
            out.push({ key: ikey.subarray(0, ikey.length - 8).toString("utf8"), seq: tag >> 8n, live: (tag & 0xffn) === 1n, value });
        }
    }
    return out;
}

// The write-ahead log: 32 KB blocks of fragments (7-byte header), each whole record a WriteBatch
function readLog(file) {
    const buf = fs.readFileSync(file);
    const out = [];
    let pending = [];
    for (let block = 0; block < buf.length; block += 32768) {
        let p = block;
        const end = Math.min(buf.length, block + 32768);
        while (p + 7 <= end) {
            const len = buf.readUInt16LE(p + 4), type = buf[p + 6];
            if (!type && !len) break;                            // zero padding at the block's end
            const data = buf.subarray(p + 7, p + 7 + len);
            p += 7 + len;
            if (type === 1) pending = [data];                    // FULL
            else if (type === 2) { pending = [data]; continue; } // FIRST
            else if (type === 3) { pending.push(data); continue; } // MIDDLE
            else if (type === 4) pending.push(data);             // LAST
            else continue;
            const batch = Buffer.concat(pending);
            pending = [];
            if (batch.length < 12) continue;
            let seq = batch.readBigUInt64LE(0);
            const count = batch.readUInt32LE(8);
            let q = 12;
            for (let i = 0; i < count && q < batch.length; i++, seq++) {
                const kind = batch[q++];
                let klen, vlen;
                [klen, q] = varint(batch, q);
                const key = batch.subarray(q, q + klen).toString("utf8");
                q += klen;
                if (kind === 1) {
                    [vlen, q] = varint(batch, q);
                    out.push({ key, seq, live: true, value: batch.subarray(q, q + vlen) });
                    q += vlen;
                } else out.push({ key, seq, live: false, value: null });
            }
        }
    }
    return out;
}

function readStore(dir) {
    const latest = new Map();
    const files = fs.readdirSync(dir);
    const records = [
        ...files.filter(f => f.endsWith(".ldb")).flatMap(f => readTable(path.join(dir, f))),
        ...files.filter(f => f.endsWith(".log") && f !== "LOG").flatMap(f => readLog(path.join(dir, f)))
    ];
    for (const r of records) {
        const cur = latest.get(r.key);
        if (!cur || cur.seq < r.seq) latest.set(r.key, r);
    }
    for (const [k, r] of latest) if (!r.live || /apikey/i.test(k)) latest.delete(k);
    return latest;
}

function main() {
    const arg = name => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : ""; };
    const dir = arg("dir") || DEFAULT_DIR;
    const store = readStore(dir);
    const key = arg("key"), prefix = arg("prefix"), out = arg("out");
    if (key) {
        const r = store.get(key);
        if (!r) { console.error(`no key ${key}`); process.exit(1); }
        console.log(r.value.toString("utf8"));
        return;
    }
    const keys = [...store.keys()].filter(k => !prefix || k.startsWith(prefix)).sort();
    if (out) {
        fs.mkdirSync(out, { recursive: true });
        for (const k of keys) fs.writeFileSync(path.join(out, k.replace(/[^\w.-]/g, "_") + ".json"), store.get(k).value);
        console.log(`${keys.length} values written to ${out}`);
        return;
    }
    for (const k of keys) console.log(`${String(store.get(k).value.length).padStart(8)}  ${k}`);
}

if (require.main === module) main();
module.exports = { readStore, readTable, readLog, snappy };
