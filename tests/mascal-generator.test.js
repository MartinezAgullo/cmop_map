// tests/mascal-generator.test.js — run with `npm test` (node:test, no dependencies)

const test   = require('node:test');
const assert = require('node:assert/strict');
const { generateMascalScenario, apportion, seededRandom, PRESETS } = require('../lib/mascal-generator');

const NOW = '2026-09-23T10:00:00Z';

function byCategory(scenario, categoria) {
  return scenario.entities.filter(e => e.categoria === categoria);
}

function distanceKm(a, b) {
  const rad = x => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

test('the same seed gives the same scenario', () => {
  const options = { preset: 'madrid', n_casualties: 25, n_evacuators: 9, seed: 7, now: NOW };
  assert.deepEqual(generateMascalScenario(options), generateMascalScenario(options));
  assert.notDeepEqual(generateMascalScenario(options),
                      generateMascalScenario({ ...options, seed: 8 }));
});

test('it creates exactly the counts asked for, each medical record on its casualty', () => {
  const s = generateMascalScenario({ n_casualties: 30, n_evacuators: 12, n_medical_facilities: 4, seed: 1, now: NOW });
  assert.equal(byCategory(s, 'casualty').length, 30);
  assert.equal(byCategory(s, 'medevac_unit').length, 12);
  assert.equal(byCategory(s, 'medical_facility').length, 4);
  const refs = new Set(byCategory(s, 'casualty').map(e => e.elemento_identificado));
  assert.equal(s.medicalDetails.length, 30);
  assert.ok(s.medicalDetails.every(m => refs.has(m.entity_ref) && m.evac_stage === 'at_poi'));
  assert.equal(new Set(s.entities.map(e => e.elemento_identificado)).size, s.entities.length);
});

test('triage is skewed T3 > T2 > T1 at every size, with about 5 % KIA', () => {
  for (const n of [10, 12, 30, 57, 120]) {
    const s = generateMascalScenario({ n_casualties: n, n_evacuators: 5, seed: n, now: NOW });
    const count = t => s.medicalDetails.filter(m => m.triage_color === t).length;
    assert.ok(count('GREEN') > count('YELLOW') && count('YELLOW') > count('RED'),
              `n=${n}: GREEN ${count('GREEN')}, YELLOW ${count('YELLOW')}, RED ${count('RED')}`);
  }
  const s = generateMascalScenario({ n_casualties: 100, n_evacuators: 5, seed: 1, now: NOW });
  const count = t => s.medicalDetails.filter(m => m.triage_color === t).length;
  assert.deepEqual([count('GREEN'), count('YELLOW'), count('RED'), count('BLACK')], [50, 30, 15, 5]);
  const dead = s.medicalDetails.filter(m => m.triage_color === 'BLACK');
  assert.ok(dead.every(m => m.casualty_status === 'KIA' && m.vital_signs === null));
});

test('vehicle roles follow 4:3:2:1, ground 3x air, one in three with two litters', () => {
  const s = generateMascalScenario({ n_casualties: 40, n_evacuators: 30, seed: 3, now: NOW });
  const vehicles = byCategory(s, 'medevac_unit');
  const role = r => vehicles.filter(v => v.tipo_elemento === `medevac_role_${r}`).length;
  assert.deepEqual([role(1), role(2), role(3), role(4)], [12, 9, 6, 3]);
  assert.ok(vehicles.filter(v => v.mobility === 'ground').length
            > 2 * vehicles.filter(v => v.mobility === 'air').length);
  assert.equal(vehicles.filter(v => v.capacity === 2).length, 10);
  assert.ok(vehicles.every(v => v.capacity === 1 || v.capacity === 2));
});

test('facility roles decrease up the ladder, one of each from four facilities, R2+ always', () => {
  const s = generateMascalScenario({ n_casualties: 30, n_evacuators: 12, n_medical_facilities: 10, seed: 5, now: NOW });
  const roles = byCategory(s, 'medical_facility').map(f => Number(f.tipo_elemento.slice(-1)));
  const count = r => roles.filter(x => x === r).length;
  assert.ok(count(1) >= count(2) && count(2) >= count(3) && count(3) >= count(4));

  for (const n of [4, 5, 7]) {
    const few = generateMascalScenario({ n_casualties: 10, n_evacuators: 4, n_medical_facilities: n, seed: n, now: NOW });
    const present = new Set(byCategory(few, 'medical_facility').map(f => f.tipo_elemento));
    assert.equal(present.size, 4, `n=${n}: roles ${[...present]}`);
  }

  const single = generateMascalScenario({ n_casualties: 20, n_evacuators: 1, n_medical_facilities: 1, seed: 2, now: NOW });
  assert.equal(byCategory(single, 'medical_facility')[0].tipo_elemento, 'medical_role_2');
  assert.ok(Number(byCategory(single, 'medevac_unit')[0].tipo_elemento.slice(-1)) >= 2);
});

test('everything lands within the radius of the chosen centre', () => {
  const s = generateMascalScenario({ preset: 'valencia', radius_km: 3, n_casualties: 50, n_evacuators: 15, seed: 11, now: NOW });
  const centre = PRESETS.valencia;
  // Casualties may sit up to 300 m outside the incident ring, which is itself inside 0.7 r.
  for (const e of s.entities) assert.ok(distanceKm(centre, e) <= 3.001, `${e.nombre} too far`);
});

test('a custom centre overrides the preset, and bad input is refused', () => {
  const s = generateMascalScenario({ lat: 10, lng: 20, n_casualties: 5, n_evacuators: 2, seed: 1, now: NOW });
  assert.equal(s.meta.name, 'random_mascal_custom_s1');
  assert.throws(() => generateMascalScenario({ preset: 'atlantis' }), /unknown preset/);
  assert.throws(() => generateMascalScenario({ n_casualties: 0 }), /n_casualties/);
  assert.throws(() => generateMascalScenario({ radius_km: 100 }), /radius_km/);
});

test('apportion returns exactly n draws in the weighted proportions', () => {
  const draws = apportion(seededRandom(1), { a: 0.5, b: 0.3, c: 0.2 }, 10);
  assert.equal(draws.length, 10);
  assert.deepEqual([...draws].sort().join(''), 'aaaaabbbcc');
});
