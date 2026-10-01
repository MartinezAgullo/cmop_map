// lib/logger.js
//
// The one logger every server module uses, built on pino.
// Levels, lowest first: debug · info · warn · error · fatal.
//
//   LOG_LEVEL   lowest level printed               (default: info)
//   LOG_FORMAT  'pretty': coloured, one line each   (default)
//               'json':   one JSON object per line, for log collectors
//
// Usage:
//   const log = require('./lib/logger').child('planner');
//   log.info('casualty notified');
//   log.error({ err }, 'insert failed');   // `err` prints its stack
// ---------------------------------------------------------------------------

const pino = require('pino');
require('dotenv').config();

const level  = (process.env.LOG_LEVEL || 'info').toLowerCase();
const pretty = (process.env.LOG_FORMAT || 'pretty').toLowerCase() !== 'json';

const root = pino({
  level,
  transport: pretty ? {
    target: 'pino-pretty',
    options: {
      translateTime: 'SYS:HH:MM:ss.l',
      ignore:        'pid,hostname,scope',
      messageFormat: '{if scope}[{scope}] {end}{msg}',
    },
  } : undefined,
});

module.exports = {
  root,
  /** A logger whose lines are tagged `[scope]`. */
  child: scope => root.child({ scope }),
};
