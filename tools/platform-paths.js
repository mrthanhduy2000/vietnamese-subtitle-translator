// Where things live on each OS, for the maintainer tools (review, ext-storage, the pronunciation
// evals). Not shipped to friends. Every default can be overridden: VIENEU_PY for the interpreter,
// --dir= for the extension store, CHROME_USER_DATA for the browser profile folder.
const os = require("node:os");
const path = require("node:path");

const EXT_ID = "lpknjhmnlocilmkmooomffknibghibao";
const PROFILE = "Profile 42";

function chromeUserData(platform = process.platform, env = process.env, home = os.homedir()) {
    if (env.CHROME_USER_DATA) return env.CHROME_USER_DATA;
    if (platform === "win32") return path.win32.join(env.LOCALAPPDATA || path.win32.join(home, "AppData", "Local"), "Google", "Chrome", "User Data");
    if (platform === "darwin") return path.posix.join(home, "Library", "Application Support", "Google", "Chrome");
    return path.posix.join(env.XDG_CONFIG_HOME || path.posix.join(home, ".config"), "google-chrome");
}

function extensionStore(platform = process.platform, env = process.env, home = os.homedir()) {
    const j = platform === "win32" ? path.win32.join : path.posix.join;
    return j(chromeUserData(platform, env, home), PROFILE, "Local Extension Settings", EXT_ID);
}

// The VieNeu venv's interpreter: Scripts\python.exe on Windows, bin/python elsewhere.
function vieneuPython(platform = process.platform, env = process.env, home = os.homedir()) {
    if (env.VIENEU_PY) return env.VIENEU_PY;
    const dir = env.VIENEU_DIR || (platform === "win32" ? path.win32.join(home, "VieNeu-TTS") : path.posix.join(home, "VieNeu-TTS"));
    return platform === "win32" ? path.win32.join(dir, ".venv", "Scripts", "python.exe") : path.posix.join(dir, ".venv", "bin", "python");
}

// A scratch folder that exists on every OS ($TMPDIR is unset on Windows)
const tmpRoot = (env = process.env) => env.TMPDIR || env.TEMP || os.tmpdir();

module.exports = { extensionStore, chromeUserData, vieneuPython, tmpRoot, EXT_ID, PROFILE };
