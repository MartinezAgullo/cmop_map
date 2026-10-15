// tests/hazard-zone-input.test.js — run with `npm test`

const test   = require('node:test');
const assert = require('node:assert/strict');
const { parseZoneGeometry, parseZoneInput } = require('../lib/hazard-zone-input');
const { HAZARD_TYPES } = require('../lib/hazard-types');

// A small square in Paiporta, [lng, lat]
const RING = [[-0.39, 39.42], [-0.38, 39.42], [-0.38, 39.43], [-0.39, 39.43], [-0.39, 39.42]];
const POLYGON = { type: 'Polygon', coordinates: [RING] };

test('a Polygon comes out as a one-part MultiPolygon', () => {
  const { geometry, error } = parseZoneGeometry(POLYGON);
  assert.equal(error, null);
  assert.equal(geometry.type, 'MultiPolygon');
  assert.deepEqual(geometry.coordinates, [[RING]]);
});

test('a MultiPolygon keeps its separate parts', () => {
  const other = RING.map(([x, y]) => [x + 0.05, y]);
  const { geometry } = parseZoneGeometry({ type: 'MultiPolygon', coordinates: [[RING], [other]] });
  assert.equal(geometry.coordinates.length, 2);
});

test('a Feature from a drawing tool is accepted by its geometry', () => {
  const { geometry } = parseZoneGeometry({ type: 'Feature', properties: {}, geometry: POLYGON });
  assert.equal(geometry.type, 'MultiPolygon');
});

test('an open ring is closed', () => {
  const { geometry } = parseZoneGeometry({ type: 'Polygon', coordinates: [RING.slice(0, 4)] });
  const ring = geometry.coordinates[0][0];
  assert.deepEqual(ring[0], ring[ring.length - 1]);
});

test('rejects what cannot be an area', () => {
  assert.match(parseZoneGeometry({ type: 'Point', coordinates: [-0.38, 39.42] }).error, /Polygon or MultiPolygon/);
  assert.match(parseZoneGeometry({ type: 'Polygon', coordinates: [[[-0.39, 39.42], [-0.38, 39.42]]] }).error, /three distinct/);
  assert.match(parseZoneGeometry(null).error, /GeoJSON/);
});

test('rejects an out-of-range position with a hint about the order', () => {
  const swapped = { type: 'Polygon', coordinates: [[[-0.39, 39.42], [-0.38, 139.42], [-0.38, 39.43], [-0.39, 39.42]]] };
  assert.match(parseZoneGeometry(swapped).error, /\[lng, lat\]/);
});

test('a create needs name, hazard_type and geometry', () => {
  const { errors } = parseZoneInput({});
  assert.equal(errors.length, 3);
  const ok = parseZoneInput({ name: ' Flood DANA ', hazard_type: 'flood', geometry: POLYGON });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.data.name, 'Flood DANA');
});

test('an update takes only the fields sent', () => {
  const { data, errors } = parseZoneInput({ active: false }, { partial: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(data, { active: false });
});

test('an unknown hazard type lists the valid ones', () => {
  const { errors } = parseZoneInput({ hazard_type: 'tsunami' }, { partial: true });
  assert.match(errors[0], /fire, flood/);
});

test('every hazard type has labels, a code and one or two colours', () => {
  for (const t of HAZARD_TYPES) {
    assert.ok(t.label_en && t.label_es && t.code, t.value);
    assert.ok(t.colors.length >= 1 && t.colors.length <= 2, t.value);
    for (const c of t.colors) assert.match(c, /^#[0-9A-F]{6}$/i);
  }
});
