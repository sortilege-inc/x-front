// system/marvelmultiverse/chargen.js — making a character, as *Creating a Character* states it:
// the rules only (no page), so build/check_chargen.js runs them under node against the book's own
// example (Young Lion) and against every printed profile.
//
// "1. Determine rank. 2. Pick ability scores. 3. Pick backstory elements. 4. Pick powers.
//  5. Calculate other scores." (Building a Character)
//
// Every number is read from the corpus: the per-rank numbers from its two tables (Ability Score
// Points, Resources by Rank), each rule the prose states only in words a named constant citing its
// sentence, and each power's effect on damage and on checks read from that power's own Effect.
// What comes out is a character's values in the shape ACTOR "Character" declares — the same shape
// a printed profile has — so one sheet (system/marvelmultiverse/sheet.js) shows both.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MMChargen = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // "Remember, their first initials spell MARVEL: Melee, Agility, Resilience, Vigilance, Ego…" (Ability Scores)
  const ABILITIES = ['Melee', 'Agility', 'Resilience', 'Vigilance', 'Ego', 'Logic'];
  // "Melee, Agility, Ego and Logic can be used for attacks." (Damages)
  const ATTACK_ABILITIES = ['Melee', 'Agility', 'Ego', 'Logic'];
  // "You cannot voluntarily lower any score below –3." (Selecting Ability Scores)
  const ABILITY_FLOOR = -3;
  // "To figure a character's defense for each ability, just add 10 to the ability score." (Ability Defense)
  const DEFENSE_BASE = 10;
  // "A character's Health is equal to 30 times their Resilience." (Health)
  const HEALTH_PER_RESILIENCE = 30;
  // "A character's Focus is equal to 30 times their Vigilance." (Focus)
  const FOCUS_PER_VIGILANCE = 30;
  // "An average-sized character's base Run Speed is 5 spaces per round. To that, add +1 for every 5
  // points they have in Agility. On top of that, if they have the Big trait, they add +1, and if they
  // have the Small trait, they take –1." (Speed)
  const RUN_BASE = 5;
  const RUN_AGILITY_STEP = 5;
  const RUN_TRAITS = { Big: 1, Small: -1 };
  // "A character's base Climb Speed, Jump Speed and Swim Speed are half their Run Speed." (Speed,
  // Character Profiles) — the book's example rounds 5 up to 3 ("half that, or 3 spaces each")
  const HALF_SPEED_MODES = ['Climb', 'Jump', 'Swim'];
  // A power's own words for a bonus: "They also add +1 to their Melee damage multiplier, and they gain
  // a +1 bonus to Melee checks other than attacks." (Mighty 1; Accuracy, Brilliance, Discipline alike)
  const DAMAGE_BONUS = /\badds? \+(\d+) to their (Melee|Agility|Resilience|Vigilance|Ego|Logic) damage multiplier/g;
  const CHECK_BONUS = /\+(\d+) bonus to (Melee|Agility|Resilience|Vigilance|Ego|Logic) checks other than attacks/g;

  const signed = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0');
  const num = (s) => { const t = String(s == null ? '' : s).replace(/[–−]/g, '-').trim(); return /^[+-]?\d+$/.test(t) ? Number(t) : null; };

  // ── the per-rank numbers, from the chapter's tables ────────────────
  // `table(name)` returns a corpus table ({columns, rows}) by its entity name.
  function tables(table) {
    const pts = table('Ability Score Points Table');
    const res = table('Resources by Rank Table');
    const out = {};
    const col = (t, name) => (t ? t.columns.indexOf(name) : -1);
    (pts ? pts.rows : []).forEach((r) => {
      const k = num(r[col(pts, 'Rank')]);
      out[k] = Object.assign(out[k] || {}, { points: num(r[col(pts, 'Ability Points')]), cap: num(r[col(pts, 'Default Ability Cap')]) });
    });
    (res ? res.rows : []).forEach((r) => {
      const k = num(r[col(res, 'Rank')]);
      // "Damage Multiplier, Karma & Traits": one number for all three at each rank
      out[k] = Object.assign(out[k] || {}, { powers: num(r[col(res, 'Powers')]), perRank: num(r[col(res, 'Damage Multiplier, Karma & Traits')]) });
    });
    return out;
  }
  const ranks = (T) => Object.keys(T).map(Number).filter((k) => Number.isFinite(k)).sort((a, b) => a - b);

  // ── what the chosen powers grant, from their Effect ────────────────
  // "Powers and other things that grant bonuses to damage multipliers do not stack." (Damages) — so
  // the largest per ability; checks are read the same way.
  function bonuses(effects) {
    const dmg = {};
    const chk = {};
    (effects || []).forEach((t) => {
      let m;
      DAMAGE_BONUS.lastIndex = 0;
      while ((m = DAMAGE_BONUS.exec(t || ''))) dmg[m[2]] = Math.max(dmg[m[2]] || 0, Number(m[1]));
      CHECK_BONUS.lastIndex = 0;
      while ((m = CHECK_BONUS.exec(t || ''))) chk[m[2]] = Math.max(chk[m[2]] || 0, Number(m[1]));
    });
    return { damage: dmg, checks: chk };
  }

  // A draft: { rank, abilities: {Melee: n, …}, origin: {name, traits, tags}, occupation: {…},
  //   traits: [extra trait names], tags: [extra tag names], powers: [{name, set, effect,
  //   prerequisites: [{power, rank, printed}]}], size, data: {Codename, Real Name, …} }.
  // Returns { values (ACTOR "Character" shape), budget, problems: [strings] }.
  function compute(draft, T) {
    const d = draft || {};
    const rank = d.rank;
    const R = T[rank] || {};
    const problems = [];
    const ab = {};
    ABILITIES.forEach((a) => (ab[a] = Number((d.abilities || {})[a]) || 0));

    // 2. ability scores: the points the rank gives, a cap, and the floor
    const spent = ABILITIES.reduce((s, a) => s + ab[a], 0);
    ABILITIES.forEach((a) => {
      if (R.cap != null && ab[a] > R.cap) problems.push(a + ' is ' + ab[a] + '; the cap at Rank ' + rank + ' is ' + R.cap + '.');
      if (ab[a] < ABILITY_FLOOR) problems.push(a + ' is ' + ab[a] + '; no score goes below ' + ABILITY_FLOOR + '.');
    });
    if (R.points != null && spent > R.points) problems.push(spent + ' ability points spent; Rank ' + rank + ' gives ' + R.points + '.');

    // 3. backstory: the origin's and occupation's labels, plus one extra trait per rank
    const granted = (k) => [].concat((d.origin || {})[k] || [], (d.occupation || {})[k] || []);
    const traits = uniq(granted('traits').concat(d.traits || []));
    const tags = uniq(granted('tags').concat(d.tags || []));
    const extra = (d.traits || []).filter((t) => granted('traits').indexOf(t) === -1).length;
    if (R.perRank != null && extra > R.perRank) problems.push(extra + ' extra traits; Rank ' + rank + ' gives ' + R.perRank + '.');

    // 4. powers: four per rank (the Resources by Rank table), each with its prerequisites met
    const powers = d.powers || [];
    if (R.powers != null && powers.length > R.powers) problems.push(powers.length + ' powers; Rank ' + rank + ' gives ' + R.powers + '.');
    const have = powers.map((p) => p.name);
    powers.forEach((p) => (p.prerequisites || []).forEach((q) => {
      if (q.rank != null && rank < q.rank) problems.push(p.name + ' needs Rank ' + q.rank + '.');
      if (q.power && have.indexOf(q.power) === -1) problems.push(p.name + ' needs ' + q.power + '.');
    }));
    const B = bonuses(powers.map((p) => p.effect));

    // 5. other scores
    const run = RUN_BASE + Math.floor(Math.max(0, ab.Agility) / RUN_AGILITY_STEP) + traits.reduce((s, t) => s + (RUN_TRAITS[t] || 0), 0);
    const half = Math.ceil(run / 2);
    const bySet = [];
    powers.forEach((p) => {
      const set = p.set || 'Basic';
      let g = bySet.find((x) => x.Set === set);
      if (!g) bySet.push((g = { Set: set, Powers: [] }));
      g.Powers.push({ Name: p.name, Printed: p.name });
    });
    const label = (n) => ({ Name: n, Printed: n });
    const data = d.data || {};
    const values = {
      Name: (data.Codename || data['Real Name'] || '').trim() || 'A new hero',
      Rank: String(rank),
      Karma: String(R.perRank),
      Health: String(HEALTH_PER_RESILIENCE * ab.Resilience),
      'Health Damage Reduction': '—',
      Focus: String(FOCUS_PER_VIGILANCE * ab.Vigilance),
      'Focus Damage Reduction': '—',
      'Initiative Modifier': signed(ab.Vigilance),
      Speeds: [{ Mode: 'Run', Speed: String(run) }].concat(HALF_SPEED_MODES.map((m) => ({ Mode: m, Speed: String(half) }))),
      Abilities: ABILITIES.map((a) => ({ Ability: a, 'Ability Score': String(ab[a]), 'Defense Score': String(DEFENSE_BASE + ab[a]), 'Non-Combat Checks': signed(ab[a] + (B.checks[a] || 0)) })),
      Damage: ATTACK_ABILITIES.map((a) => ({ Ability: a, Multiplier: String(R.perRank + (B.damage[a] || 0)), 'Ability Score': String(ab[a]) })),
      Traits: traits.map(label),
      Tags: tags.map(label),
      Powers: bySet,
    };
    ['Real Name', 'Height', 'Weight', 'Gender', 'Eyes', 'Hair', 'Distinguishing Features', 'Teams', 'Base', 'History', 'Personality'].forEach((k) => { if (data[k]) values[k] = data[k]; });
    values.Size = d.size || 'Average';
    if (d.origin && d.origin.name) values.Origin = d.origin.name;
    if (d.occupation && d.occupation.name) values.Occupation = d.occupation.name;
    return { values, problems, budget: { points: R.points, spent, cap: R.cap, powers: R.powers, powersPicked: powers.length, extraTraits: R.perRank, extraPicked: extra }, bonuses: B };
  }
  function uniq(xs) { const seen = {}; return xs.filter((x) => (x && !seen[x] ? (seen[x] = 1) : false)); }

  return { ABILITIES, ATTACK_ABILITIES, ABILITY_FLOOR, DEFENSE_BASE, HEALTH_PER_RESILIENCE, FOCUS_PER_VIGILANCE, RUN_BASE, RUN_AGILITY_STEP, RUN_TRAITS, HALF_SPEED_MODES, tables, ranks, bonuses, compute, signed, num };
});
