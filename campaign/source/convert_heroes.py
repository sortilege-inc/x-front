#!/usr/bin/env python3
"""
convert_heroes.py — campaign/source/sheets.json → the campaign's DSL layer:

    campaign/dsl/heroes/x-front-<hero>.actor   one profile per hero, on the corpus's ACTOR "Character"
    campaign/dsl/x-front.ttrpg                 the powers whose wording is the hero's own

    python3 campaign/source/convert_heroes.py

Every value is the sheet's, as check_sheets.py proved it; nothing is typed here. How an entry lands:

  * a trait or tag → `Traits` / `Tags` (by the corpus's kind): Name the corpus's name (so the page
    opens the book's entry), Detail what the sheet prints in parentheses, Printed the sheet's
    heading as printed ("Signature Attack (Supernova)").
  * a power → a `Powers` group: the sheet's heading over it (a heading printed twice, or once and
    then again shortened on page 2, is one group), or "Basic" — the book's own word in its profiles
    for powers of no set — for the powers the sheet lists before any heading. Name the corpus's name,
    Printed the sheet's heading as printed, its terms included ("Evil Eye (Standard, Concentration,
    Cost: 5 Focus per turn, Range: 10 spaces)": the sheet works the book's "5 spaces per rank" out
    for the hero's rank).
  * a power whose wording is the hero's own (resolve.py `own`: the element's special effect written
    in) → a Power of this layer, "<Power> (<Hero>)", its Effect the sheet's text word for word; the
    profile's entry names it.
  * Half-Life's knife → the `Weapons` group, as printed; the note under it is the book's.
  * a heading's description (Stasis's Velocity) and the age line → `Biography Sections`.
"""
import base64
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from resolve import Resolver  # noqa: E402

SRC = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(SRC))
DSL = os.path.join(ROOT, "campaign", "dsl")

T_CHARACTER = '#mmrpgCharacter0000000 ^"Character"'
T_POWER = '#mmrpgPower000000000000 ^"Power"'
T_SPEED = '#mmrpgSpeed00000000000 ^"Speed"'
T_ABILITY = '#mmrpgAbilityLine00000 ^"Ability Line"'
T_DAMAGE = '#mmrpgDamageLine000000 ^"Damage Line"'
T_TRAIT = '#mmrpgProfileTrait0000 ^"Profile Trait"'
T_BIO = '#mmrpgBioSection000000 ^"Biography Section"'
T_GROUP = '#mmrpgPowerGroup000000 ^"Power Group"'
T_ENTRY = '#mmrpgPowerEntry000000 ^"Power Entry"'


def hid(key):
    """A stable 22-character id: '#xf' + 20 of the key's hash (base62-ish, no padding)."""
    b = base64.b64encode(hashlib.sha256(key.encode("utf-8")).digest()).decode()
    return "#xf" + re.sub(r"[^A-Za-z0-9]", "", b)[:20]


def q(s):
    return json.dumps(s, ensure_ascii=False)


def row(fields):
    return "DEF { " + "  ".join('^"%s" STRING %s' % (k, q(v)) for k, v in fields if v not in (None, "")) + " }"


def lst(name, typ, rows, indent="        "):
    if not rows:
        return None
    inner = (",\n" + indent + "    ").join(rows)
    return '%s^"%s" LIST OF %s [\n%s    %s\n%s]' % (indent, name, typ, indent, inner, indent)


def title_of(e):
    """The entry's heading as the sheet prints it: everything before the ':' or ' [' that opens its
    text (the whole entry, when it has none)."""
    p = e["printed"]
    t = e["text"]
    if e["style"] == "colon":
        return p[:len(p) - len(t)].rstrip().rstrip(":").rstrip() if t else p.rstrip(":")
    if e["style"] == "bracket":
        return p[:p.rindex("[" + t + "]")].rstrip()
    return p


def main():
    R = Resolver()
    recs = json.load(open(os.path.join(SRC, "sheets.json"), encoding="utf-8"))
    os.makedirs(os.path.join(DSL, "heroes"), exist_ok=True)
    own_powers = []
    written = []
    for r in recs:
        hero = r["Hero"]
        traits, tags, groups, weapons = [], [], [], []
        order = {}

        def group(name):
            # one group per printed heading; a later heading that the first begins with (page 2's
            # "Elemental Control" after "Elemental Control (Electricity/Energy)") continues it
            for g in groups:
                if g["Set"] == name or g["Set"].startswith(name + " ") or name.startswith(g["Set"] + " "):
                    return g
            g = {"Set": name, "Powers": []}
            groups.append(g)
            return g

        for e in r["Entries"]:
            x = R.entry(e)
            printed = title_of(e)
            if x["status"] == "free":
                weapons.append([("Name", printed.split(" (")[0]), ("Printed", printed)])
                continue
            ent = x["entity"]
            if x["kind"] in ("Trait", "Tag"):
                detail = e["group"] or e["qualifier"]
                (traits if x["kind"] == "Trait" else tags).append([("Name", ent["name"]), ("Detail", detail), ("Printed", printed)])
                continue
            name = ent["name"]
            if x["status"] == "own":
                name = "%s (%s)" % (ent["name"], hero)
                own_powers.append({"key": "power:" + name, "name": name, "sets": [i["s"] for p in ent["props"] if p["name"] == "Power Sets" for i in p["items"]],
                                   "heading": e["section"], "effect": e["text"], "hero": hero, "book": ent["name"]})
            g = group(e["section"] or "Basic")
            g["Powers"].append([("Name", name), ("Printed", printed)])
        if weapons:
            groups.append({"Set": "Weapons", "Powers": weapons})

        bio = [[("Heading", r["Current Age"].split(":")[0]), ("Text", r["Current Age"].split(":", 1)[1].strip())]]
        for s in r["Sections"]:
            if s["Description"]:
                bio.append([("Heading", s["Heading"]), ("Text", "\n\n".join(s["Description"]))])

        props = ['        ^"Name" STRING %s' % q(r["Name"])]
        for k in ("Rank", "Karma", "Health", "Health Damage Reduction", "Focus", "Focus Damage Reduction", "Initiative Modifier"):
            props.append('        ^"%s" STRING %s' % (k, q(r[k])))
        props.append(lst("Speeds", T_SPEED, [row([("Mode", s["Mode"]), ("Speed", s["Speed"])]) for s in r["Speeds"]]))
        props.append(lst("Abilities", T_ABILITY, [row(list(a.items())) for a in r["Abilities"]]))
        props.append(lst("Damage", T_DAMAGE, [row(list(d.items())) for d in r["Damage"]]))
        props.append(lst("Traits", T_TRAIT, [row(t) for t in traits]))
        props.append(lst("Tags", T_TRAIT, [row(t) for t in tags]))
        for k in ("Real Name", "Height", "Weight", "Gender", "Eyes", "Hair", "Size", "Distinguishing Features", "Occupation", "Origin", "Teams", "Base"):
            if r[k]:
                props.append('        ^"%s" STRING %s' % (k, q(r[k])))
        props.append('        ^"History" STRING %s' % q("\n\n".join(r["History"])))
        props.append('        ^"Personality" STRING %s' % q("\n\n".join(r["Personality"])))
        props.append(lst("Biography Sections", T_BIO, [row(b) for b in bio]))
        grows = ['DEF { ^"Set" STRING %s  ^"Powers" LIST OF %s [%s] }' % (q(g["Set"]), T_ENTRY, ", ".join(row(p) for p in g["Powers"])) for g in groups]
        props.append(lst("Powers", T_GROUP, grows))

        slug = re.sub(r"[^a-z0-9]+", "-", hero.lower()).strip("-")
        body = ("# source: campaign/source/sheets/%s.pdf — the owner's short-form sheet (2025), by convert_heroes.py\n"
                "%s ^%s DEF {\n    EXTENDS %s\n    PROPERTIES {\n%s\n    }\n}\n"
                % (hero, hid("hero:" + hero), q(hero), T_CHARACTER, "\n".join(p for p in props if p)))
        path = os.path.join(DSL, "heroes", "x-front-%s.actor" % slug)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(body)
        written.append(path)

    # the layer's own powers
    lines = ['EXTENSION "X_Front" EXTENDS "marvelmultiverse" {',
             '    NAME "X-FRONT: the heroes’ own powers"',
             '    VERSION "0.1.0"',
             '    SPEC_VERSION "0.5"',
             '    RELEASE_DATE "2026-09-28"',
             '',
             '    # Generated by campaign/source/convert_heroes.py from the heroes’ sheets. A power here is one',
             '    # the book prints, as the hero’s sheet words it: the book leaves the Fantastic success to "the',
             '    # elemental type’s special effect" and tells a player to write their own element in (Elemental',
             '    # Control); each sheet did. The Effect is the sheet’s, word for word.',
             '']
    for p in own_powers:
        lines.append('    # %s’s sheet, under “%s”; the book’s power is %s' % (p["hero"], p["heading"], p["book"]))
        lines.append('    %s ^%s DEF {' % (hid(p["key"]), q(p["name"])))
        lines.append('        EXTENDS %s' % T_POWER)
        lines.append('        PROPERTIES {')
        lines.append('            ^"Power Sets" LIST OF STRING [%s]' % ", ".join(q(s) for s in p["sets"]))
        lines.append('            ^"Printed Power Set" STRING %s' % q(p["heading"]))
        lines.append('            ^"Effect" STRING %s' % q(p["effect"]))
        lines.append('        }')
        lines.append('    }')
    lines.append('}')
    path = os.path.join(DSL, "x-front.ttrpg")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    written.append(path)
    print("convert_heroes: %d heroes, %d own powers → %s" % (len(recs), len(own_powers), ", ".join(os.path.relpath(w, ROOT) for w in written)))


if __name__ == "__main__":
    main()
