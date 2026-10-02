// lib/scenario-files.js
//
// Scenario modules on disk: where they live and how a name is validated.
// ---------------------------------------------------------------------------

const path = require('path');

const SCENARIOS_DIR = path.join(__dirname, '..', 'scripts', 'scenarios');

// Scenario names become file names and shell arguments, so they are kept to a safe alphabet.
const SAFE_NAME = /^[A-Za-z0-9_-]{1,80}$/;

function scenarioPath(name) {
  if (!SAFE_NAME.test(name)) throw new RangeError(`invalid scenario name "${name}"`);
  return path.join(SCENARIOS_DIR, `${name}.js`);
}

module.exports = { SCENARIOS_DIR, scenarioPath };
