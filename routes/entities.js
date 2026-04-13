// routes/entities.js
//
// REST endpoints for CMOP entities.
// Contract is backward-compatible with the original /api/puntos routes.
// All responses now transparently include `medical: { ... } | null`.
// ---------------------------------------------------------------------------

const express = require('express');
const router  = express.Router();
const Entity  = require('../models/entity');

// ---------------------------------------------------------------------------
// Planner threat notification — fire-and-forget, never blocks the response
// ---------------------------------------------------------------------------
const PLANNER_BASE = (process.env.MEDEVAC_PLANNER_URL || 'http://localhost:8400').replace(/\/$/, '');

function _notifyThreat(entity) {
  const lat  = entity.lat  ?? entity.latitud;
  const lng  = entity.lng  ?? entity.longitud;
  const name = entity.name ?? entity.nombre ?? `Entity-${entity.id}`;
  if (lat == null || lng == null) return;
  fetch(`${PLANNER_BASE}/threats/notify`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ lat: Number(lat), lng: Number(lng), name, id: entity.id }),
  }).catch(err => {
    console.warn(`[entities] Threat notify skipped (planner unreachable): ${err.message}`);
  });
}

function _notifyNewCasualty(entity) {
  const lat  = entity.lat  ?? entity.latitud;
  const lng  = entity.lng  ?? entity.longitud;
  const name = entity.name ?? entity.nombre ?? `Entity-${entity.id}`;
  if (lat == null || lng == null) return;
  const medical = entity.medical ?? {};
  fetch(`${PLANNER_BASE}/casualties/notify`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      id:           entity.id,
      name,
      lat:          Number(lat),
      lng:          Number(lng),
      triage_color: medical.triage_color ?? null,
      evac_priority: medical.evac_priority ?? null,
    }),
  }).catch(err => {
    console.warn(`[entities] Casualty notify skipped (planner unreachable): ${err.message}`);
  });
}

// ---------------------------------------------------------------------------
// GET  /api/entities              — all entities
// GET  /api/entities/:id          — single entity
// GET  /api/entities/categoria/:c — filter by category
// GET  /api/entities/alliance/:a  — filter by alliance (friendly|hostile|neutral|unknown)
// GET  /api/entities/cerca/:lng/:lat?radio=N — spatial radius
// GET  /api/entities/meta/categorias — enum values
// POST /api/entities              — create (with optional medical)
// POST /api/entities/batch        — bulk create (transactional)
// PUT  /api/entities/:id          — partial update (with optional medical)
// DELETE /api/entities/:id        — delete (medical cascades)
// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
  try {
    const data = await Entity.getAll();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('GET /entities:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch entities', error: err.message });
  }
});

router.get('/meta/categorias', async (req, res) => {
  try {
    const data = await Entity.getCategorias();
    res.json({ success: true, data });
  } catch (err) {
    console.error('GET /entities/meta/categorias:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: err.message });
  }
});

router.get('/categoria/:categoria', async (req, res) => {
  try {
    const data = await Entity.getByCategoria(req.params.categoria);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('GET /entities/categoria:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch by category', error: err.message });
  }
});

router.get('/alliance/:alliance', async (req, res) => {
  const valid = ['friendly', 'hostile', 'neutral', 'unknown'];
  if (!valid.includes(req.params.alliance)) {
    return res.status(400).json({ success: false, message: `Invalid alliance. Use one of: ${valid.join(', ')}` });
  }
  try {
    const data = await Entity.getByAlliance(req.params.alliance);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('GET /entities/alliance:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch by alliance', error: err.message });
  }
});

router.get('/cerca/:longitud/:latitud', async (req, res) => {
  try {
    const lng   = parseFloat(req.params.longitud);
    const lat   = parseFloat(req.params.latitud);
    const radio = parseInt(req.query.radio, 10) || 50000;

    if (isNaN(lng) || isNaN(lat)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const data = await Entity.getNearby(lng, lat, radio);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('GET /entities/cerca:', err);
    res.status(500).json({ success: false, message: 'Spatial query failed', error: err.message });
  }
});

router.get('/casevac', async (req, res) => {
  try {
    const data = await Entity.getCasevacEligible();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('GET /entities/casevac:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch casevac-eligible entities', error: err.message });
  }
});

// /meta/categorias must be declared before /:id to avoid Express matching
// "meta" as an id.  It is already above.  Same logic: /:id is last.
router.get('/:id', async (req, res) => {
  try {
    const entity = await Entity.getById(req.params.id);
    if (!entity) {
      return res.status(404).json({ success: false, message: 'Entity not found' });
    }
    res.json({ success: true, data: entity });
  } catch (err) {
    console.error('GET /entities/:id:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch entity', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

router.post('/', async (req, res) => {
  try {
    const { longitud, latitud } = req.body;
    if (longitud == null || latitud == null) {
      return res.status(400).json({ success: false, message: 'longitud and latitud are required' });
    }

    const entity = await Entity.create(req.body);
    if (entity.alliance === 'hostile') _notifyThreat(entity);
    if (entity.categoria === 'casualty') _notifyNewCasualty(entity);
    res.status(201).json({ success: true, data: entity });
  } catch (err) {
    console.error('POST /entities:', err);
    res.status(500).json({ success: false, message: 'Failed to create entity', error: err.message });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { entities } = req.body;
    if (!Array.isArray(entities) || entities.length === 0) {
      return res.status(400).json({ success: false, message: 'entities array is required and must be non-empty' });
    }

    const data = await Entity.createBatch(entities);
    res.status(201).json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('POST /entities/batch:', err);
    res.status(500).json({ success: false, message: 'Batch create failed', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const entity = await Entity.update(req.params.id, req.body);
    if (!entity) {
      return res.status(404).json({ success: false, message: 'Entity not found' });
    }
    if (entity.alliance === 'hostile') _notifyThreat(entity);
    res.json({ success: true, data: entity });
  } catch (err) {
    console.error('PUT /entities/:id:', err);
    res.status(500).json({ success: false, message: 'Failed to update entity', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Entity.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Entity not found' });
    }
    res.json({ success: true, message: 'Entity deleted' });
  } catch (err) {
    console.error('DELETE /entities/:id:', err);
    res.status(500).json({ success: false, message: 'Failed to delete entity', error: err.message });
  }
});

module.exports = router;