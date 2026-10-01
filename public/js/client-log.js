// public/js/client-log.js
// ---------------------------------------------------------------------------
// Sends this page's errors to the server, which prints them in its terminal
// under [browser] (routes/client-log.js).  Load it first, before any other
// script or stylesheet, so their load failures are caught too.
//
// Reported:
//   - console.error / console.warn calls
//   - uncaught exceptions and unhandled promise rejections
//   - scripts and stylesheets that fail to load (CDN down, offline network)
//
// The same message is sent at most once every THROTTLE_MS, so a retry loop
// cannot flood the terminal.  Also exposed as window.clientLog.{error,warn,info}.
// ---------------------------------------------------------------------------

(function () {
  const ENDPOINT    = '/api/client-log';
  const THROTTLE_MS = 10000;
  const lastSent    = new Map();   // message → timestamp

  function describe(value) {
    if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }

  function send(level, message, context) {
    const now = Date.now();
    if (now - (lastSent.get(message) || 0) < THROTTLE_MS) return;
    lastSent.set(message, now);
    try {
      fetch(ENDPOINT, {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        body:      JSON.stringify({ level, message, context: { page: location.pathname, ...context } }),
        keepalive: true,
      }).catch(() => {});   // the server is down: nowhere to report it
    } catch (_) { /* never let reporting break the page */ }
  }

  for (const level of ['error', 'warn']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      send(level, args.map(describe).join(' '));
    };
  }

  // Capture phase: resource load errors do not bubble up to window.
  window.addEventListener('error', (event) => {
    const el = event.target;
    if (el && el !== window) {
      if (el.tagName === 'SCRIPT' || el.tagName === 'LINK') {
        send('error', `Failed to load ${el.src || el.href}`);
      }
      return;
    }
    send('error', event.error ? describe(event.error) : event.message,
         { source: `${event.filename}:${event.lineno}:${event.colno}` });
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    send('error', `Unhandled promise rejection: ${describe(event.reason)}`);
  });

  window.clientLog = {
    error: (message, context) => send('error', message, context),
    warn:  (message, context) => send('warn',  message, context),
    info:  (message, context) => send('info',  message, context),
  };
})();
