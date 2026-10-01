// lib/notifier.js
//
// Fire-and-forget JSON POSTs to another service, with every outcome logged:
//   delivered  → info   "→ planner /casualties/notify 200 (34 ms)"
//   rejected   → warn   with the status and the start of the response body
//   unreachable→ warn   with the real cause (ECONNREFUSED, ENOTFOUND, timed out)
//
// The returned promise never rejects, so callers need neither await nor catch.
//
// Usage:
//   const planner = createNotifier({ service: 'planner', baseUrl, logger });
//   planner('/casualties/notify', { id: 7 });
// ---------------------------------------------------------------------------

const { errorDetail } = require('./error-detail');

const BODY_PREVIEW_CHARS = 300;

function createNotifier({ service, baseUrl, logger, timeoutMs = 5000 }) {
  return async function notify(path, payload) {
    const url     = `${baseUrl}${path}`;
    const started = Date.now();
    logger.debug({ payload }, `→ ${service} ${path}`);
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(timeoutMs),
      });
      const ms = Date.now() - started;
      if (res.ok) {
        logger.info(`→ ${service} ${path} ${res.status} (${ms} ms)`);
        return;
      }
      const body = (await res.text().catch(() => '')).slice(0, BODY_PREVIEW_CHARS);
      logger.warn({ url, body }, `→ ${service} ${path} answered ${res.status} (${ms} ms)`);
    } catch (err) {
      logger.warn({ url }, `→ ${service} ${path} not delivered: ${errorDetail(err)}`);
    }
  };
}

module.exports = { createNotifier };
