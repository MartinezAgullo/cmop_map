// lib/logger.js
//
// The one logger every server module uses, built on pino.
// Levels, lowest first: debug · info · warn · error · fatal.
//
//   LOG_LEVEL        lowest level printed               (default: info)
//   LOG_FORMAT       'pretty': coloured, one line each   (default)
//                    'json':   one JSON object per line, for log collectors
//   LOG_BUFFER_SIZE  entries kept in memory for the /logs page (default: 1000)
//
// Every entry goes to the terminal and to `buffer` (lib/log-buffer.js),
// which the /logs page streams from.  Entries carry `service: SERVICE_NAME`,
// since other services push theirs into the same buffer (routes/logs.js).
// A line written inside a trace also carries `trace_id` (lib/telemetry.js),
// and the terminal ends it with the first TRACE_ID_CHARS of it.
//
// Usage:
//   const log = require('./lib/logger').child('planner');
//   log.info('casualty notified');
//   log.error({ err }, 'insert failed');   // `err` prints its stack
// ---------------------------------------------------------------------------

const pino = require('pino');
const { createLogBuffer } = require('./log-buffer');
require('dotenv').config();

const SERVICE_NAME = 'cmop-map';
const TRACE_ID_CHARS = 8;   // as latacc_common.log in latacc-medevac

/** `[scope] msg (trace 4bf92f35)`, each part only when the line has it. */
function terminalMessage(entry, messageKey) {
  const scope = entry.scope ? `[${entry.scope}] ` : '';
  const trace = entry.trace_id ? ` (trace ${entry.trace_id.slice(0, TRACE_ID_CHARS)})` : '';
  return `${scope}${entry[messageKey]}${trace}`;
}

const level  = (process.env.LOG_LEVEL || 'info').toLowerCase();
const pretty = (process.env.LOG_FORMAT || 'pretty').toLowerCase() !== 'json';

// Synchronous writes, so a fatal line still prints when process.exit() follows it.
const terminal = pretty
  ? require('pino-pretty')({
      sync:          true,
      translateTime: 'SYS:HH:MM:ss.l',
      ignore:        'pid,hostname,scope,service,trace_id,span_id,trace_flags',
      messageFormat: terminalMessage,
    })
  : pino.destination({ sync: true });

const buffer = createLogBuffer({ capacity: parseInt(process.env.LOG_BUFFER_SIZE, 10) || 1000 });

const root = pino({ level, base: { service: SERVICE_NAME } }, pino.multistream([
  { level, stream: terminal },
  { level, stream: buffer },
]));

module.exports = {
  root,
  terminalMessage,
  buffer,
  /** A logger whose lines are tagged `[scope]`. */
  child: scope => root.child({ scope }),
};
