#!/usr/bin/env node
// Đo tốc độ máy chủ giọng VieNeu: tạo cùng một câu vài lần rồi báo hệ số thời gian thực (RTF).
// RTF = thời gian tạo / thời lượng audio. Càng nhỏ càng nhanh; dưới 0,4 là thoải mái cho lồng tiếng.
//   node tools/vieneu-bench.js [số lần]
const LAN = Number(process.argv[2]) || 3;
const CAU = "Hôm nay chúng ta sẽ tìm hiểu cách mô hình học từ dữ liệu, và vì sao điều đó quan trọng với công việc của bạn.";

async function motLuot(i) {
    const t0 = Date.now();
    const r = await fetch("http://127.0.0.1:8000/v1/audio/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "vieneu", input: CAU, voice: "Mỹ Duyên", response_format: "wav", temperature: 0.6, seed: 1000 + i })
    });
    if (!r.ok) throw new Error("máy chủ trả " + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    const ms = Date.now() - t0;
    // WAV: tốc độ lấy mẫu ở byte 24, dữ liệu sau header 44 byte, 16 bit đơn kênh
    const sr = buf.readUInt32LE(24);
    const giay = (buf.length - 44) / 2 / sr;
    return { ms, giay, rtf: ms / 1000 / giay };
}

(async () => {
    try {
        const h = await (await fetch("http://127.0.0.1:8000/health")).json();
        console.log(`Máy chủ: ${h.backend}, ${h.max_streams} luồng, đang chạy ${h.active}, chờ ${h.waiting}`);
    } catch (e) {
        console.log("Không gọi được máy chủ VieNeu:", e.message);
        process.exit(1);
    }
    const kq = [];
    for (let i = 0; i < LAN; i++) {
        const x = await motLuot(i);
        kq.push(x);
        console.log(`lượt ${i + 1}: audio ${x.giay.toFixed(2)} giây, tạo mất ${(x.ms / 1000).toFixed(2)} giây, RTF ${x.rtf.toFixed(2)}`);
    }
    const tb = kq.reduce((a, x) => a + x.rtf, 0) / kq.length;
    console.log(`RTF trung bình: ${tb.toFixed(2)} (dưới 0,40 là tốt cho lồng tiếng theo thời gian thực)`);
})();
