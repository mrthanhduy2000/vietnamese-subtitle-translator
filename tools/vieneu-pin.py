# Check, install or rebuild the pinned VieNeu model that the voice server reads offline.
#
# The pin is vieneu-model.json (next to this file in the share build, tools/share/ in the repo):
# every model file the server loads, at a fixed Hugging Face revision, with its size and sha256, the
# GitHub release that mirrors those files, and the voices file that lives in the VieNeu code. The
# server reads the copy through HF_HOME=<VieNeu>/models/hf and HF_HUB_OFFLINE=1 whenever the marker
# <VieNeu>/models/hf/.pinned-ok exists (docs/DUBBING.md "Pinned model"), so nothing is fetched at
# start and nothing sits in ~/.cache, which disk cleaners empty.
#
#   python vieneu-pin.py                verify the local copy and the voices file (offline)
#   python vieneu-pin.py --install      download what is missing or wrong, check every byte, mark it
#   python vieneu-pin.py --fetch        the author's rebuild through huggingface_hub, then verify
# Options: --vieneu DIR (default ~/VieNeu-TTS), --hf-home DIR (default <vieneu>/models/hf),
#   --pin FILE, and for --install: --base-url URL (the release mirror, file:// or http(s); tests;
#   the environment variable DPD_MODEL_URL does the same where the updater runs it),
#   --no-hf (never fall back to Hugging Face), --if-changed (stop at once when the marker already
#   names this pin: what the background updater runs).
#
# --install uses the standard library only: it runs with the Python of a fresh VieNeu install on
# macOS and Windows (the installers, tools/dichphude-update.py). Each file comes from the project's
# GitHub release, else from Hugging Face at the pinned revision (never "main"); it is streamed to
# <file>.part, resumed after a cut, checked for size and sha256, then moved into place. refs/main and
# the marker are written only once every file matches. Exit 0 = every file matches, 1 = it does not,
# 2 = another install holds the lock.
# --fetch needs huggingface_hub: run it with ~/VieNeu-TTS/.venv/bin/python.
# The installer output is read by Vietnamese users, so --install talks Vietnamese, without marks:
# this file stays ASCII only, like every helper the Windows installer runs.
import argparse
import hashlib
import json
import os
import shutil
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
# Share build: extension/tools/vieneu-model.json. Private repo: tools/share/vieneu-model.json.
PIN_PLACES = [os.path.join(HERE, "vieneu-model.json"), os.path.join(HERE, "share", "vieneu-model.json")]
MARKER = ".pinned-ok"          # in HF_HOME; the server start scripts look for it
LOCK = ".pin-lock"             # in HF_HOME; one install at a time (installer vs background updater)
LOCK_STALE_S = 600             # a live install touches the lock at least every 30 s
UA = "dichphude-vieneu-pin"
TRIES = 3                      # per source, for network errors (a partial file is resumed)
BLOCK = 1 << 20
FREE_MARGIN = 200 * 1000 * 1000
SNAPSHOT_NAME_LEN = 40         # a Hugging Face commit hash


def say(msg=""):
    print(msg, flush=True)


# ---- pin and layout ----

def find_pin(explicit=None):
    for p in ([explicit] if explicit else PIN_PLACES):
        if p and os.path.isfile(p):
            return p
    return None


def load_pin(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def repo_dir(hf_home, repo):
    return os.path.join(hf_home, "hub", "models--" + repo.replace("/", "--"))


def snapshot_dir(hf_home, repo, revision):
    return os.path.join(repo_dir(hf_home, repo), "snapshots", revision)


def ref_path(hf_home, repo):
    return os.path.join(repo_dir(hf_home, repo), "refs", "main")


def file_path(hf_home, r, f):
    return os.path.join(snapshot_dir(hf_home, r["repo"], r["revision"]), *f["path"].split("/"))


def asset_name(repo, path):
    # Release assets cannot hold folders: <repo name>__<path with / as __>, deterministic
    return repo.split("/")[-1] + "__" + path.replace("/", "__")


def release_tag(pin):
    # Both revisions: a change to either repo alone must not overwrite the assets an older pin names
    return "vieneu-model-" + "-".join(r["revision"][:7] for r in pin["repos"])


def pin_id(pin):
    # What the marker records: every revision, plus a digest of the file list, so any change to what
    # is pinned (a revision, a file added or rehashed) reads as a different pin.
    h = hashlib.sha256()
    lines = []
    for r in pin["repos"]:
        lines.append("%s@%s" % (r["repo"], r["revision"]))
        for f in r["files"]:
            h.update(("%s/%s %d %s\n" % (r["repo"], f["path"], f["size"], f["sha256"])).encode("ascii"))
    lines.append("files " + h.hexdigest()[:16])
    return "\n".join(lines) + "\n"


def read_text(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except (OSError, ValueError):
        return None


def marker_current(pin, hf_home):
    return read_text(os.path.join(hf_home, MARKER)) == pin_id(pin)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(BLOCK), b""):
            h.update(block)
    return h.hexdigest()


def problem(path, size, digest):
    # None when the file is there with the pinned bytes, else what is wrong
    if not os.path.isfile(path):
        return "MISSING"
    if os.path.getsize(path) != size:
        return "SIZE"
    if sha256(path) != digest:
        return "SHA256"
    return None


# ---- verify (the author's check, and CI) ----

def check(label, path, size, digest):
    p = problem(path, size, digest)
    if p == "SIZE":
        print("SIZE     %s (%d, want %d)" % (label, os.path.getsize(path), size))
    elif p:
        print("%-8s %s" % (p, label))
    else:
        print("ok       %8.1f MB  %s" % (size / 1e6, label))
    return p is None


def verify(pin, hf_home, vieneu):
    good = True
    for r in pin["repos"]:
        for f in r["files"]:
            good &= check(r["repo"].split("/")[1] + "/" + f["path"], file_path(hf_home, r, f), f["size"], f["sha256"])
        # Offline lookups resolve "main" through refs/main; a copy without it fails at server start.
        ref = read_text(ref_path(hf_home, r["repo"]))
        if ref is None or ref.strip() != r["revision"]:
            print("REF      %s refs/main is not %s" % (r["repo"], r["revision"][:7]))
            good = False
    v = pin["voices"]
    good &= check("VieNeu code/" + v["path"], os.path.join(vieneu, v["path"]), v["size"], v["sha256"])
    if good and not marker_current(pin, hf_home):
        # The start scripts go offline only behind the marker: without it the copy is not used
        print("note     no %s for this pin: the start scripts run online; --install writes it (no download)" % MARKER)
    return good


# ---- fetch (the author's rebuild) ----

def fetch(pin, hf_home):
    from huggingface_hub import snapshot_download
    for r in pin["repos"]:
        # revision "main" writes refs/main (needed offline); the result must still be the pinned
        # commit, so a moved main is refused instead of silently becoming the new voice.
        p = snapshot_download(r["repo"], revision="main", cache_dir=os.path.join(hf_home, "hub"),
                              allow_patterns=[f["path"] for f in r["files"]])
        got = os.path.basename(p)
        if got != r["revision"]:
            sys.exit("%s main is now %s, the pin is %s: review the change, then update the pin"
                     % (r["repo"], got[:7], r["revision"][:7]))


# ---- install (friends' machines; standard library only) ----

class BadBytes(Exception):
    """The source served other bytes than the pin names: do not retry it."""


class Gone(Exception):
    """The source does not have the file (404 and the like): do not retry it."""


_certifi_ctx = []


def urlopen(req):
    ctx = _certifi_ctx[0] if _certifi_ctx else None
    try:
        return urllib.request.urlopen(req, timeout=60, context=ctx)
    except urllib.error.URLError as e:
        # A Python without the system certificates: VieNeu's own HTTP stack trusts certifi's bundle
        if ctx is None and isinstance(getattr(e, "reason", None), ssl.SSLCertVerificationError):
            try:
                import certifi
            except ImportError:
                raise e
            _certifi_ctx.append(ssl.create_default_context(cafile=certifi.where()))
            return urllib.request.urlopen(req, timeout=60, context=_certifi_ctx[0])
        raise


class Lock(object):
    def __init__(self, hf_home):
        self.path = os.path.join(hf_home, LOCK)
        self.held = False
        self.touched = 0

    def take(self):
        for _ in range(2):
            try:
                fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(fd, str(os.getpid()).encode("ascii"))
                os.close(fd)
                self.held = True
                self.touched = time.time()
                return True
            except FileExistsError:
                try:
                    if time.time() - os.path.getmtime(self.path) < LOCK_STALE_S:
                        return False
                    os.remove(self.path)          # left by a killed run
                except OSError:
                    pass
        return False

    def touch(self):
        if self.held and time.time() - self.touched > 30:
            self.touched = time.time()
            try:
                os.utime(self.path, None)
            except OSError:
                pass

    def release(self):
        if self.held:
            try:
                os.remove(self.path)
            except OSError:
                pass
            self.held = False


def mb(n):
    return "%.1f MB" % (n / 1e6)


def download(url, part, f, lock):
    """Stream url into part, resuming a partial file. Returns when part holds exactly the pinned
    bytes. Raises BadBytes (part removed) or Gone (part kept), or a network error (part kept)."""
    size = f["size"]
    have = os.path.getsize(part) if os.path.exists(part) else 0
    h = hashlib.sha256()
    if have:
        with open(part, "rb") as fp:
            for block in iter(lambda: fp.read(BLOCK), b""):
                h.update(block)
        if have == size and h.hexdigest() == f["sha256"]:
            return                             # a run killed between the last byte and the move
        if have >= size:
            os.remove(part)
            have = 0
            h = hashlib.sha256()
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    if have:
        req.add_header("Range", "bytes=%d-" % have)
    try:
        r = urlopen(req)
    except urllib.error.HTTPError as e:
        if e.code == 416:                      # the partial file is already wrong somehow
            os.remove(part)
            raise BadBytes("HTTP 416")
        if 400 <= e.code < 500:
            raise Gone("HTTP %d" % e.code)
        raise
    except urllib.error.URLError as e:
        if url.startswith("file:") and isinstance(e.reason, OSError):
            raise Gone("khong co tep")         # a local mirror without this asset
        raise
    with r:
        code = r.getcode()                     # None for file:// URLs
        if have and code != 206:               # the server ignored the range: start over
            have = 0
            h = hashlib.sha256()
        length = r.headers.get("Content-Length") if r.headers is not None else None
        if length and int(length) != size - have:
            raise BadBytes("nguon co %s, ban da khoa la %s" % (mb(int(length) + have), mb(size)))
        step = size // 10 if size >= 32 * 1000 * 1000 else 0
        next_mark = (have // step + 1) * step if step else size + 1
        with open(part, "ab" if have else "wb") as out:
            while True:
                block = r.read(BLOCK)
                if not block:
                    break
                if have + len(block) > size:
                    raise BadBytes("lon hon ban da khoa")
                out.write(block)
                h.update(block)
                have += len(block)
                lock.touch()
                if have >= next_mark and have < size:
                    say("    ... %d%% (%s / %s)" % (have * 100 // size, mb(have), mb(size)))
                    next_mark += step
    if have < size:
        raise IOError("ket noi dung o %s / %s" % (mb(have), mb(size)))
    if h.hexdigest() != f["sha256"]:
        os.remove(part)
        raise BadBytes("ma sha256 khac ban da khoa")


def sources(r, f, base_url, use_hf):
    out = []
    if base_url:
        out.append(("GitHub", base_url.rstrip("/") + "/" + (f.get("asset") or asset_name(r["repo"], f["path"]))))
    if use_hf:
        out.append(("Hugging Face", "https://huggingface.co/%s/resolve/%s/%s"
                    % (r["repo"], r["revision"], urllib.parse.quote(f["path"]))))
    return out


def prune(pin, hf_home):
    # Snapshots of revisions the pin no longer names: the server loads every file at start, so a
    # running one keeps what it has open. Best effort (Windows refuses files still in use).
    for r in pin["repos"]:
        snaps = os.path.join(repo_dir(hf_home, r["repo"]), "snapshots")
        try:
            names = os.listdir(snaps)
        except OSError:
            continue
        for name in names:
            if len(name) == SNAPSHOT_NAME_LEN and name != r["revision"] and all(c in "0123456789abcdef" for c in name):
                shutil.rmtree(os.path.join(snaps, name), ignore_errors=True)


def write_atomic(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    os.replace(tmp, path)


def install(pin, hf_home, vieneu, base_url, use_hf, if_changed):
    if if_changed and marker_current(pin, hf_home):
        prune(pin, hf_home)
        say("Mo hinh giong da dung ban da khoa, khong can tai.")
        return 0
    os.makedirs(hf_home, exist_ok=True)
    lock = Lock(hf_home)
    if not lock.take():
        say("Mot lan tai mo hinh giong khac dang chay (bo tu cap nhat?). Lan nay bo qua, thu lai sau.")
        return 2
    try:
        return _install(pin, hf_home, vieneu, base_url, use_hf, lock)
    finally:
        lock.release()


def _install(pin, hf_home, vieneu, base_url, use_hf, lock):
    started = time.time()
    rel = pin.get("release") or {}
    base_url = base_url or os.environ.get("DPD_MODEL_URL") or None   # a mirror (tests)
    if base_url is None and rel.get("repo") and rel.get("tag"):
        base_url = "https://github.com/%s/releases/download/%s" % (rel["repo"], rel["tag"])
    files = [(r, f) for r in pin["repos"] for f in r["files"]]
    total = sum(f["size"] for _, f in files)
    say("Kiem tra mo hinh giong (%d tep, %s)..." % (len(files), mb(total)))
    todo = [(r, f) for r, f in files if problem(file_path(hf_home, r, f), f["size"], f["sha256"])]
    if todo:
        partial = sum(os.path.getsize(file_path(hf_home, r, f) + ".part")
                      for r, f in todo if os.path.isfile(file_path(hf_home, r, f) + ".part"))
        need = sum(f["size"] for _, f in todo) - partial
        free = shutil.disk_usage(hf_home).free
        if need + FREE_MARGIN > free:
            say("LOI: khong du cho trong tren o dia: can %s, con %s. Don bot roi chay lai." % (mb(need + FREE_MARGIN), mb(free)))
            return _failed(pin, hf_home)
        say("Can tai %d tep, %s%s." % (len(todo), mb(need), " (tiep tuc phan da tai do)" if partial else ""))
    fetched = 0
    missing = []
    used = {}
    dead = set()                               # sources not worth asking again: release 404, unreachable
    for i, (r, f) in enumerate(todo, 1):
        dest = file_path(hf_home, r, f)
        part = dest + ".part"
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        label = "%s/%s" % (r["repo"].split("/")[-1], f["path"])
        done = False
        for name, url in sources(r, f, base_url, use_hf):
            if name in dead:
                continue
            say("  [%d/%d] %s (%s) tu %s" % (i, len(todo), label, mb(f["size"]), name))
            t0 = time.time()
            for attempt in range(1, TRIES + 1):
                try:
                    download(url, part, f, lock)
                    os.replace(part, dest)
                    done = True
                    break
                except Gone as e:
                    say("    %s khong co tep nay (%s)." % (name, e))
                    if name == "GitHub":
                        dead.add(name)         # one 404: the release is not published, skip it
                        if use_hf:
                            say("    Chua co ban phat hanh tren GitHub: tai tu Hugging Face, dung ban da khoa.")
                    break
                except BadBytes as e:
                    say("    Tu choi: %s." % e)
                    break
                except Exception as e:             # network, or a file held by an antivirus: retry, resuming
                    say("    Loi tai (lan %d/%d): %s" % (attempt, TRIES, e))
                    if attempt < TRIES:
                        time.sleep(3 * attempt)
                    else:
                        dead.add(name)             # unreachable: do not wait on it for every file
            if done:
                if f["size"] >= 1000 * 1000:
                    say("    xong, %s/giay" % mb(f["size"] / max(time.time() - t0, 0.001)))
                fetched += f["size"]
                used[name] = used.get(name, 0) + 1
                break
        if not done:
            # Keep going: whatever else arrives is kept, so the next run has less to fetch
            say("LOI: khong tai duoc %s tu nguon nao." % label)
            missing.append(label)
    if missing:
        return _failed(pin, hf_home)
    # Every file was hashed above or while it streamed in: point "main" at the pinned revisions, then
    # write the marker. A size check catches a file that went away meanwhile, without hashing again.
    for r, f in files:
        p = file_path(hf_home, r, f)
        if not os.path.isfile(p) or os.path.getsize(p) != f["size"]:
            say("LOI: %s/%s bien mat sau khi tai." % (r["repo"], f["path"]))
            return _failed(pin, hf_home)
    for r in pin["repos"]:
        write_atomic(ref_path(hf_home, r["repo"]), r["revision"])
    write_atomic(os.path.join(hf_home, MARKER), pin_id(pin))
    prune(pin, hf_home)
    v = pin.get("voices")
    if v and os.path.isdir(os.path.join(vieneu, "src", "vieneu")) and problem(os.path.join(vieneu, v["path"]), v["size"], v["sha256"]):
        say("Chu y: tep giong trong ma VieNeu khac ban da khoa (giong van chay).")
    src = ", ".join("%s %d tep" % (k, n) for k, n in sorted(used.items()))
    say("Mo hinh giong da khoa: %d tep, %s, tai moi %s%s, %d giay." % (
        len(files), mb(total), mb(fetched), " (" + src + ")" if src else "", round(time.time() - started)))
    return 0


def _failed(pin, hf_home):
    # A marker naming this very pin now lies (its files are wrong): remove it, so the server starts
    # online and still talks. A marker for an older pin stays: refs/main still names those files.
    if marker_current(pin, hf_home):
        try:
            os.remove(os.path.join(hf_home, MARKER))
        except OSError:
            pass
    say("Chua tai duoc mo hinh giong.")
    return 1


def main():
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(errors="replace")    # a non-ASCII path on a cp1252 pipe must not crash
        except Exception:
            pass
    ap = argparse.ArgumentParser(description="Check, install or rebuild the pinned VieNeu model.")
    ap.add_argument("--vieneu", default=os.path.expanduser("~/VieNeu-TTS"))
    ap.add_argument("--hf-home", help="default <vieneu>/models/hf")
    ap.add_argument("--pin", help="default vieneu-model.json next to this file, else share/")
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("--install", action="store_true")
    ap.add_argument("--base-url", help="install: where the release assets are (file:// or http)")
    ap.add_argument("--no-hf", action="store_true", help="install: no Hugging Face fallback")
    ap.add_argument("--if-changed", action="store_true", help="install: nothing to do when the marker names this pin")
    a = ap.parse_args()
    hf_home = os.path.abspath(a.hf_home or os.path.join(a.vieneu, "models", "hf"))
    pin_file = find_pin(a.pin)
    if not pin_file:
        print("LOI: khong tim thay vieneu-model.json")
        return 1
    pin = load_pin(pin_file)
    if a.install:
        try:
            return install(pin, hf_home, a.vieneu, a.base_url, not a.no_hf, a.if_changed)
        except KeyboardInterrupt:
            raise
        except Exception as e:                 # never a traceback in the installer output
            print("LOI: %s: %s" % (type(e).__name__, e))
            return _failed(pin, hf_home)
    if a.fetch:
        fetch(pin, hf_home)
    ok = verify(pin, hf_home, a.vieneu)
    print("all files match the pin" if ok else "the local copy does NOT match the pin")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
