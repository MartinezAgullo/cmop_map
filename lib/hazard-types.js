// lib/hazard-types.js
//
// The kinds of hazard zone the CMOP knows: one source of truth for the database
// enum (scripts/init-db.js), validation (lib/hazard-zone-geometry.js, routes) and
// the map (served at GET /api/hazard-zones/meta/types; public/js/app.js draws the
// hatching and the legend from it).
//
// `colors` are [main, secondary]: the outline and the first hatch stripe use the
// main colour, the second stripe the secondary one. A type with one colour hatches
// in that colour alone.
// ---------------------------------------------------------------------------

const HAZARD_TYPES = [
  { value: 'fire',                 label_en: 'Fire',                  label_es: 'Incendio',               code: 'FI', colors: ['#FF5500', '#E63946'] },
  { value: 'flood',                label_en: 'Flood',                 label_es: 'Inundación',             code: 'FL', colors: ['#00A8E8', '#1D70B8'] },
  { value: 'chemical',             label_en: 'Chemical',              label_es: 'Químico',                code: 'CH', colors: ['#FF8C00', '#D97706'] },
  { value: 'biological',           label_en: 'Biological',            label_es: 'Biológico',              code: 'BI', colors: ['#10B981', '#00E676'] },
  { value: 'nuclear_radiological', label_en: 'Nuclear/radiological',  label_es: 'Nuclear/radiológico',    code: 'NR', colors: ['#9333EA', '#FACC15'] },
  { value: 'earthquake',           label_en: 'Earthquake',            label_es: 'Terremoto',              code: 'EQ', colors: ['#A52A2A', '#B45309'] },
  { value: 'structural_collapse',  label_en: 'Structural collapse',   label_es: 'Colapso estructural',    code: 'SC', colors: ['#64748B'] },
  { value: 'sinkhole',             label_en: 'Sinkhole',              label_es: 'Socavón',                code: 'SH', colors: ['#334155'] },
];

const HAZARD_TYPE_VALUES = HAZARD_TYPES.map(t => t.value);

module.exports = { HAZARD_TYPES, HAZARD_TYPE_VALUES };
