// lib/sse-broker.js
// Singleton SSE (Server-Sent Events) broker.
//
// Usage:
//   const sseBroker = require('./lib/sse-broker');
//   app.get('/api/events', sseBroker.handler);   // client subscribes
//   sseBroker.broadcast({ type: 'entity_updated', ... });  // push to all
// ---------------------------------------------------------------------------

const log = require('./logger').child('sse');

const clients = new Set();

module.exports = {
  handler(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write('data: {"type":"connected"}\n\n');
    clients.add(res);
    log.info(`Browser connected from ${req.ip} (${clients.size} open)`);
    req.on('close', () => {
      clients.delete(res);
      log.info(`Browser disconnected from ${req.ip} (${clients.size} open)`);
    });
  },

  broadcast(payload) {
    const msg = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) {
      try { res.write(msg); } catch (err) {
        clients.delete(res);
        log.warn(`Dropped a browser that could not be written to: ${err.message}`);
      }
    }
    log.debug(`Broadcast ${payload.type} to ${clients.size} browser(s)`);
  },

  clientCount: () => clients.size,
};
