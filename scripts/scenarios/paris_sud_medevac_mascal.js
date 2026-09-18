// scripts/scenarios/paris_sud_medevac_mascal.js
//
// Scenario: Paris Sud MEDEVAC — MASCAL
// -----------------------------------
// Mass-casualty (MASCAL) expansion of `paris_sud_medevac`. Same multinational
// brigade exercise south of Paris (France/Spain/Germany/Italy), same order of
// battle and same medical laydown, but four simultaneous incidents generate 30
// casualties against 12 evacuation assets — far more demand than supply, which
// is the point: the evacuation plan has to choose who is moved, by what, and in
// what order.
//
// Incidents:
//   1. French convoy multi-vehicle collision      (9 casualties, ~2.353 E / 48.598 N)
//   2. German ordnance premature detonation       (8 casualties, ~2.370 E / 48.607 N)
//   3. Spanish observation post collapse          (7 casualties, ~2.333 E / 48.585 N)
//   4. Italian ordnance premature detonation      (6 casualties, ~2.349 E / 48.614 N)
//
// Triage mix (STANAG colours): 5 RED (T1), 8 YELLOW (T2), 12 GREEN (T3),
// 2 BLUE (T4 expectant), 3 BLACK (dead). 27 casualties are evacuable.
//
// Evacuation assets: 5 ground MEDEVAC, 3 air MEDEVAC, 2 CASEVAC-eligible
// transports and 2 CASEVAC-eligible UGVs — 12 in total, 20 evacuation slots
// once litter capacity is taken into account. Seven evacuable casualties cannot
// be moved in this planning cycle by construction.
//
// `capacity`
// ----------
// Number of casualties the asset can evacuate in one planning cycle: 1 for a
// single-litter platform, 2 for a platform that can run two consecutive pickups.
// It is a column on `puntos_interes`, so it survives into PostGIS and reaches the
// planner over the REST API. The quantum-inspired planner in
// `optimizacion-annealing/latacc-medevac-integration` reads it to split the fleet
// into U1 (one casualty) and U2 (two casualties, two stages).
//
// Triage colours follow multinational STANAG coding:
//   T1=RED (Immediate), T2=YELLOW (Urgent), T3=GREEN (Minimal),
//   T4=BLUE (Expectant), Dead=BLACK
//
// nine_line_data follows NATO 9-Line MEDEVAC Request structure (see schema.js)
//
// Road access
// -----------
// Every asset and casualty sits somewhere a ground vehicle can actually reach, checked
// against Valhalla on the Paris extract. Two entities were moved for this reason:
// ITA-MEDEVAC-1 (200 m north, it was parked on an isolated service road with no route in
// or out) and FRA-CAS-8 (30 m north, it had landed inside a compound with no drivable
// access). The point is that this instance measures the optimiser, not the road network;
// a casualty deliberately out of vehicle reach belongs in a scenario of its own.
//
// Coordinates: South of Paris, France (48.5-48.62°N, 2.2-2.38°E)
// Run with
//   docker compose up -d
//   node scripts/init-db.js
//   node scripts/load-scenario.js paris_sud_medevac_mascal
//   npm run dev
// ---------------------------------------------------------------------------

const meta = {
  name: 'paris_sud_medevac_mascal',
  description: 'Mass-casualty expansion of the Paris Sud multinational brigade exercise. Four simultaneous incidents produce 30 casualties (5 RED, 8 YELLOW, 12 GREEN, 2 BLUE, 3 BLACK) against 12 evacuation assets, so the MEDEVAC plan must prioritise. Used as the reference instance for quantum-inspired evacuation optimisation.',
  tags: ['medevac', 'mascal', 'paris', 'multinational', 'exercise', 'medical', 'optimisation']
};

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------
const entities = [
  // ---------------------------------------------------------------
  // Brigade & Battalion HQ
  // ---------------------------------------------------------------
  { nombre: 'SpBde', descripcion: 'Spanish Brigade HQ', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPBDE', activo: true, tipo_elemento: 'mechanised', observaciones: 'Brigade command element', altitud: null, lng: 2.24439, lat: 48.57078 },
  { nombre: 'SpBatt', descripcion: 'Spanish Battalion HQ', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPBATT', activo: true, tipo_elemento: 'mechanised', observaciones: 'Battalion tactical CP', altitud: null, lng: 2.27546, lat: 48.57436 },

  // ---------------------------------------------------------------
  // Company-level units
  // ---------------------------------------------------------------
  { nombre: 'FrCoy', descripcion: 'French mechanised company (wheeled)', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FRCOY', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'VBCI equipped', altitud: null, lng: 2.32724, lat: 48.5993 },
  { nombre: 'GeCoy', descripcion: 'German armoured company', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GECOY', activo: true, tipo_elemento: 'MBT', observaciones: 'Leopard 2A7', altitud: null, lng: 2.3461, lat: 48.6025 },
  { nombre: 'SpCoy', descripcion: 'Spanish mechanised company', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPCOY', activo: true, tipo_elemento: 'mechanised', observaciones: 'Pizarro IFV equipped', altitud: null, lng: 2.33113, lat: 48.5839 },

  // ---------------------------------------------------------------
  // Platoon-level units
  // ---------------------------------------------------------------
  { nombre: 'SpPl', descripcion: 'Spanish platoon (wheeled)', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPPL', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'VEC reconnaissance', altitud: null, lng: 2.33113, lat: 48.5839 },
  { nombre: 'SpPlSq1', descripcion: 'Spanish squad 1', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPPLSQ1', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Forward element', altitud: null, lng: 2.34094, lat: 48.58778 },
  { nombre: 'SpPlSq2', descripcion: 'Spanish squad 2', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPPLSQ2', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Overwatch position', altitud: null, lng: 2.33734, lat: 48.58498 },
  { nombre: 'SpPlSq3', descripcion: 'Spanish squad 3', categoria: 'infantry', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPPLSQ3', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Reserve', altitud: null, lng: 2.33106, lat: 48.58372 },

  { nombre: 'FrPl', descripcion: 'French platoon (wheeled)', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FRPL', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'VAB equipped', altitud: null, lng: 2.32724, lat: 48.5993 },
  { nombre: 'FrPlSq1', descripcion: 'French squad 1', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FRPLSQ1', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Northern sector', altitud: null, lng: 2.35133, lat: 48.59762 },
  { nombre: 'FrPlSq2', descripcion: 'French squad 2', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FRPLSQ2', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Securing flank', altitud: null, lng: 2.35161, lat: 48.60343 },
  { nombre: 'FrPlSq3', descripcion: 'French squad 3', categoria: 'infantry', country: 'France', alliance: 'friendly', elemento_identificado: 'FRPLSQ3', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Support by fire', altitud: null, lng: 2.34987, lat: 48.60101 },

  { nombre: 'ItPl', descripcion: 'Italian platoon (wheeled)', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITPL', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Centauro equipped', altitud: null, lng: 2.3461, lat: 48.6025 },
  { nombre: 'ItPlSq1', descripcion: 'Italian squad 1', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITPLSQ1', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Screening', altitud: null, lng: 2.32936, lat: 48.59644 },
  { nombre: 'ItPlSq2', descripcion: 'Italian squad 2', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITPLSQ2', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Eastern approach', altitud: null, lng: 2.34901, lat: 48.61559 },
  { nombre: 'ItPlSq3', descripcion: 'Italian squad 3', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITPLSQ3', activo: true, tipo_elemento: 'mechanised_wheeled', observaciones: 'Reserve force', altitud: null, lng: 2.35183, lat: 48.61745 },

  // ---------------------------------------------------------------
  // German armoured platoon (tank platoon supporting GeCoy)
  // ---------------------------------------------------------------
  { nombre: 'GeTankPl', descripcion: 'German tank platoon', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GETANKPL', activo: true, tipo_elemento: 'MBT', observaciones: 'Leopard 2A7 platoon', altitud: null, lng: 2.36, lat: 48.605 },
  { nombre: 'GeTankSq1', descripcion: 'German tank squad 1', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GETANKSQ1', activo: true, tipo_elemento: 'MBT', observaciones: 'Lead tank', altitud: null, lng: 2.365, lat: 48.606 },
  { nombre: 'GeTankSq2', descripcion: 'German tank squad 2', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GETANKSQ2', activo: true, tipo_elemento: 'MBT', observaciones: 'Wingman', altitud: null, lng: 2.37, lat: 48.607 },
  { nombre: 'GeTankSq3', descripcion: 'German tank squad 3', categoria: 'armoured', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GETANKSQ3', activo: true, tipo_elemento: 'MBT', observaciones: 'Trail tank', altitud: null, lng: 2.375, lat: 48.608 },

  // ---------------------------------------------------------------
  // Engineer unit
  // ---------------------------------------------------------------
  { nombre: 'SpEngUnit', descripcion: 'Spanish engineer unit', categoria: 'engineer', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPENGUNIT', activo: true, tipo_elemento: 'standard', observaciones: 'Mobility/counter-mobility', altitud: null, lng: 2.31772, lat: 48.59366 },
  { nombre: 'SpEngSq1', descripcion: 'Spanish engineer squad 1', categoria: 'engineer', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPENGSQ1', activo: true, tipo_elemento: 'standard', observaciones: 'Obstacle emplacement', altitud: null, lng: 2.32838, lat: 48.59604 },
  { nombre: 'SpEngSq2', descripcion: 'Spanish engineer squad 2', categoria: 'engineer', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPENGSQ2', activo: true, tipo_elemento: 'standard', observaciones: 'Breaching team', altitud: null, lng: 2.32068, lat: 48.59081 },
  { nombre: 'SpEngSq3', descripcion: 'Spanish engineer squad 3', categoria: 'engineer', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPENGSQ3', activo: true, tipo_elemento: 'standard', observaciones: 'Mine clearance', altitud: null, lng: 2.3257, lat: 48.59441 },

  // ---------------------------------------------------------------
  // Mortar section
  // ---------------------------------------------------------------
  { nombre: 'SpMoSq', descripcion: 'Spanish heavy mortar section', categoria: 'mortar', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPMOSQ', activo: true, tipo_elemento: 'heavy', observaciones: '120mm mortars', altitud: null, lng: 2.3369, lat: 48.60439 },

  // ---------------------------------------------------------------
  // ISR & Reconnaissance
  // ---------------------------------------------------------------
  { nombre: 'ItUavTm1', descripcion: 'Italian UAV team', categoria: 'infantry', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITUAVTM1', activo: true, tipo_elemento: 'uav', observaciones: 'UAV-Small1', altitud: null, lng: 2.33952, lat: 48.61024 },
  { nombre: 'SpSvTm1', descripcion: 'Spanish reconnaissance team', categoria: 'reconnaissance', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SPSVTM1', activo: true, tipo_elemento: 'wheeled', mobility: 'ground', observaciones: 'Forward scouts', altitud: null, lng: 2.3352, lat: 48.58266 },

  // ---------------------------------------------------------------
  // Medical facilities
  // ---------------------------------------------------------------
  { nombre: 'ESP MED Role-1', descripcion: 'Spanish Role-1 aid post', categoria: 'medical_facility', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-MED-R1', activo: true, tipo_elemento: 'medical_role_1', observaciones: 'Forward medical point', altitud: null, lng: 2.30, lat: 48.58 },
  { nombre: 'FRA MED Role-2', descripcion: 'French Role-2 surgical facility', categoria: 'medical_facility', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-MED-R2', activo: true, tipo_elemento: 'medical_role_2', observaciones: 'Forward surgical team', altitud: null, lng: 2.25, lat: 48.60 },
  { nombre: 'DEU MED Role-3', descripcion: 'German Role-3 field hospital', categoria: 'medical_facility', country: 'Germany', alliance: 'friendly', elemento_identificado: 'DEU-MED-R3', activo: true, tipo_elemento: 'medical_role_3', observaciones: 'Full surgical capability', altitud: null, lng: 2.20, lat: 48.62 },
  { nombre: 'Clinique Des Charmilles', descripcion: 'French Role-4 hospital', categoria: 'medical_facility', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-MED-R4', activo: true, tipo_elemento: 'medical_role_4', observaciones: 'Definitive care facility', altitud: null, lng: 2.249171, lat: 48.592789 },

  // ---------------------------------------------------------------
  // MEDEVAC assets — ground
  //
  // `capacity` = casualties evacuated per planning cycle (see header note).
  // ---------------------------------------------------------------
  { nombre: 'ESP MEDEVAC-1', descripcion: 'Spanish MEDEVAC ambulance', categoria: 'medevac_unit', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-MEDEVAC-1', activo: true, tipo_elemento: 'medevac_role_1', mobility: 'ground', capacity: 1, observaciones: 'Ground evacuation. Capacity: 1 litter', altitud: null, lng: 2.305, lat: 48.58 },
  { nombre: 'FRA MEDEVAC-2', descripcion: 'French MEDEVAC ambulance', categoria: 'medevac_unit', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-MEDEVAC-2', activo: true, tipo_elemento: 'medevac_role_2', mobility: 'ground', capacity: 2, observaciones: 'Ground evacuation. Capacity: 2 litters', altitud: null, lng: 2.255, lat: 48.60 },
  { nombre: 'ITA MEDEVAC-1', descripcion: 'Italian MEDEVAC ambulance', categoria: 'medevac_unit', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITA-MEDEVAC-1', activo: true, tipo_elemento: 'medevac_role_1', mobility: 'ground', capacity: 2, observaciones: 'Ground evacuation. Capacity: 2 litters', altitud: null, lng: 2.34, lat: 48.596799 },
  { nombre: 'ESP MEDEVAC-3', descripcion: 'Spanish mechanised MEDEVAC', categoria: 'medevac_unit', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-MEDEVAC-3', activo: true, tipo_elemento: 'medevac_role_2', mobility: 'ground', capacity: 2, observaciones: 'Pizarro ambulance variant. Capacity: 2 litters', altitud: null, lng: 2.318, lat: 48.588 },
  { nombre: 'DEU MEDEVAC-1', descripcion: 'German MEDEVAC ambulance', categoria: 'medevac_unit', country: 'Germany', alliance: 'friendly', elemento_identificado: 'DEU-MEDEVAC-1', activo: true, tipo_elemento: 'medevac_role_2', mobility: 'ground', capacity: 2, observaciones: 'Boxer ambulance variant. Capacity: 2 litters', altitud: null, lng: 2.205, lat: 48.618 },

  // ---------------------------------------------------------------
  // MEDEVAC assets — air
  // ---------------------------------------------------------------
  { nombre: 'FRA MEDEVAC-HEL-1', descripcion: 'French MEDEVAC helicopter Role-1', categoria: 'medevac_unit', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-MEDEVAC-HEL-1', activo: true, tipo_elemento: 'medevac_role_1', mobility: 'air', capacity: 2, observaciones: 'NH90 TTH. Capacity: 2 litters', altitud: null, lng: 2.2494, lat: 48.5941 },
  { nombre: 'FRA MEDEVAC-HEL-2', descripcion: 'French MEDEVAC helicopter Role-2', categoria: 'medevac_unit', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-MEDEVAC-HEL-2', activo: true, tipo_elemento: 'medevac_role_2', mobility: 'air', capacity: 2, observaciones: 'CH-47 Chinook. Capacity: 2 litters', altitud: null, lng: 2.2503, lat: 48.5947 },
  { nombre: 'DEU MEDEVAC-HEL-3', descripcion: 'German MEDEVAC helicopter Role-2', categoria: 'medevac_unit', country: 'Germany', alliance: 'friendly', elemento_identificado: 'DEU-MEDEVAC-HEL-3', activo: true, tipo_elemento: 'medevac_role_2', mobility: 'air', capacity: 2, observaciones: 'H145M LUH SAR. Capacity: 2 litters', altitud: null, lng: 2.2015, lat: 48.6215 },

  // ---------------------------------------------------------------
  // CASEVAC-eligible transport (not dedicated MEDEVAC — T3/T4 only
  // per AMedP-1.10 §2.6.2)
  // ---------------------------------------------------------------
  { nombre: 'ITA Transport 1', descripcion: 'Italian transport vehicle', categoria: 'transportation', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITA-TRNSP-1', activo: true, tipo_elemento: null, mobility: 'ground', casevac_eligible: true, capacity: 1, observaciones: 'Toyota pickup civil. Capacity: 1 litter', altitud: null, lng: 2.336691, lat: 48.597926 },
  { nombre: 'ESP Transport 1', descripcion: 'Spanish transport vehicle', categoria: 'transportation', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-TRNSP-1', activo: true, tipo_elemento: null, mobility: 'ground', casevac_eligible: true, capacity: 2, observaciones: 'VBMR Griffon. Capacity: 2 litters', altitud: null, lng: 2.310899, lat: 48.593726 },

  // ---------------------------------------------------------------
  // CASEVAC-eligible UGVs
  // ---------------------------------------------------------------
  { nombre: 'UGV Alano 1', descripcion: 'Spanish UGV Alano', categoria: 'ugv', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-UGV-1', activo: true, mobility: 'ground', casevac_eligible: true, capacity: 1, observaciones: 'Alano model. Autonomous operation capable. Payload 700 kg. 20 km/h. Capacity: 1 litter', altitud: null, lng: 2.325228, lat: 48.597472 },
  { nombre: 'UGV THeMIS', descripcion: 'German UGV THeMIS', categoria: 'ugv', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GER-UGV-1', activo: true, mobility: 'ground', casevac_eligible: true, capacity: 1, observaciones: 'THeMIS model. Autonomous operation capable. Payload 800 kg. 25 km/h. Capacity: 1 litter', altitud: null, lng: 2.372252, lat: 48.608309 },

  // ---------------------------------------------------------------
  // Casualties — MASCAL, four simultaneous incidents
  // ---------------------------------------------------------------
  { nombre: 'FRA-CAS-1 (WIA)', descripcion: 'French WIA - Massive internal haemorrhage', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-CAS-1', activo: true, tipo_elemento: 'casualty', observaciones: 'Multi-vehicle collision (convoy)', altitud: null, lng: 2.358908, lat: 48.598641 },
  { nombre: 'FRA-CAS-2 (WIA)', descripcion: 'French WIA - Superficial fragmentation wounds', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-CAS-2', activo: true, tipo_elemento: 'casualty', observaciones: 'Multi-vehicle collision (convoy)', altitud: null, lng: 2.346889, lat: 48.600625 },
  { nombre: 'FRA-CAS-3 (WIA)', descripcion: 'French WIA - Open tibia-fibula fracture', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-CAS-3', activo: true, tipo_elemento: 'casualty', observaciones: 'Multi-vehicle collision (convoy)', altitud: null, lng: 2.35739, lat: 48.59867 },
  { nombre: 'FRA-CAS-4 (WIA)', descripcion: 'French WIA - Full-thickness burns 85% TBSA with inhalation injury', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-CAS-4', activo: true, tipo_elemento: 'casualty', observaciones: 'Multi-vehicle collision (convoy)', altitud: null, lng: 2.357853, lat: 48.594399 },
  { nombre: 'FRA-CAS-5 (KIA)', descripcion: 'French KIA - Fatal head trauma', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-CAS-5', activo: true, tipo_elemento: 'casualty', observaciones: 'Multi-vehicle collision (convoy)', altitud: null, lng: 2.345534, lat: 48.599202 },
  { nombre: 'FRA-CAS-6 (WIA)', descripcion: 'French WIA - Grade II ankle sprain', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-CAS-6', activo: true, tipo_elemento: 'casualty', observaciones: 'Multi-vehicle collision (convoy)', altitud: null, lng: 2.354143, lat: 48.600963 },
  { nombre: 'FRA-CAS-7 (WIA)', descripcion: 'French WIA - Penetrating thoracic trauma', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-CAS-7', activo: true, tipo_elemento: 'casualty', observaciones: 'Multi-vehicle collision (convoy)', altitud: null, lng: 2.345736, lat: 48.599593 },
  { nombre: 'FRA-CAS-8 (WIA)', descripcion: 'French WIA - Fragmentation wound left thigh', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-CAS-8', activo: true, tipo_elemento: 'casualty', observaciones: 'Multi-vehicle collision (convoy)', altitud: null, lng: 2.353016, lat: 48.602025 },
  { nombre: 'FRA-CAS-9 (WIA)', descripcion: 'French WIA - Partial-thickness burns 18% TBSA', categoria: 'casualty', country: 'France', alliance: 'friendly', elemento_identificado: 'FRA-CAS-9', activo: true, tipo_elemento: 'casualty', observaciones: 'Multi-vehicle collision (convoy)', altitud: null, lng: 2.353999, lat: 48.594957 },
  { nombre: 'GER-CAS-1 (WIA)', descripcion: 'German WIA - Traumatic above-knee amputation', categoria: 'casualty', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GER-CAS-1', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.370964, lat: 48.610119 },
  { nombre: 'GER-CAS-2 (WIA)', descripcion: 'German WIA - Facial laceration 5cm', categoria: 'casualty', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GER-CAS-2', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.373597, lat: 48.605475 },
  { nombre: 'GER-CAS-3 (WIA)', descripcion: 'German WIA - Heat exhaustion with dehydration', categoria: 'casualty', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GER-CAS-3', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.371308, lat: 48.609073 },
  { nombre: 'GER-CAS-4 (WIA)', descripcion: 'German WIA - Closed femur fracture with thigh haematoma', categoria: 'casualty', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GER-CAS-4', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.369393, lat: 48.607685 },
  { nombre: 'GER-CAS-5 (WIA)', descripcion: 'German WIA - Blast-induced tinnitus', categoria: 'casualty', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GER-CAS-5', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.373294, lat: 48.606427 },
  { nombre: 'GER-CAS-6 (WIA)', descripcion: 'German WIA - Blunt abdominal trauma', categoria: 'casualty', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GER-CAS-6', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.369575, lat: 48.605777 },
  { nombre: 'GER-CAS-7 (WIA)', descripcion: 'German WIA - Penetrating ocular injury', categoria: 'casualty', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GER-CAS-7', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.365172, lat: 48.605458 },
  { nombre: 'GER-CAS-8 (KIA)', descripcion: 'German KIA - Fatal crush injury', categoria: 'casualty', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GER-CAS-8', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.365899, lat: 48.60817 },
  { nombre: 'ESP-CAS-1 (WIA)', descripcion: 'Spanish WIA - Contusion to left shoulder', categoria: 'casualty', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-CAS-1', activo: true, tipo_elemento: 'casualty', observaciones: 'Structure collapse (observation post)', altitud: null, lng: 2.327331, lat: 48.584726 },
  { nombre: 'ESP-CAS-2 (WIA)', descripcion: 'Spanish WIA - Crush injury right lower limb', categoria: 'casualty', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-CAS-2', activo: true, tipo_elemento: 'casualty', observaciones: 'Structure collapse (observation post)', altitud: null, lng: 2.337716, lat: 48.587385 },
  { nombre: 'ESP-CAS-3 (KIA)', descripcion: 'Spanish KIA - Fatal blast injury', categoria: 'casualty', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-CAS-3', activo: true, tipo_elemento: 'casualty', observaciones: 'Structure collapse (observation post)', altitud: null, lng: 2.328386, lat: 48.583352 },
  { nombre: 'ESP-CAS-4 (WIA)', descripcion: 'Spanish WIA - Minor burns to right hand', categoria: 'casualty', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-CAS-4', activo: true, tipo_elemento: 'casualty', observaciones: 'Structure collapse (observation post)', altitud: null, lng: 2.338332, lat: 48.582541 },
  { nombre: 'ESP-CAS-5 (WIA)', descripcion: 'Spanish WIA - Blast lung', categoria: 'casualty', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-CAS-5', activo: true, tipo_elemento: 'casualty', observaciones: 'Structure collapse (observation post)', altitud: null, lng: 2.33666, lat: 48.587306 },
  { nombre: 'ESP-CAS-6 (WIA)', descripcion: 'Spanish WIA - Severe TBI', categoria: 'casualty', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-CAS-6', activo: true, tipo_elemento: 'casualty', observaciones: 'Structure collapse (observation post)', altitud: null, lng: 2.331417, lat: 48.58528 },
  { nombre: 'ESP-CAS-7 (WIA)', descripcion: 'Spanish WIA - Open forearm fracture with arterial bleeding controlled', categoria: 'casualty', country: 'Spain', alliance: 'friendly', elemento_identificado: 'ESP-CAS-7', activo: true, tipo_elemento: 'casualty', observaciones: 'Structure collapse (observation post)', altitud: null, lng: 2.337296, lat: 48.585281 },
  { nombre: 'ITA-CAS-1 (WIA)', descripcion: 'Italian WIA - Whiplash', categoria: 'casualty', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITA-CAS-1', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.342993, lat: 48.610044 },
  { nombre: 'ITA-CAS-2 (WIA)', descripcion: 'Italian WIA - Abrasions and mild smoke inhalation', categoria: 'casualty', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITA-CAS-2', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.351614, lat: 48.610311 },
  { nombre: 'ITA-CAS-3 (WIA)', descripcion: 'Italian WIA - Sprained wrist', categoria: 'casualty', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITA-CAS-3', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.342451, lat: 48.610124 },
  { nombre: 'ITA-CAS-4 (WIA)', descripcion: 'Italian WIA - Laceration to left calf', categoria: 'casualty', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITA-CAS-4', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.341808, lat: 48.614204 },
  { nombre: 'ITA-CAS-5 (WIA)', descripcion: 'Italian WIA - Bilateral flail chest with hypoxia', categoria: 'casualty', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITA-CAS-5', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.341602, lat: 48.613044 },
  { nombre: 'ITA-CAS-6 (WIA)', descripcion: 'Italian WIA - Acute stress reaction', categoria: 'casualty', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ITA-CAS-6', activo: true, tipo_elemento: 'casualty', observaciones: 'Blast (training ordnance premature detonation)', altitud: null, lng: 2.345145, lat: 48.614848 },
];

// ---------------------------------------------------------------------------
// Medical details
//
// nine_line_data follows NATO 9-Line MEDEVAC Request structure.
// See GET /api/schema → nine_line_medevac for field definitions.
// BLUE (T4 expectant) and BLACK casualties carry no 9-Line: no MEDEVAC is
// requested for them under MASCAL conditions.
// ---------------------------------------------------------------------------
const medicalDetails = [
  {
    entity_ref: 'FRA-CAS-1',
    triage_color: 'BLUE',
    casualty_status: 'WIA',
    injury_mechanism: 'Multi-vehicle collision (convoy)',
    primary_injury: 'Massive internal haemorrhage, non-survivable under MASCAL conditions',
    vital_signs: [
      { hr: 138, bp: '58/35', spo2: 75, recorded_at: '2026-02-06T16:21:00Z' }
    ],
    prehospital_treatment: 'IV morphine 10mg, comfort measures only',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },
  {
    entity_ref: 'FRA-CAS-2',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Multi-vehicle collision (convoy)',
    primary_injury: 'Superficial fragmentation wounds, both forearms',
    vital_signs: [
      { hr: 88, bp: '125/78', spo2: 99, recorded_at: '2026-02-06T16:22:00Z' }
    ],
    prehospital_treatment: 'Wounds cleaned and dressed, tetanus prophylaxis',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.600625,2.346889',
      line2_callsign: 'FRPLSQ1 MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'French Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage GREEN. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'FRA-CAS-3',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Multi-vehicle collision (convoy)',
    primary_injury: 'Open tibia-fibula fracture, distal pulse present',
    vital_signs: [
      { hr: 105, bp: '110/70', spo2: 96, recorded_at: '2026-02-06T16:23:00Z' }
    ],
    prehospital_treatment: 'Splinted, wound irrigated and dressed, IV morphine',
    evac_priority: 'PRIORITY',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.59867,2.35739',
      line2_callsign: 'FRPLSQ1 MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'B',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'yellow smoke',
      line8_nationality: 'French Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage YELLOW. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'FRA-CAS-4',
    triage_color: 'BLUE',
    casualty_status: 'WIA',
    injury_mechanism: 'Multi-vehicle collision (convoy)',
    primary_injury: 'Full-thickness burns 85% TBSA with inhalation injury',
    vital_signs: [
      { hr: 140, bp: '70/40', spo2: 80, recorded_at: '2026-02-06T16:24:00Z' }
    ],
    prehospital_treatment: 'IV morphine 10mg, airway support, comfort measures only',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },
  {
    entity_ref: 'FRA-CAS-5',
    triage_color: 'BLACK',
    casualty_status: 'KIA',
    injury_mechanism: 'Multi-vehicle collision (convoy)',
    primary_injury: 'Fatal head trauma',
    vital_signs: null,
    prehospital_treatment: 'None - immediate death',
    evac_priority: 'UNKNOWN',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },
  {
    entity_ref: 'FRA-CAS-6',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Multi-vehicle collision (convoy)',
    primary_injury: 'Grade II ankle sprain',
    vital_signs: [
      { hr: 76, bp: '120/78', spo2: 99, recorded_at: '2026-02-06T16:26:00Z' }
    ],
    prehospital_treatment: 'RICE protocol, wrapped, crutches issued',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.600963,2.354143',
      line2_callsign: 'FRPLSQ1 MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'French Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage GREEN. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'FRA-CAS-7',
    triage_color: 'RED',
    casualty_status: 'WIA',
    injury_mechanism: 'Multi-vehicle collision (convoy)',
    primary_injury: 'Penetrating thoracic trauma, tension pneumothorax decompressed on scene',
    vital_signs: [
      { hr: 125, bp: '85/55', spo2: 88, recorded_at: '2026-02-06T16:27:00Z' }
    ],
    prehospital_treatment: 'Needle decompression, chest seal, high-flow O2, two large-bore IV lines',
    evac_priority: 'URGENT',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.599593,2.345736',
      line2_callsign: 'FRPLSQ1 MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'A',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'A',
      line7_marking_detail: 'red VS-17 panel',
      line8_nationality: 'French Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage RED. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'FRA-CAS-8',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Multi-vehicle collision (convoy)',
    primary_injury: 'Fragmentation wound left thigh, haemorrhage controlled with tourniquet',
    vital_signs: [
      { hr: 112, bp: '100/65', spo2: 95, recorded_at: '2026-02-06T16:28:00Z' }
    ],
    prehospital_treatment: 'Tourniquet proximal to wound, IV access, 1L NaCl bolus',
    evac_priority: 'PRIORITY',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.601755,2.353016',
      line2_callsign: 'FRPLSQ1 MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'B',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'yellow smoke',
      line8_nationality: 'French Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage YELLOW. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'FRA-CAS-9',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Multi-vehicle collision (convoy)',
    primary_injury: 'Partial-thickness burns 18% TBSA, trunk and arms',
    vital_signs: [
      { hr: 108, bp: '112/72', spo2: 97, recorded_at: '2026-02-06T16:29:00Z' }
    ],
    prehospital_treatment: 'Burn dressings, fluid resuscitation per Parkland, IV analgesia',
    evac_priority: 'PRIORITY',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.594957,2.353999',
      line2_callsign: 'FRPLSQ1 MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'B',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'yellow smoke',
      line8_nationality: 'French Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage YELLOW. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'GER-CAS-1',
    triage_color: 'RED',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Traumatic above-knee amputation, junctional haemorrhage',
    vital_signs: [
      { hr: 130, bp: '80/50', spo2: 92, recorded_at: '2026-02-06T16:30:00Z' }
    ],
    prehospital_treatment: 'CAT tourniquet high and tight, TXA 1g IV, 1L Hartmann',
    evac_priority: 'URGENT',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.610119,2.370964',
      line2_callsign: 'GETANKPL MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'A',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'A',
      line7_marking_detail: 'red VS-17 panel',
      line8_nationality: 'German Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage RED. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'GER-CAS-2',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Facial laceration 5cm, conscious and oriented',
    vital_signs: [
      { hr: 82, bp: '122/80', spo2: 99, recorded_at: '2026-02-06T16:31:00Z' }
    ],
    prehospital_treatment: 'Wound cleaned, pressure dressing applied',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.605475,2.373597',
      line2_callsign: 'GETANKPL MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'German Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage GREEN. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'GER-CAS-3',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Heat exhaustion with dehydration',
    vital_signs: [
      { hr: 104, bp: '108/68', spo2: 98, recorded_at: '2026-02-06T16:32:00Z' }
    ],
    prehospital_treatment: 'Oral rehydration, active cooling, shaded rest',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.609073,2.371308',
      line2_callsign: 'GETANKPL MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'German Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage GREEN. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'GER-CAS-4',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Closed femur fracture with thigh haematoma',
    vital_signs: [
      { hr: 102, bp: '115/74', spo2: 97, recorded_at: '2026-02-06T16:33:00Z' }
    ],
    prehospital_treatment: 'Traction splint applied, IV morphine, IV fluids',
    evac_priority: 'PRIORITY',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.607685,2.369393',
      line2_callsign: 'GETANKPL MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'B',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'yellow smoke',
      line8_nationality: 'German Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage YELLOW. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'GER-CAS-5',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Blast-induced tinnitus, tympanic membrane perforation',
    vital_signs: [
      { hr: 80, bp: '124/78', spo2: 99, recorded_at: '2026-02-06T16:34:00Z' }
    ],
    prehospital_treatment: 'Ear examined, dry dressing, removed from noise',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.606427,2.373294',
      line2_callsign: 'GETANKPL MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'German Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage GREEN. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'GER-CAS-6',
    triage_color: 'RED',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Blunt abdominal trauma, suspected splenic rupture',
    vital_signs: [
      { hr: 122, bp: '88/58', spo2: 94, recorded_at: '2026-02-06T16:35:00Z' }
    ],
    prehospital_treatment: 'Permissive hypotension, IV access x2, warming blanket',
    evac_priority: 'URGENT',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.605777,2.369575',
      line2_callsign: 'GETANKPL MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'A',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'A',
      line7_marking_detail: 'red VS-17 panel',
      line8_nationality: 'German Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage RED. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'GER-CAS-7',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Penetrating ocular injury, right eye',
    vital_signs: [
      { hr: 92, bp: '125/80', spo2: 98, recorded_at: '2026-02-06T16:36:00Z' }
    ],
    prehospital_treatment: 'Rigid eye shield, no pressure, IV antibiotics, analgesia',
    evac_priority: 'PRIORITY',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.605458,2.365172',
      line2_callsign: 'GETANKPL MEDIC',
      line2_frequency: 'FM 45.100',
      line3_precedence: 'B',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'yellow smoke',
      line8_nationality: 'German Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage YELLOW. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'GER-CAS-8',
    triage_color: 'BLACK',
    casualty_status: 'KIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Fatal crush injury',
    vital_signs: null,
    prehospital_treatment: 'None - immediate death',
    evac_priority: 'UNKNOWN',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },
  {
    entity_ref: 'ESP-CAS-1',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Structure collapse (observation post)',
    primary_injury: 'Contusion to left shoulder, full range of motion',
    vital_signs: [
      { hr: 78, bp: '126/80', spo2: 99, recorded_at: '2026-02-06T16:38:00Z' }
    ],
    prehospital_treatment: 'Ice pack, sling, oral analgesia',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.584726,2.327331',
      line2_callsign: 'SPPLSQ1 MEDIC',
      line2_frequency: 'FM 45.200',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'Spanish Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage GREEN. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'ESP-CAS-2',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Structure collapse (observation post)',
    primary_injury: 'Crush injury right lower limb, suspected compartment syndrome',
    vital_signs: [
      { hr: 105, bp: '110/70', spo2: 96, recorded_at: '2026-02-06T16:39:00Z' }
    ],
    prehospital_treatment: 'Splinted, limb elevated, IV morphine, IV fluids',
    evac_priority: 'PRIORITY',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.587385,2.337716',
      line2_callsign: 'SPPLSQ1 MEDIC',
      line2_frequency: 'FM 45.200',
      line3_precedence: 'B',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'yellow smoke',
      line8_nationality: 'Spanish Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage YELLOW. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'ESP-CAS-3',
    triage_color: 'BLACK',
    casualty_status: 'KIA',
    injury_mechanism: 'Structure collapse (observation post)',
    primary_injury: 'Fatal blast injury, traumatic cardiac arrest, unsurvivable',
    vital_signs: null,
    prehospital_treatment: 'None - resuscitation not attempted',
    evac_priority: 'UNKNOWN',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: null
  },
  {
    entity_ref: 'ESP-CAS-4',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Structure collapse (observation post)',
    primary_injury: 'Minor burns to right hand, 2% TBSA',
    vital_signs: [
      { hr: 84, bp: '122/76', spo2: 99, recorded_at: '2026-02-06T16:41:00Z' }
    ],
    prehospital_treatment: 'Cooled, non-adherent dressing, oral analgesia',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.582541,2.338332',
      line2_callsign: 'SPPLSQ1 MEDIC',
      line2_frequency: 'FM 45.200',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'Spanish Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage GREEN. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'ESP-CAS-5',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Structure collapse (observation post)',
    primary_injury: 'Blast lung, progressive dyspnoea',
    vital_signs: [
      { hr: 110, bp: '118/76', spo2: 90, recorded_at: '2026-02-06T16:42:00Z' }
    ],
    prehospital_treatment: 'High-flow O2, monitored, no positive pressure',
    evac_priority: 'PRIORITY',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.587306,2.33666',
      line2_callsign: 'SPPLSQ1 MEDIC',
      line2_frequency: 'FM 45.200',
      line3_precedence: 'B',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'yellow smoke',
      line8_nationality: 'Spanish Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage YELLOW. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'ESP-CAS-6',
    triage_color: 'RED',
    casualty_status: 'WIA',
    injury_mechanism: 'Structure collapse (observation post)',
    primary_injury: 'Severe TBI, GCS 7, unilateral pupil dilation',
    vital_signs: [
      { hr: 58, bp: '150/90', spo2: 95, recorded_at: '2026-02-06T16:43:00Z' }
    ],
    prehospital_treatment: 'Airway secured (i-gel), C-spine immobilised, head elevated 30deg',
    evac_priority: 'URGENT',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.58528,2.331417',
      line2_callsign: 'SPPLSQ1 MEDIC',
      line2_frequency: 'FM 45.200',
      line3_precedence: 'A',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'A',
      line7_marking_detail: 'red VS-17 panel',
      line8_nationality: 'Spanish Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage RED. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'ESP-CAS-7',
    triage_color: 'YELLOW',
    casualty_status: 'WIA',
    injury_mechanism: 'Structure collapse (observation post)',
    primary_injury: 'Open forearm fracture with arterial bleeding controlled',
    vital_signs: [
      { hr: 100, bp: '118/76', spo2: 97, recorded_at: '2026-02-06T16:44:00Z' }
    ],
    prehospital_treatment: 'Pressure dressing, splint, IV access, TXA 1g IV',
    evac_priority: 'PRIORITY',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.585281,2.337296',
      line2_callsign: 'SPPLSQ1 MEDIC',
      line2_frequency: 'FM 45.200',
      line3_precedence: 'B',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'yellow smoke',
      line8_nationality: 'Spanish Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage YELLOW. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'ITA-CAS-1',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Whiplash, no neurological deficit',
    vital_signs: [
      { hr: 80, bp: '126/82', spo2: 99, recorded_at: '2026-02-06T16:45:00Z' }
    ],
    prehospital_treatment: 'C-collar as precaution, oral analgesia',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.610044,2.342993',
      line2_callsign: 'ITPLSQ2 MEDIC',
      line2_frequency: 'FM 45.150',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'Italian Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage GREEN. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'ITA-CAS-2',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Abrasions and mild smoke inhalation',
    vital_signs: [
      { hr: 90, bp: '120/76', spo2: 97, recorded_at: '2026-02-06T16:46:00Z' }
    ],
    prehospital_treatment: 'O2 by mask, wounds cleaned, observed',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.610311,2.351614',
      line2_callsign: 'ITPLSQ2 MEDIC',
      line2_frequency: 'FM 45.150',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'Italian Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage GREEN. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'ITA-CAS-3',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Sprained wrist, suspected scaphoid',
    vital_signs: [
      { hr: 76, bp: '124/80', spo2: 99, recorded_at: '2026-02-06T16:47:00Z' }
    ],
    prehospital_treatment: 'Immobilised in splint, oral analgesia',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.610124,2.342451',
      line2_callsign: 'ITPLSQ2 MEDIC',
      line2_frequency: 'FM 45.150',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'Italian Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage GREEN. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'ITA-CAS-4',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Laceration to left calf, 8cm, bleeding controlled',
    vital_signs: [
      { hr: 86, bp: '121/79', spo2: 99, recorded_at: '2026-02-06T16:48:00Z' }
    ],
    prehospital_treatment: 'Pressure dressing, elevated, tetanus prophylaxis',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.614204,2.341808',
      line2_callsign: 'ITPLSQ2 MEDIC',
      line2_frequency: 'FM 45.150',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'Italian Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage GREEN. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'ITA-CAS-5',
    triage_color: 'RED',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Bilateral flail chest with hypoxia',
    vital_signs: [
      { hr: 118, bp: '95/60', spo2: 85, recorded_at: '2026-02-06T16:49:00Z' }
    ],
    prehospital_treatment: 'Bilateral chest seals, assisted ventilation, IV morphine 5mg',
    evac_priority: 'URGENT',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.613044,2.341602',
      line2_callsign: 'ITPLSQ2 MEDIC',
      line2_frequency: 'FM 45.150',
      line3_precedence: 'A',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 1,
      line5_ambulatory: 0,
      line6_security: 'N',
      line7_marking: 'A',
      line7_marking_detail: 'red VS-17 panel',
      line8_nationality: 'Italian Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage RED. See casualty collection point log.'
    }
  },
  {
    entity_ref: 'ITA-CAS-6',
    triage_color: 'GREEN',
    casualty_status: 'WIA',
    injury_mechanism: 'Blast (training ordnance premature detonation)',
    primary_injury: 'Acute stress reaction, hyperventilation',
    vital_signs: [
      { hr: 98, bp: '128/84', spo2: 99, recorded_at: '2026-02-06T16:50:00Z' }
    ],
    prehospital_treatment: 'Reassurance, controlled breathing, rest and fluids',
    evac_priority: 'ROUTINE',
    evac_stage: 'at_poi',
    destination_facility_ref: null,
    nine_line_data: {
      line1_location: '48.614848,2.345145',
      line2_callsign: 'ITPLSQ2 MEDIC',
      line2_frequency: 'FM 45.150',
      line3_precedence: 'C',
      line3_count: 1,
      line4_special_eqpt: 'A',
      line5_litter: 0,
      line5_ambulatory: 1,
      line6_security: 'N',
      line7_marking: 'C',
      line7_marking_detail: 'green smoke',
      line8_nationality: 'Italian Military',
      line9_nbc: null,
      remarks: 'MASCAL event - triage GREEN. See casualty collection point log.'
    }
  },];

module.exports = { meta, entities, medicalDetails };
