#!/usr/bin/env python3
"""
build_data.py — the Marvel Multiverse corpus (titterpig-dsl-marvelmultiverse/0.5) → data/*.js.

Everything the site shows comes from here; nothing is hand-typed. The shape is GENERIC and
hash-keyed — the engine reads it without knowing the game, and system/marvelmultiverse/
interprets it:

    window.MARVELMULTIVERSE.index           { system, counts, books: [ … ] }       data/index.js
    window.MARVELMULTIVERSE.records         [ {id, name, book, type, under, …} ]   data/records.js
    window.MARVELMULTIVERSE.books[<id>]     { id, label, kind, chapters: [ … ], entities: [root ids] }
    window.MARVELMULTIVERSE.entities[<h>]   { id, name, book, file, form, type, applies, parent,
                                              slot, children, desc, props, table, guidance, refs,
                                              rules, blocks }

Carried whole from sortilege-vtt-l5r5e (its decision 4, the lossless shaped dump), because it
already knows nothing of the game:

  * **Any DEF that is not a property value is an entity**, hashed or not; an unhashed one gets
    an id this build writes (`u:` + a digest of its file, its parent and its name — declared to
    the gate by key).

  * **Structure is typed blocks, not a fixed field set.** The build names only a handful of
    keywords (DESCRIPTION, PROPERTIES, EXTENDS, APPLIES TO, TABLE, GUIDANCE, REFERENCES, RULES)
    and carries EVERY other node into `blocks`, losslessly, in the corpus's order: a keyword as
    `{kw, args, body}`, a numbered row as `{num, args, body}`, a bare string as `{s, …}`, a
    property by its value, a nested entity as `{ent: id}`. A file's own top-level nodes that are
    not entities are its chapter's `blocks`.

  * **Books by file-name prefix** (`marvelmultiverse-0.5-<book>-<chapter>`); BOOKS below is the
    map, the only hand-written list in the build, and every corpus file must be claimed by
    exactly one book or this exits non-zero. Two books: the Core Rulebook and the X-Men
    Expansion; their character profiles live in characters/, so a file's book is read from its
    name, not its path.

Every string is carried byte-for-byte from the DSL (only DSL escapes resolved); this file
decides shape alone. verify_data.py then proves the round trip in both directions, and
counts: each string at least as many times as the corpus prints it.

    python3 build/build_data.py [<path to titterpig-dsl-marvelmultiverse/0.5>]
"""
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_dsl import parse_files  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CORPUS = os.path.expanduser("~/Sortilege/Titterpig/DSL/titterpig-dsl-marvelmultiverse/0.5")
FILE_PREFIX = "marvelmultiverse-0.5-"

# ───────────────────────── the prefix → book map ─────────────────────────
#
# `label` is this build's own short name for the book (declared as ours to the gate); each
# chapter's own title is its file's NAME, verbatim. Kind `book` (rules, setting, profiles). Order:
# the core, then the expansions in publication order; a new book is one line more here.
BOOKS = [
    {"id": "core", "label": "Core Rulebook", "kind": "book", "prefix": "core"},
    {"id": "x-men", "label": "X-Men Expansion", "kind": "book", "prefix": "x-men"},
]
DSL_EXTS = (".ttrpg", ".actor", ".arc", ".frame", ".codex")
LORE_EXTS = (".lore",)
KINDS = {b["kind"] for b in BOOKS} | {e[1:] for e in DSL_EXTS + LORE_EXTS}

# the file's header keywords — module metadata, gated as skipped by verify_data.py
HEADER_KWS = ("VERSION", "SPEC_VERSION", "RELEASE_DATE")
# a printed page range in a file's opening comments: "(pages 57-62)", "(pp. 312-327)"
PAGE_RE = re.compile(r"(?:\(|source:\s+)(?:pages?|pp\.)\s+(\d+)")

# records: entities a view lists across books without loading them. A record is an entity
# with an EXTENDS type, or one whose body carries a RANK (a technique), or a codex ENTITY.
# The scalar fields a list shows (keys only, never values):
# a reference a list view needs: an archived sheet names the character it is a version of (an
# instance's layer — the sheet gathers them; the pregen list leaves them out)
REF_RECORD_FIELDS = {"Version Of": "versionOf"}
RECORD_FIELDS = ["Type", "Rank", "Real Name", "Occupation", "Origin", "Teams", "Size", "Action",
                 "Duration", "Cost", "Printed Power Set", "Set", "Ability", "Health", "Focus", "Karma"]


# ───────────────────────── AST helpers ─────────────────────────

def kws(body, name):
    return [x for x in (body or []) if x.get("n") == "kw" and x["kw"] == name]


def kw1(body, name):
    got = kws(body, name)
    return got[0] if got else None


def arg(node, kind):
    return next((a["v"] for a in (node or {}).get("args", []) if a["k"] == kind), None)


def kwstr(body, name):
    n = kw1(body, name)
    return arg(n, "str") if n else None


def elem_ref(e):
    if e.get("k") == "ref":
        return {"hash": e["hash"], "name": e["v"]}
    if e.get("k") == "hash":
        return {"hash": e["v"], "name": None}
    if e.get("k") == "caret":
        return {"hash": None, "name": e["v"]}
    return None


# ───────────────────────── values (lossless) ─────────────────────────

def gen_arg(a):
    """One argument of a keyword, a list element, a row: its kind and value. A bare DSL word
    (`kata`, `MIN`, a rule slug) travels under `w`, which the gate reads as grammar."""
    k = a["k"]
    if k == "str":
        return {"s": a["v"]}
    if k == "caret":
        return {"c": a["v"]}
    if k == "hash":
        return {"h": a["v"]}
    if k == "ref":
        return {"c": a["v"], "h": a["hash"]}
    if k == "int":
        return {"i": a["v"]}
    if k == "bool":
        return {"b": a["v"]}
    if k == "id":
        return {"w": a["v"]}
    if k == "list":
        return {"l": [gen_arg(x) for x in a["v"]]}
    if k == "def":
        return {"d": [gen(x, None) for x in a["body"]]}
    raise SystemExit("build_data: unknown argument kind %r" % k)


def prop_value(p, ctx):
    """A property: its name, and its value by declared shape. A DEF-valued property keeps
    every node of its body — its fields as fields, anything else (a CHOOSE, a FORMULA) as
    blocks — so `^"Ring Increase" DEF { CHOOSE 1 [^"Earth", ^"Fire"] INTEGER 1 }` arrives
    whole."""
    v = {"name": p["name"]}
    t = p.get("type")
    for m in ("min", "max", "required", "fixed", "default"):
        if m in p:
            v[m] = p[m]
    if t == "DEF":
        v["vk"] = "def"
        v["fields"] = []
        v["blocks"] = []
        for x in p.get("body") or []:
            if x.get("n") == "prop":
                v["fields"].append(prop_value(x, ctx))
            else:
                v["blocks"].append(gen(x, ctx))
        if not v["blocks"]:
            del v["blocks"]
        return v
    if t == "LIST":
        v["vk"] = "list"
        if p.get("of"):
            v["of"] = p["of"]
            if p.get("of_kind") == "id":
                v["ofWord"] = True
        if p.get("of_hash"):
            v["ofHash"] = p["of_hash"]
        if "items" in p:
            v["items"] = [gen_arg(e) for e in p["items"]]
        return v
    if t == "ENUM":
        v["vk"] = "enum"
        if "options" in p:
            v["options"] = p["options"]
        if "value" in p:
            v["value"] = p["value"]
        return v
    if t == "REF":
        v["vk"] = "ref"
        v["ref"] = {"hash": p.get("hash"), "name": p.get("ref")}
        return v
    if t == "CHOICE":
        v["vk"] = "choice"
        if "pick" in p:
            v["pick"] = p["pick"]
        v["items"] = [gen_arg(e) for e in p.get("items", [])]
        return v
    if t == "TAGGED":
        v["vk"] = "tagged"
        v["tags"] = [gen_arg(e) for e in p["tags"]]
        return v
    if t == "BLOCK":
        v["vk"] = "block"
        v["body"] = [gen(x, ctx) for x in p["body"]]
        return v
    if t is None:
        v["vk"] = "name"                      # a bare ^"Name" line (FAMILIES, a list of names)
        return v
    v["vk"] = "scalar"
    if t != "VALUE":
        v["dtype"] = t
    if "value" in p:
        v["value"] = p["value"]
    return v


def gen(x, ctx):
    """Any node, generically and losslessly. `ctx` collects the entities met (a DEF that is not
    a property value, a codex ENTITY) — each becomes its own record, left here as {ent: id}."""
    n = x.get("n")
    if n == "entity":
        return {"ent": ctx.entity(x["hash"], x.get("kind"), x["name"], x["body"])}
    if n == "prop":
        if x.get("type") == "DEF" and ctx is not None and ctx.defs_are_entities:
            return {"ent": ctx.entity(None, None, x["name"], x["body"])}
        return prop_value(x, ctx)
    if n == "kw":
        if ctx is not None and x["kw"] == "ENTITY" and x.get("body") is not None:
            h = arg(x, "hash")
            nm = arg(x, "caret")
            if nm is not None:
                return {"ent": ctx.entity(h, "ENTITY", nm, x["body"])}
        out = {"kw": x["kw"], "args": [gen_arg(a) for a in x["args"]]}
        if x.get("body") is not None:
            inner = ctx.child(x["kw"]) if ctx is not None else None
            out["body"] = [gen(y, inner) for y in x["body"]]
        return out
    if n == "str":
        out = {"s": x["v"]}
        if x.get("args"):
            out["args"] = [gen_arg(a) for a in x["args"]]
        if x.get("body") is not None:
            out["body"] = [gen(y, ctx) for y in x["body"]]
        return out
    if n == "row":
        out = {"num": x["num"], "args": [gen_arg(a) for a in x["args"]]}
        if x.get("def"):
            out["def"] = True
        if x.get("body") is not None:
            out["body"] = [gen(y, ctx) for y in x["body"]]
        return out
    if n == "rule":
        return {"rule": x["hash"], "text": x["text"]}
    raise SystemExit("build_data: unknown node %r" % n)


# ───────────────────────── entities ─────────────────────────

# Keywords whose body holds a DEF's own property VALUES — a DEF inside them is a field, not an
# entity. Everything else (PHASES, LOCATIONS, ENTRIES, the container body, a DEF's body) holds
# entities.
VALUE_BLOCKS = {"PROPERTIES"}


class Ctx:
    """Where the walk is: which file, which enclosing entity, which keyword block."""

    def __init__(self, build, doc, book, parent, slot, defs_are_entities=True):
        self.build, self.doc, self.book, self.parent, self.slot = build, doc, book, parent, slot
        self.defs_are_entities = defs_are_entities

    def child(self, kw):
        return Ctx(self.build, self.doc, self.book, self.parent, kw, kw not in VALUE_BLOCKS)

    def entity(self, h, form, name, body):
        return self.build.entity(self, h, form, name, body)


class Build:
    def __init__(self):
        self.entities = {}
        self.seen_synth = {}

    def synth_id(self, ctx, name):
        base = "%s|%s|%s" % (ctx.doc["file"], ctx.parent["id"] if ctx.parent else "", name)
        n = self.seen_synth.get(base, 0)
        self.seen_synth[base] = n + 1
        return "u:" + hashlib.sha1(("%s|%d" % (base, n)).encode("utf-8")).hexdigest()[:16]

    def entity(self, ctx, h, form, name, body):
        eid = h or self.synth_id(ctx, name)
        if eid in self.entities:
            raise SystemExit("build_data: duplicate entity id %s (%s and %s)"
                             % (eid, self.entities[eid]["file"], ctx.doc["file"]))
        rec = {
            "id": eid, "name": name, "form": form or "DEF", "book": ctx.book, "file": ctx.doc["file"],
            "parent": ctx.parent["id"] if ctx.parent else None, "slot": ctx.slot,
            "children": [], "props": [], "blocks": [],
        }
        if not h:
            rec["synthetic"] = True
        self.entities[eid] = rec
        if ctx.parent:
            ctx.parent["children"].append(eid)
        inner = Ctx(self, ctx.doc, ctx.book, rec, None)
        for x in body or []:
            self.place(rec, x, inner)
        for k in ("props", "blocks"):
            if not rec[k]:
                del rec[k]
        return eid

    def place(self, rec, x, ctx):
        """One node of an entity's body into its named field, or into `blocks`."""
        n = x.get("n")
        if n == "kw":
            k = x["kw"]
            if k == "DESCRIPTION" and "desc" not in rec and len(x["args"]) == 1 and x["args"][0]["k"] == "str" and x.get("body") is None:
                rec["desc"] = x["args"][0]["v"]
                return
            # `EXTENDS #h ^"<its own name>"`: a character's printing of an entity defined elsewhere
            # (an NPC's copy of a core technique, a reprint) — a link to that entity, not a type
            if k == "EXTENDS" and "type" not in rec and x.get("body") is None and len(x["args"]) == 2 \
                    and arg(x, "hash") and arg(x, "caret") == rec["name"]:
                rec["copyOf"] = {"hash": arg(x, "hash"), "name": arg(x, "caret")}
                return
            if k == "EXTENDS" and "type" not in rec and x.get("body") is None:
                rec["type"] = arg(x, "caret")
                if arg(x, "hash"):
                    rec["typeHash"] = arg(x, "hash")
                if len(x["args"]) == (2 if arg(x, "hash") else 1):
                    return
                del rec["type"]
                rec.pop("typeHash", None)
            if k == "APPLIES" and "applies" not in rec and len(x["args"]) == 2 and x["args"][0] == {"k": "id", "v": "TO"} and x["args"][1]["k"] == "list" and x.get("body") is None:
                rec["applies"] = [r for r in (elem_ref(e) for e in x["args"][1]["v"]) if r]
                if len(rec["applies"]) == len(x["args"][1]["v"]):
                    return
                del rec["applies"]
            if k == "PROPERTIES" and x.get("body") is not None and not x["args"]:
                pctx = ctx.child("PROPERTIES")
                for p in x["body"]:
                    if p.get("n") == "prop":
                        rec["props"].append(prop_value(p, pctx))
                    else:
                        rec["blocks"].append(gen(p, pctx))
                return
            if k == "RULES" and x.get("body") is not None and not x["args"] and all(y.get("n") == "rule" for y in x["body"]):
                rec.setdefault("rules", []).extend({"id": y["hash"], "text": y["text"]} for y in x["body"])
                return
            if k == "TABLE" and "table" not in rec and x.get("body") is not None and not x["args"]:
                t = table_of(x)
                if t is not None:
                    rec["table"] = t
                    return
            if k == "GUIDANCE" and x.get("body") is not None and not x["args"]:
                g = guidance_of(x)
                if g is not None:
                    rec.setdefault("guidance", []).extend(g)
                    return
            if k == "REFERENCES" and x.get("body") is not None and not x["args"]:
                r = refs_of(x)
                if r is not None:
                    rec.setdefault("refs", []).extend(r)
                    return
        if n == "prop" and x.get("type") != "DEF":
            rec["props"].append(prop_value(x, ctx))
            return
        rec["blocks"].append(gen(x, ctx))


def table_of(tb):
    """A printed table, cell for cell: COLUMNS then ROWs — only when that is ALL it holds."""
    cols, rows = None, []
    for y in tb["body"]:
        if y.get("n") == "kw" and y["kw"] == "COLUMNS" and len(y["args"]) == 1 and y["args"][0]["k"] == "list" and y.get("body") is None and cols is None:
            cols = y["args"][0]["v"]
        elif y.get("n") == "kw" and y["kw"] == "ROW" and len(y["args"]) == 1 and y["args"][0]["k"] == "list" and y.get("body") is None:
            rows.append(y["args"][0]["v"])
        else:
            return None
    if cols is None or any(c["k"] not in ("str", "int") for c in cols) or any(c["k"] not in ("str", "int") for r in rows for c in r):
        return None
    return {"columns": [c["v"] for c in cols], "rows": [[c["v"] for c in r] for r in rows]}


def guidance_of(gb):
    """§22 GUIDANCE: a sidebar, beside what it CONCERNS — only in the spec's own shape."""
    out = []
    for e in gb["body"]:
        if not (e.get("n") == "kw" and e["kw"] == "ENTRY" and e.get("body") is not None):
            return None
        g = {"name": arg(e, "caret"), "id": arg(e, "hash"), "concerns": [], "topics": [], "text": None}
        if len(e["args"]) != (1 if g["id"] is None else 2) - (0 if g["name"] is not None else 1):
            return None
        for y in e["body"]:
            if y.get("n") != "kw" or y.get("body") is not None:
                return None
            if y["kw"] == "CONCERNS" and len(y["args"]) == 1 and y["args"][0]["k"] == "list":
                refs = [elem_ref(z) for z in y["args"][0]["v"]]
                if not all(refs):
                    return None
                g["concerns"] = refs
            elif y["kw"] == "TOPICS" and len(y["args"]) == 1 and y["args"][0]["k"] == "list" and all(z["k"] == "str" for z in y["args"][0]["v"]):
                g["topics"] = [z["v"] for z in y["args"][0]["v"]]
            elif y["kw"] == "TEXT" and len(y["args"]) == 1 and y["args"][0]["k"] == "str" and g["text"] is None:
                g["text"] = y["args"][0]["v"]
            else:
                return None
        out.append(g)
    return out


def refs_of(rb):
    """§5c REFERENCES: `"label" -> #hash ^"Name"` lines, stand-off."""
    out = []
    for item in rb["body"]:
        if item.get("n") != "str" or item.get("body") is not None or len(item.get("args", [])) != 1:
            return None
        a = item["args"][0]
        out.append({"label": item["v"], "hash": a["hash"], "name": a["v"]})
    return out


# ───────────────────────── files ─────────────────────────

BANNER = ("/* Generated by build/build_data.py from titterpig-dsl-marvelmultiverse/0.5 — do not edit by hand.\n"
          "   Every string is verbatim from the DSL corpus; regenerate rather than patch. */\n")

REGISTER = """(function(){var d=%s;var T=window.MARVELMULTIVERSE=window.MARVELMULTIVERSE||{books:{},entities:{},loaded:{}};
T.loaded[d.src]=true;T.books[d.book.id]=d.book;
for(var h in d.entities){T.entities[h]=d.entities[h];}})();
"""


def corpus_files(corpus):
    out = set()
    for root, _dirs, files in os.walk(corpus):
        for fn in files:
            if fn.endswith(DSL_EXTS + LORE_EXTS):
                out.add(os.path.relpath(os.path.join(root, fn), corpus))
    return out


def book_of(fn):
    """The book a file belongs to: the longest prefix its name carries (the name, not the path:
    the corpus keeps its character profiles in characters/)."""
    fn = os.path.basename(fn)
    stem = fn[len(FILE_PREFIX):] if fn.startswith(FILE_PREFIX) else None
    if stem is None:
        return None
    hits = [b for b in BOOKS if stem == b["prefix"] + os.path.splitext(stem)[1]
            or stem.startswith(b["prefix"] + "-")]
    hits.sort(key=lambda b: -len(b["prefix"]))
    return hits[0]["id"] if hits else None


def claimed_files(corpus):
    """file → book id; raises if any corpus file is claimed by no book, or a book by no file."""
    on_disk = corpus_files(corpus)
    for b in BOOKS:
        b["_files"] = []
    unclaimed = []
    for fn in sorted(on_disk):
        bid = book_of(fn)
        if not bid:
            unclaimed.append(fn)
            continue
        next(b for b in BOOKS if b["id"] == bid)["_files"].append(fn)
    empty = [b["id"] for b in BOOKS if not b["_files"]]
    if unclaimed or empty:
        raise SystemExit("build_data: the prefix → book map is out of step with the corpus.\n"
                         "  in the corpus, claimed by no book: %s\n"
                         "  books with no file: %s" % (unclaimed or "none", empty or "none"))
    return on_disk


def first_page(path):
    """The first printed page the file's opening comments name, when they name one."""
    head = []
    for ln in open(path, encoding="utf-8"):
        s = ln.strip()
        if s.startswith("#") or not s or re.match(r'^[A-Z]+ "', s) or re.match(r'^(NAME|VERSION|SPEC_VERSION|RELEASE_DATE|DEPENDS_ON|FOR) ', s):
            head.append(s)
            if len(head) > 40:
                break
            continue
        break
    m = PAGE_RE.search("\n".join(head))
    return int(m.group(1)) if m else None


def lore_chapter(path, fn):
    text = open(path, encoding="utf-8").read()
    title = next((ln for ln in text.split("\n") if ln.startswith("# ")), None)   # the H1 line as written; the reader drops the "# "
    return {"file": fn, "kind": "lore", "name": title, "page": None, "text": text}


EXT_ORDER = {".ttrpg": 0, ".actor": 1, ".arc": 2, ".frame": 3, ".lore": 4, ".codex": 5}


# ───────────────────────── emit ─────────────────────────

def main():
    corpus = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CORPUS
    data_dir = os.path.join(HERE, "data")
    os.makedirs(data_dir, exist_ok=True)
    on_disk = claimed_files(corpus)

    for fn in sorted(os.listdir(data_dir)):
        if fn.endswith(".js"):
            os.remove(os.path.join(data_dir, fn))

    build = Build()
    books_out = []
    for b in BOOKS:
        chapters = []
        for fn in b["_files"]:
            path = os.path.join(corpus, fn)
            ext = os.path.splitext(fn)[1]
            if ext in LORE_EXTS:
                c = lore_chapter(path, fn)
            else:
                c = {"file": fn, "kind": ext[1:], "page": first_page(path), "_path": path}
            chapters.append(c)
        # rules first, then characters, adventures, frames, prose, graphs; within a kind, by the
        # first printed page when the file names one, else by file name
        chapters.sort(key=lambda c: (EXT_ORDER[os.path.splitext(c["file"])[1]], c["page"] is None, c["page"] or 0, c["file"]))
        roots = []
        for c in chapters:
            if c["kind"] == "lore":
                continue
            doc = parse_files([c.pop("_path")])[0]
            c["container"] = doc["container"]
            c["module"] = doc["name"]
            if doc.get("extends"):
                c["moduleExtends"] = doc["extends"]
            ctx = Ctx(build, doc, b["id"], None, None)
            before = set(build.entities)
            c["blocks"] = []
            for x in doc["body"]:
                if x.get("n") == "kw" and x["kw"] in HEADER_KWS:
                    continue                      # module metadata (verify_data SKIP_KEYWORDS)
                if x.get("n") == "kw" and x["kw"] == "NAME" and "name" not in c and len(x["args"]) == 1 and x["args"][0]["k"] == "str" and x.get("body") is None:
                    c["name"] = x["args"][0]["v"]
                    continue
                c["blocks"].append(gen(x, ctx))
            c["roots"] = [h for h in build.entities if h not in before and build.entities[h]["parent"] is None]
            roots.extend(c["roots"])
        books_out.append((b, chapters, roots))

    entities = build.entities
    # a copy names the book its original lives in, so a link to it can load that book first
    for e in entities.values():
        if e.get("copyOf"):
            e["copyOf"]["book"] = entities[e["copyOf"]["hash"]]["book"]
    records = records_of(entities)

    index_books = []
    total = 0
    for b, chapters, roots in books_out:
        rec = {"id": b["id"], "label": b["label"], "kind": b["kind"], "chapters": chapters, "entities": roots}
        mine = {h: e for h, e in entities.items() if e["book"] == b["id"]}
        payload = {"src": "data/%s.js" % b["id"], "book": rec, "entities": mine}
        with open(os.path.join(data_dir, "%s.js" % b["id"]), "w", encoding="utf-8") as fh:
            fh.write(BANNER)
            fh.write(REGISTER % json.dumps(payload, ensure_ascii=False, sort_keys=True))
        total += len(mine)
        by_ext = {}
        for c in chapters:
            by_ext[c["kind"]] = by_ext.get(c["kind"], 0) + 1
        index_books.append({
            "id": b["id"], "label": b["label"], "kind": b["kind"],
            "files": {"main": ["data/%s.js" % b["id"]]},
            "chapters": [{"file": c["file"], "kind": c["kind"], "name": c.get("name"), "page": c["page"]} for c in chapters],
            "counts": {"entities": len(mine), "chapters": len(chapters), "files": by_ext},
            "bytes": os.path.getsize(os.path.join(data_dir, "%s.js" % b["id"])),
        })

    index = {"system": "marvelmultiverse", "books": index_books,
             "counts": {"books": len(index_books), "entities": total, "files": len(on_disk),
                        "synthetic": sum(1 for e in entities.values() if e.get("synthetic")),
                        "records": len(records)}}
    with open(os.path.join(data_dir, "index.js"), "w", encoding="utf-8") as fh:
        fh.write(BANNER)
        fh.write("(function(){var T=window.MARVELMULTIVERSE=window.MARVELMULTIVERSE||{books:{},entities:{},loaded:{}};"
                 "T.index=%s;})();\n" % json.dumps(index, ensure_ascii=False, sort_keys=True))
    with open(os.path.join(data_dir, "records.js"), "w", encoding="utf-8") as fh:
        fh.write(BANNER)
        fh.write("(function(){var T=window.MARVELMULTIVERSE=window.MARVELMULTIVERSE||{books:{},entities:{},loaded:{}};"
                 "T.records=%s;})();\n" % json.dumps(records, ensure_ascii=False, sort_keys=True))

    print("build_data: %d corpus files → %d books, %d entities (%d with an id this build wrote); %d records"
          % (len(on_disk), len(index_books), total, index["counts"]["synthetic"], len(records)))
    for x in index_books:
        c = x["counts"]
        print("  %-24s %3d ch %6d ent %6d KB  %s" % (x["id"], c["chapters"], c["entities"], x["bytes"] // 1024,
              " ".join("%s %d" % kv for kv in sorted(c["files"].items()))))


def has_kw(e, name):
    return any(isinstance(b, dict) and b.get("kw") == name for b in e.get("blocks", []))


def records_of(entities):
    """Every entity a cross-book view lists: a typed one (EXTENDS), one that APPLIES TO a type,
    a technique (a RANK in its body), a codex ENTITY. Carries the parent's name (a technique's category is the heading it
    is printed under) and a few scalar fields, so a list reads without loading the book."""
    out = []
    for h, e in entities.items():
        rank = next((b for b in e.get("blocks", []) if isinstance(b, dict) and b.get("kw") == "RANK" and b.get("args")), None)
        is_codex = e["form"] == "ENTITY"
        if not (e.get("type") or rank or is_codex or e.get("applies")):
            continue
        # the file tells two printings of one name apart (the core's sample Spider-Man, p. 22, and its
        # profile, p. 237): the index gives each file's page
        r = {"id": h, "name": e["name"], "book": e["book"], "file": e["file"], "kind": os.path.splitext(e["file"])[1][1:]}
        if e.get("type"):
            r["type"] = e["type"]
        if e.get("applies"):
            r["applies"] = [a["name"] for a in e["applies"]]
        if e.get("parent"):
            r["under"] = entities[e["parent"]]["name"]
        if rank and "i" in rank["args"][0]:
            r["rank"] = rank["args"][0]["i"]
        if is_codex:
            r["form"] = "ENTITY"
            isb = next((b for b in e.get("blocks", []) if isinstance(b, dict) and b.get("kw") == "IS"), None)
            if isb:
                r["is"] = [a["c"] for a in isb["args"] if "c" in a]
        fields = {}
        for p in e.get("props", []):
            if p["name"] in RECORD_FIELDS and p.get("vk") in ("scalar", "enum") and p.get("value", p.get("default")) is not None:
                fields[p["name"]] = p.get("value", p.get("default"))
            elif p["name"] in RECORD_FIELDS and p.get("vk") == "list" and p.get("items"):
                fields[p["name"]] = [a.get("s") for a in p["items"] if "s" in a]
            elif p["name"] in REF_RECORD_FIELDS and p.get("vk") == "ref" and (p.get("ref") or {}).get("hash"):
                r[REF_RECORD_FIELDS[p["name"]]] = p["ref"]["hash"]    # an id, under a build key (verify_data BUILD_KEYS)
        if fields:
            r["fields"] = fields
        out.append(r)
    return out


if __name__ == "__main__":
    main()
