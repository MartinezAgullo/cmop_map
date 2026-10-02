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
const clientLogRoutes = require('./routes/client-log');
const logsRoutes      = require('./routes/logs');

const http      = require('http');
const sseBroker = require('./lib/sse-broker');
const services  = require('./config/services');
const logger    = require('./lib/logger');
const { errorDetail }         = require('./lib/error-detail');
const { createRequestLogger } = require('./lib/request-logger');
const { httpProbe, checkDependencies } = require('./lib/dependency-check');

const log      = logger.child('server');
const proxyLog = logger.child('proxy');

// ---------------------------------------------------------------------------
// Process-level failures: log them instead of dying silently
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  log.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'Uncaught exception, exiting');
  process.exit(1);
});

const app  = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());

// One line per request.  Static files, the SSE stream, the health check, the
// browser's own log reports and the simulation's per-second position PUTs
// drop to debug so they do not drown the rest.
const POSITION_KEYS = ['latitud', 'longitud'];
function isQuietRequest(req) {
  const url = req.originalUrl;
  if (!url.startsWith('/api/')) return true;
  if (url.startsWith('/api/events') && req.method === 'GET') return true;
  if (url.startsWith('/api/client-log')) return true;
  if (url.startsWith('/api/logs/')) return true;
  if (req.method === 'PUT' && url.startsWith('/api/entities/') && req.body
      && Object.keys(req.body).every(k => POSITION_KEYS.includes(k))) return true;
  return false;
}
app.use(createRequestLogger({ logger: logger.child('http'), isQuiet: isQuietRequest }));

// ---------------------------------------------------------------------------
// Vision Agent proxy — forwards /api/vision/* to vision_agent service
//
// Mounted BEFORE express.json() on purpose.  A request body is a stream that
// can only be read once: if the JSON parser drains it first, the pipe below
// forwards zero bytes while still passing on the original Content-Length, and
// the vision agent blocks waiting for a body that never arrives.
// ---------------------------------------------------------------------------
const VISION_BASE = services.vision;

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
    proxyLog.error(`vision_agent ${req.method} ${target} failed: ${errorDetail(err)}`);
    if (res.headersSent) return res.end();
    res.status(502).json({ success: false, message: `Cannot reach vision agent: ${errorDetail(err)}` });
  });

  req.pipe(upstream, { end: true });
}

app.use('/api/vision', (req, res) => _proxyToVision(req, res));

// Log batches from the Python services can carry long tracebacks: a larger
// limit, parsed before the global parser (which then skips the parsed body).
app.use('/api/logs/ingest', express.json({ limit: '2mb' }));
app.use(express.json());                          // replaces body-parser
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/entities',   entitiesRoutes);
app.use('/api/medical',    medicalRoutes);
app.use('/api/scenarios',  scenariosRoutes);
app.use('/api/schema',     schemaRoutes);
app.use('/api/client-log', clientLogRoutes);

// ---------------------------------------------------------------------------
// Live log page — every terminal line, in a browser tab.  For demos reached
// over a port forward, where nobody sees this terminal.  LOG_VIEWER=off hides
// it: like the rest of this API it has no authentication.
// ---------------------------------------------------------------------------
const LOG_VIEWER_ON = (process.env.LOG_VIEWER || 'on').toLowerCase() !== 'off';
if (LOG_VIEWER_ON) {
  app.use('/api/logs', logsRoutes);
  app.get('/logs', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'logs.html')));
}

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
  logger.child('events').info(`${payload.type} from ${req.ip} → ${sseBroker.clientCount()} browser(s)`);
  sseBroker.broadcast(payload);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Planner proxy — forwards to medevac_planner task server (avoids CORS)
// ---------------------------------------------------------------------------
const PLANNER_BASE      = services.planner;
const PLANNER_TIMEOUT_MS = 30000;

/** Forward to the planner and relay its JSON answer; log every way it can fail. */
function _proxyToPlanner(method, path, res) {
  const target   = `${PLANNER_BASE}${path}`;
  const upstream = http.request(target, { method }, (upRes) => {
    let body = '';
    upRes.on('data', chunk => { body += chunk; });
    upRes.on('end', () => {
      try { res.status(upRes.statusCode).json(JSON.parse(body)); }
      catch (_) {
        proxyLog.error({ body: body.slice(0, 300) }, `planner ${method} ${target} answered ${upRes.statusCode} with invalid JSON`);
        res.status(502).json({ success: false, message: 'Invalid JSON from planner' });
      }
    });
  });
  upstream.setTimeout(PLANNER_TIMEOUT_MS, () => {
    upstream.destroy(new Error(`no answer after ${PLANNER_TIMEOUT_MS / 1000} s`));
  });
  upstream.on('error', (err) => {
    proxyLog.error(`planner ${method} ${target} failed: ${errorDetail(err)}`);
    res.status(502).json({ success: false, message: `Cannot reach planner: ${errorDetail(err)}` });
  });
  upstream.end();
}

/** The planner path of a task, plus *suffix*. */
const _taskPath = (req, suffix) => `/tasks/${req.params.taskId}${suffix}`;

app.get('/api/planner/assignments', (req, res) => _proxyToPlanner('GET', '/assignments', res));
app.get('/api/planner/tasks/:taskId/routes', (req, res) => _proxyToPlanner('GET', _taskPath(req, '/routes'), res));
app.post('/api/planner/tasks/:taskId/simulate',          (req, res) => _proxyToPlanner('POST',   _taskPath(req, '/simulate'), res));
app.delete('/api/planner/tasks/:taskId/simulate',        (req, res) => _proxyToPlanner('DELETE', _taskPath(req, '/simulate'), res));
app.post('/api/planner/tasks/:taskId/simulate/resume',   (req, res) => _proxyToPlanner('POST',   _taskPath(req, '/simulate/resume'), res));
app.post('/api/planner/tasks/:taskId/simulate/restart',  (req, res) => _proxyToPlanner('POST',   _taskPath(req, '/simulate/restart'), res));

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

app.use((err, req, res, _next) => {
  log.error({ err }, `Unhandled error in ${req.method} ${req.originalUrl}`);
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
  log.info('DB migrations applied');
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
/** Whether the CMOP schema exists, so a fresh database says "run init-db" up front. */
async function probeDatabase() {
  try {
    const { rows } = await pool.query("SELECT to_regclass('puntos_interes') AS t");
    return rows[0].t
      ? { ok: true,  detail: 'schema ready' }
      : { ok: false, detail: 'reachable but the schema is missing: run npm run init-db' };
  } catch (err) {
    return { ok: false, detail: errorDetail(err) };
  }
}

const server = app.listen(PORT, () => {
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
║   📜 Logs:      http://localhost:${PORT}/logs           ║
║   💚 Env:     ${process.env.NODE_ENV || 'development'}                            ║
╚══════════════════════════════════════════════════════╝
  `);

  // Best-effort: the migration only adds an enum value, and it already skips
  // itself when init-db.js has not been run.  Awaiting it here without a catch
  // turned an unreachable database into an unhandled rejection that killed the
  // process — after the port was already bound.
  runMigrations().catch(err => {
    log.warn(`DB migrations skipped: ${errorDetail(err)}`);
  });

  const hint = logger.root.level === 'debug' ? '' : ' (set LOG_LEVEL=debug for more)';
  log.info(`Log level: ${logger.root.level}${hint}`);
  if (LOG_VIEWER_ON) log.info(`Live logs: http://localhost:${PORT}/logs`);
  checkDependencies([
    { name: 'postgres    ', target: pool.target,       probe: probeDatabase },
    { name: 'planner     ', target: services.planner,  probe: httpProbe(services.planner) },
    { name: 'pfc_agent   ', target: services.pfcAgent, probe: httpProbe(services.pfcAgent) },
    { name: 'vision_agent', target: services.vision,   probe: httpProbe(services.vision) },
  ], logger.child('deps'));
});

server.on('error', (err) => {
  const hint = err.code === 'EADDRINUSE' ? `: port ${PORT} is taken, is another server still running?` : '';
  log.fatal({ err }, `Cannot start the server${hint}`);
  process.exit(1);
});

module.exports = app;
