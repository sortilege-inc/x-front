#!/usr/bin/env python3
"""
verify_data.py — the content gate, in both directions, and by count:

  1. COVERAGE — every string the corpus prints (every STR and every caret name in every DSL
     file, and every non-blank line of every .lore file) reaches the book data files
     (data/<book>.js) AT LEAST AS MANY TIMES as the corpus prints it — except the container-
     header metadata listed in SKIP_KEYWORDS, each with its reason. Counting, not mere
     presence: in this corpus a name like "Earth" or "Fitness" is printed thousands of times,
     so a dropped `CHOOSE 1 [^"Earth", ^"Fire"]` would pass a presence check unseen.
  2. FIDELITY — every string in data/*.js came from the corpus. A coverage check alone lets
     invented or mangled text through; a fidelity check alone lets a dropped table through.
     Neither finds what the other does.

Skips are by KEY name only, never by value, and each skipped key says why.

Exit 0 = both clean. Never weaken this to make a build pass: fix the build.

    python3 build/verify_data.py [<path to titterpig-dsl-marvelmultiverse/0.5>]
"""
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_dsl import tokenize, unescape, lift_rule_lines  # noqa: E402
from build_data import BOOKS, DEFAULT_CORPUS, KINDS, LORE_EXTS, corpus_files  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_KEYWORDS = {
    "VERSION": "DSL content version of the source file",
    "SPEC_VERSION": "Titterpig spec version of the source file",
    "RELEASE_DATE": "conversion date of the source file",
}
# Words the DSL grammar itself uses that survive into the data as field labels, not as text.
TYPE_WORDS = {"STRING", "INTEGER", "BOOLEAN", "FLOAT", "TEXT", "DEF", "TEMPLATE", "ACTOR",
              "LIST", "ENUM", "REF", "CHOICE", "VALUE", "EXTENSION", "BASE", "ARC", "FRAME",
              "CODEX", "ENTITY"}
# Keys whose values this build writes itself, or that hold a bare DSL word. By key, never
# by value.
BUILD_KEYS = {
    "id": "entity, book and record ids",
    "hash": "a reference's target id",
    "typeHash": "the id of the type a DEF EXTENDS",
    "ofHash": "the id bound to a LIST OF type",
    "h": "an id given as an argument",
    "ent": "the id of a nested entity, left where it stood",
    "rule": "a RULES line's id",
    "parent": "the enclosing entity's id",
    "children": "ids of nested entities",
    "roots": "ids of a chapter's top-level entities",
    "entities": "ids of a book's top-level entities",
    "book": "which book this file's data belongs to",
    "file": "the corpus file an entity or chapter came from",
    "src": "this data file's own path",
    "main": "the data file paths of a book",
    "vk": "the shape of a property value (scalar/list/ref/def/enum/…)",
    "dtype": "a property's declared type word (STRING, INTEGER…)",
    "kw": "a DSL keyword (CURRICULUM, RANK, PARTS…)",
    "w": "a bare DSL word — grammar (MIN, TO), a tag ([kata]) or a rule slug",
    "slot": "the DSL keyword block an entity was nested in",
    "kind": "the book kind or chapter kind this build assigns",
    "form": "the entity's declaration form (DEF / ACTOR / ENTITY)",
    "container": "the file's container word (BASE / EXTENSION / ARC / FRAME / CODEX)",
    "module": "the file's container name — module identifier, header metadata",
    "moduleExtends": "the container's EXTENDS name — header metadata",
    "system": "the system id from engine/config.js",
    "versionOf": "the id of the character an archived sheet is a version of",
    "copyOf": "the entity a character's same-named DEF prints a copy of ({hash, name}; the name is checked)",
}
BLOB = re.compile(r"var d=(\{.*?\});var T=window\.MARVELMULTIVERSE", re.S)
INDEX_BLOB = re.compile(r"T\.index=(\{.*\});\}\)\(\);", re.S)
RECORDS_BLOB = re.compile(r"T\.records=(\[.*\]);\}\)\(\);", re.S)
CONTAINERS = ("BASE", "EXTENSION", "ARC", "FRAME", "SETTING", "CAMPAIGN", "CODEX")


def lore_lines(text):
    return [ln for ln in text.split("\n") if ln.strip()]


def corpus_strings(corpus):
    """Every string the corpus prints, with how many times it prints it."""
    return strings_of(corpus, corpus_files(corpus))


def strings_of(root, rels):
    """Every string these DSL and .lore files print, counted — the corpus, or an instance's
    layer (build/build_layer.py), by the one rule."""
    want, skipped = Counter(), Counter()
    for rel in sorted(rels):
        path = os.path.join(root, rel)
        text = open(path, encoding="utf-8").read()
        if rel.endswith(LORE_EXTS):
            for ln in lore_lines(text):
                want[ln] += 1
            continue
        toks = tokenize(lift_rule_lines(text))
        i = 0
        # the container header: KIND "id" [EXTENDS "parent"] — module identifiers, not text
        if toks and toks[0].kind == "ID" and toks[0].val in CONTAINERS:
            skipped[toks[1].val] += 1
            i = 2
            if len(toks) > 3 and toks[2].kind == "ID" and toks[2].val == "EXTENDS":
                skipped[toks[3].val] += 1
                i = 4
        while i < len(toks):
            t = toks[i]
            if t.kind == "ID" and t.val in SKIP_KEYWORDS:
                j = i + 1
                while j < len(toks) and toks[j].kind in ("STR", "INT"):
                    if toks[j].kind == "STR":
                        skipped[unescape(toks[j].val)] += 1
                    j += 1
                i = j
                continue
            if t.kind == "STR":
                want[unescape(t.val)] += 1
            elif t.kind == "CARET":
                want[t.val] += 1
            i += 1
    return want, skipped


def data_blobs():
    books, others = [], []
    for fn in sorted(os.listdir(os.path.join(HERE, "data"))):
        if not fn.endswith(".js"):
            continue
        src = open(os.path.join(HERE, "data", fn), encoding="utf-8").read()
        m = BLOB.search(src)
        if m:
            books.append(json.loads(m.group(1)))
            continue
        m = INDEX_BLOB.search(src) or RECORDS_BLOB.search(src)
        if not m:
            raise SystemExit("verify_data: %s is not in the expected shape" % fn)
        others.append(json.loads(m.group(1)))
    return books, others


def data_strings(blobs):
    """Every string in these blobs, counted — a lore chapter's text counted line by line."""
    got = Counter()

    def walk(n):
        if isinstance(n, dict):
            lore = n.get("kind") == "lore" and isinstance(n.get("text"), str)
            for k, v in n.items():
                if k in BUILD_KEYS and not isinstance(v, (dict, list)):
                    continue
                if k in BUILD_KEYS and isinstance(v, list) and all(isinstance(x, str) for x in v):
                    continue                     # lists of ids / paths; the entity map is a dict
                if lore and k == "text":
                    for ln in lore_lines(v):
                        got[ln] += 1
                    continue
                walk(v)
        elif isinstance(n, list):
            for x in n:
                walk(x)
        elif isinstance(n, str):
            got[n] += 1                          # ids never reach here: they sit under BUILD_KEYS
    for b in blobs:
        walk(b)
    return got


def main():
    corpus = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CORPUS
    want, skipped = corpus_strings(corpus)
    books, others = data_blobs()
    in_books = data_strings(books)
    everywhere = in_books + data_strings(others)

    # text this build writes of its own: the book labels, the kinds, the data file paths, and
    # the DSL's own type words as field labels.
    ours = set(TYPE_WORDS) | KINDS | {b["label"] for b in BOOKS} | {"data/%s.js" % b["id"] for b in BOOKS}

    missing = sorted(k for k in want if k not in in_books)
    short = sorted(k for k in want if k in in_books and in_books[k] < want[k])
    unsourced = sorted(k for k in everywhere if k not in want and k not in ours and k not in skipped)

    print("verify_data: the corpus prints %d distinct strings, %d in all (DSL strings and .lore lines; %d header values skipped by keyword)"
          % (len(want), sum(want.values()), len(skipped)))
    for label, rows, fmt in (("UNCOVERED — in the corpus, not in the book data", missing, lambda s: "%r" % s[:130]),
                             ("SHORT — printed more often than the book data carries it", short, lambda s: "%r ×%d in the corpus, ×%d in data" % (s[:100], want[s], in_books[s])),
                             ("UNSOURCED — in data/, not in the corpus", unsourced, lambda s: "%r" % s[:130])):
        if rows:
            print("  %s: %d" % (label, len(rows)))
            for s in rows[:25]:
                print("    " + fmt(s))
    if not (missing or short or unsourced):
        print("  %d strings (%d occurrences) — 0 uncovered · 0 short · 0 unsourced; every string round-trips, every time it is printed"
              % (len(want), sum(want.values())))
    return 1 if (missing or short or unsourced) else 0


if __name__ == "__main__":
    sys.exit(main())
