// system/marvelmultiverse/table.js — what the Marvel Multiverse tells the table (engine/vtt.js)
// and the player's page (engine/play.js): which scenes are in play, what can stand on the table,
// what a token's state reads as, and how a character file becomes a hero at the table. The
// engine never asks the corpus directly. Ported from sortilege-vtt-vtm5e (system/vtm5e/table.js).
//
// The module is the Narrator's own adventure (system/marvelmultiverse/ops.js `scenes`): neither
// book ships an .arc. It ships no maps: a map is whatever image the Narrator sets on a scene,
// and who is in a scene is who the Narrator has put there from the books' profiles.
window.VttSystem = (function () {
  const D = window.MMData;
  const Sheet = window.MMSheet;
  const State = window.VttState;
  const S = () => State.state;

  const MODULE = 'adventure';

  const scenes = () => (S().scenes || []).map((sc) => ({ id: sc.id, name: sc.name, phase: null, moduleId: MODULE }));
  const scene = (id) => (S().scenes || []).find((sc) => sc.id === id) || null;

  function currentSceneId() {
    const cur = (S().current || {})[MODULE];
    const all = S().scenes || [];
    return (all.find((s) => s.id === cur) || all[0] || {}).id || null;
  }

  // who is in a scene: records (always in memory) — their book loads when opened
  const cast = (sceneId) => ((scene(sceneId) || {}).cast || []).map((id) => D.record(id)).filter(Boolean);

  const maps = () => [];
  const mapDef = () => null;
  const defaultMapId = (sceneId) => sceneId;
  const legend = () => null;
  const mapAssets = () => [];

  function tokenSources() {
    const groups = [];
    const party = (S().party || []).map((m) => ({ id: 'tk-' + m.id, label: m.name, kind: 'party', owner: m.id, ref: m.id }));
    if (party.length) groups.push({ label: 'The heroes', items: party });
    const sc = scene(currentSceneId());
    const here = sc ? cast(sc.id).map((r) => ({ label: r.name, kind: 'cast', ref: r.id })) : [];
    if (here.length) groups.push({ label: sc.name, items: here });
    return groups;
  }

  const COLORS = { party: '#c8102e', cast: '#1d4f9a', marker: '#5b574d' };
  const tokenColor = (t) => COLORS[t.kind] || COLORS.marker;
  // a token's words: a hero's Health and Focus as they stand; a profile's printed Rank
  function tokenStatus(t) {
    if (t.kind === 'party') {
      const m = (S().party || []).find((x) => x.id === t.owner);
      if (!m) return null;
      return { text: Sheet.TRACKS.filter((t) => t.key !== 'karma').map((t) => { const c = Sheet.current(m, t); return c != null ? t.label + ' ' + c : null; }).filter(Boolean).join(' · '), pips: [] };
    }
    const r = t.kind === 'cast' && t.ref ? D.record(t.ref) : null;
    const f = (r && r.fields) || {};
    return r ? { text: f.Rank ? 'Rank ' + f.Rank : '', pips: [] } : null;
  }

  function selectToken(t) {
    if (t.kind === 'party') window.VttBus.emit('select', { kind: 'party', id: t.owner });
    else if (t.kind === 'cast' && t.ref) window.VttBus.emit('select', { kind: 'entity', id: t.ref });
  }
  const tokenMenu = () => null;

  const readCharacter = (obj, fileName) => Sheet.readMember(obj, fileName);
  const downloadCharacter = (m) => Sheet.downloadMember(m);
  // the sheet reads the hero's profile, the core (the d616's tables) and the profile's book;
  // until they are in memory the panel says so and fills in when they arrive
  function liveSheet(m, opts) {
    const books = ['core'].concat(Sheet.booksFor(m));
    if (books.every((b) => D.loaded(b))) return Sheet.live(m, opts);
    const box = window.VttRender.el('div', { class: 'muted' }, ['Opening the sheet…']);
    D.ensure(books).then(() => { if (box.parentNode) box.replaceWith(Sheet.live(m, opts)); });
    return box;
  }
  const memberSubtitle = (m) => Sheet.sentence(m);

  // an entity or record by id, for the Narrator's notes (engine/gm-text.js "About")
  const byId = (id) => { const r = D.record(id); if (r) return { id: r.id, name: r.name }; const e = D.entity(id); return e ? { id: e.id, name: e.name } : null; };

  return {
    byId,
    MODULE, scenes, scene, currentSceneId, cast, maps, mapDef, defaultMapId, legend, mapAssets,
    tokenSources, tokenColor, tokenStatus, selectToken, tokenMenu,
    liveSheet, readCharacter, downloadCharacter, memberSubtitle,
  };
})();
