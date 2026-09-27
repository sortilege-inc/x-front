// build/check_chargen.js — the creator's rules (system/marvelmultiverse/chargen.js) against the book.
//
//  1. Young Lion, *Creating a Character*'s worked example: the example's own choices go in; what
//     comes out is compared with what the book prints for them — its Ability Scores Table, Young
//     Lion's Damages Table, and the Other Scores and Backstory paragraphs — read from data/, not
//     typed here.
//  2. Every printed profile: the damage multipliers and Non-Combat Checks the rules derive from the
//     profile's rank, ability scores and powers, against the numbers the profile prints. A profile
//     whose numbers the rules cannot explain is listed; the count may not grow (KNOWN_UNEXPLAINED).
//
//   node build/check_chargen.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const G = require('../system/marvelmultiverse/chargen.js');

const ROOT = path.join(__dirname, '..');
const win = {};
const ctx = vm.createContext({ window: win });
['data/index.js', 'data/records.js', 'data/core.js', 'data/x-men.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx));
const T = win.MARVELMULTIVERSE;
const E = Object.values(T.entities);
const named = (n, book) => E.find((e) => e.name === n && (!book || e.book === book));
const prop = (e, n) => (e.props || []).find((p) => p.name === n);
const val = (e, n) => { const p = prop(e, n); return p ? (p.value !== undefined ? p.value : (p.items || []).map((i) => i.s)) : undefined; };
const rowsOf = (e, n) => { const p = prop(e, n); return p && p.items ? p.items.map((it) => { const o = {}; (it.d || []).forEach((f) => (o[f.name] = f.items ? f.items.map((x) => { const r = {}; (x.d || []).forEach((g) => (r[g.name] = g.value)); return r; }) : f.value)); return o; }) : []; };
const TABLES = G.tables((n) => (named(n, 'core') || {}).table);

let fails = 0;
let n = 0;
function check(label, got, want) {
  n++;
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log('  FAIL ' + label + ': got ' + JSON.stringify(got) + ', the book ' + JSON.stringify(want)); }
}
const power = (name) => { const e = E.find((x) => x.type === 'Power' && x.name === name); if (!e) throw new Error('no power ' + name); return { name, set: (val(e, 'Power Sets') || [])[0] || 'Basic', effect: val(e, 'Effect') || '', prerequisites: rowsOf(e, 'Prerequisites').map((q) => ({ power: q.Power, rank: q.Rank, printed: q.Printed })) }; };
const backstory = (type, name) => { const e = E.find((x) => x.type === type && x.name === name); return { name, traits: val(e, 'Traits') || [], tags: val(e, 'Tags') || [] }; };

// ── 1. Young Lion ──────────────────────────────────────────────────
// The example's choices, each as its paragraph states it: "a Rank 1 character" (Rank); the scores
// of its Ability Scores Table; "we pick the Magic origin", "we pick Student", "we choose Berserker",
// "the tag Heroic", "the Secret Identity tag", "the Signature Weapon tag" (Backstory); "Vicious
// Attack and Hit & Run", "Healing Factor and Mighty 1" (Powers).
const abTable = named('Ability Scores Table', 'core').table;
const abilities = {};
abTable.rows.forEach((r) => (abilities[r[0]] = G.num(r[1])));
const yl = G.compute({
  rank: 1, abilities,
  // The example says "we pick the Magic origin. That gives them the tags Sorcerous and Supernatural",
  // but the origin the core prints as "Magic" gives Supernatural alone; the one that gives both is
  // "Magic: Sorcery" (the example's book "is arcane in nature"). The book disagrees with itself; the
  // origin whose printed tags match the sentence is the one taken (PLAN.md decision 30).
  origin: backstory('Origin', 'Magic: Sorcery'), occupation: backstory('Occupation', 'Student'),
  traits: ['Berserker'], tags: ['Heroic', 'Secret Identity', 'Signature Weapon'],
  powers: ['Vicious Attack', 'Hit & Run', 'Healing Factor', 'Mighty 1'].map(power),
  data: { Codename: 'Young Lion' },
}, TABLES);
check('Young Lion: no problems', yl.problems, []);
check('Young Lion: ability defenses (Ability Scores Table)', yl.values.Abilities.map((a) => [a.Ability, a['Ability Score'], a['Defense Score']]), abTable.rows);
const dmgTable = named('Young Lion’s Damages Table', 'core').table;
check('Young Lion: damages (Young Lion’s Damages Table)', yl.values.Damage.map((d) => [d.Ability, d['Ability Score'], '(dMarvel×' + d.Multiplier + ')' + (d['Ability Score'] !== '0' ? '+' + d['Ability Score'] : '')]), dmgTable.rows);
const other = named('Other Scores', 'core') && E.find((e) => e.name === 'Other Scores' && /Young Lion/.test(e.desc || ''));
const said = (re) => { const m = re.exec(other.desc); return m ? m[1] : null; };
check('Young Lion: Health', yl.values.Health, said(/multiply that by 30 to get (\d+) Health/));
check('Young Lion: Focus', yl.values.Focus, said(/multiply that by 30 to get (\d+) Focus/));
check('Young Lion: Initiative Modifier', yl.values['Initiative Modifier'], said(/Initiative Modifier is (\+\d+)/));
check('Young Lion: Karma', yl.values.Karma, said(/they have (\d+) Karma/));
check('Young Lion: Run Speed', yl.values.Speeds[0].Speed, said(/stays at (\d+) spaces/));
check('Young Lion: Climb, Jump and Swim', yl.values.Speeds.slice(1).map((s) => s.Speed), [1, 2, 3].map(() => said(/or (\d+) spaces each/)));
const bs = E.find((e) => e.name === 'Backstory' && /Young Lion/.test(e.desc || '')).desc;
const listIn = (re) => { const m = re.exec(bs); return m ? m[1].split(/, | and /).map((x) => x.trim()) : null; };
check('Young Lion: traits (Backstory)', yl.values.Traits.map((t) => t.Name).sort(), listIn(/two traits: ([^.]+)\./).sort());
check('Young Lion: tags (Backstory)', yl.values.Tags.map((t) => t.Name).sort(), listIn(/seven tags: ([^.]+)\./).sort());
check('Young Lion: four powers, the Rank 1 allowance', [yl.budget.powersPicked, yl.budget.powers], [4, 4]);

// the budget and prerequisites refuse what the book refuses
check('a fifth power at Rank 1 is refused', G.compute({ rank: 1, abilities, powers: ['Vicious Attack', 'Hit & Run', 'Healing Factor', 'Mighty 1', 'Accuracy 1'].map(power) }, TABLES).problems.some((p) => /5 powers/.test(p)), true);
check('a score over the cap is refused', G.compute({ rank: 1, abilities: { Melee: 5 } }, TABLES).problems.some((p) => /cap at Rank 1 is 4/.test(p)), true);
check('a score under −3 is refused', G.compute({ rank: 1, abilities: { Ego: -4, Melee: 4 } }, TABLES).problems.some((p) => /below -3/.test(p)), true);
const needs = E.find((e) => e.type === 'Power' && rowsOf(e, 'Prerequisites').some((q) => q.Power));
const needed = rowsOf(needs, 'Prerequisites').find((q) => q.Power).Power;
check('a power without its prerequisite is refused (' + needs.name + ' needs ' + needed + ')', G.compute({ rank: 6, abilities: {}, powers: [power(needs.name)] }, TABLES).problems.some((p) => p.indexOf('needs ' + needed) !== -1), true);

// "Powers and other things that grant bonuses to damage multipliers do not stack." (Damages) — no
// printed profile holds two to one ability, so the rule is checked on two powers' own Effects
check('bonuses do not stack (Mighty 1 with Mighty 3 → +3)', G.bonuses([power('Mighty 1').effect, power('Mighty 3').effect]).damage.Melee, 3);

// ── 2. every printed profile ───────────────────────────────────────
// A profile's damage multipliers and Non-Combat Checks, as the rules derive them from its rank,
// scores and powers. Rank must be one number ("5/6" prints two forms); a power the profile names
// that the books do not describe contributes nothing.
// the 12 profiles on 2026-09-27 (node build/check_chargen.js --list): weapons and gear the rules
// here do not read (both Wolverines' claws, Daredevil's billy clubs, the Thors' hammers, Captain
// America's shield…), Sentinel's size, Polaris one lower than her Brilliance gives
const KNOWN_UNEXPLAINED = 12;
const profiles = E.filter((e) => (e.type === 'Character' || e.type === 'X-Men Expansion Character') && e.file.endsWith('.actor'));
let tested = 0;
const unexplained = [];
profiles.forEach((e) => {
  const rank = G.num(val(e, 'Rank'));
  if (rank == null || !TABLES[rank]) return;
  const effects = [];
  rowsOf(e, 'Powers').forEach((g) => (g.Powers || []).forEach((p) => { const pe = E.find((x) => x.type === 'Power' && x.name === p.Name); if (pe) effects.push(val(pe, 'Effect') || ''); }));
  const B = G.bonuses(effects);
  const why = [];
  rowsOf(e, 'Damage').forEach((d) => { const want = G.num(d.Multiplier); const got = TABLES[rank].perRank + (B.damage[d.Ability] || 0); if (want != null && want !== got) why.push(d.Ability + ' damage ×' + want + ' (rules: ×' + got + ')'); });
  rowsOf(e, 'Abilities').forEach((a) => { const want = G.num(a['Non-Combat Checks']); const s = G.num(a['Ability Score']); if (want != null && s != null && want !== s + (B.checks[a.Ability] || 0)) why.push(a.Ability + ' non-combat ' + a['Non-Combat Checks'] + ' (rules: ' + G.signed(s + (B.checks[a.Ability] || 0)) + ')'); });
  tested++;
  if (why.length) unexplained.push(e.name + ' (' + e.book + '): ' + why.join('; '));
});
check('profiles tested (one-number rank)', tested > 190, true);
if (process.argv.includes('--list')) unexplained.forEach((u) => console.log('  ' + u));
check('profiles the rules cannot explain (' + unexplained.length + ' of ' + tested + '; --list shows them)', unexplained.length === KNOWN_UNEXPLAINED, true);

console.log('check_chargen: ' + (fails ? fails + ' FAILED' : 'OK') + ' (' + n + ' assertions; Young Lion as the book prints him; ' + (tested - unexplained.length) + ' of ' + tested + ' profiles derived exactly)');
process.exit(fails ? 1 : 0);
