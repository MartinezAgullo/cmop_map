// tests/scenario-loader.test.js — run with `npm test`

const test   = require('node:test');
const assert = require('node:assert/strict');
const { loadScenarioData } = require('../lib/scenario-loader');

// A pool whose client records every statement and answers each with one row.
function recordingPool() {
  const sql = [];
  const client = {
    query: async (text) => { sql.push(text.trim()); return { rows: [{ id: 1 }] }; },
    release: () => {},
  };
  return { sql, connect: async () => client };
}

const FLOOD = {
  name: 'Flood DANA', hazard_type: 'flood',
  geometry: { type: 'Polygon', coordinates: [[[-0.39, 39.42], [-0.38, 39.42], [-0.38, 39.43], [-0.39, 39.42]]] },
};

test('a scenario of hazard zones only loads, with no entity insert', async () => {
  const pool = recordingPool();
  const out = await loadScenarioData(pool, { meta: { name: 'zones_only' }, entities: [], hazardZones: [FLOOD] });
  assert.deepEqual(out, { entities: 0, medicalRecords: 0, hazardZones: 1 });
  assert.ok(!pool.sql.some(q => q.startsWith('INSERT INTO puntos_interes')));
  assert.ok(pool.sql.some(q => q.startsWith('INSERT INTO hazard_zones')));
  assert.equal(pool.sql.at(-1), 'COMMIT');
});

test('a scenario with no entities key at all loads too', async () => {
  const pool = recordingPool();
  const out = await loadScenarioData(pool, { meta: { name: 'empty' } });
  assert.equal(out.entities, 0);
  assert.equal(pool.sql.at(-1), 'COMMIT');
});
