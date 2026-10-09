// tests/db-error.test.js — run with `npm test`

const test   = require('node:test');
const assert = require('node:assert/strict');
const { classifyDbError, sendError, _enumCache } = require('../lib/db-error');

/** An error shaped like the ones the pg driver throws. */
function pgError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

function fakeRes() {
  return {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function fakeLog() {
  const lines = [];
  const at = (level) => (a, b) => lines.push({ level, msg: typeof a === 'string' ? a : b, obj: typeof a === 'string' ? null : a });
  return { lines, warn: at('warn'), error: at('error') };
}

const fakePool = (values) => ({
  target: 'localhost:5432/cmop_db',
  queries: 0,
  async query() { this.queries += 1; return { rows: values.map((v) => ({ v })) }; },
});

test('an unknown enum value is a 400 naming the field', () => {
  const r = classifyDbError(pgError('22P02', 'invalid input value for enum triage_color_enum: "PURPLE"'));
  assert.deepEqual(r, { status: 400, reason: '"PURPLE" is not a valid triage_color', enumType: 'triage_color_enum' });
});

test('categoria_militar reads as categoria', () => {
  const r = classifyDbError(pgError('22P02', 'invalid input value for enum categoria_militar: "xxx"'));
  assert.equal(r.reason, '"xxx" is not a valid categoria');
});

test('a non-numeric id is a 400 with the database message', () => {
  const r = classifyDbError(pgError('22P02', 'invalid input syntax for type integer: "abc"'));
  assert.equal(r.status, 400);
  assert.match(r.reason, /type integer: "abc"/);
});

test('a duplicate is a 409 carrying the key', () => {
  const r = classifyDbError(pgError('23505', 'duplicate key value violates unique constraint "entities_nombre_key"', {
    detail: 'Key (nombre)=(GerCas1) already exists.', constraint: 'entities_nombre_key',
  }));
  assert.equal(r.status, 409);
  assert.match(r.reason, /Key \(nombre\)=\(GerCas1\) already exists\)$/);
});

test('a missing required column names it', () => {
  const r = classifyDbError(pgError('23502', 'null value in column "latitud" violates not-null constraint', { column: 'latitud' }));
  assert.deepEqual(r, { status: 400, reason: 'latitud is required' });
});

test('a database that refuses connections is a 503, through an AggregateError too', () => {
  const refused = (address) => Object.assign(new Error(`connect ECONNREFUSED ${address}:5432`),
    { code: 'ECONNREFUSED', address, port: 5432, syscall: 'connect' });
  assert.equal(classifyDbError(refused('127.0.0.1')).status, 503);
  const both = new AggregateError([refused('::1'), refused('127.0.0.1')]);
  const r = classifyDbError(both);
  assert.equal(r.status, 503);
  assert.match(r.reason, /ECONNREFUSED ::1:5432 \/ connect ECONNREFUSED 127\.0\.0\.1:5432/);
});

test('anything else is left alone', () => {
  assert.equal(classifyDbError(new TypeError('cannot read properties of undefined')), null);
  assert.equal(classifyDbError(pgError('42P01', 'relation "x" does not exist')), null);
});

test('sendError lists the valid enum values, read once from the database', async () => {
  _enumCache.clear();
  const pool = fakePool(['RED', 'YELLOW', 'GREEN']);
  const err = pgError('22P02', 'invalid input value for enum triage_color_enum: "PURPLE"');
  for (let i = 0; i < 2; i += 1) {
    const res = fakeRes(); const log = fakeLog();
    await sendError(res, log, err, 'Failed to fetch by triage color', { pool });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message,
      'Failed to fetch by triage color: "PURPLE" is not a valid triage_color; valid values: RED, YELLOW, GREEN');
    assert.equal(log.lines[0].level, 'warn');
  }
  assert.equal(pool.queries, 1);
});

test('sendError still answers when the enum lookup fails', async () => {
  _enumCache.clear();
  const pool = { async query() { throw new Error('down'); } };
  const res = fakeRes();
  await sendError(res, fakeLog(), pgError('22P02', 'invalid input value for enum evac_stage_enum: "flying"'), 'x', { pool });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, '"flying" is not a valid evac_stage');
});

test('sendError: 503 points at the container, logged as an error', async () => {
  const res = fakeRes(); const log = fakeLog();
  const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED', address: '127.0.0.1', port: 5432 });
  await sendError(res, log, err, 'Failed to fetch entities', { pool: fakePool([]) });
  assert.equal(res.statusCode, 503);
  assert.match(res.body.message, /PostgreSQL running at localhost:5432\/cmop_db/);
  assert.equal(log.lines[0].level, 'error');
});

test('sendError keeps the old 500 and logs the stack for an unknown error', async () => {
  const res = fakeRes(); const log = fakeLog();
  const err = new TypeError('boom');
  await sendError(res, log, err, 'Failed to create entity', { pool: fakePool([]) });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { success: false, message: 'Failed to create entity', error: 'boom' });
  assert.equal(log.lines[0].obj.err, err);
});
