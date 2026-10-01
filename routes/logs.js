// routes/logs.js
//
// GET /api/logs/stream — the server's log entries over SSE, for /logs.
//   On connect: { type: 'backlog', level, entries: [...] } (server LOG_LEVEL, last LOG_BUFFER_SIZE entries)
//   Then:       { type: 'entry',   entry }          (one per new line)
//
// Entries are whatever pino logged: { time, level, scope, msg, ...fields }.
// ---------------------------------------------------------------------------

const express = require('express');
const router  = express.Router();
const logger  = require('../lib/logger');
const { createSseChannel } = require('../lib/sse-channel');

const channel = createSseChannel({
  logger:    logger.child('logs'),
  label:     'Log viewer',
  onConnect: send => send({ type: 'backlog', level: logger.root.level, entries: logger.buffer.snapshot() }),
});

// Nothing in the broadcast path logs, or each entry would log another one.
logger.buffer.subscribe(entry => channel.broadcast({ type: 'entry', entry }));

router.get('/stream', channel.handler);

module.exports = router;
