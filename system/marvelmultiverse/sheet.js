// system/marvelmultiverse/sheet.js — a hero at the table: the sheet derived from ACTOR "Character".
//
// What a sheet shows is what the ACTOR declares (PLAYBOOK §1b): its properties, in their declared
// order, walked down the EXTENDS chain (an X-Men Expansion Character adds Notes and Reliance Marks).
// A value is shown the way its declaration types it — a string as a field, a typed list of rows as
// the book prints those rows. A few fields get a layout of their own because the book's profile
// sets them so: the head's numbers, the ability grid, the damages, the powers by set.
//
// A hero's values come from one of two places, never copied into the pack from the corpus:
//   * a printed profile (m.profile — its entity, read at runtime), or
//   * the character creator (m.character — values in the same shape, made by chargen.js).
// What the table tracks is the hero's live state:
//   live { health, focus, karma }   current values; each starts at the sheet's own number
//
// A character file: { kind: 'marvelmultiverse-character', version: 2, name, player, profile,
// character, live } (version 1, M3's, had no character).
window.MMSheet = (function () {
  const { el, button } = window.VttRender;
  const D = window.MMData;
  const E = window.MMEntity;
  const Dice = window.MMDice;
  const G = window.MMChargen;
  const State = window.VttState;

  const FILE_KIND = 'marvelmultiverse-character';
  const TRACKS = [
    { key: 'health', label: 'Health', field: 'Health' },
    { key: 'focus', label: 'Focus', field: 'Focus' },
    { key: 'karma', label: 'Karma', field: 'Karma' },
  ];
  const printedInt = (s) => G.num(s);
  const ACTOR = 'Character';

  // ── values ─────────────────────────────────────────────────────────
  const profileOf = (m) => (m && m.profile ? D.entity(m.profile) : null);
  const profileRecord = (m) => (m && m.profile ? D.record(m.profile) : null);
  const booksFor = (m) => { const r = profileRecord(m); return r ? [r.book] : []; };
  // an entity's property values, by name: a scalar as its string, a typed list as rows
  function entityValues(e) {
    const out = {};
    (e.props || []).forEach((p) => {
      if (p.vk === 'list') out[p.name] = p.ofHash ? (p.items || []).filter((it) => it.d).map(D.rowOf) : (p.items || []).map(D.arg);
      else out[p.name] = D.pval(p);
    });
    return out;
  }
  // the hero's values: the creator's, or the profile's (its record's until its book has loaded)
  function values(m) {
    if (m && m.character) return m.character;
    const e = profileOf(m);
    if (e) return entityValues(e);
    const r = profileRecord(m);
    return r ? Object.assign({ Name: r.name }, r.fields || {}) : { Name: m ? m.name : '' };
  }
  const typeOf = (m) => { const e = profileOf(m); return (e && e.type) || ACTOR; };
  // the tops the trackers start at: the sheet's own numbers
  const maxOf = (m, t) => printedInt(values(m)[t.field]);
  const current = (m, t) => { const v = (m.live || {})[t.key]; return v != null ? v : maxOf(m, t); };
  const startLive = (v) => { const live = {}; TRACKS.forEach((t) => { const n = printedInt(v[t.field]); if (n != null) live[t.key] = n; }); return live; };

  // ── members and files ──────────────────────────────────────────────
  function fromProfile(id, player) {
    const r = D.record(id);
    if (!r) throw new Error('No such profile: ' + id);
    return { id: State.genId('pc'), templateId: id, name: r.name, player: player || '', profile: id, character: null, source: { kind: 'profile', id, book: r.book }, live: startLive(r.fields || {}), notes: '' };
  }
  // a hero the creator made; `file` as the source kind lets a player bring it to a session
  function fromValues(v, player) {
    return { id: State.genId('pc'), templateId: 'created', name: v.Name || 'A new hero', player: player || '', profile: null, character: v, source: { kind: 'file', name: 'the creator' }, live: startLive(v), notes: '' };
  }
  function newMember(name, player) {
    const n = String(name || '').trim();
    if (!n) throw new Error('Name the hero first.');
    return { id: State.genId('pc'), templateId: 'blank', name: n, player: String(player || '').trim(), profile: null, character: { Name: n }, source: { kind: 'blank' }, live: {}, notes: '' };
  }
  function fileOf(m) {
    return { kind: FILE_KIND, version: 2, name: m.name, player: m.player || '', profile: m.profile || null, character: m.profile ? null : (m.character || null), live: Object.assign({}, m.live || {}) };
  }
  function readMember(obj, fileName) {
    if (!obj || obj.kind !== FILE_KIND) throw new Error((fileName || 'That file') + ' is not a Marvel Multiverse character file.');
    const r = obj.profile ? D.record(obj.profile) : null;
    if (obj.profile && !r) throw new Error((fileName || 'That file') + ' names a profile the books don’t have.');
    if (!obj.profile && !(obj.character && typeof obj.character === 'object')) throw new Error((fileName || 'That file') + ' holds no character.');
    const character = obj.profile ? null : obj.character;
    return { id: State.genId('pc'), templateId: obj.profile || 'created', name: String(obj.name || (r && r.name) || (character && character.Name) || 'Hero'), player: String(obj.player || ''), profile: obj.profile || null, character, source: { kind: 'file', name: fileName || null }, live: Object.assign({}, obj.live || {}), notes: '' };
  }
  function downloadMember(m) {
    const blob = new Blob([JSON.stringify(fileOf(m), null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: (m.name || 'hero').replace(/[^\w-]+/g, '-').toLowerCase() + '.json' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // one line about a hero: rank and real name, then the live numbers
  function sentence(m) {
    const v = values(m);
    const bits = [];
    if (v.Rank) bits.push('Rank ' + v.Rank);
    if (v['Real Name']) bits.push(v['Real Name']);
    TRACKS.forEach((t) => { const c = current(m, t); if (c != null) bits.push(t.label + ' ' + c + (maxOf(m, t) != null ? '/' + maxOf(m, t) : '')); });
    if (m.player) bits.push('played by ' + m.player);
    return bits.join(' · ') || 'a hero';
  }

  function setTrack(m, t, n, cause) {
    const was = current(m, t);
    if (was === n) return;
    State.commit('setPartyLive', [m.id, { [t.key]: n }]);
    State.commit('appendLog', [{ at: Date.now(), kind: 'event', memberId: m.id, text: m.name + ': ' + t.label + ' ' + (was == null ? '—' : was) + ' → ' + n + (cause ? ' (' + cause + ')' : '') }]);
  }

  // ── damage, from the check's own Marvel die ────────────────────────
  // "The base amount of damage a character does with an attack is their rank times the result of the
  // Marvel die on their attack check. … when figuring out the damage done, you also add the ability
  // score used in the attack." (Damages) The Damage line prints that multiplier. An M counts as 6
  // ("Count the Marvel die as a 6", Roll d616); "The default effect of a Fantastic success that
  // happens during any attack is that the attack does double the normal damage" (Fantastic Success).
  function damageOf(r, line) {
    const mult = printedInt(line.Multiplier);
    const score = printedInt(line['Ability Score']) || 0;
    if (mult == null || !r) return null;
    const die = Dice.counts(Dice.MARVEL, r.faces[Dice.MARVEL]);
    const base = die * mult + score;
    const doubled = r.fantastic && r.success === true;
    return { die, mult, score, total: doubled ? base * 2 : base, doubled };
  }

  // ── rendering a declared value ─────────────────────────────────────
  const target = (name, bookId) => (name ? D.named(name, bookId) || D.recordNamed(name)[0] || null : null);
  const opener = (t, label) => el('a', { class: 'ref', href: '#', onclick: (ev) => { ev.preventDefault(); if (window.MMOpenEntity) window.MMOpenEntity(t.id); } }, [label]);
  // rows as the book prints them: the printed strings in a line when every row has one (each linked
  // to the entry its Name names), else a table
  function rowsView(rows, bookId) {
    if (!rows.length) return el('span', { class: 'muted' }, ['—']);
    if (rows.every((r) => typeof r.Printed === 'string')) return el('div', { class: 'printed-line' }, rows.map((r, i) => { const t = target(r.Name, bookId); return [i ? ', ' : null, t ? opener(t, r.Printed) : r.Printed]; }));
    const cols = [];
    rows.forEach((r) => Object.keys(r).forEach((k) => cols.indexOf(k) === -1 && cols.push(k)));
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'printed rows' }, [
      el('thead', {}, [el('tr', {}, cols.map((c) => el('th', {}, [c])))]),
      el('tbody', {}, rows.map((r) => el('tr', {}, cols.map((c) => el('td', {}, [Array.isArray(r[c]) ? rowsView(r[c], bookId) : r[c] == null ? '' : String(r[c])]))))),
    ])]);
  }
  function valueView(v, bookId) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return el('span', { class: 'muted' }, ['—']);
    if (Array.isArray(v)) return typeof v[0] === 'object' ? rowsView(v, bookId) : el('span', {}, [v.join(', ')]);
    const s = String(v);
    return s.length > 90 ? E.prose(s, 'prose', bookId) : el('span', {}, [s]);
  }

  // ── the live sheet ─────────────────────────────────────────────────
  const rollers = {};
  const karmaUsed = new WeakSet();
  // the fields the sheet lays out itself; every other declared field shows in declared order
  const HEAD = ['Name', 'Rank', 'Karma', 'Health', 'Health Damage Reduction', 'Focus', 'Focus Damage Reduction', 'Initiative Modifier', 'Size', 'Speeds'];
  const OWN = HEAD.concat(['Abilities', 'Damage', 'Traits', 'Tags', 'Powers']);
  const LABEL = { 'Health Damage Reduction': 'Health DR', 'Focus Damage Reduction': 'Focus DR', 'Initiative Modifier': 'Initiative' };

  function live(m, opts) {
    const o = opts || {};
    const v = values(m);
    const decl = D.declared(typeOf(m)).props;
    const bookId = (profileRecord(m) || {}).book || 'core';
    const box = el('div', { class: 'sheet live' });
    box.appendChild(el('div', { class: 'sheet-head' }, [
      el('h2', {}, [m.name]),
      el('div', { class: 'muted small' }, [sentence(m)]),
    ]));

    // the head: the trackers over the sheet's own numbers, then the rest of the head's fields
    box.appendChild(el('div', { class: 'trackers' }, TRACKS.map((t) => {
      const cur = current(m, t);
      const max = maxOf(m, t);
      if (cur == null && max == null && m.profile) return null;   // the profile prints no number here ("—")
      const input = el('input', { type: 'number', class: 'num-in', value: cur == null ? '' : cur, 'aria-label': t.label });
      input.addEventListener('change', () => { const n = Number(input.value); if (Number.isFinite(n)) setTrack(m, t, n, 'set'); });
      return el('div', { class: 'tracker' }, [
        el('div', { class: 'stat-k' }, [t.label]),
        el('div', { class: 'tracker-row' }, [
          button('−', () => setTrack(m, t, (cur || 0) - 1), 'ghost tiny'),
          input,
          max != null ? el('span', { class: 'muted' }, ['/ ' + max]) : null,
          button('+', () => setTrack(m, t, (cur || 0) + 1), 'ghost tiny'),
        ]),
      ]);
    })));
    const heads = decl.filter((p) => HEAD.indexOf(p.name) !== -1 && ['Name', 'Health', 'Focus', 'Karma'].indexOf(p.name) === -1 && v[p.name] != null);
    if (heads.length) box.appendChild(el('div', { class: 'stats' }, heads.map((p) => el('div', { class: 'stat' }, [
      el('div', { class: 'stat-k', title: p.name }, [LABEL[p.name] || p.name]),
      el('div', { class: 'stat-v' + (p.name === 'Speeds' ? ' small' : '') }, [p.name === 'Speeds' ? (v.Speeds || []).map((s) => s.Mode + ' ' + s.Speed).join(' · ') : String(v[p.name])]),
    ]))));

    // the d616, preset by the check buttons below; one roller per hero, kept across redraws (a roll
    // commits to the log, the log redraws the sheet, and a new roller would lose the roll on screen)
    const roller = rollers[m.id] || (rollers[m.id] = Dice.roller({
      who: m.name,
      onResolve: (r) => State.commit('appendLog', [Object.assign(Dice.logEntry(r, m.name), { kind: 'roll', memberId: m.id })]),
      extra: (r, rb) => afterCheck(m.id, r, rb),
    }));

    // the abilities: a check button per score, the defense, and the damage line of an attack ability
    const lines = v.Abilities || [];
    const dmg = v.Damage || [];
    if (lines.length) {
      box.appendChild(el('div', { class: 'prop-k' }, ['Abilities', el('span', { class: 'muted' }, [' · a button sets up the check'])]));
      box.appendChild(el('div', { class: 'check-grid' }, lines.map((l) => {
        const score = printedInt(l['Ability Score']);
        const nc = printedInt(l['Non-Combat Checks']);
        const dl = dmg.find((d) => d.Ability === l.Ability);
        return el('div', { class: 'check-row' }, [
          el('span', { class: 'check-name' }, [l.Ability]),
          score != null ? button(l.Ability + ' ' + l['Ability Score'], () => roller.preset({ ability: score, label: m.name + ' · ' + l.Ability, meta: { damage: dl || null } }), 'tiny') : null,
          nc != null ? button('non-combat ' + l['Non-Combat Checks'], () => roller.preset({ ability: nc, label: m.name + ' · ' + l.Ability + ' (non-combat)' }), 'ghost tiny') : null,
          el('span', { class: 'muted small' }, ['defense ' + (l['Defense Score'] || '—') + (dl ? ' · damage dMarvel × ' + dl.Multiplier + (printedInt(dl['Ability Score']) ? ' + ' + dl['Ability Score'] : '') : '')]),
        ]);
      })));
    }
    box.appendChild(roller);

    // traits, tags and powers, as printed and linked
    ['Traits', 'Tags'].forEach((k) => { if (decl.some((p) => p.name === k)) box.appendChild(el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [k]), el('div', { class: 'prop-v' }, [rowsView(v[k] || [], bookId)])])); });
    if (decl.some((p) => p.name === 'Powers')) {
      box.appendChild(el('div', { class: 'prop-k' }, ['Powers']));
      box.appendChild((v.Powers || []).length ? el('div', { class: 'power-sets' }, (v.Powers || []).map((g) => { const t = target(g.Set, bookId); return el('div', { class: 'power-set' }, [el('b', {}, [t ? opener(t, g.Set) : g.Set]), ': ', rowsView(g.Powers || [], bookId)]); })) : el('div', { class: 'muted' }, ['—']));
    }
    // every other declared field, in declared order
    const rest = decl.filter((p) => OWN.indexOf(p.name) === -1);
    if (rest.length) box.appendChild(el('div', { class: 'fields' }, rest.map((p) => el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [p.name]), el('div', { class: 'prop-v' }, [valueView(v[p.name], bookId)])]))));
    if (profileOf(m)) box.appendChild(el('details', { class: 'profile-print' }, [el('summary', {}, ['The profile, as printed']), E.render(profileOf(m), { bare: true })]));
    if (o.player) {
      const notes = el('textarea', { class: 'text', rows: 4, placeholder: 'Your notes' }, [m.playerNotes || '']);
      notes.addEventListener('change', () => State.commit('setPartyPlayerNotes', [m.id, notes.value]));
      box.appendChild(el('div', { class: 'prop-k' }, ['Notes']));
      box.appendChild(notes);
    }
    return box;
  }

  // under a finished check: the damage it does if it hits (an attack ability's), and Karma for an
  // edge — "After a character makes an action check, they can spend a point of Karma to gain an edge
  // on the check. … A character cannot spend more than 1 point of Karma on any given action check."
  // (Karma). The hero is read afresh: the roller outlives redraws.
  function afterCheck(memberId, r, rb) {
    const m = (State.state.party || []).find((x) => x.id === memberId);
    if (!m) return null;
    const wrap = el('div', { class: 'after-check' });
    const line = (rb.meta || {}).damage;
    const d = line ? damageOf(r, line) : null;
    if (d) wrap.appendChild(el('div', { class: 'damage' }, [el('span', { class: 'prop-k' }, ['If it hits · damage ']), el('b', {}, [String(d.total)]), el('span', { class: 'muted small' }, [' = ' + Dice.shown(Dice.MARVEL, r.faces[Dice.MARVEL]) + ' (' + d.die + ') × ' + d.mult + (d.score ? ' + ' + d.score : '') + (d.doubled ? ', doubled — a Fantastic success' : '')])]));
    const karma = current(m, TRACKS[2]);
    const check = rb.check && rb.check();
    if (karma > 0 && !r.ultimate && check && !karmaUsed.has(check)) {
      wrap.appendChild(button('Spend 1 Karma for an edge', () => {
        karmaUsed.add(check);
        setTrack(m, TRACKS[2], karma - 1, 'an edge on ' + (r.label || 'a check'));
        rb.grantEdge();
      }, 'ghost tiny'));
    }
    return wrap.childNodes.length ? wrap : null;
  }

  return { FILE_KIND, TRACKS, printedInt, values, entityValues, typeOf, current, profileOf, booksFor, maxOf, fromProfile, fromValues, newMember, fileOf, readMember, downloadMember, sentence, setTrack, damageOf, live };
})();
