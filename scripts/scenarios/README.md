# scripts/scenarios

Each file here is a **scenario**: a complete, self-contained snapshot of the map (entities, medical records and, optionally, hazard zones) that can be loaded into the database in one step. Loading a scenario **replaces** the whole map.

## How to use one

```bash
node scripts/load-scenario.js --list               # available scenarios
node scripts/load-scenario.js valencia_dana        # load one (needs the DB: docker compose up -d && node scripts/init-db.js)
```

The same can be done from the web UI or `POST /api/scenarios/load/:name`. The loader (`lib/scenario-loader.js`) truncates `medical_details`, `puntos_interes` and `hazard_zones`, inserts the new data in a single transaction and rolls back on any error. Add a file and it appears in the list; there is no registry to edit.

## Structure of a scenario file

```js
module.exports = { meta, entities, medicalDetails, hazardZones /* optional */ };
```

| Export | Content |
|---|---|
| `meta` | `{ name, description, tags }`. `name` must match the file name. |
| `entities` | Rows of the `puntos_interes` table (no `id`, no geometry): everything on the map. `lng` and `lat` build the point. |
| `medicalDetails` | Rows of `medical_details`. `entity_ref` is the entity's `elemento_identificado`, which the loader resolves to an id. Casualties carry `triage_color`, `casualty_status`, `evac_priority`, `evac_stage`; civilians only need `evac_stage`. |
| `hazardZones` | Optional. `{ name, hazard_type, description, geometry }` with a GeoJSON `MultiPolygon`. Types are in `lib/hazard-types.js`. |

### The fields of an entity that matter most

| Field | Meaning |
|---|---|
| `nombre`, `elemento_identificado` | display name and unique reference (agent convention: `SpaCiv1`, `FraCas3`, `SpaMedevacHelo1`) |
| `categoria` | `medevac_unit`, `casualty`, `civilian`, `shelter`, `medical_facility`, `fire_fighting`, `infantry`... (list in `GET /api/schema`) |
| `alliance` | `friendly`, `hostile`, `neutral`, `unknown` |
| `tipo_elemento` | subtype, e.g. `medical_role_3`, `medevac_role_1`, `casualty` |
| `mobility`, `capacity` | for vehicles: `ground`/`air`/`sea` and how many people it carries in a cycle (limits in `lib/capacity-limits.js`) |
| `headcount` | for `civilian`: people in the group (one entity per location) |
| `max_capacity`, `occupancy` | for shelters and medical facilities: places and places already taken |

**What a vehicle may do is not in the scenario.** Which vehicles can carry civilians and which hazard zones they can enter is decided by `latacc_common/capabilities/capabilities.yaml` in `latacc-medevac`, from `categoria`, `tipo_elemento` and `mobility`.

`valencia_urban.js` documents the contract at the top and is the simplest file to copy. `valencia_medevac.js` is the reference template for `medical_details`.

## What is in each scenario

| Scenario | Area | Contents |
|---|---|---|
| `valencia_urban` | Valencia | Baseline, purely military: multinational friendly force vs hostile infantry and armour. No medical layer. |
| `valencia_medevac` | Valencia | `valencia_urban` plus a Role 1 post, a Role 2 at Manises, one MEDEVAC helicopter and 3 casualties (RED/YELLOW/GREEN). Reference for `medical_details`. |
| `valencia_dana` | l'Horta Sud (Valencia) | **Civil emergencies.** DANA flood of 29 Oct 2024: flood and building-collapse hazard zones, 10 civilian groups (2 to 40 people, most trapped inside a zone), 6 casualties, 5 hospitals, 3 shelters and civil response vehicles (ambulances, helicopter, firefighters, civil protection, police, bus). Needs Valhalla's exclude-polygon limit raised (see the header). |
| `paris_sud_medevac` | South of Paris | Multinational brigade exercise (FR/ES/DE/IT), all friendly, with medical support, MEDEVAC assets and 10 casualties. |
| `paris_sud_medevac_mascal` | South of Paris | Mass-casualty version: 4 simultaneous incidents, 30 casualties against 12 evacuation assets (20 slots). Demand exceeds supply by design; this is the scenario that makes the QUBO worthwhile. |
| `paris_sud_medevac_no_WIAs` | South of Paris | Same laydown with no casualties, for route-planning and logistics drills. |
| `mariupol_siege` | Mariupol | Simulated urban combat RUS vs UKR across ground, air and sea, with Ukrainian medical facilities, MEDEVAC assets and 8 casualties. |

Random MASCAL scenarios are not stored here: `lib/mascal-generator.js` builds one with the same shape and loads it through `POST /api/scenarios/generate`.

## Writing a new one

1. Copy the closest file; keep `meta.name` equal to the file name.
2. Give every entity a unique `elemento_identificado`; `medicalDetails` refer to it.
3. Run `node scripts/load-scenario.js <name>`. A capacity outside the limits fails the whole load and names the entity.
4. If the scenario is for the planner, check the agents still parse it (`latacc-medevac`, `.okf/operations/cross-repo-sync.md`).
