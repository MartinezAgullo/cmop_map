// scripts/scenarios/valencia_urban.js
//
// Scenario: Valencia Urban
// ------------------------
// Pure military scenario — the original seed from mapa-puntos-interes.
// No casualties / medical entities.  Use as a baseline or starting point
// for scenarios that layer in MEDEVAC data.
//
// Contract (shared by all scenarios):
//   module.exports = {
//     meta:           { name, description, tags },
//     entities:       [ { ...puntos_interes columns (no id, no geom) } ],
//     medicalDetails: [ { entity_ref, ...medical_details columns } ]
//   }
//
//   entity_ref inside medicalDetails matches elemento_identificado
//   so the loader can resolve the FK after INSERT.
// ---------------------------------------------------------------------------

const meta = {
  name: 'valencia_urban',
  description: 'Urban combat scenario around Valencia. Multi-nation friendly force vs hostile infantry + armour. No casualties.',
  tags: ['military', 'urban', 'valencia', 'baseline']
};

// ---------------------------------------------------------------------------
// Entities  (maps 1:1 to puntos_interes columns)
//   lng / lat used by the loader to build ST_MakePoint(lng, lat)
// ---------------------------------------------------------------------------
const entities = [
  // ---------------------------------------------------------------
  // Friendly infantry — Spain
  // ---------------------------------------------------------------
  { nombre: 'ESP INF-A',  descripcion: 'Infantry squad (urban)',  categoria: 'infantry',  country: 'Spain',   alliance: 'friendly', elemento_identificado: 'ESP-INF-A',    activo: true, tipo_elemento: 'standard',  prioridad: 5, observaciones: 'Urban patrol',           altitud: null, lng: -0.3768, lat: 39.4745 },
  { nombre: 'ESP INF-B',  descripcion: 'Infantry squad (urban)',  categoria: 'infantry',  country: 'Spain',   alliance: 'friendly', elemento_identificado: 'ESP-INF-B',    activo: true, tipo_elemento: 'standard',  prioridad: 5, observaciones: 'Holding intersection',   altitud: null, lng: -0.3850, lat: 39.4632 },
  { nombre: 'ESP INF-C',  descripcion: 'Infantry squad (urban)',  categoria: 'infantry',  country: 'Spain',   alliance: 'friendly', elemento_identificado: 'ESP-INF-C',    activo: true, tipo_elemento: 'standard',  prioridad: 5, observaciones: 'Near park area',         altitud: null, lng: -0.3650, lat: 39.4841 },

  // ---------------------------------------------------------------
  // Friendly infantry — France
  // ---------------------------------------------------------------
  { nombre: 'FRA INF-1',  descripcion: 'Infantry squad (urban)',  categoria: 'infantry',  country: 'France',  alliance: 'friendly', elemento_identificado: 'FRA-INF-1',    activo: true, tipo_elemento: 'standard',  prioridad: 5, observaciones: 'Supporting ESP',          altitud: null, lng: -0.3530, lat: 39.4525 },
  { nombre: 'FRA INF-2',  descripcion: 'Infantry squad (urban)',  categoria: 'infantry',  country: 'France',  alliance: 'friendly', elemento_identificado: 'FRA-INF-2',    activo: true, tipo_elemento: 'standard',  prioridad: 5, observaciones: 'Roadblock',              altitud: null, lng: -0.3405, lat: 39.4598 },

  // ---------------------------------------------------------------
  // Friendly infantry — Germany / Portugal
  // ---------------------------------------------------------------
  { nombre: 'DEU INF-1',  descripcion: 'Infantry squad (urban)',  categoria: 'infantry',  country: 'Germany', alliance: 'friendly', elemento_identificado: 'DEU-INF-1',    activo: true, tipo_elemento: 'standard',  prioridad: 5, observaciones: 'QR force',               altitud: null, lng: -0.4002, lat: 39.4820 },
  { nombre: 'PRT INF-1',  descripcion: 'Infantry squad (urban)',  categoria: 'infantry',  country: 'Portugal',alliance: 'friendly', elemento_identificado: 'PRT-INF-1',    activo: true, tipo_elemento: 'standard',  prioridad: 5, observaciones: 'Rear security',          altitud: null, lng: -0.3925, lat: 39.4682 },

  // ---------------------------------------------------------------
  // Hostile infantry
  // ---------------------------------------------------------------
  { nombre: 'H-INF-1',    descripcion: 'Hostile infantry',        categoria: 'infantry',  country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-INF-1',      activo: true, tipo_elemento: 'standard',  prioridad: 6, observaciones: 'Skirmishing',            altitud: null, lng: -0.3609, lat: 39.4705 },
  { nombre: 'H-INF-2',    descripcion: 'Hostile infantry',        categoria: 'infantry',  country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-INF-2',      activo: true, tipo_elemento: 'standard',  prioridad: 6, observaciones: 'Advancing',              altitud: null, lng: -0.3452, lat: 39.4769 },
  { nombre: 'H-INF-3',    descripcion: 'Hostile infantry',        categoria: 'infantry',  country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-INF-3',      activo: true, tipo_elemento: 'standard',  prioridad: 6, observaciones: 'Occupying block',        altitud: null, lng: -0.3513, lat: 39.4881 },
  { nombre: 'H-INF-4',    descripcion: 'Hostile infantry',        categoria: 'infantry',  country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-INF-4',      activo: true, tipo_elemento: 'standard',  prioridad: 6, observaciones: 'Ambush expected',        altitud: null, lng: -0.3687, lat: 39.4611 },
  { nombre: 'H-INF-5',    descripcion: 'Hostile infantry',        categoria: 'infantry',  country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-INF-5',      activo: true, tipo_elemento: 'standard',  prioridad: 6, observaciones: 'Sniper activity',        altitud: null, lng: -0.3811, lat: 39.4552 },
  { nombre: 'H-INF-6',    descripcion: 'Hostile infantry',        categoria: 'infantry',  country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-INF-6',      activo: true, tipo_elemento: 'standard',  prioridad: 6, observaciones: 'Harassing fire',        altitud: null, lng: -0.3440, lat: 39.4479 },
  { nombre: 'H-INF-7',    descripcion: 'Hostile infantry',        categoria: 'infantry',  country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-INF-7',      activo: true, tipo_elemento: 'standard',  prioridad: 6, observaciones: 'Fragmented contact',    altitud: null, lng: -0.3895, lat: 39.4786 },

  // ---------------------------------------------------------------
  // Hostile tanks
  // ---------------------------------------------------------------
  { nombre: 'H-TANK-1',   descripcion: 'Hostile MBT',            categoria: 'armoured',      country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-TNK-1',      activo: true, tipo_elemento: 'MBT',       prioridad: 9, observaciones: 'Covered position',       altitud: null, lng: -0.3700, lat: 39.4930 },
  { nombre: 'H-TANK-2',   descripcion: 'Hostile MBT',            categoria: 'armoured',      country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-TNK-2',      activo: true, tipo_elemento: 'MBT',       prioridad: 9, observaciones: 'Hull-down',              altitud: null, lng: -0.4040, lat: 39.4665 },
  { nombre: 'H-TANK-3',   descripcion: 'Hostile MBT',            categoria: 'armoured',      country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-TNK-3',      activo: true, tipo_elemento: 'MBT',       prioridad: 9, observaciones: 'Overwatch',             altitud: null, lng: -0.3960, lat: 39.4505 },

  // ---------------------------------------------------------------
  // Naval (Valencia coast)
  // ---------------------------------------------------------------
  { nombre: 'ESP SHIP-1', descripcion: 'Spanish surface combatant', categoria: 'ship',   country: 'Spain',   alliance: 'friendly', elemento_identificado: 'ESP-SHIP-1',   activo: true, tipo_elemento: 'Frigate',    prioridad: 8, observaciones: 'Patrolling Valencia coast', altitud: null, lng: -0.2700, lat: 39.4500 },
  { nombre: 'ESP SUB-1',  descripcion: 'Spanish SSK',             categoria: 'submarine', country: 'Spain',  alliance: 'friendly', elemento_identificado: 'ESP-SUB-1',    activo: true, tipo_elemento: 'SSK',       prioridad: 10,observaciones: 'Submerged patrol',      altitud: null, lng: -0.2200, lat: 39.4000 },
  { nombre: 'H-SHIP-1',   descripcion: 'Unknown surface contact', categoria: 'ship',    country: 'Unknown', alliance: 'hostile',  elemento_identificado: 'H-SHIP-1',     activo: true, tipo_elemento: 'Corvette',   prioridad: 9, observaciones: 'Shadowing traffic',      altitud: null, lng: -0.2200, lat: 39.5500 },

  // ---------------------------------------------------------------
  // Fixed assets & air
  // ---------------------------------------------------------------
  { nombre: 'Manises AB',  descripcion: 'Air base (ESP)',          categoria: 'base',     country: 'Spain',   alliance: 'friendly', elemento_identificado: 'ESP-BASE-ZAZ', activo: true, tipo_elemento: 'Air Base',   prioridad: 9, observaciones: 'Logistics hub',          altitud: null, lng: -0.4760, lat: 39.4910 },
  { nombre: 'ESP CAP-1',   descripcion: 'Fighter CAP on station', categoria: 'fighter',  country: 'Spain',   alliance: 'friendly', elemento_identificado: 'ESP-CAP-1',    activo: true, tipo_elemento: 'CAP',       prioridad: 8, observaciones: 'Angels 26',              altitud: 8000, lng: -0.3000, lat: 39.5200 },
  { nombre: 'FRA UAV-ISR', descripcion: 'High-altitude ISR UAV',  categoria: 'uav',      country: 'France',  alliance: 'friendly', elemento_identificado: 'FRA-UAV-1',    activo: true, tipo_elemento: 'ISR',       prioridad: 6, observaciones: 'Wide-area scan',        altitud: 1200, lng: -0.3300, lat: 39.4700 },
  { nombre: 'H-ARTY-1',    descripcion: 'Hostile artillery battery', categoria: 'artillery', country: 'Unknown', alliance: 'hostile', elemento_identificado: 'H-ARTY-1',  activo: true, tipo_elemento: '155mm',     prioridad: 8, observaciones: 'Counter-battery risk',   altitud: null, lng: -0.2700, lat: 39.6800 },
  { nombre: 'DEU HEL-1',   descripcion: 'Utility helicopter',     categoria: 'helicopter', country: 'Germany', alliance: 'friendly', elemento_identificado: 'DEU-HEL-1', activo: true, tipo_elemento: 'Utility',   prioridad: 5, observaciones: 'MEDEVAC on call',       altitud: 500,  lng: -0.3600, lat: 39.4900 },
];

// No casualties in this scenario — empty array, not undefined.
const medicalDetails = [];

module.exports = { meta, entities, medicalDetails };
