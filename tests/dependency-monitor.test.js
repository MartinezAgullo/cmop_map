// tests/dependency-monitor.test.js — run with `npm test`

const test   = require('node:test');
const assert = require('node:assert/strict');
const { nextState, createDependencyMonitor } = require('../lib/dependency-monitor');

const UNKNOWN = { ok: null, detail: 'not checked yet', since: null, warned: false };
const UP      = { ok: true,  detail: 'HTTP 404' };
const DOWN    = { ok: false, detail: 'connect ECONNREFUSED 127.0.0.1:8400' };

/** Feed a sequence of [elapsedMs, probe result] through nextState and collect the logged levels. */
function run(steps, graceMs) {
  let state = UNKNOWN;
  return steps.map(([elapsedMs, result]) => {
    const step = nextState(state, result, { elapsedMs, graceMs, now: elapsedMs });
    state = step.state;
    return step.log && step.log.level;
  });
}

test('a service that comes up within the grace period never warns', () => {
  assert.deepEqual(run([[0, DOWN], [10000, DOWN], [20000, UP], [30000, UP]], 60000),
    ['info', null, 'info', null]);
});

test('a service still down after the grace period warns once', () => {
  assert.deepEqual(run([[0, DOWN], [50000, DOWN], [60000, DOWN], [70000, DOWN]], 60000),
    ['info', null, 'warn', null]);
});

test('without a grace period an unreachable dependency warns at once', () => {
  assert.deepEqual(run([[0, DOWN], [10000, DOWN]], 0), ['warn', null]);
});

test('a service that drops out later warns at once, grace or not, and its recovery is logged', () => {
  assert.deepEqual(run([[0, UP], [10000, DOWN], [20000, DOWN], [30000, UP]], 60000),
    ['info', 'warn', null, 'info']);
});

test('since only moves when the state changes', () => {
  let { state } = nextState(UNKNOWN, DOWN, { elapsedMs: 0, graceMs: 0, now: 100 });
  ({ state } = nextState(state, DOWN, { elapsedMs: 0, graceMs: 0, now: 200 }));
  assert.equal(state.since, 100);
});

test('the monitor logs aligned lines and reports each check in status()', async () => {
  const lines = [];
  const logger = { info: m => lines.push(['info', m]), warn: m => lines.push(['warn', m]) };
  const monitor = createDependencyMonitor([
    { name: 'db',      target: 'pg://x',  probe: async () => ({ ok: true, detail: 'schema ready' }) },
    { name: 'planner', target: 'http://p', probe: async () => DOWN, graceMs: 60000 },
  ], logger, { now: () => 0 });
  await monitor.start();
  monitor.stop();

  assert.deepEqual(lines, [
    ['info', '✅ db      pg://x: up (schema ready)'],
    ['info', `⏳ planner http://p: not up yet, waiting up to 60s (${DOWN.detail})`],
  ]);
  assert.deepEqual(monitor.status().map(({ name, ok }) => [name, ok]), [['db', true], ['planner', false]]);
});
