#!/usr/bin/env python3
"""Filter for the newest glossary blocks: drops everyday English words kept as names, and history
or people names that hide a settled Vietnamese rendering. Needs `pip install wordfreq`.
  python3 tools/glossary-filter.py <first-line> [--write]
<first-line> is the 1-based line of glossary-data.js where the batch to check starts."""
import json, re, subprocess, sys
from wordfreq import zipf_frequency as z

start = int(sys.argv[1]); write = "--write" in sys.argv
path = "glossary-data.js"
lines = open(path, encoding="utf8").read().split("\n")
# names that are also everyday words but are real names in speech: never dropped
# the NLTK "names" corpus of English first names (path passed with --names=<file>)
NAMES = set()
for a in sys.argv:
    if a.startswith("--names="): NAMES = set(open(a[8:]).read().split())
# first names that are everyday words first: dropped like any other everyday word
NOT_NAMES = set("Major Honor Joy Sugar Ginger Prince Brother Mate Rain Winter Sunny Dawn Peak Coast Lay Guess Pilot Strike Ring Crash Case Base Fresh Cell Era Flow Gain Pain Power Head Secret Operation Champion Festival Nature Boyfriend Budget Memories".split())
# everyday words judged by hand on 3.7M words of movie and speech text (2.9.6), below zipf 4.5
EXTRA = set("Acquired Always Another Anthem Aqua Ark Arms Aussie Banquet Base Beast Benefit Blitz Boost Boots Bounty Boxer Brook Brother Budget Butterfly Casa Caste Cell Champion Citizen Civilization Coast Column Consulate Crash Criminal Darkness Death Degree Dimension Directory Doom Dots Down Dream Ego Era Festival Finish Fleet Galaxy Gate Glad Guess Halls Head Hefty Honor Hostess Index Inferno Infinite Ink Innocence Inside Joy Jumbo Kappa Kidnapped Kitchen Lay Leaders Lifestyles Lore MAC Major Mantle Marches Mate Monster Nationwide Nature Near Nest Next Odd Operation Pain Parallel Peak Phantom Piggy Pilot Pioneer Pixel Pledge Polar Power Prey Principles Privy Providence Quickly Quiet Rain Ramp Range Rare Razor Ritual Roses Sake Scroll Secret Serial Shark Sphere Split Stacks Staples Strike Sugar Sunrise Sway Sweetheart Swell Tango Tide Tiger Travelers Trouble Undercover Uni Warehouse Warrior Wings Winter".split())
KEEP = set("Washington Lee Kim Wilson Jordan Hollywood Christian San Van Mobile Kingdom Prince Jessica Nicole Simon Madison Victoria Parker Kent Stanley Albert Dean Nancy Leo Johnny Bobby Hoover Orange Solo Douglas Emma Nelson Tan Chandler Dawn Sunny".split())

def parse(l):
    t = l.strip()
    if not t or t.startswith(("#", "CST_", "`")): return None
    flag = t[0] if t[0] in "~=" else ""
    en, _, vi = t.lstrip("~=").partition("|")
    return flag, en.strip(), vi.strip()

# Vietnamese renderings that exist before the batch (rendered terms only)
vi_keys = {}
for l in lines[:start - 1]:
    p = parse(l)
    if p and p[2]: vi_keys.setdefault(p[1].lower().split()[0], []).append(p[1].lower())
esc = re.escape
out, dropped, tilded = [], {"everyday": [], "shadow": []}, 0
group = None
for i, l in enumerate(lines):
    if i < start - 1: out.append(l); continue
    m = re.match(r'CST_GLOSSARY_EXTRA_ADD\("(\w+)"', l)
    if m: group = m.group(1)
    p = parse(l)
    if not p: out.append(l); continue
    flag, en, vi = p
    if vi or flag == "=": out.append(l); continue
    single = re.fullmatch(r"[A-Za-z][a-z']+", en) is not None
    f = z(en.lower(), "en") if single else 0
    if single and en in EXTRA and flag != "=": dropped["everyday"].append(en); continue
    if single and en not in KEEP and f >= 4.5 and not (en.lower() in NAMES and en not in NOT_NAMES):
        if flag == "~": dropped["everyday"].append(en); continue
        out.append("~" + l.strip()); tilded += 1; continue
    if group in ("history", "people") and " " in en:
        low = en.lower()
        hit = any(re.search(r"(?<![\w])" + esc(k) + r"s?(?![\w])", low)
                  for w in set(low.split()) for k in vi_keys.get(w, []) if len(k) >= 3)
        if hit: dropped["shadow"].append(en); continue
    out.append(l)
print({k: len(v) for k, v in dropped.items()}, "tilded", tilded)
json.dump(dropped, open("/dev/stderr", "w") if False else open("/tmp/glossary-filter-dropped.json", "w"), indent=0)
if write: open(path, "w", encoding="utf8").write("\n".join(out))
