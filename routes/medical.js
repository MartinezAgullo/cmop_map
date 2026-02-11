// routes/medical.js
//
// Endpoints dedicated to medical_details operations.
// These are designed to be called by the cmop_fusion_mcp agents.
//
// All mutation endpoints return the full entity shape (with the
// updated medical object) so the caller has a single source of truth
// after the operation — no need for a follow-up GET.
//
// Routes:
//   GET  /api/medical/casualties              — all entities that have a medical record
//   GET  /api/medical/triage/:color           — casualties filtered by triage colour
//   GET  /api/medical/evac-stage/:stage       — casualties filtered by evac stage
//   GET  /api/medical/:entity_id/nine-line    — get the 9-Line MEDEVAC data for an entity
//   PUT  /api/medical/:entity_id              — partial update of medical fields
//   POST /api/medical/:entity_id/vitals       — append a vital-signs reading
//   POST /api/medical/:entity_id/nine-line    — create or replace the 9-Line MEDEVAC data
//   DELETE /api/medical/:entity_id            — remove the medical record (entity stays)
// ---------------------------------------------------------------------------

const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const Entity  = require('../models/entity');

// ---------------------------------------------------------------------------
// 9-Line MEDEVAC validation
// ---------------------------------------------------------------------------

/** Valid enum values for each coded 9-Line field */
const NINE_LINE_ENUMS = {
  line3_precedence:  ['A', 'B', 'C', 'D'],
  line4_special_eqpt:['A', 'B', 'C', 'D'],
  line6_security:    ['N', 'P', 'E', 'X'],
  line7_marking:     ['A', 'B', 'C', 'D', 'E'],
  line8_nationality: ['A', 'B', 'C', 'D', 'E'],
  line9_nbc:         ['N', 'B', 'C']
};

/**
 * Validate a nine_line_data object.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 *
 * Validation is lenient: only supplied fields are checked.
 * Required fields are only enforced when `strict` is true (e.g. for
 * a complete 9-Line submission via POST /nine-line).
 */
function validateNineLineData(data, strict = false) {
  const errors = [];

  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['nine_line_data must be a non-null object'] };
  }

  // Required fields (only in strict mode)
  if (strict) {
    const required = [
      'line1_location', 'line2_callsign', 'line2_frequency',
      'line3_precedence', 'line3_count', 'line4_special_eqpt',
      'line5_litter', 'line5_ambulatory', 'line7_marking',
      'line8_nationality'
    ];
    for (const field of required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Type checks for string fields
  const stringFields = [
    'line1_location', 'line2_callsign', 'line2_frequency',
    'line3_precedence', 'line4_special_eqpt', 'line6_security',
    'line6_peacetime_info', 'line7_marking', 'line7_marking_detail',
    'line8_nationality', 'line9_nbc', 'line9_terrain_desc', 'remarks'
  ];
  for (const field of stringFields) {
    if (data[field] !== undefined && data[field] !== null && typeof data[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  // Type checks for numeric fields
  const numericFields = ['line3_count', 'line5_litter', 'line5_ambulatory'];
  for (const field of numericFields) {
    if (data[field] !== undefined && data[field] !== null && typeof data[field] !== 'number') {
      errors.push(`${field} must be a number`);
    }
  }

  // Enum value checks (only if the field is present and non-null)
  for (const [field, allowed] of Object.entries(NINE_LINE_ENUMS)) {
    if (data[field] !== undefined && data[field] !== null) {
      const val = typeof data[field] === 'string' ? data[field].toUpperCase() : data[field];
      if (!allowed.includes(val)) {
        errors.push(`${field}: invalid value "${data[field]}". Allowed: ${allowed.join(', ')}`);
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * All entities that have a medical_details record.
 * Uses the same baseSelect so the shape is identical to /api/entities.
 */
router.get('/casualties', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${Entity.baseSelect()} WHERE md.entity_id IS NOT NULL ORDER BY pi.nombre`
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('GET /medical/casualties:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch casualties', error: err.message });
  }
});

/** Casualties filtered by triage colour (RED, YELLOW, GREEN, BLUE, BLACK, UNKNOWN) */
router.get('/triage/:color', async (req, res) => {
  try {
    const color = req.params.color.toUpperCase();
    const { rows } = await pool.query(
      `${Entity.baseSelect()} WHERE md.triage_color = $1::triage_color_enum ORDER BY pi.nombre`,
      [color]
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('GET /medical/triage/:color:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch by triage color', error: err.message });
  }
});

/** Casualties filtered by evacuation stage (at_poi, in_transit, delivered, unknown) */
router.get('/evac-stage/:stage', async (req, res) => {
  try {
    const stage = req.params.stage.toLowerCase();
    const { rows } = await pool.query(
      `${Entity.baseSelect()} WHERE md.evac_stage = $1::evac_stage_enum ORDER BY pi.nombre`,
      [stage]
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('GET /medical/evac-stage/:stage:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch by evac stage', error: err.message });
  }
});

/**
 * Get the 9-Line MEDEVAC data for a specific entity.
 * Returns just the nine_line_data JSONB plus basic entity context.
 *
 *   GET /api/medical/42/nine-line
 */
router.get('/:entity_id/nine-line', async (req, res) => {
  try {
    const id = parseInt(req.params.entity_id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'entity_id must be an integer' });
    }

    const { rows } = await pool.query(
      `SELECT
         pi.id,
         pi.nombre,
         pi.categoria,
         pi.alliance,
         md.nine_line_data,
         md.triage_color,
         md.evac_priority,
         md.evac_stage,
         md.updated_at
       FROM puntos_interes pi
       LEFT JOIN medical_details md ON md.entity_id = pi.id
       WHERE pi.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Entity not found' });
    }

    const row = rows[0];
    res.json({
      success: true,
      data: {
        entity_id:      row.id,
        nombre:         row.nombre,
        categoria:      row.categoria,
        alliance:       row.alliance,
        triage_color:   row.triage_color,
        evac_priority:  row.evac_priority,
        evac_stage:     row.evac_stage,
        nine_line_data: row.nine_line_data || null,
        updated_at:     row.updated_at
      }
    });
  } catch (err) {
    console.error('GET /medical/:entity_id/nine-line:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch 9-Line data', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Partial update of the medical record for an entity.
 * Body: any subset of medical_details fields (snake_case).
 *
 *   PUT /api/medical/42
 *   { "evac_stage": "in_transit", "evac_priority": "URGENT" }
 *
 * If the entity has no medical record yet, one is created (upsert).
 * If nine_line_data is included, it is validated (non-strict) before saving.
 */
router.put('/:entity_id', async (req, res) => {
  try {
    const id = parseInt(req.params.entity_id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'entity_id must be an integer' });
    }

    const entity = await Entity.getById(id);
    if (!entity) {
      return res.status(404).json({ success: false, message: 'Entity not found' });
    }

    // Validate nine_line_data if present (non-strict: partial updates OK)
    if (req.body.nine_line_data) {
      const validation = validateNineLineData(req.body.nine_line_data, false);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid nine_line_data',
          errors: validation.errors
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await Entity._upsertMedical(client, id, req.body);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await Entity.getById(id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('PUT /medical/:entity_id:', err);
    res.status(500).json({ success: false, message: 'Failed to update medical record', error: err.message });
  }
});

/**
 * Append a single vital-signs reading to the existing array.
 *
 *   POST /api/medical/42/vitals
 *   { "hr": 110, "bp": "95/60", "spo2": 92, "recorded_at": "2026-02-02T18:10:00Z" }
 *
 * If vital_signs is NULL the array is initialised.
 * If the entity has no medical record yet, one is created with only vital_signs populated.
 */
router.post('/:entity_id/vitals', async (req, res) => {
  try {
    const id = parseInt(req.params.entity_id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'entity_id must be an integer' });
    }

    const entity = await Entity.getById(id);
    if (!entity) {
      return res.status(404).json({ success: false, message: 'Entity not found' });
    }

    const reading = {
      hr:          req.body.hr          ?? null,
      bp:          req.body.bp          ?? null,
      spo2:        req.body.spo2        ?? null,
      recorded_at: req.body.recorded_at ?? new Date().toISOString()
    };

    await pool.query(
      `INSERT INTO medical_details (entity_id, vital_signs)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (entity_id) DO UPDATE SET
         vital_signs = COALESCE(medical_details.vital_signs, '[]'::jsonb) || $2::jsonb,
         updated_at  = CURRENT_TIMESTAMP`,
      [id, JSON.stringify([reading])]
    );

    const updated = await Entity.getById(id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('POST /medical/:entity_id/vitals:', err);
    res.status(500).json({ success: false, message: 'Failed to append vital signs', error: err.message });
  }
});

/**
 * Create or fully replace the 9-Line MEDEVAC data for an entity.
 * Uses strict validation: all required fields must be present.
 *
 *   POST /api/medical/42/nine-line
 *   {
 *     "line1_location": "38TQK 1234 5678",
 *     "line2_callsign": "DUSTOFF 7-2",
 *     "line2_frequency": "243.0 MHz",
 *     "line3_precedence": "A",
 *     "line3_count": 1,
 *     "line4_special_eqpt": "A",
 *     "line5_litter": 1,
 *     "line5_ambulatory": 0,
 *     "line6_security": "N",
 *     "line7_marking": "C",
 *     "line7_marking_detail": "green smoke",
 *     "line8_nationality": "C",
 *     "remarks": "Requires immediate surgery"
 *   }
 *
 * If the entity has no medical record yet, one is created with nine_line_data.
 * Returns the full entity shape after update.
 */
router.post('/:entity_id/nine-line', async (req, res) => {
  try {
    const id = parseInt(req.params.entity_id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'entity_id must be an integer' });
    }

    const entity = await Entity.getById(id);
    if (!entity) {
      return res.status(404).json({ success: false, message: 'Entity not found' });
    }

    // Strict validation: all required 9-Line fields must be present
    const validation = validateNineLineData(req.body, true);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 9-Line MEDEVAC data',
        errors: validation.errors
      });
    }

    // Normalise enum codes to uppercase
    const nineLineData = { ...req.body };
    for (const field of Object.keys(NINE_LINE_ENUMS)) {
      if (nineLineData[field] && typeof nineLineData[field] === 'string') {
        nineLineData[field] = nineLineData[field].toUpperCase();
      }
    }

    // Upsert the medical record with only nine_line_data
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await Entity._upsertMedical(client, id, { nine_line_data: nineLineData });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await Entity.getById(id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('POST /medical/:entity_id/nine-line:', err);
    res.status(500).json({ success: false, message: 'Failed to save 9-Line data', error: err.message });
  }
});

/**
 * Remove the medical_details record.  The entity (puntos_interes) stays.
 * Useful when a casualty status is resolved or was entered by mistake.
 */
router.delete('/:entity_id', async (req, res) => {
  try {
    const id = parseInt(req.params.entity_id, 10);
    const { rowCount } = await pool.query(
      `DELETE FROM medical_details WHERE entity_id = $1`, [id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'No medical record found for this entity' });
    }
    res.json({ success: true, message: 'Medical record removed' });
  } catch (err) {
    console.error('DELETE /medical/:entity_id:', err);
    res.status(500).json({ success: false, message: 'Failed to delete medical record', error: err.message });
  }
});

module.exports = router;
