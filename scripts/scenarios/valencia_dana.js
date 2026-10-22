// scripts/scenarios/valencia_dana.js
//
// Scenario: DANA flood in l'Horta Sud (Valencia)
// ----------------------------------------------
// Modelled on the flood of 29 October 2024, when the Barranco del Poyo overflowed
// from Picanya through Paiporta, Benetússer, Alfafar, Sedaví, Massanassa and Catarroja,
// south of the city, and the Barranco de la Saleta through Aldaia and Alaquàs. The
// flooded areas follow the real beds (OpenStreetMap's "Barranc de Xiva" and "Barranc
// de la Saleta") but are narrower than the real flood. Their rings add up to about
// 26.9 km of perimeter, over Valhalla's default max_exclude_polygons_length of 10 km:
// raise it to 40 km in valhalla.json, together with latacc-medevac's
// ROUTING_MAX_EXCLUDE_PERIMETER_M. Below about 25 km the routing MCP leaves every zone
// out of the routes and warns.
//
//   - Hazard zones: the Poyo flood in six parts along the barranco (it closes the
//     CV-33 at Picanya and the V-31 at Catarroja), the Saleta flood in Aldaia and
//     Alaquàs, and building collapses in Paiporta, Picanya, Massanassa and Catarroja.
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
  description: 'DANA flood in l\'Horta Sud, Valencia: floods along the Barranco del Poyo (Picanya, Paiporta, Benetússer, Alfafar, La Torre, Massanassa, Catarroja) and the Barranco de la Saleta (Aldaia, Alaquàs), four building collapses, trapped civilians, casualties, hospitals, shelters and the civil emergency services.',
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
  { ...E, nombre: 'Pabellón Fuente de San Luis', elemento_identificado: 'SpaShelterSanLuis',  categoria: 'shelter', alliance: 'friendly', descripcion: 'Municipal sports hall, Valencia', observaciones: 'Camp beds, food and dry clothes', max_capacity: 500, occupancy: 120, lat: 39.4560, lng: -0.3735 },
  { ...E, nombre: 'Polideportivo de Torrent',    elemento_identificado: 'SpaShelterTorrent',  categoria: 'shelter', alliance: 'friendly', descripcion: 'Municipal sports centre, Torrent', observaciones: 'Upstream of the flood, dry', max_capacity: 300, occupancy: 40, lat: 39.4380, lng: -0.4630 },
  { ...E, nombre: 'Pabellón de Xirivella',       elemento_identificado: 'SpaShelterXirivella', categoria: 'shelter', alliance: 'friendly', descripcion: 'Municipal sports hall, Xirivella', observaciones: 'North of the flood', max_capacity: 250, occupancy: 30, lat: 39.4655, lng: -0.4270 },

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
// Hazard zones, [lng, lat]. Irregular outlines that spread along the barrancos; the
// parts added on 2026-10-22 are the OSM beds widened by a varying width. About 26.9 km
// of perimeter in all: see the header for the Valhalla limit this needs.
// ---------------------------------------------------------------------------
const ring = coords => [...coords, coords[0]];

const hazardZones = [
  {
    name: 'DANA Barranco del Poyo',
    hazard_type: 'flood',
    description: 'The Barranco del Poyo overflowed: water at first-floor level from Picanya and Paiporta to Benetússer, Alfafar, La Torre, Massanassa and Catarroja',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        // Paiporta: the barranco crosses the town centre and spills into the side streets
        [ring([
          [-0.42464, 39.42643], [-0.42453, 39.42668], [-0.42409, 39.42699], [-0.42194, 39.42805], [-0.42195, 39.42830], [-0.42262, 39.42973],
          [-0.42256, 39.42991], [-0.42236, 39.43005], [-0.42210, 39.43009], [-0.42182, 39.43000], [-0.42139, 39.42941], [-0.42087, 39.42840],
          [-0.42062, 39.42829], [-0.42012, 39.42830], [-0.41928, 39.42853], [-0.41813, 39.42861], [-0.41589, 39.42822], [-0.41504, 39.42826],
          [-0.41217, 39.42915], [-0.41111, 39.43018], [-0.41090, 39.43018], [-0.41076, 39.43007], [-0.41074, 39.42987], [-0.41055, 39.42963],
          [-0.41027, 39.42957], [-0.40943, 39.42965], [-0.40919, 39.42956], [-0.40905, 39.42938], [-0.40923, 39.42899], [-0.41002, 39.42834],
          [-0.41105, 39.42792], [-0.41189, 39.42772], [-0.41388, 39.42747], [-0.41474, 39.42746], [-0.41556, 39.42757], [-0.41606, 39.42782],
          [-0.41779, 39.42804], [-0.41877, 39.42774], [-0.41990, 39.42752], [-0.42036, 39.42726], [-0.42402, 39.42595], [-0.42433, 39.42600],
          [-0.42456, 39.42617],
        ])],
        // Benetússer and Alfafar: the overflow spreads east along the streets toward the railway
        [ring([
          [-0.39379, 39.42175], [-0.39487, 39.42335], [-0.39653, 39.42338], [-0.39755, 39.42379], [-0.39915, 39.42426], [-0.40015, 39.42471],
          [-0.40046, 39.42504], [-0.40043, 39.42542], [-0.40026, 39.42556], [-0.39973, 39.42568], [-0.39861, 39.42547], [-0.39632, 39.42453],
          [-0.39604, 39.42450], [-0.39423, 39.42389], [-0.39371, 39.42380], [-0.39330, 39.42382], [-0.39173, 39.42425], [-0.39141, 39.42420],
          [-0.39095, 39.42391], [-0.39081, 39.42368], [-0.38793, 39.42231], [-0.38737, 39.42184], [-0.38660, 39.42156], [-0.38634, 39.42117],
          [-0.38658, 39.42078], [-0.38686, 39.42068], [-0.38743, 39.42074], [-0.38793, 39.42096], [-0.38851, 39.42097], [-0.38911, 39.42117],
          [-0.38922, 39.42107], [-0.38910, 39.42081], [-0.38914, 39.42059], [-0.38933, 39.42046], [-0.38957, 39.42045], [-0.38976, 39.42056],
          [-0.39158, 39.42303], [-0.39230, 39.42337], [-0.39366, 39.42327], [-0.39311, 39.42206], [-0.39313, 39.42187], [-0.39330, 39.42172],
          [-0.39355, 39.42167],
        ])],
        // Massanassa: water pooled in the low blocks west of the town centre
        [ring([
          [-0.40567, 39.40750], [-0.40526, 39.40810], [-0.40433, 39.40897], [-0.40357, 39.40901], [-0.40345, 39.40909], [-0.40357, 39.40949],
          [-0.40415, 39.41029], [-0.40404, 39.41050], [-0.40377, 39.41057], [-0.40352, 39.41047], [-0.40304, 39.40988], [-0.40276, 39.40926],
          [-0.40248, 39.40913], [-0.40222, 39.40918], [-0.40183, 39.40947], [-0.40155, 39.40987], [-0.40037, 39.41089], [-0.39894, 39.41112],
          [-0.39838, 39.41112], [-0.39816, 39.41101], [-0.39807, 39.41082], [-0.39816, 39.41063], [-0.39907, 39.41012], [-0.40005, 39.40966],
          [-0.40061, 39.40950], [-0.40105, 39.40923], [-0.40233, 39.40887], [-0.40284, 39.40861], [-0.40345, 39.40813], [-0.40468, 39.40691],
          [-0.40496, 39.40684], [-0.40543, 39.40696], [-0.40568, 39.40728],
        ])],
        // Picanya: the water spills south into the town; the north bank and the CV-36 stay dry
        [ring([
          [-0.44432, 39.43755], [-0.44551, 39.43822], [-0.44593, 39.43828], [-0.44675, 39.43867], [-0.44726, 39.43915], [-0.44799, 39.43921],
          [-0.44929, 39.43998], [-0.44985, 39.43995], [-0.45058, 39.44020], [-0.45078, 39.44057], [-0.45058, 39.44095], [-0.45010, 39.44111],
          [-0.44926, 39.44087], [-0.44841, 39.44090], [-0.44808, 39.44068], [-0.44719, 39.44070], [-0.44553, 39.44009], [-0.44489, 39.43967],
          [-0.44376, 39.43965], [-0.44313, 39.43919], [-0.44205, 39.43885], [-0.44138, 39.43832], [-0.44062, 39.43803], [-0.43920, 39.43794],
          [-0.43885, 39.43772], [-0.43824, 39.43776], [-0.43782, 39.43727], [-0.43824, 39.43678], [-0.43955, 39.43658], [-0.43998, 39.43667],
          [-0.44138, 39.43654], [-0.44180, 39.43661], [-0.44249, 39.43703], [-0.44298, 39.43710], [-0.44355, 39.43752],
        ])],
        // Catarroja: the barranco's last stretch toward the port, over the V-31 (Pista de Silla)
        [ring([
          [-0.39865, 39.40210], [-0.39900, 39.40252], [-0.39913, 39.40300], [-0.39900, 39.40348], [-0.39865, 39.40390], [-0.39821, 39.40412],
          [-0.39846, 39.40463], [-0.39883, 39.40483], [-0.39921, 39.40550], [-0.39991, 39.40621], [-0.40000, 39.40656], [-0.39965, 39.40721],
          [-0.39887, 39.40754], [-0.39798, 39.40721], [-0.39732, 39.40659], [-0.39642, 39.40618], [-0.39607, 39.40564], [-0.39535, 39.40511],
          [-0.39433, 39.40524], [-0.39348, 39.40511], [-0.39299, 39.40485], [-0.39247, 39.40491], [-0.39117, 39.40473], [-0.39073, 39.40451],
          [-0.38966, 39.40443], [-0.38879, 39.40405], [-0.38807, 39.40395], [-0.38643, 39.40315], [-0.38556, 39.40309], [-0.38505, 39.40282],
          [-0.38430, 39.40286], [-0.38271, 39.40260], [-0.38176, 39.40226], [-0.38085, 39.40228], [-0.38013, 39.40194], [-0.37950, 39.40142],
          [-0.37927, 39.40099], [-0.37950, 39.40057], [-0.38005, 39.40039], [-0.38110, 39.40065], [-0.38234, 39.40076], [-0.38325, 39.40048],
          [-0.38392, 39.40063], [-0.38451, 39.40054], [-0.38698, 39.40098], [-0.38776, 39.40083], [-0.38845, 39.40093], [-0.38952, 39.40142],
          [-0.39044, 39.40140], [-0.39149, 39.40166], [-0.39276, 39.40165], [-0.39367, 39.40183], [-0.39433, 39.40176], [-0.39519, 39.40189],
          [-0.39616, 39.40233], [-0.39688, 39.40183], [-0.39750, 39.40173], [-0.39812, 39.40183],
        ])],
        // La Torre (València): the sheet of water that crossed Sedaví, south of the V-30
        [ring([
          [-0.38820, 39.43279], [-0.38861, 39.43424], [-0.39008, 39.43472], [-0.39200, 39.43449], [-0.39375, 39.43350], [-0.39371, 39.43269],
          [-0.39224, 39.43162], [-0.38982, 39.43153], [-0.38909, 39.43164],
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
  {
    name: 'DANA Barranco de la Saleta',
    hazard_type: 'flood',
    description: 'The Barranco de la Saleta overflowed: water through the centres of Aldaia and Alaquàs and on toward Xirivella',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[ring([
        [-0.46945, 39.46351], [-0.46976, 39.46388], [-0.47057, 39.46417], [-0.47108, 39.46493], [-0.47329, 39.46591], [-0.47391, 39.46679],
        [-0.47434, 39.46699], [-0.47457, 39.46726], [-0.47455, 39.46792], [-0.47492, 39.46845], [-0.47496, 39.46890], [-0.47547, 39.46935],
        [-0.47575, 39.46989], [-0.47622, 39.47003], [-0.47663, 39.47046], [-0.47650, 39.47097], [-0.47607, 39.47111], [-0.47551, 39.47082],
        [-0.47521, 39.47087], [-0.47468, 39.47070], [-0.47448, 39.47005], [-0.47407, 39.47002], [-0.47361, 39.46965], [-0.47356, 39.46934],
        [-0.47319, 39.46901], [-0.47291, 39.46820], [-0.47265, 39.46795], [-0.47209, 39.46773], [-0.47185, 39.46745], [-0.47181, 39.46692],
        [-0.47039, 39.46662], [-0.46849, 39.46559], [-0.46772, 39.46552], [-0.46627, 39.46452], [-0.46590, 39.46400], [-0.46479, 39.46352],
        [-0.46452, 39.46320], [-0.46398, 39.46294], [-0.46274, 39.46273], [-0.46195, 39.46279], [-0.46224, 39.46350], [-0.46211, 39.46402],
        [-0.46173, 39.46446], [-0.46117, 39.46475], [-0.46050, 39.46486], [-0.45983, 39.46475], [-0.45927, 39.46446], [-0.45889, 39.46402],
        [-0.45876, 39.46350], [-0.45897, 39.46288], [-0.45828, 39.46299], [-0.45674, 39.46267], [-0.45591, 39.46288], [-0.45514, 39.46270],
        [-0.45472, 39.46277], [-0.45362, 39.46262], [-0.45155, 39.46209], [-0.45044, 39.46141], [-0.44951, 39.46131], [-0.44876, 39.46076],
        [-0.44818, 39.46089], [-0.44771, 39.46082], [-0.44639, 39.46034], [-0.44562, 39.45989], [-0.44506, 39.45983], [-0.44385, 39.45906],
        [-0.44287, 39.45865], [-0.44261, 39.45820], [-0.44217, 39.45802], [-0.44183, 39.45727], [-0.44143, 39.45706], [-0.44120, 39.45657],
        [-0.44071, 39.45621], [-0.44070, 39.45573], [-0.43983, 39.45481], [-0.43946, 39.45466], [-0.43925, 39.45427], [-0.43845, 39.45372],
        [-0.43832, 39.45322], [-0.43864, 39.45297], [-0.43910, 39.45297], [-0.43944, 39.45330], [-0.44025, 39.45362], [-0.44064, 39.45405],
        [-0.44099, 39.45419], [-0.44282, 39.45653], [-0.44335, 39.45681], [-0.44394, 39.45754], [-0.44473, 39.45806], [-0.44581, 39.45841],
        [-0.44631, 39.45873], [-0.44683, 39.45862], [-0.44756, 39.45874], [-0.44946, 39.45934], [-0.45050, 39.45944], [-0.45113, 39.45981],
        [-0.45381, 39.46025], [-0.45435, 39.46057], [-0.45519, 39.46058], [-0.45591, 39.46043], [-0.45653, 39.46053], [-0.45729, 39.46027],
        [-0.45865, 39.46018], [-0.45965, 39.45993], [-0.46091, 39.46026], [-0.46144, 39.46002], [-0.46216, 39.45991], [-0.46317, 39.46018],
        [-0.46399, 39.46006], [-0.46470, 39.46017], [-0.46530, 39.46049], [-0.46598, 39.46136], [-0.46657, 39.46145], [-0.46711, 39.46172],
        [-0.46784, 39.46263],
      ])]],
    },
  },
  {
    name: 'Derrumbe Picanya',
    hazard_type: 'structural_collapse',
    description: 'A house on the barranco bank collapsed when the water undermined it',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[ring([
        [-0.44024, 39.43801], [-0.44034, 39.43820], [-0.44072, 39.43814], [-0.44081, 39.43797], [-0.44064, 39.43780], [-0.44033, 39.43786],
      ])]],
    },
  },
  {
    name: 'Derrumbe Massanassa',
    hazard_type: 'structural_collapse',
    description: 'An old ground-floor house collapsed after hours under water',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[ring([
        [-0.40430, 39.41123], [-0.40449, 39.41140], [-0.40474, 39.41139], [-0.40493, 39.41122], [-0.40480, 39.41104], [-0.40445, 39.41103],
      ])]],
    },
  },
  {
    name: 'Derrumbe Catarroja',
    hazard_type: 'structural_collapse',
    description: 'A house next to the barranco collapsed onto the street',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[ring([
        [-0.39873, 39.40398], [-0.39884, 39.40417], [-0.39915, 39.40415], [-0.39931, 39.40404], [-0.39913, 39.40383], [-0.39885, 39.40377],
      ])]],
    },
  },
];

module.exports = { meta, entities, medicalDetails, hazardZones };
