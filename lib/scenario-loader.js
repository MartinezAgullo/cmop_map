// lib/scenario-loader.js
//
// Writes a scenario held in memory, `{ meta, entities, medicalDetails }`, into the database.
// One transaction: TRUNCATE medical_details and puntos_interes, bulk-insert the entities
// (building elemento_identificado → id), then the medical records that refer to them, and
// record which scenario the tables now hold (loaded_scenario). A failure rolls back and
// changes nothing.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Insert helpers
// ---------------------------------------------------------------------------

/**
 * Insert entities into puntos_interes.
 * Returns Map<elemento_identificado, id> for downstream FK resolution.
 *
 * 16 flat params per row:
 *   nombre, descripcion, categoria, country, alliance,
 *   elemento_identificado, activo, tipo_elemento,
 *   observaciones, altitud, casevac_eligible, mobility, capacity, status, lng, lat
 */
async function insertEntities(client, entities) {
  const PARAMS_PER_ROW = 16;

  const values = entities.flatMap(e => [
    e.nombre,
    e.descripcion                                          ?? null,
    e.categoria,
    e.country                                              ?? null,
    e.alliance                                             ?? 'unknown',
    e.elemento_identificado                                ?? null,
    e.activo !== undefined ? e.activo                      : true,
    e.tipo_elemento                                        ?? null,
    e.observaciones                                        ?? null,
    e.altitud                                              ?? null,
    e.casevac_eligible                                     ?? false,
    e.mobility                                             ?? null,
    e.capacity                                             ?? null,
    e.status                                               ?? null,
    e.lng,
    e.lat
  ]);

  const rows = entities.map((_, i) => {
    const b = i * PARAMS_PER_ROW;
    return `(
      $${b+1}, $${b+2}, $${b+3}::categoria_militar,
      $${b+4}, $${b+5}::alliance_enum,
      $${b+6}, $${b+7}, $${b+8}, $${b+9}, $${b+10}, $${b+11}, $${b+12}::mobility_enum, $${b+13},
      $${b+14}::asset_status_enum,
      ST_SetSRID(ST_MakePoint($${b+15}, $${b+16}), 4326)
    )`;
  });

  const query = `
    INSERT INTO puntos_interes (
      nombre, descripcion, categoria, country, alliance,
      elemento_identificado, activo, tipo_elemento,
      observaciones, altitud, casevac_eligible, mobility, capacity, status, geom
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
 * 11 flat params per row:
 *   entity_id, triage_color, casualty_status, injury_mechanism, primary_injury,
 *   vital_signs, prehospital_treatment, evac_priority, evac_stage,
 *   destination_facility_id, nine_line_data
 */
async function insertMedicalDetails(client, medicalDetails, refMap) {
  if (!medicalDetails || medicalDetails.length === 0) return;

  const PARAMS_PER_ROW = 11;

  const values = medicalDetails.flatMap(m => {
    const entityId = refMap.get(m.entity_ref);
    if (!entityId) throw new Error(`entity_ref "${m.entity_ref}" not found in loaded entities`);

    let destId = null;
    if (m.destination_facility_ref) {
      destId = refMap.get(m.destination_facility_ref) ?? null;
      if (destId === null) {
        console.warn(`⚠️  destination_facility_ref "${m.destination_facility_ref}" (entity_ref: "${m.entity_ref}") not found in loaded entities — set to NULL`);
      }
    }

    return [
      entityId,
      m.triage_color            ?? 'UNKNOWN',
      m.casualty_status         ?? 'UNKNOWN',
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
      $${b+3}::casualty_status_enum,
      $${b+4}, $${b+5},
      $${b+6}::jsonb,
      $${b+7},
      $${b+8}::evac_priority_enum,
      $${b+9}::evac_stage_enum,
      $${b+10},
      $${b+11}::jsonb
    )`;
  });

  const query = `
    INSERT INTO medical_details (
      entity_id, triage_color, casualty_status, injury_mechanism, primary_injury,
      vital_signs, prehospital_treatment, evac_priority, evac_stage,
      destination_facility_id, nine_line_data
    )
    VALUES ${rows.join(',')}
  `;

  await client.query(query, values);
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/** Replace the one loaded_scenario row: the tables now hold `meta.name`. */
async function recordLoadedScenario(client, meta) {
  await client.query('DELETE FROM loaded_scenario');
  await client.query('INSERT INTO loaded_scenario (name, meta) VALUES ($1, $2::jsonb)',
                     [meta.name, JSON.stringify(meta)]);
}

/** The scenario the tables were last loaded from, or null before the first load. */
async function readLoadedScenario(pool) {
  const { rows } = await pool.query('SELECT name, meta, loaded_at FROM loaded_scenario');
  return rows[0] || null;
}

/**
 * Replace everything in the database with `scenario`, using a client taken from `pool`.
 * @returns {Promise<{ entities: number, medicalRecords: number }>}
 */
async function loadScenarioData(pool, { meta, entities, medicalDetails }) {
  if (!meta?.name) throw new Error('a scenario must carry meta.name');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE medical_details CASCADE');
    await client.query('TRUNCATE puntos_interes  CASCADE');
    const refMap = await insertEntities(client, entities);
    await insertMedicalDetails(client, medicalDetails, refMap);
    await recordLoadedScenario(client, meta);
    await client.query('COMMIT');
    return { entities: entities.length, medicalRecords: medicalDetails?.length ?? 0 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { loadScenarioData, readLoadedScenario };
