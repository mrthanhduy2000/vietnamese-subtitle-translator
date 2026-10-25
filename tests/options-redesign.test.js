const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("cost tab draws a daily bar chart from the saved per-day history only", () => {
    const js = R("options.js");
    assert.ok(js.includes("const dailyCostChart = (points, today)"), "chart helper exists");
    assert.ok(/r\.history\[k\]\.trUsd[\s\S]{0,80}r\.history\[k\]\.ttsUsd/.test(js), "bar height reads the stored per-day costs");
    assert.ok(js.includes('role="img"') && js.includes("aria-label="), "chart has an accessible name");
});

test("options chart styles use theme variables, not hard-coded colours", () => {
    const html = R("options.html");
    const block = html.slice(html.indexOf(".cost-chart {"), html.indexOf(".cost-bar-label {") + 60);
    assert.ok(block.includes("var(--primary)") && block.includes("var(--text-sub)"));
    assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(block), "no hex colours in chart styles");
});

test("VieNeu status shows one short line, not the rhythm paragraph", () => {
    const js = R("options.js");
    assert.ok(js.includes("Miễn phí, chạy trên máy này, lời thoại không gửi ra ngoài."));
    assert.ok(!js.includes("Nhịp nói tự đều theo từng giọng"), "long technical paragraph removed");
});
