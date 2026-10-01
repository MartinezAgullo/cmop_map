// routes/client-log.js
//
// POST /api/client-log — browsers report their errors here, so they print in
// the server terminal under [browser] next to everything else.
// Body: { level: 'error'|'warn'|'info', message, context? }
// The sender is public/js/client-log.js.
// ---------------------------------------------------------------------------

const express = require('express');
const router  = express.Router();
const log     = require('../lib/logger').child('browser');

const LEVELS       = ['error', 'warn', 'info'];
const MAX_MESSAGE  = 2000;

router.post('/', (req, res) => {
  const { level, message, context } = req.body || {};
  const lvl  = LEVELS.includes(level) ? level : 'error';
  const text = String(message ?? '').slice(0, MAX_MESSAGE);
  const ctx  = context && typeof context === 'object' ? context : {};
  log[lvl]({ ...ctx, ip: req.ip }, text);
  res.status(204).end();
});

module.exports = router;
