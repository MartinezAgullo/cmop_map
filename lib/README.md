# lib

Small, mostly pure modules that the routes, the models and `server.js` share. No module here imports a route; the dependency only goes the other way.

## Layout and purpose

### Domain rules

| File | What it does |
|---|---|
| `capacity-limits.js` | Ceilings for a vehicle's `capacity` and checks on shelter and facility `max_capacity`/`occupancy`. One source for the API, the scenario loader and the New Entity form. |
| `hazard-types.js` | The kinds of hazard zone (flood, collapse...) with labels and colours. Source of truth for the DB enum, validation and the map legend. |
| `hazard-zone-input.js` | Validation of what is sent to `/api/hazard-zones`; turns any GeoJSON polygon into a MultiPolygon. |
| `coordinates.js` | Whether a longitude and latitude can be a place on Earth. |
| `casualty-hooks.js` | What the planner and `pfc_agent` are told when a casualty is created or its triage, priority or status changes. |

### Scenarios

| File | What it does |
|---|---|
| `scenario-files.js` | Where scenario modules live (`scripts/scenarios/`) and how a name is validated. |
| `scenario-loader.js` | Writes a scenario into the database in one transaction. Used by `scripts/load-scenario.js` and `routes/scenarios.js`. |
| `mascal-generator.js` | Random mass-casualty scenarios around a point, deterministic for a given seed. Returns the same shape as a scenario file. |

### Live updates and notifications

| File | What it does |
|---|---|
| `sse-channel.js` | A Server-Sent Events channel: a handler browsers subscribe to plus `broadcast()`. |
| `sse-broker.js` | The singleton channel for the map (entity and planner events). |
| `notifier.js` | Fire-and-forget JSON POSTs to other services; every outcome is logged and the promise never rejects. |

### Errors and logging

| File | What it does |
|---|---|
| `db-error.js` | Maps a PostgreSQL error to the HTTP answer it deserves (4xx for a caller's mistake). |
| `error-detail.js` | One readable line for a network error (`fetch failed` hides the real cause in `err.cause`). |
| `logger.js` | The one pino logger (`LOG_LEVEL`, `LOG_FORMAT`, `LOG_BUFFER_SIZE`). |
| `log-buffer.js` | Keeps the last N log entries in memory for the `/logs` page. |
| `request-logger.js` | Express middleware: one log line per request, level by outcome. |

### Observability

| File | What it does |
|---|---|
| `telemetry.js` | OpenTelemetry traces and logs over OTLP (Jaeger and Loki through the collector of `latacc-medevac`). `start()` runs first in `server.js`. |
| `dependency-monitor.js` | Probes the services this server talks to and logs when one changes state. |

## Notes

- Keep a rule in one file: if a limit or a list is needed by the API and by a script, it belongs here and both import it.
- `telemetry.js` must be loaded before express, pg and pino so their instrumentation can patch them.
