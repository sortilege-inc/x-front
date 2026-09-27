// system/marvelmultiverse/table.js — what the Marvel Multiverse tells the table (engine/vtt.js)
// and the player's page (engine/play.js): which scenes are in play, what can stand on the table,
// what a token's state reads as, and how a character file becomes a hero at the table. The
// engine never asks the corpus directly. Ported from sortilege-vtt-vtm5e (system/vtm5e/table.js),
// with sortilege-vtt-coyotecrow's workbench cast (D5).
//
// The scenes are the Narrator's arc (the Scenes outline, op `setArc`): neither book ships an .arc.
// One scene is running (the engine's `current`, under the module id 'adventure'), and the table,
// the Cast and the player's page follow it. It ships no maps: a map is whatever image the Narrator
// sets on a scene.
//
// A scene's cast is a list of instances (op setSceneCast): { iid, id, label } is one tracked copy of
// a character profile, so three A.I.M. Agents are three trackers; a bare string is one copy whose
// iid is its id. A copy's Health and Focus stand in npcState[iid] (the Narrator's own).
window.VttSystem = (function () {
  const D = window.MMData;
  const Sheet = window.MMSheet;
  const State = window.VttState;
  const Bus = window.VttBus;
  const S = () => State.state;

  const MODULE = 'adventure';
  const moduleId = () => MODULE;

  const scenes = () => (S().arc || []).map((x) => ({ id: x.id, name: x.title || 'A scene', phase: x.session || null, moduleId: MODULE, own: true }));
  function scene(id) {
    const a = (S().arc || []).find((x) => x.id === id);
    return a ? { id: a.id, name: a.title || 'A scene', own: true, arc: a } : null;
  }
  function currentSceneId() {
    const cur = (S().current || {})[MODULE];
    const all = scenes();
    if (!all.length) return cur || null;                       // a player's page: no arc, only the id
    return (all.find((s) => s.id === cur) || all[0] || {}).id || null;
  }

  // ── the cast, as instances ─────────────────────────────────────────
  const castRaw = (sceneId) => ((S().cast || {})[sceneId] || []).slice();
  const castEntries = (sceneId) => castRaw(sceneId).map((c) => (typeof c === 'string' ? { iid: c, id: c } : { iid: c.iid || c.id, id: c.id, label: c.label }));
  const castIds = (sceneId) => castEntries(sceneId).map((c) => c.id);
  const byRecord = (id) => D.entity(id) || D.record(id) || null;
  const cast = (sceneId) => { const seen = {}; return castIds(sceneId).filter((id) => (seen[id] ? false : (seen[id] = 1))).map(byRecord).filter(Boolean); };
  const instLabel = (c) => c.label || ((byRecord(c.id) || {}).name || c.id);
  // a copy of a profile put in a scene: one more instance, numbered when several go in at once
  function addToScene(sceneId, id, count) {
    const cur = castRaw(sceneId);
    const name = (byRecord(id) || {}).name || id;
    const n = count || 1;
    const already = castEntries(sceneId).filter((c) => c.id === id).length;
    for (let k = 1; k <= n; k++) cur.push({ iid: State.genId('inst'), id, label: n > 1 || already ? name + ' ' + (already + k) : name });
    State.commit('setSceneCast', [sceneId, cur]);
  }
  const removeFromScene = (sceneId, iid) => State.commit('setSceneCast', [sceneId, castRaw(sceneId).filter((c) => (typeof c === 'string' ? c : c.iid) !== iid)]);

  // a copy's Health and Focus as they stand: its own, else the profile's printed number
  const COPY_TRACKS = ['health', 'focus'];
  function copyState(iid, id) {
    const st = (S().npcState || {})[iid] || {};
    const f = (D.record(id) || {}).fields || {};
    const out = {};
    Sheet.TRACKS.filter((t) => COPY_TRACKS.indexOf(t.key) !== -1).forEach((t) => {
      const max = Sheet.printedInt(f[t.field]);
      const cur = st[t.key] != null ? st[t.key] : max;
      out[t.key] = { label: t.label, cur, max };
    });
    return out;
  }
  function setCopy(iid, id, key, n) {
    const st = Object.assign({}, (S().npcState || {})[iid] || {});
    st[key] = n;
    State.commit('setNpcState', [iid, st]);
  }

  const maps = () => [];
  const mapDef = () => null;
  const defaultMapId = (sceneId) => sceneId;
  const legend = () => null;
  const mapAssets = () => [];

  // ── tokens: the heroes, and the running scene's cast ───────────────
  function tokenSources() {
    const groups = [];
    const party = (S().party || []).map((m) => ({ id: 'tk-' + m.id, label: m.name, kind: 'party', owner: m.id, ref: m.id }));
    if (party.length) groups.push({ label: 'The heroes', items: party });
    const sid = currentSceneId();
    const sc = scene(sid);
    const here = sc ? castEntries(sid).map((c) => ({ id: 'tk-' + c.iid, label: instLabel(c), kind: 'cast', ref: c.id, iid: c.iid })) : [];
    if (here.length) groups.push({ label: sc.name, items: here });
    return groups;
  }

  const COLORS = { party: '#c8102e', cast: '#1d4f9a', marker: '#5b574d' };
  const tokenColor = (t) => COLORS[t.kind] || COLORS.marker;
  // a token's words: a hero's Health and Focus as they stand; a copy's, the Narrator's view of it
  function tokenStatus(t) {
    if (t.kind === 'party') {
      const m = (S().party || []).find((x) => x.id === t.owner);
      if (!m) return null;
      return { text: Sheet.TRACKS.filter((x) => x.key !== 'karma').map((x) => { const c = Sheet.current(m, x); return c != null ? x.label + ' ' + c : null; }).filter(Boolean).join(' · '), pips: [] };
    }
    const r = t.kind === 'cast' && t.ref ? D.record(t.ref) : null;
    if (!r) return null;
    const cs = copyState(t.iid || t.ref, t.ref);
    const txt = COPY_TRACKS.map((k) => (cs[k].cur != null ? cs[k].label + ' ' + cs[k].cur : null)).filter(Boolean).join(' · ');
    return { text: txt || ((r.fields || {}).Rank ? 'Rank ' + r.fields.Rank : ''), pips: [] };
  }

  function selectToken(t) {
    if (t.kind === 'party') Bus.emit('select', { kind: 'party', id: t.owner });
    else if (t.kind === 'cast' && t.ref) Bus.emit('select', { kind: 'entity', id: t.ref, iid: t.iid, label: t.label });
  }
  const tokenMenu = () => null;

  const readCharacter = (obj, fileName) => Sheet.readMember(obj, fileName);
  const downloadCharacter = (m) => Sheet.downloadMember(m);
  // the sheet reads ACTOR "Character" (the core's BASE), the d616's tables (the core) and the hero's
  // profile book; until they are in memory the panel says so and fills in when they arrive
  function liveSheet(m, opts) {
    const books = ['core'].concat(Sheet.booksFor(m));
    if (books.every((b) => D.loaded(b))) return Sheet.live(m, opts);
    const box = window.VttRender.el('div', { class: 'muted' }, ['Opening the sheet…']);
    D.ensure(books).then(() => { if (box.parentNode) box.replaceWith(Sheet.live(m, opts)); });
    return box;
  }
  const memberSubtitle = (m) => Sheet.sentence(m);
  // the player makes a hero here, with the site's creator, and it takes its seat (engine/play.js)
  const makeCharacter = (container, seat) => window.MMCreator.render(container, null, null, { embedded: true, onDone: (v) => seat(Sheet.fromValues(v, '')), doneLabel: 'Take my hero to the table' });

  // an entity or record by id, for the Narrator's notes (engine/gm-text.js "About")
  const byId = (id) => { const r = D.record(id); if (r) return { id: r.id, name: r.name }; const e = D.entity(id); return e ? { id: e.id, name: e.name } : null; };

  return {
    byId, MODULE, moduleId, scenes, scene, currentSceneId,
    cast, castIds, castEntries, castRaw, instLabel, addToScene, removeFromScene, copyState, setCopy, COPY_TRACKS,
    maps, mapDef, defaultMapId, legend, mapAssets,
    tokenSources, tokenColor, tokenStatus, selectToken, tokenMenu,
    liveSheet, readCharacter, downloadCharacter, memberSubtitle, makeCharacter,
  };
})();
