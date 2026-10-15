// routes/entities.js
//
// REST endpoints for CMOP entities.
// Contract is backward-compatible with the original /api/puntos routes.
// All responses now transparently include `medical: { ... } | null`.
// ---------------------------------------------------------------------------

const express    = require('express');
const router     = express.Router();
const Entity     = require('../models/entity');
const sseBroker  = require('../lib/sse-broker');
const services   = require('../config/services');
const { createNotifier } = require('../lib/notifier');
const log        = require('../lib/logger').child('entities');
const { sendError } = require('../lib/db-error');
const { capacityLimit, capacityProblem } = require('../lib/capacity-limits');

// Answers 400 when an entity's capacities are not accepted (a vehicle over its limit,
// a facility's occupancy above its places) and says whether it did. A vehicle over its
// limit is also logged as a warning: someone tried to declare an impossible vehicle.
function refuseCapacity(res, entity, label = '') {
  const problem = capacityProblem(entity);
  if (!problem) return false;
  const message = label ? `${label}: ${problem.message}` : problem.message;
  if (problem.rejected) log.warn(message);
  res.status(400).json({ success: false, message, field: problem.field });
  return true;
}

// Fields that change what capacityProblem checks on an update.
const CAPACITY_FIELDS = ['capacity', 'mobility', 'categoria', 'max_capacity', 'occupancy'];

// ---------------------------------------------------------------------------
// Planner / PFC-agent notifications — fire-and-forget, never block the response
// ---------------------------------------------------------------------------
const planner  = createNotifier({ service: 'planner',   baseUrl: services.planner,  logger: log });
const pfcAgent = createNotifier({ service: 'pfc_agent', baseUrl: services.pfcAgent, logger: log });

function _notifyThreat(entity) {
  const lat  = entity.lat  ?? entity.latitud;
  const lng  = entity.lng  ?? entity.longitud;
  const name = entity.name ?? entity.nombre ?? `Entity-${entity.id}`;
  if (lat == null || lng == null) return;
  planner('/threats/notify', { lat: Number(lat), lng: Number(lng), name, id: entity.id });
}

function _notifyNewCasualty(entity) {
  const lat  = entity.lat  ?? entity.latitud;
  const lng  = entity.lng  ?? entity.longitud;
  const name = entity.name ?? entity.nombre ?? `Entity-${entity.id}`;
  if (lat == null || lng == null) return;
  const medical = entity.medical ?? {};
  const payload = {
    id:            entity.id,
    name,
    lat:           Number(lat),
    lng:           Number(lng),
    triage_color:    medical.triage_color    ?? null,
    casualty_status: medical.casualty_status ?? null,
    evac_priority:   medical.evac_priority   ?? null,
  };
  planner('/casualties/notify', payload);
  // Also notify pfc_agent so it can spawn a PFC session as a safety-net
  // (in case the planner is slow or offline when the casualty is created).
  pfcAgent('/casualties/notify', payload);
}

// A civilian group was created or changed (its headcount, its place): the planner
// gives it a shelter and vehicles. Shares the casualty debounce on the planner side.
function _notifyCivilians(entity) {
  const lat = entity.lat ?? entity.latitud;
  const lng = entity.lng ?? entity.longitud;
  if (lat == null || lng == null) return;
  planner('/civilians/notify', {
    id:        entity.id,
    name:      entity.name ?? entity.nombre ?? `Entity-${entity.id}`,
    lat:       Number(lat),
    lng:       Number(lng),
    headcount: entity.headcount ?? 1,
  });
}

// A platform's operational status changed (a breakdown, or back in service). Sent on
// the change only: the movement simulation PUTs vehicle positions every second, and
// the planner reassigns casualties on each of these.
function _notifyAssetStatus(entity, previousStatus) {
  planner('/assets/status', {
    id:              entity.id,
    name:            entity.nombre ?? `Entity-${entity.id}`,
    status:          entity.status ?? 'operational',
    previous_status: previousStatus ?? 'operational',
    lat:             entity.latitud,
    lng:             entity.longitud,
    tipo_elemento:   entity.tipo_elemento ?? null,   // its care level, for the planner's log
  });
}

// ---------------------------------------------------------------------------
// GET  /api/entities              — all entities
// GET  /api/entities/:id          — single entity
// GET  /api/entities/categoria/:c — filter by category
// GET  /api/entities/alliance/:a  — filter by alliance (friendly|hostile|neutral|unknown)
// GET  /api/entities/cerca/:lng/:lat?radio=N — spatial radius
// GET  /api/entities/meta/categorias — enum values
// GET  /api/entities/meta/capacity-limit?categoria=&mobility=[&capacity=] — a vehicle's maximum capacity
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
    await sendError(res, log, err, 'Failed to fetch entities');
  }
});

router.get('/meta/categorias', async (req, res) => {
  try {
    const data = await Entity.getCategorias();
    res.json({ success: true, data });
  } catch (err) {
    await sendError(res, log, err, 'Failed to fetch categories');
  }
});

// The New Entity form asks for the limit of the vehicle being created, so the table
// stays in lib/capacity-limits.js alone. With `capacity` it also checks that value and
// returns the refusal, logged here as a warning: the form never sends a refused
// capacity on to POST, so this is where an over-limit entry is recorded.
router.get('/meta/capacity-limit', (req, res) => {
  const vehicle = { categoria: req.query.categoria, mobility: req.query.mobility || undefined };
  const rule = capacityLimit(vehicle);
  let problem = null;
  if (req.query.capacity !== undefined) {
    problem = capacityProblem({ ...vehicle, capacity: req.query.capacity });
    if (problem?.rejected) log.warn(problem.message);
  }
  res.json({ success: true, data: { max: rule.max, vehicle: rule.vehicle, problem: problem?.message ?? null } });
});

router.get('/categoria/:categoria', async (req, res) => {
  try {
    const data = await Entity.getByCategoria(req.params.categoria);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    await sendError(res, log, err, 'Failed to fetch by category');
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
    await sendError(res, log, err, 'Failed to fetch by alliance');
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
    await sendError(res, log, err, 'Spatial query failed');
  }
});

router.get('/casevac', async (req, res) => {
  try {
    const data = await Entity.getCasevacEligible();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    await sendError(res, log, err, 'Failed to fetch casevac-eligible entities');
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
    await sendError(res, log, err, 'Failed to fetch entity');
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
    if (refuseCapacity(res, req.body)) return;

    const entity = await Entity.create(req.body);
    if (entity.alliance === 'hostile') _notifyThreat(entity);
    if (entity.categoria === 'casualty') _notifyNewCasualty(entity);
    if (entity.categoria === 'civilian') _notifyCivilians(entity);
    sseBroker.broadcast({ type: 'entity_created', data: entity });
    res.status(201).json({ success: true, data: entity });
  } catch (err) {
    await sendError(res, log, err, 'Failed to create entity');
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { entities } = req.body;
    if (!Array.isArray(entities) || entities.length === 0) {
      return res.status(400).json({ success: false, message: 'entities array is required and must be non-empty' });
    }
    for (const e of entities) {
      if (refuseCapacity(res, e, e.nombre ?? e.elemento_identificado ?? 'entity')) return;
    }

    const data = await Entity.createBatch(entities);
    data.forEach(entity => {
      sseBroker.broadcast({ type: 'entity_created', data: entity });
      if (entity.alliance === 'hostile') _notifyThreat(entity);
      if (entity.categoria === 'casualty') _notifyNewCasualty(entity);
      if (entity.categoria === 'civilian') _notifyCivilians(entity);
    });
    res.status(201).json({ success: true, count: data.length, data });
  } catch (err) {
    await sendError(res, log, err, 'Batch create failed');
  }
});

const ASSET_STATUSES = ['operational', 'damaged'];

router.put('/:id', async (req, res) => {
  try {
    // A point needs both halves.  ST_MakePoint(lng, NULL) is NULL, so a
    // half-supplied coordinate used to keep the old position silently.
    const { longitud, latitud } = req.body;
    if ((longitud == null) !== (latitud == null)) {
      return res.status(400).json({
        success: false,
        message: 'longitud and latitud must be supplied together'
      });
    }
    if (req.body.status !== undefined && !ASSET_STATUSES.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${ASSET_STATUSES.join(', ')}`
      });
    }

    // Read the entity before the change only when the body carries a status or a
    // capacity, so the simulation's position PUTs cost no extra query.
    const statusSent   = req.body.status !== undefined;
    const capacitySent = CAPACITY_FIELDS.some(k => req.body[k] !== undefined);
    const before = statusSent || capacitySent ? await Entity.getById(req.params.id) : null;
    if (capacitySent && before && refuseCapacity(res, { ...before, ...req.body })) return;

    const entity = await Entity.update(req.params.id, req.body);
    if (!entity) {
      return res.status(404).json({ success: false, message: 'Entity not found' });
    }
    // A PUT carrying only a position is no news for the planner: the movement
    // simulation sends one per casualty per second while it is carried, and each
    // used to restart the planner's replan debounce until the delivery.
    const positionOnly = Object.keys(req.body).every(k => k === 'latitud' || k === 'longitud');
    if (entity.alliance === 'hostile') _notifyThreat(entity);
    if (entity.categoria === 'casualty' && !positionOnly) _notifyNewCasualty(entity);
    if (entity.categoria === 'civilian' && !positionOnly) _notifyCivilians(entity);
    const statusChanged = statusSent && (before?.status ?? 'operational') !== (entity.status ?? 'operational');
    if (statusChanged) _notifyAssetStatus(entity, before?.status);
    sseBroker.broadcast({
      type: 'entity_updated',
      id:   entity.id,
      lat:  entity.latitud,
      lng:  entity.longitud,
    });
    // A status change also changes the icon and the popup: every open map redraws it.
    if (statusChanged) sseBroker.broadcast({ type: 'entity_changed', data: entity });
    res.json({ success: true, data: entity });
  } catch (err) {
    await sendError(res, log, err, 'Failed to update entity');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Entity.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Entity not found' });
    }
    sseBroker.broadcast({ type: 'entity_deleted', id: Number(req.params.id) });
    res.json({ success: true, message: 'Entity deleted' });
  } catch (err) {
    await sendError(res, log, err, 'Failed to delete entity');
  }
});

module.exports = router;