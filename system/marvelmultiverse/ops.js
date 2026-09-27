// system/marvelmultiverse/ops.js — the ops Marvel Multiverse adds to the engine's, registered
// with the same call and shared the same way (engine/ops.js). Loaded by the browser after
// engine/ops.js, and imported by the Worker beside it, so the room applies the very same
// functions. Ids travel in the args; applying an op is deterministic everywhere.
//
//   cast   { [sceneId]: [entityIds] }   who the Narrator has put in a scene, drawn from any
//                                       character profile of the books (the Cast panel, M3)
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('../../engine/ops.js'));
  else factory(root.VttOps);
})(typeof self !== 'undefined' ? self : this, function (Ops) {
  Ops.shared(['cast']);

  Ops.register('setSceneCast', (s, sceneId, ids) => {
    if (!s.cast) s.cast = {};
    s.cast[sceneId] = (ids || []).slice();
  });

  return Ops;
});
