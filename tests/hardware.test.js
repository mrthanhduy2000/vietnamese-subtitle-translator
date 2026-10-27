// Weak machines: the free voice runs on the viewer's own CPU, so a slow machine is told how slow the
// video may play for the voice to keep up (dub-hardware.js), and the Mac installer reads the chip right.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const HW = require("../dub-hardware.js");

test("machine tier: few cores or little memory is weak, an Intel Mac is weak, Apple chips are strong, unknown is standard", () => {
    assert.equal(HW.machineTier({ cores: 4, memoryGb: 8, arch: "x86", os: "windows" }), "weak");
    assert.equal(HW.machineTier({ cores: 8, memoryGb: 4, os: "windows" }), "weak");
    assert.equal(HW.machineTier({ cores: 12, memoryGb: 8, arch: "x86", os: "mac" }), "weak", "Intel Mac");
    assert.equal(HW.machineTier({ cores: 8, memoryGb: 8, arch: "arm", os: "mac" }), "strong");
    assert.equal(HW.machineTier({ cores: 8, memoryGb: 8, arch: "x86", os: "windows" }), "strong");
    assert.equal(HW.machineTier({ cores: 6, memoryGb: 8, arch: "x86", os: "windows" }), "standard");
    assert.equal(HW.machineTier({}), "standard", "nothing known is not weak");
    assert.equal(HW.machineTier(null), "standard");
});

test("a measured rtf is classified ok, tight or behind; nothing measured is null", () => {
    assert.equal(HW.classifyRtf(0.25), "ok");
    assert.equal(HW.classifyRtf(0.6), "tight");
    assert.equal(HW.classifyRtf(0.79), "tight");
    assert.equal(HW.classifyRtf(0.8), "behind");
    assert.equal(HW.classifyRtf(0), null);
    assert.equal(HW.classifyRtf(undefined), null);
});

test("sustainable rate follows 0.8 / rtf in steps of 0.05, never above 1 or below YouTube's 0.25", () => {
    assert.equal(HW.sustainableRate(0.5), null);
    assert.equal(HW.sustainableRate(0.79), null);
    assert.equal(HW.sustainableRate(0.8), 1);
    assert.equal(HW.sustainableRate(0.9), 0.85);
    assert.equal(HW.sustainableRate(1.0), 0.8);
    assert.equal(HW.sustainableRate(1.3), 0.6);
    assert.equal(HW.sustainableRate(1.8), 0.4);
    assert.equal(HW.sustainableRate(10), 0.25);
});

test("slow advice: silent when the voice keeps up, a speed to set when it does not, a way out when no speed helps", () => {
    assert.equal(HW.slowAdvice({ rtf: 0.4 }), null);
    assert.equal(HW.slowAdvice({ rtf: 0.7 }), null);
    assert.equal(HW.slowAdvice({ rtf: 0.8, playbackRate: 1 }).rate, null, "just behind: warn, but 1x is still the advice");
    const a = HW.slowAdvice({ rtf: 1.3, playbackRate: 1 });
    assert.equal(a.rate, 0.6);
    assert.match(a.text, /1,30 giây/);
    assert.match(a.text, /0,6×/);
    const already = HW.slowAdvice({ rtf: 1.3, playbackRate: 0.5 });
    assert.equal(already.rate, null, "already slower than the advice: no second nag to slow down");
    const severe = HW.slowAdvice({ rtf: 2.5, playbackRate: 1 });
    assert.equal(severe.rate, null);
    assert.equal(severe.level, "severe");
    assert.match(severe.text, /Gemini|phụ đề/);
});

test("readMachine tells an Intel Mac from an Apple chip through the high-entropy hint", async () => {
    const nav = arch => ({ hardwareConcurrency: 8, deviceMemory: 8, platform: "MacIntel", userAgentData: { platform: "macOS", getHighEntropyValues: async () => ({ architecture: arch }) } });
    assert.deepEqual(await HW.readMachine(nav("x86")), { cores: 8, memoryGb: 8, arch: "x86", os: "mac" });
    assert.equal((await HW.readMachine(nav("arm"))).arch, "arm");
    const blocked = { hardwareConcurrency: 4, platform: "Win32", userAgentData: { platform: "Windows", getHighEntropyValues: async () => { throw new Error("no"); } } };
    assert.deepEqual(await HW.readMachine(blocked), { cores: 4, memoryGb: 0, arch: "", os: "windows" });
    assert.equal(HW.describeMachine({ os: "mac", arch: "x86", cores: 4 }), "Mac, chip Intel, 4 nhân");
});

test("the premise of the advice: at rtf 1.3 a video near the advised speed drops far fewer lines than at normal speed", async () => {
    const { run } = require("../tools/playback-sim.js");
    const eng = require("../dub-engine.js");
    const go = (rate, settings) => run(eng, { wall: 240, minutes: 6, rate, rtf: () => 1.3, bgAbort: "queued", settings });
    const advisedRate = 0.75;           // the advice (0.6) plus the margin the sim showed is already enough
    const normal = await go(1), advised = await go(advisedRate);
    assert.ok(normal.dropped >= 5, `rate 1 drops ${normal.dropped}`);
    assert.ok(advised.dropped <= 2, `rate ${advisedRate} drops ${advised.dropped}`);
});

test("dub-hardware.js ships: loaded before the engine's page code and on the Settings page", () => {
    const m = JSON.parse(R("manifest.json"));
    const js = m.content_scripts.find(g => (g.js || []).includes("dubbing.js")).js;
    assert.ok(js.indexOf("dub-hardware.js") > -1 && js.indexOf("dub-hardware.js") < js.indexOf("dubbing.js"));
    assert.match(R("options.html"), /<script src="dub-hardware\.js"><\/script>/);
    assert.match(R("dubbing.js"), /CST_HW/);
    assert.match(R("options.js"), /CST_HW/);
});

test("the Mac installer reads the chip, not the shell: Rosetta on an Apple chip is not an Intel Mac, and an Intel Mac may try the voice", () => {
    const mac = R("tools/share/install-mac.sh");
    assert.match(mac, /hw\.optional\.arm64/);
    assert.match(mac, /DPD_INTEL_VOICE/);
    assert.match(mac, /Rosetta/);
    assert.match(R(".github/workflows/intel-voice.yml"), /macos-15-intel/);
    assert.match(R(".github/workflows/intel-voice.yml"), /DPD_INTEL_VOICE: "1"/);
});


test("slow advice needs enough measured takes and never infers weak hardware from latency", () => {
    assert.equal(HW.slowAdvice({ rtf: 3, samples: 1 }), null);
    assert.equal(HW.slowAdvice({ rtf: 3, samples: 3 }), null);
    const advice = HW.slowAdvice({ rtf: 3, samples: 4 });
    assert.ok(advice);
    assert.doesNotMatch(advice.text, /máy.*yếu/i);
});
