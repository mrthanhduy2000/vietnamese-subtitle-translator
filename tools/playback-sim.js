// Playback delivery simulator (manual, offline, no API, no server). Runs the real DubEngine and the
// real VieNeu provider on a virtual clock; only the service worker and the VieNeu server are models:
//   - one generation at a time (localSerial FIFO), identical requests join one flight (ttsInFlight),
//     the audio store is checked first and written before the reply (handleSynthesizeSpeech)
//   - the server holds its only stream slot SLOT_HOLD seconds after a client leaves mid-request
//     (apps/openai_speech.py _Lease: 4 s idle + a 1 s watchdog), and a request waits for the slot
//     (waitLocalIdle). Seen in ~/VieNeu-TTS/server.log: 11 of 23 aborts blocked the next line 3-5 s
//   - translation arrives per group LAT seconds after it comes within TR_AHEAD of playback
//
//   node tools/playback-sim.js                   every scenario, current engine
//   OLD=<old dub-engine.js> node tools/playback-sim.js   the same scenarios on an older engine too
//   node tools/playback-sim.js --json            machine-readable
//   git show HEAD:dub-engine.js > $TMPDIR/old-engine.js && OLD=$TMPDIR/old-engine.js node tools/playback-sim.js
//   OLD_BG=queued compares against an engine from 1.8.6 on (the old one runs with the old abort policy)
//   node tools/playback-sim.js --real=$TMPDIR/yt [--sps=3.8]   the user's own videos, one row each
//     (dump them first: node tools/ext-storage.js --prefix=ytcache4_ --out=$TMPDIR/yt)
//
// The background policy is a parameter (bgAbort): "running" = a running request is cut when its page
// job is aborted (before 1.8.6); "queued" = only a request that has not reached the server is cut.
const path = require("path");
const REPO = path.join(__dirname, "..");
const PLAN = require(path.join(REPO, "dub-planner.js"));
const AUDIO = require(path.join(REPO, "dub-audio.js"));
const PROSODY = require(path.join(REPO, "dub-prosody.js"));
const { Clock, FakeVideo, FakeAudio } = require(path.join(REPO, "tests", "dub-sim.js"));
const { longLecture } = (() => {
    const { lectureGroups } = require(path.join(REPO, "tests", "dub-sim.js"));
    function longLecture(minutes) {
        const base = lectureGroups();
        const span = base[base.length - 1].end + 2;
        const out = [];
        for (let k = 0; out.length === 0 || out[out.length - 1].end < minutes * 60; k++) base.forEach(g => {
            const o = k * span;
            out.push({ ...g, start: g.start + o, end: g.end + o, srcCues: g.srcCues.map(c => ({ ...c, start: c.start + o, end: c.end + o })), viCues: g.viCues.map(c => ({ ...c, start: c.start + o, end: c.end + o })) });
        });
        return out;
    }
    return { longLecture };
})();

function scaleGroups(groups, k) {
    if (k === 1) return groups;
    const cue = c => ({ ...c, start: c.start * k, end: c.end * k, ...(c.words ? { words: c.words.map(w => ({ ...w, start: w.start * k, end: w.end * k })) } : {}) });
    return groups.map(g => ({ ...g, start: g.start * k, end: g.end * k, srcCues: g.srcCues.map(cue), viCues: g.viCues.map(cue) }));
}

// Deterministic noise: same scenario, same numbers
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }

const SLOT_HOLD = 4.5;      // s the server keeps its slot after the client left mid-request
const POLL = 0.25;          // waitLocalIdle poll interval
const OVERHEAD = 0.15;      // s per request outside generation
const KEEP_RUNNING = 4;     // background.js LOCAL_KEEP_RUNNING_S

function run(engineMod, sc) {
    const { DubEngine, createVieneuProvider } = engineMod;
    const R = rng(sc.seed || 7);
    const clock = new Clock(), video = new FakeVideo();
    video.playbackRate = sc.rate || 1;
    // sc.scale < 1: the same lecture spoken faster (0.6 = 1.67x), the Vietnamese unchanged
    const groups = sc.groups || scaleGroups(longLecture(sc.minutes || 6), sc.scale || 1);
    const store = new Map(sc.store ? sc.store : []);        // service worker audio store: key -> duration
    const m = { serverRuns: 0, serverDone: 0, cutRunning: 0, droppedQueued: 0, joined: 0, storeHits: 0, blockedMs: 0, generatedKeys: new Map(), playedKeys: new Set() };

    // ---- translation arrival ----
    // per group, or per `batch` when the groups carry one (youtube.js translates a window at once):
    // the whole batch arrives together once its last group comes within reach, as the prefetch takes
    // a window (it waited for the first before 2.3.6, which hid what a long window costs)
    const entered = new Map(), batchLast = new Map();
    for (const g of groups) if (g.batch != null) batchLast.set(g.batch, g.start);
    const trLat = g => (sc.trLat ? sc.trLat(g, R) : 1.5);
    const getGroups = () => {
        const t = video.currentTime, now = clock.now();
        return groups.filter(g => {
            if ((g.batch != null ? batchLast.get(g.batch) : g.start) > t + (sc.trAhead || 40)) return false;
            // nothing is trimmed from the front: youtube.js and content.js keep every group of the video
            // in the list, and the engine counts who speaks over the whole list (cut 200 s behind, the
            // anonymous turns alternated from another first mark and lines swapped voices back and forth)
            const k = g.batch != null ? "batch " + g.batch : g;
            if (!entered.has(k)) entered.set(k, { at: now, lat: trLat(g) * 1000 });
            const e = entered.get(k);
            return now - e.at >= e.lat;
        });
    };

    // ---- fake service worker + VieNeu server ----
    const byteDur = new Map();
    let byteSeq = 0;
    const wavFor = dur => { const id = ++byteSeq; byteDur.set(id, dur); const b = Buffer.alloc(4); b.writeUInt32LE(id); return b.toString("base64"); };
    const durOf = bytes => byteDur.get(Buffer.from(bytes).readUInt32LE(0));
    const flights = new Map(), jobKey = new Map();
    const queue = [];
    let running = null, slotFreeAt = 0;
    const rtf = () => (sc.rtf ? sc.rtf(clock.now() / 1000, R) : 0.25);
    // sc.sps: the voice's pace in syllables per second (4.3 by default; Mỹ Duyên measured 3.8 live)
    const audioSecs = (speak) => { const syl = PLAN.countSyllables(speak); return syl / (sc.sps || 4.3) * (0.92 + (hash(speak) % 1000) / 1000 * 0.16) + 0.1; };
    function pump() {
        if (running || !queue.length) return;
        const f = queue.shift();
        if (f.cut) { f.resolve({ ok: false, errorType: "aborted", aborted: true }); m.droppedQueued++; return pump(); }
        running = f;
        const begin = () => {
            if (f.cut) { running = null; f.resolve({ ok: false, errorType: "aborted", aborted: true }); m.droppedQueued++; return pump(); }
            const wait = Math.max(0, slotFreeAt - clock.now());
            if (wait > 0) { m.blockedMs += Math.ceil(wait / (POLL * 1000)) * POLL * 1000; clock.setTimeout(begin, Math.ceil(wait / (POLL * 1000)) * POLL * 1000); return; }
            m.serverRuns++;
            f.sent = clock.now();
            // the grown pauses are added after generation: they cost the server nothing
            const dur = audioSecs(f.speak) + (f.grown || 0);
            const gen = f.gen = (OVERHEAD + (dur - (f.grown || 0)) * rtf()) * 1000;
            f.finish = () => {
                if (running !== f) return;
                running = null;
                m.serverDone++;
                store.set(f.key, dur);
                m.generatedKeys.set(f.key, (m.generatedKeys.get(f.key) || 0) + 1);
                f.resolve({ ok: true, parts: [{ key: f.key, wav: wavFor(dur), duration: dur, sampleRate: 48000 }] });
                pump();
            };
            f.timer = clock.setTimeout(f.finish, gen);
        };
        begin();
    }
    function cut(f) {
        if (f.cut) return;
        f.cut = true;
        if (running === f && f.sent != null) {
            // client leaves mid-request: generation stops, the slot stays taken SLOT_HOLD seconds
            clock.clear(f.timer);
            running = null;
            slotFreeAt = clock.now() + SLOT_HOLD * 1000;
            m.cutRunning++;
            f.resolve({ ok: false, errorType: "aborted", aborted: true });
            pump();
        }
    }
    const sendMessage = async msg => {
        if (msg.action === "localTtsStatus") return { running: true };
        if (msg.action === "ttsAbort") {
            const key = jobKey.get(msg.jobId);
            const f = key && flights.get(key);
            jobKey.delete(msg.jobId);
            if (!f) return { ok: true };
            f.jobs.delete(msg.jobId);
            if (f.jobs.size) return { ok: true };
            // "queued" (1.8.6): a request the server has started is kept unless far from done
            if (sc.bgAbort === "running" || f.sent == null || f.sent + f.gen - clock.now() > KEEP_RUNNING * 1000) cut(f);
            return { ok: true };
        }
        if (msg.action === "synthesizeSpeech") {
            const key = msg.parts[0].key;
            if (store.has(key)) { m.storeHits++; const d = store.get(key); return { ok: true, fromCache: true, parts: [{ key, wav: wavFor(d), duration: d, sampleRate: 48000 }] }; }
            let f = flights.get(key);
            if (f) m.joined++;
            else {
                // a loose line's take is longer by the pauses its shaping grows (BACKLOG 48)
                const grown = msg.slack > 0 ? PROSODY.pauseSlack(msg.text, msg.slack).total : 0;
                f = { key, speak: msg.speak || msg.text, grown, jobs: new Set() };
                f.promise = new Promise(res => { f.resolve = r => { flights.delete(key); res(r); }; });
                flights.set(key, f);
                queue.push(f);
                pump();
            }
            f.jobs.add(msg.jobId);
            jobKey.set(msg.jobId, key);
            return f.promise;
        }
        return { ok: true };
    };
    const provider = createVieneuProvider({ sendMessage }, { localVoice: "Mỹ Duyên" });
    // sc.unique: the lecture repeats its 22 sentences, so past the first loop every line is a store
    // hit and costs the server nothing. A new video has no such luck: key each line by its place too
    if (sc.unique) { const ak = provider.audioKey.bind(provider); provider.audioKey = async p => (await ak(p)) + ":" + Math.round(p.start * 10); }
    // The key each take was made under, by plan id and text: the engine keeps a take by those two,
    // and a re-plan leaves tightPauses unset on the new plan object until it enters the render
    // window again, so a key recomputed at the start named a take that did play as never played
    const madeUnder = new Map();
    const render0 = provider.render.bind(provider);
    provider.render = async (plans, ctx) => {
        for (const p of plans) madeUnder.set(p.id + "\n" + p.text, p.audioKey || await provider.audioKey(p));
        return render0(plans, ctx);
    };

    // ---- page side ----
    // How long Chrome takes to start a voice element after play() or a seek (2.4.6). sc.latency (or
    // LATENCY=): a number of ms, or "busy", from chrome://media-internals in the user's Chrome: an
    // element made just before its line (the take came late), one just seeked, or one Chrome put to
    // sleep after 15 s idle (kSuspended) took 0.16 to 0.96 s to start while VieNeu made takes; the
    // ones prepared during the line before started without a single seek (under ~0.11 s). Here a
    // cold start is 250 to 750 ms while the server generates (40 to 80 ms idle), a warm one 40 to
    // 120 ms (20 to 40 idle). Unset: 0, every element starts at once (every run before 2.4.6)
    const lat = sc.latency != null ? sc.latency : process.env.LATENCY;
    const startLatency = lat === "busy"
        ? (a, why) => {
            const now = clock.now();
            const cold = why === "seek" || now - a.createdAt < 500 || now - (a.lastActive != null ? a.lastActive : a.createdAt) > 15000;
            if (cold) return running ? 250 + R() * 500 : 40 + R() * 40;
            return running ? 40 + R() * 80 : 20 + R() * 20;
        }
        : () => Number(lat) || 0;
    const audios = [];
    const urlDur = new Map(), urlKey = new Map();
    let urlSeq = 0, liveUrls = 0, maxUrls = 0;
    const eng = new DubEngine({
        video, getGroups, providers: { primary: provider },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        setTimeout: (f, ms) => clock.setTimeout(f, ms),
        createObjectURL: bytes => { const u = "blob:" + (++urlSeq); urlDur.set(u, durOf(bytes)); liveUrls++; maxUrls = Math.max(maxUrls, liveUrls); return u; },
        revokeObjectURL: () => { liveUrls--; },
        createAudio: url => {
            const a = new FakeAudio(clock, { duration: urlDur.get(url) || 1 }, 0, { startLatency: startLatency });
            a.url = url;
            const play = a.play.bind(a);
            a.play = () => { if (a.paused) a.startedAt = clock.now(); return play(); };
            audios.push(a);
            return a;
        },
        audioCache: {
            async get(keys) { const out = {}; for (const k of keys) if (store.has(k)) { const d = store.get(k); out[k] = { wav: AUDIO.base64ToBytes(wavFor(d)), duration: d }; m.storeHits++; } return out; },
            put() {}
        }
    }, sc.settings);                    // sc.settings: the engine's settings ({ secondVoice: true }, 2.4.8)

    // ---- measurements ----
    const pendingKeys = [];
    const starts = [];                 // { wall, media, id } audio actually starting
    const spokenTexts = [];            // the text of each line as it was when it started
    let overlapTicks = 0, maxRendered = 0, maxEls = 0, maxHeld = 0;
    const seeks = [];                  // { wall } waiting for the next start
    let lastPlayingSet = new Set(), seenStarts = 0;
    const startTexts = new Map();       // stats.started entry -> its plan's subtitle text at the start
    {
        const st = eng.stats.started, push = st.push.bind(st);
        st.push = (...xs) => { for (const x of xs) { const p = eng.planById.get(x.id); if (p) startTexts.set(x, p.subtitleText); } return push(...xs); };
    }
    function observe() {
        const playing = audios.filter(a => !a.paused);
        if (playing.length > 1) overlapTicks++;
        // a line starts when the engine starts one (stats.started), whatever its offset
        while (seenStarts < eng.stats.started.length) {
            const x = eng.stats.started[seenStarts++];
            starts.push({ wall: clock.now(), media: video.currentTime, id: x.id });
            // the text as the line started: a refresh between that start and this look may have
            // replaced the plan already, which counted a spoken line as words lost (2026-10-23)
            const pl = eng.planById.get(x.id);
            const said = startTexts.get(x) != null ? startTexts.get(x) : pl && pl.subtitleText;
            if (said != null) spokenTexts.push(said);
            const made = pl && madeUnder.get(pl.id + "\n" + pl.text);
            if (made) m.playedKeys.add(made);
            // a re-made plan object has no slack decision yet: the engine's memo gives the one its take
            // was made under (BACKLOG 48), else a played take counted as never played
            else if (pl) pendingKeys.push(provider.audioKey(pl.slackPauses == null && !pl.tightPauses && eng.looseSlack ? { ...pl, slackPauses: eng.looseSlack(pl) } : pl).then(k => m.playedKeys.add(k)));
            for (const s of seeks) if (s.recovered == null && !s.paused) s.recovered = clock.now() - s.wall;
        }
        lastPlayingSet = new Set(playing);
        if (sc.trace) sc.trace({ wall: clock.now(), video, eng, queue, running: () => running, slotFreeAt });
        maxRendered = Math.max(maxRendered, eng.rendered.size);
        maxHeld = Math.max(maxHeld, [...eng.rendered.values()].reduce((a, r) => a + (r.duration || 0), 0));
        maxEls = Math.max(maxEls, [...eng.rendered.values()].filter(r => r.el).length);
    }

    const steps = sc.steps;             // [{ at: wall s, do: "seek"|"pause"|"play"|"rate", v }]
    const endWall = (sc.wall || 180) * 1000;
    return (async () => {
        eng.start();
        for (let i = 0; i < 10; i++) { clock.advance(50); await new Promise(r => setImmediate(r)); }
        const t0 = clock.now();
        video.play();
        seeks.push({ wall: t0, first: true });
        let si = 0;
        while (clock.now() - t0 < endWall) {
            while (steps && si < steps.length && clock.now() - t0 >= steps[si].at * 1000) {
                const s = steps[si++];
                if (s.do === "seek") { video.seek(s.v); seeks.push({ wall: clock.now(), to: s.v, paused: video.paused }); }
                if (s.do === "pause") video.pause();
                if (s.do === "play") { video.play(); for (const x of seeks) if (x.paused && x.recovered == null) { x.paused = false; x.wall = clock.now(); } }
                if (s.do === "rate") video.playbackRate = s.v;
            }
            clock.advance(25, st => { video.step(st); audios.forEach(a => a.step(st)); });
            observe();
            await new Promise(r => setImmediate(r));
        }
        eng.stop();
        // a sounding voice fades out before it is let go (2.4.7): the page's clock runs on meanwhile
        clock.advance(100, st => audios.forEach(a => a.step(st)));
        await Promise.all(pendingKeys);

        // delivery gap: the next line was due (subtitle start passed, rest after the previous line
        // over) but no voice started. The rest the engine means to keep is not counted.
        const st = eng.stats.started;
        let gapSum = 0, gapN = 0, gapMax = 0;
        for (let i = 1; i < st.length; i++) {
            const a = st[i - 1], b = st[i];
            if (seeks.some(x => !x.first && x.wall > starts[i - 1].wall && x.wall <= starts[i].wall)) continue;   // a seek in between
            const ready = Math.max(a.speechEnd + 0.18, b.due - 0.04);
            const g = b.t - ready;
            if (g > 0.12 && g < 30) { gapSum += g; gapN++; gapMax = Math.max(gapMax, g); }
        }
        const late = st.filter(x => x.lag > 0.5).length;
        const rates = st.map(x => x.rate).filter(Number.isFinite).sort((a, b) => a - b);
        const gen = [...m.generatedKeys.values()];
        const dup = gen.reduce((a, n) => a + n - 1, 0);
        const rec = seeks.filter(s => !s.first && s.recovered != null).map(s => s.recovered / 1000);
        const first = seeks[0].recovered != null ? seeks[0].recovered / 1000 : null;
        // Words, not lines (2.3.6): a line that grew after it started counted as spoken while its new
        // words were never read. Every group's Vietnamese (sound notes out) against the text of each
        // line as it started, as multisets of words; only for a run that passed every group and had
        // no seek or pause (a skip of the viewer's is not a loss)
        let wordsLost = null, wordsTwice = null;
        if (!(steps && steps.length) && groups.every(g => g.end < video.currentTime - 1)) {
            const words = t => String(t || "").replace(/¦/g, " ").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
            const want = new Map(), got = new Map();
            // what the voice is meant to read: no sound notes, no speaker labels (dub-planner.js)
            // (per subtitle line, as the planner strips them)
            // (a source of notes only, "(Bang!!)", drops its notes from the Vietnamese as the planner does)
            const said = g => { const src = (g.srcCues || []).map(c => c.text); const labels = PLAN.speakerLabels(src.join("\n")); const notes = src.length > 0 && PLAN.notesOnly(src.join(" ")); return g.viCues && g.viCues.length ? g.viCues.map(c => PLAN.stripSpeakerLabels(PLAN.stripSoundNotes(c.text, notes), labels)).join(" ") : PLAN.stripSoundNotes(g.viText, notes); };
            for (const g of groups) for (const w of words(said(g))) want.set(w, (want.get(w) || 0) + 1);
            for (const t of spokenTexts) for (const w of words(t)) got.set(w, (got.get(w) || 0) + 1);
            wordsLost = 0; wordsTwice = 0;
            for (const [k, n] of want) wordsLost += Math.max(0, n - (got.get(k) || 0));
            for (const [k, n] of got) wordsTwice += Math.max(0, n - (want.get(k) || 0));
        }
        return {
            ...(sc.keepStarted ? { started: st } : {}),           // every line's start, for a caller's own breakdown
            spoken: st.length, dropped: eng.stats.dropped, late, wordsLost, wordsTwice,
            gapN, gapSum: +gapSum.toFixed(2), gapMax: +gapMax.toFixed(2),
            firstAudio: first == null ? null : +first.toFixed(2),
            seekRecover: rec.length ? +(rec.reduce((a, b) => a + b, 0) / rec.length).toFixed(2) : null,
            seekRecoverMax: rec.length ? +Math.max(...rec).toFixed(2) : null,
            overlapTicks,
            serverRuns: m.serverRuns, generated: m.serverDone, cutRunning: m.cutRunning, droppedQueued: m.droppedQueued, joined: m.joined, duplicateGen: dup,
            storeHits: m.storeHits, blockedS: +(m.blockedMs / 1000).toFixed(2),
            unplayedGen: [...m.generatedKeys.keys()].filter(k => !m.playedKeys.has(k)).length,
            maxRendered, maxHeld: +maxHeld.toFixed(1), maxEls, maxUrls,
            // a voice moved while it played (each one a jump the ear hears as a pop), and a sounding
            // voice paused (a seek, a viewer's pause, a stall: a cut)
            reseeks: eng.stats.corrections || 0, elSeeks: audios.reduce((a, x) => a + x.seeks, 0), cuts: audios.reduce((a, x) => a + x.cuts, 0),
            skippedS: +audios.reduce((a, x) => a + x.skipped, 0).toFixed(1), hardStarts: audios.reduce((a, x) => a + x.hardStarts, 0),
            rateP50: rates.length ? +rates[Math.floor(rates.length * 0.5)].toFixed(2) : null,
            rateP90: rates.length ? +rates[Math.floor(rates.length * 0.9)].toFixed(2) : null,
            rateMax: rates.length ? +rates[rates.length - 1].toFixed(2) : null,
            store: [...store.entries()]
        };
    })();
}

const SCENARIOS = {
    normal: { wall: 150 },
    slowTranslation: { wall: 150, trLat: (g, R) => (R() < 0.3 ? 6 + R() * 6 : 1 + R() * 2), trAhead: 20 },
    slowTts: { wall: 150, rtf: (t, R) => 0.6 + R() * 0.6 },
    // A fast talk on a new video (the lecture at 1.67x and a voice at 3.8 syllables/s, as measured
    // live on zPSs9a0MYGw with Mỹ Duyên) while the server slows to 0.9x for two minutes (macOS paging,
    // a busy CPU: server.log had 0.6-0.87 for minutes). Translation 90 s ahead (the "free" mode)
    fastSlowdown: { wall: 240, scale: 0.6, sps: 3.8, unique: true, trAhead: 90, rtf: t => (t >= 40 && t < 160 ? 0.9 : 0.25) },
    seekForward: { wall: 90, steps: [{ at: 20, do: "seek", v: 280 }] },
    seekBackward: { wall: 90, steps: [{ at: 50, do: "seek", v: 15 }] },
    // back past keepBehind (90 s): the audio left the page, only the store has it
    seekBackFar: { wall: 230, steps: [{ at: 200, do: "seek", v: 20 }] },
    rapidSeek: { wall: 90, steps: [{ at: 10, do: "seek", v: 30 }, { at: 12, do: "seek", v: 150 }, { at: 13.5, do: "seek", v: 45 }, { at: 16, do: "seek", v: 250 }, { at: 17, do: "seek", v: 60 }] },
    pauseResume: { wall: 120, steps: [{ at: 20, do: "pause" }, { at: 35, do: "play" }, { at: 60, do: "pause" }, { at: 61, do: "play" }] },
    rate15: { wall: 100, rate: 1.5 },
    rate2: { wall: 90, rate: 2 },
    seekWhileSlow: { wall: 90, rtf: () => 0.9, steps: [{ at: 15, do: "seek", v: 200 }, { at: 40, do: "seek", v: 60 }] }
};

// A cached video as youtube.js dubs it: every group translated from the start, and the fixes
// ytRepairCachedLeaks applies on load (sound notes, head repeats, slid runs, tail leaks) applied here too
function realGroups(file) {
    const Q = require(path.join(REPO, "vi-quality.js"));
    const SEG = require(path.join(REPO, "vi-segmenter.js"));
    const c = JSON.parse(require("fs").readFileSync(file, "utf8"));
    const gs = (c.g || []).map(g => ({
        start: g[0], end: g[1], viText: g[2],
        srcCues: g[3].map(x => ({ start: x[0], end: x[1], text: x[2] })),
        viCues: g[4].map(x => ({ start: x[0], end: x[1], text: x[2] })),
        ...(g[5] ? { midLine: true } : {})
    }));
    const src = g => g.srcCues.map(x => x.text).join(" ");
    const reseg = k => {
        const g = gs[k], next = gs[k + 1];
        const maxEnd = next ? Math.min(g.end + 1.5, Math.max(g.end, next.start - 0.04)) : g.end + 1.5;
        g.viCues = SEG.segmentGroupSafe(g.viText, g.srcCues, { maxEnd });
    };
    gs.forEach((g, k) => { const [v] = Q.fixSoundNotes([g.viText], [src(g)]); if (v !== g.viText) { g.viText = v; reseg(k); } });
    for (let k = 0; k + 1 < gs.length; k++) {
        const [a, b] = Q.fixRepeatedHeads([gs[k].viText, gs[k + 1].viText], [src(gs[k]), src(gs[k + 1])]);
        if (a !== gs[k].viText || b !== gs[k + 1].viText) { gs[k].viText = a; gs[k + 1].viText = b; reseg(k); reseg(k + 1); }
    }
    if (Q.realignSentences) {
        const out = Q.realignSentences(gs.map(src), gs.map(g => g.viText));
        out.forEach((v, k) => { if (v !== gs[k].viText) { gs[k].viText = v; reseg(k); } });
    }
    gs.forEach((g, k) => {
        const next = [gs[k + 1], gs[k + 2]].filter(Boolean).map(x => x.viText).join(" ");
        const cut = next ? Q.trimContextLeak(g.viText, next, { src: src(g) }) : g.viText;
        if (cut !== g.viText) { g.viText = cut; reseg(k); }
    });
    return gs;
}

async function realMain(dir, json) {
    const fs = require("fs");
    const cur = require(path.join(REPO, "dub-engine.js"));
    const arg = n => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : ""; };
    const sps = Number(arg("sps")) || 3.8;
    // OLD=<old dub-engine.js>: each video on the older engine too, one row each
    const old = process.env.OLD ? require(path.resolve(process.env.OLD)) : null;
    const rows = [];
    for (const f of fs.readdirSync(dir).filter(x => /^ytcache4_.*\.json$/.test(x)).sort()) {
        const groups = realGroups(path.join(dir, f));
        if (!groups.length) continue;
        for (const [v, mod] of old ? [["old", old], ["new", cur]] : [["new", cur]]) {
            const r = await run(mod, { groups, wall: groups[groups.length - 1].end + 5, sps, trAhead: 1e9, trLat: () => 0, bgAbort: "queued" });
            delete r.store;
            rows.push({ video: f.slice(9, 20) + (old ? " " + v : ""), groups: groups.length, minutes: +(groups[groups.length - 1].end / 60).toFixed(1), ...r });
        }
    }
    if (json) { console.log(JSON.stringify(rows, null, 1)); return; }
    const cols = ["video", "minutes", "groups", "spoken", "dropped", "late", "wordsLost", "wordsTwice", "gapN", "gapSum", "gapMax", "firstAudio", "rateP50", "rateP90", "rateMax", "serverRuns", "maxHeld", "reseeks", "elSeeks", "skippedS", "cuts", "hardStarts"];
    console.log(cols.join("\t"));
    for (const r of rows) console.log(cols.map(c => r[c] == null ? "-" : r[c]).join("\t"));
}

async function main() {
    const json = process.argv.includes("--json");
    const real = process.argv.find(x => x.startsWith("--real="));
    if (real) return realMain(real.slice(7), json);
    const cur = require(path.join(REPO, "dub-engine.js"));
    const old = process.env.OLD ? require(path.resolve(process.env.OLD)) : null;
    const rows = [];
    for (const [name, sc0] of Object.entries(SCENARIOS)) {
        const variants = [];
        if (old) variants.push(["old", old, { ...sc0, bgAbort: process.env.OLD_BG || "running" }]);
        variants.push(["new", cur, { ...sc0, bgAbort: process.env.BG_ABORT || "queued" }]);
        for (const [label, mod, sc] of variants) {
            const r = await run(mod, sc);
            delete r.store;
            rows.push({ scenario: name, v: label, ...r });
        }
    }
    // cached: a second pass over the normal scenario with the store the first pass filled
    for (const [label, mod, bg] of (old ? [["old", old, process.env.OLD_BG || "running"], ["new", cur, "queued"]] : [["new", cur, "queued"]])) {
        const first = await run(mod, { ...SCENARIOS.normal, bgAbort: bg });
        const r = await run(mod, { ...SCENARIOS.normal, bgAbort: bg, store: first.store });
        delete r.store;
        rows.push({ scenario: "cachedAll", v: label, ...r });
        const half = first.store.filter((_, i) => i % 2 === 0);
        const r2 = await run(mod, { ...SCENARIOS.seekForward, bgAbort: bg, store: half });
        delete r2.store;
        rows.push({ scenario: "mixedCache", v: label, ...r2 });
    }
    if (json) { console.log(JSON.stringify(rows, null, 1)); return; }
    const cols = ["scenario", "v", "spoken", "dropped", "late", "wordsLost", "wordsTwice", "gapN", "gapSum", "gapMax", "firstAudio", "seekRecover", "seekRecoverMax", "overlapTicks", "reseeks", "elSeeks", "skippedS", "cuts", "hardStarts", "serverRuns", "cutRunning", "blockedS", "duplicateGen", "unplayedGen", "storeHits", "maxRendered", "maxHeld", "maxEls", "maxUrls"];
    console.log(cols.join("\t"));
    for (const r of rows) console.log(cols.map(c => r[c] == null ? "-" : r[c]).join("\t"));
}

module.exports = { run, SCENARIOS, realGroups };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
