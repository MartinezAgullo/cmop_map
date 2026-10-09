#!/usr/bin/env node
// scripts/load-scenario.js
//
// Usage:
//   node scripts/load-scenario.js <scenario_name>   — load a scenario
//   node scripts/load-scenario.js --list            — list available scenarios
//
// Requires scripts/scenarios/<n>.js → { meta, entities, medicalDetails } and hands it to
// lib/scenario-loader.js, which replaces the database contents in one transaction.
// ---------------------------------------------------------------------------

const path = require('path');
const fs   = require('fs');
const pool = require('../config/database');
const { loadScenarioData } = require('../lib/scenario-loader');

const SCENARIOS_DIR = path.join(__dirname, 'scenarios');

// ---------------------------------------------------------------------------
// List helpers
// ---------------------------------------------------------------------------

function listScenarios() {
  return fs.readdirSync(SCENARIOS_DIR)
    .filter(f => f.endsWith('.js') && f !== 'index.js')
    .map(f => f.replace('.js', ''))
    .sort();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const arg = process.argv[2];

  if (arg === '--list') {
    const scenarios = listScenarios();
    console.log(scenarios.length
      ? 'Available scenarios:\n' + scenarios.map(s => `  • ${s}`).join('\n')
      : 'No scenarios found in scripts/scenarios/');
    process.exit(0);
  }

  if (!arg) {
    console.error('Usage:\n  node scripts/load-scenario.js <scenario_name>\n  node scripts/load-scenario.js --list');
    process.exit(1);
  }

  const scenarioPath = path.join(SCENARIOS_DIR, `${arg}.js`);
  if (!fs.existsSync(scenarioPath)) {
    console.error(`Scenario "${arg}" not found. Run with --list to see available scenarios.`);
    process.exit(1);
  }

  const { meta, entities, medicalDetails } = require(scenarioPath);

  console.log(`\n🎬 Loading scenario: ${meta.name}`);
  console.log(`   ${meta.description}`);
  console.log(`   Entities: ${entities.length} | Medical records: ${medicalDetails?.length ?? 0}\n`);

  try {
    const counts = await loadScenarioData(pool, { meta, entities, medicalDetails });
    console.log('🗑️  Tables cleared');
    console.log(`✅ ${counts.entities} entities inserted`);
    if (counts.medicalRecords > 0) console.log(`✅ ${counts.medicalRecords} medical records inserted`);
    console.log('\n🎉 Scenario loaded successfully\n');
  } catch (error) {
    console.error('❌ Load failed (rolled back):', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();