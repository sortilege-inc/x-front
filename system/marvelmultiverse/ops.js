// system/marvelmultiverse/ops.js — the ops Marvel Multiverse adds to the engine's, registered
// with the same call and shared the same way (engine/ops.js). Loaded by the browser after
// engine/ops.js, and imported by the Worker beside it, so the room applies the very same
// functions. Ids travel in the args; applying an op is deterministic everywhere, and the room
// never rolls. Ported from sortilege-vtt-vtm5e (system/vtm5e/ops.js): its Narrator-written scenes
// and the GM's own pack state; its loresheets, conflicts and relationship maps are that game's.
//
//   scenes  [ { id, name, cast:[entityIds] } ]   the Narrator's own scenes, in play order — neither
//                                                book ships an .arc (PLAN.md), so a scene is what
//                                                the Narrator writes; done, notes and the current
//                                                one use the engine's scene ops under moduleId
//                                                'adventure'. The cast are character profiles.
//   gm, gmNotes, arc, threads                    the Narrator's own pack state (engine/gm-panes.js,
//                                                engine/gm-text.js), never shared
//   A hero's live state is the engine's setPartyLive: { health, focus, karma }
//   (system/marvelmultiverse/sheet.js).
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('../../engine/ops.js'));
  else factory(root.VttOps);
})(typeof self !== 'undefined' ? self : this, function (Ops) {
  Ops.shared(['scenes']);

  Ops.register('setScenes', (s, list) => {
    s.scenes = (list || []).slice();
  });
  Ops.register('putScene', (s, scene) => {
    if (!s.scenes) s.scenes = [];
    const i = s.scenes.findIndex((x) => x.id === scene.id);
    if (i === -1) s.scenes.push(scene);
    else s.scenes[i] = Object.assign({}, s.scenes[i], scene);
  });
  Ops.register('removeScene', (s, id) => {
    s.scenes = (s.scenes || []).filter((x) => x.id !== id);
  });
  // who is in a scene: character profiles from the books (records.js ids)
  Ops.register('setSceneCast', (s, sceneId, ids) => {
    const sc = (s.scenes || []).find((x) => x.id === sceneId);
    if (sc) sc.cast = (ids || []).slice();
  });

  // The Narrator's own pack state (PLAYBOOK §4b.2): kept in this browser's pack and never sent to
  // a session's room — no player may send them, none is in a player's view, none is forwarded.
  const gmOnly = () => null;
  const LOCAL = { local: true };
  const copy = (x) => JSON.parse(JSON.stringify(x == null ? null : x));
  Ops.register('setGm', (s, where, value) => { if (!s.gm) s.gm = {}; s.gm[String(where)] = copy(value); }, null, gmOnly, LOCAL);
  Ops.register('setGmNotes', (s, text) => { s.gmNotes = String(text || ''); }, null, gmOnly, LOCAL);
  Ops.register('setArc', (s, list) => { s.arc = copy(list || []); }, null, gmOnly, LOCAL);
  Ops.register('setThreads', (s, list) => { s.threads = copy(list || []); }, null, gmOnly, LOCAL);

  return Ops;
});
