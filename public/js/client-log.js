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
// cannot flood the terminal; the next one that goes through carries how many
// were folded.  Errors also raise a small badge in the page corner (click to
// dismiss), so a broken page is never silent.
// Also exposed as window.clientLog.{error,warn,info}.
// ---------------------------------------------------------------------------

(function () {
  const ENDPOINT    = '/api/client-log';
  const THROTTLE_MS = 10000;
  const lastSent    = new Map();   // message → timestamp
  const folded      = new Map();   // message → repeats dropped since last send
  let   errorCount  = 0;
  let   badge       = null;

  function showBadge() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', showBadge, { once: true }); return; }
    if (!badge) {
      badge = document.createElement('div');
      badge.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;padding:6px 10px;' +
        'border-radius:6px;background:#7f1d1d;color:#fff;font:12px/1.3 system-ui,sans-serif;' +
        'cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4)';
      badge.title = 'Click to dismiss';
      badge.addEventListener('click', () => { badge.remove(); badge = null; errorCount = 0; });
      document.body.appendChild(badge);
    }
    badge.textContent = `⚠ ${errorCount} error${errorCount > 1 ? 's' : ''} in this page (see server log)`;
  }

  function describe(value) {
    if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }

  function send(level, message, context) {
    const now = Date.now();
    if (level === 'error') { errorCount++; showBadge(); }
    if (now - (lastSent.get(message) || 0) < THROTTLE_MS) {
      folded.set(message, (folded.get(message) || 0) + 1);
      return;
    }
    lastSent.set(message, now);
    const repeats = folded.get(message) || 0;
    folded.delete(message);
    if (repeats) context = { ...context, repeats };
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
