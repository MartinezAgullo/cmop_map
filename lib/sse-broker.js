// lib/sse-broker.js
// Singleton SSE (Server-Sent Events) broker.
//
// Usage:
//   const sseBroker = require('./lib/sse-broker');
//   app.get('/api/events', sseBroker.handler);   // client subscribes
//   sseBroker.broadcast({ type: 'entity_updated', ... });  // push to all
// ---------------------------------------------------------------------------

const clients = new Set();

module.exports = {
  handler(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write('data: {"type":"connected"}\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
  },

  broadcast(payload) {
    const msg = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) {
      try { res.write(msg); } catch (_) { clients.delete(res); }
    }
  },
};
