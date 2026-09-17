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

// ---------------------------------------------------------------------------
// Vision Agent proxy — forwards /api/vision/* to vision_agent service
//
// Mounted BEFORE express.json() on purpose.  A request body is a stream that
// can only be read once: if the JSON parser drains it first, the pipe below
// forwards zero bytes while still passing on the original Content-Length, and
// the vision agent blocks waiting for a body that never arrives.
// ---------------------------------------------------------------------------
const VISION_BASE = (process.env.VISION_AGENT_URL || 'http://localhost:8500').replace(/\/$/, '');

function _proxyToVision(req, res) {
  // Express already strips the /api/vision mount path from req.url
  const visionPath = req.url || '/';
  const target = `${VISION_BASE}${visionPath}`;

  const options = {
    method: req.method,
    headers: { ...req.headers, host: new URL(VISION_BASE).host },
  };

  const upstream = http.request(target, options, (upRes) => {
    res.writeHead(upRes.statusCode, upRes.headers);
    upRes.pipe(res, { end: true });
  });
  upstream.on('error', (err) => {
    res.status(502).json({ success: false, message: `Cannot reach vision agent: ${err.message}` });
  });

  req.pipe(upstream, { end: true });
}

app.use('/api/vision', (req, res) => _proxyToVision(req, res));

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
  // The browser switches on `type`, so a payload without one is dead weight
  // on every open connection.  Note this endpoint is still unauthenticated —
  // adding a shared secret means changing the Python services too.
  const payload = req.body;
  if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') {
    return res.status(400).json({ ok: false, message: 'Body must be an object with a string `type`' });
  }
  sseBroker.broadcast(payload);
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
app.listen(PORT, () => {
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

  // Best-effort: the migration only adds an enum value, and it already skips
  // itself when init-db.js has not been run.  Awaiting it here without a catch
  // turned an unreachable database into an unhandled rejection that killed the
  // process — after the port was already bound.
  runMigrations().catch(err => {
    console.warn(`⚠️  DB migrations skipped: ${err.message}`);
  });
});

module.exports = app;
