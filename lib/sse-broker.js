// lib/sse-broker.js
// Singleton SSE broker for the map: entity and planner events to every open map.
//
// Usage:
//   const sseBroker = require('./lib/sse-broker');
//   app.get('/api/events', sseBroker.handler);   // client subscribes
//   sseBroker.broadcast({ type: 'entity_updated', ... });  // push to all
// ---------------------------------------------------------------------------

const { createSseChannel } = require('./sse-channel');
const log = require('./logger').child('sse');

const channel = createSseChannel({
  logger:    log,
  label:     'Browser',
  onConnect: send => send({ type: 'connected' }),
});

module.exports = {
  handler: channel.handler,
  clientCount: channel.clientCount,

  broadcast(payload) {
    channel.broadcast(payload);
    log.debug(`Broadcast ${payload.type} to ${channel.clientCount()} browser(s)`);
  },
};
