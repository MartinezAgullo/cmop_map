// scripts/scenarios/paris_sud_medevac.js
//
// Scenario: Paris Sud MEDEVAC
// ---------------------------
// Multinational brigade exercise south of Paris (France/Spain/Germany/Italy).
// Combined arms training with medical support, MEDEVAC assets, and casualties.
// All friendly forces — no hostile units in this exercise.
//
// Triage colours follow multinational STANAG coding:
//   T1=RED (Immediate), T2=YELLOW (Urgent), T3=GREEN (Minimal),
//   T4=BLUE (Expectant), Dead=BLACK
//
// nine_line_data follows NATO 9-Line MEDEVAC Request structure (see schema.js)
//
// Coordinates: South of Paris, France (48.5-48.6°N, 2.2-2.35°E)
// Run with
//   docker compose up -d
//   node scripts/init-db.js
//   node scripts/load-scenario.js paris_sud_medevac
//   npm run dev
// ---------------------------------------------------------------------------

const meta = {
  name: 'paris_sud_medevac',
  description: 'Multinational brigade exercise south of Paris. Spanish, French, German, and Italian units conducting combined arms training with full medical support. Multiple casualties (WIA/KIA) and MEDEVAC operations.',
  tags: ['medevac', 'paris', 'multinational', 'exercise', 'medical', 'training']
};

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------
const entities = [
  // ---------------------------------------------------------------
  // Brigade & Battalion HQ
  // ---------------------------------------------------------------
  { nombre: 'SpBde', descripcion: 'Spanish Brigade HQ', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPBDE', activo: true, tipo_elemento: 'mechanised', prioridad: 10, observaciones: 'Brigade command element', altitud: null, lng: 2.24439, lat: 48.57078 },
  { nombre: 'SpBatt', descripcion: 'Spanish Battalion HQ', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPBATT', activo: true, tipo_elemento: 'mechanised', prioridad: 9, observaciones: 'Battalion tactical CP', altitud: null, lng: 2.27546, lat: 48.57436 },

  // ---------------------------------------------------------------
  // Company-level units
  // ---------------------------------------------------------------
  { nombre: 'FrCoy', descripcion: 'French mechanised company (wheeled)', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FRCOY', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 7, observaciones: 'VBCI equipped', altitud: null, lng: 2.32724, lat: 48.5993 },
  { nombre: 'GeCoy', descripcion: 'German armoured company', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GECOY', activo: true, tipo_elemento: 'MBT', prioridad: 8, observaciones: 'Leopard 2A7', altitud: null, lng: 2.3461, lat: 48.6025 },
  { nombre: 'SpCoy', descripcion: 'Spanish mechanised company', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPCOY', activo: true, tipo_elemento: 'mechanised', prioridad: 7, observaciones: 'Pizarro IFV equipped', altitud: null, lng: 2.33113, lat: 48.5839 },

  // ---------------------------------------------------------------
  // Platoon-level units
  // ---------------------------------------------------------------
  { nombre: 'SpPl', descripcion: 'Spanish platoon (wheeled)', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPPL', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 5, observaciones: 'VEC reconnaissance', altitud: null, lng: 2.33113, lat: 48.5839 },
  { nombre: 'SpPlSq1', descripcion: 'Spanish squad 1', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPPLSQ1', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 4, observaciones: 'Forward element', altitud: null, lng: 2.34094, lat: 48.58778 },
  { nombre: 'SpPlSq2', descripcion: 'Spanish squad 2', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPPLSQ2', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 4, observaciones: 'Overwatch position', altitud: null, lng: 2.33734, lat: 48.58498 },
  { nombre: 'SpPlSq3', descripcion: 'Spanish squad 3', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPPLSQ3', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 4, observaciones: 'Reserve', altitud: null, lng: 2.33106, lat: 48.58372 },

  { nombre: 'FrPl', descripcion: 'French platoon (wheeled)', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FRPL', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 5, observaciones: 'VAB equipped', altitud: null, lng: 2.32724, lat: 48.5993 },
  { nombre: 'FrPlSq1', descripcion: 'French squad 1', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FRPLSQ1', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 4, observaciones: 'Northern sector', altitud: null, lng: 2.35133, lat: 48.59762 },
  { nombre: 'FrPlSq2', descripcion: 'French squad 2', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FRPLSQ2', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 4, observaciones: 'Securing flank', altitud: null, lng: 2.35161, lat: 48.60343 },
  { nombre: 'FrPlSq3', descripcion: 'French squad 3', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FRPLSQ3', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 4, observaciones: 'Support by fire', altitud: null, lng: 2.34987, lat: 48.60101 },

  { nombre: 'ItPl', descripcion: 'Italian platoon (wheeled)', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITPL', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 5, observaciones: 'Centauro equipped', altitud: null, lng: 2.3461, lat: 48.6025 },
  { nombre: 'ItPlSq1', descripcion: 'Italian squad 1', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITPLSQ1', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 4, observaciones: 'Screening', altitud: null, lng: 2.32936, lat: 48.59644 },
  { nombre: 'ItPlSq2', descripcion: 'Italian squad 2', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITPLSQ2', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 4, observaciones: 'Eastern approach', altitud: null, lng: 2.34901, lat: 48.61559 },
  { nombre: 'ItPlSq3', descripcion: 'Italian squad 3', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITPLSQ3', activo: true, tipo_elemento: 'mechanised_wheeled', prioridad: 4, observaciones: 'Reserve force', altitud: null, lng: 2.35183, lat: 48.61745 },

  // ---------------------------------------------------------------
  // German armoured platoon (tank platoon supporting GeCoy)
  // ---------------------------------------------------------------
  { nombre: 'GeTankPl', descripcion: 'German tank platoon', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GETANKPL', activo: true, tipo_elemento: 'MBT', prioridad: 7, observaciones: 'Leopard 2A7 platoon', altitud: null, lng: 2.36, lat: 48.605 },
  { nombre: 'GeTankSq1', descripcion: 'German tank squad 1', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GETANKSQ1', activo: true, tipo_elemento: 'MBT', prioridad: 6, observaciones: 'Lead tank', altitud: null, lng: 2.365, lat: 48.606 },
  { nombre: 'GeTankSq2', descripcion: 'German tank squad 2', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GETANKSQ2', activo: true, tipo_elemento: 'MBT', prioridad: 6, observaciones: 'Wingman', altitud: null, lng: 2.37, lat: 48.607 },
  { nombre: 'GeTankSq3', descripcion: 'German tank squad 3', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GETANKSQ3', activo: true, tipo_elemento: 'MBT', prioridad: 6, observaciones: 'Trail tank', altitud: null, lng: 2.375, lat: 48.608 },

  // ---------------------------------------------------------------
  // Engineer unit
  // ---------------------------------------------------------------
  { nombre: 'SpEngUnit', descripcion: 'Spanish engineer unit', categoria: 'engineer', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPENGUNIT', activo: true, tipo_elemento: 'standard', prioridad: 6, observaciones: 'Mobility/counter-mobility', altitud: null, lng: 2.31772, lat: 48.59366 },
  { nombre: 'SpEngSq1', descripcion: 'Spanish engineer squad 1', categoria: 'engineer', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPENGSQ1', activo: true, tipo_elemento: 'standard', prioridad: 5, observaciones: 'Obstacle emplacement', altitud: null, lng: 2.32838, lat: 48.59604 },
  { nombre: 'SpEngSq2', descripcion: 'Spanish engineer squad 2', categoria: 'engineer', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPENGSQ2', activo: true, tipo_elemento: 'standard', prioridad: 5, observaciones: 'Breaching team', altitud: null, lng: 2.32068, lat: 48.59081 },
  { nombre: 'SpEngSq3', descripcion: 'Spanish engineer squad 3', categoria: 'engineer', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPENGSQ3', activo: true, tipo_elemento: 'standard', prioridad: 5, observaciones: 'Mine clearance', altitud: null, lng: 2.3257, lat: 48.59441 },

  // ---------------------------------------------------------------
  // Mortar section
  // ---------------------------------------------------------------
  { nombre: 'SpMoSq', descripcion: 'Spanish heavy mortar section', categoria: 'mortar', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPMOSQ', activo: true, tipo_elemento: 'heavy', prioridad: 7, observaciones: '120mm mortars', altitud: null, lng: 2.3369, lat: 48.60439 },

  // ---------------------------------------------------------------
  // ISR & Reconnaissance
  // ---------------------------------------------------------------
  { nombre: 'ItUavTm1', descripcion: 'Italian UAV team', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITUAVTM1', activo: true, tipo_elemento: 'uav', prioridad: 6, observaciones: 'UAV-Small1', altitud: null, lng: 2.33952, lat: 48.61024 },
  { nombre: 'SpSvTm1', descripcion: 'Spanish reconnaissance team', categoria: 'reconnaissance', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPSVTM1', activo: true, tipo_elemento: 'wheeled', prioridad: 6, observaciones: 'Forward scouts', altitud: null, lng: 2.3352, lat: 48.58266 },

  // ---------------------------------------------------------------
  // Medical facilities
  // ---------------------------------------------------------------
  { nombre: 'ESP MED Role-1', descripcion: 'Spanish Role-1 aid post', categoria: 'medical_facility', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-MED-R1', activo: true, tipo_elemento: 'medical_role_1', prioridad: 10, observaciones: 'Forward medical point', altitud: null, lng: 2.30, lat: 48.58 },
  { nombre: 'FRA MED Role-2', descripcion: 'French Role-2 surgical facility', categoria: 'medical_facility', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-MED-R2', activo: true, tipo_elemento: 'medical_role_2', prioridad: 10, observaciones: 'Forward surgical team', altitud: null, lng: 2.25, lat: 48.60 },
  { nombre: 'DEU MED Role-3', descripcion: 'German Role-3 field hospital', categoria: 'medical_facility', country: 'Germany', alliance: 'friendly', elemento_identificado: 'DEU-MED-R3', activo: true, tipo_elemento: 'medical_role_3', prioridad: 10, observaciones: 'Full surgical capability', altitud: null, lng: 2.20, lat: 48.62 },

  // ---------------------------------------------------------------
  // MEDEVAC assets
  // ---------------------------------------------------------------
  { nombre: 'ESP MEDEVAC-1', descripcion: 'Spanish MEDEVAC helicopter', categoria: 'medevac_unit', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-MEDEVAC-1', activo: true, tipo_elemento: 'medevac_role_1', prioridad: 10, observaciones: 'Standby at Role-1', altitud: 0, lng: 2.305, lat: 48.58 },
  { nombre: 'FRA MEDEVAC-2', descripcion: 'French MEDEVAC helicopter', categoria: 'medevac_unit', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-MEDEVAC-2', activo: true, tipo_elemento: 'medevac_role_2', prioridad: 10, observaciones: 'Standby at Role-2', altitud: 0, lng: 2.255, lat: 48.60 },
  { nombre: 'ITA MEDEVAC-1', descripcion: 'Italian MEDEVAC ambulance', categoria: 'medevac_unit', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITA-MEDEVAC-1', activo: true, tipo_elemento: 'medevac_role_1', prioridad: 8, observaciones: 'Ground evacuation', altitud: null, lng: 2.34, lat: 48.595 },

  // ---------------------------------------------------------------
  // Casualties
  // ---------------------------------------------------------------
  // French KIA
  { nombre: 'FRA-CAS-1 (KIA)', descripcion: 'French KIA', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-CAS-1', activo: true, tipo_elemento: 'casualty', prioridad: 3, observaciones: 'Training accident — vehicle rollover', altitud: null, lng: 2.353, lat: 48.598 },
  { nombre: 'FRA-CAS-2 (KIA)', descripcion: 'French KIA', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-CAS-2', activo: true, tipo_elemento: 'casualty', prioridad: 3, observaciones: 'Training accident — vehicle rollover', altitud: null, lng: 2.354, lat: 48.5985 },

  // French T4 Expectant (new — demonstrates BLUE triage in training exercise)
  { nombre: 'FRA-CAS-3 (T4)', descripcion: 'French T4 Expectant — severe polytrauma from vehicle rollover', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-CAS-3', activo: true, tipo_elemento: 'casualty', prioridad: 4, observaciones: 'Third occupant from vehicle rollover. Massive internal injuries. Triaged T4 given MASCAL conditions.', altitud: null, lng: 2.3535, lat: 48.5983 },

  // German WIA
  { nombre: 'GER-CAS-1 (WIA)', descripcion: 'German WIA — blast injury', categoria: 'casualty', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GER-CAS-1', activo: true, tipo_elemento: 'casualty', prioridad: 9, observaciones: 'Shrapnel wounds, stable', altitud: null, lng: 2.368, lat: 48.606 },
  { nombre: 'GER-CAS-2 (WIA)', descripcion: 'German WIA — crush injury', categoria: 'casualty', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GER-CAS-2', activo: true, tipo_elemento: 'casualty', prioridad: 8, observaciones: 'Lower limb trauma', altitud: null, lng: 2.372, lat: 48.607 },

  // Italian WIA
  { nombre: 'ITA-CAS-1 (WIA)', descripcion: 'Italian WIA — heat exhaustion', categoria: 'casualty', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITA-CAS-1', activo: true, tipo_elemento: 'casualty', prioridad: 5, observaciones: 'Heat exhaustion, dehydration', altitud: null, lng: 2.348, lat: 48.615 },

  // Spanish WIA
  { nombre: 'ESP-CAS-1 (WIA)', descripcion: 'Spanish WIA — laceration', categoria: 'casualty', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-CAS-1', activo: true, tipo_elemento: 'casualty', prioridad: 6, observaciones: 'Facial laceration, conscious', altitud: null, lng: 2.328, lat: 48.587 },
  { nombre: 'ESP-CAS-2 (WIA)', descripcion: 'Spanish WIA — sprain', categoria: 'casualty', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-CAS-2', activo: true, tipo_elemento: 'casualty', prioridad: 4, observaciones: 'Ankle sprain during dismount', altitud: null, lng: 2.332, lat: 48.585 },
];

// ---------------------------------------------------------------------------
// Medical details
//
// nine_line_data follows NATO 9-Line MEDEVAC Request structure.
// See GET /api/schema → nine_line_medevac for field definitions.
// ---------------------------------------------------------------------------
const medicalDetails = [
  // French KIA
  {
    entity_ref: 'FRA-CAS-1',
    triage_color: 'BLACK',       // Dead — immediate death
    casualty_status: 'KIA',
    injury_mechanism: 'Vehicle rollover',
    primary_injury: 'Fatal head trauma',
    vital_signs: null,
    prehospital_treatment: 'None — immediate death',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },
  {
    entity_ref: 'FRA-CAS-2',
    triage_color: 'BLACK',       // Dead — immediate death
    casualty_status: 'KIA',
    injury_mechanism: 'Vehicle rollover',
    primary_injury: 'Fatal crush injury',
    vital_signs: null,
    prehospital_treatment: 'None — immediate death',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },

  // French T4 Expectant (new — demonstrates BLUE triage)
  {
    entity_ref: 'FRA-CAS-3',
    triage_color: 'BLUE',        // T4 Expectant — expected to die given MASCAL conditions
    casualty_status: 'WIA',
    injury_mechanism: 'Vehicle rollover',
    primary_injury: 'Massive internal haemorrhage, bilateral flail chest, suspected C-spine fracture. Non-survivable given simultaneous multiple-casualty event.',
    vital_signs: [
      { hr: 130, bp: '65/40', spo2: 80, recorded_at: '2026-02-06T16:10:00Z' },
      { hr: 138, bp: '58/35', spo2: 75, recorded_at: '2026-02-06T16:25:00Z' }
    ],
    prehospital_treatment: 'IV morphine 10mg, comfort measures. Triaged T4 due to concurrent MASCAL with 2x KIA.',
    evac_priority: 'ROUTINE',     // T4 patients receive lowest evac priority
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null           // No MEDEVAC request — palliative care only
  },

  // German WIA
  {
    entity_ref: 'GER-CAS-1',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance)',
    primary_injury: 'Multiple superficial shrapnel wounds — chest, arms',
    vital_signs: [
      { hr: 95, bp: '115/75', spo2: 97, recorded_at: '2026-02-06T16:30:00Z' }
    ],
    prehospital_treatment: 'Wounds cleaned, dressed. IV access established.',
    evac_priority: 'PRIORITY',
    evac_stage: 'in_transit',
    destination_facility_ref: 'FRA-MED-R2',
    nine_line_data: {
      line1_location: '48.606,2.368',
      line2_callsign: 'GETANKPL MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'A',
      line7_marking_detail: 'orange VS-17 panel',
      line8_nationality: 'C',
      line9_nbc: null,
      remarks: 'Stable, en route to Role-2 by ground ambulance.'
    }
  },
  {
    entity_ref: 'GER-CAS-2',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Crush injury (vehicle incident)',
    primary_injury: 'Right tibia fracture, suspected compartment syndrome',
    vital_signs: [
      { hr: 105, bp: '110/70', spo2: 96, recorded_at: '2026-02-06T16:45:00Z' }
    ],
    prehospital_treatment: 'Splinted, IV morphine, IV fluids',
    evac_priority: 'PRIORITY',
    evac_stage: 'at_poi',
    destination_facility_ref: 'FRA-MED-R2',
    nine_line_data: {
      line1_location: '48.607,2.372',
      line2_callsign: 'GETANKSQ2 MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'C',
      line9_nbc: null,
      remarks: 'Possible compartment syndrome, needs surgical eval. Requesting MEDEVAC helicopter.'
    }
  },

  // Italian WIA
  {
    entity_ref: 'ITA-CAS-1',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Heat exhaustion',
    primary_injury: 'Severe dehydration, heat exhaustion',
    vital_signs: [
      { hr: 110, bp: '105/65', spo2: 98, recorded_at: '2026-02-06T17:00:00Z' }
    ],
    prehospital_treatment: 'Oral rehydration, cooling measures',
    evac_priority: 'ROUTINE',
    evac_stage: 'delivered',
    destination_facility_ref: 'ESP-MED-R1',
    nine_line_data: null
  },

  // Spanish WIA
  {
    entity_ref: 'ESP-CAS-1',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Laceration (equipment)',
    primary_injury: 'Left cheek laceration, 4cm, superficial',
    vital_signs: [
      { hr: 80, bp: '120/78', spo2: 99, recorded_at: '2026-02-06T16:20:00Z' }
    ],
    prehospital_treatment: 'Wound cleaned, sutured at Role-1',
    evac_priority: 'ROUTINE',
    evac_stage: 'delivered',
    destination_facility_ref: 'ESP-MED-R1',
    nine_line_data: null
  },
  {
    entity_ref: 'ESP-CAS-2',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Sprain (dismount)',
    primary_injury: 'Right ankle sprain, Grade II',
    vital_signs: [
      { hr: 75, bp: '118/76', spo2: 99, recorded_at: '2026-02-06T16:35:00Z' }
    ],
    prehospital_treatment: 'RICE protocol, wrapped, crutches issued',
    evac_priority: 'ROUTINE',
    evac_stage: 'delivered',
    destination_facility_ref: 'ESP-MED-R1',
    nine_line_data: null
  }
];

module.exports = { meta, entities, medicalDetails };
