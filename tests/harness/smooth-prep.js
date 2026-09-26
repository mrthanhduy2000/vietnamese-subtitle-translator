// Prepares tests/harness/smooth.html: plans the first `SEC` seconds of the fixture lecture with the
// real VieNeu provider, has the local VieNeu server read every plan, runs the same processing as
// background.js (shapePauses, gateNoise, prepareSpeech) and writes one wav per plan plus a
// manifest. Needs the server (127.0.0.1:8000) and, from Claude's sandbox, loopback allowed.
//   node tests/harness/smooth-prep.js [voice] [seconds]
const fs = require("fs");
const path = require("path");
const A = require("../../dub-audio.js");
const COST = require("../../cost-policy.js");
const E = require("../../dub-engine.js");
const { lectureGroups } = require("../dub-sim.js");

const VOICE = process.argv[2] || "Thục Đoan";
const SEC = Number(process.argv[3]) || 150;
const OUT = path.join(__dirname, "smooth");
const L = COST.LOCAL_TTS;

(async () => {
    const groups = lectureGroups().filter(g => g.start < SEC);
    const prov = E.createVieneuProvider({ sendMessage: async () => ({ running: true }) }, { localVoice: VOICE });
    const video = { currentTime: 0, playbackRate: 1, paused: true, addEventListener() {}, removeEventListener() {} };
    const eng = new E.DubEngine({ video, getGroups: () => groups, providers: { primary: prov }, now: () => 0, setInterval: () => 0, clearInterval() {} }, {});
    eng.provider = prov;
    eng.headAt = 0;                     // as DubEngine.start() does when playback starts at 0
    eng.refresh(true);
    const manifest = { voice: VOICE, groups, plans: [] };
    for (const p of eng.plans) {
        const text = E.plainScript(p);
        const res = await fetch(L.url + "/v1/audio/speech", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: L.model, voice: VOICE, input: text, response_format: "pcm", sample_rate: L.sampleRate, temperature: L.temperature }) });
        const raw = A.pcm16leToFloat(new Uint8Array(await res.arrayBuffer()));
        let x = A.shapePauses(raw, L.sampleRate, text, { maxPause: L.maxPause }).samples;
        x = A.prepareSpeech(A.gateNoise(x, L.sampleRate), L.sampleRate);
        const file = `${p.id}.wav`;
        fs.writeFileSync(path.join(OUT, file), A.encodeWav(x, L.sampleRate));
        manifest.plans.push({ id: p.id, text, file, duration: x.length / L.sampleRate });
        process.stdout.write(".");
    }
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest));
    console.log(`\n${manifest.plans.length} plans, ${VOICE}`);
})();
