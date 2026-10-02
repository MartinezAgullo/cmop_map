// lib/dependency-monitor.js
//
// Keeps probing the services this server talks to and logs when one changes
// state, not on every probe.  A wrong URL or a missing schema still shows up
// early, a service that is just slower to start than this one does not raise
// a false alarm, and a service that drops out later is reported when it does.
//
// A check is { name, target, probe, graceMs? }, where probe() resolves to
// { ok: boolean, detail: string } and never rejects.  graceMs is how long
// after start a check may stay unreachable before it is a warning: 0 for a
// dependency that must already be up (the database), longer for services
// launched alongside this one.
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

const UNKNOWN = { ok: null, detail: 'not checked yet', since: null, warned: false };

/**
 * The next state of one check after a probe, and the line to log for it (or
 * null when nothing changed).  `elapsedMs` is the time since monitoring
 * started.
 */
function nextState(prev, { ok, detail }, { elapsedMs, graceMs, now }) {
  const changed = ok !== prev.ok;
  const state = { ok, detail, since: changed ? now : prev.since, warned: ok ? false : prev.warned };

  if (ok) {
    return { state, log: changed ? { level: 'info', icon: '✅', text: `up (${detail})` } : null };
  }
  if (prev.ok === true) {
    return { state: { ...state, warned: true }, log: { level: 'warn', icon: '❌', text: `went down: ${detail}` } };
  }
  if (prev.warned) return { state, log: null };
  if (elapsedMs < graceMs) {
    const log = prev.ok === null
      ? { level: 'info', icon: '⏳', text: `not up yet, waiting up to ${Math.round(graceMs / 1000)}s (${detail})` }
      : null;
    return { state, log };
  }
  const text = graceMs > 0 ? `still unreachable after ${Math.round(graceMs / 1000)}s: ${detail}` : detail;
  return { state: { ...state, warned: true }, log: { level: 'warn', icon: '❌', text } };
}

/**
 * Probe every check now and then every `intervalMs`.  Returns { stop, status }:
 * status() lists each check's current state, for a health endpoint.
 */
function createDependencyMonitor(checks, logger, { intervalMs = 10000, now = Date.now } = {}) {
  const width = Math.max(...checks.map(c => c.name.length));
  const states = new Map(checks.map(c => [c.name, UNKNOWN]));
  let startedAt = null;
  let timer = null;
  let stopped = false;

  async function probeOne(check) {
    const result = await check.probe();
    const t = now();
    const { state, log } = nextState(states.get(check.name), result, {
      elapsedMs: t - startedAt, graceMs: check.graceMs ?? 0, now: t,
    });
    states.set(check.name, { ...state, checkedAt: t });
    if (log) logger[log.level](`${log.icon} ${check.name.padEnd(width)} ${check.target}: ${log.text}`);
  }

  async function round() {
    await Promise.all(checks.map(probeOne));
    if (stopped) return;
    timer = setTimeout(round, intervalMs);
    timer.unref();   // never keeps the process alive on its own
  }

  function start() {
    startedAt = now();
    return round();
  }

  function stop() {
    stopped = true;
    clearTimeout(timer);
  }

  function status() {
    return checks.map(({ name, target }) => {
      const { ok, detail, since, checkedAt } = states.get(name);
      const iso = ms => (ms == null ? null : new Date(ms).toISOString());
      return { name, target, ok, detail, since: iso(since), checkedAt: iso(checkedAt) };
    });
  }

  return { start, stop, status };
}

module.exports = { httpProbe, nextState, createDependencyMonitor };
