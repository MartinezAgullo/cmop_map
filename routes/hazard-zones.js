// routes/hazard-zones.js
//
// Hazard zones (floods, fires and other disasters): areas that ground routes avoid
// and that trap the civilians inside them. One row per event; its geometry is a
// MultiPolygon whose parts may lie apart. See models/hazard-zone.js for the shape.
//
// Routes:
//   GET    /api/hazard-zones                 — all zones (?type=flood, ?active=true)
//   GET    /api/hazard-zones/meta/types      — the hazard types with labels and colours
//   GET    /api/hazard-zones/:id             — one zone
//   POST   /api/hazard-zones                 — create { name, hazard_type, geometry, description?, active? }
//   PUT    /api/hazard-zones/:id             — partial update; a geometry replaces the old one whole
//   DELETE /api/hazard-zones/:id             — delete
//
// Every write is broadcast over SSE (hazard_zone_changed / hazard_zone_deleted) so
// open maps redraw without polling.
// ---------------------------------------------------------------------------

const express    = require('express');
const router     = express.Router();
const pool       = require('../config/database');
const HazardZone = require('../models/hazard-zone');
const sseBroker  = require('../lib/sse-broker');
const log        = require('../lib/logger').child('hazard-zones');
const { sendError }      = require('../lib/db-error');
const { HAZARD_TYPES, HAZARD_TYPE_VALUES } = require('../lib/hazard-types');
const { parseZoneInput } = require('../lib/hazard-zone-input');

function parseId(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ success: false, message: 'id must be an integer' });
    return null;
  }
  return id;
}

function badInput(res, errors) {
  return res.status(400).json({ success: false, message: errors.join('; '), errors });
}

router.get('/', async (req, res) => {
  try {
    const { type, active } = req.query;
    if (type && !HAZARD_TYPE_VALUES.includes(type)) {
      return badInput(res, [`type must be one of ${HAZARD_TYPE_VALUES.join(', ')}`]);
    }
    const rows = await HazardZone.list(pool, {
      type,
      active: active === undefined ? undefined : active === 'true',
    });
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    await sendError(res, log, err, 'Failed to fetch hazard zones');
  }
});

router.get('/meta/types', (req, res) => {
  res.json({ success: true, data: HAZARD_TYPES });
});

router.get('/:id', async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  try {
    const zone = await HazardZone.getById(pool, id);
    if (!zone) return res.status(404).json({ success: false, message: 'Hazard zone not found' });
    res.json({ success: true, data: zone });
  } catch (err) {
    await sendError(res, log, err, 'Failed to fetch hazard zone');
  }
});

router.post('/', async (req, res) => {
  const { data, errors } = parseZoneInput(req.body);
  if (errors.length) return badInput(res, errors);
  try {
    const zone = await HazardZone.create(pool, data);
    log.info(`Hazard zone ${zone.id} "${zone.name}" (${zone.hazard_type}) created`);
    sseBroker.broadcast({ type: 'hazard_zone_changed', data: zone });
    res.status(201).json({ success: true, data: zone });
  } catch (err) {
    await sendError(res, log, err, 'Failed to create hazard zone');
  }
});

router.put('/:id', async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const { data, errors } = parseZoneInput(req.body, { partial: true });
  if (errors.length) return badInput(res, errors);
  try {
    const zone = await HazardZone.update(pool, id, data);
    if (!zone) return res.status(404).json({ success: false, message: 'Hazard zone not found' });
    sseBroker.broadcast({ type: 'hazard_zone_changed', data: zone });
    res.json({ success: true, data: zone });
  } catch (err) {
    await sendError(res, log, err, 'Failed to update hazard zone');
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  try {
    if (!(await HazardZone.remove(pool, id))) {
      return res.status(404).json({ success: false, message: 'Hazard zone not found' });
    }
    sseBroker.broadcast({ type: 'hazard_zone_deleted', id });
    res.json({ success: true, id });
  } catch (err) {
    await sendError(res, log, err, 'Failed to delete hazard zone');
  }
});

module.exports = router;
