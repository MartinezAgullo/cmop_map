#!/usr/bin/env node
// scripts/generate-mascal.js
//
// Generate a random MASCAL scenario around a preset city or a custom point and load it.
// Nothing is written to disk: the same seed and counts give the same scenario again.
//
// Usage:
//   node scripts/generate-mascal.js --preset paris --casualties 30 --evacuators 12 \
//        --facilities 4 [--radius-km 4] [--seed 42]
//   node scripts/generate-mascal.js --lat 48.6 --lng 2.34 --casualties 20 --evacuators 8
//   node scripts/generate-mascal.js --presets          list the preset centres
//
// Loading truncates the tables, and then tells the planner (MEDEVAC_PLANNER_URL, default
// :8400) as the map's Random button does: without that, a running planner keeps the old
// scenario's plan and never looks at the new casualties.
// ---------------------------------------------------------------------------

const { PRESETS, generateMascalScenario } = require('../lib/mascal-generator');
const { loadScenarioData } = require('../lib/scenario-loader');

const FLAGS = {
  '--preset': 'preset',
  '--lat': 'lat',
  '--lng': 'lng',
  '--casualties': 'n_casualties',
  '--evacuators': 'n_evacuators',
  '--facilities': 'n_medical_facilities',
  '--radius-km': 'radius_km',
  '--seed': 'seed',
};

function parseArgs(argv) {
  const options = {};
  const switches = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (FLAGS[flag]) {
      options[FLAGS[flag]] = argv[i + 1];
      i += 1;
    } else if (flag === '--presets' || flag === '--help') {
      switches.add(flag);
    } else {
      throw new Error(`unknown argument "${flag}"`);
    }
  }
  return { options, switches };
}

/** Fire-and-forget POST /scenario/loaded: a planner that is down must not fail the load. */
async function notifyPlanner(name) {
  const base = (process.env.MEDEVAC_PLANNER_URL || 'http://localhost:8400').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/scenario/loaded`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: name }),
      signal: AbortSignal.timeout(3000),
    });
    console.log(res.ok ? `   planner notified (${base})`
                       : `⚠️  planner answered ${res.status} to /scenario/loaded`);
  } catch (err) {
    console.log(`⚠️  planner not notified (${base} unreachable): replan it once it is up`);
  }
}

async function main() {
  const { options, switches } = parseArgs(process.argv.slice(2));

  if (switches.has('--help')) {
    console.log(require('fs').readFileSync(__filename, 'utf-8').split('\n').slice(2, 15)
      .map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
    return;
  }
  if (switches.has('--presets')) {
    for (const [key, p] of Object.entries(PRESETS)) {
      console.log(`  ${key.padEnd(10)} ${p.label.padEnd(14)} ${p.lat}, ${p.lng}`);
    }
    return;
  }

  const scenario = generateMascalScenario(options);
  console.log(`\n🎲 ${scenario.meta.description}`);

  // Required here, not at the top: --help and --presets must work without a database.
  const pool = require('../config/database');
  try {
    const counts = await loadScenarioData(pool, scenario);
    console.log(`   loaded ${counts.entities} entities and ${counts.medicalRecords} medical records`);
  } finally {
    await pool.end();
  }
  await notifyPlanner(scenario.meta.name);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
