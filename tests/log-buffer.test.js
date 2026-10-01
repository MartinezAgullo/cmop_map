// tests/log-buffer.test.js — run with `npm test`

const test   = require('node:test');
const assert = require('node:assert/strict');
const { createLogBuffer } = require('../lib/log-buffer');

const line = (msg, level = 30) => `${JSON.stringify({ time: 1, level, msg })}\n`;

test('keeps only the last `capacity` entries, oldest first', () => {
  const buffer = createLogBuffer({ capacity: 2 });
  ['a', 'b', 'c'].forEach(m => buffer.write(line(m)));
  assert.deepEqual(buffer.snapshot().map(e => e.msg), ['b', 'c']);
});

test('names pino levels', () => {
  const buffer = createLogBuffer();
  buffer.write(line('x', 50));
  assert.equal(buffer.snapshot()[0].level, 'error');
});

test('hands each entry to subscribers until they unsubscribe', () => {
  const buffer = createLogBuffer();
  const seen = [];
  const unsubscribe = buffer.subscribe(e => seen.push(e.msg));
  buffer.write(line('a'));
  unsubscribe();
  buffer.write(line('b'));
  assert.deepEqual(seen, ['a']);
});

test('a failing subscriber does not stop the others', () => {
  const buffer = createLogBuffer();
  const seen = [];
  buffer.subscribe(() => { throw new Error('boom'); });
  buffer.subscribe(e => seen.push(e.msg));
  buffer.write(line('a'));
  assert.deepEqual(seen, ['a']);
});

test('ignores lines that are not JSON', () => {
  const buffer = createLogBuffer();
  buffer.write('not json\n');
  assert.equal(buffer.snapshot().length, 0);
});
