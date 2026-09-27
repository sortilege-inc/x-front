// system/marvelmultiverse/creator.js — making a character: *Creating a Character* walked step by
// step (PLAYBOOK §2). Each step shows the book's own text for it, verbatim (the chapter's entities);
// the controls pick from the corpus's typed sets (Origin, Occupation, Trait, Tag, Power); the numbers
// are chargen.js's, read from the chapter's tables and sentences. What leaves is a character file the
// table takes (system/marvelmultiverse/sheet.js), or, on the GM's and the player's pages, the hero
// itself.
//
// Typing never loses its box (PLAYBOOK §2): a step is drawn once; what an edit changes elsewhere —
// the budget, a list's hits, the chosen powers — is redrawn in its own element, never the field
// being typed in.
window.MMCreator = (function () {
  const { el, button, debounce } = window.VttRender;
  const D = window.MMData;
  const E = window.MMEntity;
  const G = window.MMChargen;
  const DRAFT_KEY = ((window.VttConfig || {}).storagePrefix || 'sortilege-vtt') + ':creator-draft';

  // the chapter's own text for each step, by the entity that prints it
  const STEPS = [
    { id: 'rank', label: '1. Rank', text: ['Building a Character', 'Rank Caps', 'Starting Rank'] },
    { id: 'abilities', label: '2. Ability scores', text: ['Selecting Ability Scores', 'Ability Defense'] },
    { id: 'backstory', label: '3. Backstory', text: ['Backstory'] },
    { id: 'powers', label: '4. Powers', text: ['Powers'] },
    { id: 'scores', label: '5. Other scores', text: ['Other Scores'] },
    { id: 'data', label: 'Character data', text: ['Character Data'] },
  ];
  const DATA_FIELDS = ['Codename', 'Real Name', 'Height', 'Weight', 'Gender', 'Eyes', 'Hair', 'Distinguishing Features', 'Teams', 'Base', 'History', 'Personality'];
  const LONG = ['History', 'Personality'];

  const fresh = () => ({ rank: 1, abilities: {}, origin: null, occupation: null, traits: [], tags: [], powers: [], size: 'Average', data: {} });
  function load() { try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return d && d.rank ? Object.assign(fresh(), d) : fresh(); } catch (e) { return fresh(); } }
  function save(d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) { /* a private window: the draft lives in this page only */ } }

  // the chapter's entity of a name (the creating-a-character file, else anywhere in the core)
  // (the chapter reuses a step's name inside its worked example — "Backstory", "Other Scores" — so
  // the example's copies are passed over)
  const inExample = (e) => D.ancestors(e.id).some((a) => a.name === 'An Example Character');
  const chapterEntity = (name) => D.all(['core']).find((e) => e.name === name && /creating-a-character/.test(e.file) && !inExample(e)) || D.named(name, 'core');
  const tableOf = (name) => { const e = D.named(name, 'core'); return e && e.table ? e.table : null; };
  const val = (e, n) => D.val(e, n);
  // the draft's picks, resolved to what chargen.js reads
  function resolved(d) {
    const bs = (id) => { const e = id && D.entity(id); return e ? { name: e.name, traits: val(e, 'Traits') || [], tags: val(e, 'Tags') || [] } : null; };
    const pw = (id) => {
      const e = D.entity(id);
      if (!e) return null;
      return { id, name: e.name, set: (val(e, 'Power Sets') || [])[0] || 'Basic', effect: D.text(e, 'Effect') || '', prerequisites: D.rows(e, 'Prerequisites').map((q) => ({ power: q.Power, rank: q.Rank, printed: q.Printed })) };
    };
    return Object.assign({}, d, { origin: bs(d.origin), occupation: bs(d.occupation), powers: d.powers.map(pw).filter(Boolean) });
  }

  function render(container, path, ctx, opts) {
    const o = opts || {};
    const page = el('div', { class: 'page creator' });
    container.appendChild(page);
    page.appendChild(el('div', { class: 'muted loading' }, ['Opening the books…']));
    D.ensureAll().then(() => { page.innerHTML = ''; build(page, o); });
  }

  function build(page, o) {
    const T = G.tables(tableOf);
    let d = load();
    let step = 0;
    const commit = () => { save(d); drawBudget(); };
    const budget = el('div', { class: 'creator-budget' });
    const nav = el('div', { class: 'chiprow subtabs' });
    const body = el('div', { class: 'creator-step' });
    if (!o.embedded) page.appendChild(el('h1', {}, ['Make a character']));
    page.appendChild(nav);
    page.appendChild(budget);
    page.appendChild(body);

    function drawBudget() {
      const c = G.compute(resolved(d), T);
      const b = c.budget;
      budget.innerHTML = '';
      budget.appendChild(el('div', { class: 'chiprow tight' }, [
        el('span', { class: 'chip' }, ['Rank ' + d.rank]),
        el('span', { class: 'chip' + (b.spent > b.points ? ' over' : '') }, ['Ability points ' + b.spent + ' / ' + b.points]),
        el('span', { class: 'chip' }, ['Cap ' + b.cap]),
        el('span', { class: 'chip' + (b.powersPicked > b.powers ? ' over' : '') }, ['Powers ' + b.powersPicked + ' / ' + b.powers]),
        el('span', { class: 'chip' + (b.extraPicked > b.extraTraits ? ' over' : '') }, ['Extra traits ' + b.extraPicked + ' / ' + b.extraTraits]),
      ]));
      if (c.problems.length) budget.appendChild(el('ul', { class: 'problems' }, c.problems.map((p) => el('li', {}, [p]))));
      return c;
    }
    function drawNav() {
      nav.innerHTML = '';
      STEPS.forEach((s, i) => nav.appendChild(el('button', { class: 'chip' + (i === step ? ' on' : ''), type: 'button', onclick: () => { step = i; drawStep(); } }, [s.label])));
      nav.appendChild(button('Start over', () => { if (confirm('Clear this character and start over?')) { d = fresh(); save(d); drawStep(); } }, 'ghost tiny'));
    }
    const bookText = (names) => el('details', { class: 'book-text', open: true }, [el('summary', {}, ['The book']),
      el('div', {}, names.map(chapterEntity).filter(Boolean).map((e) => E.render(e, { depth: 1, noKids: true })))]);

    function drawStep() {
      drawNav();
      body.innerHTML = '';
      const s = STEPS[step];
      body.appendChild(el('h2', {}, [s.label]));
      ({ rank: stepRank, abilities: stepAbilities, backstory: stepBackstory, powers: stepPowers, scores: stepScores, data: stepData })[s.id](body);
      body.appendChild(bookText(s.text));
      body.appendChild(el('div', { class: 'chiprow' }, [
        step > 0 ? button('← ' + STEPS[step - 1].label, () => { step -= 1; drawStep(); }, 'ghost') : null,
        step < STEPS.length - 1 ? button(STEPS[step + 1].label + ' →', () => { step += 1; drawStep(); }) : finishButton(),
      ]));
      drawBudget();
    }

    // 1. rank: the ranks the chapter's tables print
    function stepRank(box) {
      const sel = el('select', { class: 'scope', 'aria-label': 'Rank' }, G.ranks(T).map((r) => el('option', { value: r, selected: r === d.rank || null }, ['Rank ' + r])));
      sel.addEventListener('change', () => { d.rank = Number(sel.value); commit(); });
      box.appendChild(el('label', { class: 'field' }, [el('span', { class: 'field-k' }, ['Rank']), sel]));
    }
    // 2. ability scores: six numbers against the budget
    function stepAbilities(box) {
      box.appendChild(el('div', { class: 'ability-grid' }, G.ABILITIES.map((a) => {
        const input = el('input', { type: 'number', class: 'num-in', value: d.abilities[a] || 0, min: G.ABILITY_FLOOR, step: 1, 'aria-label': a });
        const def = el('span', { class: 'muted small' }, ['defense ' + (G.DEFENSE_BASE + (Number(d.abilities[a]) || 0))]);
        // the box being typed in is never written to (a half-typed "−" stays); the buttons write it
        const set = (n, typed) => { d.abilities[a] = n; if (!typed) input.value = n; def.textContent = 'defense ' + (G.DEFENSE_BASE + n); commit(); };
        input.addEventListener('input', () => { if (input.value === '' || !/^-?\d+$/.test(input.value)) return; set(Number(input.value), true); });
        return el('div', { class: 'ability-row' }, [el('span', { class: 'check-name' }, [a]), button('−', () => set((Number(d.abilities[a]) || 0) - 1), 'ghost tiny'), input, button('+', () => set((Number(d.abilities[a]) || 0) + 1), 'ghost tiny'), def]);
      })));
    }
    // a picker over a typed set: a filter box whose hits redraw alone
    function picker(type, onPick, placeholder, taken) {
      const rows = D.typed(type);
      const q = el('input', { type: 'search', class: 'search', placeholder, 'aria-label': placeholder });
      const hits = el('div', { class: 'picker-hits' });
      const draw = () => {
        hits.innerHTML = '';
        const t = q.value.trim().toLowerCase();
        const list = rows.filter((r) => (!t || (r.name + ' ' + ((r.fields || {})['Printed Power Set'] || '')).toLowerCase().indexOf(t) !== -1) && !(taken && taken(r)));
        list.slice(0, 40).forEach((r) => hits.appendChild(el('div', { class: 'pick-row' }, [
          button('+', () => { onPick(r); draw(); }, 'tiny'),
          el('button', { class: 'ref', type: 'button', onclick: () => preview(r.id) }, [r.name]),
          el('span', { class: 'muted small' }, [' · ' + [(r.fields || {})['Printed Power Set'], (r.fields || {}).Action, D.label(r.book)].filter(Boolean).join(' · ')]),
        ])));
        if (list.length > 40) hits.appendChild(el('div', { class: 'muted small' }, ['… ' + (list.length - 40) + ' more; narrow the search.']));
      };
      q.addEventListener('input', debounce(draw, 150));
      draw();
      return el('div', { class: 'picker' }, [q, hits]);
    }
    const previewBox = el('div', { class: 'preview-box' });
    function preview(id) { previewBox.innerHTML = ''; const e = D.entity(id); if (e) previewBox.appendChild(el('div', { class: 'paper' }, [E.render(e)])); }
    const labelOf = (id) => { const r = D.record(id); return r ? r.name + (D.books().length > 1 ? ' (' + D.label(r.book) + ')' : '') : id; };

    // 3. backstory: one origin, one occupation, extra traits (one per rank) and any tags
    function stepBackstory(box) {
      const one = (key, type) => {
        const sel = el('select', { class: 'scope', 'aria-label': type }, [el('option', { value: '' }, ['Pick an ' + type.toLowerCase() + '…'])].concat(D.typed(type).slice().sort((a, b) => a.name.localeCompare(b.name)).map((r) => el('option', { value: r.id, selected: d[key] === r.id || null }, [labelOf(r.id)]))));
        sel.addEventListener('change', () => { d[key] = sel.value || null; commit(); drawGranted(); if (sel.value) preview(sel.value); });
        return el('label', { class: 'field' }, [el('span', { class: 'field-k' }, [type]), sel]);
      };
      const granted = el('div', { class: 'granted' });
      const chosen = el('div', { class: 'chosen' });
      const drawGranted = () => {
        const r = resolved(d);
        granted.innerHTML = '';
        granted.appendChild(el('div', { class: 'muted small' }, ['From the origin and occupation — traits: ' + ([].concat((r.origin || {}).traits || [], (r.occupation || {}).traits || []).join(', ') || 'none') + '; tags: ' + ([].concat((r.origin || {}).tags || [], (r.occupation || {}).tags || []).join(', ') || 'none')]));
      };
      const drawChosen = () => {
        chosen.innerHTML = '';
        ['traits', 'tags'].forEach((k) => chosen.appendChild(el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, [k === 'traits' ? 'Extra traits' : 'Tags'])].concat(d[k].map((n, i) => el('span', { class: 'chip' }, [n, el('button', { class: 'ref tiny', type: 'button', title: 'remove', onclick: () => { d[k].splice(i, 1); commit(); drawChosen(); } }, ['×'])]))))));
      };
      box.appendChild(el('div', { class: 'chiprow' }, [one('origin', 'Origin'), one('occupation', 'Occupation')]));
      box.appendChild(granted);
      box.appendChild(chosen);
      box.appendChild(el('div', { class: 'two-col' }, [
        el('div', {}, [el('div', { class: 'prop-k' }, ['Add a trait']), picker('Trait', (r) => { if (d.traits.indexOf(r.name) === -1) d.traits.push(r.name); commit(); drawChosen(); }, 'Find a trait…', (r) => d.traits.indexOf(r.name) !== -1)]),
        el('div', {}, [el('div', { class: 'prop-k' }, ['Add a tag']), picker('Tag', (r) => { if (d.tags.indexOf(r.name) === -1) d.tags.push(r.name); commit(); drawChosen(); }, 'Find a tag…', (r) => d.tags.indexOf(r.name) !== -1)]),
      ]));
      box.appendChild(previewBox);
      drawGranted();
      drawChosen();
    }
    // 4. powers: four per rank, each with its prerequisites
    function stepPowers(box) {
      const chosen = el('div', { class: 'chosen' });
      const drawChosen = () => {
        chosen.innerHTML = '';
        const rp = resolved(d).powers;
        if (!rp.length) chosen.appendChild(el('div', { class: 'muted' }, ['No powers yet.']));
        rp.forEach((p, i) => chosen.appendChild(el('div', { class: 'pick-row' }, [
          el('button', { class: 'ref', type: 'button', onclick: () => preview(p.id) }, [p.name]),
          el('span', { class: 'muted small' }, [' · ' + p.set + (p.prerequisites.length ? ' · needs ' + p.prerequisites.map((q) => q.printed).join(', ') : '')]),
          button('×', () => { d.powers.splice(i, 1); commit(); drawChosen(); }, 'ghost tiny'),
        ])));
      };
      box.appendChild(chosen);
      box.appendChild(el('div', { class: 'prop-k' }, ['Add a power']));
      box.appendChild(picker('Power', (r) => { if (d.powers.indexOf(r.id) === -1) d.powers.push(r.id); commit(); drawChosen(); }, 'Find a power or a power set…', (r) => d.powers.indexOf(r.id) !== -1));
      box.appendChild(previewBox);
      drawChosen();
    }
    // 5. other scores: what the rules make of the choices, as the sheet will show them
    function stepScores(box) {
      const size = el('input', { type: 'text', class: 'text', value: d.size || 'Average', 'aria-label': 'Size' });
      size.addEventListener('input', () => { d.size = size.value; commit(); });
      box.appendChild(el('label', { class: 'field' }, [el('span', { class: 'field-k' }, ['Size']), size]));
      const c = G.compute(resolved(d), T);
      const v = c.values;
      box.appendChild(el('div', { class: 'stats' }, ['Health', 'Focus', 'Karma', 'Initiative Modifier'].map((k) => el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [k === 'Initiative Modifier' ? 'Initiative' : k]), el('div', { class: 'stat-v' }, [v[k]])]))));
      box.appendChild(el('div', { class: 'muted' }, ['Speeds: ' + v.Speeds.map((s) => s.Mode + ' ' + s.Speed).join(' · ')]));
      box.appendChild(el('div', { class: 'table-wrap' }, [el('table', { class: 'printed' }, [
        el('thead', {}, [el('tr', {}, ['Ability', 'Score', 'Defense', 'Non-combat', 'Damage'].map((h) => el('th', {}, [h])))]),
        el('tbody', {}, v.Abilities.map((a) => { const dl = v.Damage.find((x) => x.Ability === a.Ability); return el('tr', {}, [a.Ability, a['Ability Score'], a['Defense Score'], a['Non-Combat Checks'], dl ? 'dMarvel × ' + dl.Multiplier + (dl['Ability Score'] !== '0' ? ' + ' + dl['Ability Score'] : '') : '—'].map((x) => el('td', {}, [x]))); })),
      ])]));
    }
    // character data: the sheet's own fields, typed freely
    function stepData(box) {
      box.appendChild(el('div', { class: 'fields' }, DATA_FIELDS.map((k) => {
        const input = el(LONG.indexOf(k) !== -1 ? 'textarea' : 'input', { class: 'text', rows: 4, value: d.data[k] || '', 'aria-label': k }, LONG.indexOf(k) !== -1 ? [d.data[k] || ''] : []);
        input.addEventListener('input', () => { d.data[k] = input.value; save(d); });
        return el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [k]), el('div', { class: 'prop-v' }, [input])]);
      })));
    }
    function finishButton() {
      return button(o.doneLabel || 'Download the character file', () => {
        const c = G.compute(resolved(d), T);
        if (c.problems.length) { alert('Not yet — the book says:\n\n' + c.problems.join('\n')); return; }
        if (o.onDone) o.onDone(c.values);
        else download(c.values);
      }, 'primary');
    }
    drawStep();
  }

  // the character file the table reads (system/marvelmultiverse/sheet.js readMember), written here so
  // the site — which keeps no campaign state — can hand it over
  function download(values) {
    const file = { kind: 'marvelmultiverse-character', version: 2, name: values.Name, player: '', profile: null, character: values, live: {} };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: String(values.Name || 'hero').replace(/[^\w-]+/g, '-').toLowerCase() + '.json' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  return { render, STEPS, download };
})();
