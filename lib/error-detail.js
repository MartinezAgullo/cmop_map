// lib/error-detail.js
//
// One readable line for a network or HTTP error.
//
// Node's fetch() rejects with a bare "fetch failed": the reason that matters
// when debugging a setup (ECONNREFUSED, ENOTFOUND, a timeout…) sits in
// err.cause.  The http module puts the code on the error itself.  A host that
// resolves to several addresses (localhost → ::1 and 127.0.0.1) fails with an
// AggregateError holding one error per address tried.
// ---------------------------------------------------------------------------

/** "connect ECONNREFUSED 127.0.0.1:8400" from one low-level error. */
function describeOne(err) {
  if (err.code && err.address) {
    return `${err.syscall || 'connect'} ${err.code} ${err.address}${err.port ? `:${err.port}` : ''}`;
  }
  return err.code && !String(err.message).includes(err.code)
    ? `${err.code} ${err.message}`.trim()
    : err.message || err.code || String(err);
}

function errorDetail(err) {
  if (!err) return 'unknown error';
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'timed out';

  const source = err.cause || err;
  if (Array.isArray(source.errors) && source.errors.length) {
    return [...new Set(source.errors.map(describeOne))].join(' / ');
  }
  return describeOne(source);
}

module.exports = { errorDetail };
