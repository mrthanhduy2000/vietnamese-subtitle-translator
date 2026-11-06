// Shared speech-session decisions. No DOM, network, audio decoding or persistent storage.
(function (root) {
    'use strict';
    const STATE_FIELDS = ['plans', 'planById', 'entryAt', 'lastSpokenStart', 'lastSpokenId', 'drainWall', 'drainAt', 'headAt'];
    class SpeechSession {
        constructor({ completeSpeech = true } = {}) {
            this.completeSpeech = completeSpeech;
            this.plans = [];
            this.planById = new Map();
            this.entryAt = null; this.lastSpokenStart = null; this.lastSpokenId = null;
            this.drainWall = null; this.drainAt = null; this.headAt = null;
            this.phase = 'idle'; this.lifetime = 0; this.revision = 0; this.sourceId = '';
            this.ad = false; this.groups = []; this.input = { groups: 0, pending: 0, invalidTiming: 0 };
            this.lastEvent = 'created';
        }
        transition(event, { time = 0, sourceId = this.sourceId, ended = false, waiting = false, paused = false, reason = '', adSourceTime, adResumeWithin = 0, live = null } = {}) {
            const resume = event === 'reset' && reason === 'ad' && this.completeSpeech && adSourceTime != null && Math.abs(time - adSourceTime) <= adResumeWithin
                ? { entryAt: this.entryAt, mark: this.lastSpokenStart, id: this.lastSpokenId, headAt: this.headAt, live } : null;
            const oldPhase = this.phase;
            if (event !== 'frame') this.lastEvent = event;
            if (event === 'start' || event === 'stop') { this.lifetime++; this.ad = false; }
            if (event === 'start' || event === 'reset') {
                this.revision++; this.entryAt = time; this.lastSpokenStart = null; this.lastSpokenId = null;
                this.drainWall = null; this.drainAt = null; this.sourceId = sourceId;
                if (resume) { this.entryAt = resume.entryAt; this.lastSpokenStart = resume.mark; this.lastSpokenId = resume.id; }
            }
            if (event === 'ad-start') this.ad = true;
            if (event === 'ad-end' || event === 'stop') this.ad = false;
            if (event === 'stop') this.phase = 'stopped';
            else if (this.ad) this.phase = 'ad';
            else if (ended) this.phase = this.completeSpeech ? 'draining' : 'ended';
            else if (paused || event === 'pause') this.phase = 'paused';
            else this.phase = waiting ? 'buffering' : 'playing';
            if (event === 'frame' && oldPhase !== this.phase) this.lastEvent = this.phase;
            if (!ended) this.drainWall = null;
            return resume;
        }
        observe(groups) {
            this.groups = groups || [];
            let pending = 0, invalidTiming = 0;
            for (const g of this.groups) {
                if (!g) continue;
                if (g.translated === false && !g.viText) pending++;
                if (!Number.isFinite(g.start) || !Number.isFinite(g.end) || g.end < g.start) invalidTiming++;
            }
            this.input = { groups: this.groups.length, pending, invalidTiming };
        }
        timeline(source, wall) {
            if (!(this.completeSpeech && source.ended)) return source.currentTime;
            if (this.drainWall == null) { this.drainWall = wall; this.drainAt = source.currentTime; }
            this.drainAt += Math.max(0, wall - this.drainWall) / 1000 * (source.playbackRate || 1);
            this.drainWall = wall;
            return this.drainAt;
        }
        queued(plan) {
            return !!(plan && (this.lastSpokenStart == null ? plan.end > (this.entryAt || 0) : plan.start > this.lastSpokenStart + 1e-6));
        }
        queueAt(time, liveId) {
            if (!this.completeSpeech) return time;
            const live = liveId && this.planById.get(liveId);
            return live ? live.start : this.lastSpokenStart != null ? this.lastSpokenStart : this.entryAt != null ? this.entryAt : time;
        }
        renderAt(time, liveId) {
            if (!this.completeSpeech) return time;
            const next = this.plans.find(p => this.queued(p));
            return next ? Math.min(time, Math.max(this.queueAt(time, liveId), next.start)) : time;
        }
        translationBefore(plan, tolerance) {
            if (!this.completeSpeech) return false;
            const from = this.lastSpokenStart != null ? this.lastSpokenStart : this.entryAt || 0;
            return this.groups.some(g => g && g.translated === false && !g.viText && g.end > from && g.start < plan.start - tolerance);
        }
        entryPlan(time, tolerance) {
            const entry = this.completeSpeech ? (this.entryAt != null ? this.entryAt : time) : time;
            let index = this.at(entry + tolerance);
            if (this.completeSpeech && (index < 0 || this.plans[index].end <= entry)) index++;
            return { entry, index, plan: this.plans[index] || null };
        }
        at(time) {
            let lo = 0, hi = this.plans.length - 1, found = -1;
            while (lo <= hi) { const mid = (lo + hi) >> 1; if (this.plans[mid].start <= time) { found = mid; lo = mid + 1; } else hi = mid - 1; }
            return found;
        }
        liveNext(time, live) {
            const previous = live && this.planById.get(live.planId);
            let index, phrase = 0;
            if (previous) {
                index = this.plans.indexOf(previous); phrase = live.k + 1;
                if (phrase >= previous.phrases.length) { index++; phrase = 0; }
            } else {
                const entry = this.lastSpokenStart != null ? this.lastSpokenStart : this.entryAt != null ? this.entryAt : time;
                index = this.at(entry);
                if (index < 0 || this.plans[index].end <= entry) index++;
                const first = this.plans[index];
                if (first) while (phrase < first.phrases.length && entry - first.start > first.phrases[phrase].offset + first.phrases[phrase].dur * 0.4) phrase++;
            }
            return { plan: this.plans[index] || null, phrase };
        }
        // Audio work may survive a seek when its content still matches. Playback callbacks may not.
        token(playback = false) {
            return { lifetime: this.lifetime, sourceId: this.sourceId, ...(playback ? { revision: this.revision } : {}) };
        }
        lease(plan, provider) {
            return { ...this.token(), provider, id: plan.id, start: plan.start, end: plan.end, text: plan.text, voiceTag: plan.voiceTag };
        }
        current(lease) { return !!lease && lease.lifetime === this.lifetime && lease.sourceId === this.sourceId && (lease.revision == null || lease.revision === this.revision) && this.phase !== 'stopped'; }
        accepts(lease, provider) {
            const p = lease && this.planById.get(lease.id);
            return !!(this.current(lease) && provider === lease.provider && p && p.start === lease.start && p.end === lease.end && p.text === lease.text && p.voiceTag === lease.voiceTag);
        }
        snapshot({ time, live = null, speech = null, rendered = new Map(), pending = new Map(), failed = new Map(), tolerance = 0 } = {}) {
            const next = this.lastSpokenStart == null ? this.entryPlan(time, tolerance).plan : this.plans.find(p => this.queued(p));
            let wait = null;
            if (next && this.translationBefore(next, tolerance)) wait = 'translation';
            else if (next && (!Number.isFinite(next.start) || !Number.isFinite(next.end))) wait = 'source';
            else if (next && (failed.get(next.id) || 0) >= 2 && !pending.has(next.id) && !rendered.has(next.id)) wait = 'failed';
            else if (next && !rendered.has(next.id) && !live) wait = pending.has(next.id) ? 'synthesis' : 'audio';
            const from = this.lastSpokenStart != null ? this.lastSpokenStart : this.entryAt || 0;
            const pendingTranslation = this.completeSpeech && this.groups.some(g => g && g.translated === false && !g.viText && g.end > from);
            if (!wait && !next && pendingTranslation) wait = 'translation';
            if (!wait && !next && this.input.invalidTiming) wait = 'source';
            const unfinished = pendingTranslation || wait === 'source' || (live ? (!live.finished || this.plans.indexOf(this.planById.get(live.planId)) < this.plans.length - 1) : !!(speech || next));
            return { phase: this.phase === 'draining' && !unfinished ? 'complete' : this.phase,
                lifetime: this.lifetime, revision: this.revision, completeSpeech: this.completeSpeech,
                entryAt: this.entryAt, cursor: this.lastSpokenStart, nextId: next && next.id,
                queued: this.plans.filter(p => this.queued(p)).length, wait, input: { ...this.input } };
        }
    }
    // Legacy engine fields are aliases, so adapters and old embedders share one state owner.
    function bind(engine) {
        if (engine.transport) { engine.transport.completeSpeech = !!engine.settings?.keepAllSpeech; return engine.transport; }
        const session = new SpeechSession({ completeSpeech: !!engine.settings?.keepAllSpeech });
        for (const key of STATE_FIELDS) if (Object.prototype.hasOwnProperty.call(engine, key)) session[key] = engine[key];
        engine.transport = session;
        for (const key of STATE_FIELDS) Object.defineProperty(engine, key, { configurable: true, enumerable: true, get() { return session[key]; }, set(value) { session[key] = value; } });
        return session;
    }
    const api = { SpeechSession, bind };
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CST_DUB_SESSION = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
