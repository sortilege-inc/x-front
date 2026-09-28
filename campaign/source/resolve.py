"""
resolve.py — what each sheet entry is in the corpus, and whether its words are the book's.

    from resolve import Resolver
    R = Resolver()
    r = R.entry(e)   # {'entity', 'kind', 'status', 'diff'}

`status`:
  book      the sheet's text is the corpus's, word for word (a power's "[Trigger: …]" is the corpus's
            Trigger, which the sheet prints at the head of the Effect)
  abridged  the sheet's text is the corpus's first part (the sheet stops before a later paragraph)
  excerpt   the sheet's text is a run from inside the corpus's (Connections: the middle paragraph;
            Combat Trickery: the Effect without its Trigger)
  punct     the same words as the corpus's, a punctuation mark apart (Keep Moving's "stunned]")
  own       the sheet's text differs from the corpus's — kept word for word as the hero's own
  free      no corpus entry of that name (Half-Life's knife, a row of the Common Weapons table)
"""
import difflib
import re

from corpus_index import corpus, prop, text_of

# A name the sheet spells otherwise than the book (owner's sheet as printed; the link goes to the
# book's entry). Each is in the decision log.
ALIASES = {
    "Situation Awareness": "Situational Awareness",   # Stasis's sheet
}


def words(s):
    return re.findall(r"[\w’'-]+", s or "")


def norm(s):
    return re.sub(r"\s+", " ", s or "").strip()


class Resolver:
    def __init__(self):
        self.c = corpus()
        self.low = {}
        for k in ("Trait", "Tag", "Power"):
            for n, e in self.c[k].items():
                self.low.setdefault(n.lower(), []).append(e)

    def candidates(self, name):
        name = ALIASES.get(name, name)
        hits = self.low.get(name.lower(), [])
        if hits:
            return hits
        # a numbered power printed by its stem ("Flight" → Flight 1 / Flight 2)
        return [e for n, e in self.c["Power"].items() if re.sub(r" \d+$", "", n).lower() == name.lower()]

    @staticmethod
    def book_text(e):
        t = text_of(e)
        trig = prop(e, "Trigger") if e["type"] == "Power" else None
        return norm(("[Trigger: %s] " % trig if trig else "") + t)

    def entry(self, e):
        if not e.get("name"):
            return {"entity": None, "kind": None, "status": "free", "diff": None}
        cands = self.candidates(e["name"])
        if not cands:
            raise SystemExit("no corpus entry named %r" % e["name"])
        st = norm(e["text"])
        # a trait or a tag in a traits section; a power under a power set's heading
        sec = e.get("section") or ""
        if sec.startswith("Traits"):
            cands = [x for x in cands if x["type"] in ("Trait", "Tag")] or cands
        elif sec:
            cands = [x for x in cands if x["type"] == "Power"] or cands

        def score(x):
            bt = self.book_text(x)
            return (st == bt, bool(st) and bt.startswith(st), bool(st) and st in bt, words(st) == words(bt),
                    difflib.SequenceMatcher(None, bt, st).ratio())
        best = max(cands, key=score)
        bt = self.book_text(best)
        if st == bt:
            status = "book"
        elif st and bt.startswith(st):
            status = "abridged"
        elif st and st in bt:
            status = "excerpt"
        elif words(st) == words(bt):
            status = "punct"
        else:
            status = "own"
        diff = None
        if status == "own":
            sm = difflib.SequenceMatcher(None, bt.split(), st.split())
            diff = [(t, " ".join(bt.split()[i1:i2]), " ".join(st.split()[j1:j2]))
                    for t, i1, i2, j1, j2 in sm.get_opcodes() if t != "equal"]
        return {"entity": best, "kind": best["type"], "status": status, "diff": diff}
