// scripts/scenarios/mariupol_siege.js
//
// Scenario: Siege of Mariupol (simulated)
// ----------------------------------------
// Urban combat between Russian and Ukrainian forces around Mariupol (47.098°N, 37.61°E).
// Demonstrates full multi-domain operations: ground, air, sea.
// Medical layer: Ukrainian medical facilities (Role-1/2/3), MEDEVAC assets, casualties (WIA/KIA) on both sides.
//
// Triage colours follow multinational STANAG coding:
//   T1=RED (Immediate), T2=YELLOW (Urgent), T3=GREEN (Minimal),
//   T4=BLUE (Expectant), Dead=BLACK
//
// nine_line_data follows NATO 9-Line MEDEVAC Request structure (see schema.js)
//
// Purpose: showcase map capabilities with realistic combined-arms scenario + medical evacuation workflow.
// ---------------------------------------------------------------------------

const meta = {
  name: 'mariupol_siege',
  description: 'Simulated Siege of Mariupol — RUS vs UKR urban combat with multi-domain ops (ground/air/sea). Medical facilities, MEDEVAC, WIA/KIA casualties.',
  tags: ['mariupol', 'ukraine', 'russia', 'urban', 'medevac', 'multi-domain']
};

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------
const entities = [
  // ---------------------------------------------------------------
  // Ukrainian forces
  // ---------------------------------------------------------------
  // Infantry
  { nombre: 'UkrInf1',  descripcion: 'Ukrainian infantry squad', categoria: 'infantry', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrInf1', activo: true, tipo_elemento: 'standard', observaciones: 'Holding northern sector',  altitud: null, lng: 37.610, lat: 47.105 },
  { nombre: 'UkrInf2',  descripcion: 'Ukrainian infantry squad', categoria: 'infantry', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrInf2', activo: true, tipo_elemento: 'standard', observaciones: 'Port area defense',        altitud: null, lng: 37.565, lat: 47.090 },
  { nombre: 'UkrInf3',  descripcion: 'Ukrainian infantry squad', categoria: 'infantry', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrInf3', activo: true, tipo_elemento: 'standard', observaciones: 'Azovstal perimeter',      altitud: null, lng: 37.620, lat: 47.088 },
  { nombre: 'UkrInf4',  descripcion: 'Ukrainian infantry squad', categoria: 'infantry', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrInf4', activo: true, tipo_elemento: 'standard', observaciones: 'City center strongpoint', altitud: null, lng: 37.545, lat: 47.095 },

  // Armor
  { nombre: 'UkrTank1',  descripcion: 'Ukrainian MBT',             categoria: 'armoured',     country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrTank1', activo: true, tipo_elemento: 'MBT', observaciones: 'Hull-down, covering avenue', altitud: null, lng: 37.600, lat: 47.100 },

  // Artillery
  { nombre: 'UkrArt1',  descripcion: 'Ukrainian 155mm battery',   categoria: 'artillery', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrArt1', activo: true, tipo_elemento: '155mm', observaciones: 'Counterbattery missions', altitud: null, lng: 37.530, lat: 47.110 },

  // Air
  { nombre: 'UkrUav1',  descripcion: 'Ukrainian ISR drone',       categoria: 'uav',       country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrUav1', activo: true, tipo_elemento: 'ISR', observaciones: 'Orbiting above city',     altitud: 800,  lng: 37.580, lat: 47.098 },

  // ---------------------------------------------------------------
  // Russian forces
  // ---------------------------------------------------------------
  // Infantry
  { nombre: 'RusInf1',  descripcion: 'Russian infantry squad',    categoria: 'infantry',  country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RusInf1', activo: true, tipo_elemento: 'standard', observaciones: 'Advancing from west',      altitud: null, lng: 37.520, lat: 47.098 },
  { nombre: 'RusInf2',  descripcion: 'Russian infantry squad',    categoria: 'infantry',  country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RusInf2', activo: true, tipo_elemento: 'standard', observaciones: 'Clearing residential area', altitud: null, lng: 37.590, lat: 47.110 },
  { nombre: 'RusInf3',  descripcion: 'Russian infantry squad',    categoria: 'infantry',  country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RusInf3', activo: true, tipo_elemento: 'standard', observaciones: 'Securing crossroads',      altitud: null, lng: 37.600, lat: 47.105 },

  // Armor
  { nombre: 'RusTank1',  descripcion: 'Russian MBT',               categoria: 'armoured',      country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RusTank1', activo: true, tipo_elemento: 'MBT', observaciones: 'Covering main axis',      altitud: null, lng: 37.555, lat: 47.102 },
  { nombre: 'RusTank2',  descripcion: 'Russian MBT',               categoria: 'armoured',      country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RusTank2', activo: true, tipo_elemento: 'MBT', observaciones: 'Turret-down position',    altitud: null, lng: 37.540, lat: 47.100 },

  // Artillery
  { nombre: 'RusArt1',  descripcion: 'Russian 152mm battery',     categoria: 'artillery', country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RusArt1', activo: true, tipo_elemento: '152mm', observaciones: 'Shelling port area',      altitud: null, lng: 37.480, lat: 47.120 },

  // Air
  { nombre: 'RusHelo1',  descripcion: 'Russian attack helicopter', categoria: 'helicopter', country: 'Russia', alliance: 'hostile',  elemento_identificado: 'RusHelo1', activo: true, tipo_elemento: 'Attack', observaciones: 'CAS mission ongoing',     altitud: 400,  lng: 37.550, lat: 47.115 },
  { nombre: 'RusUav1',  descripcion: 'Russian ISR drone',         categoria: 'uav',       country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RusUav1', activo: true, tipo_elemento: 'ISR', observaciones: 'Artillery spotting',      altitud: 600,  lng: 37.510, lat: 47.105 },

  // ---------------------------------------------------------------
  // Sea forces
  // ---------------------------------------------------------------
  { nombre: 'RusShip1', descripcion: 'Russian patrol boat',       categoria: 'ship',      country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RusShip1', activo: true, tipo_elemento: 'Patrol', observaciones: 'Blockading port',         altitud: null, lng: 37.550, lat: 47.050 },
  { nombre: 'UkrShip1', descripcion: 'Ukrainian patrol boat',     categoria: 'ship',      country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrShip1', activo: true, tipo_elemento: 'Patrol', observaciones: 'Coastal defense',         altitud: null, lng: 37.580, lat: 47.070 },

  // ---------------------------------------------------------------
  // Medical facilities (Ukrainian)
  // ---------------------------------------------------------------
  // Role 1 — forward aid post near Azovstal
  { nombre: 'UkrAidPost1', descripcion: 'Role-1 aid post (Azovstal sector)', categoria: 'medical_facility', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrAidPost1', activo: true, tipo_elemento: 'medical_role_1', observaciones: 'Under periodic indirect fire', altitud: null, max_capacity: 50, occupancy: 5, lng: 37.622, lat: 47.089 },

  // Role 2 — field hospital in western suburbs
  { nombre: 'UkrFieldHosp2', descripcion: 'Role-2 surgical facility', categoria: 'medical_facility', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrFieldHosp2', activo: true, tipo_elemento: 'medical_role_2', observaciones: 'Limited surgical capability', altitud: null, max_capacity: 100, occupancy: 15, lng: 37.510, lat: 47.085 },

  // Role 3 — full hospital (notional — outside city, rear area)
  { nombre: 'UkrHosp3', descripcion: 'Role-3 hospital (Zaporizhzhia)', categoria: 'medical_facility', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrHosp3', activo: true, tipo_elemento: 'medical_role_3', observaciones: 'Full surgical + ICU', altitud: null, max_capacity: 300, occupancy: 50, lng: 37.450, lat: 47.150 },

  // ---------------------------------------------------------------
  // MEDEVAC assets
  // ---------------------------------------------------------------
  { nombre: 'UkrMedevac1', descripcion: 'Ukrainian MEDEVAC helicopter', categoria: 'medevac_unit', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrMedevac1', activo: true, tipo_elemento: 'medevac_role_2', mobility: 'air', capacity: 1, observaciones: 'Standby at Role-2', altitud: 0, lng: 37.512, lat: 47.086 },
  { nombre: 'UkrMedevac2', descripcion: 'Ukrainian MEDEVAC helicopter', categoria: 'medevac_unit', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrMedevac2', activo: true, tipo_elemento: 'medevac_role_1', mobility: 'air', capacity: 1, observaciones: 'On ground at Azovstal',  altitud: 0, lng: 37.625, lat: 47.090 },

  // ---------------------------------------------------------------
  // Casualties
  // ---------------------------------------------------------------
  // Ukrainian WIA
  { nombre: 'UkrCas1', descripcion: 'Ukrainian WIA — shrapnel wounds', categoria: 'casualty', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrCas1', activo: true, tipo_elemento: 'casualty', observaciones: 'Multiple shrapnel wounds, bleeding controlled', altitud: null, lng: 37.611, lat: 47.104 },
  { nombre: 'UkrCas2', descripcion: 'Ukrainian WIA — GSW abdomen',    categoria: 'casualty', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrCas2', activo: true, tipo_elemento: 'casualty', observaciones: 'Abdominal GSW, urgent surgery needed', altitud: null, lng: 37.568, lat: 47.091 },
  { nombre: 'UkrCas3', descripcion: 'Ukrainian WIA — blast injury',   categoria: 'casualty', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrCas3', activo: true, tipo_elemento: 'casualty', observaciones: 'TBI suspected, conscious', altitud: null, lng: 37.621, lat: 47.089 },

  // Ukrainian KIA
  { nombre: 'UkrCas4', descripcion: 'Ukrainian KIA',                  categoria: 'casualty', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrCas4', activo: true, tipo_elemento: 'casualty', observaciones: 'KIA — direct hit from tank round', altitud: null, lng: 37.601, lat: 47.101 },

  // Ukrainian T4 Expectant (new)
  { nombre: 'UkrCas5', descripcion: 'Ukrainian T4 Expectant — massive polytrauma', categoria: 'casualty', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UkrCas5', activo: true, tipo_elemento: 'casualty', observaciones: 'Massive polytrauma from building collapse, palliative care only', altitud: null, lng: 37.615, lat: 47.093 },

  // Russian WIA
  { nombre: 'RusCas1', descripcion: 'Russian WIA — gunshot wound',    categoria: 'casualty', country: 'Russia', alliance: 'hostile', elemento_identificado: 'RusCas1', activo: true, tipo_elemento: 'casualty', observaciones: 'GSW to leg, tourniquet applied', altitud: null, lng: 37.521, lat: 47.099 },
  { nombre: 'RusCas2', descripcion: 'Russian WIA — burns',            categoria: 'casualty', country: 'Russia', alliance: 'hostile', elemento_identificado: 'RusCas2', activo: true, tipo_elemento: 'casualty', observaciones: 'Severe burns from vehicle fire', altitud: null, lng: 37.556, lat: 47.103 },

  // Russian KIA
  { nombre: 'RusCas3', descripcion: 'Russian KIA',                    categoria: 'casualty', country: 'Russia', alliance: 'hostile', elemento_identificado: 'RusCas3', activo: true, tipo_elemento: 'casualty', observaciones: 'KIA — artillery strike', altitud: null, lng: 37.591, lat: 47.111 },
];

// ---------------------------------------------------------------------------
// Medical details
//
// nine_line_data follows NATO 9-Line MEDEVAC Request structure.
// See GET /api/schema → nine_line_medevac for field definitions.
// ---------------------------------------------------------------------------
const medicalDetails = [
  // Ukrainian WIA
  {
    entity_ref: 'UkrCas1',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (shrapnel)',
    primary_injury: 'Multiple shrapnel wounds — right thigh, left forearm, superficial chest',
    vital_signs: [
      { hr: 95, bp: '110/70', spo2: 96, recorded_at: '2026-02-03T14:20:00Z' }
    ],
    prehospital_treatment: 'Wounds packed, IV access, 500ml crystalloid',

    evac_stage: 'at_poi',
    destination_facility_ref: 'UkrAidPost1',
    nine_line_data: {
      line1_location: '47.104,37.611',
      line2_callsign: 'UkrInf1 MEDIC',
      line2_frequency: 'FM 148.350',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'E',
      line7_marking: 'D',
      line8_nationality: 'Ukrainian Military',
      line9_nbc: null,
      remarks: 'Awaiting ground evacuation to Aid Post-1. Area under sporadic indirect fire.'
    }
  },
  {
    entity_ref: 'UkrCas2',
    triage_color: 'RED',
    casualty_status: 'WIA',
    injury_mechanism: 'GSW (rifle)',
    primary_injury: 'Penetrating abdominal GSW, no exit wound',
    vital_signs: [
      { hr: 120, bp: '85/55', spo2: 92, recorded_at: '2026-02-03T14:15:00Z' },
      { hr: 115, bp: '90/58', spo2: 93, recorded_at: '2026-02-03T14:22:00Z' }
    ],
    prehospital_treatment: 'IO access, TXA 1g IV, wound packed',

    evac_stage: 'in_transit',
    destination_facility_ref: 'UkrFieldHosp2',
    nine_line_data: {
      line1_location: '47.091,37.568',
      line2_callsign: 'UkrInf2 MEDIC',
      line2_frequency: 'FM 148.350',
      line3_precedence: 'B',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'P',
      line7_marking: 'D',
      line8_nationality: 'Ukrainian Military',
      line9_nbc: null,
      remarks: 'Being moved by ground to Role-2. Requires immediate surgery. Hemodynamically unstable.'
    }
  },
  {
    entity_ref: 'UkrCas3',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (overpressure)',
    primary_injury: 'Suspected TBI, facial abrasions, tinnitus',
    vital_signs: [
      { hr: 88, bp: '125/80', spo2: 97, recorded_at: '2026-02-03T14:30:00Z' }
    ],
    prehospital_treatment: 'Cervical collar, supine position',

    evac_stage: 'delivered',
    destination_facility_ref: 'UkrAidPost1',
    nine_line_data: null
  },
  {
    entity_ref: 'UkrCas4',
    triage_color: 'BLACK',       // Dead — KIA on scene
    casualty_status: 'KIA',
    injury_mechanism: 'Direct hit (tank APFSDS)',
    primary_injury: 'Catastrophic trauma, KIA on scene',
    vital_signs: null,
    prehospital_treatment: 'None — KIA',

    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },

  // Ukrainian T4 Expectant (new — demonstrates BLUE triage)
  {
    entity_ref: 'UkrCas5',
    triage_color: 'BLUE',        // T4 Expectant — expected to die given MASCAL circumstances
    casualty_status: 'WIA',
    injury_mechanism: 'Building collapse (structural)',
    primary_injury: 'Massive polytrauma: crush syndrome, bilateral open femur fractures, suspected spinal cord injury. Non-survivable given available resources.',
    vital_signs: [
      { hr: 140, bp: '60/40', spo2: 78, recorded_at: '2026-02-03T14:40:00Z' },
      { hr: 145, bp: '55/35', spo2: 74, recorded_at: '2026-02-03T14:55:00Z' }
    ],
    prehospital_treatment: 'IV morphine for pain management, comfort measures only',

    evac_stage: 'at_poi',
    destination_facility_ref: 'UkrAidPost1',
    nine_line_data: null           // No MEDEVAC request — palliative care only
  },

  // Russian WIA
  {
    entity_ref: 'RusCas1',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'GSW (rifle)',
    primary_injury: 'GSW right femur, femoral artery spared',
    vital_signs: [
      { hr: 100, bp: '105/65', spo2: 94, recorded_at: '2026-02-03T14:18:00Z' }
    ],
    prehospital_treatment: 'Tourniquet applied, IV access',

    evac_stage: 'at_poi',
    destination_facility_ref: null,  // no friendly facility for hostile casualties
    nine_line_data: null
  },
  {
    entity_ref: 'RusCas2',
    triage_color: 'RED',
    casualty_status: 'WIA',
    injury_mechanism: 'Thermal (vehicle fire)',
    primary_injury: 'Second/third-degree burns — face, torso, arms (>40% TBSA)',
    vital_signs: [
      { hr: 135, bp: '80/50', spo2: 89, recorded_at: '2026-02-03T14:25:00Z' }
    ],
    prehospital_treatment: 'Airway secured, IV fluids started',

    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },
  {
    entity_ref: 'RusCas3',
    triage_color: 'BLACK',       // Dead — KIA from artillery
    casualty_status: 'KIA',
    injury_mechanism: 'Artillery (155mm HE)',
    primary_injury: 'KIA — blast overpressure + fragmentation',
    vital_signs: null,
    prehospital_treatment: 'None — KIA',

    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  }
];

module.exports = { meta, entities, medicalDetails };
