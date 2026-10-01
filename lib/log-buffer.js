// lib/log-buffer.js
//
// A log destination that keeps the last `capacity` entries in memory and
// hands each new one to its subscribers.  It accepts the newline-delimited
// JSON that pino writes, so it plugs into pino.multistream() as a stream.
//
// Usage:
//   const buffer = createLogBuffer({ capacity: 1000 });
//   buffer.subscribe(entry => …);   // returns an unsubscribe function
//   buffer.snapshot();              // oldest first
// ---------------------------------------------------------------------------

const LEVEL_NAMES = { 10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' };

function createLogBuffer({ capacity = 1000 } = {}) {
  const entries   = [];
  const listeners = new Set();

  return {
    write(line) {
      let entry;
      try { entry = JSON.parse(line); } catch (_) { return; }
      entry.level = LEVEL_NAMES[entry.level] || String(entry.level);

      entries.push(entry);
      if (entries.length > capacity) entries.shift();
      for (const listener of listeners) {
        try { listener(entry); } catch (_) { /* a broken listener must not stop logging */ }
      }
    },

    snapshot: () => entries.slice(),

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

module.exports = { createLogBuffer };
