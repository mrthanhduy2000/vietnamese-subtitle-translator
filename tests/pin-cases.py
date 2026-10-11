# Scenarios for tests/share.test.js: tools/vieneu-pin.py and tools/dichphude-update.py driven
# in-process, the network replaced by a scripted fake urlopen (or a stub huggingface_hub), sleeps
# recorded instead of slept. Offline, standard library only, Python 3.9+.
#   python3 tests/pin-cases.py <case> <workdir>      prints one JSON object
# The updater cases need HOME pointed at a throwaway folder by the caller (SERVICE_PLIST and the
# old ~/.cache path are read from it).
import email.message
import hashlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error

sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


pin = load("vieneu_pin", os.path.join(TOOLS, "vieneu-pin.py"))
REAL_TIME = time.time

BODY = bytes(range(256)) * 400                          # 102400 bytes
F = {"path": "w.data", "size": len(BODY), "sha256": hashlib.sha256(BODY).hexdigest()}
URL = "https://example.invalid/w.data"


class NoLock(object):
    def touch(self):
        pass


class Resp(object):
    """What urlopen returns: data in blocks, optionally cut (a reset connection) after `cut` bytes."""

    def __init__(self, data, code=200, length=True, cut=None):
        self.data, self.code, self.cut, self.pos = data, code, cut, 0
        self.headers = email.message.Message()
        if length:
            self.headers["Content-Length"] = str(len(data))

    def getcode(self):
        return self.code

    def read(self, n):
        if self.cut is not None and self.pos >= self.cut:
            raise ConnectionResetError("cut")
        end = len(self.data) if self.cut is None else min(len(self.data), self.cut)
        block = self.data[self.pos:min(self.pos + 4096, end)]
        self.pos += len(block)
        return block

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def http_error(code, retry_after=None):
    h = email.message.Message()
    if retry_after is not None:
        h["Retry-After"] = str(retry_after)
    return urllib.error.HTTPError(URL, code, "x", h, io.BytesIO(b""))


class Net(object):
    """Scripted server: each call pops the next step, a function of the Range start (or None)."""

    def __init__(self, steps):
        self.steps, self.ranges = list(steps), []

    def __call__(self, req):
        rng = req.get_header("Range")
        self.ranges.append(rng)
        start = int(rng[len("bytes="):-1]) if rng else None
        step = self.steps.pop(0) if len(self.steps) > 1 else self.steps[0]
        return step(start)


def ranged(cut_by=None, body=BODY):
    # Honours Range (206 with the rest), optionally sending only cut_by more bytes
    def step(start):
        s = start or 0
        rest = body[s:]
        return Resp(rest, 206 if start else 200, cut=cut_by)
    return step


def fail(exc):
    def step(start):
        raise exc
    return step


def run_fetch(steps, part_bytes=None, name="GitHub", use_hf=True, clock=None):
    d = WORK
    dest = os.path.join(d, "w.data")
    part = dest + ".part"
    for p in (dest, part, part + ".new"):
        if os.path.exists(p):
            os.remove(p)
    if part_bytes is not None:
        with open(part, "wb") as f:
            f.write(part_bytes)
    net = Net(steps)
    sleeps = []
    pin.urlopen = net
    pin.time.sleep = sleeps.append
    if clock:
        pin.time.time = clock
    out = io.StringIO()
    real = sys.stdout
    sys.stdout = out
    dead = set()
    try:
        ok = pin.fetch_one(name, URL, part, dest, F, NoLock(), dead, use_hf)
    finally:
        sys.stdout = real
        pin.time.time = REAL_TIME
    landed = open(dest, "rb").read() if os.path.exists(dest) else None
    left = open(part, "rb").read() if os.path.exists(part) else None
    return {"ok": ok, "calls": len(net.ranges), "ranges": net.ranges, "sleeps": sleeps, "dead": sorted(dead),
            "said": out.getvalue(), "landed_good": landed == BODY, "landed": landed is not None,
            "part_len": None if left is None else len(left), "part_prefix_good": left is not None and BODY.startswith(left),
            "new_left": os.path.exists(part + ".new")}


# ---- cases ----

def case_stalls():
    # A line that drops every 20 KB: 5 cuts in a row, each one with progress, then the rest
    cut = [ranged(cut_by=20000)] * 5 + [ranged()]
    progress = run_fetch(cut)
    # A source that never sends a byte: given up after TRIES attempts, marked dead
    silent = run_fetch([fail(urllib.error.URLError(OSError("unreachable")))])
    # Progress every attempt, but each one takes 50 minutes: the 2-hour cap ends it, not dead
    t = [1000.0]

    def clock():
        t[0] += 50 * 60
        return t[0]
    slow = run_fetch([ranged(cut_by=1000)], clock=clock)
    return {"progress": progress, "silent": silent, "slow": slow, "tries": pin.TRIES}


def case_corrupt_prefix():
    bad = bytearray(BODY[:50000])
    bad[1234] ^= 0xFF
    resumed = run_fetch([ranged()], part_bytes=bytes(bad))
    # A 200 that ignores the Range header and sends wrong bytes: the good partial stays untouched
    good_part = BODY[:50000]
    corrupt = bytearray(BODY)
    corrupt[90000] ^= 0xFF

    def ignore_range_bad(start):
        return Resp(bytes(corrupt), 200)
    ignored_bad = run_fetch([ignore_range_bad], part_bytes=good_part)

    def ignore_range_good(start):
        return Resp(BODY, 200)
    ignored_good = run_fetch([ignore_range_good], part_bytes=good_part)
    # The same 200 cut short: the unproven bytes never replace the partial file
    ignored_cut = run_fetch([lambda s: Resp(BODY, 200, cut=80000), fail(urllib.error.HTTPError(URL, 404, "x", email.message.Message(), io.BytesIO(b"")))],
                            part_bytes=good_part)
    return {"resumed": resumed, "ignored_bad": ignored_bad, "ignored_good": ignored_good, "ignored_cut": ignored_cut}


def case_full_part():
    # A full-size .part with one wrong byte: never moved into place, from either source state
    bad = bytearray(BODY)
    bad[777] ^= 0x01
    refetched = run_fetch([ranged()], part_bytes=bytes(bad))
    nowhere = run_fetch([fail(http_error(404))], part_bytes=bytes(bad))
    return {"refetched": refetched, "nowhere": nowhere}


def case_http():
    gh404 = run_fetch([fail(http_error(404))])
    gh410 = run_fetch([fail(http_error(410))])
    gh403 = run_fetch([fail(http_error(403))])
    proxy = run_fetch([fail(http_error(407))])
    busy = run_fetch([fail(http_error(503, 7)), ranged()])
    capped = run_fetch([fail(http_error(429, 120)), ranged()])
    dated = run_fetch([fail(http_error(503, "Wed, 21 Oct 2015 07:28:00 GMT")), ranged()])
    down = run_fetch([fail(http_error(500))])
    timeout = run_fetch([fail(http_error(408)), ranged()])
    odd = run_fetch([fail(http_error(400))])
    return {k: v for k, v in locals().items()}


def case_sources():
    r = {"repo": "org/Model-A", "revision": "a" * 40}
    f = {"path": "onnx dir/w.data", "asset": "Model-A__onnx dir__w.data"}
    return {"both": pin.sources(r, f, "https://github.com/x/y/releases/download/t/", True),
            "derived": pin.sources(r, {"path": "c.json"}, "file:///m", False)}


def case_lock():
    hf = os.path.join(WORK, "hf")
    os.makedirs(hf, exist_ok=True)
    path = os.path.join(hf, pin.LOCK)
    res = {}
    # 1. A stale lock (a killed run): taken over
    with open(path, "w") as f:
        f.write("1")
    old = time.time() - pin.LOCK_STALE_S - 60
    os.utime(path, (old, old))
    a = pin.Lock(hf)
    res["stale_taken"] = a.take()
    a.release()
    # 2. The race: B looked while the lock was stale, but A took it over before B acts. B must lose
    # and leave A's fresh lock where it is.
    with open(path, "w") as f:
        f.write("A")
    real = pin.os.path.getmtime
    seen = []

    def getmtime(p):
        if p == path and not seen:
            seen.append(p)
            return old                           # B's look, from before A's takeover
        return real(p)
    pin.os.path.getmtime = getmtime
    try:
        res["b_took"] = pin.Lock(hf).take()
    finally:
        pin.os.path.getmtime = real
    res["a_lock_kept"] = open(path).read() if os.path.exists(path) else None
    res["leftovers"] = sorted(n for n in os.listdir(hf) if n != pin.LOCK)
    # 3. Two runs find the same stale lock; the first moves it away, the second finds it gone
    os.remove(path)
    with open(path, "w") as f:
        f.write("dead")
    os.utime(path, (old, old))
    real_replace = pin.os.replace

    def replace_lost(src, dst):
        if src == path:
            raise FileNotFoundError(src)         # the other run moved it a moment earlier
        return real_replace(src, dst)
    pin.os.replace = replace_lost
    try:
        res["loser_took"] = pin.Lock(hf).take()
    finally:
        pin.os.replace = real_replace
    # 4. A live lock (another install running): install() stops with exit 2
    os.utime(path, None)
    res["exit_when_held"] = pin.install({"repos": []}, hf, WORK, None, False, False)
    return res


def fake_pin(commit="c" * 40, rev_a="a" * 40):
    return {"release": {"repo": "x/y", "tag": "t"},
            "repos": [{"repo": "org/Model-A", "revision": rev_a,
                       "files": [{"path": "w.data", "size": F["size"], "sha256": F["sha256"]}]}],
            "voices": {"commit": commit, "path": "v.json", "size": 1, "sha256": "0" * 64}}


def case_marker():
    hf = os.path.join(WORK, "hf")
    os.makedirs(hf, exist_ok=True)
    marker = os.path.join(hf, pin.MARKER)
    p1, p2 = fake_pin("c" * 40), fake_pin("d" * 40)
    res = {"differs": pin.pin_id(p1) != pin.pin_id(p2), "names_commit": ("voices " + "c" * 40) in pin.pin_id(p1)}
    out = io.StringIO()
    real = sys.stdout
    sys.stdout = out
    try:
        # A marker written for VieNeu commit c, while the pin being installed is on commit d
        with open(marker, "w") as f:
            f.write(pin.marker_text(p1))
        pin._failed(p2, hf)
        res["other_code_removed"] = not os.path.exists(marker)
        # A marker for an older model on the same VieNeu commit stays (refs/main still names it)
        with open(marker, "w") as f:
            f.write(pin.marker_text(fake_pin("d" * 40, "e" * 40)))
        pin._failed(p2, hf)
        res["same_code_kept"] = os.path.exists(marker)
        # And the lying marker of this very pin goes
        with open(marker, "w") as f:
            f.write(pin.marker_text(p2))
        pin._failed(p2, hf)
        res["own_removed"] = not os.path.exists(marker)
    finally:
        sys.stdout = real
    return res


def case_fetch():
    stub = os.path.join(WORK, "stub", "huggingface_hub")
    os.makedirs(stub, exist_ok=True)
    with open(os.path.join(stub, "__init__.py"), "w") as f:
        f.write(
            "import json, os\n"
            "LOG = os.environ['STUB_LOG']\n"
            "def _log(**k):\n"
            "    open(LOG, 'a').write(json.dumps(k) + '\\n')\n"
            "def snapshot_download(repo, revision=None, cache_dir=None, allow_patterns=None):\n"
            "    _log(call='snapshot_download', repo=repo, revision=revision)\n"
            "    d = os.path.join(cache_dir, 'models--' + repo.replace('/', '--'), 'snapshots', revision)\n"
            "    os.makedirs(d, exist_ok=True)\n"
            "    return d\n"
            "class _Info(object):\n"
            "    sha = 'f' * 40\n"
            "class HfApi(object):\n"
            "    def model_info(self, repo, revision=None):\n"
            "        _log(call='model_info', repo=repo, revision=revision)\n"
            "        return _Info()\n")
    os.environ["STUB_LOG"] = os.path.join(WORK, "stub.log")
    sys.path.insert(0, os.path.dirname(stub))
    hf = os.path.join(WORK, "hf")
    p = fake_pin()
    out = io.StringIO()
    real = sys.stdout
    sys.stdout = out
    try:
        pin.fetch(p, hf)
    finally:
        sys.stdout = real
    calls = [json.loads(l) for l in open(os.environ["STUB_LOG"])]
    return {"calls": calls, "ref": pin.read_text(pin.ref_path(hf, "org/Model-A")), "said": out.getvalue(),
            "main_ref_files": sorted(os.listdir(os.path.join(pin.repo_dir(hf, "org/Model-A"), "refs")))}


# ---- the updater (dichphude-update.py) in a throwaway VieNeu folder ----

def updater_world(ours=True):
    vn = os.path.join(WORK, "VieNeu-TTS")
    ext = os.path.join(WORK, "DichPhuDe")
    mirror = os.path.join(WORK, "mirror")
    for d in (os.path.join(vn, ".venv", "bin"), os.path.join(ext, "tools"), mirror):
        os.makedirs(d, exist_ok=True)
    shutil.copy(os.path.join(TOOLS, "dichphude-update.py"), os.path.join(vn, "dichphude-update.py"))
    shutil.copy(os.path.join(TOOLS, "vieneu-pin.py"), os.path.join(ext, "tools", "vieneu-pin.py"))
    p = fake_pin()
    p["repos"][0]["files"][0]["asset"] = "Model-A__w.data"
    with open(os.path.join(ext, "tools", "vieneu-model.json"), "w") as f:
        json.dump(p, f)
    with open(os.path.join(mirror, "Model-A__w.data"), "wb") as f:
        f.write(BODY)
    with open(os.path.join(vn, ".dichphude-ext"), "w") as f:
        f.write(ext)
    if ours:
        with open(os.path.join(vn, ".dichphude-vieneu"), "w") as f:
            f.write("d350c63")
    os.environ["DPD_MODEL_URL"] = "file://" + mirror
    os.environ["DPD_MODEL_NO_HF"] = "1"
    hf = os.path.join(vn, "models", "hf")
    r = subprocess.run([sys.executable, os.path.join(ext, "tools", "vieneu-pin.py"), "--install", "--vieneu", vn],
                       capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    upd = load("dpd_update", os.path.join(vn, "dichphude-update.py"))
    return vn, ext, mirror, hf, p, upd


def log_lines(vn):
    path = os.path.join(vn, "update.log")
    return [l.split(" ", 2)[2] for l in open(path).read().splitlines()] if os.path.exists(path) else []


def case_updater_repair():
    vn, ext, mirror, hf, p, upd = updater_world()
    data = os.path.join(pin.snapshot_dir(hf, "org/Model-A", "a" * 40), "w.data")
    res = {"quick_ok_installed": pin.quick_ok(p, hf)}
    upd.keep_model_current()
    res["log_when_whole"] = log_lines(vn)
    # A truncated file under a current marker: the quick check fails, the updater repairs it
    with open(data, "r+b") as f:
        f.truncate(1000)
    res["quick_ok_truncated"] = pin.quick_ok(p, hf)
    upd.keep_model_current()
    res["repaired"] = open(data, "rb").read() == BODY
    res["quick_ok_repaired"] = pin.quick_ok(p, hf)
    # Deleted, and the source lost it too: the lying marker goes, so the next start runs online
    os.remove(data)
    os.remove(os.path.join(mirror, "Model-A__w.data"))
    upd.keep_model_current()
    res["marker_left"] = os.path.exists(os.path.join(hf, ".pinned-ok"))
    res["log"] = log_lines(vn)
    return res


def case_old_cache():
    res = {}
    for label, ours, line in (("ours_offline", True, "VieNeu model: pinned copy in models/hf, offline"),
                              ("ours_online", True, "VieNeu model: no pinned copy, fetched from Hugging Face"),
                              ("not_ours", False, "VieNeu model: pinned copy in models/hf, offline")):
        global WORK
        base = WORK
        WORK = os.path.join(base, label)
        try:
            vn, ext, mirror, hf, p, upd = updater_world(ours)
            hub = os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub")
            if os.path.isdir(hub):
                shutil.rmtree(hub)
            for n in upd.OLD_CACHE + ["models--someone--else"]:
                os.makedirs(os.path.join(hub, n, "blobs"), exist_ok=True)
                with open(os.path.join(hub, n, "blobs", "x"), "wb") as f:
                    f.write(b"y" * 5000)
            with open(os.path.join(vn, "server.log"), "w") as f:
                f.write("VieNeu model: no pinned copy, fetched from Hugging Face\nINFO started\n" + line + "\nINFO ready\n")
            upd.keep_model_current()
            upd.keep_model_current()
            res[label] = {"left": sorted(os.listdir(hub)), "log": log_lines(vn)}
        finally:
            WORK = base
    return res


def case_refresh_service():
    vn, ext, mirror, hf, p, upd = updater_world()
    sys.platform = "darwin"                      # the function only acts on macOS
    shutil.copy(os.path.join(TOOLS, "vieneu-autostart.command"), os.path.join(ext, "tools", "vieneu-autostart.command"))
    py = os.path.join(vn, ".venv", "bin", "python")
    with open(py, "w") as f:
        f.write("#!/bin/sh\nexit 0\n")
    os.chmod(py, 0o755)
    stubs = os.path.join(WORK, "bin")
    os.makedirs(stubs, exist_ok=True)
    calls = os.path.join(WORK, "launchctl.calls")
    with open(os.path.join(stubs, "launchctl"), "w") as f:
        f.write("#!/bin/sh\necho \"$*\" >> '%s'\n" % calls)
    os.chmod(os.path.join(stubs, "launchctl"), 0o755)
    os.environ["PATH"] = stubs + os.pathsep + os.environ["PATH"]
    plist = upd.SERVICE_PLIST
    os.makedirs(os.path.dirname(plist), exist_ok=True)
    res = {"plist_in_fake_home": plist.startswith(os.path.expanduser("~")) and os.path.expanduser("~").startswith(WORK)}
    # 1. Our own plist from before the size-checked start line (python straight from the plist)
    old = ("<plist><dict><key>ProgramArguments</key><array><string>%s/.venv/bin/python</string>"
           "<string>-m</string><string>apps.openai_speech</string></array></dict></plist>\n" % vn)
    with open(plist, "w") as f:
        f.write(old)
    upd.refresh_mac_service(ext)
    first = open(plist).read()
    res["rewritten"] = upd.START_TOKEN in first and first != old
    upd.refresh_mac_service(ext)
    res["second_run_same"] = open(plist).read() == first
    # 2. Someone else's plist under the same label: never touched
    foreign = old.replace(vn, "/Users/someone/VieNeu-TTS")
    with open(plist, "w") as f:
        f.write(foreign)
    upd.refresh_mac_service(ext)
    res["foreign_untouched"] = open(plist).read() == foreign
    # 3. An older helper without --write-only would restart the server: never run
    sentinel = os.path.join(WORK, "old-helper-ran")
    with open(os.path.join(ext, "tools", "vieneu-autostart.command"), "w") as f:
        f.write("#!/bin/zsh\ntouch '%s'\n" % sentinel)
    with open(plist, "w") as f:
        f.write(old)
    upd.refresh_mac_service(ext)
    res["old_helper_ran"] = os.path.exists(sentinel)
    res["old_plist_kept"] = open(plist).read() == old
    res["launchctl_calls"] = open(calls).read().splitlines() if os.path.exists(calls) else []
    res["log"] = log_lines(vn)
    return res


if __name__ == "__main__":
    WORK = os.path.abspath(sys.argv[2])
    os.makedirs(WORK, exist_ok=True)
    print(json.dumps(globals()["case_" + sys.argv[1]](), default=str))
