// lib/telemetry.js
//
// OpenTelemetry for this server: traces and logs over OTLP to the OTel
// Collector of latacc-medevac's docker-compose.observability.yml, which routes
// traces to Jaeger and logs to Loki.  start() is the first thing server.js
// does, before express, pg or pino are loaded, so their instrumentations can
// patch them.
//
// What is traced:
//   - each API request this server receives, joining the caller's trace when
//     it sends a `traceparent` (the Python services do);
//   - the database queries and the outbound calls made while handling one,
//     with `traceparent` on the latter: a casualty added on the map, its
//     notification to the planner and the planning it starts are one trace.
// Not traced: static files, the SSE streams, the log endpoints, /health, and
// an outbound call made outside any request (the dependency monitor's probes).
// A request whose caller says "not sampled" (the simulator's position updates)
// is skipped too.
//
// Every pino line also goes to Loki, and a line written inside a trace carries
// `trace_id`, which the terminal and the /logs page show.
//
//   OTEL_EXPORTER_OTLP_ENDPOINT  Collector OTLP/gRPC URL (default: http://localhost:4317)
//   OTEL_SDK_DISABLED=true       turns all of it off
// A Collector that is down costs only dropped telemetry: exports are batched
// in the background and their errors are not logged.
// ---------------------------------------------------------------------------

require('dotenv').config();

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ParentBasedSampler, AlwaysOnSampler, SamplingDecision } = require('@opentelemetry/sdk-trace-base');
const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-grpc');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation, ExpressLayerType } = require('@opentelemetry/instrumentation-express');
const { UndiciInstrumentation } = require('@opentelemetry/instrumentation-undici');
const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg');
const { PinoInstrumentation } = require('@opentelemetry/instrumentation-pino');
const { SpanKind, TraceFlags } = require('@opentelemetry/api');

const SERVICE_NAME      = 'cmop-map';
const SERVICE_NAMESPACE = 'latacc-medevac';
const DEFAULT_ENDPOINT  = 'http://localhost:4317';

/** Requests not worth a trace: browser assets, long-lived streams, log plumbing, health checks. */
function isUntracedRequest(req) {
  const url = req.url || '';
  if (!url.startsWith('/api/')) return true;
  if (url.startsWith('/api/events') && req.method === 'GET') return true;
  if (url.startsWith('/api/client-log')) return true;
  if (url.startsWith('/api/logs/')) return true;
  return false;
}

/** Roots are sampled unless they are outbound calls; children follow their parent. */
const skipRootClients = {
  shouldSample: (_context, _traceId, _name, kind) => ({
    decision: kind === SpanKind.CLIENT ? SamplingDecision.NOT_RECORD : SamplingDecision.RECORD_AND_SAMPLED,
  }),
  toString: () => 'SkipRootClients',
};

/** Leave `trace_id` off a log line whose trace is not recorded: it would lead nowhere. */
function dropUnsampledTraceIds(span, record) {
  if (span.spanContext().traceFlags & TraceFlags.SAMPLED) return;
  delete record.trace_id;
  delete record.span_id;
  delete record.trace_flags;
}

/**
 * Start tracing and log export.  Returns { endpoint }, null when turned off.
 */
function start() {
  if ((process.env.OTEL_SDK_DISABLED || '').toLowerCase() === 'true') {
    return { endpoint: null };
  }
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || DEFAULT_ENDPOINT;
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name':      SERVICE_NAME,
      'service.namespace': SERVICE_NAMESPACE,
    }),
    sampler:             new ParentBasedSampler({ root: skipRootClients, localParentSampled: new AlwaysOnSampler() }),
    traceExporter:       new OTLPTraceExporter({ url: endpoint }),
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: endpoint }) })],
    // No metrics: the Collector has no metrics pipeline, and the SDK would
    // otherwise start an OTLP metrics exporter of its own.
    metricReaders:       [],
    instrumentations: [
      new HttpInstrumentation({ ignoreIncomingRequestHook: isUntracedRequest }),
      new ExpressInstrumentation({ ignoreLayersType: [ExpressLayerType.MIDDLEWARE] }),
      new UndiciInstrumentation(),
      new PgInstrumentation({ requireParentSpan: true }),
      new PinoInstrumentation({ logHook: dropUnsampledTraceIds }),
    ],
  });
  sdk.start();

  // Flush what is batched before exiting; a signal listener replaces the
  // default exit, so exit explicitly once the flush is done or has timed out.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      const exit = () => process.exit(0);
      sdk.shutdown().then(exit, exit);
      setTimeout(exit, 2000).unref();
    });
  }
  return { endpoint };
}

module.exports = { start, isUntracedRequest, skipRootClients, dropUnsampledTraceIds };
