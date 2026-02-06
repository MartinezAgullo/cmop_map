// scripts/scenarios/mariupol_siege.js
//
// Scenario: Siege of Mariupol (simulated)
// ----------------------------------------
// Urban combat between Russian and Ukrainian forces around Mariupol (47.098°N, 37.61°E).
// Demonstrates full multi-domain operations: ground, air, sea.
// Medical layer: Ukrainian medical facilities (Role-1/2/3), MEDEVAC assets, casualties (WIA/KIA) on both sides.
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
  { nombre: 'UKR INF-1',  descripcion: 'Ukrainian infantry squad', categoria: 'infantry', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-INF-1', activo: true, tipo_elemento: 'standard', prioridad: 5, observaciones: 'Holding northern sector',  altitud: null, lng: 37.610, lat: 47.105 },
  { nombre: 'UKR INF-2',  descripcion: 'Ukrainian infantry squad', categoria: 'infantry', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-INF-2', activo: true, tipo_elemento: 'standard', prioridad: 5, observaciones: 'Port area defense',        altitud: null, lng: 37.565, lat: 47.090 },
  { nombre: 'UKR INF-3',  descripcion: 'Ukrainian infantry squad', categoria: 'infantry', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-INF-3', activo: true, tipo_elemento: 'standard', prioridad: 5, observaciones: 'Azovstal perimeter',      altitud: null, lng: 37.620, lat: 47.088 },
  { nombre: 'UKR INF-4',  descripcion: 'Ukrainian infantry squad', categoria: 'infantry', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-INF-4', activo: true, tipo_elemento: 'standard', prioridad: 5, observaciones: 'City center strongpoint', altitud: null, lng: 37.545, lat: 47.095 },

  // Armor
  { nombre: 'UKR TNK-1',  descripcion: 'Ukrainian MBT',             categoria: 'armoured',     country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-TNK-1', activo: true, tipo_elemento: 'MBT',      prioridad: 7, observaciones: 'Hull-down, covering avenue', altitud: null, lng: 37.600, lat: 47.100 },

  // Artillery
  { nombre: 'UKR ART-1',  descripcion: 'Ukrainian 155mm battery',   categoria: 'artillery', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-ART-1', activo: true, tipo_elemento: '155mm',   prioridad: 8, observaciones: 'Counterbattery missions', altitud: null, lng: 37.530, lat: 47.110 },

  // Air
  { nombre: 'UKR UAV-1',  descripcion: 'Ukrainian ISR drone',       categoria: 'uav',       country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-UAV-1', activo: true, tipo_elemento: 'ISR',     prioridad: 6, observaciones: 'Orbiting above city',     altitud: 800,  lng: 37.580, lat: 47.098 },

  // ---------------------------------------------------------------
  // Russian forces
  // ---------------------------------------------------------------
  // Infantry
  { nombre: 'RUS INF-1',  descripcion: 'Russian infantry squad',    categoria: 'infantry',  country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RUS-INF-1', activo: true, tipo_elemento: 'standard', prioridad: 6, observaciones: 'Advancing from west',      altitud: null, lng: 37.520, lat: 47.098 },
  { nombre: 'RUS INF-2',  descripcion: 'Russian infantry squad',    categoria: 'infantry',  country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RUS-INF-2', activo: true, tipo_elemento: 'standard', prioridad: 6, observaciones: 'Clearing residential area', altitud: null, lng: 37.590, lat: 47.110 },
  { nombre: 'RUS INF-3',  descripcion: 'Russian infantry squad',    categoria: 'infantry',  country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RUS-INF-3', activo: true, tipo_elemento: 'standard', prioridad: 6, observaciones: 'Securing crossroads',      altitud: null, lng: 37.600, lat: 47.105 },

  // Armor
  { nombre: 'RUS TNK-1',  descripcion: 'Russian MBT',               categoria: 'armoured',      country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RUS-TNK-1', activo: true, tipo_elemento: 'MBT',      prioridad: 8, observaciones: 'Covering main axis',      altitud: null, lng: 37.555, lat: 47.102 },
  { nombre: 'RUS TNK-2',  descripcion: 'Russian MBT',               categoria: 'armoured',      country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RUS-TNK-2', activo: true, tipo_elemento: 'MBT',      prioridad: 8, observaciones: 'Turret-down position',    altitud: null, lng: 37.540, lat: 47.100 },

  // Artillery
  { nombre: 'RUS ART-1',  descripcion: 'Russian 152mm battery',     categoria: 'artillery', country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RUS-ART-1', activo: true, tipo_elemento: '152mm',   prioridad: 9, observaciones: 'Shelling port area',      altitud: null, lng: 37.480, lat: 47.120 },

  // Air
  { nombre: 'RUS HEL-1',  descripcion: 'Russian attack helicopter', categoria: 'helicopter', country: 'Russia', alliance: 'hostile',  elemento_identificado: 'RUS-HEL-1', activo: true, tipo_elemento: 'Attack',   prioridad: 7, observaciones: 'CAS mission ongoing',     altitud: 400,  lng: 37.550, lat: 47.115 },
  { nombre: 'RUS UAV-1',  descripcion: 'Russian ISR drone',         categoria: 'uav',       country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RUS-UAV-1', activo: true, tipo_elemento: 'ISR',     prioridad: 5, observaciones: 'Artillery spotting',      altitud: 600,  lng: 37.510, lat: 47.105 },

  // ---------------------------------------------------------------
  // Sea forces
  // ---------------------------------------------------------------
  { nombre: 'RUS SHIP-1', descripcion: 'Russian patrol boat',       categoria: 'ship',      country: 'Russia',  alliance: 'hostile',  elemento_identificado: 'RUS-SHIP-1', activo: true, tipo_elemento: 'Patrol',  prioridad: 6, observaciones: 'Blockading port',         altitud: null, lng: 37.550, lat: 47.050 },
  { nombre: 'UKR SHIP-1', descripcion: 'Ukrainian patrol boat',     categoria: 'ship',      country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-SHIP-1', activo: true, tipo_elemento: 'Patrol',  prioridad: 6, observaciones: 'Coastal defense',         altitud: null, lng: 37.580, lat: 47.070 },

  // ---------------------------------------------------------------
  // Medical facilities (Ukrainian)
  // ---------------------------------------------------------------
  // Role 1 — forward aid post near Azovstal
  { nombre: 'UKR Aid Post-1', descripcion: 'Role-1 aid post (Azovstal sector)', categoria: 'medical_facility', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-MED-R1-1', activo: true, tipo_elemento: 'medical_role_1', prioridad: 10, observaciones: 'Under periodic indirect fire', altitud: null, lng: 37.622, lat: 47.089 },

  // Role 2 — field hospital in western suburbs
  { nombre: 'UKR Field Hosp-2', descripcion: 'Role-2 surgical facility', categoria: 'medical_facility', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-MED-R2-1', activo: true, tipo_elemento: 'medical_role_2', prioridad: 10, observaciones: 'Limited surgical capability', altitud: null, lng: 37.510, lat: 47.085 },

  // Role 3 — full hospital (notional — outside city, rear area)
  { nombre: 'UKR Hospital-3', descripcion: 'Role-3 hospital (Zaporizhzhia)', categoria: 'medical_facility', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-MED-R3-1', activo: true, tipo_elemento: 'medical_role_3', prioridad: 10, observaciones: 'Full surgical + ICU', altitud: null, lng: 37.450, lat: 47.150 },

  // ---------------------------------------------------------------
  // MEDEVAC assets
  // ---------------------------------------------------------------
  { nombre: 'UKR MEDEVAC-1', descripcion: 'Ukrainian MEDEVAC helicopter', categoria: 'medevac_unit', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-MEDEVAC-1', activo: true, tipo_elemento: 'medevac_role_2', prioridad: 10, observaciones: 'Standby at Role-2', altitud: 0, lng: 37.512, lat: 47.086 },
  { nombre: 'UKR MEDEVAC-2', descripcion: 'Ukrainian MEDEVAC helicopter', categoria: 'medevac_unit', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-MEDEVAC-2', activo: true, tipo_elemento: 'medevac_role_1', prioridad: 10, observaciones: 'On ground at Azovstal',  altitud: 0, lng: 37.625, lat: 47.090 },

  // ---------------------------------------------------------------
  // Casualties
  // ---------------------------------------------------------------
  // Ukrainian WIA
  { nombre: 'UKR-CAS-1 (WIA)', descripcion: 'Ukrainian WIA — shrapnel wounds', categoria: 'casualty', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-CAS-1', activo: true, tipo_elemento: 'casualty', prioridad: 9, observaciones: 'Multiple shrapnel wounds, bleeding controlled', altitud: null, lng: 37.611, lat: 47.104 },
  { nombre: 'UKR-CAS-2 (WIA)', descripcion: 'Ukrainian WIA — GSW abdomen',    categoria: 'casualty', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-CAS-2', activo: true, tipo_elemento: 'casualty', prioridad: 10, observaciones: 'Abdominal GSW, urgent surgery needed', altitud: null, lng: 37.568, lat: 47.091 },
  { nombre: 'UKR-CAS-3 (WIA)', descripcion: 'Ukrainian WIA — blast injury',   categoria: 'casualty', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-CAS-3', activo: true, tipo_elemento: 'casualty', prioridad: 8, observaciones: 'TBI suspected, conscious', altitud: null, lng: 37.621, lat: 47.089 },

  // Ukrainian KIA
  { nombre: 'UKR-CAS-4 (KIA)', descripcion: 'Ukrainian KIA',                  categoria: 'casualty', country: 'Ukraine', alliance: 'friendly', elemento_identificado: 'UKR-CAS-4', activo: true, tipo_elemento: 'casualty', prioridad: 3, observaciones: 'KIA — direct hit from tank round', altitud: null, lng: 37.601, lat: 47.101 },

  // Russian WIA
  { nombre: 'RUS-CAS-1 (WIA)', descripcion: 'Russian WIA — gunshot wound',    categoria: 'casualty', country: 'Russia', alliance: 'hostile', elemento_identificado: 'RUS-CAS-1', activo: true, tipo_elemento: 'casualty', prioridad: 7, observaciones: 'GSW to leg, tourniquet applied', altitud: null, lng: 37.521, lat: 47.099 },
  { nombre: 'RUS-CAS-2 (WIA)', descripcion: 'Russian WIA — burns',            categoria: 'casualty', country: 'Russia', alliance: 'hostile', elemento_identificado: 'RUS-CAS-2', activo: true, tipo_elemento: 'casualty', prioridad: 8, observaciones: 'Severe burns from vehicle fire', altitud: null, lng: 37.556, lat: 47.103 },

  // Russian KIA
  { nombre: 'RUS-CAS-3 (KIA)', descripcion: 'Russian KIA',                    categoria: 'casualty', country: 'Russia', alliance: 'hostile', elemento_identificado: 'RUS-CAS-3', activo: true, tipo_elemento: 'casualty', prioridad: 2, observaciones: 'KIA — artillery strike', altitud: null, lng: 37.591, lat: 47.111 },
];

// ---------------------------------------------------------------------------
// Medical details
// ---------------------------------------------------------------------------
const medicalDetails = [
  // Ukrainian WIA
  {
    entity_ref: 'UKR-CAS-1',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (shrapnel)',
    primary_injury: 'Multiple shrapnel wounds — right thigh, left forearm, superficial chest',
    vital_signs: [
      { hr: 95, bp: '110/70', spo2: 96, recorded_at: '2026-02-03T14:20:00Z' }
    ],
    prehospital_treatment: 'Wounds packed, IV access, 500ml crystalloid',
    evac_priority: 'PRIORITY',
    evac_stage: 'at_poi',
    destination_facility_ref: 'UKR-MED-R1-1',
    nine_line_data: {
      line1_location: '47.104,37.611',
      line3_casualties: '1 PRIORITY',
      line5_patient_info: 'Male, 26y, UKR INF-1',
      line9_remarks: 'Awaiting ground evacuation to Aid Post-1'
    }
  },
  {
    entity_ref: 'UKR-CAS-2',
    triage_color: 'RED',
    casualty_status: 'WIA',
    injury_mechanism: 'GSW (rifle)',
    primary_injury: 'Penetrating abdominal GSW, no exit wound',
    vital_signs: [
      { hr: 120, bp: '85/55', spo2: 92, recorded_at: '2026-02-03T14:15:00Z' },
      { hr: 115, bp: '90/58', spo2: 93, recorded_at: '2026-02-03T14:22:00Z' }
    ],
    prehospital_treatment: 'IO access, TXA 1g IV, wound packed',
    evac_priority: 'URGENT',
    evac_stage: 'in_transit',
    destination_facility_ref: 'UKR-MED-R2-1',
    nine_line_data: {
      line1_location: '47.091,37.568',
      line3_casualties: '1 URGENT',
      line5_patient_info: 'Male, 31y, UKR INF-2',
      line9_remarks: 'Being moved by ground to Role-2. Requires immediate surgery.'
    }
  },
  {
    entity_ref: 'UKR-CAS-3',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (overpressure)',
    primary_injury: 'Suspected TBI, facial abrasions, tinnitus',
    vital_signs: [
      { hr: 88, bp: '125/80', spo2: 97, recorded_at: '2026-02-03T14:30:00Z' }
    ],
    prehospital_treatment: 'Cervical collar, supine position',
    evac_priority: 'PRIORITY',
    evac_stage: 'delivered',
    destination_facility_ref: 'UKR-MED-R1-1',
    nine_line_data: null
  },
  {
    entity_ref: 'UKR-CAS-4',
    triage_color: 'BLACK',
    casualty_status: 'KIA',
    injury_mechanism: 'Direct hit (tank APFSDS)',
    primary_injury: 'Catastrophic trauma, KIA on scene',
    vital_signs: null,
    prehospital_treatment: 'None — KIA',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },

  // Russian WIA
  {
    entity_ref: 'RUS-CAS-1',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'GSW (rifle)',
    primary_injury: 'GSW right femur, femoral artery spared',
    vital_signs: [
      { hr: 100, bp: '105/65', spo2: 94, recorded_at: '2026-02-03T14:18:00Z' }
    ],
    prehospital_treatment: 'Tourniquet applied, IV access',
    evac_priority: 'PRIORITY',
    evac_stage: 'at_poi',
    destination_facility_ref: null,  // no friendly facility for hostile casualties
    nine_line_data: null
  },
  {
    entity_ref: 'RUS-CAS-2',
    triage_color: 'RED',
    casualty_status: 'WIA',
    injury_mechanism: 'Thermal (vehicle fire)',
    primary_injury: 'Second/third-degree burns — face, torso, arms (>40% TBSA)',
    vital_signs: [
      { hr: 135, bp: '80/50', spo2: 89, recorded_at: '2026-02-03T14:25:00Z' }
    ],
    prehospital_treatment: 'Airway secured, IV fluids started',
    evac_priority: 'URGENT',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },
  {
    entity_ref: 'RUS-CAS-3',
    triage_color: 'BLACK',
    casualty_status: 'KIA',
    injury_mechanism: 'Artillery (155mm HE)',
    primary_injury: 'KIA — blast overpressure + fragmentation',
    vital_signs: null,
    prehospital_treatment: 'None — KIA',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  }
];

module.exports = { meta, entities, medicalDetails };
