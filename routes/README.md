# routes

The REST API of the CMOP map, one Express router per area. `server.js` mounts them under `/api`. Agents (`cmop_mcp` in `latacc-medevac`), the web UI and the Raspberry Pi all go through these endpoints. A change to a response shape is a change to a contract: see `.okf/contracts/edge-mirror-rule.md` in `latacc-medevac`.

## Layout

```
routes/
├── entities.js      everything on the map: units, vehicles, shelters, civilians...
├── medical.js       medical records of casualties and civilians, 9-Line, vitals
├── hazard-zones.js  floods, collapses and other zones routes avoid
├── scenarios.js     list, load and generate scenarios
├── schema.js        GET /api/schema: self-description of the data model
├── logs.js          server log stream (SSE) and ingest from other services
└── client-log.js    browser errors reported to the server terminal
```

## Endpoints

| File | Mount | What it offers |
|---|---|---|
| `entities.js` | `/api/entities` | `GET /` all, `GET /:id`, `GET /categoria/:c`, `GET /alliance/:a`, `GET /cerca/:lng/:lat` (nearby), `GET /casevac`, `GET /meta/categorias`, `GET /meta/capacity-limit`; `POST /`, `POST /batch`, `PUT /:id`, `DELETE /:id`. Every response includes `medical: {...} \| null`. Writes notify the planner and push an SSE event to open maps. |
| `medical.js` | `/api/medical` | `GET /casualties`, `GET /triage/:color`, `GET /evac-stage/:stage`; per entity `GET`/`POST /:id/nine-line`, `PUT /:id` (a new triage, priority or status notifies the planner and `pfc_agent`), `POST /:id/vitals`, `DELETE /:id`. Civilians have a record too, but the casualty lists leave them out. |
| `hazard-zones.js` | `/api/hazard-zones` | `GET /` (`?type=`, `?active=`), `GET /meta/types`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`. Geometry is a GeoJSON MultiPolygon. |
| `scenarios.js` | `/api/scenarios` | `GET /` list, `GET /current`, `POST /load/:name`, `GET /presets`, `POST /generate` (random MASCAL, never saved). |
| `schema.js` | `/api/schema` | Categories, alliances, triage colours, the 9-Line structure. `cmop_mcp` reads it to discover the data model. |
| `logs.js` | `/api/logs` | `GET /stream` (SSE, for the `/logs` page), `POST /ingest` (other services send their log lines). |
| `client-log.js` | `/api/client-log` | `POST /` from `public/js/client-log.js`. |

## Conventions

- A route validates its input (`lib/coordinates.js`, `lib/hazard-zone-input.js`, `lib/capacity-limits.js`), calls a model in `models/` and answers; SQL does not live here.
- Database failures go through `lib/db-error.js`, so a caller's mistake is a 4xx with the bad value named, not a bare 500.
- Notifications to other services use `lib/notifier.js` (fire-and-forget, never throws); live updates to maps use `lib/sse-broker.js`.
- Route order matters in Express: fixed paths (`/meta/...`, `/casevac`) are declared before `/:id`.
