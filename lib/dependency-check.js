// lib/dependency-check.js
//
// Probes the services this server talks to and logs one line per service, so
// a wrong URL, a stopped service or a missing schema shows in the first
// second instead of on the first failed click.
//
// A check is { name, target, probe }, where probe() resolves to
// { ok: boolean, detail: string } and never rejects.
// ---------------------------------------------------------------------------

const { errorDetail } = require('./error-detail');

/** Reachable means any HTTP answer at all: a 404 still proves the service is up. */
function httpProbe(url, timeoutMs = 3000) {
  return async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      return { ok: true, detail: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, detail: errorDetail(err) };
    }
  };
}

async function checkDependencies(checks, logger) {
  const results = await Promise.all(checks.map(async check => ({ ...check, ...(await check.probe()) })));
  for (const { name, target, ok, detail } of results) {
    if (ok) logger.info(`✅ ${name} ${target} (${detail})`);
    else    logger.warn(`❌ ${name} ${target}: ${detail}`);
  }
  return results;
}

module.exports = { httpProbe, checkDependencies };
