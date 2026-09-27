#!/usr/bin/env node
// What Gemini actually receives per translation request, measured offline: runs the real content.js
// Coursera path (grouping -> windows -> context-engine -> request) over tests/context-corpus.js with
// a fake, delayed service worker, then builds each prompt with the real background.js
// buildUnitPrompt. No network, no API key, nothing is billed.
//
//   node tools/context-eval.js            averages per request
//   node tools/context-eval.js --show     also print every user prompt in full
//   node tools/context-eval.js --root D   measure another checkout (e.g. a `git archive` of HEAD~1)
//                                         with this checkout's corpus
const vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const args = process.argv.slice(2);
const ROOT = args.includes("--root") ? path.resolve(args[args.indexOf("--root") + 1]) : path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const { bgEnv } = require(path.join(__dirname, "../tests/bg-env.js"));
const corpus = require(path.join(__dirname, "../tests/context-corpus.js"));

function contentEnv(onMsg) {
    const noop = () => {};
    const sb = {
        console: { log: noop, warn: noop, error: console.error }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
        Promise, Map, Set, Math, JSON, Date, RegExp, Array, Object, String, Number,
        location: { href: "https://www.coursera.org/learn/x/lecture/y", hostname: "www.coursera.org", pathname: "/learn/x/lecture/y" },
        document: { readyState: "complete", title: "t", body: {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            getElementsByTagName: () => [], createElement: () => ({ style: {}, appendChild: noop, addEventListener: noop }),
            head: { appendChild: noop }, documentElement: { appendChild: noop }, addEventListener: noop },
        addEventListener: noop, postMessage: noop, MutationObserver: class { observe() {} disconnect() {} }, alert: noop,
        chrome: {
            // "economy": no refine pass, which the fake echo translations would trigger and real ones rarely do
            storage: { sync: { get: async d => ({ ...(d || {}), costMode: "economy" }), set: async () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener: noop } },
            runtime: { lastError: null, onMessage: { addListener: noop }, sendMessage: (m, cb) => { Promise.resolve(onMsg(m)).then(cb); } }
        }
    };
    sb.window = sb; sb.globalThis = sb;
    vm.createContext(sb);
    for (const f of ["glossary.js", "vi-segmenter.js", "subtitle-style.js", "context-engine.js", "vi-quality.js", "cost-policy.js", "content.js"]) vm.runInContext(read(f), sb, { filename: f });
    return sb;
}

(async () => {
    const buildUnitPrompt = bgEnv(async () => { throw new Error("offline"); }).sandbox.buildUnitPrompt;
    const sent = [];
    const env = contentEnv(async m => {
        if (m.action !== "translateUnit") return { ok: true };
        sent.push(JSON.parse(JSON.stringify(m)));
        // reply time grows with the text, like a real model's output
        await new Promise(r => setTimeout(r, 30 + m.sentences.join(" ").length / 20));
        return { ok: true, engine: "gemini", model: "fake", latency: 1, terms: [], translations: m.sentences.map(s => "Việt: " + s) };
    });
    env.__cues = corpus.cues();
    env.__meta = { title: "Training language models", course: "Generative AI for Everyone" };
    await vm.runInContext(`(async () => {
        const gs = groupCuesIntoSentences(__cues, false);
        const s = new CST_CONTEXT.ContextSession(__meta);
        s.setUnits(gs.map(g => g.text));
        globalThis.__groups = gs.length;
        await translateAllGroups(s, gs, null, () => true, {});
    })()`, env);

    const len = x => (Array.isArray(x) ? x.join("; ") : String(x || "")).length;
    const fields = {
        current: m => len(m.sentences), refSource: m => len(m.context.refSource), prevSource: m => len(m.context.prevSource), prevTranslation: m => len(m.context.prevTranslation),
        nextSource: m => len(m.context.nextSource), topic: m => len(m.context.topic), domain: m => len(m.context.domain),
        terms: m => len((m.context.terms || []).map(t => `${t.en} = ${t.vi}`)), senseHints: m => len(m.context.senseHints),
        phraseHints: m => len(m.context.phraseHints)
    };
    const sum = Object.fromEntries(Object.keys(fields).map(k => [k, 0]));
    let sys = 0, user = 0, noPrevT = 0, withRef = 0;
    sent.forEach((m, k) => {
        for (const [f, fn] of Object.entries(fields)) sum[f] += fn(m);
        const p = buildUnitPrompt({ sentences: m.sentences, context: m.context, placeholders: m.placeholders, wantTerms: m.wantTerms });
        sys += p.sys.length; user += p.user.length;
        if (m.context.prevSource && !m.context.prevTranslation) noPrevT++;
        if (m.context.refSource) withRef++;
        if (args.includes("--show")) console.log(`\n=== request ${k + 1} ===\n${p.user}`);
    });
    const n = sent.length;
    // ~4 characters a token for English, ~2.5 for Vietnamese with diacritics: a rough guide only
    console.log(`${env.__groups} groups -> ${n} translation requests, ${noPrevT} with a previous window but no previous translation, ${withRef} with a far antecedent`);
    console.log("average characters per request:");
    for (const [f, v] of Object.entries(sum)) console.log(`  ${f.padEnd(16)} ${Math.round(v / n)}`);
    console.log(`  ${"system prompt".padEnd(16)} ${Math.round(sys / n)}\n  ${"user prompt".padEnd(16)} ${Math.round(user / n)}`);
    console.log(`total input characters for the lecture: ${sys + user}`);
})();
