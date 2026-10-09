# Check (or rebuild) the pinned VieNeu model that the voice server reads offline.
#
# The pin is tools/share/vieneu-model.json: every model file the server loads, at a fixed Hugging Face
# revision, with its size and sha256, plus the voices file that lives in the VieNeu code. The server
# reads the copy through HF_HOME=<VieNeu>/models/hf and HF_HUB_OFFLINE=1 (docs/DUBBING.md "Pinned
# model"), so nothing is fetched at start and nothing sits in ~/.cache, which diskguard empties.
#
#   python tools/vieneu-pin.py                 verify the local copy and the voices file (offline)
#   python tools/vieneu-pin.py --fetch         download the pinned revisions, then verify
#   python tools/vieneu-pin.py --vieneu DIR    VieNeu folder (default ~/VieNeu-TTS)
#
# --fetch needs huggingface_hub, so run it with VieNeu's Python: ~/VieNeu-TTS/.venv/bin/python.
# Verify uses the standard library only. Exit code 0 = every file matches, 1 = something does not.
# ASCII only, like the other helpers the installers may ship.
import argparse
import hashlib
import json
import os
import sys

PIN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "share", "vieneu-model.json")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def snapshot_dir(hf_home, repo, revision):
    return os.path.join(hf_home, "hub", "models--" + repo.replace("/", "--"), "snapshots", revision)


def check(label, path, size, digest):
    if not os.path.isfile(path):
        print("MISSING  %s" % label)
        return False
    if os.path.getsize(path) != size:
        print("SIZE     %s (%d, want %d)" % (label, os.path.getsize(path), size))
        return False
    if sha256(path) != digest:
        print("SHA256   %s" % label)
        return False
    print("ok       %8.1f MB  %s" % (size / 1e6, label))
    return True


def verify(pin, hf_home, vieneu):
    good = True
    for r in pin["repos"]:
        snap = snapshot_dir(hf_home, r["repo"], r["revision"])
        for f in r["files"]:
            good &= check(r["repo"].split("/")[1] + "/" + f["path"],
                          os.path.join(snap, f["path"]), f["size"], f["sha256"])
        # Offline lookups resolve "main" through refs/main; a copy without it fails at server start.
        ref = os.path.join(hf_home, "hub", "models--" + r["repo"].replace("/", "--"), "refs", "main")
        if not os.path.isfile(ref) or open(ref).read().strip() != r["revision"]:
            print("REF      %s refs/main is not %s" % (r["repo"], r["revision"][:7]))
            good = False
    v = pin["voices"]
    good &= check("VieNeu code/" + v["path"], os.path.join(vieneu, v["path"]), v["size"], v["sha256"])
    return good


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


def main():
    ap = argparse.ArgumentParser(description="Check (or rebuild) the pinned VieNeu model.")
    ap.add_argument("--vieneu", default=os.path.expanduser("~/VieNeu-TTS"))
    ap.add_argument("--hf-home", help="default <vieneu>/models/hf")
    ap.add_argument("--fetch", action="store_true")
    a = ap.parse_args()
    hf_home = a.hf_home or os.path.join(a.vieneu, "models", "hf")
    with open(PIN, encoding="utf-8") as f:
        pin = json.load(f)
    if a.fetch:
        fetch(pin, hf_home)
    ok = verify(pin, hf_home, a.vieneu)
    print("all files match the pin" if ok else "the local copy does NOT match the pin")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
