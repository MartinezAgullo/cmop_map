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

const http = require('http');

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
// Planner proxy — forwards to medevac_planner task server (avoids CORS)
// ---------------------------------------------------------------------------
const PLANNER_BASE = (process.env.MEDEVAC_PLANNER_URL || 'http://localhost:8400').replace(/\/$/, '');

app.get('/api/planner/tasks/:taskId/routes', (req, res) => {
  const target = `${PLANNER_BASE}/tasks/${req.params.taskId}/routes`;
  http.get(target, (upstream) => {
    let body = '';
    upstream.on('data', chunk => { body += chunk; });
    upstream.on('end', () => {
      try {
        res.status(upstream.statusCode).json(JSON.parse(body));
      } catch {
        res.status(502).json({ success: false, message: 'Invalid JSON from planner' });
      }
    });
  }).on('error', (err) => {
    res.status(502).json({ success: false, message: `Cannot reach planner: ${err.message}` });
  });
});

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
╔══════════════════════════════════════════════════════╗
║   🗺️  CMOP Map Server                                 ║
║                                                      ║
║   🔌 Port:    ${PORT}                                   ║
║   🌐 URL:     http://localhost:${PORT}                  ║
║   📊 Entities:  http://localhost:${PORT}/api/entities   ║
║   🏥 Medical:   http://localhost:${PORT}/api/medical    ║
║   🎬 Scenarios: http://localhost:${PORT}/api/scenarios  ║
║   📋 Schema:    http://localhost:${PORT}/api/schema     ║
║   💚 Env:     ${process.env.NODE_ENV || 'development'}                            ║
╚══════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
