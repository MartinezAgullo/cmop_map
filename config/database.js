// config/database.js
//
// Shared pg Pool. All models and routes import this single instance.
// ---------------------------------------------------------------------------

const { Pool } = require('pg');
require('dotenv').config();
const log = require('../lib/logger').child('db');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'cmop_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/** host:port/database, for log lines. */
pool.target = `${pool.options.host}:${pool.options.port}/${pool.options.database}`;

// The pool opens connections as load needs them: announce only the first.
let announced = false;
pool.on('connect', () => {
  if (announced) return;
  announced = true;
  log.info(`Connected to PostgreSQL/PostGIS at ${pool.target}`);
});

pool.on('error', (err) => {
  log.error({ err }, `Idle PostgreSQL connection failed (${pool.target})`);
});

module.exports = pool;
