// tests/logging.test.js — run with `npm test`

const test   = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');
const { errorDetail }         = require('../lib/error-detail');
const { createNotifier }      = require('../lib/notifier');
const { createRequestLogger } = require('../lib/request-logger');
const { httpProbe }           = require('../lib/dependency-check');

/** A logger stand-in that records [level, message] pairs. */
function recorder() {
  const lines = [];
  const logger = {};
  for (const level of ['debug', 'info', 'warn', 'error']) {
    logger[level] = (...args) => lines.push([level, args.find(a => typeof a === 'string')]);
  }
  return { logger, lines };
}

/** An HTTP server on a free port that answers every request with `status`. */
async function serverAnswering(status, body = '{}') {
  const server = http.createServer((req, res) => { req.resume(); res.writeHead(status); res.end(body); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

/** A URL nothing listens on: a port the OS just handed out and released. */
async function closedPortUrl() {
  const { server, url } = await serverAnswering(200);
  await new Promise(resolve => server.close(resolve));
  return url;
}

test('errorDetail surfaces the cause fetch hides behind "fetch failed"', async () => {
  const err = await fetch(await closedPortUrl()).catch(e => e);
  assert.equal(err.message, 'fetch failed');
  assert.match(errorDetail(err), /ECONNREFUSED/);
});

test('errorDetail names timeouts', () => {
  assert.equal(errorDetail(Object.assign(new Error('x'), { name: 'TimeoutError' })), 'timed out');
});

test('notifier logs a delivered notification at info', async () => {
  const { server, url } = await serverAnswering(200);
  const { logger, lines } = recorder();
  await createNotifier({ service: 'planner', baseUrl: url, logger })('/casualties/notify', { id: 1 });
  server.close();
  assert.ok(lines.some(([lvl, msg]) => lvl === 'info' && /planner \/casualties\/notify 200/.test(msg)));
});

test('notifier warns when the service answers with an error status', async () => {
  const { server, url } = await serverAnswering(500, 'boom');
  const { logger, lines } = recorder();
  await createNotifier({ service: 'planner', baseUrl: url, logger })('/x', {});
  server.close();
  assert.ok(lines.some(([lvl, msg]) => lvl === 'warn' && /answered 500/.test(msg)));
});

test('notifier warns with the cause when the service is unreachable, and never rejects', async () => {
  const { logger, lines } = recorder();
  await createNotifier({ service: 'planner', baseUrl: await closedPortUrl(), logger })('/x', {});
  assert.ok(lines.some(([lvl, msg]) => lvl === 'warn' && /not delivered: .*ECONNREFUSED/.test(msg)));
});

test('httpProbe counts any HTTP answer as reachable', async () => {
  const { server, url } = await serverAnswering(404);
  assert.deepEqual(await httpProbe(url)(), { ok: true, detail: 'HTTP 404' });
  server.close();
  assert.equal((await httpProbe(await closedPortUrl())()).ok, false);
});

/** Run the request logger over a fake request whose response answers `status` with `body`. */
function logRequest({ status, body, quiet = false, url = '/api/x' }) {
  const { logger, lines } = recorder();
  const listeners = {};
  const res = {
    statusCode: status, headersSent: true, locals: {},
    json: () => {}, on: (event, fn) => { listeners[event] = fn; },
  };
  createRequestLogger({ logger, isQuiet: () => quiet })({ method: 'GET', originalUrl: url }, res, () => {});
  if (body) res.json(body);
  listeners.close();
  return lines[0];
}

test('request logger picks the level from the status', () => {
  assert.equal(logRequest({ status: 200 })[0], 'info');
  assert.equal(logRequest({ status: 404 })[0], 'warn');
  assert.equal(logRequest({ status: 502 })[0], 'error');
});

test('quiet requests drop to debug, except server errors', () => {
  assert.equal(logRequest({ status: 404, quiet: true })[0], 'debug');
  assert.equal(logRequest({ status: 500, quiet: true })[0], 'error');
});

test('request logger appends the message of an error response', () => {
  const [, msg] = logRequest({ status: 400, body: { message: 'longitud and latitud are required' } });
  assert.match(msg, /^GET \/api\/x 400 \d+ ms: longitud and latitud are required$/);
});
