// system/marvelmultiverse/panels.js — the Narrator's panels: Adventure (the running scene), Heroes,
// Inspector, Cast, Powers, Dice, Rules & Book, Log, Campaign. Registered into the engine's registry;
// the shell (engine/app.js) decides where they show. Every word of rules text shown comes from the
// corpus; a book's text is loaded when a panel first needs it. Ported from sortilege-vtt-vtm5e
// (system/vtm5e/panels.js): its Coterie, Inspector, Cast, Dice, Rules & Book, Log and Campaign;
// Powers stands where its Disciplines stood. Since D5 the scenes are the Narrator's arc (the Scenes
// outline, system/marvelmultiverse/gm-panes.js) and a scene's cast is tracked copies
// (system/marvelmultiverse/table.js), as in sortilege-vtt-coyotecrow's workbench.
(function () {
  const { el, button, debounce, dragSort } = window.VttRender;
  const D = window.MMData;
  const E = window.MMEntity;
  const Dice = window.MMDice;
  const Sheet = window.MMSheet;
  const State = window.VttState;
  const Panels = window.VttPanels;
  const Sys = () => window.VttSystem;
  const S = () => State.state;
  const MODULE = 'adventure';

  // a link inside any rendered entity opens it in the Inspector here, not the reader
  window.MMOpenEntity = (id) => Panels.select({ kind: 'entity', id });

  const currentScene = () => Sys().scene(Sys().currentSceneId());
  function goTo(sceneId) {
    State.commit('setCurrentScene', [MODULE, sceneId]);
    window.VttBus.emit('scene:changed', { moduleId: MODULE, sceneId });
  }
  const editing = (container) => document.activeElement && /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName) && container.contains(document.activeElement);
  const log = (entry) => State.commit('appendLog', [entry]);
  const loading = (what) => el('div', { class: 'muted small' }, ['Opening ' + what + '…']);
  const bookLabel = (b) => (D.indexBook(b) || {}).label || b;
  const tracker = (sceneId, c) => (window.MMGmPanes ? window.MMGmPanes.instTracker(sceneId, c) : null);

  // ── Adventure: the running scene, and who is in it ─────────────────
  // The scenes are the Scenes outline's (the arc); this panel runs one: its cast as tracked copies,
  // each with its Health and Focus, and a search that puts one more copy in.
  function renderAdventure(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const all = Sys().scenes();
      const cur = currentScene();
      if (!all.length) {
        container.appendChild(el('div', { class: 'empty' }, ['No scenes yet. Write them in Scenes — a card each, with its beats and encounters — and run one here.']));
        container.appendChild(button('Open Scenes', () => ctx.navigate('scenes'), 'tiny'));
        return;
      }
      const pick = el('select', { class: 'scope', 'aria-label': 'The running scene' }, all.map((sc) => el('option', { value: sc.id, selected: cur && cur.id === sc.id || null }, [(sc.phase ? sc.phase + ' · ' : '') + sc.name])));
      pick.addEventListener('change', () => goTo(pick.value));
      container.appendChild(el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, ['Running']), pick]));
      if (!cur) return;
      container.appendChild(el('h4', {}, [cur.name]));
      if (cur.arc && cur.arc.summary) container.appendChild(el('p', { class: 'muted' }, [cur.arc.summary]));
      container.appendChild(el('div', { class: 'chiprow tight' }, [
        button('Open on the table', () => window.open(window.VttConfig.pages.table + '?scene=' + encodeURIComponent(cur.id), (window.VttConfig.channel || 'vtt') + '-table'), 'tiny'),
        button('Its card in Scenes', () => ctx.navigate('scenes'), 'ghost tiny'),
      ]));
      const here = Sys().castEntries(cur.id);
      container.appendChild(el('div', { class: 'prop-k' }, ['In it', el('span', { class: 'muted' }, [here.length ? ' · ' + here.length : ''])]));
      if (!here.length) container.appendChild(el('div', { class: 'muted small' }, ['No one yet — put someone in below, from the Cast, or from an encounter in Scenes.']));
      here.forEach((c) => { const t = tracker(cur.id, c); if (t) container.appendChild(t); });
      const hits = el('div');
      const find = el('input', { type: 'search', class: 'text', placeholder: '+ a character', 'aria-label': 'Put someone in this scene' });
      find.addEventListener('input', debounce(() => {
        const q = find.value.trim().toLowerCase();
        hits.innerHTML = '';
        if (q.length < 2) return;
        D.profiles().filter((r) => r.name.toLowerCase().indexOf(q) !== -1).slice(0, 8)
          .forEach((r) => hits.appendChild(button('+ ' + D.profileLabel(r), () => Sys().addToScene(cur.id, r.id, 1), 'ghost tiny')));
      }, 150));
      container.appendChild(find);
      container.appendChild(hits);
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    ctx.on('state:remote', () => { if (!editing(container)) draw(); });
    ctx.on('scene:changed', draw);
    draw();
  }

  // ── Heroes: the party ──────────────────────────────────────────────
  function characterLoader(label, cls) {
    const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true, multiple: true });
    file.addEventListener('change', () => {
      const files = Array.from(file.files || []);
      Promise.all(files.map((f) => f.text().then((text) => Sheet.readMember(JSON.parse(text), f.name))))
        .then((members) => {
          members.forEach((m) => State.commit('addPartyMember', [m]));
          if (members.length) Panels.select({ kind: 'party', id: members[members.length - 1].id });
        })
        .catch((e) => alert(e.message))
        .finally(() => (file.value = ''));
    });
    return el('span', {}, [button(label, () => file.click(), cls), file]);
  }

  let makerOpen = false;
  function renderParty(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const party = S().party || [];
      // a hero from a profile (the books' own characters), or a blank one by name
      const profiles = D.profiles().slice().sort((a, b) => a.name.localeCompare(b.name));
      const pick = el('select', { class: 'scope', 'aria-label': 'A character profile' }, [el('option', { value: '' }, ['A character profile…'])].concat(profiles.map((r) => el('option', { value: r.id }, [D.profileLabel(r) + ((r.fields || {}).Rank ? ' · Rank ' + r.fields.Rank : '')]))));
      const player = el('input', { type: 'text', class: 'text small', placeholder: 'Player' });
      const name = el('input', { type: 'text', class: 'text small', placeholder: 'or a blank hero’s name' });
      const add = () => {
        try {
          const m = pick.value ? Sheet.fromProfile(pick.value, player.value) : Sheet.newMember(name.value, player.value);
          State.commit('addPartyMember', [m]);
          Panels.select({ kind: 'party', id: m.id });
        } catch (e) { alert(e.message); }
      };
      container.appendChild(el('div', { class: 'chiprow tight' }, [pick]));
      container.appendChild(el('div', { class: 'chiprow tight' }, [name, player, button('Add', add, 'tiny')]));
      container.appendChild(el('div', { class: 'chiprow tight' }, [characterLoader('Load character file(s)…', 'ghost tiny'), button(makerOpen ? 'Close the creator' : 'Make a hero…', () => { makerOpen = !makerOpen; draw(); }, 'ghost tiny')]));
      // the site's creator, here: what it makes joins the heroes
      if (makerOpen) {
        const maker = el('div', { class: 'paper maker' });
        container.appendChild(maker);
        window.MMCreator.render(maker, null, null, { embedded: true, doneLabel: 'Take this hero to the table', onDone: (v) => {
          const m = Sheet.fromValues(v, player.value);
          makerOpen = false;
          State.commit('addPartyMember', [m]);
          Panels.select({ kind: 'party', id: m.id });
        } });
      }
      if (!party.length) container.appendChild(el('div', { class: 'empty' }, ['No heroes yet.']));
      party.forEach((m) => container.appendChild(el('div', { class: 'member' }, [
        el('button', { class: 'card static-card', type: 'button', onclick: () => Panels.select({ kind: 'party', id: m.id }) }, [
          el('div', { class: 'card-name' }, [m.name]),
          el('div', { class: 'card-meta' }, [Sheet.sentence(m)]),
        ]),
        // the Narrator's notes on this hero (the People pane's sections about them)
        window.VttGmText ? window.VttGmText.aboutSections('pc', m.name, draw) : null,
        el('div', { class: 'member-ops' }, [
          button('file', () => Sheet.downloadMember(m), 'ghost tiny'),
          button('remove', () => { if (confirm('Remove ' + m.name + ' from the heroes?')) State.commit('removePartyMember', [m.id]); }, 'ghost tiny'),
        ]),
      ])));
    };
    ctx.on('state:changed', () => { if (!editing(container) && !makerOpen) draw(); });
    ctx.on('state:remote', () => { if (!makerOpen) draw(); });
    draw();
  }

  // ── Inspector ──────────────────────────────────────────────────────
  function renderInspector(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const sel = Panels.selection();
      if (!sel) return container.appendChild(el('div', { class: 'empty' }, ['Nothing selected. Click a name anywhere — a scene’s cast, a power, a rule, a hero.']));
      if (sel.kind === 'entity') {
        const e = D.entity(sel.id);
        const r = D.record(sel.id);
        if (!e) {
          if (!r) return container.appendChild(el('div', { class: 'empty' }, ['Not in the books: ' + sel.id]));
          container.appendChild(loading(bookLabel(r.book)));
          D.ensure(r.book).then(draw);
          return;
        }
        const cur = currentScene();
        container.appendChild(el('div', { class: 'chiprow tight' }, [
          cur && D.isProfile(e) ? button('Put ' + (Sys().castIds(cur.id).indexOf(e.id) === -1 ? '' : 'another ') + 'in ' + cur.name, () => Sys().addToScene(cur.id, e.id, 1), 'tiny') : null,
          el('a', { class: 'btn ghost tiny', href: './#book/' + encodeURIComponent(e.book) + '/' + encodeURIComponent(e.id), target: '_blank' }, ['In the reader']),
        ]));
        // the Narrator's notes on this one (the People pane's sections "about" it)
        // a tracked copy (from a scene's cast, a token, an encounter): its own Health and Focus first
        if (sel.iid && cur) {
          const c = Sys().castEntries(cur.id).find((x) => x.iid === sel.iid);
          if (c) container.appendChild(el('div', { class: 'paper copy-tracker' }, [el('div', { class: 'inst-name' }, [Sys().instLabel(c)]), tracker(cur.id, c)]));
        }
        const about = window.VttGmText && window.VttGmText.aboutSections('people', e.id, draw);
        if (about) container.appendChild(about);
        container.appendChild(el('div', { class: 'paper' }, [E.render(e, { noKids: D.descendants(e.id) > 40 })]));
      } else if (sel.kind === 'party') {
        const m = (S().party || []).find((x) => x.id === sel.id);
        const about = m && window.VttGmText && window.VttGmText.aboutSections('pc', m.name, draw);
        if (about) container.appendChild(about);
        container.appendChild(m ? Sys().liveSheet(m, {}) : el('div', { class: 'empty' }, ['That hero is no longer at the table.']));
      } else container.appendChild(el('div', { class: 'empty' }, ['Nothing to show for ' + sel.kind + '.']));
    };
    ctx.on('select', draw);
    ctx.on('state:changed', () => { const sel = Panels.selection(); if (sel && (sel.kind === 'party' || sel.iid) && !editing(container)) draw(); });
    ctx.on('state:remote', () => { const sel = Panels.selection(); if (sel && (sel.kind === 'party' || sel.iid)) draw(); });
    draw();
  }

  // ── Cast: every character profile the books print ──────────────────
  function renderCast(container, ctx) {
    let q = '';
    let book = '';
    container.innerHTML = '';
    const all = D.profiles();
    const search = el('input', { type: 'search', class: 'search', placeholder: 'A name, a real name, a team…' });
    const scope = el('select', { class: 'scope' }, [el('option', { value: '' }, ['Every book'])].concat(D.books().map((b) => el('option', { value: b.id }, [b.label + ' (' + all.filter((r) => r.book === b.id).length + ')']))));
    const list = el('div');
    const f = (r, k) => (r.fields || {})[k] || '';
    const drawList = () => {
      list.innerHTML = '';
      const t = q.toLowerCase();
      const hit = all.filter((r) => (!book || r.book === book) && (!t || [r.name, f(r, 'Real Name'), f(r, 'Teams'), f(r, 'Origin')].join(' ').toLowerCase().indexOf(t) !== -1))
        .sort((a, b) => a.name.localeCompare(b.name));
      const cur = currentScene();
      list.appendChild(el('div', { class: 'muted small' }, [hit.length + ' profiles' + (cur ? ' · + puts one in ' + cur.name : '')]));
      list.appendChild(el('ul', { class: 'items toc' }, hit.map((r) => el('li', {}, [
        cur ? el('button', { class: 'ref tiny', type: 'button', title: 'Put in ' + cur.name, onclick: () => Sys().addToScene(cur.id, r.id, 1) }, ['+']) : null,
        el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: r.id }) }, [D.profileLabel(r)]),
        el('span', { class: 'muted small' }, [' · ' + [f(r, 'Rank') ? 'Rank ' + f(r, 'Rank') : null, bookLabel(r.book)].filter(Boolean).join(' · ')]),
      ]))));
    };
    search.addEventListener('input', debounce(() => { q = search.value.trim(); drawList(); }, 150));
    scope.addEventListener('change', () => { book = scope.value; drawList(); });
    container.appendChild(el('div', { class: 'search-row' }, [search, scope]));
    container.appendChild(list);
    ctx.on('scene:changed', drawList);
    ctx.on('state:changed', () => { if (!editing(container)) drawList(); });
    drawList();
  }

  // ── Powers: by power set, as each power prints its set ─────────────
  function renderPowers(container, ctx) {
    container.innerHTML = '';
    let q = '';
    const search = el('input', { type: 'search', class: 'search', placeholder: 'A power, a power set…' });
    const body = el('div');
    const all = D.typed('Power');
    const draw = () => {
      body.innerHTML = '';
      const t = q.toLowerCase();
      const bySet = {};
      all.forEach((r) => {
        const set = (r.fields || {})['Printed Power Set'] || 'Not printed';
        if (t && (r.name + ' ' + set).toLowerCase().indexOf(t) === -1) return;
        (bySet[set] = bySet[set] || []).push(r);
      });
      Object.keys(bySet).sort().forEach((set) => body.appendChild(el('details', { class: 'book', open: t ? true : null }, [
        el('summary', {}, [set, el('span', { class: 'muted small' }, [' · ' + bySet[set].length])]),
        el('ul', { class: 'items toc' }, bySet[set].sort((a, b) => a.name.localeCompare(b.name)).map((r) => el('li', {}, [
          el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: r.id }) }, [r.name]),
          el('span', { class: 'muted small' }, [' · ' + [(r.fields || {}).Action, (r.fields || {}).Cost, bookLabel(r.book)].filter(Boolean).join(' · ')]),
        ]))),
      ])));
    };
    search.addEventListener('input', debounce(() => { q = search.value.trim(); draw(); }, 150));
    container.appendChild(search);
    container.appendChild(body);
    draw();
  }

  // ── Dice ───────────────────────────────────────────────────────────
  // Roll for the Narrator or for a hero; every roll goes to the Log. The roller's tables are
  // the core's, so the core is loaded first.
  function renderDice(container, ctx) {
    let who = '';
    const draw = () => {
      container.innerHTML = '';
      if (!D.loaded('core')) { container.appendChild(loading('the Core Rulebook')); D.ensure('core').then(draw); return; }
      const party = S().party || [];
      const m = party.find((x) => x.id === who) || null;
      const pick = el('select', { class: 'scope' }, [el('option', { value: '' }, ['The Narrator'])].concat(party.map((x) => el('option', { value: x.id, selected: x.id === who || null }, [x.name]))));
      pick.addEventListener('change', () => { who = pick.value; draw(); });
      container.appendChild(el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, ['Rolling for']), pick]));
      container.appendChild(Dice.roller({
        who: m ? m.name : 'Narrator',
        onResolve: (r) => log(Object.assign(Dice.logEntry(r, m ? m.name : 'Narrator'), { kind: 'roll' }, m ? { memberId: m.id } : {})),
      }));
    };
    ctx.on('state:remote', () => { if (!editing(container)) draw(); });
    draw();
  }

  // ── Rules & Book ───────────────────────────────────────────────────
  function renderRules(container, ctx) {
    container.innerHTML = '';
    const input = el('input', { type: 'search', class: 'search', placeholder: 'Search the open books… ( / )', autocomplete: 'off' });
    const scope = el('select', { class: 'scope' });
    const note = el('div', { class: 'muted small' });
    const results = el('div', { class: 'results' });
    const browser = el('div', { class: 'browser' });
    const loadedBooks = () => D.books().map((b) => b.id).filter(D.loaded);
    const drawScope = () => {
      const v = scope.value;
      scope.innerHTML = '';
      scope.appendChild(el('option', { value: '' }, ['The open books']));
      D.books().forEach((b) => scope.appendChild(el('option', { value: b.id }, [b.label + (D.loaded(b.id) ? '' : ' (open)')])));
      scope.value = v;
    };
    const bookIds = () => (scope.value ? [scope.value] : loadedBooks());
    function tree(list) {
      return el('ul', { class: 'items toc' }, list.map((e) => {
        const kids = D.children(e.id);
        return el('li', {}, [
          el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: e.id }) }, [e.name]),
          kids.length ? el('details', { class: 'chapter' }, [el('summary', { class: 'muted small' }, [kids.length + ' under it']), tree(kids)]) : null,
        ]);
      }));
    }
    function drawBrowser() {
      browser.innerHTML = '';
      const open = loadedBooks();
      note.textContent = open.length ? 'Open: ' + open.map(bookLabel).join(', ') : 'No book open yet — pick one above.';
      open.filter((b) => !scope.value || b === scope.value).forEach((b) => {
        browser.appendChild(el('details', { class: 'book', open: !!scope.value || null }, [
          el('summary', {}, [bookLabel(b), el('span', { class: 'muted small' }, [' · ' + D.indexBook(b).counts.entities])]),
          el('ul', { class: 'items toc' }, D.chapters(b).filter((c) => c.kind !== 'actor').map((c) => el('li', {}, [
            el('details', { class: 'chapter' }, [el('summary', {}, [D.shortTitle(c)]), tree((c.roots || []).map(D.entity).filter(Boolean))]),
          ]))),
        ]));
      });
    }
    const run = debounce(() => {
      results.innerHTML = '';
      const q = input.value.trim();
      browser.hidden = !!q;
      if (q.length < 2) return;
      const hits = D.search(q, bookIds(), 150);
      if (!hits.length) return results.appendChild(el('div', { class: 'empty' }, ['Nothing matches in the open books.']));
      results.appendChild(el('div', { class: 'muted small' }, [hits.length + (hits.length === 1 ? ' result' : ' results')]));
      hits.forEach((e) => results.appendChild(el('div', { class: 'hit' }, [
        el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: e.id }) }, [e.name]),
        el('span', { class: 'muted small' }, [' · ' + bookLabel(e.book)]),
        (() => { const ex = D.excerpt(e, q, 60); return ex ? el('div', { class: 'muted small' }, [ex]) : null; })(),
      ])));
    }, 150);
    input.addEventListener('input', run);
    scope.addEventListener('change', () => {
      const b = scope.value;
      if (b && !D.loaded(b)) {
        note.textContent = 'Opening ' + bookLabel(b) + '…';
        D.ensure(b).then(() => { drawScope(); scope.value = b; drawBrowser(); run(); });
      } else { drawBrowser(); run(); }
    });
    drawScope();
    container.appendChild(el('div', { class: 'search-row' }, [input, scope]));
    container.appendChild(el('div', { class: 'chiprow tight' }, [note, button('Open every book', () => { note.textContent = 'Opening every book…'; D.ensureAll().then(() => { drawScope(); drawBrowser(); run(); }); }, 'ghost tiny')]));
    container.appendChild(results);
    container.appendChild(browser);
    if (!D.loaded('core')) D.ensure('core').then(() => { drawScope(); drawBrowser(); });
    else drawBrowser();
    container.focusSearch = () => input.focus();
  }

  // ── Log ────────────────────────────────────────────────────────────
  function renderLog(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const entries = (S().log || []).slice().reverse();
      if (!entries.length) return container.appendChild(el('div', { class: 'empty' }, ['Nothing logged yet.']));
      entries.forEach((x) => container.appendChild(x.kind === 'roll' ? Dice.logLine(x) : el('div', { class: 'log-line' }, [
        el('span', { class: 'muted small' }, [(x.kind || 'note') + ' · ']), x.text || JSON.stringify(x),
      ])));
    };
    ctx.on('state:changed', draw);
    ctx.on('state:remote', draw);
    draw();
  }

  // ── Campaign ───────────────────────────────────────────────────────
  function renderCampaign(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const c = S().campaign;
      const name = el('input', { type: 'text', value: c.name || '', class: 'text', onchange: (ev) => State.commit('setCampaign', [{ name: ev.target.value }]) });
      container.appendChild(el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, ['Campaign']), el('div', { class: 'prop-v' }, [name])]));
      const party = S().party || [];
      container.appendChild(el('h4', {}, ['The heroes', el('span', { class: 'muted small' }, [' · saved in the pack'])]));
      container.appendChild(party.length ? el('ul', { class: 'items' }, party.map((m) => el('li', {}, [
        el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'party', id: m.id }) }, [m.name]),
        el('span', { class: 'muted small' }, [' · ' + Sheet.sentence(m)]),
      ]))) : el('div', { class: 'empty' }, ['No one yet.']));
      const list = State.listCampaigns();
      container.appendChild(el('h4', {}, ['Campaigns in this browser']));
      container.appendChild(el('ul', { class: 'items' }, list.map((row) => el('li', {}, [
        row.id === State.id ? el('b', {}, [row.name || row.id]) : el('button', { class: 'ref', type: 'button', onclick: () => { State.switchTo(row.id); location.reload(); } }, [row.name || row.id]),
        row.id !== State.id ? button('remove', () => { if (confirm('Remove "' + row.name + '" from this browser? Save its pack first if you want it back.')) { State.remove(row.id); draw(); } }, 'ghost tiny') : null,
      ]))));
      const file = el('input', { type: 'file', accept: 'application/json', hidden: true, onchange: (ev) => {
        const f = ev.target.files[0];
        if (!f) return;
        f.text().then((txt) => {
          try { State.importPack(JSON.parse(txt)); location.reload(); } catch (e) { alert(e.message); }
        });
      } });
      container.appendChild(el('div', { class: 'chiprow' }, [
        button('New campaign', () => { const n = prompt('Campaign name'); if (n) { State.create(n, { campaign: { modules: [], books: [] } }); location.reload(); } }),
        button('Save pack (download)', () => State.downloadPack()),
        button('Restore pack…', () => file.click(), 'ghost'),
        file,
      ]));
      container.appendChild(el('p', { class: 'muted small' }, ['A pack is the campaign as an instance: the heroes, the scenes and who is in them, every note and roll, as JSON. Keep packs with the campaign; this browser is a cache.']));
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    draw();
  }

  Panels.register('adventure', { label: 'Adventure', render: renderAdventure });
  Panels.register('party', { label: 'Heroes', render: renderParty });
  Panels.register('inspector', { label: 'Inspector', render: renderInspector });
  Panels.register('cast', { label: 'Cast', render: renderCast });
  Panels.register('powers', { label: 'Powers', render: renderPowers });
  Panels.register('dice', { label: 'Dice', render: renderDice });
  Panels.register('rules', { label: 'Rules & Book', render: renderRules });
  Panels.register('log', { label: 'Log', render: renderLog });
  Panels.register('campaign', { label: 'Campaign', render: renderCampaign });

  window.MMPanels = { currentScene, goTo, characterLoader, MODULE };
})();
