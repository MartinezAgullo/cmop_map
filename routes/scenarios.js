// routes/scenarios.js
//
// Exposes scenario management to the frontend.
//   GET  /api/scenarios          — list available scenario names + meta
//   POST /api/scenarios/load/:name — load a scenario (runs load-scenario.js)
// ---------------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const path      = require('path');
const fs        = require('fs');
const { execFileSync } = require('child_process');

const SCENARIOS_DIR = path.join(__dirname, '..', 'scripts', 'scenarios');

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
    const loaderPath = path.join(__dirname, '..', 'scripts', 'load-scenario.js');
    const output = execFileSync('node', [loaderPath, name], {
      encoding: 'utf-8',
      timeout: 15000                // 15 s safety cap
    });

    res.json({ success: true, scenario: name, output: output.trim() });
  } catch (err) {
    console.error(`POST /scenarios/load/${name}:`, err.stderr || err.message);
    res.status(500).json({
      success: false,
      message: `Failed to load scenario "${name}"`,
      error: err.stderr ? err.stderr.trim() : err.message
    });
  }
});

module.exports = router;
