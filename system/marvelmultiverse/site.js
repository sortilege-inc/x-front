// system/marvelmultiverse/site.js — what the Marvel Multiverse puts on the site: the books, and
// the game's own lists across them — the character profiles, the powers, the character options
// (origins, occupations, traits, tags), the Multiverse's teams and places, the glossary — the
// d616, and search. Every word shown comes from titterpig-dsl-marvelmultiverse/0.5 through data/;
// this file decides only what is listed where. A list reads data/records.js; opening anything
// loads its book on demand. Ported from sortilege-vtt-l5r5e (system/l5r5e/site.js): the shelf,
// the reader and the filterable list are its; the tabs are this game's.
window.VttSiteTabs = (function () {
  const { el, debounce } = window.VttRender;
  const D = window.MMData;
  const E = window.MMEntity;
  const Dice = window.MMDice;
  const Site = () => window.VttSite;

  // a link inside any rendered entity opens it in the reader, loading its book first
  window.MMOpenEntity = (id) => {
    const r = D.entity(id) || D.record(id);
    if (r) Site().go('book', [r.book, id]);
  };

  const page = (container) => {
    const p = el('div', { class: 'page' });
    container.appendChild(p);
    return p;
  };
  const loading = (p, what) => p.appendChild(el('div', { class: 'muted loading' }, ['Opening ' + what + '…']));
  function after(p, ids, fn) {
    const note = loading(p, Array.isArray(ids) ? ids.map(D.label).join(', ') : D.label(ids));
    D.ensure(ids).then(() => { note.remove(); fn(); }).catch((e) => {
      console.error(e);
      p.appendChild(el('div', { class: 'empty' }, ['Could not show this: ' + e.message]));
    });
  }
  // `campaign` is an instance's own layer (build/build_layer.py) — its homebrew, shelved first.
  const KIND_ORDER = { campaign: -1, book: 0 };
  const KIND_LABEL = { campaign: 'This campaign', book: 'The books' };
  const allBooks = () => D.books().map((b) => b.id);

  // ── the books ──────────────────────────────────────────────────────
  function renderShelf(container, ctx) {
    const p = page(container);
    const idx = D.index();
    p.appendChild(el('div', { class: 'masthead' }, [
      el('h1', {}, ['The books']),
      el('p', { class: 'muted' }, [String(idx.counts.books) + ' books, generated from their corpus: ' + idx.counts.entities.toLocaleString() + ' entries out of ' + idx.counts.files + ' files. Open one.']),
    ]));
    const groups = {};
    D.books().forEach((b) => (groups[b.kind] = groups[b.kind] || []).push(b));
    Object.keys(groups).sort((a, b) => (KIND_ORDER[a] || 0) - (KIND_ORDER[b] || 0)).forEach((k) => {
      if (Object.keys(groups).length > 1) p.appendChild(el('h2', { class: 'shelf-h' }, [KIND_LABEL[k] || k]));
      p.appendChild(el('div', { class: 'shelf' }, groups[k].map((b) => el('a', { class: 'shelf-book', href: ctx.href('book', [b.id]) }, [
        el('div', { class: 'shelf-title' }, [b.label]),
        el('div', { class: 'muted small' }, [b.counts.chapters + ' chapters · ' + b.counts.entities.toLocaleString() + ' entries · ' + Math.round(b.bytes / 1024) + ' KB']),
      ]))));
    });
  }

  // the prose chapters first, in the book's order; the profiles (one .actor file each) after them
  const proseChapters = (bid) => D.chapters(bid).filter((c) => c.kind !== 'actor');
  const profileChapters = (bid) => D.chapters(bid).filter((c) => c.kind === 'actor');
  function chapterLink(bid, c, ctx, active) {
    return el('a', { class: 'ref' + (active ? ' active' : ''), href: ctx.href('book', [bid, 'ch:' + c.file]) }, [D.shortTitle(c)]);
  }
  function tree(bid, list, ctx, openId) {
    return el('ul', { class: 'toc' }, list.map((e) => {
      const kids = D.children(e.id);
      const a = el('a', { class: 'ref' + (e.id === openId ? ' active' : ''), href: ctx.href('book', [bid, e.id]) }, [e.name]);
      if (!kids.length) return el('li', {}, [a]);
      const open = openId && (e.id === openId || D.ancestors(openId).some((x) => x.id === e.id));
      return el('li', {}, [el('details', { open: open || null }, [el('summary', {}, [a]), tree(bid, kids, ctx, openId)])]);
    }));
  }

  function renderBook(container, path, ctx) {
    const bid = path[0] && D.indexBook(path[0]) ? path[0] : null;
    if (!bid) return renderShelf(container, ctx);
    const p = page(container);
    const meta = D.indexBook(bid);
    after(p, bid, () => {
      const target = path[1] || null;
      const chFile = target && target.indexOf('ch:') === 0 ? target.slice(3) : null;
      const e = target && !chFile ? D.entity(target) : null;
      const openCh = chFile || (e ? e.file : null);
      p.appendChild(el('div', { class: 'crumbs' }, [ctx.isOpen('book') ? el('a', { href: ctx.href('book', []) }, ['The books']) : 'The books', ' › ',
        ctx.isOpen('book') ? el('a', { href: ctx.href('book', [bid]) }, [meta.label]) : meta.label,
        e ? D.ancestors(e.id).map((a) => [' › ', ctx.isOpen('book') ? el('a', { href: ctx.href('book', [bid, a.id]) }, [a.name]) : a.name]) : null]));
      // one entry opened from another tab while the books are closed: the entry alone
      if (!ctx.isOpen('book')) {
        p.appendChild(el('div', { class: 'site-reader solo' }, [e ? entityPage(e, bid, ctx) : el('div', { class: 'empty' }, ['The books are closed on this site.'])]));
        return;
      }
      const q = el('input', { type: 'search', class: 'search', placeholder: 'Search ' + meta.label + '…' });
      const results = el('div', { class: 'results' });
      q.addEventListener('input', debounce(() => showHits(results, q.value.trim(), [bid], ctx), 250));
      const chItem = (c) => {
        const roots = (c.roots || []).map(D.entity).filter(Boolean);
        const here = c.file === openCh;
        return el('li', {}, [roots.length && c.kind !== 'actor'
          ? el('details', { open: here || null }, [el('summary', {}, [chapterLink(bid, c, ctx, chFile === c.file)]), tree(bid, roots, ctx, e ? e.id : null)])
          : chapterLink(bid, c, ctx, chFile === c.file || (e && here))]);
      };
      const profs = profileChapters(bid);
      const toc = el('div', { class: 'site-toc' }, [q, results,
        el('ul', { class: 'toc chapters' }, proseChapters(bid).map(chItem)),
        profs.length ? el('details', { class: 'toc-profiles', open: (e && e.file.endsWith('.actor')) || null }, [el('summary', {}, ['Character profiles (' + profs.length + ')']), el('ul', { class: 'toc chapters' }, profs.map(chItem))]) : null,
      ]);
      let body;
      if (e) body = entityPage(e, bid, ctx);
      else if (chFile) body = chapterPage(bid, D.chapter(bid, chFile), ctx);
      else body = bookFront(bid, meta, ctx);
      p.appendChild(el('div', { class: 'reader' }, [toc, el('div', { class: 'site-reader' }, [body])]));
    });
  }

  // A large entry (more than BIG entries beneath it — *Powers* holds 364) opens as its own text
  // and a contents list; a smaller one renders whole, its children nested as the book nests them.
  const BIG = 40;
  function entityPage(e, bid, ctx) {
    if (D.descendants(e.id) <= BIG) return E.render(e);
    return el('div', {}, [
      E.render(e, { noKids: true }),
      el('div', { class: 'contents' }, [el('h4', {}, ['In this section']), el('ul', { class: 'items columns' }, D.children(e.id).map((k) => el('li', {}, [
        el('a', { class: 'ref', href: ctx.href('book', [bid, k.id]) }, [k.name]), k.type ? el('span', { class: 'etype' }, [k.type]) : null,
        k.children && k.children.length ? el('span', { class: 'muted small' }, [' · ' + D.descendants(k.id)]) : null,
      ])))]),
    ]);
  }

  function bookFront(bid, meta, ctx) {
    return el('div', {}, [
      el('h2', {}, [meta.label]),
      el('h4', {}, ['Chapters']),
      el('ul', { class: 'items' }, proseChapters(bid).map((c) => el('li', {}, [chapterLink(bid, c, ctx), c.page ? el('span', { class: 'muted small' }, [' · from page ' + c.page]) : null]))),
      profileChapters(bid).length ? el('p', {}, [el('a', { class: 'ref', href: ctx.href('characters', []) }, [profileChapters(bid).length + ' character profiles']), ' — each its own file.']) : null,
    ]);
  }

  // A chapter: its own top-level blocks and its entities in order.
  function chapterPage(bid, c, ctx) {
    if (!c) return el('div', { class: 'empty' }, ['No such chapter.']);
    const loose = D.guidanceLoose(c.file);
    const top = (c.blocks || []).filter((b) => !('ent' in b));
    const roots = (c.roots || []).map(D.entity).filter(Boolean);
    // a profile's file is its one entity
    if (c.kind === 'actor' && roots.length === 1) return entityPage(roots[0], bid, ctx);
    return el('div', {}, [
      el('h2', {}, [D.chapterTitle(c)]),
      el('div', { class: 'muted small' }, [c.file + (c.page ? ' · from page ' + c.page : '')]),
      top.length ? E.nodes(top, bid) : null,
      E.guidance(loose, bid),
      roots.length ? el('div', { class: 'contents' }, [
        el('h4', {}, ['In this chapter']),
        el('ul', { class: 'items' }, roots.map((x) => el('li', {}, [el('a', { class: 'ref', href: ctx.href('book', [bid, x.id]) }, [x.name]), x.type ? el('span', { class: 'etype' }, [x.type]) : null]))),
      ]) : null,
    ]);
  }

  function showHits(results, term, bookIds, ctx) {
    results.innerHTML = '';
    if (term.length < 2) return;
    const hits = D.search(term, bookIds, 2000);
    const shown = hits.slice(0, 80);
    results.appendChild(el('div', { class: 'muted small' }, [hits.length + ' hits' + (hits.length > shown.length ? ' — the first ' + shown.length : '')]));
    shown.forEach((h) => {
      const ex = D.excerpt(h, term, 60);
      results.appendChild(el('div', { class: 'hit' }, [
        el('a', { class: 'ref', href: ctx.href('book', [h.book, h.id]) }, [h.name]),
        h.type ? el('span', { class: 'etype' }, [h.type]) : null,
        el('span', { class: 'muted small' }, [' · ' + D.label(h.book)]),
        ex ? el('div', { class: 'muted small' }, [ex]) : null,
      ]));
    });
  }

  // ── a filterable list over records ─────────────────────────────────
  function recordList(p, rows, opts) {
    const state = opts.state;
    const q = el('input', { type: 'search', class: 'search', placeholder: opts.placeholder, value: state.q || '' });
    const filters = (opts.filters || []).map((f) => {
      const sel = el('select', { class: 'scope' });
      sel.appendChild(el('option', { value: '' }, [f.all]));
      f.values(rows).forEach((v) => sel.appendChild(el('option', { value: v, selected: state[f.key] === v || null }, [f.label ? f.label(v) : String(v)])));
      sel.addEventListener('change', () => { state[f.key] = sel.value; draw(); });
      return sel;
    });
    const count = el('span', { class: 'muted small' });
    const out = el('div', {});
    function draw() {
      const t = (state.q || '').toLowerCase();
      const hit = rows.filter((r) => (!t || opts.text(r).toLowerCase().indexOf(t) !== -1) && (opts.filters || []).every((f) => !state[f.key] || f.match(r, state[f.key])));
      count.textContent = hit.length + ' of ' + rows.length;
      out.innerHTML = '';
      out.appendChild(opts.draw(hit));
    }
    q.addEventListener('input', debounce(() => { state.q = q.value.trim(); draw(); }, 150));
    p.appendChild(el('div', { class: 'chiprow filters' }, [q].concat(filters, [count])));
    p.appendChild(out);
    draw();
  }
  const uniq = (xs) => Array.from(new Set(xs.filter((x) => x != null && x !== ''))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  const openRow = (r, label) => el('a', { class: 'ref', href: '#book/' + encodeURIComponent(r.book) + '/' + encodeURIComponent(r.id) }, [label || r.name]);
  const bookFilter = { key: 'book', all: 'Every book', values: (rs) => uniq(rs.map((r) => r.book)), label: D.label, match: (r, v) => r.book === v };
  const f = (r, k) => (r.fields || {})[k];

  // ── the character profiles ─────────────────────────────────────────
  // A profile prints its Rank as a string ("5", "5/6" for a character with two forms); the
  // filter offers each printed value as it stands.
  const profState = { q: '' };
  function renderCharacters(container, path, ctx) {
    const p = page(container);
    const all = D.profiles();
    const id = path[0] && all.find((r) => r.id === path[0]) ? path[0] : null;
    if (id) {
      const r = all.find((x) => x.id === id);
      p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('characters', []) }, ['Characters']), ' › ', r.name]));
      after(p, r.book, () => p.appendChild(el('div', { class: 'site-reader solo' }, [E.render(D.entity(id))])));
      return;
    }
    p.appendChild(el('h1', {}, ['Characters']));
    p.appendChild(el('p', { class: 'muted' }, [all.length + ' character profiles, each an instance of the corpus’s ', el('code', {}, ['Character']), ' type.']));
    recordList(p, all, {
      state: profState, placeholder: 'Find a hero, a villain, a real name, a team…',
      text: (r) => [r.name, f(r, 'Real Name'), f(r, 'Teams'), f(r, 'Origin'), f(r, 'Occupation')].filter(Boolean).join(' '),
      filters: [
        { key: 'rank', all: 'Every rank', values: (rs) => uniq(rs.map((r) => f(r, 'Rank'))), label: (v) => 'Rank ' + v, match: (r, v) => f(r, 'Rank') === v },
        bookFilter,
      ],
      draw: (hit) => el('div', { class: 'table-wrap' }, [el('table', { class: 'printed list' }, [
        el('thead', {}, [el('tr', {}, ['Character', 'Rank', 'Real name', 'Origin', 'Teams', 'Book'].map((h) => el('th', {}, [h])))]),
        el('tbody', {}, hit.slice().sort((a, b) => a.name.localeCompare(b.name)).map((r) => el('tr', {}, [
          el('td', {}, [el('a', { class: 'ref', href: ctx.href('characters', [r.id]) }, [D.profileLabel(r)])]),
          el('td', {}, [f(r, 'Rank') || '']), el('td', {}, [f(r, 'Real Name') || '']), el('td', { class: 'small' }, [f(r, 'Origin') || '']),
          el('td', { class: 'small' }, [f(r, 'Teams') || '']), el('td', { class: 'muted small' }, [D.label(r.book)]),
        ]))),
      ])]),
    });
    const vehicles = D.typed('Vehicle');
    if (vehicles.length) {
      p.appendChild(el('h2', {}, ['Vehicles']));
      p.appendChild(el('ul', { class: 'items' }, vehicles.map((r) => el('li', {}, [openRow(r), el('span', { class: 'muted small' }, [' · ' + D.label(r.book)])]))));
    }
  }

  // ── the powers ─────────────────────────────────────────────────────
  // A power names its set as the book prints it ("Plasticity", "Basic", "Magic (Sorcery Set)"):
  // the filter lists each printed set.
  const powerState = { q: '' };
  function renderPowers(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Powers']));
    const rows = D.typed('Power');
    const sets = D.typed('Power Set');
    const trees = D.typed('Power Tree');
    p.appendChild(el('p', { class: 'muted' }, [rows.length + ' powers in ' + sets.length + ' power sets and ' + trees.length + ' power trees.']));
    recordList(p, rows, {
      state: powerState, placeholder: 'Find a power…',
      text: (r) => r.name + ' ' + (f(r, 'Printed Power Set') || ''),
      filters: [
        { key: 'set', all: 'Every power set', values: (rs) => uniq(rs.map((r) => f(r, 'Printed Power Set'))), match: (r, v) => f(r, 'Printed Power Set') === v },
        { key: 'action', all: 'Every action', values: (rs) => uniq(rs.map((r) => f(r, 'Action'))), match: (r, v) => f(r, 'Action') === v },
        bookFilter,
      ],
      draw: (hit) => el('div', { class: 'table-wrap' }, [el('table', { class: 'printed list' }, [
        el('thead', {}, [el('tr', {}, ['Power', 'Power set', 'Action', 'Duration', 'Cost', 'Book'].map((h) => el('th', {}, [h])))]),
        el('tbody', {}, hit.slice().sort((a, b) => a.name.localeCompare(b.name)).map((r) => el('tr', {}, [
          el('td', {}, [openRow(r)]), el('td', { class: 'small' }, [f(r, 'Printed Power Set') || '']), el('td', { class: 'small' }, [f(r, 'Action') || '']),
          el('td', { class: 'small' }, [f(r, 'Duration') || '']), el('td', { class: 'small' }, [f(r, 'Cost') || '']), el('td', { class: 'muted small' }, [D.label(r.book)]),
        ]))),
      ])]),
    });
    const group = (title, list) => (list.length ? [el('h2', {}, [title]), el('ul', { class: 'items columns' }, list.map((r) => el('li', {}, [openRow(r), el('span', { class: 'muted small' }, [' · ' + D.label(r.book)])])))] : []);
    group('Power sets', sets).concat(group('Power trees', trees), group('Narrative powers', D.typed('Narrative Power')), group('Team maneuvers', D.typed('Team Maneuver'))).forEach((n) => p.appendChild(n));
  }

  // ── character options: origins, occupations, traits, tags ─────────
  // Each set is the corpus's own type; the list shows each entry whole (they are short), the
  // book's text and fields, so a player choosing reads what the book prints.
  const OPTIONS = [
    { id: 'origins', type: 'Origin', label: 'Origins' },
    { id: 'occupations', type: 'Occupation', label: 'Occupations' },
    { id: 'traits', type: 'Trait', label: 'Traits' },
    { id: 'tags', type: 'Tag', label: 'Tags' },
  ];
  const optState = {};
  function renderOptions(container, path, ctx) {
    const p = page(container);
    const set = OPTIONS.find((o) => o.id === path[0]) || OPTIONS[0];
    p.appendChild(el('h1', {}, ['Character options']));
    p.appendChild(el('div', { class: 'chiprow subtabs' }, OPTIONS.map((o) => el('a', { class: 'chip' + (o === set ? ' on' : ''), href: ctx.href('options', [o.id]) }, [o.label + ' (' + D.typed(o.type).length + ')']))));
    const rows = D.typed(set.type);
    const st = (optState[set.id] = optState[set.id] || { q: '' });
    after(p, uniq(rows.map((r) => r.book)), () => recordList(p, rows, {
      state: st, placeholder: 'Find ' + set.label.toLowerCase().replace(/s$/, '') + '…',
      text: (r) => r.name + ' ' + (r.under || ''),
      filters: [bookFilter],
      draw: (hit) => el('div', { class: 'option-list' }, hit.map((r) => {
        const e = D.entity(r.id);
        return e ? el('div', { class: 'option' }, [E.render(e), r.under ? el('div', { class: 'muted small' }, [r.under + ' · ' + D.label(r.book)]) : null]) : null;
      })),
    }));
  }

  // ── the Multiverse: teams, places, earths, opponents ───────────────
  // Setting text, so it is one of the books' tabs (closed with them, PLAYBOOK §4b.4).
  const WORLD = ['Team Roster', 'Location', 'Alternate Earth', 'Opponent', 'Map', 'Timeline', 'Playing Guide', 'Joining Guide', 'Adventure Hooks', 'Labelled List'];
  const worldState = { q: '' };
  function renderWorld(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['The Multiverse']));
    const rows = D.records().filter((r) => WORLD.indexOf(r.type) !== -1);
    recordList(p, rows, {
      state: worldState, placeholder: 'Find a team, a place, an Earth…',
      text: (r) => r.name + ' ' + (r.under || ''),
      filters: [{ key: 'type', all: 'Everything', values: () => WORLD.filter((t) => rows.some((r) => r.type === t)), match: (r, v) => r.type === v }, bookFilter],
      draw: (hit) => el('div', {}, WORLD.map((t) => {
        const of = hit.filter((r) => r.type === t);
        return of.length ? el('section', { class: 'world-group' }, [el('h3', {}, [t, el('span', { class: 'muted small' }, [' · ' + of.length])]),
          el('ul', { class: 'items columns' }, of.map((r) => el('li', {}, [openRow(r), r.under ? el('span', { class: 'muted small' }, [' · ' + r.under]) : null])))]) : null;
      })),
    });
  }

  // ── the glossary ───────────────────────────────────────────────────
  const glossState = { q: '' };
  function renderGlossary(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Glossary']));
    const rows = D.typed('Glossary Entry');
    after(p, uniq(rows.map((r) => r.book)), () => {
      const withText = rows.map((r) => { const e = D.entity(r.id); return Object.assign({ def: D.text(e, 'Definition') || '', pages: D.text(e, 'Pages') || '', term: D.text(e, 'Term') || r.name }, r); });
      recordList(p, withText, {
        state: glossState, placeholder: 'Find a term…',
        text: (r) => r.term + ' ' + r.def,
        filters: [bookFilter],
        draw: (hit) => el('dl', { class: 'glossary' }, hit.map((r) => [
          el('dt', {}, [openRow(r, r.term), r.pages ? el('span', { class: 'muted small' }, [' · p. ' + r.pages + ' · ' + D.label(r.book)]) : el('span', { class: 'muted small' }, [' · ' + D.label(r.book)])]),
          el('dd', {}, [r.def ? E.prose(r.def, 'prose', r.book) : null]),
        ])),
      });
    });
  }

  // ── the dice ───────────────────────────────────────────────────────
  function renderDice(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['The d616']));
    after(p, 'core', () => {
      const log = el('div', { class: 'roll-log' });
      p.appendChild(Dice.roller({ onResolve: (r) => log.prepend(Dice.logLine(Dice.logEntry(r, 'You'))) }));
      p.appendChild(log);
      p.appendChild(el('p', { class: 'muted small' }, ['The middle die is the Marvel die; M is its logo, counted as 6. With edges, click a die to reroll it; trouble rerolls the best die for you. The rules, as Core Mechanics prints them:']));
      ['The Action Check', 'Edges and Troubles', 'Fantastic Rolls', 'Target Numbers'].map((n) => D.named(n, 'core')).filter(Boolean).forEach((e) => p.appendChild(el('details', { class: 'rules-ref' }, [el('summary', {}, [e.name]), E.render(e, { bare: true })])));
    });
  }

  // ── search everywhere ──────────────────────────────────────────────
  const searchState = { q: '' };
  function renderSearch(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Search the books']));
    const results = el('div', { class: 'results' });
    const q = el('input', { type: 'search', class: 'search wide', placeholder: 'A rule, a power, a name…', value: searchState.q });
    const scope = el('select', { class: 'scope' }, [el('option', { value: '' }, ['Every book'])].concat(D.books().map((b) => el('option', { value: b.id }, [b.label]))));
    const run = () => {
      const ids = scope.value ? [scope.value] : allBooks();
      results.innerHTML = '';
      if (searchState.q.length < 2) return;
      results.appendChild(el('div', { class: 'muted loading' }, [ids.length > 1 ? 'Opening every book (' + Math.round(D.books().reduce((a, b) => a + b.bytes, 0) / 1048576) + ' MB) to search them…' : '']));
      D.ensure(ids).then(() => showHits(results, searchState.q, ids, ctx));
    };
    q.addEventListener('input', debounce(() => { searchState.q = q.value.trim(); run(); }, 300));
    scope.addEventListener('change', run);
    p.appendChild(el('div', { class: 'chiprow' }, [q, scope]));
    p.appendChild(results);
    if (searchState.q) run();
    setTimeout(() => q.focus(), 0);
  }

  return [
    { id: 'book', label: 'The books', render: renderBook, books: true },
    { id: 'characters', label: 'Characters', render: renderCharacters },
    { id: 'powers', label: 'Powers', render: renderPowers },
    { id: 'options', label: 'Character options', render: renderOptions },
    { id: 'multiverse', label: 'The Multiverse', render: renderWorld, books: true },
    { id: 'glossary', label: 'Glossary', render: renderGlossary },
    { id: 'dice', label: 'Dice', render: renderDice },
    { id: 'search', label: 'Search', render: renderSearch, books: true },
  ];
})();
