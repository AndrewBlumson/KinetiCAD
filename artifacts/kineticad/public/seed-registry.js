/*
 * REFERENCE COPY — NOT LOADED BY index.html
 * -------------------------------------------------
 * This file is kept as a readable reference only. The seed registry is now
 * inlined directly into index.html as a <script data-base="%BASE_URL%"> block.
 *
 * Reason for inlining: when the app is served at a non-root base path (/app),
 * Vite dev does not serve public/ files at the base-prefixed URL
 * (/app/seed-registry.js). A <script src="%BASE_URL%seed-registry.js"> tag
 * caused a 404 in dev because %BASE_URL% substitution made the browser request
 * /app/seed-registry.js, but Vite dev only served the file at /seed-registry.js.
 * Inlining removes the fetch entirely. The base path is derived at runtime from
 * document.currentScript.dataset.base (populated via the data-base="%BASE_URL%"
 * HTML attribute, where Vite's attribute substitution is reliable in both dev
 * and production).
 *
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
 *    src/state/store.ts (currently 9). If the number is wrong the seed will
 *    load as stale data and trigger the migration chain, producing unexpected
 *    state. Always check store.ts before writing a new seed.
 *
 * 3. Add one { id, name, description } entry to the SEEDS array in the
 *    inlined block inside artifacts/kineticad/index.html. That is the only
 *    change needed alongside the new seed file.
 */

// Seed registry for KinetiCAD test fixtures and demo scenes.
// window.loadSeed(id) is available in the browser console once the app loads.
(function () {
  var SEEDS = [
    {
      id: 'windmill',
      name: 'Windmill',
      description: 'Two-body revolute joint with 30 RPM motor. Used as physics canary.',
    },
    {
      id: 'orrery',
      name: 'Orrery',
      description: 'Nested planetary model: sun, 8 planets, 3 moons, asteroid ring. 13 bodies, 12 revolute joints.',
    },
    // Add future seeds here: { id, name, description }
  ];

  var base = (window.__seedBase || '/');

  window.loadSeed = function (id) {
    var entry = SEEDS.find(function (s) { return s.id === id; });
    if (!entry) {
      var available = SEEDS.map(function (s) { return s.id; });
      console.error('[seed-registry] Unknown id: "' + id + '". Available:', available);
      return;
    }
    fetch(base + 'seeds/' + id + '.js')
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
