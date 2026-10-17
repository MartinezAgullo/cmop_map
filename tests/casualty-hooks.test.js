// tests/casualty-hooks.test.js — run with `npm test`

const test   = require('node:test');
const assert = require('node:assert/strict');
const { casualtyPayload, planningChange, createCasualtyNotifier } = require('../lib/casualty-hooks');

const casualty = {
  id: 42, nombre: 'FraCas3', latitud: 48.765, longitud: 2.34,
  medical: { triage_color: 'RED', evac_priority: 'URGENT', casualty_status: 'WIA', evac_stage: 'at_poi' },
};

test('the payload carries the position and the planning fields', () => {
  assert.deepEqual(casualtyPayload(casualty), {
    id: 42, name: 'FraCas3', lat: 48.765, lng: 2.34,
    triage_color: 'RED', casualty_status: 'WIA', evac_priority: 'URGENT',
  });
});

test('a casualty without a position is not notified', () => {
  assert.equal(casualtyPayload({ id: 1, nombre: 'X', latitud: null, longitud: 2 }), null);
});

test('a raised triage is a change, with the fields as they were', () => {
  const before = { triage_color: 'YELLOW', evac_priority: 'PRIORITY', casualty_status: 'WIA', evac_stage: 'at_poi' };
  assert.deepEqual(planningChange(before, casualty.medical),
    { triage_color: 'YELLOW', evac_priority: 'PRIORITY', casualty_status: 'WIA' });
});

test('a record created by the update is a change from nothing', () => {
  assert.deepEqual(planningChange(null, casualty.medical),
    { triage_color: null, evac_priority: null, casualty_status: null });
});

test('a stage written by the simulation is not a change', () => {
  assert.equal(planningChange(casualty.medical, { ...casualty.medical, evac_stage: 'in_transit' }), null);
});

test('both services hear of the casualty, and of what it was before', () => {
  const sent = [];
  const notify = createCasualtyNotifier({
    planner:  (path, body) => sent.push(['planner', path, body]),
    pfcAgent: (path, body) => sent.push(['pfc_agent', path, body]),
  });
  notify(casualty, { triage_color: 'YELLOW', evac_priority: 'PRIORITY', casualty_status: 'WIA' });
  assert.deepEqual(sent.map(([service, path]) => [service, path]),
    [['planner', '/casualties/notify'], ['pfc_agent', '/casualties/notify']]);
  assert.equal(sent[0][2].previous.triage_color, 'YELLOW');
  assert.equal(sent[0][2].triage_color, 'RED');
});
