// routes/schema.js
//
// GET /api/schema
// Returns structured information about CMOP Map's entity types, categories,
// alliances, triage colours, 9-LINE MEDEVAC structure, etc.
// Used by MCP servers to dynamically discover available entity types and
// understand the data model for creating/updating entities.
// ---------------------------------------------------------------------------

const express = require('express');
const router = express.Router();

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------

const SCHEMA = {
  version: '1.1.0',
  categories: [
    // Military
    { value: 'missile', label_en: 'Missile', label_es: 'Misil', subtypes: [] },
    { value: 'fighter', label_en: 'Fighter', label_es: 'Caza', subtypes: [] },
    { value: 'bomber', label_en: 'Bomber', label_es: 'Bombardero', subtypes: [] },
    { value: 'aircraft', label_en: 'Aircraft', label_es: 'Aeronave', subtypes: [] },
    { value: 'helicopter', label_en: 'Helicopter', label_es: 'Helicóptero', subtypes: [] },
    { value: 'uav', label_en: 'UAV', label_es: 'UAV / Drone', subtypes: [] },
    { value: 'armoured', label_en: 'Armoured / Tank', label_es: 'Carro de Combate / Blindado', subtypes: [] },
    { value: 'artillery', label_en: 'Artillery', label_es: 'Artillería', subtypes: [] },
    { value: 'ship', label_en: 'Ship', label_es: 'Buque', subtypes: [] },
    { value: 'destroyer', label_en: 'Destroyer', label_es: 'Destructor', subtypes: [] },
    { value: 'submarine', label_en: 'Submarine', label_es: 'Submarino', subtypes: [] },
    { value: 'ground_vehicle', label_en: 'Ground Vehicle', label_es: 'Vehículo Terrestre', subtypes: [] },
    {
      value: 'infantry',
      label_en: 'Infantry',
      label_es: 'Infantería',
      subtypes: [
        { value: 'standard', label_en: 'Infantry (Standard)', label_es: 'Infantería' },
        { value: 'light', label_en: 'Light Infantry', label_es: 'Infantería Ligera' },
        { value: 'motorised', label_en: 'Motorised Infantry', label_es: 'Infantería Motorizada' },
        { value: 'mechanised', label_en: 'Mechanised Infantry', label_es: 'Infantería Mecanizada' },
        { value: 'mechanised_wheeled', label_en: 'Mechanised Infantry Wheeled (APC)', label_es: 'Infantería Mecanizada con Ruedas' },
        { value: 'armoured', label_en: 'Armoured Infantry', label_es: 'Infantería Blindada' },
        { value: 'lav', label_en: 'Light Armoured Vehicle Infantry', label_es: 'Vehículos de Combate de Infantería a Ruedas' },
        { value: 'unarmed_transport', label_en: 'Unarmed Transport', label_es: 'Transporte Sin Armas' },
        { value: 'uav', label_en: 'UAV Infantry', label_es: 'Infantería con UAV' }
      ]
    },
    {
      value: 'reconnaissance',
      label_en: 'Reconnaissance',
      label_es: 'Reconocimiento / Caballería',
      aliases: ['cavalry', 'caballería'],
      subtypes: [
        { value: 'standard', label_en: 'Reconnaissance (Standard)', label_es: 'Reconocimiento' },
        { value: 'mechanised', label_en: 'Mechanised Reconnaissance', label_es: 'Reconocimiento Mecanizado' },
        { value: 'wheeled', label_en: 'Wheeled Reconnaissance', label_es: 'Reconocimiento con Ruedas' }
      ]
    },
    {
      value: 'engineer',
      label_en: 'Engineer',
      label_es: 'Ingenieros',
      subtypes: [
        { value: 'standard', label_en: 'Engineer', label_es: 'Ingenieros' },
        { value: 'armoured', label_en: 'Engineer Armoured', label_es: 'Ingenieros Blindados' }
      ]
    },
    {
      value: 'mortar',
      label_en: 'Mortar',
      label_es: 'Mortero',
      subtypes: [
        { value: 'heavy', label_en: 'Heavy Mortar', label_es: 'Mortero Pesado' },
        { value: 'medium', label_en: 'Medium Mortar', label_es: 'Mortero Medio' },
        { value: 'light', label_en: 'Light Mortar', label_es: 'Mortero Ligero' },
        { value: 'unknown', label_en: 'Mortar (Unknown Type)', label_es: 'Mortero (Tipo Desconocido)' }
      ]
    },
    { value: 'person', label_en: 'Person', label_es: 'Persona', subtypes: [] },
    { value: 'base', label_en: 'Base', label_es: 'Base', subtypes: [] },
    { value: 'building', label_en: 'Building', label_es: 'Edificio', subtypes: [] },
    { value: 'infrastructure', label_en: 'Infrastructure', label_es: 'Infraestructura', subtypes: [] },

    // Medical & MEDEVAC
    {
      value: 'medical_facility',
      label_en: 'Medical Facility',
      label_es: 'Instalación Médica',
      subtypes: [
        { value: 'medical_role_1', label_en: 'Role 1 — Aid Post', label_es: 'Role 1 — Puesto de Socorro' },
        { value: 'medical_role_2', label_en: 'Role 2 — Surgical', label_es: 'Role 2 — Quirúrgico' },
        { value: 'medical_role_3', label_en: 'Role 3 — Field Hospital', label_es: 'Role 3 — Hospital de Campaña' },
        { value: 'medical_role_4', label_en: 'Role 4 — Definitive Care', label_es: 'Role 4 — Atención Definitiva' },
        { value: 'medical_role_2basic', label_en: 'Role 2 Basic', label_es: 'Role 2 Básico' },
        { value: 'medical_role_2enhanced', label_en: 'Role 2 Enhanced', label_es: 'Role 2 Mejorado' },
        { value: 'medical_facility_multinational', label_en: 'Multinational Facility', label_es: 'Instalación Multinacional' }
      ]
    },
    {
      value: 'medevac_unit',
      label_en: 'MEDEVAC Unit',
      label_es: 'Unidad MEDEVAC',
      subtypes: [
        { value: 'medevac_role_1', label_en: 'MEDEVAC Role 1 — Immediate Care', label_es: 'MEDEVAC Role 1 — Atención Inmediata' },
        { value: 'medevac_role_2', label_en: 'MEDEVAC Role 2 — Forward Resuscitative', label_es: 'MEDEVAC Role 2 — Resucitación Adelantada' },
        { value: 'medevac_role_3', label_en: 'MEDEVAC Role 3 — Theater Hospitalization', label_es: 'MEDEVAC Role 3 — Hospitalización de Teatro' },
        { value: 'medevac_role_4', label_en: 'MEDEVAC Role 4 — Definitive/Rehab', label_es: 'MEDEVAC Role 4 — Definitiva/Rehabilitación' },
        { value: 'medevac_fixedwing', label_en: 'Fixed-Wing MEDEVAC', label_es: 'MEDEVAC Ala Fija' },
        { value: 'medevac_ambulance', label_en: 'Ambulance', label_es: 'Ambulancia' },
        { value: 'medevac_mechanised', label_en: 'Mechanised MEDEVAC', label_es: 'MEDEVAC Mecanizado' },
        { value: 'medevac_mortuary', label_en: 'Mortuary Affairs', label_es: 'Asuntos Mortuorios' }
      ]
    },

    // Casualties
    {
      value: 'casualty',
      label_en: 'Casualty',
      label_es: 'Baja',
      subtypes: [],
      note: 'Use alliance field for friendly/hostile/neutral/civilian. Use medical_details.casualty_status for WIA/KIA.'
    },

    { value: 'default', label_en: 'Default', label_es: 'Por Defecto', subtypes: [] }
  ],

  alliances: [
    { value: 'friendly', label_en: 'Friendly', label_es: 'Aliado' },
    { value: 'hostile', label_en: 'Hostile', label_es: 'Hostil' },
    { value: 'neutral', label_en: 'Neutral', label_es: 'Neutral' },
    { value: 'unknown', label_en: 'Unknown', label_es: 'Desconocido' }
  ],

  // -------------------------------------------------------------------------
  // Triage colours — multinational STANAG colour coding
  // Reference: NATO AJMedP-7 / STANAG 2879
  // -------------------------------------------------------------------------
  triage_colors: [
    {
      value: 'RED',
      label_en: 'T1 — Immediate',
      label_es: 'T1 — Inmediato',
      description: 'Life-threatening injuries requiring immediate life-saving interventions. May be converted to T2 with appropriate temporary intervention(s).'
    },
    {
      value: 'YELLOW',
      label_en: 'T2 — Urgent',
      label_es: 'T2 — Urgente',
      description: 'Needs stabilizing treatment, but general condition permits delay in surgical or other special treatment without unduly endangering life.'
    },
    {
      value: 'GREEN',
      label_en: 'T3 — Minimal',
      label_es: 'T3 — Mínimo',
      description: 'Relatively minor injuries. Can effectively care for themselves or be helped by first-aid trained personnel.'
    },
    {
      value: 'BLUE',
      label_en: 'T4 — Expectant',
      label_es: 'T4 — Expectante',
      description: 'Expected to die given the circumstances of the Major Incident/MASCAL. Receives appropriate supportive treatment and palliative care.'
    },
    {
      value: 'BLACK',
      label_en: 'Dead',
      label_es: 'Fallecido',
      description: 'Declared dead by a medical professional, or non-survivable injuries with no vital signs.'
    },
    {
      value: 'UNKNOWN',
      label_en: 'Unknown',
      label_es: 'Desconocido',
      description: 'Not yet triaged.'
    }
  ],

  casualty_status: [
    { value: 'WIA', label_en: 'Wounded In Action', label_es: 'Herido en Acción' },
    { value: 'KIA', label_en: 'Killed In Action', label_es: 'Muerto en Acción' },
    { value: 'UNKNOWN', label_en: 'Unknown', label_es: 'Desconocido' }
  ],

  evac_priority: [
    { value: 'URGENT', label_en: 'Urgent', label_es: 'Urgente', description: 'Life-threatening, needs care within 1h' },
    { value: 'PRIORITY', label_en: 'Priority', label_es: 'Prioritario', description: 'Serious but stable, within 4h' },
    { value: 'ROUTINE', label_en: 'Routine', label_es: 'Rutinario', description: 'Stable, within 24h' },
    { value: 'UNKNOWN', label_en: 'Unknown', label_es: 'Desconocido' }
  ],

  evac_stage: [
    { value: 'at_poi', label_en: 'At Point of Injury', label_es: 'En el Punto de Lesión' },
    { value: 'in_transit', label_en: 'In Transit', label_es: 'En Tránsito' },
    { value: 'delivered', label_en: 'Delivered', label_es: 'Entregado' },
    { value: 'unknown', label_en: 'Unknown', label_es: 'Desconocido' }
  ],

  // -------------------------------------------------------------------------
  // 9-Line MEDEVAC Request — structured JSONB stored in
  // medical_details.nine_line_data
  //
  // Based on NATO STANAG 9-LINE MEDEVAC Request format.
  // Agents should populate these fields when creating or updating a
  // casualty's medical record via PUT /api/medical/:entity_id or
  // POST /api/medical/:entity_id/nine-line
  // -------------------------------------------------------------------------
  nine_line_medevac: {
    description: '9-Line MEDEVAC Request — NATO standard format for requesting medical evacuation. Stored as JSONB in medical_details.nine_line_data.',
    fields: [
      {
        key: 'line1_location',
        line: 1,
        title: 'Location',
        type: 'string',
        description: 'Grid coordinates of the pickup site (e.g. "38TQK 1234 5678" or "47.091,37.568").',
        required: true
      },
      {
        key: 'line2_callsign',
        line: 2,
        title: 'Call Sign',
        type: 'string',
        description: 'Radio call sign of the unit at the pickup site (e.g. "DUSTOFF 7-2").',
        required: true
      },
      {
        key: 'line2_frequency',
        line: 2,
        title: 'Frequency',
        type: 'string',
        description: 'Radio frequency for contact (e.g. "243.0 MHz").',
        required: true
      },
      {
        key: 'line3_precedence',
        line: 3,
        title: 'Precedence',
        type: 'string',
        description: 'Number of patients sorted by precedence.',
        required: true,
        enum_values: {
          'A': 'URGENT — within 2 hours',
          'B': 'URGENT SURGICAL — within 2 hours',
          'C': 'PRIORITY — within 4 hours',
          'D': 'ROUTINE — within 24 hours'
        }
      },
      {
        key: 'line3_count',
        line: 3,
        title: 'Patient Count',
        type: 'number',
        description: 'Number of patients at the stated precedence level.',
        required: true
      },
      {
        key: 'line4_special_eqpt',
        line: 4,
        title: 'Special Equipment',
        type: 'string',
        description: 'Special equipment required at the pickup site.',
        required: true,
        enum_values: {
          'A': 'None',
          'B': 'Hoist',
          'C': 'Extraction equipment',
          'D': 'Ventilator'
        }
      },
      {
        key: 'line5_litter',
        line: 5,
        title: 'Litter Patients',
        type: 'number',
        description: 'Number of patients requiring litter (stretcher) transport.',
        required: true
      },
      {
        key: 'line5_ambulatory',
        line: 5,
        title: 'Ambulatory Patients',
        type: 'number',
        description: 'Number of patients who can walk.',
        required: true
      },
      {
        key: 'line6_security',
        line: 6,
        title: 'Security of Pickup Site (Wartime)',
        type: 'string',
        description: 'Threat level at the pickup zone.',
        required: false,
        enum_values: {
          'N': 'No enemy troops in area',
          'P': 'Possible enemy troops in area',
          'E': 'Enemy troops in area — proceed with caution',
          'X': 'Enemy troops in area — armed escort required'
        }
      },
      {
        key: 'line6_peacetime_info',
        line: 6,
        title: 'Peacetime Info',
        type: 'string',
        description: 'Peacetime alternative: number and type of wounded (free text). Used instead of line6_security in peacetime operations.',
        required: false
      },
      {
        key: 'line7_marking',
        line: 7,
        title: 'Method of Marking Pickup Site',
        type: 'string',
        description: 'How the pilot will identify the pickup site.',
        required: true,
        enum_values: {
          'A': 'Panels (specify colour in line7_marking_detail)',
          'B': 'Pyrotechnic signal',
          'C': 'Smoke signal',
          'D': 'None',
          'E': 'Other (describe in line7_marking_detail)'
        }
      },
      {
        key: 'line7_marking_detail',
        line: 7,
        title: 'Marking Detail',
        type: 'string',
        description: 'Colour or description of the marking method (e.g. "green smoke", "orange VS-17 panel").',
        required: false
      },
      {
        key: 'line8_nationality',
        line: 8,
        title: 'Patient Nationality and Status',
        type: 'string',
        description: 'Nationality and military/civilian status of the patient(s).',
        required: true,
        enum_values: {
          'A': 'US Military',
          'B': 'US Civilian',
          'C': 'Non-US Military',
          'D': 'Non-US Civilian',
          'E': 'Enemy Prisoner of War (EPW)'
        }
      },
      {
        key: 'line9_nbc',
        line: 9,
        title: 'NBC Contamination (Wartime)',
        type: 'string',
        description: 'Nuclear, Biological, or Chemical contamination at the site.',
        required: false,
        enum_values: {
          'N': 'Nuclear',
          'B': 'Biological',
          'C': 'Chemical'
        }
      },
      {
        key: 'line9_terrain_desc',
        line: 9,
        title: 'Terrain Description (Peacetime)',
        type: 'string',
        description: 'Peacetime alternative: terrain and landing zone description (free text).',
        required: false
      },
      {
        key: 'remarks',
        line: null,
        title: 'Remarks',
        type: 'string',
        description: 'Additional free-text remarks or notes about the MEDEVAC request.',
        required: false
      }
    ],
    example: {
      line1_location:       '38TQK 1234 5678',
      line2_callsign:       'DUSTOFF 7-2',
      line2_frequency:      '243.0 MHz',
      line3_precedence:     'A',
      line3_count:          1,
      line4_special_eqpt:   'A',
      line5_litter:         1,
      line5_ambulatory:     0,
      line6_security:       'N',
      line6_peacetime_info: null,
      line7_marking:        'C',
      line7_marking_detail: 'green smoke',
      line8_nationality:    'C',
      line9_nbc:            null,
      line9_terrain_desc:   null,
      remarks:              'Requires immediate surgery. Ground route compromised.'
    }
  }
};

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: SCHEMA
  });
});

module.exports = router;
