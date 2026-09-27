// Môi trường mô phỏng cho engine lồng tiếng: đồng hồ, video, giọng đọc, audio.
// Mọi thứ chạy theo đồng hồ ảo -> kiểm thử pause/seek/tốc độ phát/lệch nhịp
// một cách tất định, nhanh (mô phỏng vài phút chỉ mất vài trăm ms).
const seg = require("../vi-segmenter.js");
const PLAN = require("../dub-planner.js");
const fixtures = require("./fixtures");

// Deterministic hashing for every simulation that loads this file. CST_CACHE.hashKey uses
// crypto.subtle, which answers from a worker thread: on a busy machine a store key was not ready
// within the one setImmediate a simulated tick waits, the run took another path, and delivery tests
// failed about 1 run in 5. Node's synchronous SHA-256 gives the identical hex digest and resolves as
// a microtask, so a simulated tick sees the same thing on any machine.
{
    const CACHE = require("../cst-cache.js");
    const nodeCrypto = require("crypto");
    CACHE.hashKey = async parts => nodeCrypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

class Clock {
    constructor() { this.ms = 0; this.timers = []; this.seq = 0; }
    now() { return this.ms; }
    setInterval(fn, ms) { const id = ++this.seq; this.timers.push({ id, fn, every: ms, at: this.ms + ms }); return id; }
    setTimeout(fn, ms) { const id = ++this.seq; this.timers.push({ id, fn, at: this.ms + ms, once: true }); return id; }
    clear(id) { this.timers = this.timers.filter(t => t.id !== id); }
    advance(ms, onStep) {
        const end = this.ms + ms;
        while (this.ms < end) {
            const step = Math.min(5, end - this.ms);
            this.ms += step;
            if (onStep) onStep(step);
            const due = this.timers.filter(t => t.at <= this.ms).sort((a, b) => a.at - b.at);
            for (const t of due) {
                if (t.once) this.clear(t.id); else t.at += t.every;
                t.fn();
            }
        }
    }
}

class FakeVideo {
    constructor() {
        this.currentTime = 0; this.paused = true; this.ended = false; this.playbackRate = 1;
        this.volume = 0.8; this.readyState = 4; this.listeners = {}; this.stalled = false;
    }
    addEventListener(n, f) { (this.listeners[n] = this.listeners[n] || []).push(f); }
    removeEventListener(n, f) { this.listeners[n] = (this.listeners[n] || []).filter(x => x !== f); }
    emit(n) { (this.listeners[n] || []).forEach(f => f()); }
    play() { this.paused = false; this.emit("play"); this.emit("playing"); }
    pause() { this.paused = true; this.emit("pause"); }
    // Như trình duyệt: khi sự kiện "seeking" bắn ra, currentTime đã là vị trí mới
    seek(t) { this.currentTime = t; this.emit("seeking"); this.emit("seeked"); }
    step(ms) { if (!this.paused && !this.stalled) this.currentTime += ms / 1000 * this.playbackRate; }
}

// Giọng đọc giả: thời lượng thật = mô hình "thật" (có thể lệch khỏi mô hình engine dùng)
function makeFakeSpeech(clock, video, trueModel, log) {
    const provider = {
        id: "system", label: "Giọng giả", caps: { live: true, prerender: false },
        voiceModel: { ...PLAN.DEFAULT_VOICE_MODEL },
        voiceLabel: "Linh (giả)",
        active: null,
        speak(text, opts, cb) {
            if (provider.active) throw new Error("Nói chồng hai cụm cùng lúc");
            const dur = (PLAN.speechSeconds(PLAN.countSyllables(text), opts.rate, trueModel) + 0.03) * 1000;
            const rec = { text, rate: opts.rate, pitch: opts.pitch, speaker: opts.speaker, mediaStart: null, mediaEnd: null };
            const h = { done: false };
            provider.active = h;
            const t1 = clock.setTimeout(() => { rec.mediaStart = video.currentTime; log.push(rec); cb.onstart && cb.onstart(); }, 30);
            const t2 = clock.setTimeout(() => { if (h.done) return; h.done = true; provider.active = null; rec.mediaEnd = video.currentTime; cb.onend && cb.onend(); }, 30 + dur);
            h.cancel = () => {
                if (h.done) return;
                h.done = true; provider.active = null; clock.clear(t1); clock.clear(t2);
                if (rec.mediaStart !== null) rec.mediaEnd = video.currentTime;
                // Trình duyệt thật bắn lỗi "interrupted" khi bị hủy
                cb.onerror && cb.onerror({ error: "interrupted" });
            };
            return h;
        },
        stopAll() { if (provider.active) provider.active.cancel(); }
    };
    return provider;
}

// Audio giả: tiến theo đồng hồ, có thể trôi nhịp (drift) so với video
class FakeAudio {
    constructor(clock, meta, drift) {
        this.clock = clock; this.meta = meta; this.drift = drift || 0;
        this.paused = true; this.currentTime = 0; this.playbackRate = 1; this.volume = 1; this.preservesPitch = true;
    }
    play() { this.paused = false; this.ended = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    addEventListener(n, f) { (this.listeners = this.listeners || {}); (this.listeners[n] = this.listeners[n] || []).push(f); }
    // Như trình duyệt: phát tới hết thì ended = true, tự dừng và bắn sự kiện "ended"
    step(ms) {
        if (this.paused) return;
        this.currentTime = Math.min(this.meta.duration, this.currentTime + ms / 1000 * this.playbackRate * (1 + this.drift));
        if (this.currentTime >= this.meta.duration) {
            this.ended = true; this.paused = true;
            ((this.listeners || {}).ended || []).forEach(f => f());
        }
    }
}

// Bài giảng ~2,5 phút ghép từ 22 câu thật, xếp nối tiếp với khoảng lặng tự nhiên
function lectureGroups() {
    const groups = [];
    let t = 1;
    fixtures.forEach((f, i) => {
        const base = f.src[0].start;
        const src = f.src.map(c => ({ ...c, start: c.start - base + t, end: c.end - base + t, words: c.words ? c.words.map(w => ({ ...w, t: w.t - base + t })) : undefined }));
        const start = src[0].start, end = src[src.length - 1].end;
        groups.push({ start, end, srcCues: src, viText: f.vi, viCues: seg.segmentGroupSafe(f.vi, src) });
        t = end + [0.25, 0.6, 1.2, 0.4, 2.0][i % 5];
    });
    return groups;
}

module.exports = { Clock, FakeVideo, FakeAudio, makeFakeSpeech, lectureGroups };
