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
// opts.startLatency (ms, or a function returning ms): like Chrome, the element needs time to start
// after play() and again after every seek while it plays; until then currentTime stays where it was
// set and paused is false. Measured in the user's Chrome while the voice server was busy (2.4.6,
// chrome://media-internals): 0.16 to 0.96 s. The function gets the element and the reason ("play" or
// "seek"). `seeks` counts writes to currentTime while playing: each one is a jump the listener hears
// (a pop); `skipped` sums the take seconds such forward jumps passed over (words not heard). `cuts`
// counts pauses of a voice sounding above 0.3 (a hard cut), `hardStarts` a voice coming up inside its
// take above 0.3 (a click; a take's own start has its fade).
class FakeAudio {
    constructor(clock, meta, drift, opts = {}) {
        this.clock = clock; this.meta = meta; this.drift = drift || 0;
        this.paused = true; this.time = 0; this.playbackRate = 1; this.volume = 1; this.preservesPitch = true;
        const lat = opts.startLatency;
        this.startLatency = typeof lat === "function" ? lat : () => lat || 0;
        this.createdAt = clock.now();
        this.holdUntil = 0; this.seeks = 0; this.skipped = 0; this.cuts = 0; this.hardStarts = 0; this.sounding = false;
    }
    get currentTime() { return this.time; }
    set currentTime(v) {
        const to = Math.max(0, Math.min(this.meta.duration, v));
        if (!this.paused) {
            this.seeks++;
            if (to > this.time) this.skipped += to - this.time;
            this.sounding = false;
            this.holdUntil = this.clock.now() + this.startLatency(this, "seek");
        }
        this.time = to;
    }
    play() {
        if (this.paused) { this.holdUntil = this.clock.now() + this.startLatency(this, "play"); this.lastActive = this.clock.now(); }
        this.paused = false; this.ended = false;
        return Promise.resolve();
    }
    pause() {
        if (!this.paused && this.sounding && this.volume > 0.3) this.cuts++;
        if (!this.paused) this.lastActive = this.clock.now();
        this.paused = true; this.sounding = false;
    }
    addEventListener(n, f) { (this.listeners = this.listeners || {}); (this.listeners[n] = this.listeners[n] || []).push(f); }
    // Như trình duyệt: phát tới hết thì ended = true, tự dừng và bắn sự kiện "ended"
    step(ms) {
        if (this.paused || this.clock.now() < this.holdUntil) return;
        if (!this.sounding && this.time > 0.02 && this.volume > 0.3) this.hardStarts++;
        this.sounding = true;
        this.time = Math.min(this.meta.duration, this.time + ms / 1000 * this.playbackRate * (1 + this.drift));
        if (this.currentTime >= this.meta.duration) {
            this.ended = true; this.paused = true; this.sounding = false;
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
