// routes/scenarios.js
//
// Exposes scenario management to the frontend.
//   GET  /api/scenarios          — list available scenario names + meta
//   POST /api/scenarios/load/:name — load a scenario (runs load-scenario.js)
//   GET  /api/scenarios/presets  — centres the random MASCAL generator knows
//   POST /api/scenarios/generate — generate a random MASCAL scenario, write it, load it
// ---------------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const path      = require('path');
const fs        = require('fs');
const { execFileSync } = require('child_process');
const { PRESETS, LIMITS, generateMascalScenario } = require('../lib/mascal-generator');
const { SCENARIOS_DIR, writeScenarioModule } = require('../lib/scenario-files');

const PLANNER_BASE = (process.env.MEDEVAC_PLANNER_URL || 'http://localhost:8400').replace(/\/$/, '');

// ---------------------------------------------------------------------------

/**
 * Tell the planner a scenario was loaded.
 *
 * load-scenario.js TRUNCATEs puntos_interes and medical_details, so every
 * entity id the planner holds — in its task store, its route files and its
 * interactive briefing — is stale the moment this returns. Without this call
 * the only fix is killing the planner and relaunching it by hand.
 *
 * Fire-and-forget, like _notifyThreat in routes/entities.js: a planner that is
 * down must never make a scenario load fail.
 */
function _notifyScenarioLoaded(name) {
  fetch(`${PLANNER_BASE}/scenario/loaded`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ scenario: name }),
  }).catch(err => {
    console.warn(`[scenarios] Planner notify skipped (planner unreachable): ${err.message}`);
  });
}

/**
 * Run the loader on a scenario file and tell the planner. Throws with the loader's stderr.
 * The loader truncates both tables inside one transaction, so a failure changes nothing.
 */
function loadScenario(name) {
  const loaderPath = path.join(__dirname, '..', 'scripts', 'load-scenario.js');
  const output = execFileSync('node', [loaderPath, name], {
    encoding: 'utf-8',
    timeout: 15000                // 15 s safety cap
  });
  _notifyScenarioLoaded(name);
  return output.trim();
}

// ---------------------------------------------------------------------------

/** List all scenario modules and return their meta blocks */
router.get('/', (req, res) => {
  try {
    const files = fs.readdirSync(SCENARIOS_DIR)
      .filter(f => f.endsWith('.js') && f !== 'index.js');

    const scenarios = files.map(file => {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const mod = require(path.join(SCENARIOS_DIR, file));
      return mod.meta || { name: file.replace('.js', '') };
    });

    res.json({ success: true, data: scenarios });
  } catch (err) {
    console.error('GET /scenarios:', err);
    res.status(500).json({ success: false, message: 'Failed to list scenarios', error: err.message });
  }
});

/** Load a scenario by name — delegates to scripts/load-scenario.js */
router.post('/load/:name', (req, res) => {
  const name = req.params.name;
  const scenarioFile = path.join(SCENARIOS_DIR, `${name}.js`);

  if (!fs.existsSync(scenarioFile)) {
    return res.status(404).json({ success: false, message: `Scenario "${name}" not found` });
  }

  try {
    const output = loadScenario(name);
    res.json({ success: true, scenario: name, output });
  } catch (err) {
    console.error(`POST /scenarios/load/${name}:`, err.stderr || err.message);
    res.status(500).json({
      success: false,
      message: `Failed to load scenario "${name}"`,
      error: err.stderr ? err.stderr.trim() : err.message
    });
  }
});

/** Preset centres and the generator's limits, for the map's form */
router.get('/presets', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(PRESETS).map(([key, p]) => ({ key, label: p.label, lat: p.lat, lng: p.lng })),
    limits: LIMITS,
  });
});

/**
 * Generate a random MASCAL scenario, write it as scripts/scenarios/<name>.js and load it.
 * Body: { preset | lat+lng, n_casualties, n_evacuators, n_medical_facilities, radius_km, seed }
 * The file stays behind so the same scenario can be reloaded, or read by the optimiser's
 * scenario reader, by name.
 */
router.post('/generate', (req, res) => {
  let scenario;
  try {
    const { preset, lat, lng, n_casualties, n_evacuators, n_medical_facilities, radius_km, seed } = req.body || {};
    scenario = generateMascalScenario({ preset, lat, lng, n_casualties, n_evacuators,
                                        n_medical_facilities, radius_km, seed });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  try {
    writeScenarioModule(scenario);
    const output = loadScenario(scenario.meta.name);
    res.json({ success: true, scenario: scenario.meta.name, meta: scenario.meta, output });
  } catch (err) {
    console.error('POST /scenarios/generate:', err.stderr || err.message);
    res.status(500).json({
      success: false,
      message: `Failed to generate scenario "${scenario.meta.name}"`,
      error: err.stderr ? err.stderr.trim() : err.message
    });
  }
});

module.exports = router;
