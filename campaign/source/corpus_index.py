"""
corpus_index.py — the corpus's traits, tags, powers and power sets, read from the built books
(data/*.js, upstream's build) so the sheet scripts resolve a name exactly as the pages do.

    from corpus_index import corpus
    c = corpus()          # {'Trait': {name: entity}, 'Tag': {...}, 'Power': {...}, 'Power Set': {...}}
    text_of(entity)       # the words a sheet would copy: a trait's or tag's desc, a power's Effect
"""
import json
import os
import re

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLOB = re.compile(r"var d=(\{.*\});var T=window\.MARVELMULTIVERSE", re.S)
KINDS = ("Trait", "Tag", "Power", "Power Set")


def corpus():
    out = {k: {} for k in KINDS}
    data = os.path.join(HERE, "data")
    for fn in sorted(os.listdir(data)):
        if not fn.endswith(".js") or fn in ("index.js", "records.js"):
            continue
        m = BLOB.search(open(os.path.join(data, fn), encoding="utf-8").read())
        if not m:
            continue
        for h, e in json.loads(m.group(1))["entities"].items():
            if e.get("type") in KINDS:
                # the core wins a name both books print (data.js `named`)
                have = out[e["type"]].get(e["name"])
                if have is None or (have["book"] != "core" and e["book"] == "core"):
                    out[e["type"]][e["name"]] = e
    return out


def prop(e, name):
    for p in e.get("props", []):
        if p.get("name") == name and p.get("vk") == "scalar":
            return p.get("value")
    return None


def text_of(e):
    """The rules text a sheet copies for this entity."""
    if e["type"] == "Power":
        return prop(e, "Effect") or ""
    return e.get("desc") or ""
