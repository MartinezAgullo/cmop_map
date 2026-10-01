// lib/sse-channel.js
//
// A Server-Sent Events channel: an Express handler that browsers subscribe
// to, and broadcast() to push a JSON payload to every open connection.
//
//   logger     optional; logs each connection opened, closed or dropped
//   label      who connects, for those lines ("Browser", "Log viewer")
//   onConnect  optional; send => …, to greet a new connection
//
// A comment line goes out every HEARTBEAT_MS so proxies and port forwards
// do not close a connection that is quiet for a while.
// ---------------------------------------------------------------------------

const HEARTBEAT_MS = 25000;

function createSseChannel({ logger, label = 'Client', onConnect } = {}) {
  const clients = new Set();

  function write(res, payload) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  function drop(res, err) {
    if (!clients.delete(res)) return;
    logger?.warn(`${label} dropped, could not be written to: ${err.message}`);
  }

  const heartbeat = setInterval(() => {
    for (const res of clients) {
      try { res.write(': ping\n\n'); } catch (err) { drop(res, err); }
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  return {
    handler(req, res) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      onConnect?.(payload => write(res, payload));
      clients.add(res);
      logger?.info(`${label} connected from ${req.ip} (${clients.size} open)`);
      req.on('close', () => {
        if (!clients.delete(res)) return;
        logger?.info(`${label} disconnected from ${req.ip} (${clients.size} open)`);
      });
    },

    broadcast(payload) {
      for (const res of clients) {
        try { write(res, payload); } catch (err) { drop(res, err); }
      }
    },

    clientCount: () => clients.size,
  };
}

module.exports = { createSseChannel };
