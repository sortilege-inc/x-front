#!/usr/bin/env python3
"""
extract_sheets.py — the six heroes' sheets (campaign/source/sheets/<Hero>.pdf, the owner's
short-form Marvel Multiverse sheets, byte for byte as downloaded) → campaign/source/sheets.json.

    python3 campaign/source/extract_sheets.py

Deterministic: poppler's text layer, no retyping. Three readings of each PDF:

  * `pdftotext -raw` — the text boxes in drawing order, each box whole (a power that the page
    wraps across two columns comes out in one run). Saved as sheets/<Hero>.txt, the record the
    checks read back. The head (rank, abilities, damage, karma, health, focus, initiative,
    speeds) is its first lines, in the template's fixed order; the entries follow.
  * `pdftotext -layout` over the biography column of page 1 — the "Label: value" fields, History
    and Personality, in reading order.
  * the template's own labels, a fixed run on every page, removed and checked to be exactly that.

Entries are split where a line begins with a name the corpus prints (a Trait, Tag or Power:
corpus_index.py), or with a name the sheet sets as a heading (a line followed by a rule of `=`).
Every word of the raw text lands in exactly one field; check_sheets.py proves it.
"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from corpus_index import corpus  # noqa: E402

SRC = os.path.dirname(os.path.abspath(__file__))
SHEETS = os.path.join(SRC, "sheets")
HEROES = ["Flare", "Half-Life", "Regret", "Stasis", "Taboo", "Tank"]
ABILITIES = ["Melee", "Agility", "Resilience", "Vigilance", "Ego", "Logic"]
DAMAGE = ["Melee", "Agility", "Ego", "Logic"]

# The template's labels, printed on every page in this order (the short-form sheet's own words).
LABELS = ("POWERS DAMAGE BIOGRAPHY RANK KARMA HEALTH FOCUS DAMAGE REDUCTION DAMAGE REDUCTION "
          "INITIATIVE MODIFIER TRAITS & TAGS Traits Tags ABILITIES ABILITY SCORE DEFENSE SCORE "
          "NON-COMBAT CHECKS MELEE AGILITY RESILIENCE VIGILANCE EGO LOGIC dMarvel dMarvel dMarvel "
          "dMarvel MULTIPLIER MULTIPLIER MULTIPLIER MULTIPLIER SPEED Run: Climb: Swim: Real Name: "
          "Height: Eyes: Weight: Gender: Hair: Size: Distinguishing Features: Occupation: Origin: "
          "Teams: Base: HISTORY PERSONALITY ABILITY ABILITY ABILITY ABILITY MELEE AGILITY EGO LOGIC").split()
# the art credit line closes each page's run: "Art :" (page 1 of two) or "Art Author Art :"
ART = re.compile(r"^Art( Author Art)? ?:(NAME)?$")

BIO_FIELDS = ["Real Name", "Height", "Weight", "Gender", "Eyes", "Hair", "Size",
              "Distinguishing Features", "Occupation", "Origin", "Teams", "Base"]


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def raw_text(pdf):
    return run("pdftotext", "-raw", "-enc", "UTF-8", pdf, "-")


def strip_labels(lines):
    """Remove each page's label run (it begins at a line 'POWERS' followed by 'DAMAGE',
    'BIOGRAPHY' and ends at the art credit). Returns (kept lines, number of runs removed)."""
    out, i, runs = [], 0, 0
    while i < len(lines):
        if lines[i] == "POWERS" and lines[i + 1:i + 3] == ["DAMAGE", "BIOGRAPHY"]:
            j = i
            while not ART.match(lines[j]):
                j += 1
            words = " ".join(lines[i:j]).split()
            if words != LABELS:
                raise SystemExit("label run differs from the template's: %r" % words)
            runs += 1
            i = j + 1
            # page 2 opens with the template's own name placeholder (the text layer puts it just
            # after page 1's credit, across the form feed: "Art :" / "NAME")
            if i < len(lines) and lines[i] == "NAME":
                i += 1
            continue
        out.append(lines[i])
        i += 1
    return out, runs


HEAD_ABILITY = re.compile(r"^(-?\d+) (\d+) ([+-]\d+E?)$")
HEAD_DAMAGE = re.compile(r"^(\d+) (-?\d+)$")
TRACK = re.compile(r"^_+/(\d+)(?: (\S+))?$")


def parse_head(lines, hero):
    it = iter(enumerate(lines))
    take = lambda: next(it)[1]  # noqa: E731
    h = {"Name": take(), "Rank": take()}
    if h["Name"] != hero or not h["Rank"].isdigit():
        raise SystemExit("%s: head begins %r %r" % (hero, h["Name"], h["Rank"]))
    h["Abilities"] = []
    for a in ABILITIES:
        m = HEAD_ABILITY.match(take())
        h["Abilities"].append({"Ability": a, "Ability Score": m.group(1), "Defense Score": m.group(2), "Non-Combat Checks": m.group(3)})
    h["Damage"] = []
    for a in DAMAGE:
        m = HEAD_DAMAGE.match(take())
        h["Damage"].append({"Ability": a, "Multiplier": m.group(1), "Ability Score": m.group(2)})
    k = TRACK.match(take())
    h["Karma"] = k.group(1)
    for t in ("Health", "Focus"):
        m = TRACK.match(take())
        h[t], h[t + " Damage Reduction"] = m.group(1), m.group(2)
    h["Initiative Modifier"] = take()
    h["Speeds"] = [{"Mode": mode, "Speed": take()} for mode in ("Run", "Climb", "Swim")]
    n = 1 + 1 + 6 + 4 + 3 + 1 + 3
    while re.match(r"^[A-Z][a-z]+: \d+$", lines[n]):
        mode, sp = lines[n].split(": ")
        h["Speeds"].append({"Mode": mode, "Speed": sp})
        n += 1
    for a in h["Abilities"]:
        if int(a["Defense Score"]) != 10 + int(a["Ability Score"]) and hero not in ():
            pass  # a Small or Big trait moves a defense; the sheet's number is what is kept
    return h, lines[n:]


# ── the biography column (page 1, right of x=555pt) ─────────────────
def bio_column(pdf):
    txt = run("pdftotext", "-f", "1", "-l", "1", "-layout", "-r", "72", "-x", "555", "-y", "95",
              "-W", "400", "-H", "700", "-enc", "UTF-8", pdf, "-")
    return [ln.strip() for ln in txt.splitlines() if ln.strip()]


LABEL_AT = re.compile(r"(Real Name|Height|Weight|Gender|Eyes|Hair|Size|Distinguishing Features|Occupation|Origin|Teams|Base):")


def parse_bio(lines, hero):
    bio = {f: "" for f in BIO_FIELDS}
    i = 0
    while lines[i] != "HISTORY":
        ln = lines[i]
        marks = list(LABEL_AT.finditer(ln))
        if not marks:
            # a value on the line below its label (Distinguishing Features)
            bio[last] = (bio[last] + " " + ln).strip()
        for k, m in enumerate(marks):
            end = marks[k + 1].start() if k + 1 < len(marks) else len(ln)
            bio[m.group(1)] = ln[m.end():end].strip()
            last = m.group(1)
        i += 1
    i += 1
    hist = []
    while not re.match(r"^Current [Aa]ge:", lines[i]):
        hist.append(lines[i])
        i += 1
    bio["Current Age"] = lines[i]
    i += 1
    if lines[i] != "PERSONALITY":
        raise SystemExit("%s: expected PERSONALITY, got %r" % (hero, lines[i]))
    pers = lines[i + 1:]
    return bio, hist, pers


def join(a, b):
    # a word broken at a line end with a hyphen ("state-" / "sanctioned") keeps its hyphen: the
    # sheet's hyphen is a compound's (state-sanctioned, self-control, super-powers)
    return a + b if a.endswith("-") else a + " " + b


# ── entries ─────────────────────────────────────────────────────────
RULE = re.compile(r"^=+$")


def split_entries(lines, starts, heads, hero):
    """Entries in drawing order. A heading is a line beginning with a power set's name, "Traits
    (,) continued" or "Weapons" that a rule of '=' follows before any entry begins; the lines
    between it and the rule are its description (Stasis's Velocity). An entry begins at a line
    beginning with a name the corpus prints, and at the first line after a rule."""
    out, cur, section, i = [], None, None, 0
    while i < len(lines):
        ln = lines[i]
        if heads.match(ln):
            j = i + 1
            while j < len(lines) and j < i + 8 and not RULE.match(lines[j]) and not starts.match(lines[j]):
                j += 1
            if j < len(lines) and RULE.match(lines[j]):
                section = ln
                out.append({"heading": ln, "description": lines[i + 1:j], "rule": lines[j]})
                cur = None
                i = j + 1
                if i < len(lines) and not starts.match(lines[i]):
                    cur = {"section": section, "lines": [lines[i]]}   # an entry the corpus does not name (Knife)
                    out.append(cur)
                    i += 1
                continue
        if starts.match(ln):
            cur = {"section": section, "lines": [ln]}
            out.append(cur)
        elif cur is None:
            raise SystemExit("%s: text before any entry: %r" % (hero, ln))
        else:
            cur["lines"].append(ln)
        i += 1
    return out


def remove_bio(rest, bio, hist, pers, hero):
    """The biography's values are one run in the raw text (after page 1's entries): cut it out,
    and prove the run holds exactly the biography's words."""
    first = bio["Real Name"]
    last = pers[-1]
    i = rest.index(first)
    j = rest.index(last, i)
    run_words = " ".join(rest[i:j + 1]).split()
    vals = [bio[f] for f in BIO_FIELDS if bio[f]] + hist + [bio["Current Age"]] + pers
    if sorted(run_words) != sorted(" ".join(vals).split()):
        raise SystemExit("%s: the biography's run differs from its column: %r" % (hero, sorted(set(run_words) ^ set(" ".join(vals).split()))))
    return rest[:i] + rest[j + 1:]


def balanced(s, i):
    """The index just past the ')' that closes the '(' at s[i]."""
    depth = 0
    for k in range(i, len(s)):
        depth += {"(": 1, ")": -1}.get(s[k], 0)
        if depth == 0:
            return k + 1
    raise ValueError(s)


def parse_entry(text, names_re):
    """'Name (group): text' · 'Name: text' · 'Name [text]' · 'Name (Detail) [text]' ·
    'Elemental Barrier: Force (group): text'  →  {name, qualifier, group, style, text}."""
    m = names_re.match(text)
    rest = text[m.end():]
    e = {"name": m.group(1) or m.group(2), "qualifier": None, "group": None}
    q = re.match(r"^: ([A-Z][\w-]*)(?= \()", rest)
    if q:
        e["qualifier"] = q.group(1)
        rest = rest[q.end():]
    if rest.lstrip().startswith("("):
        i = rest.index("(")
        j = balanced(rest, i)
        e["group"] = rest[i + 1:j - 1]
        rest = rest[j:]
    if rest.startswith(":"):
        e["style"], e["text"] = "colon", rest[1:].strip()
    elif rest.strip().startswith("[") and rest.strip().endswith("]"):
        e["style"], e["text"] = "bracket", rest.strip()[1:-1]
    elif not rest.strip():
        e["style"], e["text"] = "bare", ""
    else:
        raise SystemExit("cannot read the entry %r" % text[:80])
    return e


def column_lines(pdf):
    """Page 1's biography column with its blank lines kept: they are the page's paragraph breaks."""
    txt = run("pdftotext", "-f", "1", "-l", "1", "-layout", "-r", "72", "-x", "555", "-y", "95",
              "-W", "400", "-H", "700", "-enc", "UTF-8", pdf, "-")
    return [ln.strip() for ln in txt.splitlines()]


def paras(lines, extra_start=None):
    """Wrapped lines → paragraphs, broken at blank lines (and at `extra_start`, a regex)."""
    out, cur = [], ""
    for ln in lines:
        if not ln or (extra_start and re.match(extra_start, ln)):
            if cur:
                out.append(cur)
            cur = ln
            continue
        cur = join(cur, ln) if cur else ln
    if cur:
        out.append(cur)
    return out


def between(lines, start, stop):
    i = next(k for k, ln in enumerate(lines) if re.match(start, ln)) + 1
    j = next((k for k in range(i, len(lines)) if stop and re.match(stop, lines[k])), len(lines))
    return lines[i:j]


def main():
    c = corpus()
    names = set(c["Trait"]) | set(c["Tag"]) | set(c["Power"])
    # a numbered power ("Flight 1", "Uncanny 1") the sheet may print by its stem ("Flight (Permanent)")
    names |= {re.sub(r" \d+$", "", n) for n in c["Power"]}
    alts = "|".join(re.escape(n) for n in sorted(names, key=len, reverse=True))
    # case-blind: the sheet may capitalise a name the book sets in lower case ("Rally On Me")
    starts = re.compile(r"^(%s)(?=$| ?\(| ?\[|:)|^([A-Z][A-Za-z\'’ -]+?)(?= \[)" % alts, re.I)
    sets = "|".join(re.escape(n) for n in sorted(c["Power Set"], key=len, reverse=True))
    heads = re.compile(r"^(%s|Traits,? continued|Weapons)\b" % sets)
    out = []
    for hero in HEROES:
        pdf = os.path.join(SHEETS, hero + ".pdf")
        raw = raw_text(pdf)
        with open(os.path.join(SHEETS, hero + ".txt"), "w", encoding="utf-8") as fh:
            fh.write(raw)
        lines = [ln.strip() for ln in raw.replace("\f", "\n").splitlines() if ln.strip()]
        lines, runs = strip_labels(lines)
        head, rest = parse_head(lines, hero)
        bio, hist, pers = parse_bio(bio_column(pdf), hero)
        rest = remove_bio(rest, bio, hist, pers, hero)
        rec = {"Hero": hero, "Label runs": runs}
        rec.update(head)
        rec.update({k: v for k, v in bio.items() if k != "Current Age"})
        col = column_lines(pdf)
        rec["History"] = paras(between(col, r"^HISTORY$", r"^Current [Aa]ge:"))
        rec["Current Age"] = bio["Current Age"]
        rec["Personality"] = paras(between(col, r"^PERSONALITY$", None), r"^(Goal|Barrier):")
        rec["Sections"], rec["Entries"] = [], []
        section = None
        for ent in split_entries(rest, starts, heads, hero):
            if "heading" in ent:
                section = ent["heading"]
                rec["Sections"].append({"Heading": ent["heading"], "Description": paras(ent["description"]), "Rule": ent["rule"]})
                continue
            text = ""
            for ln in ent["lines"]:
                text = join(text, ln) if text else ln
            if starts.match(text):
                e = parse_entry(text, starts)
            else:
                e = {"name": None, "qualifier": None, "group": None, "style": "free", "text": text}
            e["section"] = section
            e["printed"] = text
            rec["Entries"].append(e)
        out.append(rec)
    path = os.path.join(SRC, "sheets.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print("extract_sheets: %d sheets → %s (%d entries)" % (len(out), os.path.relpath(path), sum(len(r["Entries"]) for r in out)))


if __name__ == "__main__":
    main()
