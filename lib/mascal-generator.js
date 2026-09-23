// lib/mascal-generator.js
//
// Random mass-casualty (MASCAL) scenarios around a point.
//
// Pure: given the same options and seed it returns the same scenario, and it touches
// neither the database nor the file system. The result has the shape every file in
// scripts/scenarios/ exports, { meta, entities, medicalDetails }, so the ordinary loader
// takes it unchanged.
//
// Attributes are drawn from skewed distributions rather than uniformly, because a real
// MASCAL is skewed: more T3 than T2 and more T2 than T1, with a few dead; more role-1
// platforms than role-2 and so on up the roles (the triangular 4:3:2:1 of
// optimizacion-annealing/evacuaciones_medevac_2.ipynb); the same shape for facilities, with
// at least one of each role when there are four or more; and only about one ambulance in
// three able to lift more than one casualty per cycle.
// ---------------------------------------------------------------------------

// Centres to scatter a scenario around. Only Paris is inside the Valhalla extract the demo
// ships with (Île-de-France); elsewhere ground routes need tiles for that region.
const PRESETS = {
  paris:    { label: 'Paris (Sud)', lat: 48.600, lng: 2.340,  country: 'France',  prefix: 'FRA' },
  madrid:   { label: 'Madrid',      lat: 40.417, lng: -3.704, country: 'Spain',   prefix: 'ESP' },
  valencia: { label: 'Valencia',    lat: 39.470, lng: -0.376, country: 'Spain',   prefix: 'ESP' },
  london:   { label: 'London',      lat: 51.507, lng: -0.128, country: 'United Kingdom', prefix: 'GBR' },
  berlin:   { label: 'Berlin',      lat: 52.520, lng: 13.405, country: 'Germany', prefix: 'DEU' },
  rome:     { label: 'Rome',        lat: 41.903, lng: 12.496, country: 'Italy',   prefix: 'ITA' },
  brussels: { label: 'Brussels',    lat: 50.850, lng: 4.352,  country: 'Belgium', prefix: 'BEL' },
};

// Weights, not probabilities: each list is normalised when it is drawn from.
const DEFAULT_DISTRIBUTIONS = {
  triage:        { GREEN: 50, YELLOW: 30, RED: 15, BLACK: 5 },  // T3 > T2 > T1, 5 % KIA
  vehicleRole:   { 1: 4, 2: 3, 3: 2, 4: 1 },                    // triangular, as in the notebook
  facilityRole:  { 1: 4, 2: 3, 3: 2, 4: 1 },                    // R1 > R2 > R3 > R4
  vehicleMedium: { ground: 3, air: 1 },                         // ground 3x air, as in the notebook
  multiLitterShare: 1 / 3,                                      // capacity 2, else 1
};

// With at least this many facilities, every role from 1 to 4 is present at least once.
const ALL_FACILITY_ROLES = [1, 2, 3, 4];

const LIMITS = { casualties: 200, evacuators: 60, facilities: 20, radiusKm: 25 };

// ---------------------------------------------------------------------------
// Randomness
// ---------------------------------------------------------------------------

/** mulberry32: a small seeded PRNG, so a seed names a scenario exactly. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Exactly `n` draws whose proportions follow `weights` as closely as integers allow
 * (largest remainder), in random order. Independent draws would, at 12 casualties, easily
 * give more T1 than T3; the brief is a skew that always holds.
 */
function apportion(random, weights, n) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const shares = entries.map(([key, w]) => ({ key, exact: (w / total) * n }));
  shares.forEach(s => { s.count = Math.floor(s.exact); });
  const left = n - shares.reduce((sum, s) => sum + s.count, 0);
  [...shares]
    .sort((a, b) => (b.exact - b.count) - (a.exact - a.count))   // stable: ties keep order
    .slice(0, left)
    .forEach(s => { s.count += 1; });
  const draws = shares.flatMap(s => Array(s.count).fill(s.key));
  for (let i = draws.length - 1; i > 0; i -= 1) {         // Fisher-Yates
    const j = Math.floor(random() * (i + 1));
    [draws[i], draws[j]] = [draws[j], draws[i]];
  }
  return draws;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;

/** The point `distanceKm` from `origin` on `bearing` (radians), on a sphere. */
function offset(origin, distanceKm, bearing) {
  const d = distanceKm / EARTH_RADIUS_KM;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
  const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
                                 Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: round6((lat2 * 180) / Math.PI), lng: round6((lng2 * 180) / Math.PI) };
}

/** A uniformly distributed point in the ring between `innerKm` and `outerKm`. */
function pointInRing(random, centre, innerKm, outerKm) {
  const r = Math.sqrt(innerKm ** 2 + random() * (outerKm ** 2 - innerKm ** 2));
  return offset(centre, r, random() * 2 * Math.PI);
}

function round6(x) { return Math.round(x * 1e6) / 1e6; }

// ---------------------------------------------------------------------------
// Clinical flavour, per triage colour
// ---------------------------------------------------------------------------

const INJURIES = {
  BLACK: ['Fatal head trauma', 'Fatal crush injury', 'Fatal blast injury'],
  RED: ['Penetrating thoracic trauma', 'Traumatic above-knee amputation', 'Severe TBI',
        'Blast lung', 'Massive haemorrhage, junctional', 'Bilateral flail chest with hypoxia'],
  YELLOW: ['Open tibia-fibula fracture', 'Closed femur fracture', 'Partial-thickness burns 18% TBSA',
           'Blunt abdominal trauma, stable', 'Penetrating ocular injury', 'Crush injury lower limb'],
  GREEN: ['Superficial fragmentation wounds', 'Sprained wrist', 'Laceration to calf',
          'Minor burns to hand', 'Acute stress reaction', 'Contusion to shoulder'],
};

const MECHANISMS = ['Vehicle-borne IED', 'Indirect fire (mortar)', 'Multi-vehicle collision',
                    'Structure collapse', 'Ordnance premature detonation'];

const VITALS = {
  RED:    () => ({ hr: 130, bp: '78/45',  spo2: 86 }),
  YELLOW: () => ({ hr: 108, bp: '105/68', spo2: 94 }),
  GREEN:  () => ({ hr: 88,  bp: '125/80', spo2: 98 }),
};

const EVAC_PRIORITY = { RED: 'URGENT', YELLOW: 'PRIORITY', GREEN: 'ROUTINE', BLUE: 'ROUTINE',
                        BLACK: 'UNKNOWN' };

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

function clampInt(value, min, max, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new RangeError(`${name} must be an integer between ${min} and ${max}, got ${value}`);
  }
  return n;
}

function resolveCentre(options) {
  if (options.lat != null && options.lng != null) {
    const lat = Number(options.lat);
    const lng = Number(options.lng);
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) {
      throw new RangeError(`invalid centre ${options.lat}, ${options.lng}`);
    }
    return { key: 'custom', label: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, lat, lng,
             country: options.country || null, prefix: 'RND' };
  }
  const key = String(options.preset || 'paris').toLowerCase();
  const preset = PRESETS[key];
  if (!preset) {
    throw new RangeError(`unknown preset "${options.preset}"; one of ${Object.keys(PRESETS).join(', ')}`);
  }
  return { key, ...preset };
}

/** A name a scenario file can carry: the preset and the seed identify it. */
function scenarioName(centreKey, seed) {
  return `random_mascal_${centreKey}_s${seed}`;
}

// ---------------------------------------------------------------------------
// The generator
// ---------------------------------------------------------------------------

/**
 * @param {object} options
 * @param {number} options.n_casualties
 * @param {number} options.n_evacuators
 * @param {number} [options.n_medical_facilities]  default: a third of the evacuators, at least 2
 * @param {string} [options.preset]                a key of PRESETS (default paris)
 * @param {number} [options.lat] [options.lng]     a custom centre, overriding the preset
 * @param {number} [options.radius_km]             default 4
 * @param {number} [options.seed]                  default: random
 * @param {object} [options.distributions]         overrides for DEFAULT_DISTRIBUTIONS
 * @param {string|number} [options.now]            timestamp for the vitals (default: now)
 * @returns {{ meta, entities, medicalDetails }}
 */
function generateMascalScenario(options = {}) {
  const nCasualties = clampInt(options.n_casualties ?? 30, 1, LIMITS.casualties, 'n_casualties');
  const nEvacuators = clampInt(options.n_evacuators ?? 12, 1, LIMITS.evacuators, 'n_evacuators');
  const nFacilities = clampInt(options.n_medical_facilities ?? Math.max(2, Math.round(nEvacuators / 3)),
                               1, LIMITS.facilities, 'n_medical_facilities');
  const radiusKm = Number(options.radius_km ?? 4);
  if (!(radiusKm > 0 && radiusKm <= LIMITS.radiusKm)) {
    throw new RangeError(`radius_km must be in (0, ${LIMITS.radiusKm}], got ${options.radius_km}`);
  }
  const seed = options.seed != null
    ? clampInt(options.seed, 0, 2 ** 31 - 1, 'seed')
    : Math.floor(Math.random() * 1e6);
  const dist = { ...DEFAULT_DISTRIBUTIONS, ...(options.distributions || {}) };
  const centre = resolveCentre(options);
  const random = seededRandom(seed);
  const name = scenarioName(centre.key, seed);
  const prefix = centre.prefix;
  // The only input that is not a function of the seed: when the vitals were taken.
  const recordedAt = new Date(options.now ?? Date.now()).toISOString();
  const country = centre.country;

  const entities = [];
  const medicalDetails = [];

  // Facilities: the rear of the area, in the outer half of the radius. With four or more,
  // one of each role is set aside first and only the rest follows the distribution.
  const reserved = nFacilities >= ALL_FACILITY_ROLES.length ? ALL_FACILITY_ROLES : [];
  const facilityRoles = [
    ...reserved,
    ...apportion(random, dist.facilityRole, nFacilities - reserved.length).map(Number),
  ];
  // A RED casualty needs a role-2 facility or better; leave none and every T1 is a violation.
  if (!facilityRoles.some(r => r >= 2)) facilityRoles[facilityRoles.length - 1] = 2;
  facilityRoles.sort((a, b) => a - b).forEach((role, i) => {
    const at = pointInRing(random, centre, radiusKm * 0.5, radiusKm);
    entities.push({
      nombre: `${prefix} MED Role-${role} #${i + 1}`,
      descripcion: `Role-${role} medical treatment facility (generated)`,
      categoria: 'medical_facility', country, alliance: 'friendly',
      elemento_identificado: `RND-FAC-${i + 1}`, activo: true,
      tipo_elemento: `medical_role_${role}`,
      observaciones: 'Generated for a random MASCAL scenario', altitud: null, ...at,
    });
  });

  // Evacuation platforms: anywhere in the area, most of them on the ground.
  const vehicleRoles = apportion(random, dist.vehicleRole, nEvacuators).map(Number);
  const media = apportion(random, dist.vehicleMedium, nEvacuators);
  const multiLitter = new Set(
    apportion(random, { two: dist.multiLitterShare, one: 1 - dist.multiLitterShare }, nEvacuators)
      .map((draw, i) => (draw === 'two' ? i : -1)).filter(i => i >= 0));
  const counters = { ground: 0, air: 0 };
  for (let i = 0; i < nEvacuators; i += 1) {
    const medium = media[i];
    const role = vehicleRoles[i];
    const capacity = multiLitter.has(i) ? 2 : 1;
    counters[medium] += 1;
    const label = medium === 'air' ? `MEDEVAC-HEL-${counters.air}` : `MEDEVAC-${counters.ground}`;
    entities.push({
      nombre: `${prefix} ${label}`,
      descripcion: `${medium === 'air' ? 'MEDEVAC helicopter' : 'MEDEVAC ambulance'} role ${role} (generated)`,
      categoria: 'medevac_unit', country, alliance: 'friendly',
      elemento_identificado: `RND-EVAC-${i + 1}`, activo: true,
      tipo_elemento: `medevac_role_${role}`, mobility: medium, capacity,
      observaciones: `Capacity: ${capacity} litter${capacity > 1 ? 's' : ''}`,
      altitud: null, ...pointInRing(random, centre, 0, radiusKm),
    });
  }

  // Casualties: grouped into incidents of about eight, like a real MASCAL, each incident
  // somewhere in the inner part of the area and its casualties within a few hundred metres.
  const incidentCount = Math.max(1, Math.ceil(nCasualties / 8));
  const incidents = Array.from({ length: incidentCount }, () => ({
    at: pointInRing(random, centre, 0, radiusKm * 0.7),
    mechanism: MECHANISMS[Math.floor(random() * MECHANISMS.length)],
  }));
  const triages = apportion(random, dist.triage, nCasualties);
  triages.forEach((triage, i) => {
    const incident = incidents[i % incidentCount];
    const injuries = INJURIES[triage] || INJURIES.GREEN;
    const injury = injuries[Math.floor(random() * injuries.length)];
    const ref = `RND-CAS-${i + 1}`;
    const at = pointInRing(random, incident.at, 0, 0.3);
    const status = triage === 'BLACK' ? 'KIA' : 'WIA';
    entities.push({
      nombre: `${prefix}-CAS-${i + 1} (${status})`,
      descripcion: `${status} - ${injury}`,
      categoria: 'casualty', country, alliance: 'friendly',
      elemento_identificado: ref, activo: true, tipo_elemento: 'casualty',
      observaciones: incident.mechanism, altitud: null, ...at,
    });
    medicalDetails.push({
      entity_ref: ref,
      triage_color: triage,
      casualty_status: status,
      injury_mechanism: incident.mechanism,
      primary_injury: injury,
      vital_signs: VITALS[triage] ? [{ ...VITALS[triage](), recorded_at: recordedAt }] : null,
      prehospital_treatment: null,
      evac_priority: EVAC_PRIORITY[triage] || 'ROUTINE',
      evac_stage: 'at_poi',
      destination_facility_ref: null,
      nine_line_data: null,
    });
  });

  // Ensure a RED casualty has at least one platform that meets its care minimum (role 2+).
  if (triages.includes('RED')) {
    const vehicles = entities.filter(e => e.categoria === 'medevac_unit');
    if (!vehicles.some(v => Number(v.tipo_elemento.slice(-1)) >= 2)) {
      vehicles[vehicles.length - 1].tipo_elemento = 'medevac_role_2';
    }
  }

  const tally = (list) => list.reduce((acc, k) => ({ ...acc, [k]: (acc[k] || 0) + 1 }), {});
  const triageMix = tally(triages);
  const slots = entities.filter(e => e.categoria === 'medevac_unit')
    .reduce((sum, e) => sum + e.capacity, 0);

  const meta = {
    name,
    description: `Random MASCAL around ${centre.label}: ${nCasualties} casualties `
      + `(${['RED', 'YELLOW', 'GREEN', 'BLACK'].map(t => `${triageMix[t] || 0} ${t}`).join(', ')}), `
      + `${nEvacuators} evacuation platforms (${slots} slots) and ${nFacilities} facilities `
      + `within ${radiusKm} km. Seed ${seed}.`,
    tags: ['medevac', 'mascal', 'generated', centre.key],
    generated: {
      by: 'lib/mascal-generator.js',
      seed,
      centre: { key: centre.key, lat: centre.lat, lng: centre.lng },
      radius_km: radiusKm,
      n_casualties: nCasualties,
      n_evacuators: nEvacuators,
      n_medical_facilities: nFacilities,
      triage_mix: triageMix,
      evacuation_slots: slots,
    },
  };

  return { meta, entities, medicalDetails };
}

module.exports = {
  PRESETS,
  DEFAULT_DISTRIBUTIONS,
  LIMITS,
  generateMascalScenario,
  scenarioName,
  // exported for tests
  apportion,
  seededRandom,
};
