// lib/request-logger.js
//
// Express middleware: one line per request once its response is closed.
//   "POST /api/entities 400 3 ms: longitud and latitud are required"
//
// The level follows the outcome: 5xx → error, 4xx → warn, else info.
// Requests `isQuiet(req)` accepts (static files, high-rate polling…) drop to
// debug unless they fail with a 5xx.  A 4xx/5xx line carries the `message`
// field of the JSON body the route answered with.
// ---------------------------------------------------------------------------

function levelFor(status, quiet) {
  if (status >= 500) return 'error';
  if (quiet)         return 'debug';
  if (status >= 400) return 'warn';
  return 'info';
}

function createRequestLogger({ logger, isQuiet = () => false }) {
  return (req, res, next) => {
    const started = Date.now();

    const json = res.json.bind(res);
    res.json = body => {
      if (res.statusCode >= 400 && body && typeof body.message === 'string') {
        res.locals.errorMessage = body.message;
      }
      return json(body);
    };

    res.on('close', () => {
      const ms     = Date.now() - started;
      const status = res.headersSent ? res.statusCode : 'aborted';
      const level  = status === 'aborted' ? 'warn' : levelFor(status, isQuiet(req));
      const reason = res.locals.errorMessage ? `: ${res.locals.errorMessage}` : '';
      logger[level](`${req.method} ${req.originalUrl} ${status} ${ms} ms${reason}`);
    });

    next();
  };
}

module.exports = { createRequestLogger };
