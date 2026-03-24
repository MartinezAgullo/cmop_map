// server.js
const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const pool            = require('./config/database');
const entitiesRoutes  = require('./routes/entities');
const medicalRoutes   = require('./routes/medical');
const scenariosRoutes = require('./routes/scenarios');
const schemaRoutes    = require('./routes/schema');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());                          // replaces body-parser
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/entities',   entitiesRoutes);
app.use('/api/medical',    medicalRoutes);
app.use('/api/scenarios',  scenariosRoutes);
app.use('/api/schema',     schemaRoutes);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ---------------------------------------------------------------------------
// Catch-all
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ---------------------------------------------------------------------------
// DB migrations (idempotent — safe to run on every startup)
// ---------------------------------------------------------------------------
async function runMigrations() {
  // ADD VALUE is idempotent via IF NOT EXISTS — no-op if already present
  await pool.query("ALTER TYPE triage_color_enum ADD VALUE IF NOT EXISTS 'BLUE' BEFORE 'BLACK';");
  console.log('✅ DB migrations applied');
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, async () => {
  await runMigrations();
  console.log(`
╔══════════════════════════════════════════════════╗
║   🗺️  CMOP Map Server                           ║
║                                                  ║
║   🔌 Port:    ${PORT}                                ║
║   🌐 URL:     http://localhost:${PORT}               ║
║   📊 Entities:  http://localhost:${PORT}/api/entities  ║
║   🏥 Medical:   http://localhost:${PORT}/api/medical   ║
║   🎬 Scenarios: http://localhost:${PORT}/api/scenarios ║
║   📋 Schema:    http://localhost:${PORT}/api/schema    ║
║   💚 Env:     ${process.env.NODE_ENV || 'development'}                       ║
╚══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
