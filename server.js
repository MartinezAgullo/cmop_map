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

const http      = require('http');
const sseBroker = require('./lib/sse-broker');

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
// SSE — real-time push to connected browsers
// ---------------------------------------------------------------------------
app.get('/api/events', sseBroker.handler);

// Allows the Python planner (and other internal services) to push non-entity
// events (e.g. evac_stage_updated) directly to all connected browsers.
app.post('/api/events/notify', (req, res) => {
  sseBroker.broadcast(req.body);
  res.json({ ok: true });
});

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

// Proxy POST /simulate and DELETE /simulate to the medevac planner task server
function _proxyToPlanner(method, req, res, suffix = '/simulate') {
  const target   = `${PLANNER_BASE}/tasks/${req.params.taskId}${suffix}`;
  const upstream = http.request(target, { method }, (upRes) => {
    let body = '';
    upRes.on('data', chunk => { body += chunk; });
    upRes.on('end', () => {
      try { res.status(upRes.statusCode).json(JSON.parse(body)); }
      catch (_) { res.status(502).json({ success: false, message: 'Invalid JSON from planner' }); }
    });
  });
  upstream.on('error', (err) => {
    res.status(502).json({ success: false, message: `Cannot reach planner: ${err.message}` });
  });
  upstream.end();
}

app.post('/api/planner/tasks/:taskId/simulate',          (req, res) => _proxyToPlanner('POST',   req, res));
app.delete('/api/planner/tasks/:taskId/simulate',        (req, res) => _proxyToPlanner('DELETE', req, res));
app.post('/api/planner/tasks/:taskId/simulate/resume',   (req, res) => _proxyToPlanner('POST',   req, res, '/simulate/resume'));
app.post('/api/planner/tasks/:taskId/simulate/restart',  (req, res) => _proxyToPlanner('POST',   req, res, '/simulate/restart'));

// ---------------------------------------------------------------------------
// Planner config (surface selected settings to the frontend)
// ---------------------------------------------------------------------------
app.get('/api/config', (_req, res) => {
  res.json({
    threatRadiusM: parseInt(process.env.PLANNER_THREAT_EXCLUSION_RADIUS_M, 10) || 500,
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
  // Only run migrations if the enum type already exists (i.e. init-db.js has been run)
  const { rows } = await pool.query(
    "SELECT 1 FROM pg_type WHERE typname = 'triage_color_enum'"
  );
  if (rows.length > 0) {
    await pool.query("ALTER TYPE triage_color_enum ADD VALUE IF NOT EXISTS 'BLUE' BEFORE 'BLACK';");
  }
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
