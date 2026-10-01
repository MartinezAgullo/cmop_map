// routes/logs.js
//
// GET  /api/logs/stream — log entries over SSE, for /logs.
//   On connect: { type: 'backlog', level, entries: [...] } (server LOG_LEVEL, last LOG_BUFFER_SIZE entries)
//   Then:       { type: 'entry',   entry }          (one per new line)
//
//
// POST /api/logs/ingest — other services add their entries to the same stream
//   Body: { service, entries: [{ time, level, scope, msg, err? }] }
//   They reach the /logs page only: each service already prints its own terminal.
//   Sender: latacc_common.log.HttpLogForwarder in latacc-medevac.
//
// Entries are { time, level, service, scope, msg, ...fields }.
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

const LEVELS          = new Set(['debug', 'info', 'warn', 'error', 'fatal']);
const MAX_BATCH       = 500;
const MAX_TEXT_CHARS  = 10000;
const text = (value, fallback = '') => String(value ?? fallback).slice(0, MAX_TEXT_CHARS);

/** One sender's entry, reduced to the fields the page reads. */
function ingestedEntry(raw, service) {
  const entry = {
    time:    Number.isFinite(raw.time) ? raw.time : Date.now(),
    level:   LEVELS.has(raw.level) ? raw.level : 'info',
    service,
    scope:   text(raw.scope),
    msg:     text(raw.msg),
  };
  if (raw.err && typeof raw.err === 'object') {
    entry.err = { type: text(raw.err.type), message: text(raw.err.message), stack: text(raw.err.stack) };
  }
  return entry;
}

router.post('/ingest', (req, res) => {
  const { service, entries } = req.body || {};
  if (typeof service !== 'string' || !service || !Array.isArray(entries)) {
    return res.status(400).json({ ok: false, message: 'Body must be { service: string, entries: [] }' });
  }
  for (const raw of entries.slice(0, MAX_BATCH)) {
    if (raw && typeof raw === 'object') logger.buffer.push(ingestedEntry(raw, text(service).slice(0, 64)));
  }
  res.status(204).end();
});

module.exports = router;
