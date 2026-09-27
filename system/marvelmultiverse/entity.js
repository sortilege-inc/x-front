// system/marvelmultiverse/entity.js — one entity, as the book holds it. Ported from
// sortilege-vtt-l5r5e (system/l5r5e/entity.js); L5R's rings, curriculum, codex and lore
// Markdown are left out.
//
// Generic by design: an entity is rendered from its own fields and blocks, in the corpus's
// order, whatever it is — a power, a trait, a team roster, a profile — so the renderer names
// almost nothing. Every string shown is the corpus's; the words added are labels: a property's
// name (the corpus's own) and a keyword's (ADVENTURE_HOOKS read as "Adventure hooks"). Two shapes
// get a layout of their own because the book prints them so:
//
//   * a typed list of rows (`^"Abilities" LIST OF ^"Ability Line" [ DEF { … }, … ]`) is a table,
//     one column per field — or, when every row carries the string the book printed (`Printed`),
//     that printed string in a line, which is how the page sets a profile's traits and powers;
//   * a character profile leads with the numbers the book sets at its head (Rank, Karma, Health,
//     Focus, Initiative) and its ability grid.
//
// EMPHASIS (spec §5: a bold or italic run the page sets, recorded beside the verbatim prose) is
// drawn back into that prose here, each run where it first occurs after the last, and never shown
// as a block of its own. The string in data/ is untouched.
window.MMEntity = (function () {
  const { el, esc } = window.VttRender;
  const D = window.MMData;
  const open = (id) => window.MMOpenEntity && window.MMOpenEntity(id);

  // ── emphasis ───────────────────────────────────────────────────────
  // A pool of an entity's marked runs, consumed in printed order: each string the entity shows
  // takes the runs it contains, from where the previous run ended; a run not found stays for the
  // next string (the runs of a profile's biography sit in its History, not its name).
  function pool(spans) {
    return { spans: (spans || []).slice() };
  }
  function marked(s, P) {
    const src = String(s);
    if (!P || !P.spans.length) return esc(src);
    let out = '';
    let at = 0;
    const left = [];
    // a run that starts or ends on a letter is a whole word there ("and" is not in "understand")
    const word = /[\p{L}\p{N}]/u;
    const find = (sp, from) => {
      for (let i = src.indexOf(sp, from); i >= 0; i = src.indexOf(sp, i + 1)) {
        const before = i > 0 && word.test(sp[0]) && word.test(src[i - 1]);
        const after = i + sp.length < src.length && word.test(sp[sp.length - 1]) && word.test(src[i + sp.length]);
        if (!before && !after) return i;
      }
      return -1;
    };
    P.spans.forEach((sp) => {
      const i = sp ? find(sp, at) : -1;
      if (i < 0) return left.push(sp);
      out += esc(src.slice(at, i)) + '<b class="emph">' + esc(sp) + '</b>';
      at = i + sp.length;
    });
    P.spans = left;
    return out + esc(src.slice(at));
  }

  // ── text ───────────────────────────────────────────────────────────
  function inline(s, bookId, P) {
    let h = marked(s, P);
    // ^"Name" (escaped by esc() to ^&quot;Name&quot;): the name, linked when the corpus has it
    h = h.replace(/\^&quot;(.+?)&quot;/g, (m, nm) => {
      const raw = nm.replace(/&#39;/g, "'").replace(/&amp;/g, '&');
      const e = D.named(raw, bookId);
      const r = e ? null : D.recordNamed(raw)[0];
      const id = e ? e.id : r ? r.id : null;
      return id ? '<a class="ref" href="#" data-open="' + esc(id) + '">' + nm + '</a>' : '<span class="refname">' + nm + '</span>';
    });
    return h;
  }
  function wire(node) {
    node.addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('a[data-open]');
      if (!a) return;
      ev.preventDefault();
      open(a.dataset.open);
    });
    return node;
  }
  // \n\n paragraphs, \n line breaks; nothing is added or reflowed. The pool is consumed across
  // the paragraphs in order.
  function prose(text, cls, bookId, P) {
    if (text == null || text === '') return null;
    const wrap = el('div', { class: cls || 'prose' });
    String(text).split(/\n\s*\n/).forEach((p) => wrap.appendChild(el('p', { html: inline(p, bookId, P).replace(/\n/g, '<br>') })));
    return wire(wrap);
  }
  const span = (text, bookId, cls, P) => wire(el('span', { class: cls || null, html: inline(String(text), bookId, P) }));

  // A reference: a link when the corpus has the target (loaded, or listed in the records),
  // the printed name when it does not.
  function link(ref, bookId) {
    if (!ref) return null;
    const t = (ref.hash && D.entity(ref.hash)) || (ref.name && D.named(ref.name, bookId));
    const r = t ? null : (ref.hash && D.record(ref.hash)) || (ref.name && D.recordNamed(ref.name)[0]);
    const label = ref.name || (t && t.name) || (r && r.name) || '';
    const id = t ? t.id : r ? r.id : null;
    if (!id) return el('span', { class: 'refname' }, [label]);
    return el('a', { class: 'ref', href: '#', onclick: (ev) => { ev.preventDefault(); open(id); } }, [label]);
  }

  // ── labels ─────────────────────────────────────────────────────────
  const kwLabel = (kw) => kw.charAt(0) + kw.slice(1).toLowerCase().replace(/_/g, ' ');

  // ── arguments ──────────────────────────────────────────────────────
  function argNode(a, bookId, P) {
    if ('s' in a) return span(a.s, bookId, null, P);
    if ('c' in a) return link({ hash: a.h || null, name: a.c }, bookId);
    if ('h' in a) return link({ hash: a.h, name: null }, bookId);
    if ('i' in a) return el('span', { class: 'num' }, [String(a.i)]);
    if ('b' in a) return el('span', {}, [a.b ? 'yes' : 'no']);
    if ('w' in a) return el('span', { class: 'word' }, [a.w]);
    if ('l' in a) return el('span', { class: 'arglist' }, a.l.map((x, i) => [i ? ', ' : null, argNode(x, bookId, P)]));
    if ('d' in a) return fields(a.d, bookId, P);
    return null;
  }
  const args = (list, bookId, P) => (list || []).map((a, i) => [i ? ' ' : null, argNode(a, bookId, P)]);

  // ── typed lists of rows ────────────────────────────────────────────
  const isRows = (p) => p && p.vk === 'list' && p.ofHash && (p.items || []).length && p.items.every((it) => it && it.d);
  // the string the book printed for a row, when the row carries it
  const printed = (it) => {
    const f = (it.d || []).find((x) => x.name === 'Printed' && typeof x.value === 'string');
    return f ? f.value : null;
  };
  function rowsView(p, bookId, P) {
    const items = p.items;
    // the printed string, linked to the entry its Name names when the corpus has one
    // (a profile's "Accuracy 1" opens the power Accuracy 1)
    const one = (it) => {
      const nm = (it.d.find((x) => x.name === 'Name') || {}).value;
      const t = typeof nm === 'string' ? D.named(nm, bookId) || D.recordNamed(nm)[0] : null;
      if (!t) return span(printed(it), bookId, null, P);
      return el('a', { class: 'ref', href: '#', onclick: (ev) => { ev.preventDefault(); open(t.id); } }, [printed(it)]);
    };
    if (items.every(printed)) return el('div', { class: 'printed-line' }, items.map((it, i) => [i ? ', ' : null, one(it)]));
    const cols = [];
    items.forEach((it) => it.d.forEach((f) => cols.indexOf(f.name) === -1 && cols.push(f.name)));
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'printed rows' }, [
      el('thead', {}, [el('tr', {}, cols.map((c) => el('th', {}, [c])))]),
      el('tbody', {}, items.map((it) => el('tr', {}, cols.map((c) => {
        const f = it.d.find((x) => x.name === c);
        return el('td', {}, [f ? value(f, bookId, P) : null]);
      })))),
    ])]);
  }

  // ── property values ────────────────────────────────────────────────
  function value(p, bookId, P) {
    switch (p.vk) {
      case 'ref': return link(p.ref, bookId);
      case 'list': {
        const items = p.items || [];
        // a declaration (no items at all) says what it holds; an instance's empty list is empty
        if (!items.length) return p.items ? el('span', { class: 'muted' }, ['—']) : p.of ? el('span', { class: 'muted small' }, ['list of ' + p.of]) : null;
        if (isRows(p)) return rowsView(p, bookId, P);
        return el('ul', { class: 'items' }, items.map((it) => el('li', {}, [argNode(it, bookId, P)])));
      }
      case 'def': return el('div', { class: 'def' }, [fields(p.fields, bookId, P), p.blocks ? nodes(p.blocks, bookId, 0, P) : null]);
      case 'enum': return p.value !== undefined ? span(String(p.value), bookId, null, P) : el('span', { class: 'muted small' }, ['one of ' + (p.options || []).join(', ')]);
      case 'choice': return el('span', {}, ['choose ' + (p.pick || 1) + ': ', args(p.items, bookId, P)]);
      case 'tagged': return el('span', {}, [link({ name: p.name }, bookId), ' ', el('span', { class: 'tags' }, p.tags.map((t) => el('span', { class: 'tag' }, [String(D.arg(t))])))]);
      case 'block': return nodes(p.body, bookId, 0, P);
      case 'name': return link({ name: p.name }, bookId);
      default: {
        const v = p.value !== undefined ? p.value : p.default;
        if (v === undefined) return el('span', { class: 'muted small decl' }, [[p.dtype || 'value', p.min != null ? 'min ' + p.min : null, p.max != null ? 'max ' + p.max : null, p.required ? 'required' : null].filter(Boolean).join(' ')]);
        if (typeof v === 'boolean') return el('span', {}, [v ? 'yes' : 'no']);
        if (typeof v === 'number') return el('span', { class: 'num' }, [String(v)]);
        return String(v).length > 90 ? prose(String(v), 'prose', bookId, P) : span(String(v), bookId, null, P);
      }
    }
  }
  function fieldRow(p, bookId, P) {
    if (p.vk === 'name' || p.vk === 'tagged') return el('div', { class: 'prop solo' }, [value(p, bookId, P)]);
    const v = value(p, bookId, P);
    return el('div', { class: 'prop' + (isRows(p) ? ' wide' : '') }, [el('div', { class: 'prop-k' }, [p.name, p.default !== undefined && p.value === undefined ? el('span', { class: 'muted' }, [' (default)']) : null]), el('div', { class: 'prop-v' }, [v])]);
  }
  function fields(list, bookId, P) {
    if (!list || !list.length) return null;
    return el('div', { class: 'fields' }, list.map((f) => fieldRow(f, bookId, P)));
  }

  // ── blocks, generically ────────────────────────────────────────────
  function node(b, bookId, depth, P) {
    if (!b || typeof b !== 'object') return null;
    if ('ent' in b) {
      const e = D.entity(b.ent);
      return e ? el('div', { class: 'nested' }, [render(e, { depth: (depth || 0) + 1 })]) : null;
    }
    if ('rule' in b) return ruleLine(b.text, bookId);
    if ('num' in b) return el('div', { class: 'numrow' }, [el('span', { class: 'n' }, [String(b.num)]), el('span', {}, [args(b.args, bookId, P)]), b.body ? nodes(b.body, bookId, depth, P) : null]);
    if ('s' in b && !('kw' in b)) {
      if (b.body) return el('div', { class: 'section' }, [el('div', { class: 'sec-k' }, [span(b.s, bookId, null, P)]), nodes(b.body, bookId, depth, P)]);
      return el('div', { class: 'line' }, [span(b.s, bookId, null, P), b.args && b.args.length ? el('span', {}, [' → ', args(b.args, bookId, P)]) : null]);
    }
    if ('name' in b && 'vk' in b) return fieldRow(b, bookId, P);
    if (!('kw' in b)) return null;
    if (b.kw === 'EMPHASIS') return null;                 // drawn into the prose it marks
    if (b.kw === 'GUIDANCE' && b.body) return null;       // attached to what it concerns
    if (b.kw === 'TABLE' && b.body) return tableBlock(b, bookId);
    if (b.kw === 'CHOOSE' && !b.body) return chooseLine(b, bookId, P);
    const label = el('span', { class: 'kw' }, [kwLabel(b.kw)]);
    const a = b.args && b.args.length ? args(b.args, bookId, P) : null;
    if (!b.body) {
      const long = b.args && b.args.length === 1 && 's' in b.args[0] && b.args[0].s.length > 90;
      if (long) return el('div', { class: 'kwpara' }, [el('div', { class: 'prop-k' }, [kwLabel(b.kw)]), prose(b.args[0].s, 'prose', bookId, P)]);
      return el('div', { class: 'kwline' }, [label, a ? el('span', { class: 'kwargs' }, [a]) : null]);
    }
    return el('div', { class: 'kwblock' + (depth ? ' deep' : '') }, [
      el('div', { class: 'kwhead' }, [label, a ? el('span', { class: 'kwargs' }, [' ', a]) : null]),
      nodes(b.body, bookId, (depth || 0) + 1, P),
    ]);
  }
  function nodes(list, bookId, depth, P) {
    if (!list || !list.length) return null;
    return el('div', { class: 'nodes' }, list.map((b) => node(b, bookId, depth, P)));
  }

  function chooseLine(b, bookId, P) {
    const n = b.args.find((a) => 'i' in a);
    const list = b.args.find((a) => 'l' in a);
    return el('div', { class: 'kwline choose' }, [
      el('span', { class: 'kw' }, ['Choose ' + (n ? n.i : '')]), ' ',
      list ? el('span', { class: 'arglist' }, list.l.map((x, i) => [i ? ', ' : null, argNode(x, bookId, P)])) : null,
    ]);
  }

  // A RULES line: `slug "text"` shows its text; a bare slug is a rule id with no text.
  function ruleText(t) {
    const m = /^\S+\s+"([\s\S]*)"$/.exec(t);
    return m ? m[1].replace(/\\(["\\n])/g, (x, c) => (c === 'n' ? '\n' : c)) : null;
  }
  function ruleLine(t, bookId) {
    const txt = ruleText(t);
    return txt ? el('div', { class: 'rule' }, [prose(txt, 'prose', bookId)]) : null;
  }
  function rules(list, bookId) {
    if (!list || !list.length) return null;
    const withText = list.filter((r) => ruleText(r.text));
    const bare = list.filter((r) => !ruleText(r.text));
    return el('div', { class: 'rules' }, [
      withText.map((r) => ruleLine(r.text, bookId)),
      bare.length ? el('details', { class: 'rule-ids' }, [el('summary', { class: 'muted small' }, [bare.length + ' rule id' + (bare.length === 1 ? '' : 's')]), el('div', { class: 'muted small mono' }, [bare.map((r) => r.text).join(' · ')])]) : null,
    ]);
  }

  // ── a printed table ────────────────────────────────────────────────
  function table(t, bookId) {
    if (!t) return null;
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'printed' }, [
      el('thead', {}, [el('tr', {}, t.columns.map((c) => el('th', {}, [String(c)])))]),
      el('tbody', {}, t.rows.map((r) => el('tr', {}, r.map((c) => wire(el('td', { html: inline(String(c), bookId) })))))),
    ])]);
  }
  // a TABLE the build could not read into columns and rows (it carries more): its blocks
  function tableBlock(b, bookId) {
    const cols = (b.body || []).find((x) => x.kw === 'COLUMNS');
    const rowsB = (b.body || []).filter((x) => x.kw === 'ROW');
    const other = (b.body || []).filter((x) => x.kw !== 'COLUMNS' && x.kw !== 'ROW');
    const cell = (a) => el('td', {}, [argNode(a, bookId)]);
    return el('div', { class: 'table-wrap' }, [
      el('table', { class: 'printed' }, [
        cols ? el('thead', {}, [el('tr', {}, (cols.args[0] && cols.args[0].l ? cols.args[0].l : []).map((c) => el('th', {}, [String(D.arg(c))])))]) : null,
        el('tbody', {}, rowsB.map((r) => el('tr', {}, (r.args[0] && r.args[0].l ? r.args[0].l : []).map(cell)))),
      ]),
      other.length ? nodes(other, bookId, 1) : null,
    ]);
  }

  // ── a character profile's head, as the book sets it ────────────────
  const HEAD = ['Rank', 'Karma', 'Health', 'Health Damage Reduction', 'Focus', 'Focus Damage Reduction', 'Initiative Modifier'];
  const HEAD_LABEL = { 'Health Damage Reduction': 'Health DR', 'Focus Damage Reduction': 'Focus DR', 'Initiative Modifier': 'Initiative' };
  function profileHead(e) {
    const cells = HEAD.map((k) => (D.val(e, k) != null ? el('div', { class: 'stat' }, [el('div', { class: 'stat-k', title: k }, [HEAD_LABEL[k] || k]), el('div', { class: 'stat-v' }, [String(D.val(e, k))])]) : null)).filter(Boolean);
    return cells.length ? el('div', { class: 'statblock' }, [el('div', { class: 'stats' }, cells)]) : null;
  }
  // the fields a profile prints in its head, then its grids, then who they are, then the text
  const PROFILE_ORDER = ['Abilities', 'Damage', 'Speeds', 'Traits', 'Tags', 'Powers', 'Notes', 'Reliances',
    'Real Name', 'Height', 'Weight', 'Gender', 'Eyes', 'Hair', 'Size', 'Distinguishing Features', 'Occupation', 'Origin', 'Teams', 'Base'];

  // ── sidebars (the worked examples) ─────────────────────────────────
  function guidance(list, bookId) {
    return (list || []).map((g) => el('aside', { class: 'guidance' + ((g.topics || []).indexOf('Example') !== -1 ? ' example' : '') }, [
      el('div', { class: 'guidance-k' }, [(g.topics || []).join(', ') || 'Sidebar']),
      prose(g.text, 'prose', bookId, pool(g.emphasis)),
    ]));
  }
  // an instance's house rule beside what it changes
  function corrections(e) {
    const list = D.correctionsFor(e.id);
    if (!list.length) return null;
    return el('div', { class: 'errata' }, list.map((c) => el('aside', { class: 'correction' }, [
      el('div', { class: 'guidance-k' }, [c.op === 'MODIFY' ? 'Changed' : 'Replaced', el('span', { class: 'muted small' }, [' · ' + D.label(c.book)])]),
      nodes(c.body, c.book, 1),
    ])));
  }

  // ── the entity ─────────────────────────────────────────────────────
  function subtitle(e) {
    const bits = [];
    if (e.form === 'ACTOR') bits.push('actor type' + (e.type ? ', a kind of ' + e.type : ''));
    else if (e.type) bits.push(e.type);
    if (D.isProfile(e)) {
      const rank = D.val(e, 'Rank');
      if (rank != null) bits.push('Rank ' + rank);
    }
    return bits;
  }

  const TEXTY = ['Description', 'Effect', 'Text', 'History', 'Personality', 'Summary'];
  function render(e, opts) {
    const o = opts || {};
    const bid = e.book;
    const P = pool(D.emphasis(e));
    const profile = D.isProfile(e);
    const box = el('article', { class: 'entity' + (e.form === 'ACTOR' ? ' actor' : '') + (profile ? ' profile' : '') + (e.type ? ' type-' + e.type.toLowerCase().replace(/\W+/g, '-') : '') + (o.depth ? ' depth' : '') });
    if (!o.bare) {
      const H = o.depth ? 'h4' : 'h3';
      box.appendChild(el(H, {}, [e.name, e.type ? el('span', { class: 'etype' }, [e.type]) : null]));
      const sub = subtitle(e);
      if (sub.length && !o.depth) box.appendChild(el('div', { class: 'muted small' }, [sub.join(' · '), ' · ', D.label(bid)]));
    }
    if (e.copyOf) {
      const c = e.copyOf;
      const go = (ev) => { ev.preventDefault(); D.ensure(c.book).then(() => open(c.hash)); };
      box.appendChild(el('div', { class: 'muted small copyof' }, ['As printed here; defined in ', el('a', { class: 'ref', href: '#', onclick: go }, [c.name]), ' (' + D.label(c.book) + ')']));
    }
    let props = (e.props || []).slice();
    if (profile && e.form !== 'ACTOR') {
      const head = profileHead(e);
      if (head) box.appendChild(head);
      props = props.filter((p) => HEAD.indexOf(p.name) === -1 && p.name !== 'Name');
      const rank = (p) => { const i = PROFILE_ORDER.indexOf(p.name); return i === -1 ? PROFILE_ORDER.length : i; };
      props.sort((a, b) => rank(a) - rank(b));
    }
    if (e.desc) box.appendChild(prose(e.desc, 'prose', bid, P));
    const isText = (p) => TEXTY.indexOf(p.name) !== -1 && typeof p.value === 'string';
    const rest = props.filter((p) => !isText(p));
    if (rest.length) box.appendChild(fields(rest, bid, P));
    props.filter(isText).forEach((p) => {
      box.appendChild(el('div', { class: 'kwpara' }, [p.name === 'Description' ? null : el('div', { class: 'prop-k' }, [p.name]), prose(p.value, 'prose', bid, P)]));
    });
    if (e.table) box.appendChild(table(e.table, bid));
    const rl = rules(e.rules, bid);
    if (rl) box.appendChild(rl);
    const inBlocks = new Set();
    (e.blocks || []).forEach((b) => {
      if (b && 'ent' in b) inBlocks.add(b.ent);
    });
    if (e.blocks && e.blocks.length) box.appendChild(nodes(e.blocks, bid, o.depth || 0, P));
    guidance(D.guidanceFor(e.id), bid).forEach((g) => box.appendChild(g));
    const er = corrections(e);
    if (er) box.appendChild(er);
    if (!o.noKids) {
      D.children(e.id).filter((k) => !inBlocks.has(k.id)).forEach((k) => box.appendChild(el('div', { class: 'nested' }, [render(k, { depth: (o.depth || 0) + 1 })])));
    }
    return box;
  }

  // A card for a grid: the name, what it is, the start of its text.
  function card(e, onclick, meta) {
    const t = e.desc || D.text(e, 'Effect') || D.text(e, 'Text') || D.text(e, 'Summary') || D.text(e, 'History') || '';
    return el('button', { class: 'card', type: 'button', onclick }, [
      el('div', { class: 'card-name' }, [e.name]),
      el('div', { class: 'card-meta muted small' }, [meta || subtitle(e).join(' · ')]),
      t ? el('div', { class: 'card-text' }, [String(t).split(/\n\s*\n/)[0].slice(0, 280)]) : null,
    ]);
  }

  return { render, card, prose, inline, span, link, table, fields, value, nodes, node, subtitle, kwLabel, ruleText, guidance, wire, pool, marked, profileHead };
})();
