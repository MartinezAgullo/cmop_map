# cmop_map

CMOP (Common Medical Operational Picture) map service. Geospatial layer for military and medical entities with NATO APP-6 symbology, scenario-based data loading, and a REST API consumed by `cmop_fusion_mcp`. This project is an evolution of the [mapa-puntos-interes](https://github.com/MartinezAgullo/mapa-puntos-interes) project.

**Stack:** Node.js + Express · PostgreSQL/PostGIS (Docker) · Leaflet · vanilla JS

---

## Project structure

```
cmop_map/
├── config/
│   └── database.js              # pg Pool — reads .env
├── models/
│   └── entity.js                # All queries: puntos_interes + medical_details (LEFT JOIN)
├── routes/
│   ├── entities.js              # CRUD for entities (/api/entities)
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
│   └── js/app.js                # Frontend: scenario selector, map, icon resolution, medical popups
├── docker-compose.yml
├── server.js                    # Express entry point. Mounts routes, serves static.
├── package.json
└── .env
```

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

## First-time setup

```bash
git clone https://github.com/MartinezAgullo/cmop_map && cd cmop_map

# 1. Dependencies
npm install

# 2. Environment
cp .env.example .env          # edit DB_PASSWORD at minimum

# 3. PostgreSQL
docker compose up -d

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

## Quick start script

```bash
./scripts/cmop_map/start_cmop_map.sh
```

Handles Docker, PostgreSQL, schema init, scenario loading, and server startup automatically.

---

## Daily workflow

```bash
docker compose up -d          # PostgreSQL
npm run dev                   # server (hot-reload)

# Swap scenarios (no restart needed)
node scripts/load-scenario.js valencia_medevac

# List scenarios
node scripts/load-scenario.js --list
```

Stop: `Ctrl+C` then `docker compose down`

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

