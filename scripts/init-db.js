// scripts/init-db.js
//
// CMOP schema initialisation — schema only, no seed data.
// Seed data lives in scripts/scenarios/*.js and is loaded via load-scenario.js
//
const pool = require('../config/database');

// ---------------------------------------------------------------------------
// 1. Enums
// ---------------------------------------------------------------------------

const ENUMS = `
  -- Military + medical entity categories
  CREATE TYPE categoria_militar AS ENUM (
    -- Original military categories
    'missile', 'fighter', 'bomber', 'aircraft', 'helicopter', 'uav',
    'tank', 'artillery', 'ship', 'destroyer', 'submarine', 'ground_vehicle',
    'apc', 'infantry', 'person', 'base', 'building', 'infrastructure',
    -- Medical facilities & assets
    'medical_role_1',   -- Basic aid post
    'medical_role_2',   -- Limited surgical / stabilisation
    'medical_role_3',   -- Full field hospital
    'medevac_unit',     -- Dedicated evacuation assets (ambulance, medevac helo)
    -- Casualty categories
    'casualty_friendly',
    'casualty_hostile',
    'casualty_civilian',
    -- Fallback
    'default'
  );

  CREATE TYPE alliance_enum AS ENUM (
    'friendly', 'hostile', 'neutral', 'unknown'
  );

  -- Triage colours (TCCC standard + unknown default)
  CREATE TYPE triage_color_enum AS ENUM (
    'RED',      -- Immediate
    'YELLOW',   -- Delayed
    'GREEN',    -- Minor
    'BLACK',    -- Expectant / deceased
    'UNKNOWN'
  );

  -- MEDEVAC evacuation priority (NATO / TCCC)
  CREATE TYPE evac_priority_enum AS ENUM (
    'URGENT',     -- Life-threatening, needs care within 1 h
    'PRIORITY',   -- Serious but stable, within 4 h
    'ROUTINE',    -- Stable, within 24 h
    'UNKNOWN'
  );

  -- Current evacuation stage
  CREATE TYPE evac_stage_enum AS ENUM (
    'at_poi',      -- At point of injury
    'in_transit',  -- Being moved / transported
    'delivered',   -- Arrived at destination facility
    'unknown'
  );
`;

// ---------------------------------------------------------------------------
// 2. Base entity table  (puntos_interes — unchanged contract)
// ---------------------------------------------------------------------------

const BASE_TABLE = `
  CREATE TABLE puntos_interes (
    id                    SERIAL PRIMARY KEY,
    nombre                VARCHAR(255) NOT NULL,
    descripcion           TEXT,
    categoria             categoria_militar NOT NULL,
    country               VARCHAR(100),
    alliance              alliance_enum     NOT NULL DEFAULT 'unknown',
    elemento_identificado VARCHAR(100),
    activo                BOOLEAN           DEFAULT true,
    tipo_elemento         VARCHAR(100),
    prioridad             INTEGER           DEFAULT 0,
    observaciones         TEXT,
    altitud               NUMERIC(10, 2),
    geom                  GEOMETRY(Point, 4326) NOT NULL,
    created_at            TIMESTAMP         DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP         DEFAULT CURRENT_TIMESTAMP
  );
`;

// ---------------------------------------------------------------------------
// 3. Medical details table  (1-to-1 with puntos_interes, optional)
//
//   - Only populated for casualty_* categories (or any entity that needs it).
//   - All fields NULLABLE; unknown state is the default.
//   - vital_signs: JSONB array of timestamped readings
//       [{ "hr": 80, "bp": "120/80", "spo2": 95, "recorded_at": "2026-..." }, ...]
//   - nine_line_data: JSONB with the structured 9-Line MEDEVAC fields
//       { "line1_location": "...", "line2_frequency": "...", ... }
//   - destination_facility_id: FK back to puntos_interes (Role 1/2/3 facility)
// ---------------------------------------------------------------------------

const MEDICAL_TABLE = `
  CREATE TABLE medical_details (
    -- PK is the FK; enforces exactly one medical record per entity
    entity_id             INTEGER        PRIMARY KEY
                                         REFERENCES puntos_interes(id)
                                         ON DELETE CASCADE,

    -- Triage & injury
    triage_color          triage_color_enum   DEFAULT 'UNKNOWN',
    injury_mechanism      VARCHAR(100),       -- e.g. "Blast", "GSW", "MVA"
    primary_injury        TEXT,               -- Free-text brief description
    vital_signs           JSONB,              -- Array of timestamped readings (see above)
    prehospital_treatment TEXT,               -- Tourniquet, airway, meds applied at POI

    -- Evacuation management
    evac_priority         evac_priority_enum  DEFAULT 'UNKNOWN',
    evac_stage            evac_stage_enum     DEFAULT 'unknown',
    destination_facility_id INTEGER           REFERENCES puntos_interes(id),

    -- Structured 9-Line MEDEVAC data (populated by Comms/Reporting agent)
    nine_line_data        JSONB,

    -- Timestamps
    created_at            TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP           DEFAULT CURRENT_TIMESTAMP
  );
`;

// ---------------------------------------------------------------------------
// 4. Indexes
// ---------------------------------------------------------------------------

const INDEXES = `
  -- Base table
  CREATE INDEX idx_pi_geom        ON puntos_interes USING GIST (geom);
  CREATE INDEX idx_pi_activo      ON puntos_interes (activo);
  CREATE INDEX idx_pi_elemento    ON puntos_interes (elemento_identificado);
  CREATE INDEX idx_pi_categoria   ON puntos_interes (categoria);
  CREATE INDEX idx_pi_alliance    ON puntos_interes (alliance);
  CREATE INDEX idx_pi_country     ON puntos_interes (country);

  -- Medical details
  -- GIN on vital_signs for JSONB path queries
  CREATE INDEX idx_md_vital_signs     ON medical_details USING GIN (vital_signs);
  CREATE INDEX idx_md_nine_line       ON medical_details USING GIN (nine_line_data);
  CREATE INDEX idx_md_triage_color    ON medical_details (triage_color);
  CREATE INDEX idx_md_evac_priority   ON medical_details (evac_priority);
  CREATE INDEX idx_md_evac_stage      ON medical_details (evac_stage);
  CREATE INDEX idx_md_destination     ON medical_details (destination_facility_id);
`;

// ---------------------------------------------------------------------------
// 5. Utility: trigger to keep updated_at in sync on both tables
// ---------------------------------------------------------------------------

const UPDATED_AT_TRIGGER = `
  CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_pi_updated_at
    BEFORE UPDATE ON puntos_interes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

  CREATE TRIGGER trg_md_updated_at
    BEFORE UPDATE ON medical_details
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
`;

// ---------------------------------------------------------------------------
// 6. Drop helpers  (order matters due to FKs)
// ---------------------------------------------------------------------------

const DROP_ALL = `
  DROP TABLE IF EXISTS medical_details CASCADE;
  DROP TABLE IF EXISTS puntos_interes  CASCADE;

  DROP TYPE IF EXISTS evac_stage_enum;
  DROP TYPE IF EXISTS evac_priority_enum;
  DROP TYPE IF EXISTS triage_color_enum;
  DROP TYPE IF EXISTS alliance_enum;
  DROP TYPE IF EXISTS categoria_militar;

  DROP FUNCTION IF EXISTS set_updated_at();
`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const initDatabase = async () => {
  try {
    console.log('🔄 Initializing CMOP database schema…');

    // PostGIS extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('✅ PostGIS enabled');

    // Tear down previous schema (idempotent re-run)
    await pool.query(DROP_ALL);
    console.log('🗑️  Previous schema dropped');

    // Rebuild
    await pool.query(ENUMS);
    console.log('✅ Enums created');

    await pool.query(BASE_TABLE);
    console.log('✅ Table puntos_interes created');

    await pool.query(MEDICAL_TABLE);
    console.log('✅ Table medical_details created');

    await pool.query(INDEXES);
    console.log('✅ Indexes created');

    await pool.query(UPDATED_AT_TRIGGER);
    console.log('✅ updated_at triggers created');

    console.log('\n🎉 CMOP schema ready. Load a scenario with:\n   node scripts/load-scenario.js <scenario_name>\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ DB init error:', error);
    process.exit(1);
  }
};

initDatabase();
