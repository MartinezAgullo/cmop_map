// tests/coordinates.test.js — run with `npm test`

const test   = require('node:test');
const assert = require('node:assert/strict');
const { coordinateProblem } = require('../lib/coordinates');

test('a place on Earth is accepted, as numbers or numeric strings', () => {
  assert.equal(coordinateProblem(2.34, 48.765), null);
  assert.equal(coordinateProblem('-0.39', '39.42'), null);
  assert.equal(coordinateProblem(-180, 90), null);
});

test('the position seen in the live test is refused', () => {
  assert.match(coordinateProblem(500, 123), /latitude 123 is out of range/);
});

test('each half is checked against its own range', () => {
  assert.match(coordinateProblem(2.34, -91), /latitude/);
  assert.match(coordinateProblem(181, 48.7), /longitude 181 is out of range/);
});

test('anything that is not a number is refused', () => {
  for (const [lng, lat] of [['east', 48], [2, null], [2, ''], [NaN, 48], [Infinity, 0]]) {
    assert.equal(coordinateProblem(lng, lat), 'longitude and latitude must be numbers');
  }
});
