// tools/check-session.js — M5's proof: two pages, two origins, one room, through the real controls.
//
// The Narrator (http://localhost:8746) sets up a hero, a scene with two tracked A.I.M. Agents, a copy's
// Health and private notes, and starts a session; a player (http://127.0.0.1:8746 — another origin,
// its own storage) follows the join link, claims the hero, plays (Health −, a check), sees the
// Narrator's change, is refused what a player may not do, opens its table, and keeps its seat on a
// reload. Every line printed is a result; any exception exits 1.
//
// The repo is served from disk for both origins (no site server needed). The Worker must be running:
//   (cd worker && npx wrangler dev --port 8802)      — or the launch entry vtt-marvelmultiverse-worker
//   NODE_PATH=~/App/ray-so/scripts/node_modules node tools/check-session.js
// (Playwright is not a dependency of this repo; the family's harness uses ray-so's install.)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/markdown' };
const out = [];
const say = (k, v) => { out.push([k, v]); console.log(k + ': ' + (typeof v === 'string' ? v : JSON.stringify(v))); };
const errors = [];
const fails = [];
const expect = (label, ok) => { if (!ok) fails.push(label); };

async function serve(ctx, origin) {
  await ctx.route(origin + '/**', (route) => {
    let p = new URL(route.request().url()).pathname;
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, decodeURIComponent(p));
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'no' });
    route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // pages served from disk have no address, so Chromium would count them public and block their calls to
  // the loopback Worker (Local Network Access); a real localhost page is loopback itself
  const browser = await chromium.launch({ args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests'] });
  const gmCtx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  const plCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await serve(gmCtx, 'http://localhost:8746');
  await serve(plCtx, 'http://127.0.0.1:8746');
  const gm = await gmCtx.newPage();
  const pl = await plCtx.newPage();
  for (const [n, p] of [['gm', gm], ['player', pl]]) {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(n + ': ' + m.text()); });
    p.on('pageerror', (e) => errors.push(n + ' pageerror: ' + e.message));
  }

  // ── the Narrator sets up: a hero, a scene with two A.I.M. Agents, a copy's Health, private notes ──
  await gm.goto('http://localhost:8746/gm/');
  await gm.getByRole('button', { name: 'Enter' }).click();
  // Heroes is already a region of the default layout
  const party = gm.locator('.slot-party').first();
  const pick = party.locator('select[aria-label="A character profile"]');
  await pick.selectOption({ label: 'Spider-Man (Peter Parker) (p. 237) · Rank 4' });
  await party.locator('input[placeholder="Player"]').fill('Sam');
  await party.locator('button', { hasText: /^Add$/ }).click();
  await wait(300);
  await gm.locator('.navbtn', { hasText: 'Scenes' }).click();
  await gm.locator('input[aria-label="New scene"]').fill('Break-in at the A.I.M. lab');
  await gm.locator('.slot-scenes .gm-add button', { hasText: 'Add' }).first().click();
  await gm.locator('.slot-scenes button', { hasText: '+ Encounter' }).click();
  await gm.locator('input[aria-label="Add a character to this encounter"]').fill('A.I.M.');
  await wait(400);
  await gm.locator('.slot-scenes button', { hasText: /^\+ A\.I\.M\. Agent/ }).click();
  await gm.locator('.slot-scenes .enc-row button', { hasText: /^\+$/ }).click();
  await gm.locator('.slot-scenes button', { hasText: 'Put on the table' }).click();
  await wait(400);
  const h1 = gm.locator('.slot-scenes .inst-row').first().locator('input[aria-label^="Health"]');
  await h1.fill('4');
  await h1.press('Tab');
  await gm.locator('.navbtn', { hasText: 'Overview' }).click();
  await gm.locator('textarea.notes-free').fill('The lab is a trap — MODOK is watching.');
  await wait(600);
  const gmDoc = await gm.evaluate(() => ({ party: VttState.state.party.map((m) => m.name), cast: VttState.state.cast, npcState: VttState.state.npcState, gmNotes: VttState.state.gmNotes }));
  say('GM set up', { party: gmDoc.party, copies: Object.values(gmDoc.cast)[0].map((c) => c.label), npcState: gmDoc.npcState, gmNotes: !!gmDoc.gmNotes });

  // ── the Narrator starts a session ──
  await gm.getByRole('button', { name: 'Start session' }).click();
  await gm.waitForSelector('.session-code b', { timeout: 15000 });
  await gm.waitForSelector('.session-code .chip.on', { timeout: 15000 });
  const code = (await gm.locator('.session-code b').textContent()).trim();
  say('room', code + ' · ' + (await gm.locator('.session-code .chip').textContent()));
  expect('the room is live', /live/.test(await gm.locator('.session-code .chip').textContent()));

  // ── the player joins from another origin, and claims the hero ──
  await pl.goto('http://127.0.0.1:8746/gm/play.html?s=' + code);
  // the join link (Session.joinUrl, ?s=CODE) joins its room on load
  await pl.waitForSelector('.cards .card', { timeout: 15000 });
  const claimable = await pl.locator('.cards .card .card-name').allTextContents();
  say('player sees to claim', claimable);
  expect('the player can claim the hero', claimable.some((n) => /Spider-Man/.test(n)));
  await pl.locator('.cards .card', { hasText: 'Spider-Man' }).getByRole('button', { name: 'Claim' }).click();
  await pl.waitForSelector('.sheet.live', { timeout: 20000 });
  const view = await pl.evaluate(() => ({ keys: Object.keys(VttState.state).sort(), npcState: VttState.state.npcState, gmNotes: VttState.state.gmNotes, arc: VttState.state.arc, cast: VttState.state.cast, head: document.querySelector('.sheet-head').innerText }));
  say('player view', { head: view.head, hasNpcState: view.npcState !== undefined && Object.keys(view.npcState || {}).length > 0, hasGmNotes: !!view.gmNotes, hasArc: !!(view.arc && view.arc.length), castShared: !!(view.cast && Object.keys(view.cast).length) });
  expect('the player’s view holds none of the Narrator’s own state', view.npcState === undefined || !Object.keys(view.npcState || {}).length);
  expect('no GM notes in the player’s view', !view.gmNotes);
  expect('no arc in the player’s view', !(view.arc && view.arc.length));
  const gmClaims = await gm.locator('.session-code').innerText();
  say('GM sees', gmClaims.replace(/\n/g, ' '));

  // ── the player plays: Health −, an Agility check (dice pinned) ──
  await pl.locator('.tracker', { hasText: 'Health' }).getByRole('button', { name: '−' }).click();
  await pl.evaluate(() => { window.__q = [3, 0, 1]; crypto.getRandomValues = (a) => { a[0] = window.__q.length ? window.__q.shift() : 0; return a; }; });
  await pl.getByRole('button', { name: 'Agility 7' }).click();
  await pl.getByRole('button', { name: 'Roll d616' }).click();
  await wait(1500);
  const gmSees = await gm.evaluate(() => { const m = VttState.state.party[0]; return { live: m.live, log: VttState.state.log.slice(-2).map((x) => x.text || (x.label + ' ' + x.listed + ' → ' + x.total + ' · ' + x.outcome)) }; });
  say('GM receives the player’s play', gmSees);
  expect('the player’s Health change reaches the GM', gmSees.live.health === 89);
  expect('the player’s roll reaches the GM', gmSees.log.some((x) => /Agility 4 M 2 → 19/.test(x)));

  // ── the Narrator changes the hero; the player sees it ──
  // (the click into Heroes selected that region, so Scenes and Overview opened there: bring it back)
  await gm.locator('.navbtn', { hasText: 'Heroes' }).click();
  await gm.locator('.slot-party .card').first().click();
  await wait(800);
  const focus = gm.locator('.slot-inspector').first().locator('.tracker', { hasText: 'Focus' }).locator('input');
  await focus.fill('80');
  await focus.press('Tab');
  await wait(1500);
  const got = await pl.evaluate(() => ({ focus: VttState.state.party[0].live.focus, shown: [...document.querySelectorAll('.tracker')].find((t) => t.innerText.startsWith('FOCUS')).querySelector('input').value }));
  say('player receives the Narrator’s change', got);
  expect('the Narrator’s change reaches the player', got.focus === 80 && got.shown === '80');

  // ── the room refuses what a player may not do ──
  const before = await gm.evaluate(() => JSON.stringify({ n: VttState.state.npcState, notes: VttState.state.gmNotes, cast: VttState.state.cast }));
  await pl.evaluate(() => { window.__errs = []; VttBus.on('session:error', (p) => window.__errs.push(p.message)); });
  await pl.evaluate(() => {
    const iid = Object.values(VttState.state.cast || {})[0][0].iid;
    VttState.commit('setNpcState', [iid, { health: 99 }]);          // the Narrator's own
    VttState.commit('setSceneCast', [Object.keys(VttState.state.cast)[0], []]);   // the Narrator's to set
    VttState.commit('setGmNotes', ['hacked']);                     // local to the Narrator
  });
  await wait(1500);
  const after = await gm.evaluate(() => JSON.stringify({ n: VttState.state.npcState, notes: VttState.state.gmNotes, cast: VttState.state.cast }));
  say('refused: the GM’s state unchanged by the player’s forbidden ops', before === after);
  const answers = await pl.evaluate(() => window.__errs);
  say('the room’s answers to the player', answers);
  expect('the room refuses the forbidden ops', before === after && answers.indexOf('not allowed: setNpcState') !== -1 && answers.indexOf('not allowed: setSceneCast') !== -1);
  say('the player’s own copy after the room’s snapshot (the cast put back; npcState is not a shared key, so the refused edit stays in that browser alone)', await pl.evaluate(() => ({ npcState: VttState.state.npcState || null, castLen: Object.values(VttState.state.cast || {})[0].length })));

  // ── the table: the GM places the downed copy; the player's table follows, without its Health ──
  const gmTable = await gmCtx.newPage();
  gmTable.on('pageerror', (e) => errors.push('gm table pageerror: ' + e.message));
  await gmTable.goto('http://localhost:8746/gm/vtt.html');
  await gmTable.waitForSelector('#vtt-toolbar select');
  const tokSel = gmTable.locator('#vtt-toolbar select').filter({ hasText: 'add token…' });
  await tokSel.selectOption({ label: 'A.I.M. Agent 1' });
  await tokSel.selectOption({ label: 'Spider-Man (Peter Parker)' });
  await gmTable.waitForFunction(() => document.querySelectorAll('svg#map .token').length >= 2, null, { timeout: 15000 });
  const gmToks = await gmTable.locator('svg#map .token').allTextContents();
  say('GM table tokens', gmToks);
  expect('the GM’s table shows the copy’s Health', gmToks.some((t) => /A\.I\.M\. Agent 1 · Health 4/.test(t)));
  await pl.locator('.play-menu > summary').click().catch(() => {});
  const [plTable] = await Promise.all([plCtx.waitForEvent('page'), pl.getByRole('link', { name: 'Open the table' }).click()]);
  plTable.on('pageerror', (e) => errors.push('player table pageerror: ' + e.message));
  await plTable.waitForFunction(() => document.querySelectorAll('svg#map .token').length >= 2, null, { timeout: 20000 });
  const plToks = await plTable.locator('svg#map .token').allTextContents();
  expect('the players’ table never shows a copy’s Health', plToks.some((t) => /A\.I\.M\. Agent 1/.test(t)) && !plToks.some((t) => /A\.I\.M\. Agent 1 · Health/.test(t)));
  say('player table tokens', { url: plTable.url().replace(/^https?:\/\/[^/]+/, ''), player: await plTable.evaluate(() => document.body.classList.contains('player')), tokens: await plTable.locator('svg#map .token').allTextContents() });

  // ── a reload keeps the seat ──
  await pl.reload();
  await pl.waitForSelector('.sheet.live', { timeout: 20000 });
  const again = await pl.locator('.sheet-head h2').textContent();
  say('player after reload', again);
  expect('a reload keeps the seat', /Spider-Man/.test(again));

  say('console errors', errors);
  expect('no console errors', !errors.length);
  await browser.close();
  console.log('check-session: ' + (fails.length ? fails.length + ' FAILED — ' + fails.join('; ') : 'OK'));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS FAILED:', e.message); console.error(errors); process.exit(1); });
