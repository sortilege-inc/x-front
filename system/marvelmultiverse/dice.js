// system/marvelmultiverse/dice.js — the d616 action check, as Core Mechanics states it.
//
// Every rule below is a named constant or a step citing the sentence it comes from (the corpus's
// *Core Mechanics* chapter, marvelmultiverse-0.5-core-core-mechanics.ttrpg); the Target Number
// helpers read the chapter's two tables from the data, never a typed copy. The rules (`core`)
// are pure and take their dice from an injected roll, so build/check_dice.js replays the book's
// own worked examples under node; the roller (`roller`) is the page's control over them.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MMDice = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // "roll your three six-sided dice and add up the numbers" (Roll d616)
  const DICE = 3;
  const SIDES = 6;
  // "we always list the Marvel die as the middle die" (Roll d616)
  const MARVEL = 1;
  // "If your Marvel die comes up with a Marvel logo, that's a Fantastic result. Count the Marvel
  // die as a 6 instead of a 1" (Roll d616) — the logo is the face that would count as 1
  const LOGO_FACE = 1;
  const LOGO_COUNTS = 6;
  // "a d616 roll of 6 M 6. This is equal to a result of 18, plus it's a Fantastic success"
  // (The Ultimate Fantastic Roll)
  const ULTIMATE = [6, LOGO_FACE, 6];

  // ── the rules, pure ────────────────────────────────────────────────
  const isLogo = (i, face) => i === MARVEL && face === LOGO_FACE;
  const counts = (i, face) => (isLogo(i, face) ? LOGO_COUNTS : face);
  // how good a die is: its count, and "An M is always considered to be the best die number" (Trouble)
  const worth = (i, face) => counts(i, face) + (isLogo(i, face) ? 0.5 : 0);
  const shown = (i, face) => (isLogo(i, face) ? 'M' : String(face));
  const sum = (faces) => faces.reduce((a, f, i) => a + counts(i, f), 0);
  const isUltimate = (faces) => faces.every((f, i) => f === ULTIMATE[i]);
  const listed = (faces) => faces.map((f, i) => shown(i, f)).join(' ');

  // "It's possible to have both edges and troubles at the same time. These things cancel each
  // other out in equal measure, so you only need to deal with what's left." (Mixing Things Up)
  const net = (edges, troubles) => (edges || 0) - (troubles || 0);

  // A check in progress: { faces, ability, tn, edges (left to use), log: [ … ] }.
  function start(opts, rollDie) {
    const faces = [];
    for (let i = 0; i < DICE; i++) faces.push(rollDie());
    const n = net(opts.edges, opts.troubles);
    const c = { faces, ability: Number(opts.ability) || 0, tn: opts.tn == null || opts.tn === '' ? null : Number(opts.tn), edges: Math.max(0, n), troubles: Math.max(0, -n), log: [{ kind: 'roll', faces: faces.slice() }] };
    // "if the action check comes up 6 M 6, that's an ultimate Fantastic success, and it
    // automatically succeeds. Ignore any trouble at that point." (Trouble)
    if (isUltimate(faces)) {
      if (c.troubles) c.log.push({ kind: 'ignored', troubles: c.troubles });
      c.troubles = 0;
    }
    // "their player must reroll the best of their dice numbers in that roll, and they must use
    // the worse of the two numbers" (Trouble); stacked: "You always reroll the best die."
    // (Stacking Trouble). Of two equal best, the first listed is rerolled.
    for (; c.troubles > 0; c.troubles--) {
      let best = 0;
      c.faces.forEach((f, i) => { if (worth(i, f) > worth(best, c.faces[best])) best = i; });
      trade(c, best, rollDie(), 'trouble');
    }
    return c;
  }
  // "you can reroll a single die of your d616 roll for that action check and use the better of
  // the two numbers" (Edge); stacked: "you can reroll the same die repeatedly or reroll different
  // dice, choosing as you go" (Stacking Edges). The player picks the die.
  function edge(c, i, rollDie) {
    if (!c.edges) return c;
    c.edges--;
    trade(c, i, rollDie(), 'edge');
    return c;
  }
  function trade(c, i, face, kind) {
    const was = c.faces[i];
    const better = worth(i, face) > worth(i, was);
    const keep = kind === 'edge' ? (better ? face : was) : (better ? was : face);
    c.faces[i] = keep;
    c.log.push({ kind, die: i, was, rolled: face, kept: keep });
  }
  // "You don't have to use an edge. It's always your choice." (Stacking Edges)
  const stop = (c) => { c.edges = 0; return c; };

  // "Add the character's ability score" (Apply Ability Score); "If the result of the action
  // check's d616 roll meets or beats the target number, then the action succeeds" (Compare the
  // Total to the Target Number); the Fantastic results (Fantastic Rolls).
  function result(c) {
    const dice = sum(c.faces);
    const total = dice + c.ability;
    const fantastic = isLogo(MARVEL, c.faces[MARVEL]);
    const ultimate = isUltimate(c.faces);
    const success = ultimate ? true : c.tn == null ? null : total >= c.tn;
    let outcome = null;
    if (ultimate) outcome = 'The Ultimate Fantastic Roll';
    else if (success === true) outcome = fantastic ? 'Fantastic Success' : 'Success';
    else if (success === false) outcome = fantastic ? 'Fantastic Failure' : 'Failure';
    else if (fantastic) outcome = 'Fantastic roll';
    return { faces: c.faces.slice(), listed: listed(c.faces), dice, ability: c.ability, total, tn: c.tn, success, fantastic, ultimate, outcome, done: !c.edges };
  }

  // ── Target Numbers, from the chapter's own tables ──────────────────
  // "The Challenging TN by Rank table shows the target number for what would be considered a
  // Challenging action at each rank" (Setting Target Numbers); "The Narrator can modify a target
  // number by assigning it a different adjective than Challenging" (Adjusting the Target Number)
  const printedNumber = (s) => {
    const t = String(s).replace(/[–−]/g, '-').trim();
    return /^[+-]?\d+$/.test(t) ? Number(t) : t === '—' ? 0 : null;
  };
  function tnTables(D) {
    const t = (name) => { const e = D.named(name, 'core'); return e && e.table ? e.table : null; };
    const rank = t('Challenging TN by Rank Table');
    const adj = t('TN Modifiers by Adjectives Table');
    return {
      ranks: rank ? rank.rows.map((r) => ({ rank: String(r[0]), tn: printedNumber(r[1]) })) : [],
      adjectives: adj ? adj.rows.map((r) => ({ name: String(r[0]), printed: String(r[1]), mod: printedNumber(r[1]) })) : [],
    };
  }

  const core = { DICE, SIDES, MARVEL, LOGO_FACE, LOGO_COUNTS, ULTIMATE, isLogo, counts, worth, shown, sum, listed, isUltimate, net, start, edge, stop, result, printedNumber, tnTables };

  // ── the roller (the page) ──────────────────────────────────────────
  function rollDie() {
    const a = new Uint32Array(1);
    // an unbiased d6 from the page's cryptographic source
    for (;;) {
      crypto.getRandomValues(a);
      if (a[0] < 4294967292) return (a[0] % SIDES) + 1;
    }
  }

  function roller(opts) {
    const o = opts || {};
    const { el } = window.VttRender;
    const D = window.MMData;
    const T = tnTables(D);
    const box = el('div', { class: 'roller d616' });
    const ability = el('input', { type: 'number', class: 'num-in', value: o.ability != null ? o.ability : 0, step: 1, 'aria-label': 'Ability score' });
    const tn = el('input', { type: 'number', class: 'num-in', value: o.tn != null ? o.tn : '', min: 0, step: 1, placeholder: '—', 'aria-label': 'Target number' });
    const rank = el('select', { class: 'scope', 'aria-label': 'Challenging TN by rank' }, [el('option', { value: '' }, ['by rank…'])].concat(T.ranks.map((r) => el('option', { value: r.rank }, ['Rank ' + r.rank + ' — ' + r.tn]))));
    const adj = el('select', { class: 'scope', 'aria-label': 'Adjective' }, T.adjectives.map((a) => el('option', { value: a.name, selected: a.mod === 0 || null }, [a.name + (a.mod ? ' (' + a.printed + ')' : '')])));
    const setTn = () => {
      const r = T.ranks.find((x) => x.rank === rank.value);
      const a = T.adjectives.find((x) => x.name === adj.value);
      if (r) tn.value = r.tn + (a ? a.mod || 0 : 0);
    };
    rank.addEventListener('change', setTn);
    adj.addEventListener('change', setTn);
    const edges = el('input', { type: 'number', class: 'num-in', value: 0, min: 0, step: 1, 'aria-label': 'Edges' });
    const troubles = el('input', { type: 'number', class: 'num-in', value: 0, min: 0, step: 1, 'aria-label': 'Troubles' });
    const field = (label, input) => el('label', { class: 'field' }, [el('span', { class: 'field-k' }, [label]), input]);
    const out = el('div', { class: 'roll-out' });
    let cur = null;

    function die(i, face, pick) {
      const logo = isLogo(i, face);
      return el(pick ? 'button' : 'div', { class: 'die' + (i === MARVEL ? ' marvel' : '') + (logo ? ' logo' : '') + (pick ? ' pick' : ''), type: pick ? 'button' : null, title: (i === MARVEL ? 'Marvel die' : 'd6') + (pick ? ' — reroll it (edge)' : ''), onclick: pick ? () => { edge(cur, i, rollDie); draw(); } : null }, [shown(i, face)]);
    }
    function logText(x) {
      if (x.kind === 'roll') return 'Rolled ' + listed(x.faces);
      if (x.kind === 'ignored') return '6 M 6 — trouble ignored';
      const name = x.die === MARVEL ? 'the Marvel die (' + shown(x.die, x.was) + ')' : 'the ' + shown(x.die, x.was);
      return (x.kind === 'edge' ? 'Edge' : 'Trouble') + ': rerolled ' + name + ' → ' + shown(x.die, x.rolled) + ', kept ' + shown(x.die, x.kept);
    }
    function draw() {
      out.innerHTML = '';
      if (!cur) return;
      const r = result(cur);
      out.appendChild(el('div', { class: 'dice-row' }, cur.faces.map((f, i) => die(i, f, cur.edges > 0))));
      out.appendChild(el('ul', { class: 'roll-steps muted small' }, cur.log.map((x) => el('li', {}, [logText(x)]))));
      const sumLine = r.listed + ' = ' + r.dice + (r.ability ? (r.ability > 0 ? ' + ' : ' − ') + Math.abs(r.ability) : '') + ' → ' + r.total + (r.tn != null ? ' vs TN ' + r.tn : '');
      out.appendChild(el('div', { class: 'roll-total' }, [el('span', { class: 'big' }, [String(r.total)]), ' ', el('span', { class: 'muted' }, [sumLine])]));
      if (r.outcome) {
        const o2 = D.named(r.outcome, 'core');
        out.appendChild(el('div', { class: 'outcome ' + (r.success === false ? 'fail' : r.success ? 'ok' : '') + (r.fantastic ? ' fantastic' : '') }, [
          o2 ? el('a', { class: 'ref', href: '#', onclick: (ev) => { ev.preventDefault(); window.MMOpenEntity && window.MMOpenEntity(o2.id); } }, [r.outcome]) : r.outcome,
        ]));
      }
      if (cur.edges > 0) {
        out.appendChild(el('div', { class: 'chiprow' }, [
          el('span', { class: 'muted small' }, [cur.edges + ' edge' + (cur.edges === 1 ? '' : 's') + ' left — click a die to reroll it']),
          el('button', { class: 'btn ghost', type: 'button', onclick: () => { stop(cur); draw(); } }, ['Keep this roll']),
        ]));
      } else if (!cur.reported) {
        cur.reported = true;
        if (o.onResolve) o.onResolve(r);
      }
    }
    const go = () => {
      cur = start({ ability: ability.value, tn: tn.value, edges: Number(edges.value) || 0, troubles: Number(troubles.value) || 0 }, rollDie);
      draw();
    };
    box.appendChild(el('div', { class: 'roller-controls' }, [
      field('Ability score', ability),
      field('Target number', el('span', { class: 'tn-pick' }, [tn, rank, adj])),
      field('Edges', edges),
      field('Troubles', troubles),
      el('button', { class: 'btn primary', type: 'button', onclick: go }, ['Roll d616']),
    ]));
    box.appendChild(out);
    return box;
  }

  function logEntry(r, who) {
    return { who, at: Date.now(), listed: r.listed, total: r.total, tn: r.tn, outcome: r.outcome, fantastic: r.fantastic };
  }
  function logLine(x) {
    const { el } = window.VttRender;
    return el('div', { class: 'log-line' + (x.fantastic ? ' fantastic' : '') }, [
      el('b', {}, [x.who || '']), ' ', x.listed, ' → ', el('b', {}, [String(x.total)]), x.tn != null ? ' vs ' + x.tn : '', x.outcome ? ' · ' + x.outcome : '',
    ]);
  }

  return Object.assign({ core, roller, rollDie, logEntry, logLine }, core);
});
