# cmop_map

CMOP (Common Medical Operational Picture) map service. Geospatial layer for military and medical entities with NATO APP-6 symbology, scenario-based data loading, and a REST API consumed by `cmop_fusion_mcp`. This project is an evolution of the [mapa-puntos-interes](https://github.com/MartinezAgullo/mapa-puntos-interes) project.

**Stack:** Node.js + Express · PostgreSQL/PostGIS (Docker) · Leaflet · vanilla JS

---

## Project structure

```
cmop_map/
├── config/
│   └── database.js              # pg Pool — reads .env
├── lib/
│   └── sse-broker.js            # Singleton SSE broadcast module (connected clients registry)
├── models/
│   └── entity.js                # All queries: puntos_interes + medical_details (LEFT JOIN)
├── routes/
│   ├── entities.js              # CRUD for entities (/api/entities) — broadcasts SSE on POST, PUT, DELETE
│   ├── medical.js               # Medical-specific ops (/api/medical)
│   ├── scenarios.js             # List & load scenarios (/api/scenarios)
│   └── schema.js                # Schema introspection (/api/schema) — for MCP servers
├── scripts/
│   ├── init-db.js               # Creates schema (enums, tables, indexes, triggers). No seed.
│   ├── load-scenario.js         # CLI loader: truncates + inserts a scenario in a transaction
│   └── scenarios/
│       ├── valencia_urban.js    # Military-only baseline (no casualties)
│       ├── valencia_medevac.js  # Urban + 3 casualties + medical facilities
│       ├── mariupol_siege.js    # RUS vs UKR urban combat with MEDEVAC
│       └── paris_sud_medevac.js # Multinational exercise (ESP/FRA/DEU/ITA)
├── public/
│   ├── css/styles.css
│   ├── icons/                   # NATO APP-6 SVGs: friendly/ hostile/ neutral/ unknown/
│   │   └── README.md            # Icon resolution algorithm docs
│   ├── index.html
│   ├── js/i18n.js               # UI strings (en/es) + t() / applyI18n() — no copy lives in app.js
│   └── js/app.js                # Frontend: scenario selector, map, icon resolution, triage ladder,
│                                #           medical popups, SSE client, simulation controls
├── docker-compose.yml
├── server.js                    # Express entry point. Mounts routes, SSE, planner proxy.
├── package.json
└── .env
```

### Real-time layer

All entity mutations are pushed to connected browsers without page refresh via **Server-Sent Events (SSE)**:

- `lib/sse-broker.js` — singleton that keeps a `Set` of open SSE connections and exposes `broadcast(payload)`.
- `POST /api/entities` (single + batch) broadcasts `entity_created` — new entities appear on the map immediately.
- `PUT /api/entities/:id` broadcasts `entity_updated { id, lat, lng }` — marker position updates in place.
- `DELETE /api/entities/:id` broadcasts `entity_deleted { id }` — marker is removed from the map immediately.
- The browser `EventSource` on `/api/events` handles all three: `addEntityToMap`, `setLatLng`, `removeLayer`.
- Internal services (e.g. `medevac_planner`) can push arbitrary events via `POST /api/events/notify`.

### Key design decisions

- **`entity.js`** — single `baseSelect()` with a LEFT JOIN to `medical_details`. Every read endpoint returns `medical: {...} | null` transparently. No extra queries.
- **`medical_details`** — 1-to-1 table (FK = PK). Only exists for casualty entities. All fields nullable; defaults to `UNKNOWN`.
- **`tipo_elemento`** — Used for subtypes within categories (e.g., `infantry` + `tipo_elemento: 'mechanised'` → icon `infantry_mechanised_{country}.svg`). Medical facilities and MEDEVAC units use this for Role 1/2/3/4.
- **Scenarios** — data lives in `scripts/scenarios/*.js`. Each exports `{ meta, entities, medicalDetails }`. The loader resolves `elemento_identificado` → FK automatically. Adding a new scenario = one new file, zero schema changes.
- **Icon resolution** — `app.js` builds a candidate list (`category_tipo_country.svg` → `category_tipo.svg` → `category_country.svg` → `category.svg` → `default.svg`), checks with HEAD, caches.

---

## Prerequisites

- Docker Desktop
- Node.js 18+
- npm

---

## Running modes

There are two ways to run the stack. Choose one — do not mix them.

### Mode A — Docker (production / deployment)

The entire stack (PostgreSQL + backend) runs in containers.

```bash
docker compose up -d          # starts PostgreSQL + backend on :3000
docker compose down           # stop everything
```

→ `http://localhost:3000`

### Mode B — Dev (hot-reload)

Only PostgreSQL runs in Docker; the Node.js server runs locally with nodemon.

```bash
docker compose up -d postgis  # PostgreSQL only
npm run dev                   # server with hot-reload on :3000

# Stop: Ctrl+C then:
docker compose down
```

→ `http://localhost:3000`

---

## First-time setup

```bash
git clone https://github.com/MartinezAgullo/cmop_map && cd cmop_map

# 1. Dependencies
npm install

# 2. Environment
cp .env.example .env          # edit DB_PASSWORD at minimum

# 3. PostgreSQL only (dev mode)
docker compose up -d postgis

# Wait for PostgreSQL to be ready
until docker exec cmop_map_postgis pg_isready -U postgres >/dev/null 2>&1; do
    sleep 1
done

# 4. Schema
node scripts/init-db.js

# 5. Load scenario
node scripts/load-scenario.js paris_sud_medevac

# 6. Start server
npm run dev
```

→ `http://localhost:3000`

---

## Daily workflow (dev mode)

```bash
docker compose up -d postgis  # PostgreSQL only
npm run dev                   # server (hot-reload)

# Swap scenarios (no restart needed)
node scripts/load-scenario.js paris_sud_medevac

# List scenarios
node scripts/load-scenario.js --list
```

Stop: `Ctrl+C` then `docker compose down`

---

## Movement simulation

Once a MEDEVAC plan has been computed by `medevac_planner` and its routes loaded in the MEDEVAC Routes panel, the map can animate vehicles and casualties along their GeoJSON routes in real time.

### Controls

| Button | State | Action |
|--------|-------|--------|
| **▶ Simular** | idle | Start simulation from the beginning |
| **⏹ Detener** | running | Pause simulation; vehicles freeze at current position |
| **▶ Reanudar** | paused | Resume from current position (works on updated routes after threat reroute) |
| **↩ Reiniciar** | paused | Stop, restore original positions, restart from scratch |

The "Reiniciar" button is only visible while paused.

### How it works

The simulation engine runs in `medevac_planner/task_server.py` as an asyncio background task:

1. **Interpolation** — vehicle positions are computed geometrically along each GeoJSON `LineString` using haversine arc-length parameterisation. No GPS involved.
2. **Speed** — ETAs from the planner encode the vehicle type: ground vehicles (`~40 km/h`), helicopters (`~150 km/h`). The `PLANNER_SIMULATION_SPEED` multiplier compresses wall-clock time (e.g. `30` = 30× speed for demos).
3. **1 Hz updates** — the planner writes each vehicle's new `(latitud, longitud)` to the CMOP DB via `PUT /api/entities/:id` every second. The SSE broker pushes `entity_updated` to all connected browsers, which call `marker.setLatLng()`.
4. **Milestones** — on arrival at the casualty (`pickup_done`), `evac_stage` is set to `in_transit` and the casualty begins co-moving with the vehicle. On arrival at the facility, `evac_stage` is set to `delivered`.
5. **Threat reroute + resume** — when a threat is added and routes are recomputed, the planner fetches the vehicle's live DB position and uses it as the new route start. Pressing "Reanudar" after the reroute therefore places the vehicle at position 0 of the new route, which is exactly where it was when paused.

### Demo flow

```
1. Load scenario → trigger medevac_planner → load routes in MEDEVAC Routes panel
2. Click ▶ Simular — vehicles animate toward casualties, then toward facilities
3. Click ⏹ Detener — vehicles freeze
4. Add hostile entity in cmop_map — planner auto-reroutes around the threat
5. Click ▶ Reanudar — vehicles continue from their paused position along the NEW route
```

---

## API reference

All endpoints return: `{ success: boolean, data?: any, message?: string }`

### Entities (`/api/entities`)

All responses include `medical: {...} | null` when entity has a medical record.

#### **GET** `/api/entities`

Get all entities.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre": "ESP INF-A",
      "categoria": "infantry",
      "country": "Spain",
      "alliance": "friendly",
      "tipo_elemento": "standard",
      "latitud": 39.4745,
      "longitud": -0.3768,
      "medical": null
    }
  ]
}
```

#### **GET** `/api/entities/:id`

Get single entity by ID.

#### **GET** `/api/entities/categoria/:categoria`

Filter by category.

**Parameters:**
- `categoria` (path) — e.g., `infantry`, `casualty`, `medical_facility`

**Example:** `GET /api/entities/categoria/casualty`

#### **GET** `/api/entities/cerca/:lng/:lat?radio=N`

Spatial radius query.

**Parameters:**
- `lng`, `lat` (path) — Coordinates
- `radio` (query) — Radius in meters (default: 50000)

**Example:** `GET /api/entities/cerca/-0.3768/39.4745?radio=1000`

#### **GET** `/api/entities/meta/categorias`

Get all category enum values.

**Response:** `{ success: true, data: ["infantry", "armoured", ...] }`

#### **POST** `/api/entities`

Create entity. Can include `medical` object.

**Request:**
```json
{
  "nombre": "New Unit",
  "categoria": "infantry",
  "country": "Spain",
  "alliance": "friendly",
  "tipo_elemento": "mechanised",
  "latitud": 39.47,
  "longitud": -0.38,
  "medical": {
    "triage_color": "GREEN",
    "casualty_status": "WIA"
  }
}
```

**Required:** `nombre`, `categoria`, `latitud`, `longitud`

#### **POST** `/api/entities/batch`

Bulk create.

**Request:** `{ "entities": [ {...}, {...} ] }`

#### **PUT** `/api/entities/:id`

Partial update. Can include `medical` object.

**Request:**
```json
{
  "observaciones": "Updated",
  "medical": {
    "evac_stage": "delivered"
  }
}
```

#### **DELETE** `/api/entities/:id`

Delete entity (medical cascades).

---

### Medical (`/api/medical`)

#### **GET** `/api/medical/casualties`

Get all entities with medical records.

#### **GET** `/api/medical/triage/:color`

Filter by triage color.

**Parameters:** `color` — `RED`, `YELLOW`, `GREEN`, `BLACK`, `UNKNOWN`

**Example:** `GET /api/medical/triage/RED`

#### **GET** `/api/medical/evac-stage/:stage`

Filter by evacuation stage.

**Parameters:** `stage` — `at_poi`, `in_transit`, `delivered`, `unknown`

#### **PUT** `/api/medical/:entity_id`

Upsert medical fields (partial).

**Request:**
```json
{
  "triage_color": "YELLOW",
  "evac_stage": "in_transit",
  "destination_facility_id": 5
}
```

#### **POST** `/api/medical/:entity_id/vitals`

Append vital signs reading.

**Request:**
```json
{
  "hr": 95,
  "bp": "120/80",
  "spo2": 98,
  "recorded_at": "2026-02-06T14:30:00Z"
}
```

#### **DELETE** `/api/medical/:entity_id`

Remove medical record (entity stays).

---

### Scenarios (`/api/scenarios`)

#### **GET** `/api/scenarios`

List scenarios.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "valencia_urban",
      "description": "Urban combat...",
      "tags": ["military", "urban"]
    }
  ]
}
```

#### **POST** `/api/scenarios/load/:name`

Load scenario (truncates tables).

**Example:** `POST /api/scenarios/load/paris_sud_medevac`

On success this also fires `POST /scenario/loaded` at `medevac_planner`
(`MEDEVAC_PLANNER_URL`, default `:8400`). The truncate invalidates every entity
id the planner holds, so that call is what makes it drop its plans, routes and
running simulations and re-brief against the new map. Fire-and-forget: a planner
that is down logs a warning and the load still succeeds. Note that the CLI path
(`node scripts/load-scenario.js <name>`) does not notify anyone, which is what
`launch.sh` wants — it loads the scenario before the planner is even up.

**Response:**
```json
{
  "success": true,
  "message": "Scenario loaded",
  "data": {
    "entities_loaded": 45,
    "medical_records_loaded": 7
  }
}
```

---

### Real-time events (`/api/events`)

#### **GET** `/api/events`

Open an SSE stream. The connection stays alive; the server pushes events as JSON on each line.

```
data: {"type":"connected"}

data: {"type":"entity_updated","id":3,"lat":48.862,"lng":2.347}

data: {"type":"simulation_stopped","task_id":"abc123","reason":"cancelled"}
```

Event types:

| `type` | When | Fields |
|--------|------|--------|
| `connected` | On stream open | — |
| `entity_created` | After `POST /api/entities` (single or batch) | `data` (full entity object) |
| `entity_updated` | After `PUT /api/entities/:id` | `id`, `lat`, `lng` |
| `entity_deleted` | After `DELETE /api/entities/:id` | `id` |
| `evac_stage_updated` | At pickup / delivery milestones | `id`, `evac_stage` |
| `route_updated` | After threat-triggered reroute | `task_id` |
| `simulation_stopped` | On stop or completion | `task_id`, `reason` (`cancelled`\|`completed`) |

#### **POST** `/api/events/notify`

Push an arbitrary event to all connected SSE clients. Used internally by `medevac_planner`.

**Request:** any JSON object with a `type` field.

---

### Planner proxy (`/api/planner`)

Thin proxies to `medevac_planner` task server (default `:8400`). Avoids CORS issues.

#### **GET** `/api/planner/tasks/:taskId/routes`

Fetch GeoJSON routes for a completed plan.

#### **POST** `/api/planner/tasks/:taskId/simulate`

Start movement simulation for a plan.

#### **DELETE** `/api/planner/tasks/:taskId/simulate`

Stop (pause) a running simulation.

#### **POST** `/api/planner/tasks/:taskId/simulate/resume`

Resume a paused simulation from vehicles' current DB positions.

#### **POST** `/api/planner/tasks/:taskId/simulate/restart`

Cancel simulation, restore original positions, restart from the beginning.

---

### Schema (`/api/schema`)

#### **GET** `/api/schema`

Get schema metadata for MCP servers.

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "categories": [
      {
        "value": "infantry",
        "label_en": "Infantry",
        "label_es": "Infantería",
        "subtypes": [
          { "value": "standard", "label_en": "Infantry (Standard)", ... }
        ]
      }
    ],
    "alliances": [...],
    "triage_colors": [...],
    "casualty_status": [...],
    "evac_priority": [...],
    "evac_stage": [...]
  }
}
```

---

## Data model

### `categoria_militar` enum

```
Military:     missile, fighter, bomber, aircraft, helicopter, uav,
              armoured, artillery, ship, destroyer, submarine,
              ground_vehicle, infantry, reconnaissance, engineer,
              mortar, person, base, building, infrastructure
Medical:      medical_facility, medevac_unit
Casualty:     casualty
Fallback:     default
```

### Subtypes (`tipo_elemento`)

| Category | Subtypes |
|----------|----------|
| `infantry` | standard, light, motorised, mechanised, mechanised_wheeled, armoured, lav, unarmed_transport, uav |
| `reconnaissance` | standard, mechanised, wheeled |
| `engineer` | standard, armoured |
| `mortar` | heavy, medium, light, unknown |
| `medical_facility` | medical_role_1/2/3/4, medical_role_2basic, medical_role_2enhanced, medical_facility_multinational |
| `medevac_unit` | medevac_role_1/2/3/4, medevac_fixedwing, medevac_ambulance, medevac_mechanised, medevac_mortuary |

### `medical_details` fields

| Column | Type | Values |
|--------|------|--------|
| `triage_color` | enum | RED, YELLOW, GREEN, BLACK, UNKNOWN |
| `casualty_status` | enum | WIA, KIA, UNKNOWN |
| `injury_mechanism` | varchar(100) | Free text |
| `primary_injury` | text | Free text |
| `vital_signs` | JSONB | `[{hr, bp, spo2, recorded_at}]` |
| `prehospital_treatment` | text | Free text |
| `evac_priority` | enum | URGENT, PRIORITY, ROUTINE, UNKNOWN |
| `evac_stage` | enum | at_poi, in_transit, delivered, unknown |
| `destination_facility_id` | FK | → puntos_interes |
| `nine_line_data` | JSONB | `{line1..line9}` |

---

## Icon resolution

**Example:** Infantry mechanised, Spain, friendly

1. `friendly/infantry_mechanised_spain.svg`
2. `friendly/infantry_mechanised.svg`
3. `friendly/infantry_spain.svg`
4. `friendly/infantry.svg`
5. `friendly/default.svg`

**Special cases:**
- Infantry `standard` → `infantry_{country}.svg`
- Medical facilities → `medical_facility_role_1_{country}.svg`
- MEDEVAC → `medevac_role_2_{country}.svg`
- Casualties → `casualty_wia_{country}.svg` or `casualty_kia_{country}.svg`

---

## Troubleshooting

### "invalid input value for enum categoria_militar"

Schema outdated. Recreate:

```bash
docker exec -it cmop_map_postgis psql -U postgres -d cmop_db -c "
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
    CREATE EXTENSION IF NOT EXISTS postgis;
"
node scripts/init-db.js
```

### "relation 'puntos_interes' does not exist"

Run: `node scripts/init-db.js`

### Icons not loading

1. Check naming: `category_tipo_country.svg`
2. Check browser console for 404s
3. Hard refresh: `Cmd+Shift+R`

---

## License

GPL 3.0


<!-- 
tree -I "__pycache__|__init__.py|uv.lock|README.md|docs|node_modules|*.svg|*.png|images|*.json"
-->

