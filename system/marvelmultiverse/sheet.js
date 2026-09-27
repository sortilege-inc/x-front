// system/marvelmultiverse/sheet.js — a hero at the table, M3's first live sheet (the sheet
// derived from ACTOR "Character" and the creator are M4).
//
// A hero is a character profile of the books taken to the table (the pregenerated way to play,
// "Character Profiles"), or a blank one the Narrator names; the profile is read from the corpus
// at runtime, never copied into the pack. What the table tracks is the hero's live state:
//
//   live { health, focus, karma }   current values; each starts at the profile's printed number
//
// Every number shown beside a tracker or on a check button is the profile's own printed string
// (Health "90", an Ability Line's Ability Score "3" and Non-Combat Checks "+4"); nothing is
// derived here. "A character's ability score is added to any action check made using that
// ability" (Character Profiles) — the check button presets the d616 roller with it.
//
// A character file: { kind: 'marvelmultiverse-character', version: 1, name, player, profile, live }.
window.MMSheet = (function () {
  const { el, button } = window.VttRender;
  const D = window.MMData;
  const E = window.MMEntity;
  const Dice = window.MMDice;
  const State = window.VttState;
  const S = () => State.state;

  const FILE_KIND = 'marvelmultiverse-character';
  const TRACKS = [
    { key: 'health', label: 'Health', field: 'Health' },
    { key: 'focus', label: 'Focus', field: 'Focus' },
    { key: 'karma', label: 'Karma', field: 'Karma' },
  ];
  // a printed number ("90", "+4", "−1"); anything else ("—", "5/6") is not one
  const printedInt = (s) => {
    const t = String(s == null ? '' : s).replace(/[–−]/g, '-').trim();
    return /^[+-]?\d+$/.test(t) ? Number(t) : null;
  };

  const profileOf = (m) => (m && m.profile ? D.entity(m.profile) : null);
  const profileRecord = (m) => (m && m.profile ? D.record(m.profile) : null);
  const booksFor = (m) => { const r = profileRecord(m); return r ? [r.book] : []; };
  // the printed top of a tracker, from the profile's record (always in memory — its book need not be)
  const maxOf = (m, t) => { const r = profileRecord(m); return r ? printedInt((r.fields || {})[t.field]) : null; };

  // a tracker as it stands: its live value, else the printed top it starts at
  const current = (m, t) => { const v = (m.live || {})[t.key]; return v != null ? v : maxOf(m, t); };

  function startLive(r) {
    const live = {};
    TRACKS.forEach((t) => { const n = r ? printedInt((r.fields || {})[t.field]) : null; if (n != null) live[t.key] = n; });
    return live;
  }
  function fromProfile(id, player) {
    const r = D.record(id);
    if (!r) throw new Error('No such profile: ' + id);
    return { id: State.genId('pc'), templateId: id, name: r.name, player: player || '', profile: id, source: { kind: 'profile', id, book: r.book }, live: startLive(r), notes: '' };
  }
  function newMember(name, player) {
    const n = String(name || '').trim();
    if (!n) throw new Error('Name the hero first.');
    return { id: State.genId('pc'), templateId: 'blank', name: n, player: String(player || '').trim(), profile: null, source: { kind: 'blank' }, live: {}, notes: '' };
  }
  function fileOf(m) {
    return { kind: FILE_KIND, version: 1, name: m.name, player: m.player || '', profile: m.profile || null, live: Object.assign({}, m.live || {}) };
  }
  function readMember(obj, fileName) {
    if (!obj || obj.kind !== FILE_KIND) throw new Error((fileName || 'That file') + ' is not a Marvel Multiverse character file.');
    const r = obj.profile ? D.record(obj.profile) : null;
    if (obj.profile && !r) throw new Error((fileName || 'That file') + ' names a profile the books don’t have.');
    return { id: State.genId('pc'), templateId: obj.profile || 'blank', name: String(obj.name || (r && r.name) || 'Hero'), player: String(obj.player || ''), profile: obj.profile || null, source: { kind: 'file', name: fileName || null }, live: Object.assign({}, obj.live || {}), notes: '' };
  }
  function downloadMember(m) {
    const blob = new Blob([JSON.stringify(fileOf(m), null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: (m.name || 'hero').replace(/[^\w-]+/g, '-').toLowerCase() + '.json' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // one line about a hero: the profile's rank and real name, then the live numbers
  function sentence(m) {
    const r = profileRecord(m);
    const f = (r && r.fields) || {};
    const bits = [];
    if (f.Rank) bits.push('Rank ' + f.Rank);
    if (f['Real Name']) bits.push(f['Real Name']);
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

  // ── the live sheet ─────────────────────────────────────────────────
  const rollers = {};
  function live(m, opts) {
    const o = opts || {};
    const e = profileOf(m);
    const box = el('div', { class: 'sheet live' });
    box.appendChild(el('div', { class: 'sheet-head' }, [
      el('h2', {}, [m.name]),
      el('div', { class: 'muted small' }, [sentence(m)]),
    ]));

    // the trackers: the profile's printed number is the top; a blank hero's is open
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

    // the d616, preset by the check buttons below. One roller per hero, kept across redraws: a roll
    // commits to the log, the log redraws the sheet, and a new roller would lose the roll on screen
    // (VtM5e's lesson, its sheet's rollers)
    const roller = rollers[m.id] || (rollers[m.id] = Dice.roller({
      who: m.name,
      onResolve: (r) => State.commit('appendLog', [Object.assign(Dice.logEntry(r, m.name), { kind: 'roll', memberId: m.id })]),
    }));
    if (e) {
      const lines = D.rows(e, 'Abilities');
      if (lines.length) {
        box.appendChild(el('div', { class: 'prop-k' }, ['Checks', el('span', { class: 'muted' }, [' · as the profile prints them'])]));
        box.appendChild(el('div', { class: 'check-grid' }, lines.map((l) => {
          const score = printedInt(l['Ability Score']);
          const nc = printedInt(l['Non-Combat Checks']);
          return el('div', { class: 'check-row' }, [
            el('span', { class: 'check-name' }, [l.Ability]),
            score != null ? button(l.Ability + ' ' + l['Ability Score'], () => roller.preset({ ability: score, label: m.name + ' · ' + l.Ability }), 'tiny') : null,
            nc != null ? button('non-combat ' + l['Non-Combat Checks'], () => roller.preset({ ability: nc, label: m.name + ' · ' + l.Ability + ' (non-combat)' }), 'ghost tiny') : null,
            el('span', { class: 'muted small' }, ['defense ' + (l['Defense Score'] || '—')]),
          ]);
        })));
      }
    }
    box.appendChild(roller);
    if (e) box.appendChild(el('details', { class: 'profile-print' }, [el('summary', {}, ['The profile, as printed']), E.render(e, { bare: true })]));
    else box.appendChild(el('p', { class: 'muted small' }, ['A blank hero: no profile behind them yet. The character creator arrives with the full sheet (M4).']));
    if (o.player) {
      const notes = el('textarea', { class: 'text', rows: 4, placeholder: 'Your notes' }, [m.playerNotes || '']);
      notes.addEventListener('change', () => State.commit('setPartyPlayerNotes', [m.id, notes.value]));
      box.appendChild(el('div', { class: 'prop-k' }, ['Notes']));
      box.appendChild(notes);
    }
    return box;
  }

  return { FILE_KIND, TRACKS, printedInt, current, profileOf, booksFor, maxOf, fromProfile, newMember, fileOf, readMember, downloadMember, sentence, setTrack, live };
})();
