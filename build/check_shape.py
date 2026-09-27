#!/usr/bin/env python3
"""
check_shape.py — the fields the site reads, asserted against the corpus's own counts.

verify_data.py proves every string arrives; it is blind to a string on the wrong field. This
checks the shapes system/marvelmultiverse/ will read — every typed set of the BASE, the two
ACTORs and the fields a profile prints, every row of every typed list (a profile's Speeds,
Ability Lines, Damage Lines, Traits and Tags, Power Groups and their Power Entries; a power's
Prerequisites; a tree's nodes…), every named value by its field name, the tables, the
sidebars — and every count is taken from a SCAN of the raw corpus text (regexes and a bracket
counter, sharing no code with the parser), never typed here.

    python3 build/check_shape.py [<path to titterpig-dsl-marvelmultiverse/0.5>]
"""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import BOOKS, DEFAULT_CORPUS  # noqa: E402
from verify_data import data_blobs  # noqa: E402

FAILS = []
N = [0]
DSL = (".ttrpg", ".actor", ".arc", ".frame", ".codex")


def check(label, got, want):
    N[0] += 1
    if got != want:
        FAILS.append("%s: data has %r, the corpus %r" % (label, got, want))


def dsl_paths(corpus):
    """The corpus's DSL files, in every subfolder (characters/) — never the coverage manifests
    or sources.json, which quote the corpus's own names."""
    return sorted(p for p in glob.glob(os.path.join(corpus, "**", "*"), recursive=True)
                  if os.path.isfile(p) and p.endswith(DSL))


def text_of(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


def scan(corpus, pattern):
    """How many lines of the raw corpus files match — the independent count."""
    rx = re.compile(pattern)
    return sum(1 for p in dsl_paths(corpus) for ln in text_of(p).splitlines() if rx.search(ln))


def scan_all(corpus, pattern, skip_base=False):
    """How many matches over the raw file text (a construct written several to a line)."""
    rx = re.compile(pattern)
    return sum(len(rx.findall(text_of(p))) for p in dsl_paths(corpus)
               if not (skip_base and text_of(p).lstrip().startswith("BASE ")))


def list_rows(corpus):
    """{type: rows} for every `LIST OF #h ^"Type" [ … ]` body in the corpus: the `DEF {` items at
    the list's own depth, counted by walking the brackets (strings skipped). Declarations
    (`LIST OF #h ^"Type"` with no body) count nothing."""
    head = re.compile(r'LIST OF #\S+ \^"((?:[^"\\]|\\.)*)"\s*\[')
    rows = {}
    for p in dsl_paths(corpus):
        t = text_of(p)
        for m in head.finditer(t):
            i, depth, n = m.end(), 1, 0
            while depth:
                c = t[i]
                if c == '"':
                    i += 1
                    while t[i] != '"':
                        i += 2 if t[i] == "\\" else 1
                elif c in "[{":
                    if depth == 1 and c == "{" and t[i - 4:i].rstrip().endswith("DEF"):
                        n += 1
                    depth += 1
                elif c in "]}":
                    depth -= 1
                i += 1
            rows[m.group(1)] = rows.get(m.group(1), 0) + n
    return rows


def main():
    corpus = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CORPUS
    books, others = data_blobs()
    E = {}
    for b in books:
        E.update(b["entities"])
    chapters = [c for b in books for c in b["book"]["chapters"]]
    index = next(o for o in others if isinstance(o, dict))
    records = next(o for o in others if isinstance(o, list))
    typed = lambda t: [e for e in E.values() if e.get("type") == t]
    prop = lambda e, n: next((p for p in e.get("props", []) if p["name"] == n), None)

    def walk():
        """Every node anywhere in the book data (every chapter's and entity's blocks, props,
        fields, list items), children excepted — they are entities of their own."""
        stack = [c.get("blocks") for c in chapters] + [[e] for e in E.values()]
        while stack:
            x = stack.pop()
            if isinstance(x, list):
                stack.extend(x)
            elif isinstance(x, dict):
                yield x
                for k, v in x.items():
                    if k != "children" and isinstance(v, (list, dict)):
                        stack.append(v)

    nodes = list(walk())
    deep = lambda test: sum(1 for x in nodes if test(x))
    files = lambda ext: [p for p in dsl_paths(corpus) if p.endswith("." + ext)] if ext != "lore" else \
        glob.glob(os.path.join(corpus, "**", "*.lore"), recursive=True)

    # ── the books and files ──
    check("books", len(books), len(BOOKS))
    check("chapters (every corpus file, subfolders too)", len(chapters),
          sum(len(files(x)) for x in ("ttrpg", "actor", "arc", "frame", "codex", "lore")))
    for ext in ("ttrpg", "actor"):
        check("%s chapters" % ext, sum(1 for c in chapters if c["kind"] == ext), len(files(ext)))
    for b in BOOKS:
        check("%s chapters" % b["id"], sum(1 for c in chapters if c["book"] == b["id"]) if chapters and "book" in chapters[0]
              else len(next(x for x in books if x["book"]["id"] == b["id"])["book"]["chapters"]),
              sum(1 for p in dsl_paths(corpus) if os.path.basename(p).startswith("marvelmultiverse-0.5-%s-" % b["prefix"])))
    check("every entity hashed in the corpus (no id written here)", sum(1 for e in E.values() if e.get("synthetic")), 0)
    check("entities = hashed DEF/ACTOR heads in the corpus", len(E),
          scan(corpus, r'^\s*#\S+ (?:\^"(?:[^"\\]|\\.)*"|ACTOR "[^"]+") DEF \{\s*$'))

    # ── every typed set: an entity per `EXTENDS #h ^"Type"` line (a same-named EXTENDS is a copy) ──
    rx = re.compile(r'^\s*(?:#\S+ )?(?:\^|ACTOR )"((?:[^"\\]|\\.)*)" DEF \{\s*$|^\s*EXTENDS #\S+ \^"([^"]+)"\s*$')
    want = {}
    for p in dsl_paths(corpus):
        last = None
        for ln in text_of(p).splitlines():
            m = rx.match(ln)
            if not m:
                continue
            if m.group(1) is not None:
                last = m.group(1)
            elif m.group(2) != last:
                want[m.group(2)] = want.get(m.group(2), 0) + 1
    for t in sorted(want):
        check("typed %r" % t, len(typed(t)), want[t])
    check("types met", len(want) >= 25, True)

    # ── the BASE: two ACTORs, and the fields a profile prints ──
    base = next(c for c in chapters if c.get("container") == "BASE")
    xtypes = next(c for c in chapters if c["file"] == "marvelmultiverse-0.5-x-men-types.ttrpg")
    actors = {e["name"]: e for e in E.values() if e["form"] == "ACTOR"}
    declared = re.findall(r'ACTOR "([^"]+)" DEF', text_of(os.path.join(corpus, base["file"])) + text_of(os.path.join(corpus, xtypes["file"])))
    check("ACTORs declared", sorted(actors), sorted(declared))
    ch = actors.get("Character") or {}
    for f in ("Name", "Rank", "Karma", "Health", "Health Damage Reduction", "Focus", "Focus Damage Reduction",
              "Initiative Modifier", "Speeds", "Abilities", "Damage", "Traits", "Tags", "Real Name", "Size",
              "Occupation", "Origin", "Teams", "Base", "History", "Personality", "Biography Sections", "Powers"):
        check("ACTOR Character declares %s" % f, prop(ch, f) is not None, True)
    xm = actors.get("X-Men Expansion Character") or {}
    check("X-Men Expansion Character EXTENDS Character", xm.get("type"), "Character")
    for f in ("Notes", "Reliances"):
        check("ACTOR X-Men Expansion Character declares %s" % f, prop(xm, f) is not None, True)
    ability = next((e for e in E.values() if e["name"] == "Ability" and e["file"] == base["file"]), {})
    check("Ability Name ENUM (the six)", len((prop(ability, "Name") or {}).get("options", [])), 6)

    # ── the profiles: one per .actor file ──
    chars = typed("Character") + typed("X-Men Expansion Character")
    check("profiles in .actor files", sum(1 for e in chars if e["file"].endswith(".actor")), len(files("actor")))
    check("profiles with six Ability Lines",
          sum(1 for e in chars if e["file"].endswith(".actor") and len((prop(e, "Abilities") or {}).get("items") or []) == 6),
          sum(1 for p in files("actor") if len(re.findall(r'\^"Ability" STRING "[^"]*"  \^"Ability Score"', text_of(p))) == 6))

    # ── every row of every typed list, by the list's type ──
    rows = list_rows(corpus)
    got = {}
    for x in nodes:
        if x.get("vk") == "list" and x.get("ofHash"):
            got[x["of"]] = got.get(x["of"], 0) + len(x.get("items") or [])
    for t in sorted(set(rows) | set(got)):
        check("rows of LIST OF %r" % t, got.get(t, 0), rows.get(t, 0))
    check("typed list row kinds met", len(rows) >= 15, True)

    # ── every named value, by its field name (a value on the wrong field fails here) ──
    val = re.compile(r'\^"((?:[^"\\]|\\.)*)" (?:STRING|INTEGER) (?:"|-?\d)')
    want_v = {}
    for p in dsl_paths(corpus):
        for m in val.finditer(text_of(p)):
            want_v[m.group(1)] = want_v.get(m.group(1), 0) + 1
    got_v = {}
    for x in nodes:
        if x.get("vk") == "scalar" and "value" in x and x.get("dtype") in ("STRING", "INTEGER"):
            got_v[x["name"]] = got_v.get(x["name"], 0) + 1
    for n in sorted(set(want_v) | set(got_v)):
        check("values of %r" % n, got_v.get(n, 0), want_v.get(n, 0))

    # ── tables and sidebars ──
    check("TABLE blocks", sum(1 for e in E.values() if e.get("table")) + deep(lambda x: x.get("kw") == "TABLE"), scan(corpus, r'^\s*TABLE \{'))
    check("table ROWs", sum(len(e["table"].get("rows", [])) for e in E.values() if e.get("table"))
          + deep(lambda x: x.get("kw") == "ROW"), scan(corpus, r'^\s*ROW\b'))
    check("GUIDANCE entries", sum(len(e.get("guidance", [])) for e in E.values()) + deep(lambda x: x.get("kw") == "ENTRY"), scan(corpus, r'^\s*ENTRY '))
    check("GUIDANCE entries that CONCERN something",
          sum(1 for e in E.values() for g in e.get("guidance", []) if g.get("concerns")) + deep(lambda x: x.get("kw") == "CONCERNS"),
          scan(corpus, r'^\s*CONCERNS \['))
    check("DESCRIPTIONs", sum(1 for e in E.values() if "desc" in e) + deep(lambda x: x.get("kw") == "DESCRIPTION"), scan(corpus, r'^\s*DESCRIPTION "'))

    # ── records ──
    check("records carry every typed entity", sum(1 for r in records if r.get("type")), sum(1 for e in E.values() if e.get("type")))
    check("index counts entities", index["counts"]["entities"], len(E))

    print("check_shape: %s (%d assertions)" % ("OK" if not FAILS else "%d FAILED" % len(FAILS), N[0]))
    for f in FAILS:
        print("  " + f)
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
