// lib/hazard-zone-input.js
//
// Validation of what a caller sends to /api/hazard-zones. Pure functions, no I/O:
// the route turns the result into a 400 or hands the clean values to the model.
//
// A zone's geometry arrives as GeoJSON (a Polygon, a MultiPolygon, or a Feature
// holding one) with [lng, lat] positions, and leaves as a MultiPolygon: a zone is one
// hazard event whose parts may lie apart. PostGIS repairs self-intersections on
// insert (ST_MakeValid); this module rejects what cannot be a polygon at all.
// ---------------------------------------------------------------------------

const { HAZARD_TYPE_VALUES } = require('./hazard-types');
const { coordinateProblem } = require('./coordinates');

const NAME_MAX = 100;

/**
 * @returns {{ geometry: object|null, error: string|null }} geometry as a MultiPolygon
 */
function parseZoneGeometry(input) {
  const geom = input?.type === 'Feature' ? input.geometry : input;
  if (!geom || typeof geom !== 'object') return fail('geometry must be a GeoJSON Polygon or MultiPolygon');

  let polygons;
  if (geom.type === 'Polygon') polygons = [geom.coordinates];
  else if (geom.type === 'MultiPolygon') polygons = geom.coordinates;
  else return fail(`geometry must be a Polygon or MultiPolygon, not ${geom.type ?? 'nothing'}`);

  if (!Array.isArray(polygons) || polygons.length === 0) return fail('geometry has no polygons');
  const out = [];
  for (const [p, rings] of polygons.entries()) {
    if (!Array.isArray(rings) || rings.length === 0) return fail(`polygon ${p} has no rings`);
    const cleanRings = [];
    for (const [r, ring] of rings.entries()) {
      const clean = parseRing(ring);
      if (typeof clean === 'string') return fail(`polygon ${p}, ring ${r}: ${clean}`);
      cleanRings.push(clean);
    }
    out.push(cleanRings);
  }
  return { geometry: { type: 'MultiPolygon', coordinates: out }, error: null };
}

/** A closed ring of [lng, lat] positions, or the reason it is not one. */
function parseRing(ring) {
  if (!Array.isArray(ring)) return 'a ring must be a list of [lng, lat] positions';
  const positions = [];
  for (const pos of ring) {
    if (!Array.isArray(pos) || pos.length < 2) return 'every position must be [lng, lat]';
    const problem = coordinateProblem(pos[0], pos[1]);
    if (problem) return `position [${pos[0]}, ${pos[1]}]: ${problem} (GeoJSON is [lng, lat])`;
    positions.push([Number(pos[0]), Number(pos[1])]);
  }
  const [first, last] = [positions[0], positions[positions.length - 1]];
  if (first && (first[0] !== last[0] || first[1] !== last[1])) positions.push([...first]); // close it
  if (positions.length < 4) return 'a ring needs at least three distinct positions';
  return positions;
}

/**
 * Validate a create (partial=false) or update (partial=true) body.
 * @returns {{ data: object, errors: string[] }} data holds only the fields sent
 */
function parseZoneInput(body, { partial = false } = {}) {
  const errors = [];
  const data = {};
  const b = body || {};

  if (b.name !== undefined || !partial) {
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (!name) errors.push('name is required');
    else if (name.length > NAME_MAX) errors.push(`name is longer than ${NAME_MAX} characters`);
    else data.name = name;
  }
  if (b.hazard_type !== undefined || !partial) {
    if (!HAZARD_TYPE_VALUES.includes(b.hazard_type)) {
      errors.push(`hazard_type must be one of ${HAZARD_TYPE_VALUES.join(', ')}`);
    } else data.hazard_type = b.hazard_type;
  }
  if (b.geometry !== undefined || !partial) {
    const { geometry, error } = parseZoneGeometry(b.geometry);
    if (error) errors.push(error);
    else data.geometry = geometry;
  }
  if (b.description !== undefined) {
    if (b.description !== null && typeof b.description !== 'string') errors.push('description must be text');
    else data.description = b.description;
  }
  if (b.active !== undefined) {
    if (typeof b.active !== 'boolean') errors.push('active must be true or false');
    else data.active = b.active;
  }
  return { data, errors };
}

function fail(error) {
  return { geometry: null, error };
}

module.exports = { parseZoneGeometry, parseZoneInput };
