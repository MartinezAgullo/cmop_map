// scripts/scenarios/paris_sud_medevac_no_WIAs.js
//
// Scenario: Paris Sud MEDEVAC — No Casualties
// --------------------------------------------
// Multinational brigade exercise south of Paris (France/Spain/Germany/Italy).
// Combined arms training with medical support and MEDEVAC assets.
// No WIA or KIA in this variant — used for route planning and logistics drills.
//
// Coordinates: South of Paris, France (48.5-48.6°N, 2.2-2.35°E)
// ---------------------------------------------------------------------------

const meta = {
  name: 'paris_sud_medevac_no_WIAs',
  description: 'Multinational brigade exercise south of Paris. Spanish, French, German, and Italian units conducting combined arms training with full medical support. No casualties — used for MEDEVAC route planning and logistics drills.',
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
  // German armoured platoon
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
  { nombre: 'Clinique Des Charmilles', descripcion: 'French Role 4 Hospital', categoria: 'medical_facility', country: 'France', alliance: 'friendly', elemento_identificado: 'FraMedRole4', activo: true, tipo_elemento: 'medical_role_4', observaciones: 'Definitive care facility', altitud: null, max_capacity: 600, occupancy: 150, lng: 2.249171, lat: 48.592789 },

  // ---------------------------------------------------------------
  // MEDEVAC assets
  // ---------------------------------------------------------------
  { nombre: 'SpaMedevac1', descripcion: 'Spanish MEDEVAC ambulance', categoria: 'medevac_unit', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaMedevac1', activo: true, tipo_elemento: 'medevac_role_1', mobility: 'ground', capacity: 1, observaciones: 'Ground evacuation', altitud: null, lng: 2.305, lat: 48.58 },
  { nombre: 'FraMedevac2', descripcion: 'French MEDEVAC ambulance', categoria: 'medevac_unit', country: 'France', alliance: 'friendly', elemento_identificado: 'FraMedevac2', activo: true, tipo_elemento: 'medevac_role_2', mobility: 'ground', capacity: 1, observaciones: 'Ground evacuation', altitud: null, lng: 2.255, lat: 48.60 },
  { nombre: 'ItaMedevac1', descripcion: 'Italian MEDEVAC ambulance', categoria: 'medevac_unit', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ItaMedevac1', activo: true, tipo_elemento: 'medevac_role_1', mobility: 'ground', capacity: 1, observaciones: 'Ground evacuation', altitud: null, lng: 2.34, lat: 48.595 },
  //{ nombre: 'FraMedevacHelo1', descripcion: 'French MEDEVAC helicopter Role 1', categoria: 'medevac_unit', country: 'France', alliance: 'friendly', elemento_identificado: 'FraMedevacHelo1', activo: true, tipo_elemento: 'medevac_role_1', mobility: 'air', observaciones: 'NH90 TTH', altitud: null, lng: 2.2494, lat: 48.5941 },
  { nombre: 'FraMedevacHelo2', descripcion: 'French MEDEVAC helicopter Role 2', categoria: 'medevac_unit', country: 'France', alliance: 'friendly', elemento_identificado: 'FraMedevacHelo2', activo: true, tipo_elemento: 'medevac_role_2', mobility: 'air', capacity: 1, observaciones: 'CH-47 Chinook', altitud: null, lng: 2.2503, lat: 48.5947 },

  // ---------------------------------------------------------------
  // Transport assets
  // ---------------------------------------------------------------
  { nombre: 'ItaTransport1', descripcion: 'Italian transport vehicle', categoria: 'transportation', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ItaTransport1', activo: true, tipo_elemento: null, mobility: 'ground', casevac_eligible: true, capacity: 1, observaciones: 'Toyota pickup civil', altitud: null, lng: 2.336691, lat: 48.597926 },
  { nombre: 'ItaTransport2', descripcion: 'Italian supply transport', categoria: 'transportation', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ItaTransport2', activo: true, tipo_elemento: 'supply', mobility: 'ground', casevac_eligible: true, capacity: 1, observaciones: 'M-Gator', altitud: null, lng: 2.351239, lat: 48.609221 },
  { nombre: 'ItaTransport3', descripcion: 'Italian supply transport', categoria: 'transportation', country: 'Italy', alliance: 'friendly', elemento_identificado: 'ItaTransport3', activo: true, tipo_elemento: 'supply', mobility: 'ground', casevac_eligible: false, observaciones: 'Iveco M250', altitud: null, lng: 2.353512, lat: 48.621733 },
  { nombre: 'SpaTransport1', descripcion: 'Spanish transport vehicle', categoria: 'transportation', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaTransport1', activo: true, tipo_elemento: null, mobility: 'ground', casevac_eligible: true, capacity: 1, observaciones: 'VBMR Griffon', altitud: null, lng: 2.310899, lat: 48.593726 },

  // ---------------------------------------------------------------
  // UGV assets
  // ---------------------------------------------------------------
  { nombre: 'SpaUgv1', descripcion: 'Spanish UGV Alano', categoria: 'ugv', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaUgv1', activo: true, casevac_eligible: true, capacity: 1, observaciones: 'Alano model. Autonomous operation capable. Payload 700 kg. 20 km/h', altitud: null, lng: 2.325228, lat: 48.597472 },
  { nombre: 'SpaUgv2', descripcion: 'Spanish UGV Alano', categoria: 'ugv', country: 'Spain', alliance: 'friendly', elemento_identificado: 'SpaUgv2', activo: true, casevac_eligible: true, capacity: 1, observaciones: 'Alano model. Autonomous operation capable. Payload 700 kg. 20 km/h', altitud: null, lng: 2.338209, lat: 48.587545 },
  { nombre: 'GerUgv1', descripcion: 'German GerUgv1', categoria: 'ugv', country: 'Germany', alliance: 'friendly', elemento_identificado: 'GerUgv1', activo: true, casevac_eligible: true, capacity: 1, observaciones: 'THeMIS model. Autonomous operation capable. Payload 800 kg. 25 km/h', altitud: null, lng: 2.372252, lat: 48.608309 },
];

const medicalDetails = [];

module.exports = { meta, entities, medicalDetails };
