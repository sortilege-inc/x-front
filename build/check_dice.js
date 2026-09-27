// build/check_dice.js — the d616 rules (system/marvelmultiverse/dice.js) replay Core Mechanics'
// own worked examples, die for die. Each case quotes the example it reproduces; the dice the
// example rolls are fed in order. Exit 1 on any difference.
//
//   node build/check_dice.js
const Dice = require('../system/marvelmultiverse/dice.js');
let fails = 0;
let n = 0;
const feed = (list) => { const q = list.slice(); return () => { if (!q.length) throw new Error('the example rolls no more dice'); return q.shift(); }; };
function check(label, got, want) {
  n++;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) { fails++; console.log('  FAIL ' + label + ': got ' + g + ', the book ' + w); }
}
const M = Dice.LOGO_FACE;

// "Example: You roll 3 5 4, so your total is 12." (Roll d616)
let c = Dice.start({}, feed([3, 5, 4]));
check('Roll d616, 3 5 4', [Dice.result(c).listed, Dice.result(c).dice], ['3 5 4', 12]);
// "Example: You roll 3 M 6, so your total is 15." (Roll d616)
c = Dice.start({}, feed([3, M, 6]));
check('Roll d616, 3 M 6', [Dice.result(c).listed, Dice.result(c).dice, Dice.result(c).fantastic], ['3 M 6', 15, true]);

// "rolls 1 5 2, for a total of 8. Adding their ability score of +1 makes that a 9, but the target
// number is 10. … They decide to reroll the 1, and this time, they get a 5. Their roll is now
// 5 5 2, for a total of 12. That plus their ability score gives them a 13" (Edge)
c = Dice.start({ ability: 1, tn: 10, edges: 1 }, feed([1, 5, 2]));
check('Edge, before', [Dice.result(c).total, Dice.result(c).success, c.edges], [9, false, 1]);
Dice.edge(c, 0, feed([5]));
const e = Dice.result(c);
check('Edge, after', [e.listed, e.dice, e.total, e.success], ['5 5 2', 12, 13, true]);

// "They roll 6 M 5 on their action check, for a total of 17. They must reroll the M and use the
// worse of the two results. They roll a 2, so their roll is now 6 2 5, for a total of 13." (Trouble)
c = Dice.start({ troubles: 1 }, feed([6, M, 5, 2]));
const t = Dice.result(c);
check('Trouble', [c.log[1].die, t.listed, t.dice, t.fantastic], [Dice.MARVEL, '6 2 5', 13, false]);

// "the agent's player rolls 3 M 2. That totals up to 11. … Adding the agent's ability score of +1
// makes the result 12, which hits. Because it's a Fantastic success" (Fantastic Success; TN 10)
c = Dice.start({ ability: 1, tn: 10 }, feed([3, M, 2]));
const f = Dice.result(c);
check('Fantastic Success', [f.dice, f.total, f.outcome], [11, 12, 'Fantastic Success']);

// "a d616 roll of 6 M 6. This is equal to a result of 18 … automatically succeeds … Ignore any
// trouble at that point." (The Ultimate Fantastic Roll; Trouble) — against a TN it cannot reach
c = Dice.start({ tn: 40, troubles: 2 }, feed([6, M, 6]));
const u = Dice.result(c);
check('Ultimate, trouble ignored', [u.dice, u.success, u.outcome, c.log.length], [18, true, 'The Ultimate Fantastic Roll', 2]);

// "These things cancel each other out in equal measure" (Mixing Things Up): 2 edges, 1 trouble
c = Dice.start({ edges: 2, troubles: 1 }, feed([2, 3, 4]));
check('Mixing, one edge left', [c.edges, c.log.length], [1, 1]);

console.log('check_dice: ' + (fails ? fails + ' FAILED' : 'OK') + ' (' + n + ' assertions, from the book\'s worked examples)');
process.exit(fails ? 1 : 0);
