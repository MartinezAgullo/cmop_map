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
  { nombre: 'SpaBde', descripcion: 'Spanish Brigade HQ', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaBde', activo: true, tipo_elemento: 'mechanised', observaciones: 'Brigade command element', altitud: null, lng: 2.24439, lat: 48.57078 },
  { nombre: 'SpaBatt', descripcion: 'Spanish Battalion HQ', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaBatt', activo: true, tipo_elemento: 'mechanised', observaciones: 'Battalion tactical CP', altitud: null, lng: 2.27546, lat: 48.57436 },

  // ---------------------------------------------------------------
  // Company-level units
  // ---------------------------------------------------------------
  { nombre: 'FraCoy', descripcion: 'French mechanised company (wheeled)', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FraCoy', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'VBCI equipped', altitud: null, lng: 2.32724, lat: 48.5993 },
  { nombre: 'GerCoy', descripcion: 'German armoured company', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GerCoy', activo: true, tipo_elemento: 'MBT', observaciones: 'Leopard 2A7', altitud: null, lng: 2.3461, lat: 48.6025 },
  { nombre: 'SpaCoy', descripcion: 'Spanish mechanised company', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaCoy', activo: true, tipo_elemento: 'mechanised', observaciones: 'Pizarro IFV equipped', altitud: null, lng: 2.33113, lat: 48.5839 },

  // ---------------------------------------------------------------
  // Platoon-level units
  // ---------------------------------------------------------------
  { nombre: 'SpaPl', descripcion: 'Spanish platoon (wheeled)', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaPl', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'VEC reconnaissance', altitud: null, lng: 2.33113, lat: 48.5839 },
  { nombre: 'SpaPlSq1', descripcion: 'Spanish squad 1', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaPlSq1', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Forward element', altitud: null, lng: 2.34094, lat: 48.58778 },
  { nombre: 'SpaPlSq2', descripcion: 'Spanish squad 2', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaPlSq2', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Overwatch position', altitud: null, lng: 2.33734, lat: 48.58498 },
  { nombre: 'SpaPlSq3', descripcion: 'Spanish squad 3', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaPlSq3', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Reserve', altitud: null, lng: 2.33106, lat: 48.58372 },

  { nombre: 'FraPl', descripcion: 'French platoon (wheeled)', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FraPl', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'VAB equipped', altitud: null, lng: 2.32724, lat: 48.5993 },
  { nombre: 'FraPlSq1', descripcion: 'French squad 1', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FraPlSq1', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Northern sector', altitud: null, lng: 2.35133, lat: 48.59762 },
  { nombre: 'FraPlSq2', descripcion: 'French squad 2', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FraPlSq2', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Securing flank', altitud: null, lng: 2.35161, lat: 48.60343 },
  { nombre: 'FraPlSq3', descripcion: 'French squad 3', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FraPlSq3', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Support by fire', altitud: null, lng: 2.34987, lat: 48.60101 },

  { nombre: 'ItaPl', descripcion: 'Italian platoon (wheeled)', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ItaPl', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Centauro equipped', altitud: null, lng: 2.3461, lat: 48.6025 },
  { nombre: 'ItaPlSq1', descripcion: 'Italian squad 1', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ItaPlSq1', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Screening', altitud: null, lng: 2.32936, lat: 48.59644 },
  { nombre: 'ItaPlSq2', descripcion: 'Italian squad 2', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ItaPlSq2', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Eastern approach', altitud: null, lng: 2.34901, lat: 48.61559 },
  { nombre: 'ItaPlSq3', descripcion: 'Italian squad 3', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ItaPlSq3', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Reserve force', altitud: null, lng: 2.35183, lat: 48.61745 },

  // ---------------------------------------------------------------
  // German armoured platoon (tank platoon supporting GerCoy)
  // ---------------------------------------------------------------
  { nombre: 'GerTankPl', descripcion: 'German tank platoon', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GerTankPl', activo: true, tipo_elemento: 'MBT', observaciones: 'Leopard 2A7 platoon', altitud: null, lng: 2.36, lat: 48.605 },
  { nombre: 'GerTankSq1', descripcion: 'German tank squad 1', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GerTankSq1', activo: true, tipo_elemento: 'MBT', observaciones: 'Lead tank', altitud: null, lng: 2.365, lat: 48.606 },
  { nombre: 'GerTankSq2', descripcion: 'German tank squad 2', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GerTankSq2', activo: true, tipo_elemento: 'MBT', observaciones: 'Wingman', altitud: null, lng: 2.37, lat: 48.607 },
  { nombre: 'GerTankSq3', descripcion: 'German tank squad 3', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GerTankSq3', activo: true, tipo_elemento: 'MBT', observaciones: 'Trail tank', altitud: null, lng: 2.375, lat: 48.608 },

  // ---------------------------------------------------------------
  // Engineer unit
  // ---------------------------------------------------------------
  { nombre: 'SpaEngUnit', descripcion: 'Spanish engineer unit', categoria: 'engineer', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaEngUnit', activo: true, tipo_elemento: 'standard', observaciones: 'Mobility/counter-mobility', altitud: null, lng: 2.31772, lat: 48.59366 },
  { nombre: 'SpaEngSq1', descripcion: 'Spanish engineer squad 1', categoria: 'engineer', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaEngSq1', activo: true, tipo_elemento: 'standard', observaciones: 'Obstacle emplacement', altitud: null, lng: 2.32838, lat: 48.59604 },
  { nombre: 'SpaEngSq2', descripcion: 'Spanish engineer squad 2', categoria: 'engineer', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaEngSq2', activo: true, tipo_elemento: 'standard', observaciones: 'Breaching team', altitud: null, lng: 2.32068, lat: 48.59081 },
  { nombre: 'SpaEngSq3', descripcion: 'Spanish engineer squad 3', categoria: 'engineer', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaEngSq3', activo: true, tipo_elemento: 'standard', observaciones: 'Mine clearance', altitud: null, lng: 2.3257, lat: 48.59441 },

  // ---------------------------------------------------------------
  // Mortar section
  // ---------------------------------------------------------------
  { nombre: 'SpaMoSq', descripcion: 'Spanish heavy mortar section', categoria: 'mortar', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaMoSq', activo: true, tipo_elemento: 'heavy', observaciones: '120mm mortars', altitud: null, lng: 2.3369, lat: 48.60439 },

  // ---------------------------------------------------------------
  // ISR & Reconnaissance
  // ---------------------------------------------------------------
  { nombre: 'ItaUavTm1', descripcion: 'Italian UAV team', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ItaUavTm1', activo: true, tipo_elemento: 'uav', observaciones: 'UAV-Small1', altitud: null, lng: 2.33952, lat: 48.61024 },
  { nombre: 'SpaSvTm1', descripcion: 'Spanish reconnaissance team', categoria: 'reconnaissance', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaSvTm1', activo: true, tipo_elemento: 'wheeled', mobility: 'ground', observaciones: 'Forward scouts', altitud: null, lng: 2.3352, lat: 48.58266 },

  // ---------------------------------------------------------------
  // Medical facilities
  // ---------------------------------------------------------------
  { nombre: 'SpaMedRole1', descripcion: 'Spanish Role-1 aid post', categoria: 'medical_facility', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaMedRole1', activo: true, tipo_elemento: 'medical_role_1', observaciones: 'Forward medical point', altitud: null, max_capacity: 50, occupancy: 5, lng: 2.30, lat: 48.58 },
  { nombre: 'FraMedRole2', descripcion: 'French Role-2 surgical facility', categoria: 'medical_facility', country: 'France', alliance: 'friendly', elemento_identificado: 'FraMedRole2', activo: true, tipo_elemento: 'medical_role_2', observaciones: 'Forward surgical team', altitud: null, max_capacity: 100, occupancy: 15, lng: 2.25, lat: 48.60 },
  { nombre: 'GerMedRole3', descripcion: 'German Role-3 field hospital', categoria: 'medical_facility', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GerMedRole3', activo: true, tipo_elemento: 'medical_role_3', observaciones: 'Full surgical capability', altitud: null, max_capacity: 300, occupancy: 50, lng: 2.20, lat: 48.62 },

  // ---------------------------------------------------------------
  // MEDEVAC assets
  // ---------------------------------------------------------------
  { nombre: 'SpaMedevac1', descripcion: 'Spanish MEDEVAC ambulance', categoria: 'medevac_unit', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaMedevac1', activo: true, tipo_elemento: 'medevac_role_1', mobility: 'ground', capacity: 1, observaciones: 'Ground evacuation', altitud: null, lng: 2.305, lat: 48.58 },
  { nombre: 'FraMedevac2', descripcion: 'French MEDEVAC ambulance', categoria: 'medevac_unit', country: 'France', alliance: 'friendly', elemento_identificado: 'FraMedevac2', activo: true, tipo_elemento: 'medevac_role_2', mobility: 'ground', capacity: 1, observaciones: 'Ground evacuation', altitud: null, lng: 2.255, lat: 48.60 },
  { nombre: 'ItaMedevac1', descripcion: 'Italian MEDEVAC ambulance', categoria: 'medevac_unit', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ItaMedevac1', activo: true, tipo_elemento: 'medevac_role_1', mobility: 'ground', capacity: 1, observaciones: 'Ground evacuation', altitud: null, lng: 2.34, lat: 48.595 },

  // ---------------------------------------------------------------
  // Casualties
  // ---------------------------------------------------------------
  // French KIA
  { nombre: 'FraCas1', descripcion: 'French KIA', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FraCas1', activo: true, tipo_elemento: 'casualty', observaciones: 'Training accident — vehicle rollover', altitud: null, lng: 2.353, lat: 48.598 },
  { nombre: 'FraCas2', descripcion: 'French KIA', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FraCas2', activo: true, tipo_elemento: 'casualty', observaciones: 'Training accident — vehicle rollover', altitud: null, lng: 2.354, lat: 48.5985 },
  // { nombre: 'FraCas4', descripcion: 'French WIA — penetrating thoracic trauma', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FraCas4', activo: true, tipo_elemento: 'casualty', observaciones: 'Penetrating chest wound, tension pneumothorax decompressed on scene', altitud: null, lng: 2.3532, lat: 48.5978 },

  // French T4 Expectant (new — demonstrates BLUE triage in training exercise)
  // { nombre: 'FraCas3', descripcion: 'French WIA', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FraCas3', activo: true, tipo_elemento: 'casualty', observaciones: 'Third occupant from vehicle rollover. Massive internal injuries. Triaged T4 given MASCAL conditions.', altitud: null, lng: 2.3535, lat: 48.5983 },

  // German WIA
  // { nombre: 'GerCas1', descripcion: 'German WIA — blast injury', categoria: 'casualty', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GerCas1', activo: true, tipo_elemento: 'casualty', observaciones: 'Shrapnel wounds, stable', altitud: null, lng: 2.368, lat: 48.606 },
  { nombre: 'GerCas2', descripcion: 'German WIA — crush injury', categoria: 'casualty', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GerCas2', activo: true, tipo_elemento: 'casualty', observaciones: 'Lower limb trauma', altitud: null, lng: 2.372, lat: 48.607 },

  // Italian WIA
  // { nombre: 'ItaCas1', descripcion: 'Italian WIA — heat exhaustion', categoria: 'casualty', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ItaCas1', activo: true, tipo_elemento: 'casualty', observaciones: 'Heat exhaustion, dehydration', altitud: null, lng: 2.348, lat: 48.615 },
  { nombre: 'ItaCas2', descripcion: 'Italian WIA — fragmentation wound', categoria: 'casualty', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ItaCas2', activo: true, tipo_elemento: 'casualty', observaciones: 'Fragmentation wound to left thigh, tourniquet applied', altitud: null, lng: 2.3493, lat: 48.6141 },

  // Spanish WIA
  // { nombre: 'SpaCas1', descripcion: 'Spanish WIA — laceration', categoria: 'casualty', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaCas1', activo: true, tipo_elemento: 'casualty', observaciones: 'Facial laceration, conscious', altitud: null, lng: 2.328, lat: 48.587 },
  //{ nombre: 'SpaCas2', descripcion: 'Spanish WIA — sprain', categoria: 'casualty', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaCas2', activo: true, tipo_elemento: 'casualty', observaciones: 'Ankle sprain during dismount', altitud: null, lng: 2.332, lat: 48.585 },
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
    entity_ref: 'FraCas1',
    triage_color: 'BLACK',       // Dead — immediate death
    casualty_status: 'KIA',
    injury_mechanism: 'Vehicle rollover',
    primary_injury: 'Fatal head trauma',
    vital_signs: null,
    prehospital_treatment: 'None — immediate death',

    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },
  {
    entity_ref: 'FraCas2',
    triage_color: 'BLACK',       // Dead — immediate death
    casualty_status: 'KIA',
    injury_mechanism: 'Vehicle rollover',
    primary_injury: 'Fatal crush injury',
    vital_signs: null,
    prehospital_treatment: 'None — immediate death',

    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },

  // French RED
  // {
  //   entity_ref: 'FraCas4',
  //   triage_color: 'RED',
  //   casualty_status: 'WIA',
  //   injury_mechanism: 'Penetrating trauma (shrapnel)',
  //   primary_injury: 'Open pneumothorax right side, tension pneumothorax decompressed with needle decompression. Haemothorax suspected.',
  //   vital_signs: [
  //     { hr: 125, bp: '85/55', spo2: 88, recorded_at: '2026-02-06T16:12:00Z' },
  //     { hr: 118, bp: '92/60', spo2: 91, recorded_at: '2026-02-06T16:22:00Z' }
  //   ],
  //   prehospital_treatment: 'Needle decompression right 2nd ICS, chest seal applied, high-flow O2, IV morphine 5mg, two large-bore IV lines',

  //   evac_stage: 'at_poi',
  //   destination_facility_ref: null,
  //   nine_line_data: {
  //     line1_location: '48.5978,2.3532',
  //     line2_callsign: 'FraPlSq1 MEDIC',
  //     line2_frequency: 'FM 45.100',
  //     line3_precedence: 'A',
  //     line3_count: 1,
  //     line4_special_eqpt: 'A',
  //     line5_litter: 1,
  //     line5_ambulatory: 0,
  //     line6_security: 'N',
  //     line7_marking: 'A',
  //     line7_marking_detail: 'red VS-17 panel',
  //     line8_nationality: 'French Military',
  //     line9_nbc: null,
  //     remarks: 'Immediate MEDEVAC required. Deteriorating respiratory status post-decompression.'
  //   }
  // },

  // French T4 Expectant (new — demonstrates BLUE triage)
  // {
  //   entity_ref: 'FraCas3',
  //   triage_color: 'BLUE',        // T4 Expectant — expected to die given MASCAL conditions
  //   casualty_status: 'WIA',
  //   injury_mechanism: 'Vehicle rollover',
  //   primary_injury: 'Massive internal haemorrhage, bilateral flail chest, suspected C-spine fracture. Non-survivable given simultaneous multiple-casualty event.',
  //   vital_signs: [
  //     { hr: 130, bp: '65/40', spo2: 80, recorded_at: '2026-02-06T16:10:00Z' },
  //     { hr: 138, bp: '58/35', spo2: 75, recorded_at: '2026-02-06T16:25:00Z' }
  //   ],
  //   prehospital_treatment: 'IV morphine 10mg, comfort measures. Triaged T4 due to concurrent MASCAL with 2x KIA.',

  //   evac_stage: 'at_poi',
  //   destination_facility_ref: null,
  //   nine_line_data: null           // No MEDEVAC request — palliative care only
  // },

  // German WIA
  // {
  //   entity_ref: 'GerCas1',
  //   triage_color: 'YELLOW',
  //   casualty_status: 'WIA',
  //   injury_mechanism: 'Blast (training ordnance)',
  //   primary_injury: 'Multiple superficial shrapnel wounds — chest, arms',
  //   vital_signs: [
  //     { hr: 95, bp: '115/75', spo2: 97, recorded_at: '2026-02-06T16:30:00Z' }
  //   ],
  //   prehospital_treatment: 'Wounds cleaned, dressed. IV access established.',

  //   evac_stage: 'in_transit',
  //   destination_facility_ref: 'FraMedRole2',
  //   nine_line_data: {
  //     line1_location: '48.606,2.368',
  //     line2_callsign: 'GerTankPl MEDIC',
  //     line2_frequency: 'FM 45.100',
  //     line3_precedence: 'C',
  //     line3_count: 1,
  //     line4_special_eqpt: 'A',
  //     line5_litter: 0,
  //     line5_ambulatory: 1,
  //     line6_security: 'N',
  //     line7_marking: 'A',
  //     line7_marking_detail: 'orange VS-17 panel',
  //     line8_nationality: 'German Military',
  //     line9_nbc: null,
  //     remarks: 'Stable, en route to Role-2 by ground ambulance.'
  //   }
  // },
  {
    entity_ref: 'GerCas2',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Crush injury (vehicle incident)',
    primary_injury: 'Right tibia fracture, suspected compartment syndrome',
    vital_signs: [
      { hr: 105, bp: '110/70', spo2: 96, recorded_at: '2026-02-06T16:45:00Z' }
    ],
    prehospital_treatment: 'Splinted, IV morphine, IV fluids',

    evac_stage: 'at_poi',
    destination_facility_ref: 'FraMedRole2',
    nine_line_data: {
      line1_location: '48.607,2.372',
      line2_callsign: 'GerTankSq2 MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'German Military',
      line9_nbc: null,
      remarks: 'Possible compartment syndrome, needs surgical eval. Requesting MEDEVAC helicopter.'
    }
  },

  // Italian WIA
  {
    entity_ref: 'ItaCas2',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Fragmentation (training ordnance)',
    primary_injury: 'Penetrating fragmentation wound left thigh, femoral haemorrhage controlled with tourniquet',
    vital_signs: [
      { hr: 112, bp: '100/65', spo2: 95, recorded_at: '2026-02-06T17:10:00Z' }
    ],
    prehospital_treatment: 'Tourniquet applied proximal to wound, IV access, 1L NaCl bolus',

    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.6141,2.3493',
      line2_callsign: 'ItaPlSq2 MEDIC',
      line2_frequency: 'FM 45.150',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'yellow smoke',
      line8_nationality: 'Italian Military',
      line9_nbc: null,
      remarks: 'Tourniquet time noted. Requires surgical haemorrhage control urgently.'
    }
  },
  // {
  //   entity_ref: 'ItaCas1',
  //   triage_color: 'GREEN',
  //   casualty_status: 'WIA',
  //   injury_mechanism: 'Heat exhaustion',
  //   primary_injury: 'Severe dehydration, heat exhaustion',
  //   vital_signs: [
  //     { hr: 110, bp: '105/65', spo2: 98, recorded_at: '2026-02-06T17:00:00Z' }
  //   ],
  //   prehospital_treatment: 'Oral rehydration, cooling measures',

  //   evac_stage: 'delivered',
  //   destination_facility_ref: 'SpaMedRole1',
  //   nine_line_data: null
  // },

  // Spanish WIA
  // {
  //   entity_ref: 'SpaCas1',
  //   triage_color: 'GREEN',
  //   casualty_status: 'WIA',
  //   injury_mechanism: 'Laceration (equipment)',
  //   primary_injury: 'Left cheek laceration, 4cm, superficial',
  //   vital_signs: [
  //     { hr: 80, bp: '120/78', spo2: 99, recorded_at: '2026-02-06T16:20:00Z' }
  //   ],
  //   prehospital_treatment: 'Wound cleaned, sutured at Role-1',

  //   evac_stage: 'delivered',
  //   destination_facility_ref: 'SpaMedRole1',
  //   nine_line_data: null
  // },
  // {
  //   entity_ref: 'SpaCas2',
  //   triage_color: 'GREEN',
  //   casualty_status: 'WIA',
  //   injury_mechanism: 'Sprain (dismount)',
  //   primary_injury: 'Right ankle sprain, Grade II',
  //   vital_signs: [
  //     { hr: 75, bp: '118/76', spo2: 99, recorded_at: '2026-02-06T16:35:00Z' }
  //   ],
  //   prehospital_treatment: 'RICE protocol, wrapped, crutches issued',

  //   evac_stage: 'delivered',
  //   destination_facility_ref: 'SpaMedRole1',
  //   nine_line_data: null
  // }
];

module.exports = { meta, entities, medicalDetails };
