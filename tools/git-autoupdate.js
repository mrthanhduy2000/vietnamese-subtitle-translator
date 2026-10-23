#!/usr/bin/env node
// Keeps a git checkout that Chrome loads unpacked (the author's Mac) on the newest main.
// Friends' installs have tools/dichphude-update.py; this is the same idea for the private repo:
//   node tools/git-autoupdate.js             one check: fast-forward to origin/main when it is safe
//   node tools/git-autoupdate.js --install   macOS: run it at login and every 30 min (LaunchAgent)
//   node tools/git-autoupdate.js --uninstall remove that LaunchAgent
// "Safe" means: on branch main, nothing uncommitted, local history is an ancestor of origin/main
// (never a merge, never a force), and Chrome is not running. Chrome reads an unpacked extension
// from disk when it starts, so the next start runs the new version with no Reload; a running
// Chrome would mix old and new files. Settings and the API key are untouched (the folder keeps its path).
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const LABEL = "com.damduy.dichphude.gitupdate";
const PLIST = path.join(os.homedir(), "Library", "LaunchAgents", LABEL + ".plist");
const LOG = path.join(os.homedir(), "Library", "Logs", "dichphude-gitupdate.log");
const BROWSERS = ["Google Chrome", "Chromium", "Microsoft Edge", "Brave Browser", "Arc", "Vivaldi", "Opera", "Coc Coc"];

function chromeRunning(exec = execFileSync) {
    try {
        const ps = String(exec("ps", ["-axo", "comm="], { encoding: "utf8" }));
        return BROWSERS.some(b => ps.includes(`/${b}.app/`) || ps.split("\n").some(l => l.trim() === b));
    } catch {
        return true;                       // cannot tell: do not touch the files
    }
}

// Returns {status, detail}. exec, running and log are for tests.
function update({ root = ROOT, exec = execFileSync, running = () => chromeRunning(exec), log = () => { } } = {}) {
    const git = (...a) => String(exec("git", ["-C", root, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })).trim();
    const done = (status, detail = "") => { log(`${status} ${detail}`.trim()); return { status, detail }; };
    try {
        if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main") return done("skip", "not on main");
        if (git("status", "--porcelain")) return done("skip", "uncommitted changes");
        git("fetch", "-q", "origin", "main");
        const head = git("rev-parse", "HEAD"), remote = git("rev-parse", "origin/main");
        if (head === remote) return done("current", head.slice(0, 7));
        try { git("merge-base", "--is-ancestor", head, remote); } catch { return done("skip", "local main is ahead or diverged"); }
        if (running()) return done("wait", "a browser holds the extension; next run after it quits");
        git("merge", "--ff-only", "origin/main");
        return done("updated", `${head.slice(0, 7)} -> ${remote.slice(0, 7)}`);
    } catch (e) {
        return done("error", String(e.stderr || e.message).trim().split("\n")[0]);
    }
}

const plist = () => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${LABEL}</string>
<key>ProgramArguments</key><array><string>${process.execPath}</string><string>${path.join(ROOT, "tools", "git-autoupdate.js")}</string></array>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin</string></dict>
<key>RunAtLoad</key><true/>
<key>StartInterval</key><integer>1800</integer>
<key>StandardErrorPath</key><string>${LOG}</string>
</dict></plist>
`;

function logLine(msg) {
    const line = new Date().toISOString() + " " + msg;
    try {
        fs.mkdirSync(path.dirname(LOG), { recursive: true });
        const old = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean).slice(-199) : [];
        fs.writeFileSync(LOG, old.concat(line).join("\n") + "\n");
    } catch { }
    console.log(line);
}

module.exports = { update, chromeRunning, plist, BROWSERS };

if (require.main === module) {
    const arg = process.argv[2];
    if (arg === "--install") {
        if (process.platform !== "darwin") { console.error("--install is for macOS"); process.exit(1); }
        fs.mkdirSync(path.dirname(PLIST), { recursive: true });
        fs.writeFileSync(PLIST, plist());
        try { execFileSync("launchctl", ["unload", PLIST], { stdio: "ignore" }); } catch { }
        execFileSync("launchctl", ["load", PLIST], { stdio: "inherit" });
        console.log(`Installed ${PLIST}; log: ${LOG}`);
    } else if (arg === "--uninstall") {
        try { execFileSync("launchctl", ["unload", PLIST], { stdio: "ignore" }); } catch { }
        fs.rmSync(PLIST, { force: true });
        console.log("Removed " + PLIST);
    } else {
        update({ log: logLine });
    }
}
