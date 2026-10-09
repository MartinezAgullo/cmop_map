// tests/telemetry.test.js — run with `npm test`

const test   = require('node:test');
const assert = require('node:assert/strict');
const { SpanKind, TraceFlags } = require('@opentelemetry/api');
const { SamplingDecision }     = require('@opentelemetry/sdk-trace-base');
const { isUntracedRequest, skipRootClients, dropUnsampledTraceIds } = require('../lib/telemetry');
const { terminalMessage } = require('../lib/logger');
const { ingestedEntry }   = require('../routes/logs');

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

test('traces API requests, not assets, streams, log plumbing or health checks', () => {
  const untraced = (method, url) => isUntracedRequest({ method, url });
  assert.equal(untraced('POST', '/api/entities'), false);
  assert.equal(untraced('PUT', '/api/entities/7'), false);
  assert.equal(untraced('GET', '/js/app.js'), true);
  assert.equal(untraced('GET', '/health'), true);
  assert.equal(untraced('GET', '/api/events'), true);
  assert.equal(untraced('POST', '/api/events/notify'), false);
  assert.equal(untraced('POST', '/api/logs/ingest'), true);
  assert.equal(untraced('POST', '/api/client-log'), true);
});

test('an outbound call outside any request starts no trace; other roots do', () => {
  const decide = kind => skipRootClients.shouldSample(undefined, TRACE_ID, 'x', kind).decision;
  assert.equal(decide(SpanKind.CLIENT), SamplingDecision.NOT_RECORD);
  assert.equal(decide(SpanKind.SERVER), SamplingDecision.RECORD_AND_SAMPLED);
});

test('a log line keeps its trace id only when the trace is recorded', () => {
  const span = flags => ({ spanContext: () => ({ traceFlags: flags }) });
  const line = () => ({ msg: 'x', trace_id: TRACE_ID, span_id: '00f067aa0ba902b7', trace_flags: '01' });

  const sampled = line();
  dropUnsampledTraceIds(span(TraceFlags.SAMPLED), sampled);
  assert.equal(sampled.trace_id, TRACE_ID);

  const unsampled = line();
  dropUnsampledTraceIds(span(TraceFlags.NONE), unsampled);
  assert.equal(unsampled.trace_id, undefined);
});

test('the terminal line ends with the short trace id, as in the Python services', () => {
  assert.equal(terminalMessage({ scope: 'http', msg: 'POST /api/entities 201 4 ms', trace_id: TRACE_ID }, 'msg'),
               '[http] POST /api/entities 201 4 ms (trace 4bf92f35)');
  assert.equal(terminalMessage({ msg: 'ready' }, 'msg'), 'ready');
});

test('ingested entries keep a well-formed trace id and drop anything else', () => {
  assert.equal(ingestedEntry({ msg: 'x', trace_id: TRACE_ID }, 'medevac-planner').trace_id, TRACE_ID);
  assert.equal(ingestedEntry({ msg: 'x', trace_id: '<script>' }, 'medevac-planner').trace_id, undefined);
});
