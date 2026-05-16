/*
 * How to add a seed
 * -----------------
 * 1. Create public/seeds/<id>.js as a self-contained IIFE with this shape:
 *
 *      (function () {
 *        const state = { ... };  // full Zustand state object
 *        localStorage.setItem("kineticad-state", JSON.stringify({ state, version: N }));
 *        console.log("[seed] State written. Reloading…");
 *        location.reload();
 *      })();
 *
 * 2. The version: N value MUST match the current Zustand persist version in
 *    src/state/store.ts (currently 8). If the number is wrong the seed will
 *    load as stale data and trigger the migration chain, producing unexpected
 *    state. Always check store.ts before writing a new seed.
 *
 * 3. Add one { id, name, description } entry to the SEEDS array below.
 *    That is the only change needed in this file.
 */

// Seed registry for KinetiCAD test fixtures and demo scenes.
// window.loadSeed(id) is available in the browser console once the app loads.
// Added 16/05/2026.
(function () {
  var SEEDS = [
    {
      id: 'windmill',
      name: 'Windmill',
      description: 'Two-body revolute joint with 30 RPM motor. Used as physics canary.',
    },
    // Add future seeds here: { id, name, description }
  ];

  window.loadSeed = function (id) {
    var entry = SEEDS.find(function (s) { return s.id === id; });
    if (!entry) {
      var available = SEEDS.map(function (s) { return s.id; });
      console.error('[seed-registry] Unknown id: "' + id + '". Available:', available);
      return;
    }
    fetch('/seeds/' + id + '.js')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      // eslint-disable-next-line no-eval
      .then(function (code) { eval(code); })
      .catch(function (err) {
        console.error('[seed-registry] Failed to load seed "' + id + '":', err);
      });
  };

  console.log(
    '[seed-registry] window.loadSeed ready. Seeds:',
    SEEDS.map(function (s) { return s.id; })
  );
})();
