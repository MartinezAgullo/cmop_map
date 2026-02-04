// config/database.js
//
// Shared pg Pool. All models and routes import this single instance.
// ---------------------------------------------------------------------------

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'cmop_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL/PostGIS');
});

pool.on('error', (err) => {
  console.error('❌ Pool error:', err);
});

module.exports = pool;
