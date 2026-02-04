# cmop_map

CMOP (Common Medical Operational Picture) map service. Geospatial layer for military and medical entities with NATO APP-6 symbology, scenario-based data loading, and a REST API consumed by `cmop_fusion_mcp`. This project is an evolution of the [https://github.com/MartinezAgullo/mapa-puntos-interes](mapa-puntos-interes) project.

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
│   └── scenarios.js             # List & load scenarios (/api/scenarios)
├── scripts/
│   ├── init-db.js               # Creates schema (enums, tables, indexes, triggers). No seed.
│   ├── load-scenario.js         # CLI loader: truncates + inserts a scenario in a transaction
│   └── scenarios/
│       ├── valencia_urban.js    # Military-only baseline (no casualties)
│       └── valencia_medevac.js  # Urban + 3 casualties + medical facilities
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
- **Scenarios** — data lives in `scripts/scenarios/*.js`. Each exports `{ meta, entities, medicalDetails }`. The loader resolves `elemento_identificado` → FK automatically. Adding a new scenario = one new file, zero schema changes.
- **Icon resolution** — `app.js` builds a candidate list (`category_country.svg` → `category.svg` → `default.svg`), checks with HEAD, caches. Medical categories map to the APP-6 medical SVGs already in `public/icons/`.

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

# 4. Schema (run once; re-run is safe — drops and recreates)
node scripts/init-db.js

# 5. Load a scenario
node scripts/load-scenario.js valencia_urban

# 6. Start server
npm run dev
```

→ `http://localhost:3000`

---

## Daily workflow

```bash
docker compose up -d          # PostgreSQL
npm run dev                   # server (hot-reload)

# swap scenario at any time (no restart needed)
node scripts/load-scenario.js valencia_medevac

# list available scenarios
node scripts/load-scenario.js --list
```

Stop:

```bash
Ctrl+C
docker compose down
```

---

## .env

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=cmop_db
DB_USER=postgres
DB_PASSWORD=changeme
PORT=3000
NODE_ENV=development
```

---

## API reference

### Entities (`/api/entities`)

All responses include `medical: {...} | null` when the entity has a medical record.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entities` | All entities |
| GET | `/api/entities/:id` | Single entity |
| GET | `/api/entities/categoria/:cat` | Filter by `categoria_militar` enum |
| GET | `/api/entities/cerca/:lng/:lat?radio=N` | Spatial radius query (meters, default 50 000) |
| GET | `/api/entities/meta/categorias` | All enum values |
| POST | `/api/entities` | Create entity. Body may include `medical: {}` sub-object |
| POST | `/api/entities/batch` | Bulk create (single transaction). Array key: `entities` |
| PUT | `/api/entities/:id` | Partial update. Body may include `medical: {}` |
| DELETE | `/api/entities/:id` | Delete entity (`medical_details` cascades) |

### Medical (`/api/medical`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/medical/casualties` | All entities that have a `medical_details` record |
| GET | `/api/medical/triage/:color` | Filter by triage colour (`RED`, `YELLOW`, `GREEN`, `BLACK`) |
| GET | `/api/medical/evac-stage/:stage` | Filter by evacuation stage (`at_poi`, `in_transit`, `delivered`) |
| PUT | `/api/medical/:entity_id` | Upsert medical fields (partial — only provided keys written) |
| POST | `/api/medical/:entity_id/vitals` | Append a single vital-signs reading to the history array |
| DELETE | `/api/medical/:entity_id` | Remove medical record (entity stays) |

### Scenarios (`/api/scenarios`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scenarios` | List scenarios with their `meta` blocks |
| POST | `/api/scenarios/load/:name` | Load a scenario (truncates + re-inserts, transactional) |

---

## Data model quick reference

**`categoria_militar` enum**

```bash
Military:  missile, fighter, bomber, aircraft, helicopter, uav, tank,
           artillery, ship, destroyer, submarine, ground_vehicle, apc,
           infantry, person, base, building, infrastructure
Medical:   medical_role_1, medical_role_2, medical_role_3, medevac_unit
Casualty:  casualty_friendly, casualty_hostile, casualty_civilian
           default
```

**`medical_details` (nullable fields, all default UNKNOWN)**

| Column | Type | Notes |
|--------|------|-------|
| `triage_color` | enum | RED · YELLOW · GREEN · BLACK · UNKNOWN |
| `injury_mechanism` | text | e.g. "Blast (IED)", "GSW" |
| `primary_injury` | text | |
| `vital_signs` | JSONB | Array: `[{ hr, bp, spo2, recorded_at }, ...]` |
| `prehospital_treatment` | text | |
| `evac_priority` | enum | URGENT · PRIORITY · ROUTINE · UNKNOWN |
| `evac_stage` | enum | at_poi · in_transit · delivered · unknown |
| `destination_facility_id` | FK → puntos_interes | Target medical facility |
| `nine_line_data` | JSONB | Structured 9-Line MEDEVAC (partial OK) |

---

## License

GPL 3.0

<!-- 
tree -I "__pycache__|__init__.py|uv.lock|README.md|docs|node_modules|*.svg|*.png|images|*.json"
-->
