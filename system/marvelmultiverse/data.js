// system/marvelmultiverse/data.js — accessors over the generated corpus (window.MARVELMULTIVERSE
// from data/*.js). This is the only file that knows the data's shape; the reader, the lists, the
// dice and (later) the sheet ask here. Ported from sortilege-vtt-l5r5e (system/l5r5e/data.js):
// the same build, so the same shape; L5R's lore graph, arcs and game lists are left out.
//
// Three things about this corpus the accessors carry for everyone else:
//
//   * The data is a lossless dump (build_data.py): an entity's named fields (desc, props,
//     rules, table…) plus `blocks`, every other node in corpus order — a keyword as
//     {kw, args, body}, a numbered row as {num, args, body}, a string as {s}, a nested entity
//     as {ent}. An argument is {s} string, {c} caret name, {h} hash, {i} integer, {b} bool,
//     {w} bare word, {l} list. `arg()` reads one as a plain value.
//   * Books load on demand (engine/data.js). `records` (data/records.js) lists every typed
//     entity with its book, so a list view never loads a book; a detail view calls
//     `ensure(book)` first.
//   * Some things the corpus prints APART from what they concern, and are joined here at load:
//     GUIDANCE sidebars (the worked examples, CONCERNS a hash), and an instance layer's MODIFYs.
//     And an EMPHASIS block sits beside the prose whose bold or italic runs it names (spec §5,
//     "a marked span with no referent"): `emphasis(e)` hands them to the renderer.
window.MMData = (function () {
  const EMPTY = { books: {}, entities: {}, loaded: {}, index: { books: [], counts: {} }, records: [] };
  const T = () => window.MARVELMULTIVERSE || EMPTY;
  const Data = () => window.VttData;

  const index = () => T().index || { books: [], counts: {} };
  const books = () => (index().books || []).slice();
  const indexBook = (id) => (index().books || []).find((b) => b.id === id) || null;
  const book = (id) => T().books[id] || null;
  const entity = (id) => T().entities[id] || null;
  const records = () => T().records || [];
  const record = (id) => records().find((r) => r.id === id) || null;
  const loaded = (id) => !!book(id);

  // ── loading ────────────────────────────────────────────────────────
  // Every loaded book re-indexes what joins across books (sidebars, corrections, names). An
  // instance's campaign layer (build/build_layer.py) comes with every book, so its house rules
  // show beside what they change whichever book a page opened first.
  let indexedFor = '';
  const ALWAYS = books().filter((b) => b.kind === 'campaign').map((b) => b.id);
  function ensure(ids) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter((x) => x && indexBook(x));
    if (list.length) ALWAYS.forEach((x) => list.indexOf(x) === -1 && list.push(x));
    return Data().ready(list).then(() => reindex());
  }
  const ensureAll = () => ensure(books().map((b) => b.id));

  // ── arguments and values ───────────────────────────────────────────
  function arg(a) {
    if (a == null) return null;
    if ('s' in a) return a.s;
    if ('c' in a) return a.c;
    if ('i' in a) return a.i;
    if ('b' in a) return a.b;
    if ('w' in a) return a.w;
    if ('l' in a) return a.l.map(arg);
    if ('h' in a) return a.h;
    return null;
  }
  const argText = (a) => (a && ('s' in a || 'c' in a || 'i' in a) ? String(arg(a)) : null);

  function prop(e, name) {
    return (e && (e.props || []).find((p) => p.name === name)) || null;
  }
  // A property's value: the value it is given, else its declared DEFAULT; a list as plain
  // values; a DEF as its property list; a reference as {hash, name}.
  function pval(p) {
    if (!p) return undefined;
    if (p.vk === 'scalar' || p.vk === 'enum') return p.value !== undefined ? p.value : p.default;
    if (p.vk === 'list') return (p.items || []).map(arg);
    if (p.vk === 'ref') return p.ref;
    return p;
  }
  const val = (e, name) => pval(prop(e, name));
  const text = (e, name) => {
    const v = val(e, name);
    return typeof v === 'string' ? v : null;
  };
  // A typed list's rows (`^"Abilities" LIST OF ^"Ability Line" [ DEF { … }, … ]`), each as
  // {name: value} — a nested typed list stays a list of rows ({Set, Powers: [{Name, Printed}]}).
  function rowOf(item) {
    const out = {};
    (item.d || []).forEach((f) => (out[f.name] = f.vk === 'list' && f.ofHash ? (f.items || []).map(rowOf) : pval(f)));
    return out;
  }
  const rows = (e, name) => {
    const p = prop(e, name);
    return p && p.vk === 'list' ? (p.items || []).filter((it) => it && it.d).map(rowOf) : [];
  };
  const blocks = (e, kw) => ((e && e.blocks) || []).filter((b) => b && b.kw === kw);
  const block = (e, kw) => blocks(e, kw)[0] || null;
  const kwArg = (e, kw) => {
    const b = block(e, kw);
    return b && b.args && b.args.length ? arg(b.args[0]) : null;
  };
  // the bold and italic runs the page sets in this entity's prose, in the order printed
  const emphasisOf = (list) => [].concat.apply([], (list || []).filter((b) => b && b.kw === 'EMPHASIS').map((b) => (b.body || []).filter((x) => 's' in x).map((x) => x.s)));
  const emphasis = (e) => emphasisOf(e && e.blocks);

  // ── the tree ───────────────────────────────────────────────────────
  function children(id) {
    const e = entity(id);
    return e ? (e.children || []).map(entity).filter(Boolean) : [];
  }
  function ancestors(id) {
    const out = [];
    let e = entity(id);
    while (e && e.parent) {
      e = entity(e.parent);
      if (e) out.unshift(e);
    }
    return out;
  }
  const top = (bid) => ((book(bid) || {}).entities || []).map(entity).filter(Boolean);
  function all(bookIds) {
    const ids = bookIds && bookIds.length ? bookIds : books().map((b) => b.id);
    const out = [];
    ids.forEach((bid) => {
      const stack = ((book(bid) || {}).entities || []).slice();
      while (stack.length) {
        const e = entity(stack.shift());
        if (!e) continue;
        out.push(e);
        stack.unshift.apply(stack, e.children || []);
      }
    });
    return out;
  }
  const byType = (type, bookIds) => all(bookIds).filter((e) => e.type === type);
  // how many entries sit beneath an entity, at any depth
  function descendants(id) {
    let n = 0;
    const stack = (entity(id) || {}).children ? entity(id).children.slice() : [];
    while (stack.length) {
      const e = entity(stack.pop());
      if (!e) continue;
      n++;
      stack.push.apply(stack, e.children || []);
    }
    return n;
  }

  // A type's declaration: the ACTOR (or DEF) of that name. `declared(type)` walks its EXTENDS
  // chain, root first, so ACTOR "X-Men Expansion Character" reads Character's fields, then its own.
  function declaration(typeName) {
    const hit = all(['core']).find((e) => e.name === typeName && (e.form === 'ACTOR' || !e.type) && (e.props || []).length);
    return hit || all().find((e) => e.name === typeName && e.form === 'ACTOR') || null;
  }
  function declared(typeName) {
    const chain = [];
    let d = declaration(typeName);
    while (d) {
      chain.unshift(d);
      d = d.type ? declaration(d.type) : null;
      if (d && chain.indexOf(d) !== -1) break;
    }
    const seen = {};
    const props = [];
    chain.forEach((c) => (c.props || []).forEach((p) => {
      if (seen[p.name] != null) props[seen[p.name]] = p;
      else {
        seen[p.name] = props.length;
        props.push(p);
      }
    }));
    return { chain, props };
  }

  // ── names → entities ───────────────────────────────────────────────
  // `^"Initiative"` inside a string, a CONCERNS by name: resolved by name, preferring the book
  // the reader is in, then the core, then any loaded book.
  let byName = {};
  function reindexNames() {
    byName = {};
    Object.keys(T().entities).forEach((h) => {
      const e = T().entities[h];
      (byName[e.name] = byName[e.name] || []).push(e);
    });
  }
  function named(name, preferBook) {
    const hits = byName[name] || [];
    if (!hits.length) return null;
    return hits.find((e) => e.book === preferBook) || hits.find((e) => e.book === 'core') || hits[0];
  }
  const recordNamed = (name) => records().filter((r) => r.name === name);

  // ── joined across books: sidebars, corrections ─────────────────────
  let guidance = {};      // concerned hash → [ {name, id, topics, text, emphasis, book, file} ]
  let looseGuidance = {}; // file → [ entries that concern nothing ]
  let corrections = {};   // target hash → [ {op, book, file, name, body} ]
  function walkBlocks(list, fn) {
    (list || []).forEach((b) => {
      if (!b || typeof b !== 'object') return;
      fn(b);
      if (b.body) walkBlocks(b.body, fn);
    });
  }
  function guidanceEntry(e, book, file) {
    const g = { name: null, id: null, topics: [], text: null, concerns: [], emphasis: emphasisOf(e.body), book, file };
    (e.args || []).forEach((a) => {
      if ('c' in a) g.name = a.c;
      if ('h' in a) g.id = a.h;
    });
    (e.body || []).forEach((y) => {
      if (y.kw === 'CONCERNS') g.concerns = (y.args[0] ? y.args[0].l || [] : []).map((a) => ({ hash: a.h || null, name: a.c || null }));
      else if (y.kw === 'TOPICS') g.topics = (y.args[0] ? y.args[0].l || [] : []).map(arg);
      else if (y.kw === 'TEXT') g.text = y.args[0] ? y.args[0].s : null;
    });
    return g;
  }
  function reindex() {
    const key = Object.keys(T().loaded || {}).sort().join('|');
    if (key === indexedFor) return;
    indexedFor = key;
    reindexNames();
    guidance = {};
    looseGuidance = {};
    corrections = {};
    const add = (g, bid, file) => {
      if (g.concerns.length) g.concerns.forEach((r) => {
        const target = (r.hash && entity(r.hash)) || named(r.name, bid);
        const k = target ? target.id : '?' + r.name;
        (guidance[k] = guidance[k] || []).push(g);
      });
      else (looseGuidance[file] = looseGuidance[file] || []).push(g);
    };
    const visitGuidance = (list, bid, file) => walkBlocks(list, (x) => {
      if (x.kw === 'GUIDANCE') (x.body || []).forEach((en) => {
        if (en.kw === 'ENTRY') add(guidanceEntry(en, bid, file), bid, file);
      });
    });
    Object.keys(T().books).forEach((bid) => {
      (T().books[bid].chapters || []).forEach((c) => {
        visitGuidance(c.blocks, bid, c.file);
        (c.blocks || []).forEach((x) => {
          if (x.kw !== 'MODIFY' && x.kw !== 'OVERRIDE') return;
          const h = (x.args.find((a) => 'h' in a) || {}).h;
          const nm = (x.args.find((a) => 'c' in a) || {}).c;
          (corrections[h || '?' + nm] = corrections[h || '?' + nm] || []).push({ op: x.kw, book: bid, file: c.file, name: nm, target: h, body: x.body || [] });
        });
      });
    });
    // a worked example sits in its entity's own blocks here, not at the file's top level
    Object.keys(T().entities).forEach((h) => {
      const e = T().entities[h];
      visitGuidance(e.blocks, e.book, e.file);
      (e.guidance || []).forEach((g) => (guidance[h] = guidance[h] || []).push(Object.assign({ book: e.book, file: e.file, emphasis: [] }, g)));
    });
  }
  const guidanceFor = (id) => guidance[id] || [];
  const guidanceLoose = (file) => looseGuidance[file] || [];
  const correctionsFor = (id) => corrections[id] || [];
  // A property a MODIFY sets or introduces on an entity — an instance's house rule, which the
  // sheet then honours. The last loaded wins; a target named without a hash is matched by name.
  function modified(e, name) {
    if (!e) return undefined;
    const list = (corrections[e.id] || []).concat(named(e.name, e.book) === e ? corrections['?' + e.name] || [] : []);
    let out;
    list.forEach((c) => (c.body || []).forEach((b) => {
      if (b.kw === 'PROPERTIES') (b.body || []).forEach((q) => { if (q.name === name) out = pval(q); });
      if (b.kw === 'SET' && b.args && b.args.length > 1 && b.args[0].c === name) out = arg(b.args[b.args.length - 1]);
    }));
    return out;
  }

  // ── a book's outline: chapters, then the entity tree ───────────────
  // A chapter's title is its NAME; a file with none (a profile's .actor) is known by its root
  // entity's name, then its file name.
  function chapterTitle(c) {
    if (c.name) return c.name;
    const root = (c.roots || []).map(entity).filter(Boolean)[0];
    return root ? root.name : c.file.replace(/^marvelmultiverse-0\.5-/, '').replace(/\.[a-z]+$/, '');
  }
  // In a list, the part after the book's own name every chapter file opens with
  // ("Marvel Multiverse Role-Playing Game: Core Rulebook - Powers" → "Powers"); the chapter's own
  // page keeps the whole title.
  const shortTitle = (c) => chapterTitle(c).replace(/^Marvel Multiverse Role-Playing Game: .+? [-–] /, '');
  const chapters = (bid) => ((book(bid) || {}).chapters || []);
  const chapter = (bid, file) => chapters(bid).find((c) => c.file === file) || null;

  // ── the game's own lists (records: no book need be loaded) ─────────
  const recordsOf = (test) => records().filter(test);
  // a published character profile: ACTOR "Character" and what EXTENDS it (the X-Men's)
  const PROFILE_TYPES = ['Character', 'X-Men Expansion Character'];
  const profiles = () => recordsOf((r) => PROFILE_TYPES.indexOf(r.type) !== -1 && r.kind === 'actor' && !r.versionOf);
  const isProfile = (e) => !!e && PROFILE_TYPES.indexOf(e.type) !== -1;
  const versionsOf = (id) => recordsOf((r) => r.versionOf === id);
  // the printed page a record's file begins on (the index's chapters), and a profile's name with
  // that page where two profiles print one name (the core's sample Spider-Man, p. 22, and p. 237)
  function pageOf(r) {
    const b = indexBook(r && r.book);
    const c = b && (b.chapters || []).find((x) => x.file === r.file || x.file.split('/').pop() === r.file);
    return c ? c.page : null;
  }
  let dupNames = null;
  function profileLabel(r) {
    if (!dupNames) {
      const n = {};
      profiles().forEach((x) => (n[x.name] = (n[x.name] || 0) + 1));
      dupNames = n;
    }
    const p = dupNames[r.name] > 1 ? pageOf(r) : null;
    return r.name + (p != null ? ' (p. ' + p + ')' : '');
  }
  const typed = (t) => recordsOf((r) => r.type === t);

  // ── search ─────────────────────────────────────────────────────────
  function stringsOf(x, out) {
    if (x == null) return out;
    if (typeof x === 'string') out.push(x);
    else if (Array.isArray(x)) x.forEach((y) => stringsOf(y, out));
    else if (typeof x === 'object') Object.keys(x).forEach((k) => {
      if (k === 'id' || k === 'hash' || k === 'h' || k === 'children' || k === 'parent' || k === 'ent' || k === 'rule' || k === 'file' || k === 'book' || k === 'typeHash' || k === 'ofHash' || k === 'vk' || k === 'kw' || k === 'w' || k === 'dtype') return;
      if (k === 'blocks' && Array.isArray(x[k])) return stringsOf(x[k].filter((b) => !b || b.kw !== 'EMPHASIS'), out);
      stringsOf(x[k], out);
    });
    return out;
  }
  const cache = new Map();
  function searchText(e) {
    let t = cache.get(e.id);
    if (t === undefined) {
      t = stringsOf([e.name, e.desc, e.props, e.rules, e.table, e.blocks, e.guidance], []).join('\n');
      cache.set(e.id, t);
    }
    return t;
  }
  function search(query, bookIds, limit) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const hits = [];
    all(bookIds).forEach((e) => {
      const inName = e.name.toLowerCase().indexOf(q) !== -1;
      if (inName || searchText(e).toLowerCase().indexOf(q) !== -1) hits.push({ e, score: inName ? 0 : 1 });
    });
    hits.sort((a, b) => a.score - b.score || a.e.name.localeCompare(b.e.name));
    return hits.slice(0, limit || 200).map((h) => h.e);
  }
  function excerpt(e, query, n) {
    const t = searchText(e);
    const i = t.toLowerCase().indexOf(String(query).toLowerCase());
    if (i < 0) return null;
    const a = Math.max(0, i - (n || 60));
    const b = Math.min(t.length, i + String(query).length + (n || 60));
    return (a ? '…' : '') + t.slice(a, b).replace(/\n+/g, ' ') + (b < t.length ? '…' : '');
  }

  const label = (bid) => (indexBook(bid) || {}).label || bid;

  return {
    T, index, books, indexBook, book, entity, records, record, loaded, ensure, ensureAll,
    arg, argText, prop, pval, val, text, rows, rowOf, blocks, block, kwArg, emphasis, emphasisOf,
    children, ancestors, top, all, byType, descendants, declaration, declared, named, recordNamed,
    guidanceFor, guidanceLoose, correctionsFor, modified, reindex,
    chapterTitle, shortTitle, chapters, chapter,
    PROFILE_TYPES, profiles, isProfile, versionsOf, typed, pageOf, profileLabel,
    search, excerpt, label,
  };
})();
