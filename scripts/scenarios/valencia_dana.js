// scripts/scenarios/valencia_dana.js
//
// Scenario: DANA flood in l'Horta Sud (Valencia)
// ----------------------------------------------
// Modelled on the flood of 29 October 2024, when the Barranco del Poyo overflowed
// through Paiporta, Benetússer, Alfafar, Sedaví, Massanassa and Catarroja, south of
// the city. The flooded area is much smaller than the real one on purpose: Valhalla
// refuses a route whose exclusion rings add up to more than 10 km of perimeter
// (max_exclude_polygons_length), and these zones total about 8.8 km.
//
//   - Hazard zones: one flood event in three parts along the barranco, and a
//     building collapse in Paiporta.
//   - Civilians, most of them trapped inside a zone, from a couple to a nursing
//     home of 25 (larger than any vehicle: it needs several vehicles or trips).
//   - Casualties of every urgency, one of them inside the flood.
//   - Real hospitals and sports halls used as shelters, with places and occupancy.
//   - Response vehicles of every civil category: fire and rescue, civil protection
//     (ground, helicopter and boat), Guardia Civil, ambulances, a medical helicopter
//     and a city bus.
//
// Names follow the agents' convention (SpaCiv1, SpaCas1, SpaFireHelo1). Positions are
// approximate. Built for the civil emergencies branch on 2026-10-14.
// ---------------------------------------------------------------------------

const meta = {
  name: 'valencia_dana',
  description: 'DANA flood in l\'Horta Sud, Valencia: a flood along the Barranco del Poyo (Paiporta, Benetússer, Alfafar, Massanassa) and a building collapse, trapped civilians, casualties, hospitals, shelters and the civil emergency services.',
  tags: ['civil-emergencies', 'flood', 'dana', 'valencia', 'civilians', 'shelters', 'hazard-zones']
};

const E = { country: null, activo: true, altitud: null };

const entities = [
  // ── Hospitals (sized by role, see FACILITY_SIZE_BY_ROLE) ───────────────────
  { ...E, nombre: 'Hospital La Fe',        elemento_identificado: 'SpaHospLaFe',    categoria: 'medical_facility', alliance: 'friendly', tipo_elemento: 'medical_role_4', descripcion: 'Hospital Universitari i Politècnic La Fe', observaciones: 'Reference hospital, trauma and ICU', max_capacity: 600, occupancy: 150, lat: 39.4440, lng: -0.3757 },
  { ...E, nombre: 'Hospital Doctor Peset', elemento_identificado: 'SpaHospPeset',   categoria: 'medical_facility', alliance: 'friendly', tipo_elemento: 'medical_role_3', descripcion: 'Hospital Universitario Doctor Peset', observaciones: 'Nearest general hospital to l\'Horta Sud', max_capacity: 300, occupancy: 50, lat: 39.4568, lng: -0.3897 },
  { ...E, nombre: 'Hospital General',      elemento_identificado: 'SpaHospGeneral', categoria: 'medical_facility', alliance: 'friendly', tipo_elemento: 'medical_role_3', descripcion: 'Hospital General Universitario de Valencia', observaciones: 'Surgery and ICU', max_capacity: 300, occupancy: 50, lat: 39.4646, lng: -0.4068 },
  { ...E, nombre: 'Hospital de Manises',   elemento_identificado: 'SpaHospManises', categoria: 'medical_facility', alliance: 'friendly', tipo_elemento: 'medical_role_3', descripcion: 'Hospital de Manises', observaciones: 'West of the flood', max_capacity: 300, occupancy: 50, lat: 39.4928, lng: -0.4578 },
  { ...E, nombre: 'PMA Alfafar',           elemento_identificado: 'SpaPmaAlfafar',  categoria: 'medical_facility', alliance: 'friendly', tipo_elemento: 'medical_role_1', descripcion: 'Advanced medical post (Puesto Médico Avanzado)', observaciones: 'Triage and stabilisation, east of the flood', max_capacity: 50, occupancy: 5, lat: 39.4190, lng: -0.3820 },

  // ── Shelters ───────────────────────────────────────────────────────────────
  { ...E, nombre: 'Pabellón Fuente de San Luis', elemento_identificado: 'SpaShelterSanLuis',  categoria: 'shelter', alliance: 'neutral', descripcion: 'Municipal sports hall, Valencia', observaciones: 'Camp beds, food and dry clothes', max_capacity: 500, occupancy: 120, lat: 39.4560, lng: -0.3735 },
  { ...E, nombre: 'Polideportivo de Torrent',    elemento_identificado: 'SpaShelterTorrent',  categoria: 'shelter', alliance: 'neutral', descripcion: 'Municipal sports centre, Torrent', observaciones: 'Upstream of the flood, dry', max_capacity: 300, occupancy: 40, lat: 39.4380, lng: -0.4630 },
  { ...E, nombre: 'Pabellón de Xirivella',       elemento_identificado: 'SpaShelterXirivella', categoria: 'shelter', alliance: 'neutral', descripcion: 'Municipal sports hall, Xirivella', observaciones: 'North of the flood', max_capacity: 250, occupancy: 30, lat: 39.4655, lng: -0.4270 },

  // ── Civilians (everyone at one location is one entity, `headcount` people) ──
  { ...E, nombre: 'SpaCiv1',  elemento_identificado: 'SpaCiv1',  categoria: 'civilian', alliance: 'neutral', headcount: 4,  descripcion: 'Family on a roof', observaciones: 'Two children; water at the first floor', lat: 39.4285, lng: -0.4180 },
  { ...E, nombre: 'SpaCiv2',  elemento_identificado: 'SpaCiv2',  categoria: 'civilian', alliance: 'neutral', headcount: 25, descripcion: 'Nursing home residents', observaciones: 'Most cannot walk; ground floor flooded', lat: 39.4278, lng: -0.4150 },
  { ...E, nombre: 'SpaCiv3',  elemento_identificado: 'SpaCiv3',  categoria: 'civilian', alliance: 'neutral', headcount: 2,  descripcion: 'Elderly couple', observaciones: 'Upper floor, no power', lat: 39.4290, lng: -0.4215 },
  { ...E, nombre: 'SpaCiv4',  elemento_identificado: 'SpaCiv4',  categoria: 'civilian', alliance: 'neutral', headcount: 18, descripcion: 'School group and teachers', observaciones: 'Sheltering on the school\'s first floor', lat: 39.4230, lng: -0.3940 },
  { ...E, nombre: 'SpaCiv5',  elemento_identificado: 'SpaCiv5',  categoria: 'civilian', alliance: 'neutral', headcount: 3,  descripcion: 'Drivers on a car roof', observaciones: 'Cars swept against a wall', lat: 39.4215, lng: -0.3900 },
  { ...E, nombre: 'SpaCiv6',  elemento_identificado: 'SpaCiv6',  categoria: 'civilian', alliance: 'neutral', headcount: 6,  descripcion: 'Neighbours in a garage loft', observaciones: 'Water still rising', lat: 39.4090, lng: -0.4020 },
  { ...E, nombre: 'SpaCiv7',  elemento_identificado: 'SpaCiv7',  categoria: 'civilian', alliance: 'neutral', headcount: 2,  descripcion: 'People under a collapsed building', observaciones: 'Voices heard under the rubble', lat: 39.4316, lng: -0.4166 },
  { ...E, nombre: 'SpaCiv8',  elemento_identificado: 'SpaCiv8',  categoria: 'civilian', alliance: 'neutral', headcount: 40, descripcion: 'Displaced residents in a square', observaciones: 'Dry but homeless, need a shelter', lat: 39.4345, lng: -0.4185 },
  { ...E, nombre: 'SpaCiv9',  elemento_identificado: 'SpaCiv9',  categoria: 'civilian', alliance: 'neutral', headcount: 5,  descripcion: 'Family at a petrol station', observaciones: 'Car lost, dry', lat: 39.4352, lng: -0.4340 },
  { ...E, nombre: 'SpaCiv10', elemento_identificado: 'SpaCiv10', categoria: 'civilian', alliance: 'neutral', headcount: 12, descripcion: 'Residents of a flooded block', observaciones: 'Waiting at the town hall', lat: 39.4270, lng: -0.3830 },

  // ── Casualties ─────────────────────────────────────────────────────────────
  { ...E, nombre: 'SpaCas1', elemento_identificado: 'SpaCas1', categoria: 'casualty', alliance: 'neutral', tipo_elemento: 'casualty', descripcion: 'Crushed by a car carried by the water', observaciones: 'Pelvic injury', lat: 39.4322, lng: -0.4195 },
  { ...E, nombre: 'SpaCas2', elemento_identificado: 'SpaCas2', categoria: 'casualty', alliance: 'neutral', tipo_elemento: 'casualty', descripcion: 'Hypothermia after hours in the water', observaciones: 'Conscious, shivering', lat: 39.4275, lng: -0.3960 },
  { ...E, nombre: 'SpaCas3', elemento_identificado: 'SpaCas3', categoria: 'casualty', alliance: 'neutral', tipo_elemento: 'casualty', descripcion: 'Laceration on the leg', observaciones: 'Walking', lat: 39.4345, lng: -0.4330 },
  { ...E, nombre: 'SpaCas4', elemento_identificado: 'SpaCas4', categoria: 'casualty', alliance: 'neutral', tipo_elemento: 'casualty', descripcion: 'Near drowning, inside the flood', observaciones: 'Rescued onto a balcony, breathing poorly', lat: 39.4240, lng: -0.3920 },
  { ...E, nombre: 'SpaCas5', elemento_identificado: 'SpaCas5', categoria: 'casualty', alliance: 'neutral', tipo_elemento: 'casualty', descripcion: 'Fractured arm', observaciones: 'Fell on stairs while escaping', lat: 39.4030, lng: -0.4040 },
  { ...E, nombre: 'SpaCas6', elemento_identificado: 'SpaCas6', categoria: 'casualty', alliance: 'neutral', tipo_elemento: 'casualty', descripcion: 'Bruises and cuts', observaciones: 'Walking', lat: 39.4180, lng: -0.3870 },

  // ── Ambulances and medical helicopter (SAMU) ───────────────────────────────
  { ...E, nombre: 'SpaMedevac1',     elemento_identificado: 'SpaMedevac1',     categoria: 'medevac_unit', alliance: 'friendly', tipo_elemento: 'medevac_role_1',    mobility: 'ground', capacity: 2, descripcion: 'SAMU advanced life support ambulance', observaciones: 'Two litters', lat: 39.4440, lng: -0.3770 },
  { ...E, nombre: 'SpaMedevac2',     elemento_identificado: 'SpaMedevac2',     categoria: 'medevac_unit', alliance: 'friendly', tipo_elemento: 'medevac_role_1',    mobility: 'ground', capacity: 1, descripcion: 'SAMU advanced life support ambulance', observaciones: 'One litter', lat: 39.4560, lng: -0.3910 },
  { ...E, nombre: 'SpaMedevacHelo1', elemento_identificado: 'SpaMedevacHelo1', categoria: 'medevac_unit', alliance: 'friendly', tipo_elemento: 'medevac_role_1',    mobility: 'air',    capacity: 1, descripcion: 'Medical helicopter (HEMS)', observaciones: 'Hoist fitted', lat: 39.4895, lng: -0.4816 },

  // ── Fire and rescue (Consorcio Provincial de Bomberos) ─────────────────────
  { ...E, nombre: 'SpaFire1',     elemento_identificado: 'SpaFire1',     categoria: 'fire_fighting', alliance: 'friendly', mobility: 'ground', capacity: 6,  descripcion: 'Rescue truck, Torrent station', observaciones: 'Technical rescue kit', lat: 39.4370, lng: -0.4600 },
  { ...E, nombre: 'SpaFire2',     elemento_identificado: 'SpaFire2',     categoria: 'fire_fighting', alliance: 'friendly', mobility: 'ground', capacity: 6,  descripcion: 'Rescue truck, Valencia station', observaciones: 'Technical rescue kit', lat: 39.4600, lng: -0.3900 },
  { ...E, nombre: 'SpaFireHelo1', elemento_identificado: 'SpaFireHelo1', categoria: 'fire_fighting', alliance: 'friendly', mobility: 'air',    capacity: 10, descripcion: 'Fire and rescue helicopter', observaciones: 'Hoist fitted', lat: 39.4890, lng: -0.4790 },

  // ── Civil protection ───────────────────────────────────────────────────────
  { ...E, nombre: 'SpaCivPro1',     elemento_identificado: 'SpaCivPro1',     categoria: 'civil_protection', alliance: 'friendly', mobility: 'ground', capacity: 20, descripcion: 'Civil protection high-clearance truck', observaciones: 'Staging at Xirivella', lat: 39.4700, lng: -0.4300 },
  { ...E, nombre: 'SpaCivProHelo1', elemento_identificado: 'SpaCivProHelo1', categoria: 'civil_protection', alliance: 'friendly', mobility: 'air',    capacity: 12, descripcion: 'Civil protection helicopter', observaciones: 'Hoist fitted', lat: 39.4900, lng: -0.4800 },
  { ...E, nombre: 'SpaCivProBoat1', elemento_identificado: 'SpaCivProBoat1', categoria: 'civil_protection', alliance: 'friendly', mobility: 'sea',    capacity: 8,  descripcion: 'Flood rescue boat', observaciones: 'On a trailer at Sedaví', lat: 39.4280, lng: -0.3810 },

  // ── Guardia Civil ──────────────────────────────────────────────────────────
  { ...E, nombre: 'SpaPol1',     elemento_identificado: 'SpaPol1',     categoria: 'law_enforcement', alliance: 'friendly', mobility: 'ground', capacity: 4, descripcion: 'Guardia Civil patrol car', observaciones: 'Picanya post', lat: 39.4360, lng: -0.4300 },
  { ...E, nombre: 'SpaPolHelo1', elemento_identificado: 'SpaPolHelo1', categoria: 'law_enforcement', alliance: 'friendly', mobility: 'air',    capacity: 8, descripcion: 'Guardia Civil helicopter', observaciones: 'Hoist fitted', lat: 39.4880, lng: -0.4830 },

  // ── City bus lent to the evacuation (EMT València) ─────────────────────────
  { ...E, nombre: 'SpaBus1', elemento_identificado: 'SpaBus1', categoria: 'transportation', alliance: 'friendly', mobility: 'ground', casevac_eligible: true, capacity: 22, descripcion: 'EMT city bus', observaciones: 'Seated passengers only', lat: 39.4600, lng: -0.3800 },
];

// Civilians carry a record with only their evacuation stage; casualties a full one.
const civilians = entities.filter(e => e.categoria === 'civilian')
  .map(e => ({ entity_ref: e.elemento_identificado, evac_stage: 'at_poi' }));

const casualty = (ref, triage_color, evac_priority, injury_mechanism, primary_injury) =>
  ({ entity_ref: ref, triage_color, casualty_status: 'WIA', evac_priority, evac_stage: 'at_poi', injury_mechanism, primary_injury });

const medicalDetails = [
  ...civilians,
  casualty('SpaCas1', 'RED',    'URGENT',   'Crush',        'Unstable pelvic fracture, suspected internal bleeding'),
  casualty('SpaCas2', 'YELLOW', 'PRIORITY', 'Immersion',    'Moderate hypothermia'),
  casualty('SpaCas3', 'GREEN',  'ROUTINE',  'Laceration',   'Deep laceration on the left calf'),
  casualty('SpaCas4', 'RED',    'URGENT',   'Near drowning', 'Water aspiration, respiratory distress'),
  casualty('SpaCas5', 'YELLOW', 'PRIORITY', 'Fall',         'Closed fracture of the right forearm'),
  casualty('SpaCas6', 'GREEN',  'ROUTINE',  'Debris',       'Multiple superficial cuts'),
];

// ---------------------------------------------------------------------------
// Hazard zones, [lng, lat]. Irregular outlines that spread along the barranco, kept
// small so their perimeters (about 8.8 km in all) fit Valhalla's 10 km.
// ---------------------------------------------------------------------------
const ring = coords => [...coords, coords[0]];

const hazardZones = [
  {
    name: 'DANA Barranco del Poyo',
    hazard_type: 'flood',
    description: 'The Barranco del Poyo overflowed: water at first-floor level in Paiporta, Benetússer, Alfafar and Massanassa',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        // Paiporta, along the barranco through the town centre
        [ring([
          [-0.4070, 39.4302], [-0.4074, 39.4307], [-0.4094, 39.4308], [-0.4115, 39.4306], [-0.4132, 39.4306], [-0.4148, 39.4306],
          [-0.4168, 39.4305], [-0.4189, 39.4301], [-0.4208, 39.4295], [-0.4223, 39.4289], [-0.4238, 39.4283], [-0.4247, 39.4277],
          [-0.4249, 39.4272], [-0.4248, 39.4267], [-0.4251, 39.4262], [-0.4254, 39.4255], [-0.4247, 39.4250], [-0.4225, 39.4250],
          [-0.4199, 39.4255], [-0.4176, 39.4262], [-0.4158, 39.4267], [-0.4141, 39.4271], [-0.4126, 39.4276], [-0.4113, 39.4281],
          [-0.4098, 39.4287], [-0.4081, 39.4294],
        ])],
        // Benetússer and Alfafar
        [ring([
          [-0.3865, 39.4210], [-0.3863, 39.4217], [-0.3873, 39.4226], [-0.3890, 39.4233], [-0.3906, 39.4238], [-0.3918, 39.4243],
          [-0.3930, 39.4248], [-0.3944, 39.4253], [-0.3962, 39.4257], [-0.3979, 39.4258], [-0.3994, 39.4257], [-0.4004, 39.4252],
          [-0.4006, 39.4245], [-0.3999, 39.4237], [-0.3988, 39.4230], [-0.3980, 39.4224], [-0.3973, 39.4217], [-0.3964, 39.4209],
          [-0.3949, 39.4202], [-0.3931, 39.4199], [-0.3916, 39.4201], [-0.3906, 39.4204], [-0.3894, 39.4205], [-0.3879, 39.4206],
        ])],
        // Massanassa
        [ring([
          [-0.3983, 39.4110], [-0.3993, 39.4113], [-0.4005, 39.4113], [-0.4016, 39.4113], [-0.4028, 39.4111], [-0.4040, 39.4106],
          [-0.4049, 39.4098], [-0.4053, 39.4091], [-0.4055, 39.4084], [-0.4057, 39.4076], [-0.4054, 39.4069], [-0.4044, 39.4065],
          [-0.4029, 39.4069], [-0.4017, 39.4075], [-0.4008, 39.4081], [-0.3998, 39.4086], [-0.3987, 39.4093], [-0.3980, 39.4102],
        ])],
      ],
    },
  },
  {
    name: 'Derrumbe Paiporta',
    hazard_type: 'structural_collapse',
    description: 'A house undermined by the water collapsed; people trapped under the rubble',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[ring([
        [-0.4172, 39.4320], [-0.4165, 39.4322], [-0.4159, 39.4319], [-0.4160, 39.4313], [-0.4167, 39.4311], [-0.4173, 39.4314],
      ])]],
    },
  },
];

module.exports = { meta, entities, medicalDetails, hazardZones };
