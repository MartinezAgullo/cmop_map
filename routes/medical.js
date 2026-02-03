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
//   PUT  /api/medical/:entity_id              — partial update of medical fields
//   POST /api/medical/:entity_id/vitals       — append a vital-signs reading
//   DELETE /api/medical/:entity_id            — remove the medical record (entity stays)
// ---------------------------------------------------------------------------

const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const Entity  = require('../models/entity');

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

/** Casualties filtered by triage colour (RED, YELLOW, GREEN, BLACK, UNKNOWN) */
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
 */
router.put('/:entity_id', async (req, res) => {
  try {
    const id = parseInt(req.params.entity_id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'entity_id must be an integer' });
    }

    // Verify entity exists
    const entity = await Entity.getById(id);
    if (!entity) {
      return res.status(404).json({ success: false, message: 'Entity not found' });
    }

    // Delegate to the same upsert used by Entity.create / Entity.update
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

    // Return full updated entity
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

    // Append to existing array (or create new array) using JSONB operators.
    // Also ensures a medical_details row exists (INSERT ... ON CONFLICT).
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
