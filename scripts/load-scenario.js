#!/usr/bin/env node
// scripts/load-scenario.js
//
// Usage:
//   node scripts/load-scenario.js <scenario_name>   — load a scenario
//   node scripts/load-scenario.js --list            — list available scenarios
//
// Flow:
//   1. Require scripts/scenarios/<n>.js  →  { meta, entities, medicalDetails }
//   2. BEGIN transaction
//   3. TRUNCATE medical_details, puntos_interes  (CASCADE)
//   4. Bulk-insert entities  →  build refMap: elemento_identificado → id
//   5. Bulk-insert medicalDetails using refMap for FK resolution
//   6. COMMIT  (or ROLLBACK on any error)
// ---------------------------------------------------------------------------

const path = require('path');
const fs   = require('fs');
const pool = require('../config/database');

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
// Insert helpers
// ---------------------------------------------------------------------------

/**
 * Insert entities into puntos_interes.
 * Returns Map<elemento_identificado, id> for downstream FK resolution.
 *
 * 13 flat params per row:
 *   nombre, descripcion, categoria, country, alliance,
 *   elemento_identificado, activo, tipo_elemento, prioridad,
 *   observaciones, altitud, lng, lat
 */
async function insertEntities(client, entities) {
  const PARAMS_PER_ROW = 13;

  const values = entities.flatMap(e => [
    e.nombre,
    e.descripcion                                          ?? null,
    e.categoria,
    e.country                                              ?? null,
    e.alliance                                             ?? 'unknown',
    e.elemento_identificado                                ?? null,
    e.activo !== undefined ? e.activo                      : true,
    e.tipo_elemento                                        ?? null,
    e.prioridad                                            ?? 0,
    e.observaciones                                        ?? null,
    e.altitud                                              ?? null,
    e.lng,
    e.lat
  ]);

  const rows = entities.map((_, i) => {
    const b = i * PARAMS_PER_ROW;
    return `(
      $${b+1}, $${b+2}, $${b+3}::categoria_militar,
      $${b+4}, $${b+5}::alliance_enum,
      $${b+6}, $${b+7}, $${b+8}, $${b+9}, $${b+10}, $${b+11},
      ST_SetSRID(ST_MakePoint($${b+12}, $${b+13}), 4326)
    )`;
  });

  const query = `
    INSERT INTO puntos_interes (
      nombre, descripcion, categoria, country, alliance,
      elemento_identificado, activo, tipo_elemento, prioridad,
      observaciones, altitud, geom
    )
    VALUES ${rows.join(',')}
    RETURNING id, elemento_identificado;
  `;

  const result = await client.query(query, values);

  const refMap = new Map();
  for (const row of result.rows) {
    if (row.elemento_identificado) refMap.set(row.elemento_identificado, row.id);
  }
  return refMap;
}

/**
 * Insert medical_details rows.
 *   entity_ref              → resolved via refMap to entity_id  (required)
 *   destination_facility_ref → also resolved via refMap         (nullable)
 *
 * 10 flat params per row:
 *   entity_id, triage_color, injury_mechanism, primary_injury,
 *   vital_signs, prehospital_treatment, evac_priority, evac_stage,
 *   destination_facility_id, nine_line_data
 */
async function insertMedicalDetails(client, medicalDetails, refMap) {
  if (!medicalDetails || medicalDetails.length === 0) return;

  const PARAMS_PER_ROW = 10;

  const values = medicalDetails.flatMap(m => {
    const entityId = refMap.get(m.entity_ref);
    if (!entityId) throw new Error(`entity_ref "${m.entity_ref}" not found in loaded entities`);

    const destId = m.destination_facility_ref
      ? (refMap.get(m.destination_facility_ref) ?? null)
      : null;

    return [
      entityId,
      m.triage_color            ?? 'UNKNOWN',
      m.injury_mechanism        ?? null,
      m.primary_injury          ?? null,
      m.vital_signs             ? JSON.stringify(m.vital_signs)    : null,
      m.prehospital_treatment   ?? null,
      m.evac_priority           ?? 'UNKNOWN',
      m.evac_stage              ?? 'unknown',
      destId,
      m.nine_line_data          ? JSON.stringify(m.nine_line_data) : null
    ];
  });

  const rows = medicalDetails.map((_, i) => {
    const b = i * PARAMS_PER_ROW;
    return `(
      $${b+1},
      $${b+2}::triage_color_enum,
      $${b+3}, $${b+4},
      $${b+5}::jsonb,
      $${b+6},
      $${b+7}::evac_priority_enum,
      $${b+8}::evac_stage_enum,
      $${b+9},
      $${b+10}::jsonb
    )`;
  });

  const query = `
    INSERT INTO medical_details (
      entity_id, triage_color, injury_mechanism, primary_injury,
      vital_signs, prehospital_treatment, evac_priority, evac_stage,
      destination_facility_id, nine_line_data
    )
    VALUES ${rows.join(',')}
  `;

  await client.query(query, values);
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('TRUNCATE medical_details CASCADE');
    await client.query('TRUNCATE puntos_interes  CASCADE');
    console.log('🗑️  Tables cleared');

    const refMap = await insertEntities(client, entities);
    console.log(`✅ ${entities.length} entities inserted`);

    if (medicalDetails && medicalDetails.length > 0) {
      await insertMedicalDetails(client, medicalDetails, refMap);
      console.log(`✅ ${medicalDetails.length} medical records inserted`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 Scenario loaded successfully\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Load failed (rolled back):', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
