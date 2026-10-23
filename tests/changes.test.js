const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseNote, readNotes, buildEntry, renderEntry } = require("../tools/release-changes.js");

test("change note: parses title and wrapped bullets", () => {
    const n = parseNote("# Tên bản mới\n- Một việc\n  tiếp dòng\n- Việc hai\n", "x.md");
    assert.equal(n.ten, "Tên bản mới");
    assert.deepEqual(n.y, ["Một việc tiếp dòng", "Việc hai"]);
});

test("change note: rejects a note without title or bullets", () => {
    assert.throws(() => parseNote("- only bullet", "a.md"), /title/);
    assert.throws(() => parseNote("# Title only", "b.md"), /bullets/);
});

test("change notes: README is skipped and entry merges all bullets", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chg-"));
    fs.writeFileSync(path.join(dir, "README.md"), "# readme\n- skip");
    fs.writeFileSync(path.join(dir, "b.md"), "# Bản B\n- b1");
    fs.writeFileSync(path.join(dir, "a.md"), "# Bản A\n- a1\n- a2");
    const notes = readNotes(dir);
    assert.deepEqual(notes.map(n => n.file), ["a.md", "b.md"]);
    const e = buildEntry(notes, "9.9.9", "01/01/2027");
    assert.equal(e.ten, "Bản A và 1 cải tiến khác");
    assert.deepEqual(e.y, ["a1", "a2", "b1"]);
    assert.match(renderEntry(e), /v: "9\.9\.9", luc: "01\/01\/2027"/);
});

test("change notes: every committed note in docs/changes parses", () => {
    assert.doesNotThrow(() => readNotes());
});
