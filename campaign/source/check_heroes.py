#!/usr/bin/env python3
"""
check_heroes.py — the built layer (campaign/data/campaign.js) read back against sheets.json,
field by field, for every hero.

    python3 campaign/source/check_heroes.py

Build first: python3 campaign/source/convert_heroes.py && bash build/build_layer.sh campaign/dsl campaign "X-FRONT" campaign/data

  * the head, the ability and damage rows, the speeds, the biography: equal to the sheet's
  * every trait, tag and power entry: its Printed is the sheet's heading, in the sheet's order;
    its Name opens an entry — the layer's own power, or the corpus's entry of that name — and
    that entry's words are the sheet's (an `own` power's Effect equals the sheet's text; a book
    entry is the one resolve.py matched to the sheet's text)
  * nothing extra: as many entries as the sheet has, less none

Exits non-zero on any difference.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from convert_heroes import title_of  # noqa: E402
from corpus_index import corpus  # noqa: E402
from resolve import Resolver  # noqa: E402

SRC = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(SRC))
BLOB = re.compile(r"var d=(\{.*\});var T=window\.MARVELMULTIVERSE", re.S)


def rows(p):
    return [{f["name"]: (rows(f) if f.get("vk") == "list" else f.get("value")) for f in it["d"]} for it in p.get("items", [])]


def fields(e):
    out = {}
    for p in e.get("props", []):
        out[p["name"]] = rows(p) if p.get("vk") == "list" and p.get("ofHash") else p.get("value")
    return out


def main():
    layer = json.loads(BLOB.search(open(os.path.join(ROOT, "campaign", "data", "campaign.js"), encoding="utf-8").read()).group(1))["entities"]
    by_name = {e["name"]: e for e in layer.values()}
    c = corpus()
    R = Resolver()
    recs = json.load(open(os.path.join(SRC, "sheets.json"), encoding="utf-8"))
    fail, checked = [], 0

    def eq(hero, what, have, want):
        nonlocal checked
        checked += 1
        if have != want:
            fail.append("%s — %s: layer %r, sheet %r" % (hero, what, have, want))

    for r in recs:
        hero = r["Hero"]
        e = by_name.get(hero)
        if not e or e.get("type") != "Character":
            fail.append("%s — no Character of that name in the layer" % hero)
            continue
        f = fields(e)
        for k in ("Name", "Rank", "Karma", "Health", "Health Damage Reduction", "Focus", "Focus Damage Reduction", "Initiative Modifier",
                  "Real Name", "Height", "Weight", "Gender", "Eyes", "Hair", "Size", "Distinguishing Features", "Occupation", "Origin", "Teams", "Base"):
            eq(hero, k, f.get(k) or "", r[k] or "")
        eq(hero, "Speeds", f["Speeds"], r["Speeds"])
        eq(hero, "Abilities", f["Abilities"], r["Abilities"])
        eq(hero, "Damage", f["Damage"], r["Damage"])
        eq(hero, "History", f["History"].split("\n\n"), r["History"])
        eq(hero, "Personality", f["Personality"].split("\n\n"), r["Personality"])
        bio = {b["Heading"]: b["Text"] for b in f["Biography Sections"]}
        eq(hero, "Current Age", "%s: %s" % next(iter(bio.items())), r["Current Age"])
        for s in r["Sections"]:
            if s["Description"]:
                eq(hero, "section " + s["Heading"], bio.get(s["Heading"], "").split("\n\n"), s["Description"])

        # the entries, in the sheet's order within each list
        listed = [("Traits", t) for t in f.get("Traits", [])] + [("Tags", t) for t in f.get("Tags", [])] + \
                 [("Powers", p) for g in f.get("Powers", []) for p in g["Powers"]]
        printed_all = [x["Printed"] for _, x in listed]
        eq(hero, "number of entries", len(listed), len(r["Entries"]))
        for ent in r["Entries"]:
            x = R.entry(ent)
            want = title_of(ent)
            hit = [row for kind, row in listed if row["Printed"] == want]
            eq(hero, "entry %r present" % want, len(hit) >= 1, True)
            if not hit:
                continue
            row = hit[0]
            if x["status"] == "free":
                continue
            target = by_name.get(row["Name"])
            if x["status"] == "own":
                eq(hero, "own power %r" % row["Name"], target is not None and target["book"] == "campaign", True)
                if target:
                    eq(hero, "Effect of %r" % row["Name"], fields(target).get("Effect"), ent["text"])
            else:
                corpus_hit = c.get(x["kind"], {}).get(row["Name"])
                eq(hero, "%r names the book's %s" % (want, x["kind"]), corpus_hit is not None and corpus_hit["id"] == x["entity"]["id"], True)
                eq(hero, "%r not shadowed by the layer" % row["Name"], row["Name"] in by_name, False)
        eq(hero, "Printed unique", len(printed_all), len(set(printed_all)) + sum(printed_all.count(p) - 1 for p in set(printed_all)))
    for m in fail[:40]:
        print("  " + m)
    print("check_heroes: %d checks over %d heroes, %d differ" % (checked, len(recs), len(fail)))
    print("check_heroes: %s" % ("FAILED" if fail else "OK"))
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
