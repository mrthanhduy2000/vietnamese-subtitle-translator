# What the VieNeu server will say for each text, without making audio: the exact front end of its
# /v1/audio/speech path (v3 turbo): normalize_to_chunks_v3_with_gaps, then
# phonemize_text_with_emotions per chunk. Reads a JSON array of strings on stdin, writes a JSON
# array of { chunks, gaps, ph } (ph: one phoneme string per chunk). Given {"words": [...]} instead,
# phonemizes each word alone (no normalization) and returns the list: used to build the set of
# Vietnamese syllable readings that tools/pron-eval.js tells apart from English ones. Given
# {"normalize": [...]}, returns only the normalizer's text for each (no chunking, no phonemes): used by
# tools/build-speech-tables.js to learn which all-caps codes the server already reads well.
# Run with the server's own Python: ~/VieNeu-TTS/.venv/bin/python tools/vieneu-g2p.py
import json
import os
import sys

root = os.environ.get("VIENEU_DIR", os.path.expanduser("~/VieNeu-TTS"))
sys.path.insert(0, os.path.join(root, "src"))
from vieneu_utils.phonemize_text import normalize_to_chunks_v3_with_gaps, phonemize_text_with_emotions  # noqa: E402

data = json.load(sys.stdin)
if isinstance(data, dict) and "normalize" in data:
    from sea_g2p import Normalizer
    json.dump(Normalizer("vi").normalize_batch(data["normalize"]), sys.stdout, ensure_ascii=False)
    sys.exit(0)
if isinstance(data, dict):
    from sea_g2p import G2P
    json.dump(G2P(lang="vi").phonemize_batch(data["words"]), sys.stdout, ensure_ascii=False)
    sys.exit(0)
out = []
for text in data:
    chunks, gaps = normalize_to_chunks_v3_with_gaps(text, max_chars=256)
    out.append({"chunks": chunks, "gaps": gaps, "ph": [phonemize_text_with_emotions(c) for c in chunks]})
json.dump(out, sys.stdout, ensure_ascii=False)
