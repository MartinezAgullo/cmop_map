// lib/casualty-hooks.js
//
// What the planner and pfc_agent are told about a casualty, and when. Two writes reach
// them: an entity created or changed (routes/entities.js), and a medical record whose
// triage, evacuation priority or status changed (routes/medical.js). A triage raised to
// RED must reach the planner, or its T1 preemption never runs for that casualty.
// ---------------------------------------------------------------------------

// Medical fields the planner orders casualties by. evac_stage is left out on purpose:
// the movement simulation writes it on every pickup and delivery, and the planner
// already knows, since it made the write.
const PLANNING_FIELDS = ['triage_color', 'evac_priority', 'casualty_status'];

// The /casualties/notify body for a casualty entity, or null when it has no position.
function casualtyPayload(entity) {
  const lat  = entity.lat  ?? entity.latitud;
  const lng  = entity.lng  ?? entity.longitud;
  if (lat == null || lng == null) return null;
  const medical = entity.medical ?? {};
  return {
    id:              entity.id,
    name:            entity.name ?? entity.nombre ?? `Entity-${entity.id}`,
    lat:             Number(lat),
    lng:             Number(lng),
    triage_color:    medical.triage_color    ?? null,
    casualty_status: medical.casualty_status ?? null,
    evac_priority:   medical.evac_priority   ?? null,
  };
}

// The planning fields as they were before a medical update, or null when none changed.
function planningChange(before, after) {
  const was = before ?? {};
  const now = after ?? {};
  const changed = PLANNING_FIELDS.some(field => (was[field] ?? null) !== (now[field] ?? null));
  if (!changed) return null;
  return Object.fromEntries(PLANNING_FIELDS.map(field => [field, was[field] ?? null]));
}

// Tells both services about a casualty. `previous` (from planningChange) marks an update
// of an existing casualty rather than a new one. Fire-and-forget, like every hook.
function createCasualtyNotifier({ planner, pfcAgent }) {
  return function notifyCasualty(entity, previous = null) {
    const payload = casualtyPayload(entity);
    if (!payload) return;
    if (previous) payload.previous = previous;
    planner('/casualties/notify', payload);
    // Also notify pfc_agent so it can spawn a PFC session as a safety-net
    // (in case the planner is slow or offline when the casualty is created).
    pfcAgent('/casualties/notify', payload);
  };
}

module.exports = { casualtyPayload, planningChange, createCasualtyNotifier };
