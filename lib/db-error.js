// lib/db-error.js
//
// A failed database call as the HTTP answer it deserves.
//
// Every route used to answer any PostgreSQL error with 500 and a generic
// "Failed to …", so a caller's mistake (an enum value that does not exist, an
// id that is not a number, a duplicate) looked like a server fault, and the
// reason sat in `error`, which the agents' client did not read.  Here a
// caller's mistake becomes a 4xx whose message names the bad value and, for an
// enum, the valid ones; a database that cannot be reached becomes a 503 that
// says where it was looked for; anything else stays a 500.
//
//   classifyDbError(err)              pure: { status, reason, enumType? } or null
//   sendError(res, log, err, what)    answers and logs; await it in a catch
// ---------------------------------------------------------------------------

const { errorDetail } = require('./error-detail');

// The error codes of PostgreSQL that mean "the request is wrong", by status.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const CALLER_ERRORS = {
  '22P02': 400,   // invalid_text_representation: "abc" as an integer, an unknown enum value
  '22003': 400,   // numeric_value_out_of_range
  '22007': 400,   // invalid_datetime_format
  '22008': 400,   // datetime_field_overflow
  '23502': 400,   // not_null_violation
  '23503': 400,   // foreign_key_violation: a reference to a row that does not exist
  '23514': 400,   // check_violation
  '23505': 409,   // unique_violation
};

// The database is down, refusing us, or not the one configured.
const UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'ECONNRESET',
  '57P01', '57P02', '57P03',   // admin_shutdown, crash_shutdown, cannot_connect_now
  '53300',                     // too_many_connections
  '28P01', '28000',            // invalid_password, invalid_authorization_specification
  '3D000',                     // invalid_catalog_name: the database does not exist
]);

// Enum types named after what the caller calls the field.
const ENUM_FIELDS = { categoria_militar: 'categoria' };

const ENUM_VALUE = /invalid input value for enum (\w+): "(.*)"/;

function enumField(type) {
  return ENUM_FIELDS[type] || type.replace(/_enum$/, '');
}

function isUnavailable(err) {
  const source = err.cause || err;
  if (UNAVAILABLE_CODES.has(source.code)) return true;
  return Array.isArray(source.errors) && source.errors.some((e) => UNAVAILABLE_CODES.has(e.code));
}

/**
 * What went wrong, for an error the pg driver threw.
 * Returns { status, reason, enumType } or null when the error is not recognised.
 */
function classifyDbError(err) {
  if (!err) return null;

  if (isUnavailable(err)) {
    return { status: 503, reason: `PostgreSQL unavailable (${errorDetail(err)})` };
  }

  const status = CALLER_ERRORS[err.code];
  if (!status) return null;

  const enumMatch = err.code === '22P02' && ENUM_VALUE.exec(err.message);
  if (enumMatch) {
    const [, type, value] = enumMatch;
    return { status, reason: `"${value}" is not a valid ${enumField(type)}`, enumType: type };
  }
  if (err.code === '23502' && err.column) {
    return { status, reason: `${err.column} is required` };
  }
  // unique, foreign key and check violations put the offending key in `detail`:
  // 'Key (nombre)=(GerCas1) already exists.'
  const detail = err.detail ? ` (${err.detail.replace(/\.$/, '')})` : '';
  const constraint = err.constraint && !detail ? ` (${err.constraint})` : '';
  return { status, reason: `${err.message}${detail}${constraint}` };
}

// ---------------------------------------------------------------------------
// Enum values, read once per type from the database itself, so they can never
// drift from init-db.js.
// ---------------------------------------------------------------------------

const enumCache = new Map();

async function enumValues(pool, type) {
  if (!/^[a-z_][a-z0-9_]*$/.test(type)) return null;
  if (!enumCache.has(type)) {
    const { rows } = await pool.query(`SELECT unnest(enum_range(NULL::${type}))::text AS v`);
    enumCache.set(type, rows.map((r) => r.v));
  }
  return enumCache.get(type);
}

/**
 * Answer a failed request and log it.
 *
 * A recognised caller error is a 4xx with `message` "<what>: <reason>" and a
 * warning without a stack (nothing broke here).  An unreachable database is a
 * 503, logged as an error.  Anything else is a 500 with the stack, as before.
 */
async function sendError(res, log, err, what, { pool = require('../config/database') } = {}) {
  const known = classifyDbError(err);

  if (!known) {
    log.error({ err }, what);
    return res.status(500).json({ success: false, message: what, error: err.message });
  }

  let { reason } = known;
  if (known.enumType) {
    try {
      const values = await enumValues(pool, known.enumType);
      if (values) reason += `; valid values: ${values.join(', ')}`;
    } catch (_) { /* the reason without the list is still the right answer */ }
  }
  if (known.status === 503) {
    reason += `. Is PostgreSQL running at ${pool.target || 'the configured DB_HOST:DB_PORT'}? (docker ps | grep cmop_map_postgis)`;
    log.error(`${what}: ${reason}`);
  } else {
    log.warn(`${what}: ${reason}`);
  }
  return res.status(known.status).json({ success: false, message: `${what}: ${reason}`, error: reason });
}

module.exports = { classifyDbError, sendError, enumValues, _enumCache: enumCache };
