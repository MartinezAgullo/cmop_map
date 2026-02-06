// routes/schema.js
//
// GET /api/schema
// Returns structured information about CMOP Map's entity types, categories, alliances, etc.
// Used by MCP servers to dynamically discover available entity types.
// ---------------------------------------------------------------------------

const express = require('express');
const router = express.Router();

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------

const SCHEMA = {
  version: '1.0.0',
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

  triage_colors: [
    { value: 'RED', label_en: 'Immediate', label_es: 'Inmediato', description: 'Life-threatening, requires immediate care' },
    { value: 'YELLOW', label_en: 'Delayed', label_es: 'Demorado', description: 'Serious but stable' },
    { value: 'GREEN', label_en: 'Minor', label_es: 'Menor', description: 'Minor injuries, stable' },
    { value: 'BLACK', label_en: 'Expectant / Deceased', label_es: 'Expectante / Fallecido', description: 'Deceased or expectant' },
    { value: 'UNKNOWN', label_en: 'Unknown', label_es: 'Desconocido', description: 'Not yet triaged' }
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
  ]
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
