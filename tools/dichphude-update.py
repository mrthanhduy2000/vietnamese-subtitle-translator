# Background updater for a friend's install (put in place by install-mac.sh / install-windows.ps1 as
# <VieNeu>/dichphude-update.py, run with VieNeu's own Python: every 30 min by a LaunchAgent on macOS,
# by the run-vieneu.pyw supervisor on Windows).
#
# Every 6 hours it asks GitHub for the version; a newer one is downloaded into <VieNeu>/.dpd-staged.
# The staged copy goes over the extension folder only while Chrome is NOT running (at sign-in, or
# after the user quits Chrome): Chrome reads an unpacked extension from disk when it starts, so the
# next start runs the new version, and a running Chrome never mixes old and new files (a service
# worker, a content script and the options page from two versions at once). Not
# chrome.runtime.reload(): it does work while developer mode is ON (headless branded Chrome, a
# throwaway profile, 2 of 2 runs on 2026-10-11: still enabled, storage intact), but with developer
# mode OFF a reload brings the unpacked extension back DISABLED (unsupportedDeveloperExtension), and
# the earlier "blocked" result (2026-10-08) was such a profile. A friend may switch developer mode
# off after loading the extension, and a disabled extension looks broken; the restart path needs
# neither, and it keeps the user's settings and API key.
# The extension folder keeps its path (Chrome keys settings to it); only its files change.
# Every run also keeps the pinned voice model current (<VieNeu>/models/hf, the extension's
# tools/vieneu-pin.py): a quick check (marker, every file at its pinned size, refs/main), and on any
# mismatch an install, which repairs the copy or withdraws its marker so the server starts online;
# a failed attempt is retried after 6 hours. Once the server runs offline on the checked copy, an
# install made by our installer drops the copy older versions left in ~/.cache/huggingface. On
# macOS an install from before the size-checked start line gets its server plist rewritten once
# (read at the next login), so its server reads that copy only while it is whole.
#   python dichphude-update.py          normal run
#   python dichphude-update.py --now    ask GitHub now, whatever the 6-hour gap (tests)
# DPD_REF=<commit> reads that commit of the share repo instead of main (the install test).
# Standard library only, ASCII only (the Windows helpers' rule).
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile

REPO = "mrthanhduy2000/dich-phu-de-long-tieng"
REF = os.environ.get("DPD_REF", "")
HERE = os.path.dirname(os.path.abspath(__file__))           # the VieNeu folder
STAGE = os.path.join(HERE, ".dpd-staged")
STATE = os.path.join(HERE, ".dpd-update.json")
LOG = os.path.join(HERE, "update.log")
CHECK_EVERY_S = 6 * 3600
MODEL_RETRY_S = 6 * 3600
WINDOWS = sys.platform == "win32"
NO_WINDOW = 0x08000000 if WINDOWS else 0
SERVICE_PLIST = os.path.expanduser("~/Library/LaunchAgents/com.damduy.vieneu.plist")
# What a current service plist runs: the start line that stats the files the marker lists
START_TOKEN = "pinned_ok"
OUR_MARK = ".dichphude-vieneu"              # the installer made this VieNeu folder
# Where VieNeu kept the model before the pinned copy (huggingface_hub's default cache)
OLD_CACHE = ["models--pnnbao-ump--VieNeu-TTS-v3-Turbo", "models--OpenMOSS-Team--MOSS-Audio-Tokenizer-Nano-ONNX"]


def log(msg):
    line = time.strftime("%Y-%m-%d %H:%M:%S ") + msg
    try:
        old = open(LOG, encoding="utf-8").read().splitlines()[-199:] if os.path.exists(LOG) else []
        with open(LOG, "w", encoding="utf-8") as f:
            f.write("\n".join(old + [line]) + "\n")
    except OSError:
        pass


def vtuple(v):
    return tuple(int(x) for x in str(v).split(".") if x.isdigit())


def manifest_version(folder):
    try:
        with open(os.path.join(folder, "manifest.json"), encoding="utf-8") as f:
            return json.load(f)["version"]
    except (OSError, ValueError, KeyError):
        return "0"


def ext_dir():
    with open(os.path.join(HERE, ".dichphude-ext"), encoding="utf-8-sig") as f:
        return f.read().strip()


def chrome_running():
    try:
        if WINDOWS:
            out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq chrome.exe", "/NH"], capture_output=True,
                                 text=True, creationflags=NO_WINDOW).stdout   # no console window
            return "chrome.exe" in out.lower()
        return subprocess.run(["pgrep", "-x", "Google Chrome"], capture_output=True).returncode == 0
    except OSError:
        return True                          # cannot tell: do not touch the files


def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "dichphude-update"})
    return urllib.request.urlopen(req, timeout=timeout)


def stage(remote):
    tmp = tempfile.mkdtemp(prefix="dpd-")
    try:
        zpath = os.path.join(tmp, "share.zip")
        with fetch("https://codeload.github.com/%s/zip/%s" % (REPO, REF or "refs/heads/main"), 300) as r, \
                open(zpath, "wb") as f:
            shutil.copyfileobj(r, f)
        with zipfile.ZipFile(zpath) as z:
            z.extractall(tmp)
        top = next(os.path.join(tmp, d) for d in os.listdir(tmp) if os.path.isdir(os.path.join(tmp, d)))
        got = manifest_version(os.path.join(top, "extension"))
        if vtuple(got) != vtuple(remote):
            log("zip holds %s, expected %s: GitHub still updating, next time" % (got, remote))
            return False
        shutil.rmtree(STAGE, ignore_errors=True)
        shutil.copytree(os.path.join(top, "extension"), STAGE)
        shutil.copy2(os.path.join(top, "vieneu", "openai_speech.py"), os.path.join(STAGE, ".openai_speech.py"))
        log("staged %s" % remote)
        return True
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def same(a, b):
    try:
        with open(a, "rb") as fa, open(b, "rb") as fb:
            return fa.read() == fb.read()
    except OSError:
        return False


def apply(ext):
    staged = manifest_version(STAGE)
    patch = os.path.join(STAGE, ".openai_speech.py")
    keep = set()
    for root, _dirs, files in os.walk(STAGE):
        rel = os.path.relpath(root, STAGE)
        os.makedirs(os.path.join(ext, rel), exist_ok=True)
        for name in files:
            if rel == "." and name == ".openai_speech.py":
                continue
            src, dst = os.path.join(root, name), os.path.join(ext, rel, name)
            keep.add(os.path.normcase(os.path.normpath(dst)))
            shutil.copy2(src, dst)
    for root, _dirs, files in os.walk(ext, topdown=False):
        for name in files:
            p = os.path.join(root, name)
            if os.path.normcase(os.path.normpath(p)) not in keep:
                os.remove(p)
        if root != ext and not os.listdir(root):
            os.rmdir(root)
    # VieNeu's patched server file and the Windows runner take effect at the next server start
    if os.path.exists(patch) and not same(patch, os.path.join(HERE, "apps", "openai_speech.py")):
        shutil.copy2(patch, os.path.join(HERE, "apps", "openai_speech.py"))
    runner = os.path.join(ext, "tools", "vieneu-runner.pyw")
    if WINDOWS and os.path.exists(runner) and not same(runner, os.path.join(HERE, "run-vieneu.pyw")):
        shutil.copy2(runner, os.path.join(HERE, "run-vieneu.pyw"))
    me = os.path.join(ext, "tools", "dichphude-update.py")
    if os.path.exists(me) and not same(me, os.path.abspath(__file__)):
        shutil.copy2(me, os.path.abspath(__file__))
    shutil.rmtree(STAGE, ignore_errors=True)
    log("applied %s (Chrome was closed; its next start runs it)" % staged)


def save_state(state):
    with open(STATE, "w", encoding="utf-8") as f:
        json.dump(state, f)


def pin_tool(ext):
    # The extension's own tools/vieneu-pin.py, which always matches the vieneu-model.json beside it
    path = os.path.join(ext, "tools", "vieneu-pin.py")
    if not os.path.exists(path):
        return None, path                         # an extension from before the pinned model
    spec = importlib.util.spec_from_file_location("dpd_vieneu_pin", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod, path


def ensure_model(ext, state):
    tool, path = pin_tool(ext)
    pin_file = tool and tool.find_pin()
    if not pin_file:
        return
    pin = tool.load_pin(pin_file)
    hf = os.path.join(HERE, "models", "hf")
    if tool.quick_ok(pin, hf):
        drop_old_cache()                          # the usual case: stat only, nothing logged
        return
    want = tool.pin_id(pin)
    if state.get("model_pin") == want and time.time() - state.get("model_tried", 0) < MODEL_RETRY_S:
        return                                    # this pin failed lately: wait before the next try
    state["model_pin"], state["model_tried"] = want, time.time()
    save_state(state)
    log("model: the pinned copy is damaged (a file missing or cut short): repairing it"
        if tool.marker_current(pin, hf) else "model: installing the pinned voice model")
    r = subprocess.run([sys.executable, path, "--install", "--vieneu", HERE], cwd=HERE, capture_output=True,
                       text=True, encoding="utf-8", errors="replace", timeout=3 * 3600, creationflags=NO_WINDOW)
    lines = [l.strip() for l in r.stdout.splitlines() if l.strip()]
    keep = [l for l in lines if l.startswith("LOI")][-2:] + lines[-1:]     # errors, then the summary
    log("model: exit %d: %s" % (r.returncode, " | ".join(keep)))
    if r.returncode in (0, 2):                    # done, or another install holds it: no 6-hour wait
        state["model_tried"] = 0
        save_state(state)


def server_model_line():
    # The last "VieNeu model:" line the start scripts wrote: how the running server was started
    last = None
    try:
        with open(os.path.join(HERE, "server.log"), encoding="utf-8", errors="replace") as f:
            for line in f:
                if line.startswith("VieNeu model:"):
                    last = line.strip()
    except OSError:
        return None
    return last


def dir_size(path):
    n = 0
    for root, _dirs, files in os.walk(path):
        for name in files:
            try:
                n += os.path.getsize(os.path.join(root, name))
            except OSError:
                pass
    return n


def drop_old_cache():
    # Installs from before the pinned model kept it in ~/.cache/huggingface (600 MB). Called only
    # once the quick check passed; removed only on a VieNeu folder our installer made (the author's
    # machine has no such mark) and only while the server runs offline on the checked copy.
    if not os.path.isfile(os.path.join(HERE, OUR_MARK)):
        return
    hub = os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub")
    old = [os.path.join(hub, n) for n in OLD_CACHE if os.path.isdir(os.path.join(hub, n))]
    if not old:
        return
    line = server_model_line()
    if not line or "offline" not in line:
        return
    size = sum(dir_size(d) for d in old)
    for d in old:
        shutil.rmtree(d, ignore_errors=True)
    gone = [os.path.basename(d) for d in old if not os.path.exists(d)]
    if gone:
        log("model: removed the copy older versions left in ~/.cache/huggingface (%s, %.0f MB): "
            "the server reads models/hf offline" % (", ".join(gone), size / 1e6))


def refresh_mac_service(ext):
    # A macOS install from before the size-checked start line (python straight from its plist, or
    # the first marker-only line) would read a pinned copy that lost a file and crash in a loop.
    # Rewrite that plist once with the current start command; --write-only leaves the running server
    # alone (launchd reads it at the next login). Only our own service, and only with a helper that
    # knows --write-only: an older helper would ignore the flag and restart the server at every run.
    if sys.platform != "darwin":
        return
    try:
        with open(SERVICE_PLIST, encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return
    if os.path.join(HERE, ".venv/bin/python") not in text or START_TOKEN in text:
        return
    helper = os.path.join(ext, "tools", "vieneu-autostart.command")
    try:
        with open(helper, encoding="utf-8") as f:
            if "--write-only" not in f.read():
                return
    except OSError:
        return
    r = subprocess.run(["/bin/zsh", helper, "--write-only"], env=dict(os.environ, VIENEU_DIR=HERE),
                       capture_output=True, text=True, timeout=60)
    log("service: plist rewritten for the pinned model, used from the next login" if r.returncode == 0
        else "service: plist rewrite failed (%d): %s" % (r.returncode, (r.stdout + r.stderr).strip()[-200:]))


def load_state():
    try:
        with open(STATE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def main():
    now = "--now" in sys.argv
    ext = ext_dir()
    local = manifest_version(ext)
    state = load_state()
    if now or time.time() - state.get("checked", 0) > CHECK_EVERY_S:
        with fetch("https://raw.githubusercontent.com/%s/%s/extension/manifest.json" % (REPO, REF or "main"), 30) as r:
            remote = json.load(r)["version"]
        state["checked"] = time.time()
        save_state(state)
        best = max(vtuple(local), vtuple(manifest_version(STAGE)))
        if vtuple(remote) > best:
            stage(remote)
    if os.path.isdir(STAGE):
        if vtuple(manifest_version(STAGE)) <= vtuple(local):
            shutil.rmtree(STAGE, ignore_errors=True)
        elif chrome_running():
            pass                                  # wait for Chrome to close
        else:
            apply(ext)


def keep_model_current():
    # After main(), so a version just applied that moves the pin acts on it in the same run, and
    # apart from it, so a failed version check (GitHub down) does not skip it
    try:
        ext = ext_dir()
    except OSError:
        return
    try:
        ensure_model(ext, load_state())
    except Exception as e:
        log("model: %s: %s" % (type(e).__name__, e))
    try:
        refresh_mac_service(ext)
    except Exception as e:
        log("service: %s: %s" % (type(e).__name__, e))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:                        # offline, GitHub down: try again next run
        log("error: %s: %s" % (type(e).__name__, e))
    keep_model_current()
