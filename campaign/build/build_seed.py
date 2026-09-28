#!/usr/bin/env python3
"""
build_seed.py — the Narrator's first import → campaign/pack/seed.json (VttConfig.defaultCampaign.seed).

    python3 campaign/build/build_seed.py

  * gm.overview — campaign/source/gm.md, a card per `## Title {#id}` section, its paragraphs word for word
  * party       — the six heroes, each a member on its layer profile (campaign/data/index.js, built by
                  build/build_layer.sh), its live Health, Focus and Karma at the sheet's numbers — the same
                  member the Heroes pane makes from a profile (system/marvelmultiverse/sheet.js fromProfile)

Gates (exit non-zero): ids unique; every hero of sheets.json a member, on a profile of the layer; the
source's words, re-read from the pack, equal to gm.md's.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "campaign", "source")
OUT = os.path.join(ROOT, "campaign", "pack", "seed.json")
INDEX = re.compile(r"var d=(\{.*\});var T=window\.MARVELMULTIVERSE", re.S)
TRACKS = (("health", "Health"), ("focus", "Focus"), ("karma", "Karma"))


def overview():
    s = open(os.path.join(SRC, "gm.md"), encoding="utf-8").read()
    cards = []
    for m in re.finditer(r"^## (.+?) \{#([\w-]+)\}\n(.*?)(?=^## |\Z)", s, re.S | re.M):
        paras = [re.sub(r"\s*\n\s*", " ", p).strip() for p in re.split(r"\n\s*\n", m.group(3)) if p.strip()]
        cards.append({"id": m.group(2), "title": m.group(1), "text": "\n\n".join(paras)})
    return cards, s


def main():
    fail = 0
    recs = json.load(open(os.path.join(SRC, "sheets.json"), encoding="utf-8"))
    idx = json.loads(INDEX.search(open(os.path.join(ROOT, "campaign", "data", "index.js"), encoding="utf-8").read()).group(1))
    profiles = {r["name"]: r for r in idx["records"] if r.get("type") == "Character" and r.get("kind") == "actor"}
    party = []
    for r in recs:
        p = profiles.get(r["Hero"])
        if not p:
            print("  PARTY — %s has no profile in the layer" % r["Hero"])
            fail = 1
            continue
        live = {}
        for key, field in TRACKS:
            m = re.match(r"^-?\d+", str((p.get("fields") or {}).get(field) or ""))
            if m:
                live[key] = int(m.group(0))
        slug = re.sub(r"[^a-z0-9]+", "-", r["Hero"].lower()).strip("-")
        party.append({"id": "xf-member-" + slug, "templateId": p["id"], "name": r["Hero"], "player": "",
                      "profile": p["id"], "character": None, "source": {"kind": "profile", "id": p["id"], "book": "campaign"},
                      "live": live, "notes": ""})
    cards, src = overview()
    pack = {"kind": "sortilege-vtt-campaign", "version": 1, "gm": {"overview": cards}, "party": party}
    ids = [c["id"] for c in cards] + [m["id"] for m in party]
    if len(ids) != len(set(ids)):
        print("  IDS — not unique: %r" % ids)
        fail = 1
    body = re.sub(r"^#.*$", "", re.sub(r"^## .+$", "", src, flags=re.M), flags=re.M)
    if " ".join(c["text"] for c in cards).split() != body.split():
        print("  WORDS — the pack's overview differs from gm.md")
        fail = 1
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(pack, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print("build_seed: overview %d cards, party %d (%s) → campaign/pack/seed.json" % (len(cards), len(party), ", ".join("%s %s" % (m["name"], "/".join(str(m["live"].get(k, "—")) for k, _ in TRACKS)) for m in party)))
    print("build_seed: %s" % ("FAILED" if fail else "OK"))
    return fail


if __name__ == "__main__":
    sys.exit(main())
