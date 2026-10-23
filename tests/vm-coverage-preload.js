// Coverage only: name the repo's own source files when tests run them through vm, so that Node's
// built-in coverage can attribute lines to content.js, youtube.js, background.js and the rest.
// Load with: node --require ./tests/vm-coverage-preload.js --test --experimental-test-coverage ...
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const root = path.join(__dirname, "..");
const known = new Map();
for (const f of fs.readdirSync(root)) {
    if (!/\.js$/.test(f) || f === "glossary-data.js") continue;
    known.set(fs.readFileSync(path.join(root, f), "utf8"), pathToFileURL(path.join(root, f)).href);
}

const named = (code, opts) => {
    const url = typeof code === "string" ? known.get(code) : null;
    if (!url) return opts;
    if (typeof opts === "string") return { filename: url };
    return { ...(opts || {}), filename: (opts && opts.filename) || url };
};

for (const fn of ["runInContext", "runInNewContext", "runInThisContext"]) {
    const orig = vm[fn];
    vm[fn] = function (code, a, b) {
        if (fn === "runInThisContext") return orig.call(this, code, named(code, a));
        return orig.call(this, code, a, named(code, b));
    };
}
const OrigScript = vm.Script;
vm.Script = class extends OrigScript {
    constructor(code, opts) { super(code, named(code, opts)); }
};
