// tests/helpers/load-app.js
//
// Loads public/index.html and the real browser scripts (i18n.js, app.js) into a
// jsdom window, so tests exercise the code the browser runs without a browser.
// The scripts are plain globals, so they run in the window's own context: their
// top-level `let`/`const` stay reachable through `page.run()`.
//
// Not started: the DOMContentLoaded bootstrap (map, SSE, clocks). Only
// `renderCategoryOptions()` and `setupEventListeners()` are run here, because
// the entity form depends on them.

const fs   = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const PUBLIC = path.join(__dirname, '..', '..', 'public');
const read   = (file) => fs.readFileSync(path.join(PUBLIC, file), 'utf8');

function loadApp({ fetch } = {}) {
  const dom = new JSDOM(read('index.html'), { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;

  window.fetch = fetch || (async () => ({ ok: true, json: async () => ({}) }));
  window.confirm = () => true;
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

  // jsdom fires DOMContentLoaded after construction; drop the app's bootstrap
  // listener (map, SSE, clocks) so the page stays inert until a test acts on it.
  const addListener = window.document.addEventListener.bind(window.document);
  window.document.addEventListener = (type, ...rest) => {
    if (type !== 'DOMContentLoaded') addListener(type, ...rest);
  };

  const context = dom.getInternalVMContext();
  const run = (code, filename = 'test') => new (require('node:vm').Script)(code, { filename }).runInContext(context);
  for (const file of ['js/i18n.js', 'js/app.js']) run(read(file), file);
  run('renderCategoryOptions(); setupEventListeners();');
  // The map is not built, so give the redraw after a save a layer group to clear.
  run('threatCirclesLayer = { clearLayers() {}, addLayer() {} };');

  return { window, document: window.document, run };
}

module.exports = { loadApp };
