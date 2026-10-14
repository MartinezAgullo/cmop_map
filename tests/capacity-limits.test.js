// tests/capacity-limits.test.js — run with `npm test`

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const { capacityLimit, capacityProblem, FACILITY_SIZE_BY_ROLE } = require('../lib/capacity-limits');
const { generateMascalScenario } = require('../lib/mascal-generator');

test('each kind of vehicle gets its limit', () => {
  assert.equal(capacityLimit({ categoria: 'medevac_unit', mobility: 'ground' }).max, 2);
  assert.equal(capacityLimit({ categoria: 'medevac_unit', mobility: 'air' }).max, 2);
  assert.equal(capacityLimit({ categoria: 'civil_protection', mobility: 'air' }).max, 15);
  assert.equal(capacityLimit({ categoria: 'helicopter' }).max, 15);
  assert.equal(capacityLimit({ categoria: 'fire_fighting', mobility: 'ground' }).max, 22);
  assert.equal(capacityLimit({ categoria: 'law_enforcement' }).max, 22);
  assert.equal(capacityLimit({ categoria: 'civil_protection', mobility: 'sea' }).max, 12);
  assert.equal(capacityLimit({ categoria: 'armoured', mobility: 'ground' }).max, 10);
  assert.equal(capacityLimit({ categoria: 'ugv' }).max, 2);
});

test('a capacity over the limit is refused with the agreed message', () => {
  const problem = capacityProblem({ categoria: 'civil_protection', mobility: 'air', capacity: 30 });
  assert.equal(problem.rejected, true);
  assert.equal(problem.field, 'capacity');
  assert.equal(problem.message,
    'Capacity not accepted. Number 30 larger than maximum accepted 15 for a civil_protection helicopter');
});

test('an ambulance takes one or two, as the QUBO optimiser plans', () => {
  assert.equal(capacityProblem({ categoria: 'medevac_unit', mobility: 'ground', capacity: 2 }), null);
  assert.match(capacityProblem({ categoria: 'medevac_unit', mobility: 'ground', capacity: 3 }).message, /maximum accepted 2/);
});

test('capacities at the limit, absent, or not whole numbers', () => {
  assert.equal(capacityProblem({ categoria: 'fire_fighting', mobility: 'ground', capacity: 22 }), null);
  assert.equal(capacityProblem({ categoria: 'fire_fighting' }), null);
  assert.match(capacityProblem({ categoria: 'fire_fighting', capacity: 0 }).message, /1 or more/);
  assert.match(capacityProblem({ categoria: 'fire_fighting', capacity: 2.5 }).message, /whole number/);
});

test('a facility cannot hold more people than places', () => {
  assert.equal(capacityProblem({ categoria: 'shelter', max_capacity: 100, initial_occupancy: 100 }), null);
  assert.match(capacityProblem({ categoria: 'shelter', max_capacity: 100, initial_occupancy: 101 }).message, /above max_capacity/);
  assert.match(capacityProblem({ categoria: 'shelter', max_capacity: 0 }).message, /max_capacity/);
  assert.match(capacityProblem({ categoria: 'shelter', initial_occupancy: -1 }).message, /0 or more/);
});

test('a higher role is a larger facility', () => {
  const sizes = [1, 2, 3, 4].map(r => FACILITY_SIZE_BY_ROLE[`medical_role_${r}`].max_capacity);
  assert.deepEqual([...sizes].sort((a, b) => a - b), sizes);
});

test('every scenario facility has places, and every capacity is accepted', () => {
  const dir = path.join(__dirname, '..', 'scripts', 'scenarios');
  for (const file of fs.readdirSync(dir)) {
    for (const e of require(path.join(dir, file)).entities) {
      assert.equal(capacityProblem(e), null, `${file}: ${e.nombre}`);
      if (e.categoria === 'medical_facility') {
        assert.ok(e.max_capacity >= 1 && e.initial_occupancy >= 0, `${file}: ${e.nombre} has no places`);
      }
    }
  }
});

test('a generated MASCAL never runs out of places', () => {
  const { entities } = generateMascalScenario({ n_casualties: 200, n_medical_facilities: 1, seed: 7 });
  const facilities = entities.filter(e => e.categoria === 'medical_facility');
  assert.equal(facilities.length, 1);
  assert.ok(facilities[0].max_capacity - facilities[0].initial_occupancy >= 200);
});
