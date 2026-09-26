// ============================================================
// XỬ LÝ AUDIO LỒNG TIẾNG (thuần, không phụ thuộc Web Audio)
//
// - Đọc/ghi WAV PCM 16-bit (Gemini TTS trả PCM 24 kHz mono)
// - Đo mức âm: đỉnh, RMS, số mẫu bị vỡ (clipping), khoảng lặng đầu/cuối
// - Chuẩn hóa âm lượng về một mức RMS thống nhất, có trần đỉnh + nén mềm
//   -> giọng giữa các đoạn đều nhau, không vỡ tiếng
// - Cắt bớt khoảng lặng thừa đầu/cuối (để khớp thời lượng chính xác)
// - Làm mờ hai đầu (fade) -> không có tiếng "bụp"/click ở ranh giới đoạn
// - Tìm khoảng lặng & cắt một audio nhiều câu thành từng đoạn theo tỷ lệ
//   mong đợi (gộp nhiều đoạn vào một lượt TTS để tiết kiệm yêu cầu)
// ============================================================
(function (root) {
    "use strict";

    const dbToLin = db => Math.pow(10, db / 20);
    const linToDb = x => (x > 0 ? 20 * Math.log10(x) : -Infinity);

    // ---------------- WAV / PCM ----------------
    function base64ToBytes(b64) {
        if (typeof atob === "function") {
            const bin = atob(b64);
            const out = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
            return out;
        }
        return new Uint8Array(Buffer.from(b64, "base64"));
    }

    function pcm16leToFloat(bytes) {
        const n = Math.floor(bytes.length / 2);
        const out = new Float32Array(n);
        const dv = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
        for (let i = 0; i < n; i++) out[i] = dv.getInt16(i * 2, true) / 32768;
        return out;
    }

    function decodeWav(input) {
        const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
        if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Không phải file WAV");
        let pos = 12, fmt = null, data = null;
        while (pos + 8 <= bytes.length) {
            const id = tag(pos);
            const size = dv.getUint32(pos + 4, true);
            if (id === "fmt ") {
                fmt = { format: dv.getUint16(pos + 8, true), channels: dv.getUint16(pos + 10, true), sampleRate: dv.getUint32(pos + 12, true), bits: dv.getUint16(pos + 22, true) };
            } else if (id === "data") {
                data = bytes.subarray(pos + 8, pos + 8 + Math.min(size, bytes.length - pos - 8));
            }
            pos += 8 + size + (size % 2);
        }
        if (!fmt || !data) throw new Error("WAV thiếu fmt/data");
        if (fmt.bits !== 16) throw new Error("Chỉ hỗ trợ PCM 16-bit");
        const inter = pcm16leToFloat(data);
        if (fmt.channels === 1) return { sampleRate: fmt.sampleRate, samples: inter };
        const n = Math.floor(inter.length / fmt.channels);
        const mono = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            let s = 0;
            for (let c = 0; c < fmt.channels; c++) s += inter[i * fmt.channels + c];
            mono[i] = s / fmt.channels;
        }
        return { sampleRate: fmt.sampleRate, samples: mono };
    }

    function encodeWav(samples, sampleRate) {
        const n = samples.length;
        const buf = new ArrayBuffer(44 + n * 2);
        const dv = new DataView(buf);
        const w = (o, s) => { for (let i = 0; i < 4; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
        w(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); w(8, "WAVE");
        w(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
        dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
        w(36, "data"); dv.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) {
            const x = Math.max(-1, Math.min(1, samples[i]));
            dv.setInt16(44 + i * 2, x < 0 ? Math.round(x * 32768) : Math.round(x * 32767), true);
        }
        return new Uint8Array(buf);
    }

    // ---------------- Đo mức âm ----------------
    function frameRms(samples, sr, frameMs = 10) {
        const size = Math.max(1, Math.round(sr * frameMs / 1000));
        const frames = new Float32Array(Math.ceil(samples.length / size));
        for (let f = 0; f < frames.length; f++) {
            let s = 0, c = 0;
            for (let i = f * size; i < Math.min(samples.length, (f + 1) * size); i++) { s += samples[i] * samples[i]; c++; }
            frames[f] = Math.sqrt(s / Math.max(1, c));
        }
        return { frames, size };
    }

    // Ngưỡng lặng tương đối: thấp hơn mức nói điển hình ~30 dB
    function silenceThreshold(frames) {
        const sorted = Array.from(frames).filter(x => x > 1e-5).sort((a, b) => a - b);
        if (!sorted.length) return 1e-4;
        const speech = sorted[Math.floor(sorted.length * 0.9)];
        return Math.max(speech * dbToLin(-30), dbToLin(-60));
    }

    function analyze(samples, sr) {
        let peak = 0, sum = 0, clipped = 0;
        for (let i = 0; i < samples.length; i++) {
            const a = Math.abs(samples[i]);
            if (a > peak) peak = a;
            if (a >= 0.999) clipped++;
            sum += samples[i] * samples[i];
        }
        const { frames, size } = frameRms(samples, sr);
        const th = silenceThreshold(frames);
        let lead = 0; while (lead < frames.length && frames[lead] < th) lead++;
        let trail = 0; while (trail < frames.length - lead && frames[frames.length - 1 - trail] < th) trail++;
        // RMS của phần có tiếng (bỏ khoảng lặng) để so độ to giữa các đoạn
        let vs = 0, vc = 0;
        frames.forEach(f => { if (f >= th) { vs += f * f; vc++; } });
        return {
            duration: samples.length / sr,
            peakDb: linToDb(peak),
            rmsDb: linToDb(Math.sqrt(sum / Math.max(1, samples.length))),
            voicedRmsDb: linToDb(Math.sqrt(vs / Math.max(1, vc))),
            clipped,
            leadingSilence: lead * size / sr,
            trailingSilence: trail * size / sr
        };
    }

    // ---------------- Khoảng lặng ----------------
    function findSilences(samples, sr, opts = {}) {
        const minMs = opts.minMs || 150;
        const { frames, size } = frameRms(samples, sr, 10);
        const th = opts.threshold || silenceThreshold(frames);
        const out = [];
        let s = -1;
        for (let f = 0; f <= frames.length; f++) {
            const quiet = f < frames.length && frames[f] < th;
            if (quiet && s < 0) s = f;
            if (!quiet && s >= 0) {
                if ((f - s) * 10 >= minMs) out.push({ start: s * size / sr, end: Math.min(samples.length, f * size) / sr, dur: (f - s) * 10 / 1000 });
                s = -1;
            }
        }
        return out;
    }

    function trimSilence(samples, sr, keepMs = 30) {
        const a = analyze(samples, sr);
        const keep = keepMs / 1000;
        const from = Math.max(0, Math.floor((a.leadingSilence - keep) * sr));
        const to = Math.min(samples.length, Math.ceil(samples.length - Math.max(0, a.trailingSilence - keep) * sr));
        return to > from ? samples.slice(from, to) : samples.slice();
    }

    // ---------------- Âm lượng & ranh giới ----------------
    // Đưa phần có tiếng về targetDb (RMS), trần đỉnh ceilDb, phần vượt trần nén mềm.
    function normalize(samples, sr, opts = {}) {
        const target = opts.targetDb !== undefined ? opts.targetDb : -19;
        const ceil = dbToLin(opts.ceilDb !== undefined ? opts.ceilDb : -1.5);
        const a = analyze(samples, sr);
        if (!Number.isFinite(a.voicedRmsDb)) return samples.slice();
        let gain = dbToLin(target - a.voicedRmsDb);
        gain = Math.min(gain, dbToLin(18));                      // không khuếch đại tiếng ồn quá mức
        const out = new Float32Array(samples.length);
        const knee = ceil * 0.8;
        for (let i = 0; i < samples.length; i++) {
            let x = samples[i] * gain;
            const ax = Math.abs(x);
            if (ax > knee) {
                // nén mềm: tiệm cận trần, không cắt cứng (không méo gắt)
                const over = (ax - knee) / (ceil - knee);
                x = Math.sign(x) * (knee + (ceil - knee) * Math.tanh(over));
            }
            out[i] = x;
        }
        return out;
    }

    function fade(samples, sr, inMs = 8, outMs = 15) {
        const out = samples.slice();
        const ni = Math.min(out.length, Math.round(sr * inMs / 1000));
        const no = Math.min(out.length, Math.round(sr * outMs / 1000));
        for (let i = 0; i < ni; i++) out[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / ni);
        for (let i = 0; i < no; i++) out[out.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / no);
        return out;
    }

    // Bước nhảy biên độ lớn nhất ở hai đầu (click) sau xử lý
    function edgeJump(samples) {
        if (!samples.length) return 0;
        return Math.max(Math.abs(samples[0]), Math.abs(samples[samples.length - 1]));
    }

    // Chuẩn bị một đoạn nói để phát: cắt lặng, chuẩn hóa, fade
    // Rút ngắn khoảng lặng DÀI bên trong câu (giọng kể chuyện của VieNeu ngừng 0,3 đến 0,6 giây
    // ở mỗi dấu phẩy) xuống tối đa maxPause, giữ phần đầu và cuối khoảng lặng (hơi thở, đuôi âm),
    // cắt ở giữa rồi làm mờ hai mép để không có tiếng "tách". Giọng không đổi, chỉ bớt chỗ trống.
    function compressPauses(samples, sr, opts = {}) {
        const maxPause = opts.maxPause != null ? opts.maxPause : 0.22;
        const sil = findSilences(samples, sr, { minMs: Math.round(maxPause * 1000) + 30 })
            .filter(x => x.start > 0.05 && x.end < samples.length / sr - 0.05);   // chỉ khoảng lặng BÊN TRONG
        if (!sil.length) return samples;
        const keep = Math.round(maxPause * sr);
        const fadeN = Math.max(1, Math.round(sr * 0.008));
        const pieces = [];
        let pos = 0, removed = 0;
        for (const x of sil) {
            const a = Math.round(x.start * sr), b = Math.round(x.end * sr);
            const cutFrom = a + Math.floor(keep / 2), cutTo = b - Math.ceil(keep / 2);
            if (cutTo - cutFrom <= fadeN * 2) continue;
            pieces.push(samples.slice(pos, cutFrom));
            pos = cutTo;
            removed += cutTo - cutFrom;
        }
        if (!removed) return samples;
        pieces.push(samples.slice(pos));
        const out = new Float32Array(samples.length - removed);
        let o = 0;
        pieces.forEach((pc, k) => {
            const c = Float32Array.from(pc);
            if (k > 0) for (let i = 0; i < Math.min(fadeN, c.length); i++) c[i] *= i / fadeN;
            if (k < pieces.length - 1) for (let i = 0; i < Math.min(fadeN, c.length); i++) c[c.length - 1 - i] *= i / fadeN;
            out.set(c, o);
            o += c.length;
        });
        return out;
    }

    // Shorten each listed silence { start, end, keep } (seconds) to `keep`, cutting out its middle so
    // the breath and word tails on both sides survive; 8 ms fades at every cut (no clicks).
    function shrinkSilences(samples, sr, list) {
        const fadeN = Math.max(1, Math.round(sr * 0.008));
        const pieces = [];
        let pos = 0, removed = 0;
        for (const x of list.slice().sort((a, b) => a.start - b.start)) {
            const a = Math.round(x.start * sr), b = Math.round(x.end * sr);
            const keep = Math.round(Math.max(0, x.keep) * sr);
            const cutFrom = a + Math.floor(keep / 2), cutTo = b - Math.ceil(keep / 2);
            if (cutFrom < pos || cutTo - cutFrom <= fadeN * 2) continue;
            pieces.push(samples.slice(pos, cutFrom));
            pos = cutTo;
            removed += cutTo - cutFrom;
        }
        if (!removed) return samples;
        pieces.push(samples.slice(pos));
        const out = new Float32Array(samples.length - removed);
        let o = 0;
        pieces.forEach((pc, k) => {
            const c = Float32Array.from(pc);
            if (k > 0) for (let i = 0; i < Math.min(fadeN, c.length); i++) c[i] *= i / fadeN;
            if (k < pieces.length - 1) for (let i = 0; i < Math.min(fadeN, c.length); i++) c[c.length - 1 - i] *= i / fadeN;
            out.set(c, o);
            o += c.length;
        });
        return out;
    }

    // Where the text itself asks for a pause: one entry per word that ends in punctuation (the last
    // word excluded), with its position as a share of the words spoken so far and the pause it earns.
    // v2 (1.6.8): the pause also follows the phrase. A comma after a short lead-in ("Vâng," "Trước
    // hết,") is a light touch, after a long clause a real breath; a comma followed by a joining word
    // (và, nhưng, còn, rồi, mà...) leans on into the next clause; ? and ! rest a little longer.
    const JOINERS = /^(và|nhưng|còn|rồi|mà|hay|hoặc|nên|vì|thì|để|khi|nếu|song|tuy)$/i;
    function punctuationBreaks(text, caps) {
        const words = String(text || "").split(/\s+/).filter(Boolean);
        const out = [];
        let since = 0;
        for (let i = 0; i < words.length - 1; i++) {
            since++;
            const m = words[i].match(/([.!?…]|[;:]|,)["”')\]]*$/);
            if (!m) continue;
            const kind = /[.!?…]/.test(m[1]) ? "sentence" : /[;:]/.test(m[1]) ? "clause" : "comma";
            let cap = caps[kind];
            if (kind === "comma") {
                const next = String(words[i + 1] || "").replace(/[^\p{L}]/gu, "");
                cap = Math.min(caps.comma, 0.14 + 0.012 * Math.min(since, 12));
                if (JOINERS.test(next)) cap = Math.max(0.12, cap - 0.04);
            } else if (kind === "sentence" && /[?!]/.test(m[1])) cap = Math.min(caps.sentence + 0.05, caps.max);
            out.push({ frac: (i + 1) / words.length, kind, cap });
            since = 0;
        }
        return out;
    }

    // Punctuation-aware pause shaping (1.6.7). The voice model also stops where the text has no
    // punctuation at all (mid-phrase hesitations of 0.15 to 0.4 s), and the old compressPauses only
    // touched silences longer than maxPause, so those stops stayed and broke the phrase apart.
    // Now every internal silence is matched to the punctuation of the text by its position in
    // voiced time: a matched one keeps up to its punctuation's pause, every other one is closed to
    // a joint (joinPause), so the voice runs on until the text itself asks for a pause.
    function shapePauses(samples, sr, text, opts = {}) {
        const maxPause = opts.maxPause != null ? opts.maxPause : 0.4;
        const caps = {
            max: maxPause,
            sentence: Math.min(maxPause, opts.sentencePause != null ? opts.sentencePause : 0.4),
            clause: Math.min(maxPause, opts.clausePause != null ? opts.clausePause : 0.32),
            comma: Math.min(maxPause, opts.commaPause != null ? opts.commaPause : 0.28)
        };
        const joinPause = opts.joinPause != null ? opts.joinPause : 0.09;
        const dur = samples.length / sr;
        const sil = findSilences(samples, sr, { minMs: opts.minMs || 90 })
            .filter(x => x.start > 0.05 && x.end < dur - 0.05);
        if (!sil.length) return { samples, matched: 0, joined: 0, breaths: 0 };
        // voiced time before each silence: speech rate varies, pauses do not count as progress
        let quiet = 0;
        for (const x of sil) { x.vt = x.start - quiet; quiet += x.end - x.start; }
        const voiced = Math.max(0.1, dur - quiet);
        const breaks = punctuationBreaks(text, caps);
        const used = new Set();
        let from = 0;
        for (const b of breaks) {
            const want = b.frac * voiced;
            const tol = Math.max(0.6, voiced * 0.12);
            let best = -1, bestScore = -Infinity;
            for (let j = from; j < sil.length; j++) {
                const d = Math.abs(sil[j].vt - want);
                if (d > tol) { if (sil[j].vt > want) break; continue; }
                const score = Math.min(0.6, sil[j].dur) - d * 0.8;
                if (score > bestScore) { bestScore = score; best = j; }
            }
            if (best < 0) continue;
            used.add(best);
            sil[best].keep = b.cap;
            from = best + 1;
        }
        // A long run with no punctuation still needs somewhere to breathe: after breathEvery seconds
        // of voiced speech since the last kept pause, the next real stop keeps a short breath
        const breathEvery = opts.breathEvery != null ? opts.breathEvery : 4.5;
        const breathPause = Math.min(maxPause, opts.breathPause != null ? opts.breathPause : 0.16);
        const list = [];
        let joined = 0, breaths = 0, lastKept = 0;
        sil.forEach((x, j) => {
            let keep;
            if (used.has(j)) keep = Math.min(x.dur, x.keep);
            else if (x.vt - lastKept >= breathEvery && x.dur >= 0.15) { keep = Math.min(x.dur, breathPause); breaths++; }
            else { keep = Math.min(x.dur, joinPause); if (x.dur > joinPause + 0.02) joined++; }
            if (keep > joinPause) lastKept = x.vt;
            if (x.dur - keep > 0.02) list.push({ start: x.start, end: x.end, keep });
        });
        return { samples: shrinkSilences(samples, sr, list), matched: used.size, joined, breaths };
    }

    // Downward expander for the gaps between words. Some VieNeu voices carry a hiss from their
    // reference recording (measured: Mỹ Duyên's silence sits at -51 dB against -75 dB for Thục Đoan
    // and Kim Thanh); speech masks it, the gaps do not. Frames under the silence threshold are
    // pulled down by up to `depthDb`, with a smoothed gain so no word onset is clipped.
    function gateNoise(samples, sr, opts = {}) {
        // 1.6.8: gentler than 1.6.7 (was 18 dB below a fixed -30 dB-under-speech threshold, 30 ms
        // hold), which also caught the soft decay of words and made word ends sound clipped. The
        // threshold now follows the take's own noise floor: only frames within 6 dB of it count as a
        // gap (Mỹ Duyên: floor ~-53 dB, gate under ~-47), never above 30 dB under speech. The gate
        // holds 60 ms after a word, opens 40 ms before one, and releases over ~50 ms.
        const depth = dbToLin(-(opts.depthDb != null ? opts.depthDb : 14));
        const { frames, size } = frameRms(samples, sr, 10);
        const sorted = Array.from(frames).filter(x => x > 1e-6).sort((a, b) => a - b);
        if (!sorted.length) return samples;
        const speechLevel = sorted[Math.floor(sorted.length * 0.9)];
        const floor = sorted[Math.floor(sorted.length * 0.1)];
        const th = Math.min(speechLevel * dbToLin(-30), Math.max(floor * dbToLin(6), dbToLin(-72)));
        const open = new Uint8Array(frames.length);
        for (let f = 0; f < frames.length; f++) if (frames[f] >= th) for (let k = Math.max(0, f - 4); k <= Math.min(frames.length - 1, f + 6); k++) open[k] = 1;
        const target = Array.from(open, o => (o ? 1 : depth));
        // smooth: open within 2 frames, close slowly
        const g = new Float32Array(frames.length);
        let cur = 1;
        for (let f = 0; f < frames.length; f++) {
            const t = target[f];
            cur = t > cur ? cur + (t - cur) * 0.6 : cur + (t - cur) * 0.2;
            g[f] = cur;
        }
        const out = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            const f = Math.min(frames.length - 1, Math.floor(i / size));
            const nx = Math.min(frames.length - 1, f + 1);
            const w = (i - f * size) / size;
            out[i] = samples[i] * (g[f] * (1 - w) + g[nx] * w);
        }
        return out;
    }

    function prepareSpeech(samples, sr, opts = {}) {
        const trimmed = trimSilence(samples, sr, opts.keepMs || 25);
        const norm = normalize(trimmed, sr, opts);
        return fade(norm, sr, opts.fadeInMs || 8, opts.fadeOutMs || 18);
    }

    // ---------------- Cắt audio nhiều câu thành từng đoạn ----------------
    // weights: tỷ lệ thời lượng mong đợi của từng đoạn (ví dụ theo số âm tiết).
    // Chọn (n-1) khoảng lặng vừa DÀI vừa gần vị trí mong đợi; quy hoạch động
    // giữ đúng thứ tự. Trả về [{start,end}] (giây) và độ tin cậy.
    function splitBySilence(samples, sr, weights, opts = {}) {
        const n = weights.length;
        const dur = samples.length / sr;
        if (n <= 1) return { parts: [{ start: 0, end: dur }], confidence: 1, method: "single" };
        const sil = findSilences(samples, sr, { minMs: opts.minMs || 120 })
            .filter(s => s.start > 0.05 && s.end < dur - 0.05);
        const total = weights.reduce((a, b) => a + b, 0) || 1;
        const expected = [];
        let acc = 0;
        for (let k = 0; k < n - 1; k++) { acc += weights[k]; expected.push(acc / total * dur); }

        const m = sil.length;
        if (m >= n - 1) {
            const INF = 1e9;
            // dp[k][j]: chi phí tốt nhất khi ranh giới thứ k dùng khoảng lặng j
            const dp = Array.from({ length: n - 1 }, () => new Array(m).fill(INF));
            const back = Array.from({ length: n - 1 }, () => new Array(m).fill(-1));
            const cost = (k, j) => {
                const mid = (sil[j].start + sil[j].end) / 2;
                const posErr = Math.abs(mid - expected[k]) / Math.max(0.5, dur / n);
                return posErr * 3 - Math.min(1.2, sil[j].dur) * 4;   // lặng càng dài càng chắc là ranh giới câu
            };
            for (let j = 0; j < m; j++) dp[0][j] = cost(0, j);
            for (let k = 1; k < n - 1; k++) {
                for (let j = k; j < m; j++) {
                    for (let i = k - 1; i < j; i++) {
                        const c = dp[k - 1][i] + cost(k, j);
                        if (c < dp[k][j]) { dp[k][j] = c; back[k][j] = i; }
                    }
                }
            }
            let bestJ = -1, best = INF;
            for (let j = 0; j < m; j++) if (dp[n - 2][j] < best) { best = dp[n - 2][j]; bestJ = j; }
            if (bestJ >= 0) {
                const picks = [];
                for (let k = n - 2, j = bestJ; k >= 0; k--) { picks.unshift(j); j = back[k][j]; }
                const cuts = picks.map(j => (sil[j].start + sil[j].end) / 2);
                const parts = [];
                let s = 0;
                for (const c of cuts) { parts.push({ start: s, end: c }); s = c; }
                parts.push({ start: s, end: dur });
                const avgErr = cuts.reduce((a, c, k) => a + Math.abs(c - expected[k]), 0) / cuts.length;
                const confidence = Math.max(0, 1 - avgErr / Math.max(0.5, dur / n));
                return { parts, confidence, method: "silence" };
            }
        }
        // Dự phòng: cắt theo tỷ lệ, bám vào khoảng lặng gần nhất nếu có
        const parts = [];
        let s = 0;
        for (const e of expected) {
            const near = sil.reduce((b, x) => (!b || Math.abs((x.start + x.end) / 2 - e) < Math.abs((b.start + b.end) / 2 - e) ? x : b), null);
            const c = near && Math.abs((near.start + near.end) / 2 - e) < 0.6 ? (near.start + near.end) / 2 : e;
            parts.push({ start: s, end: c });
            s = c;
        }
        parts.push({ start: s, end: dur });
        return { parts, confidence: 0.3, method: "proportional" };
    }

    function slice(samples, sr, start, end) {
        return samples.slice(Math.max(0, Math.floor(start * sr)), Math.min(samples.length, Math.ceil(end * sr)));
    }

    const api = {
        base64ToBytes, pcm16leToFloat, decodeWav, encodeWav, analyze, findSilences, trimSilence,
        normalize, fade, edgeJump, prepareSpeech, compressPauses, splitBySilence, slice, dbToLin, linToDb,
        shrinkSilences, punctuationBreaks, shapePauses, gateNoise
    };
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.CST_DUB_AUDIO = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
