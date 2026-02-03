// server.js
const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const entitiesRoutes = require('./routes/entities');
const medicalRoutes  = require('./routes/medical');

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
app.use('/api/entities', entitiesRoutes);         // replaces /api/puntos
app.use('/api/medical',  medicalRoutes);

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
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   🗺️  CMOP Map Server                           ║
║                                                  ║
║   🔌 Port:    ${PORT}                                ║
║   🌐 URL:     http://localhost:${PORT}               ║
║   📊 Entities: http://localhost:${PORT}/api/entities ║
║   🏥 Medical:  http://localhost:${PORT}/api/medical  ║
║   💚 Env:     ${process.env.NODE_ENV || 'development'}                       ║
╚══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
