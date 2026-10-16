#!/usr/bin/env node
// Speaker lab (docs/TESTING.md "Speaker lab"): measures the AI reading of who speaks (background.js
// analyzeSpeakers, dub-planner speakerHints / speakerTurns) against transcripts that name their
// speakers. PBS NewsHour's ".en-US" track writes "NAME:" before every turn; its ".en" track is
// the plain one the extension reads. Caption text of public videos stays out of git
// (tests/harness/lab-data/ and the data folder are never committed).
//
//   node tools/speaker-lab.js extract <text-file> <dataDir>
//        every "LABDATA<<base64 gzip json>>LABDATA" that tests/harness/speaker-grab.js printed in a
//        YouTube tab (a session transcript, a saved page) -> <dataDir>/<id>.json, the latest wins
//   node tools/speaker-lab.js prepare <dataDir> [--variants=plain,clean] [--planner=<file>] [--sentences]
//        -> tests/harness/lab-data/speaker-lab-data.js: per video and variant the lines dubbing.js
//        would send (PLAN.speakerLines). plain: the ".en" track (else ".en-US" without its labels);
//        clean: ".en-US" without its labels. Then open
//        chrome-extension://<id>/tests/harness/speaker-lab.html?tag=<run> (runs: lab-data/speaker-lab-runs.js)
//   node tools/speaker-lab.js score <dataDir> --tag=<run> [--variant=plain] [--as=<variant>]
//        [--planner=<file>] [--sentences] [--detail] [--why]
//        reads the run's answers from chrome.storage.local "speakerLab" (tools/ext-storage.js) and
//        scores each video word by word against the named transcript: acc (words in the right
//        voice, voices matched to people one to one), one person one voice, voice purity, pairs of
//        people sharing a voice, people split over voices. --as: the variant the answers were read
//        on, when it is not the one scored (a run on "plainj" scored as "plain"). Methods: one (a
//        single voice), rules (marks and labels only), oracle5 (the truth through MAX_VOICES), ai.
//
// --planner: another copy of dub-planner.js (its own requires must resolve), to score a change before
// it is made. Scores of a planner change need no new reading: the answers are kept by line.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith("--" + k)); return a ? (a.includes("=") ? a.slice(a.indexOf("=") + 1) : true) : null; };
const plannerAt = opt("planner") ? path.resolve(opt("planner")) : path.join(ROOT, "dub-planner.js");
const PLAN = require(plannerAt);

// --sentences: a line shape on trial (BACKLOG 44), not the extension's. Each caption is split at its
// sentence ends and before a ">>", then the pieces are joined up to a sentence end the way
// joinCaptionLines joins short captions (when a fifth of the pieces end a sentence, or the captions
// are short). Prepared items get an "s" after their variant ("plains").
const TITLE_ABBR = /^(?:Dr|Mr|Mrs|Ms|Mx|Prof|St|Jr|Sr|Rev|Gen|Col|Capt|Sgt|Lt)$/;
const TURN_OPEN = /^(?:>>|-\s|\p{Lu}[\p{Lu}\p{M}.'’-]*(?:\s+\p{Lu}[\p{Lu}\p{M}.'’-]*){0,4}:\s)/u;
const SENTENCE_END = /([\p{L}\p{N}'’)"”\]]+)[.!?…]+["”')\]]*\s+(?=\S)/gu;
const ENDS = /[.!?…]["”')\]]*$/;
function sentenceLines(lines) {
    // the caption pieces again where the planner joined them
    const caps = lines.flatMap(l => (l.parts ? l.parts.map(p => ({ start: p.start, end: p.end, text: l.text.slice(p.pos, p.pos + p.len) })) : [l]));
    const pieces = [];
    for (const c of caps) {
        const cuts = [0];
        for (const m of c.text.matchAll(SENTENCE_END)) if (!TITLE_ABBR.test(m[1]) && !/^\p{Lu}$/u.test(m[1])) cuts.push(m.index + m[0].length);
        for (const m of c.text.matchAll(/\s>>/g)) cuts.push(m.index + 1);
        cuts.sort((a, b) => a - b);
        const n = c.text.length || 1;
        cuts.forEach((a, k) => {
            const raw = c.text.slice(a, k + 1 < cuts.length ? cuts[k + 1] : c.text.length), t = raw.trim();
            if (!t) return;
            const at = a + raw.indexOf(t);
            pieces.push({ start: c.start + (c.end - c.start) * at / n, end: c.start + (c.end - c.start) * (at + t.length) / n, text: t });
        });
    }
    const sizes = caps.map(c => c.text.length).sort((a, b) => a - b);
    const join = pieces.filter(p => ENDS.test(p.text)).length >= 0.2 * pieces.length || (sizes.length > 0 && sizes[sizes.length >> 1] < 40);
    const out = [];
    let cur = null;
    for (const p of pieces) {
        if (join && cur && !TURN_OPEN.test(p.text) && p.start - cur.end < 1.5 && !ENDS.test(cur.text) && cur.text.length + 1 + p.text.length <= 160) {
            cur.parts.push({ pos: cur.text.length + 1, start: p.start, end: p.end, len: p.text.length });
            cur.text += " " + p.text;
            cur.end = Math.max(cur.end, p.end);
            continue;
        }
        cur = { start: p.start, end: p.end, text: p.text, parts: [{ pos: 0, start: p.start, end: p.end, len: p.text.length }] };
        out.push(cur);
    }
    return out;
}
const speakerLines = groups => (opt("sentences") ? sentenceLines(PLAN.speakerLines(groups)) : PLAN.speakerLines(groups));

// "NAME:" labels of a named transcript, with a party or a title after the name ("TAMARA KEITH,
// National Public Radio:", "REP. MARIA ELVIRA SALAZAR (R-FL):")
const LABEL = /(^|[.!?"”)\]]\s+)((?:[A-Z][A-Z.'’\-]*\s+){0,5}[A-Z][A-Z.'’\-]*)(\s*\([^)]{0,60}\))?(,[^:]{0,90})?:\s+/g;
const TITLES = /^(?:FORMER|FMR\.|STATE|REP\.|SEN\.|GOV\.|DR\.|COL\.|GEN\.|PRESIDENT|U\.S\.|MAYOR|JUDGE|SECRETARY)$/;
const GENERIC = /^(?:MAN|WOMAN|STUDENT|QUESTION|ACTOR|BOY|GIRL|CHILD|PERSON|CROWD|PROTESTERS?|PROTESTER|INTERPRETER|AUTOMATED VOICE)$/;
const stripLabels = text => text.replace(LABEL, (m, lead, name) => (/[A-Z]{2}/.test(name) ? lead : m)).trim();
const norm = w => w.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "");
function keyOf(name) {
    const w = name.trim().split(/\s+/);
    while (w.length > 1 && TITLES.test(w[0])) w.shift();
    return w.join(" ");
}

function extract(file, out) {
    fs.mkdirSync(out, { recursive: true });
    const found = new Map();
    for (const m of fs.readFileSync(file, "utf8").matchAll(/LABDATA<<([A-Za-z0-9+/=]+)>>LABDATA/g)) {
        try {
            const j = JSON.parse(zlib.gunzipSync(Buffer.from(m[1], "base64")).toString("utf8"));
            if (j && j.id) found.set(j.id, j);
        } catch (e) { /* a partial or quoted copy */ }
    }
    for (const [id, j] of found) fs.writeFileSync(path.join(out, id + ".json"), JSON.stringify(j));
    console.log("videos", found.size, [...found.keys()].join(" "));
}

const videosIn = dir => fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
const trackOf = (j, vss) => j.tracks.find(t => t.vss === vss && t.ev);

// The caption lines of one variant, as { start, end, text } (event times are in tenths of a second)
function linesOf(j, variant) {
    const us = trackOf(j, ".en-US"), en = trackOf(j, ".en");
    let ev;
    if (/^plain/.test(variant)) ev = (en && en.ev) || us.ev.map(e => [e[0], e[1], stripLabels(e[2])]);
    else if (/^clean/.test(variant)) ev = us.ev.map(e => [e[0], e[1], stripLabels(e[2])]);
    else ev = us.ev;
    return ev.filter(e => e[2]).map(e => ({ start: e[0] / 10, end: (e[0] + e[1]) / 10, text: e[2] }));
}
const groupsOf = lines => lines.map(l => ({ start: l.start, end: l.end, srcCues: [{ start: l.start, end: l.end, text: l.text }] }));

function prepare(dir) {
    const variants = String(opt("variants") || "plain,clean").split(",");
    const items = [];
    for (const j of videosIn(dir)) {
        if (!trackOf(j, ".en-US")) continue;
        for (const variant of variants) {
            const lines = speakerLines(groupsOf(linesOf(j, variant)));
            if (lines.length < 8) continue;
            items.push({ id: j.id, variant: variant + (opt("sentences") ? "s" : ""), title: j.title, len: j.len, lines: lines.map(l => l.text) });
        }
    }
    const out = path.join(ROOT, "tests/harness/lab-data/speaker-lab-data.js");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, "// generated by tools/speaker-lab.js: caption lines of public videos, never committed\nwindow.SPEAKER_LAB = " + JSON.stringify(items) + ";\n");
    console.log("items", items.length, "lines", items.reduce((n, x) => n + x.lines.length, 0), "chars", items.reduce((n, x) => n + x.lines.join("\n").length, 0));
}

// Truth: every word of the named transcript with its speaker and time
function truthOf(ev) {
    const words = [];
    let sp = null, generic = 0;
    for (const [t0, d, text] of ev) {
        const start = t0 / 10, end = (t0 + d) / 10;
        const parts = [];
        let last = 0;
        for (const m of text.matchAll(LABEL)) {
            if (!/[A-Z]{2}/.test(m[2])) continue;
            const at = m.index + m[1].length;
            parts.push({ text: text.slice(last, at), sp });
            let k = keyOf(m[2]);
            if (GENERIC.test(k)) k = k + "#" + (++generic);
            sp = k;
            last = m.index + m[0].length;
        }
        parts.push({ text: text.slice(last), sp });
        let pos = 0;
        const len = text.length || 1;
        for (const p of parts) {
            for (const w of p.text.split(/\s+/).filter(Boolean)) {
                const at = text.indexOf(w, pos);
                pos = at + w.length;
                if (norm(w)) words.push({ w: norm(w), sp: p.sp, t: start + (end - start) * Math.max(0, at) / len });
            }
        }
    }
    return words;
}

// Longest common subsequence of the words read against the truth's words
function align(a, b) {
    const n = a.length, m = b.length;
    const L = new Array(n + 1);
    for (let i = 0; i <= n; i++) L[i] = new Uint16Array(m + 1);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
        L[i][j] = a[i].w === b[j].w ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const map = new Array(n).fill(-1);
    let i = 0, j = 0;
    while (i < n && j < m) {
        if (a[i].w === b[j].w) { map[i] = j; i++; j++; }
        else if (L[i + 1][j] >= L[i][j + 1]) i++;
        else j++;
    }
    return map;
}

// Hungarian method, maximum weight, on a rows x cols matrix: voices matched to people one to one
function maxMatch(M) {
    const R = M.length, C = M[0] ? M[0].length : 0, n = Math.max(R, C);
    if (!n) return 0;
    let big = 0;
    for (const r of M) for (const x of r) big = Math.max(big, x);
    const cost = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => big - ((M[i] && M[i][j]) || 0)));
    const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0), p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
        p[0] = i;
        let j0 = 0;
        const minv = new Array(n + 1).fill(Infinity), used = new Array(n + 1).fill(false);
        do {
            used[j0] = true;
            const i0 = p[j0];
            let delta = Infinity, j1 = 0;
            for (let j = 1; j <= n; j++) if (!used[j]) {
                const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
                if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
                if (minv[j] < delta) { delta = minv[j]; j1 = j; }
            }
            for (let j = 0; j <= n; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
            j0 = j1;
        } while (p[j0] !== 0);
        do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    let total = 0;
    for (let j = 1; j <= n; j++) if (p[j] && M[p[j] - 1] && M[p[j] - 1][j - 1] != null) total += M[p[j] - 1][j - 1];
    return total;
}

function score(lines, truthWords, voiceAt) {
    const inWords = [];
    for (const l of lines) {
        let pos = 0;
        const len = l.text.length || 1;
        for (const w of l.text.split(/\s+/).filter(Boolean)) {
            const at = l.text.indexOf(w, pos);
            pos = at + w.length;
            if (norm(w)) inWords.push({ w: norm(w), t: l.start + (l.end - l.start) * Math.max(0, at) / len });
        }
    }
    const map = align(inWords, truthWords);
    const sps = inWords.map((x, i) => (map[i] >= 0 ? truthWords[map[i]].sp : null));
    // a word not aligned: the speaker of the nearest aligned word before it, else after it
    for (let i = 0; i < sps.length; i++) {
        if (sps[i] != null) continue;
        let k = i - 1;
        while (k >= 0 && sps[k] == null) k--;
        let q = i + 1;
        while (q < sps.length && sps[q] == null) q++;
        sps[i] = k >= 0 ? sps[k] : q < sps.length ? sps[q] : null;
    }
    const speakers = [...new Set(sps.filter(Boolean))];
    const count = new Map();
    sps.forEach(s => count.set(s, (count.get(s) || 0) + 1));
    const W = sps.filter(Boolean).length || 1;
    const voices = new Map();
    const C = [];
    const vs = inWords.map((x, i) => {
        if (!sps[i]) return null;
        const v = voiceAt(x.t, sps[i]);
        if (!voices.has(v)) { voices.set(v, C.length); C.push(new Array(speakers.length).fill(0)); }
        C[voices.get(v)][speakers.indexOf(sps[i])]++;
        return v;
    });
    const acc = maxMatch(C) / W;
    let cons = 0, pur = 0, shared = 0;
    const major = speakers.filter(s => count.get(s) >= Math.max(25, 0.05 * W));
    const mainVoice = new Map();
    speakers.forEach((s, k) => {
        let best = 0, bv = -1;
        C.forEach((row, v) => { if (row[k] > best) { best = row[k]; bv = v; } });
        cons += best;
        mainVoice.set(s, bv);
    });
    C.forEach(row => { pur += Math.max(...row); });
    for (let a = 0; a < major.length; a++) for (let b = a + 1; b < major.length; b++) if (mainVoice.get(major[a]) === mainVoice.get(major[b])) shared++;
    const split = major.filter(s => { const k = speakers.indexOf(s); const tot = C.reduce((n, r) => n + r[k], 0); return Math.max(...C.map(r => r[k])) / tot < 0.85; }).length;
    return { speakers: speakers.length, major: major.length, voices: C.length, acc, cons: cons / W, pur: pur / W, shared, split, why: whyWrong(sps, vs, C, speakers, voices) };
}

// --why: the words in another voice than their person's, by cause. Each person's voice: the biggest
// cells first, one voice per person. edge: the person's turn is in their voice but the switch came
// early or late; missed: a whole turn kept the voice before it (no turn found); wrong: a whole turn
// went to someone else's voice; none: the person has no voice of their own (more people than
// voices, or the reading took two people for one)
function whyWrong(sps, vs, C, speakers, voices) {
    const cells = [];
    const vOf = new Map(), taken = new Set();
    C.forEach((row, v) => row.forEach((n, k) => cells.push([n, v, k])));
    cells.sort((a, b) => b[0] - a[0]);
    for (const [n, v, k] of cells) if (n && !vOf.has(k) && !taken.has(v)) { vOf.set(k, v); taken.add(v); }
    const idx = new Map([...voices].map(([v, i]) => [v, i]));
    const turns = [];
    sps.forEach((s, i) => {
        if (!s) return;
        const cur = turns[turns.length - 1];
        if (cur && cur.sp === s) cur.to = i; else turns.push({ sp: s, from: i, to: i });
    });
    const majorOf = tn => {
        const cnt = new Map();
        for (let i = tn.from; i <= tn.to; i++) if (vs[i] != null) cnt.set(idx.get(vs[i]), (cnt.get(idx.get(vs[i])) || 0) + 1);
        return [...cnt].sort((a, b) => b[1] - a[1])[0][0];
    };
    const out = { words: 0, edge: 0, missed: 0, wrong: 0, none: 0 };
    turns.forEach((tn, k) => {
        const own = vOf.get(speakers.indexOf(tn.sp));
        const major = majorOf(tn);
        for (let i = tn.from; i <= tn.to; i++) {
            if (vs[i] == null) continue;
            out.words++;
            if (idx.get(vs[i]) === own) continue;
            if (own === undefined) out.none++;
            else if (major === own) out.edge++;
            else if (k > 0 && major === majorOf(turns[k - 1])) out.missed++;
            else out.wrong++;
        }
    });
    return out;
}

function readAnswers(tag) {
    const raw = execFileSync(process.execPath, [path.join(__dirname, "ext-storage.js"), "--key=speakerLab"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    const store = JSON.parse(raw || "{}") || {};
    const out = new Map();
    for (const [k, v] of Object.entries(store)) {
        const [t, rest] = k.split("|");
        if (t === tag && v && v.r && v.r.ok) out.set(rest, v.r);
    }
    return out;
}

function scoreRun(dir) {
    const tag = opt("tag");
    if (!tag) throw new Error("--tag=<run> is needed");
    const variant = String(opt("variant") || "plain");
    const as = String(opt("as") || variant);
    const answers = readAnswers(tag);
    const agg = {}, rows = [];
    for (const j of videosIn(dir)) {
        const us = trackOf(j, ".en-US");
        if (!us) continue;
        const truth = truthOf(us.ev);
        const lines = linesOf(j, variant);
        const groups = groupsOf(lines);
        const methods = { one: () => 0 };
        const rules = PLAN.speakerTurns(groups);
        methods.rules = t => PLAN.speakerAt(rules, t);
        const cnt = new Map();
        truth.forEach(x => cnt.set(x.sp, (cnt.get(x.sp) || 0) + 1));
        const rank = new Map([...cnt].sort((a, b) => b[1] - a[1]).map(([s], r) => [s, r]));
        const vi = r => (r < PLAN.MAX_VOICES ? r : 1 + ((r - 1) % (PLAN.MAX_VOICES - 1)));
        methods.oracle5 = (t, sp) => vi(rank.get(sp));
        const r = answers.get(j.id + "." + as);
        let src = "";
        if (r) {
            const sl = speakerLines(groups);
            const withAi = PLAN.speakerTurns(groups.slice(), { ai: PLAN.speakerHints(sl, r, 0, sl.length) });
            methods.ai = t => PLAN.speakerAt(withAi, t);
            src = withAi.source;
        }
        const cells = [];
        for (const [name, fn] of Object.entries(methods)) {
            const s = score(lines, truth, fn);
            const a = agg[name] || (agg[name] = { n: 0, acc: 0, cons: 0, pur: 0, shared: 0, split: 0, voices: 0, major: 0, why: { words: 0, edge: 0, missed: 0, wrong: 0, none: 0 } });
            a.n++; a.acc += s.acc; a.cons += s.cons; a.pur += s.pur; a.shared += s.shared; a.split += s.split; a.voices += s.voices; a.major += s.major;
            for (const k of Object.keys(a.why)) a.why[k] += s.why[k];
            if (name === "rules" || name === "ai") cells.push(`${name}:${name === "ai" ? src : rules.source} v${s.voices} ${(s.acc * 100).toFixed(0)}/${(s.cons * 100).toFixed(0)}/${(s.pur * 100).toFixed(0)} sh${s.shared} sp${s.split}`);
        }
        rows.push(`${j.id.padEnd(12)} people ${String(cnt.size).padEnd(3)} | ${cells.join(" | ")}`);
    }
    console.log(`${variant} (answers of run "${tag}" on ${as}): method  videos  acc  one-person-one-voice  purity  shared-pairs  split-people  voices/major`);
    for (const [name, a] of Object.entries(agg)) console.log(`${name.padEnd(8)} ${a.n}  ${(a.acc / a.n * 100).toFixed(1)}  ${(a.cons / a.n * 100).toFixed(1)}  ${(a.pur / a.n * 100).toFixed(1)}  ${a.shared}  ${a.split}  ${(a.voices / a.n).toFixed(1)}/${(a.major / a.n).toFixed(1)}`);
    if (opt("detail")) console.log("per video: method vVoices acc/one-person-one-voice/purity shShared spSplit\n" + rows.join("\n"));
    if (opt("why")) {
        console.log("words in another voice than their person's, % of all words: edge (switch early or late), missed (a whole turn kept the voice before), wrong (a whole turn in someone else's voice), none (no voice of their own)");
        for (const [name, a] of Object.entries(agg)) {
            const w = a.why, p = x => (x / Math.max(1, w.words) * 100).toFixed(1);
            if (name !== "one") console.log(`${name.padEnd(8)} ${p(w.edge + w.missed + w.wrong + w.none)}: edge ${p(w.edge)} missed ${p(w.missed)} wrong ${p(w.wrong)} none ${p(w.none)}`);
        }
    }
}

const [cmd, a1, a2] = args.filter(x => !x.startsWith("--"));
if (cmd === "extract" && a1 && a2) extract(a1, a2);
else if (cmd === "prepare" && a1) prepare(a1);
else if (cmd === "score" && a1) scoreRun(a1);
else console.log("usage: node tools/speaker-lab.js extract <text-file> <dataDir> | prepare <dataDir> [--variants=plain,clean] [--sentences] | score <dataDir> --tag=<run> [--variant=plain] [--as=<variant>] [--sentences] [--detail] [--why]");
