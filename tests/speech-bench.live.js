// Speech benchmark (manual, needs the local VieNeu server; not in npm test). Twelve representative
// sentences (short, long single idea, compound, question then answer, exclamation, list, technical,
// mixed English, numbers, acronyms, dialogue) go through the extension's own VieNeu path:
// adaptForSpeech -> breathing commas (1.7.6) -> server -> cleanTake -> shapePauses -> prepareSpeech.
// Prints, per sentence, the silences the voice made (raw) and what is left after shaping (final,
// >= 60 ms, which includes stop-consonant closures), each stop's decision (word before it, kind, kept
// length) and the speaking rate. OUT=<dir> also writes one WAV each.
// Run: node tests/speech-bench.live.js   (VOICE="Thái Sơn" to change voice, REPS=3 to repeat)
const path = require("path"), fs = require("fs");
const R = p => require(path.join(__dirname, "..", p));
const AUDIO = R("dub-audio.js"), PLAN = R("dub-planner.js"), COST = R("cost-policy.js"), PROSODY = R("dub-prosody.js");
const OUT = process.env.OUT;
const SAMPLES = [
    ["ngan", "Đúng vậy."],
    ["mo-dau", "Bây giờ, hãy cùng xem ví dụ."],
    ["dai-mot-y", "Mô hình này học cách dự đoán từ tiếp theo dựa trên toàn bộ ngữ cảnh mà nó đã nhìn thấy trước đó trong đoạn văn bản."],
    ["cau-ghep", "Chúng ta đã huấn luyện mô hình trên dữ liệu cũ, nhưng khi đưa vào thực tế thì độ chính xác giảm mạnh vì dữ liệu mới rất khác."],
    ["hoi-dap", "Vậy tại sao điều này lại quan trọng? Vì nếu bỏ qua bước này, kết quả sẽ sai hoàn toàn."],
    ["cam-than", "Thật tuyệt vời! Chỉ với vài dòng mã, chúng ta đã có một mô hình hoạt động."],
    ["liet-ke", "Bạn cần chuẩn bị ba thứ: dữ liệu huấn luyện, một mô hình cơ sở, và một hàm mất mát phù hợp."],
    ["ky-thuat", "Hàm kích hoạt ReLU giúp mạng nơ-ron học được các quan hệ phi tuyến giữa đầu vào và đầu ra."],
    ["anh-viet", "Chúng ta sẽ dùng thư viện PyTorch để xây dựng một mô hình Transformer đơn giản."],
    ["so-lieu", "Độ chính xác tăng từ 72,5% lên 91% sau khi huấn luyện thêm 3 epoch với 1.500.000 mẫu."],
    ["viet-tat", "Chúng ta sẽ chạy mô hình trên GPU thay vì CPU để tiết kiệm thời gian."],
    ["hoi-thoai", "Anh ấy hỏi: bạn có chắc không? Tôi trả lời: chắc chắn rồi."]
];
const r2 = xs => xs.map(x => Math.round(x * 100) / 100);
(async () => {
    const L = COST.LOCAL_TTS, voice = process.env.VOICE || "Mỹ Duyên", sr = L.sampleRate;
    const v = L.voices.find(x => x.id === voice);                   // same rumble cut as background.js
    const hp = v && v.gender === "Nữ" ? L.highPassHz.female : L.highPassHz.male;
    const reps = Number(process.env.REPS || 1);
    for (const [id, raw] of SAMPLES) {
        for (let k = 0; k < reps; k++) {
            const text = PROSODY.breathText(PLAN.adaptForSpeech(raw));
            const res = await fetch(L.url + "/v1/audio/speech", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: L.model, voice, input: text, response_format: "pcm", sample_rate: sr, temperature: L.temperature })
            });
            const bytes = new Uint8Array(await res.arrayBuffer());
            let s = AUDIO.pcm16leToFloat(bytes);
            const inner = (x, len) => x.filter(q => q.start > 0.05 && q.end < len / sr - 0.05);
            const rawSil = inner(AUDIO.findSilences(s, sr, { minMs: 90 }), s.length);
            s = AUDIO.cleanTake(s, sr, { hpHz: hp }).samples;
            const shaped = AUDIO.shapePauses(s, sr, text, { maxPause: L.maxPause });
            const fin = AUDIO.prepareSpeech(shaped.samples, sr);
            const finSil = inner(AUDIO.findSilences(fin, sr, { minMs: 60 }), fin.length);
            const syl = PLAN.countSyllables(text);
            const dur = fin.length / sr;
            const words = PROSODY.analyze(text).words;
            console.log(JSON.stringify({
                id, text, syl, raw: r2(rawSil.map(x => x.end - x.start)), final: r2(finSil.map(x => x.end - x.start)),
                stops: shaped.pauses.map(p => `${p.gap >= 0 ? words[p.gap].raw : "?"}|${p.kind}:${r2([p.dur])[0]}->${r2([p.keep])[0]}`),
                matched: shaped.matched, soft: shaped.soft, joined: shaped.joined,
                dur: Math.round(dur * 100) / 100, sps: Math.round(syl / dur * 10) / 10
            }));
            if (OUT && k === 0) fs.writeFileSync(path.join(OUT, `${id}.wav`), Buffer.from(AUDIO.encodeWav(fin, sr)));
        }
    }
})();
