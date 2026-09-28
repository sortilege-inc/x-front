#!/usr/bin/env python3
"""
check_sheets.py — the gate on campaign/source/sheets.json (extract_sheets.py's output).

    python3 campaign/source/check_sheets.py

  1. RECORD — each sheets/<Hero>.txt is poppler's text layer of sheets/<Hero>.pdf, byte for byte
     (read afresh here).
  2. WORDS, both ways — the words of each .txt, as a multiset, are exactly the template's labels
     plus every value sheets.json holds for that hero: nothing on the sheet is left out of the
     record, nothing in the record came from anywhere else.
  3. NAMES — every entry that names a trait, tag or power names one the corpus prints (resolve.py;
     the one alias is listed there), and every entry is read as the book's text or the hero's own.

Exits non-zero on any failure.
"""
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_sheets import HEROES, LABELS, SHEETS, raw_text  # noqa: E402
from resolve import Resolver  # noqa: E402

SRC = os.path.dirname(os.path.abspath(__file__))


def toks(s):
    # a track prints as "__/120": the underscores are the box to write in, not a value
    return [re.sub(r"^_+", "", t) for t in s.split()]


def record_words(r):
    w = [r["Name"], r["Rank"]]
    for a in r["Abilities"]:
        w += [a["Ability Score"], a["Defense Score"], a["Non-Combat Checks"]]
    for d in r["Damage"]:
        w += [d["Multiplier"], d["Ability Score"]]
    w += ["/" + r["Karma"], "/" + r["Health"]] + ([r["Health Damage Reduction"]] if r["Health Damage Reduction"] else [])
    w += ["/" + r["Focus"]] + ([r["Focus Damage Reduction"]] if r["Focus Damage Reduction"] else [])
    w += [r["Initiative Modifier"]]
    for i, s in enumerate(r["Speeds"]):
        w += [s["Speed"]] if i < 3 else [s["Mode"] + ":", s["Speed"]]
    for f in ("Real Name", "Height", "Weight", "Gender", "Eyes", "Hair", "Size", "Distinguishing Features",
              "Occupation", "Origin", "Teams", "Base"):
        w += r[f].split()
    for p in r["History"] + [r["Current Age"]] + r["Personality"]:
        w += p.split()
    for s in r["Sections"]:
        w += s["Heading"].split() + " ".join(s["Description"]).split() + [s["Rule"]]
    for e in r["Entries"]:
        w += e["printed"].split()
    return w


def main():
    fail = 0
    recs = json.load(open(os.path.join(SRC, "sheets.json"), encoding="utf-8"))
    if [r["Hero"] for r in recs] != HEROES:
        print("  HEROES — sheets.json holds %r" % [r["Hero"] for r in recs])
        fail = 1
    R = Resolver()
    statuses = Counter()
    for r in recs:
        hero = r["Hero"]
        path = os.path.join(SHEETS, hero + ".txt")
        txt = open(path, encoding="utf-8").read()
        if txt != raw_text(os.path.join(SHEETS, hero + ".pdf")):
            print("  RECORD — %s.txt is not the PDF's text layer" % hero)
            fail = 1
        # a word broken at a line's end (the sheet's own hyphen) is one word in the record
        joined = re.sub(r"(?<=[A-Za-z])-\n", "-", txt.replace("\f", "\n"))
        have = Counter(toks(joined))
        want = Counter(toks(" ".join(LABELS * r["Label runs"] + ["NAME"] * (r["Label runs"] - 1))) + record_words(r))
        # the art credit closes each page's labels: "Art :" on a one-page sheet and on page 1 of
        # two, "Art Author Art :" on page 2
        want.update(["Art", ":"] * r["Label runs"])
        want.update(["Author", "Art"] * (r["Label runs"] - 1))
        extra, missing = have - want, want - have
        if extra or missing:
            fail = 1
            print("  WORDS — %s: on the sheet, not in the record: %s" % (hero, dict(extra)))
            print("          %s: in the record, not on the sheet: %s" % (hero, dict(missing)))
        for e in r["Entries"]:
            x = R.entry(e)
            statuses[x["status"]] += 1
            if x["status"] == "free" and e["section"] != "Weapons":
                print("  NAMES — %s: an entry that names nothing the corpus prints: %r" % (hero, e["printed"][:60]))
                fail = 1
    n = sum(len(r["Entries"]) for r in recs)
    print("check_sheets: %d sheets, %d entries (%s)" % (len(recs), n, ", ".join("%s %d" % kv for kv in sorted(statuses.items()))))
    print("check_sheets: %s" % ("FAILED" if fail else "OK"))
    return fail


if __name__ == "__main__":
    sys.exit(main())
