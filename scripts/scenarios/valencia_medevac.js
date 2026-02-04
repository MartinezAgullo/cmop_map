// scripts/scenarios/valencia_medevac.js
//
// Scenario: Valencia MEDEVAC
// --------------------------
// Extends the valencia_urban baseline with:
//   - Medical facilities (Role 1 at forward position, Role 2 at Manises)
//   - A dedicated MEDEVAC helicopter
//   - 3 friendly casualties at different triage colours and evacuation stages
//
// This scenario is the reference template for any scenario that uses medical_details.
// ---------------------------------------------------------------------------

const meta = {
  name: 'valencia_medevac',
  description: 'Valencia urban combat + active MEDEVAC. Three friendly casualties (RED/YELLOW/GREEN) with a Role-1 aid post, Role-2 at Manises, and a MEDEVAC helo. Demonstrates the full medical_details contract.',
  tags: ['medevac', 'valencia', 'casualties', 'medical', 'training']
};

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------
const entities = [
  // ---------------------------------------------------------------
  // Friendly infantry (subset of valencia_urban — kept for context)
  // ---------------------------------------------------------------
  { nombre: 'ESP INF-A',  descripcion: 'Infantry squad (urban)',  categoria: 'infantry',   country: 'Spain',   alliance: 'friendly', elemento_identificado: 'ESP-INF-A',     activo: true, tipo_elemento: 'Infantry',  prioridad: 5, observaciones: 'Urban patrol',          altitud: null, lng: -0.3768, lat: 39.4745 },
  { nombre: 'ESP INF-B',  descripcion: 'Infantry squad (urban)',  categoria: 'infantry',   country: 'Spain',   alliance: 'friendly', elemento_identificado: 'ESP-INF-B',     activo: true, tipo_elemento: 'Infantry',  prioridad: 5, observaciones: 'Holding intersection',  altitud: null, lng: -0.3850, lat: 39.4632 },
  { nombre: 'ESP INF-C',  descripcion: 'Infantry squad (urban)',  categoria: 'infantry',   country: 'Spain',   alliance: 'friendly', elemento_identificado: 'ESP-INF-C',     activo: true, tipo_elemento: 'Infantry',  prioridad: 5, observaciones: 'Near park area',       altitud: null, lng: -0.3650, lat: 39.4841 },
  { nombre: 'FRA INF-1',  descripcion: 'Infantry squad (urban)',  categoria: 'infantry',   country: 'France',  alliance: 'friendly', elemento_identificado: 'FRA-INF-1',     activo: true, tipo_elemento: 'Infantry',  prioridad: 5, observaciones: 'Supporting ESP',       altitud: null, lng: -0.3530, lat: 39.4525 },
  { nombre: 'DEU INF-1',  descripcion: 'Infantry squad (urban)',  categoria: 'infantry',   country: 'Germany', alliance: 'friendly', elemento_identificado: 'DEU-INF-1',     activo: true, tipo_elemento: 'Infantry',  prioridad: 5, observaciones: 'QR force',              altitud: null, lng: -0.4002, lat: 39.4820 },

  // ---------------------------------------------------------------
  // Hostile forces (reduced subset)
  // ---------------------------------------------------------------
  { nombre: 'H-INF-1',    descripcion: 'Hostile infantry',        categoria: 'infantry',   country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-INF-1',      activo: true, tipo_elemento: 'Infantry',  prioridad: 6, observaciones: 'Skirmishing',           altitud: null, lng: -0.3609, lat: 39.4705 },
  { nombre: 'H-INF-4',    descripcion: 'Hostile infantry',        categoria: 'infantry',   country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-INF-4',      activo: true, tipo_elemento: 'Infantry',  prioridad: 6, observaciones: 'Ambush expected',      altitud: null, lng: -0.3687, lat: 39.4611 },
  { nombre: 'H-TANK-1',   descripcion: 'Hostile MBT',            categoria: 'tank',       country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-TNK-1',      activo: true, tipo_elemento: 'MBT',       prioridad: 9, observaciones: 'Covered position',     altitud: null, lng: -0.3700, lat: 39.4930 },

  // ---------------------------------------------------------------
  // Medical facilities
  // ---------------------------------------------------------------
  // Role 1 — forward aid post, near the contact area
  { nombre: 'Aid Post Alpha', descripcion: 'Role-1 forward aid post', categoria: 'medical_role_1', country: 'Spain', alliance: 'friendly', elemento_identificado: 'MED-R1-ALPHA', activo: true, tipo_elemento: 'Aid Post', prioridad: 10, observaciones: 'Co-located with ESP INF-B', altitud: null, lng: -0.3840, lat: 39.4640 },

  // Role 2 — at Manises AB, limited surgical capability
  { nombre: 'Manises Role-2', descripcion: 'Role-2 surgical facility at Manises AB', categoria: 'medical_role_2', country: 'Spain', alliance: 'friendly', elemento_identificado: 'MED-R2-MANISES', activo: true, tipo_elemento: 'Field Hospital', prioridad: 10, observaciones: 'Surgical + stabilisation', altitud: null, lng: -0.4755, lat: 39.4915 },

  // ---------------------------------------------------------------
  // MEDEVAC asset
  // ---------------------------------------------------------------
  { nombre: 'ESP MEDEVAC-1', descripcion: 'Spanish MEDEVAC helicopter', categoria: 'medevac_unit', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-MEDEVAC-1', activo: true, tipo_elemento: 'MEDEVAC Helo', prioridad: 10, observaciones: 'On standby at Manises', altitud: 0, lng: -0.4760, lat: 39.4910 },

  // ---------------------------------------------------------------
  // Air / ISR (context)
  // ---------------------------------------------------------------
  { nombre: 'Manises AB',   descripcion: 'Air base (ESP)',          categoria: 'base',       country: 'Spain',   alliance: 'friendly', elemento_identificado: 'ESP-BASE-ZAZ', activo: true, tipo_elemento: 'Air Base', prioridad: 9, observaciones: 'Logistics hub',         altitud: null, lng: -0.4760, lat: 39.4910 },
  { nombre: 'FRA UAV-ISR',  descripcion: 'High-altitude ISR UAV',  categoria: 'uav',        country: 'France',  alliance: 'friendly', elemento_identificado: 'FRA-UAV-1',    activo: true, tipo_elemento: 'ISR',      prioridad: 6, observaciones: 'Wide-area scan',     altitud: 1200, lng: -0.3300, lat: 39.4700 },
  { nombre: 'DEU HEL-1',    descripcion: 'Utility helicopter',     categoria: 'helicopter', country: 'Germany', alliance: 'friendly', elemento_identificado: 'DEU-HEL-1',    activo: true, tipo_elemento: 'Utility',   prioridad: 5, observaciones: 'General transport', altitud: 500,  lng: -0.3600, lat: 39.4900 },

  // ---------------------------------------------------------------
  // Casualties (these are the entities that get medical_details)
  // ---------------------------------------------------------------
  // CAS-1: RED — blast injury, still at POI, urgent evacuation needed
  { nombre: 'CAS-1 (RED)',  descripcion: 'Friendly casualty — blast injury, critical', categoria: 'casualty_friendly', country: 'Spain', alliance: 'friendly', elemento_identificado: 'CAS-1', activo: true, tipo_elemento: 'Casualty', prioridad: 10, observaciones: 'Bilateral leg amputation, tourniquet applied', altitud: null, lng: -0.3770, lat: 39.4740 },

  // CAS-2: YELLOW — GSW, being moved to Aid Post Alpha
  { nombre: 'CAS-2 (YEL)', descripcion: 'Friendly casualty — GSW, in transit to R1', categoria: 'casualty_friendly', country: 'Spain', alliance: 'friendly', elemento_identificado: 'CAS-2', activo: true, tipo_elemento: 'Casualty', prioridad: 8,  observaciones: 'Abdominal GSW, IV fluids started', altitud: null, lng: -0.3800, lat: 39.4650 },

  // CAS-3: GREEN — minor laceration, already at Aid Post
  { nombre: 'CAS-3 (GRN)', descripcion: 'Friendly casualty — minor laceration, stable', categoria: 'casualty_friendly', country: 'France', alliance: 'friendly', elemento_identificado: 'CAS-3', activo: true, tipo_elemento: 'Casualty', prioridad: 3,  observaciones: 'Facial laceration, conscious and alert', altitud: null, lng: -0.3843, lat: 39.4638 },
];

// ---------------------------------------------------------------------------
// Medical details
//
// Contract per record:
//   entity_ref                — matches elemento_identificado in entities (required)
//   destination_facility_ref  — matches elemento_identificado of a medical facility (nullable)
//   All other fields          — match medical_details columns; NULL = unknown
//
// vital_signs: array of { hr, bp, spo2, recorded_at }
// nine_line_data: { line1..line9 } — partial OK, filled incrementally by agents
// ---------------------------------------------------------------------------
const medicalDetails = [
  {
    entity_ref: 'CAS-1',
    triage_color: 'RED',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (IED)',
    primary_injury: 'Bilateral above-knee amputation, haemorrhage controlled with tourniquet',
    vital_signs: [
      { hr: 130, bp: '80/50',  spo2: 91, recorded_at: '2026-02-02T18:00:00Z' },
      { hr: 125, bp: '85/55',  spo2: 93, recorded_at: '2026-02-02T18:05:00Z' }
    ],
    prehospital_treatment: 'Bilateral tourniquet (CoTCCC), IO access, 1L Hetastarch',
    evac_priority: 'URGENT',
    evac_stage: 'at_poi',
    destination_facility_ref: 'MED-R1-ALPHA',   // → Aid Post Alpha (first stop)
    nine_line_data: {
      line1_location: '39.4740,-0.3770',
      line2_frequency: 'FM 34.250',
      line3_casualties: '1 URGENT',
      line4_equipment: 'None available at POI',
      line5_patient_info: 'Male, 28y, ESP INF-A',
      line6_terrain: 'Urban street, accessible by vehicle from south',
      line7_friendly_fire: 'N/A',
      line8_patient_packaging: 'Stretcher',
      line9_remarks: 'Bilateral tourniquet in place since 17:55Z. Haemorrhage status unstable.'
    }
  },
  {
    entity_ref: 'CAS-2',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'GSW (rifle)',
    primary_injury: 'Right lower quadrant abdominal gunshot wound, no exit',
    vital_signs: [
      { hr: 105, bp: '100/65', spo2: 95, recorded_at: '2026-02-02T17:55:00Z' },
      { hr: 100, bp: '105/68', spo2: 96, recorded_at: '2026-02-02T18:02:00Z' }
    ],
    prehospital_treatment: 'IV access (18G AC), 500ml crystalloid, wound packed',
    evac_priority: 'PRIORITY',
    evac_stage: 'in_transit',
    destination_facility_ref: 'MED-R1-ALPHA',
    nine_line_data: {
      line1_location: '39.4650,-0.3800',
      line2_frequency: 'FM 34.250',
      line3_casualties: '1 PRIORITY',
      line5_patient_info: 'Male, 31y, ESP INF-B',
      line9_remarks: 'Being moved on foot to Aid Post Alpha. ETA ~8 min.'
    }
  },
  {
    entity_ref: 'CAS-3',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (fragmentation)',
    primary_injury: 'Facial laceration, left cheek, ~6cm, superficial',
    vital_signs: [
      { hr: 78,  bp: '118/76', spo2: 98, recorded_at: '2026-02-02T18:01:00Z' }
    ],
    prehospital_treatment: 'Wound cleaned and dressed at POI',
    evac_priority: 'ROUTINE',
    evac_stage: 'delivered',                     // already at Aid Post
    destination_facility_ref: 'MED-R1-ALPHA',
    nine_line_data: null                         // not yet extracted
  }
];

module.exports = { meta, entities, medicalDetails };
