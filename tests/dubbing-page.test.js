// dubbing.js (the page side of the dub): the cache of audio, forgetting a video's audio, the no-voice
// notices, setting changes while dubbing, the hold overlay and badge.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

function env({ sync = {}, voices = [], onMessage, hostname = "www.youtube.com", realTimers = false } = {}) {
    const noop = () => {};
    const msgs = [], toasts = [], changed = [];
    const els = [];
    const mkEl = tag => ({ tag, style: {}, children: [], remove() { els.splice(els.indexOf(this), 1); }, appendChild(c) { this.children.push(c); return c; }, setAttribute: noop, classList: { add: noop } });
    const S = {
        console: { log: noop, warn: noop, error: console.error }, setTimeout, clearTimeout, setInterval: realTimers ? setInterval : () => 1, clearInterval: realTimers ? clearInterval : noop,
        Promise, Map, Set, Math, JSON, Date, TextEncoder, crypto: globalThis.crypto, atob, btoa, Blob,
        performance: { now: () => Date.now() }, URL,
        location: { href: `https://${hostname}/watch?v=abc`, hostname, pathname: "/watch" },
        document: {
            title: "t", querySelector: () => null, querySelectorAll: sel => (sel === ".cst-dub-badge" ? els.filter(e => e.className === "cst-dub-badge") : []),
            createElement: tag => { const e = mkEl(tag); els.push(e); return e; }, documentElement: { setAttribute: noop }, head: { appendChild: noop }, body: mkEl("body")
        },
        speechSynthesis: { getVoices: () => voices, speak: noop, cancel: noop, addEventListener: noop },
        SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
        localStorage: { getItem: () => null },
        chrome: {
            storage: { sync: { get: async d => ({ ...d, ...sync }) }, onChanged: { addListener: f => changed.push(f) } },
            runtime: { lastError: null, sendMessage: (m, cb) => { msgs.push(m); Promise.resolve(onMessage ? onMessage(m) : { ok: false }).then(cb); } }
        },
        CST_UI: { toast: (m, o) => toasts.push({ m, o }) }
    };
    S.window = S; S.globalThis = S;
    vm.createContext(S);
    for (const f of ["cst-cache.js", "cost-policy.js", "vi-segmenter.js", "dub-planner.js", "dub-prosody.js", "dub-speech.js", "dub-audio.js", "dub-engine.js", "dubbing.js"]) vm.runInContext(read(f), S);
    return { S, msgs, toasts, changed, els, API: S.CST_DUB };
}

test("forget a video's audio: nothing to forget without an engine, otherwise the keys go to the store", async () => {
    const E = env({ onMessage: m => (m.action === "audioCacheDelete" ? { ok: true, removed: m.keys.length } : { ok: false }) });
    assert.deepEqual(JSON.parse(JSON.stringify(await E.API.forgetVideoAudio())), { ok: false, error: "Video này chưa bật lồng tiếng" });
    let forgotten = 0;
    E.API.dub.engine = { audioKeysForVideo: async () => ["k1", "k2", "k3"], forgetRendered: () => { forgotten++; } };
    const r = await E.API.forgetVideoAudio();
    assert.deepEqual(JSON.parse(JSON.stringify(r)), { ok: true, removed: 3 });
    assert.equal(forgotten, 1);
    assert.deepEqual([...E.msgs.at(-1).keys], ["k1", "k2", "k3"]);
    // the store failing leaves ok false, removed 0
    const F = env({ onMessage: () => null });
    F.API.dub.engine = { audioKeysForVideo: async () => ["k"], forgetRendered() {} };
    assert.deepEqual(JSON.parse(JSON.stringify(await F.API.forgetVideoAudio())), { ok: false, removed: 0 });
});

test("level: a setting between 0 and 1, the default for anything else", () => {
    const { API } = env();
    assert.equal(API.level(0.5, 0.2), 0.5);
    assert.equal(API.level(0, 0.2), 0);
    assert.equal(API.level("x", 0.2), 0.2);
    assert.equal(API.level(undefined, 1), 1);
});

test("start with no voice at all: a notice and no engine; economy mode never reaches Gemini", async () => {
    const E = env({ sync: { geminiApiKey: "", useAi: false, costMode: "balanced" } });
    const ok = await E.API.start({ video: { duration: 100, closest: () => null, addEventListener() {}, removeEventListener() {} }, getGroups: () => [] });
    assert.equal(ok, false);
    assert.equal(E.API.dub.engine, null);
    assert.equal(E.API.dub.starting, false);
    assert.ok(E.toasts.length >= 1, "the viewer is told why there is no voice");
    assert.equal(E.msgs.filter(m => m.action === "synthesizeSpeech").length, 0);
    assert.ok(E.toasts.every(t => t.o && t.o.warn), "every notice is a warning card, never a blocking dialog");
});

test("settings changed while dubbing: volume and duck apply at once, a voice change restarts, other areas are ignored", () => {
    const E = env();
    assert.equal(E.changed.length, 1);
    const onChanged = E.changed[0];
    const engine = { settings: { duck: 0.2, volume: 1, maxRate: null }, d: { video: {}, getGroups: () => [] } };
    // no engine yet: nothing happens
    assert.doesNotThrow(() => onChanged({ dubVolume: { newValue: 0.3 } }, "sync"));
    E.API.dub.engine = engine;
    onChanged({ dubVolume: { newValue: 0.4 }, dubDuck: { newValue: 0.5 }, dubMaxRate: { newValue: "1.3" } }, "sync");
    assert.deepEqual({ ...engine.settings }, { duck: 0.5, volume: 0.4, maxRate: 1.3 });
    onChanged({ dubVolume: { newValue: 0.9 } }, "local");
    assert.equal(engine.settings.volume, 0.4, "another storage area is not ours");
    onChanged({ dubMaxRate: { newValue: 0 } }, "sync");
    assert.equal(engine.settings.maxRate, null, "0 means automatic again");
    // a voice change starts again from the same source: the start is async, so only check it is attempted
    onChanged({ dubGeminiVoice: { newValue: "Puck" } }, "sync");
    assert.equal(E.API.dub.starting, true, "a voice change starts the dub again");
    E.API.stop();
    assert.equal(E.API.dub.starting, false);
});

test("badge: shown once in the container, removed by hide, stop clears everything", () => {
    const E = env();
    const container = { appendChild(c) { this.child = c; }, querySelector: () => null };
    E.API.showDubBadge(container);
    assert.equal(container.child.className, "cst-dub-badge");
    E.API.showDubBadge(null);
    assert.doesNotThrow(() => E.API.showDubBadge(undefined));
    E.API.hideDubBadge();
    assert.equal(E.els.filter(e => e.className === "cst-dub-badge").length, 0);
    E.API.dub.enabled = true;
    E.API.stop();
    assert.equal(E.API.dub.enabled, false);
    assert.equal(E.API.dub.engine, null);
});

function video(over = {}) {
    const ls = {};
    const v = {
        paused: false, currentTime: 0, plays: 0, pauses: 0, parentElement: { appendChild() {} },
        pause() { this.paused = true; this.pauses++; }, play() { this.paused = false; this.plays++; return Promise.resolve(); },
        addEventListener: (t, f) => { ls[t] = f; }, removeEventListener: t => { delete ls[t]; }, ls, ...over
    };
    return v;
}

test("prepareHold: no hold when ready, with no video, during an ad, or while another hold is active", () => {
    const E = env({ realTimers: true });
    const v = video();
    assert.equal(E.API.prepareHold(null, () => false), false);
    assert.equal(E.API.prepareHold(v, () => true), false, "already ready");
    E.S.document.querySelector = s => (s === ".ad-showing" ? {} : null);
    assert.equal(E.API.prepareHold(v, () => false), false, "an ad is playing: prepare during it");
    E.S.document.querySelector = () => null;
    assert.equal(E.API.prepareHold(v, () => false), true);
    assert.equal(E.API.prepareHold(v, () => false), false, "one hold at a time");
    E.API.hold.cancel();
    assert.equal(E.API.hold.active, false);
});

test("prepareHold: pauses a playing video, resumes when ready, goes back to 0 for a new video's first play", async () => {
    const E = env({ realTimers: true });
    let ready = false;
    const v = video({ currentTime: 0.3 });
    assert.equal(E.API.prepareHold(v, () => ready, { initial: true }), true);
    assert.equal(v.paused, true, "paused while waiting");
    assert.equal(E.API.hold.active, true);
    ready = true;
    await new Promise(r => setTimeout(r, 160));
    assert.equal(E.API.hold.active, false, "released once ready");
    assert.equal(v.plays, 1, "playback resumed");
    assert.equal(v.currentTime, 0, "the first sentence is not missed: back to the start");
    assert.ok(v.ls.play === undefined, "the play listener was removed");
});

test("prepareHold: the player's own early autoplay is held, the viewer's later play cancels the hold; release resumes only a video we paused", async () => {
    const E = env({ realTimers: true });
    const v = video();
    E.API.prepareHold(v, () => false);
    v.paused = false;
    v.ls.play();
    assert.equal(v.paused, true, "the player's autoplay in the first 1.5 s is paused again");
    assert.equal(E.API.hold.active, true);
    // a viewer who presses play later (simulate by moving the clock) ends the hold and keeps playing
    const realNow = E.S.performance.now;
    E.S.performance.now = () => realNow() + 2000;
    v.paused = false;
    v.ls.play();
    assert.equal(E.API.hold.active, false);
    assert.equal(v.paused, false, "the viewer's play is respected");
    // a hold on a paused video never starts it
    const p = video({ paused: true });
    E.API.prepareHold(p, () => false);
    E.API.hold.release();
    assert.equal(p.plays, 0);
});

test("prepareHold: gives up after maxMs", async () => {
    const E = env({ realTimers: true });
    const v = video();
    E.API.prepareHold(v, () => false, { maxMs: 50 });
    await new Promise(r => setTimeout(r, 250));
    assert.equal(E.API.hold.active, false);
    assert.ok(E.API.hold.lastWaitMs >= 50);
    assert.equal(v.plays, 1, "playback resumed after the wait ran out");
});

test("prepareHold card: the two bars show the engine's real counts, and the card goes when the hold ends", () => {
    const E = env({ realTimers: true });
    E.API.dub.engine = { readyCounts: () => ({ subs: { done: 2, total: 4 }, voice: { done: 0, total: 0 } }), isReadyAt: () => false };
    const v = video({ currentTime: 1 });
    assert.equal(E.API.prepareHold(v, () => false), true);
    const card = E.S.document.body.children[0];
    assert.equal(card.className, "cst-prepare-note");
    assert.equal(card.children[1].children[1].children[0].style.width, "50%", "2 of 4 subtitles translated");
    assert.equal(card.children[1].children[2].textContent, "2/4");
    assert.equal(card.children[2].children[1].children[0].style.width, "0%", "no speech plans yet: the bar stays empty");
    assert.equal(card.children[2].children[2].textContent, "–", "no plans yet: no count to show");
    E.API.hold.cancel();
});

test("prepareHold card: follows the page into fullscreen and back out, and the listener goes when the hold ends", () => {
    const E = env({ realTimers: true });
    E.API.dub.engine = { readyCounts: () => ({ subs: { done: 0, total: 1 }, voice: { done: 0, total: 0 } }), isReadyAt: () => false };
    const fsListeners = {};
    const fsPlayer = { children: [], appendChild(c) { this.children.push(c); return c; } };
    E.S.document.addEventListener = (n, f) => { fsListeners[n] = f; };
    E.S.document.removeEventListener = n => { delete fsListeners[n]; };
    const v = video({ currentTime: 1 });
    assert.equal(E.API.prepareHold(v, () => false), true);
    const card = E.S.document.body.children[0];
    E.S.document.fullscreenElement = fsPlayer;
    fsListeners.fullscreenchange();
    assert.equal(fsPlayer.children[0], card, "in fullscreen the card moves into the fullscreen element");
    E.S.document.fullscreenElement = null;
    fsListeners.fullscreenchange();
    assert.equal(E.S.document.body.children[1], card, "back on the page when fullscreen ends");
    E.API.hold.cancel();
    assert.equal(fsListeners.fullscreenchange, undefined, "listener removed with the hold");
});


test("initial preparation waits for an active first local take but respects explicit limits", () => {
    for (const explicit of [false, true]) {
        const E = env();
        let now = 0, tick, ready = false;
        E.S.performance.now = () => now;
        E.S.setInterval = fn => { tick = fn; return 1; };
        E.API.dub.engine = { provider: { id: "vieneu" }, jobs: new Map([["first", {}]]), rendered: new Map() };
        const v = video({ currentTime: 0.3 });
        E.API.prepareHold(v, () => ready, { initial: true, ...(explicit ? { maxMs: 5000 } : {}) });
        now = 6000; tick();
        assert.equal(E.API.hold.active, !explicit);
        if (!explicit) {
            now = 14000; ready = true; tick();
            assert.equal(E.API.hold.active, false);
        }
        assert.equal(v.plays, 1);
    }
});
