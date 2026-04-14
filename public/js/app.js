// public/js/app.js
// ---------------------------------------------------------------------------
// CMOP Map — frontend logic
//
// Responsibilities:
//   - Scenario loading via /api/scenarios
//   - Entity fetching, filtering, rendering (list + map markers)
//   - Icon resolution (APP-6 + medical, with country-variant fallback)
//   - Popup & list rendering with medical data when present
//   - Multi-select category filtering with subfilters
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let map;
let tileLayer        = null;
let markers          = [];
let markersById      = {};     // { entityId: L.Marker } — for surgical position updates
let allEntities      = [];
let filteredEntities = [];
let selectedId       = null;
let routeLayer       = null;   // L.LayerGroup for MEDEVAC route polylines
let threatCirclesLayer = null; // L.LayerGroup for threat risk-area circles
let threatRadiusM    = 500;    // populated from /api/config at startup
let _currentTaskId  = null;   // last successfully loaded task ID (for refresh)
let _simState       = 'idle'; // 'idle' | 'running' | 'paused'

// One color per vehicle slot (up to 6 simultaneous routes)
// Dark-mode palette: vivid mid-tones that pop on a dark tile layer
const ROUTE_COLORS_DARK  = ['#e67e22', '#2ecc71', '#9b59b6', '#1abc9c', '#e74c3c', '#f1c40f'];
// Light-mode palette: darker shades of the same hues for contrast on a light tile layer
const ROUTE_COLORS_LIGHT = ['#b94600', '#1a7a43', '#6c3483', '#0e6655', '#922b21', '#b7770d'];

function getRouteColors() {
  return document.body.classList.contains('dark') ? ROUTE_COLORS_DARK : ROUTE_COLORS_LIGHT;
}

// Keep ROUTE_COLORS as an alias used by the legend builder
const ROUTE_COLORS = ROUTE_COLORS_DARK;

// ---------------------------------------------------------------------------
// Icon resolution — category → candidate base filenames
// ---------------------------------------------------------------------------
const CATEGORY_BASE_NAMES = {
  // Military
  missile:        ['missile'],
  fighter:        ['fighter', 'fixed_wing'],
  bomber:         ['bomber', 'fixed_wing'],
  aircraft:       ['fixed_wing', 'air_and_space'],
  helicopter:     ['helicopter', 'rotary_wing'],
  uav:            ['uav'],
  ugv:            ['ugv'],
  transportation: ['transportation'],
  armoured:       ['armoured', 'tank', 'armor_mechanized', 'ground'],
  artillery:      ['artillery'],
  ship:           ['ship', 'sea_surface'],
  destroyer:      ['destroyer', 'ship'],
  submarine:      ['submarine', 'sub_surface'],
  ground_vehicle: ['ground', 'armor_mechanized'],
  infantry:       ['infantry', 'ground'],
  reconnaissance: ['reconnaissance', 'ground'],
  engineer:       ['engineer', 'ground'],
  mortar:         ['mortar', 'artillery'],
  person:         ['person'],
  base:           ['base', 'headquarters'],
  building:       ['infrastructure'],
  infrastructure: ['infrastructure'],

  // Medical
  medical_facility: ['medical_facility', 'medical_facility_default'],
  medevac_unit:     ['medevac', 'medevac_default'],
  casualty:         ['casualty'],

  default: ['default']
};

const ALLIANCE_COLORS = {
  friendly: '#00AEEF',
  hostile:  '#FF0000',
  neutral:  '#ADFF2F',
  unknown:  '#A9A9A9'
};

// Medical facility "Other" tipo_elemento values
const MED_FACILITY_OTHER = [
  'medical_role_2basic',
  'medical_role_2enhanced',
  'medical_facility_multinational'
];

// MEDEVAC "Other" tipo_elemento values
const MEDEVAC_OTHER = [
  'medevac_fixedwing',
  'medevac_ambulance',
  'medevac_mechanised',
  'medevac_mortuary'
];

// ---------------------------------------------------------------------------
// Icon cache & resolution helpers
// ---------------------------------------------------------------------------
const iconCache = new Map();

const COUNTRY_ALIASES = {
  north_korea:        'pkr',
  corea_del_norte:    'pkr',
  korea_del_norte:    'pkr',
  dprk:               'pkr',
  south_korea:        'pok',
  corea_del_sur:      'pok',
  korea_del_sur:      'pok',
  republic_of_korea:  'pok',
  rok:                'pok',
};

function normalizeCountry(country) {
  if (!country) return '';
  const normalized = country
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  return COUNTRY_ALIASES[normalized] ?? normalized;
}

function buildFilenameCandidates(category, country, entity) {
  let bases = CATEGORY_BASE_NAMES[category?.toLowerCase()] || CATEGORY_BASE_NAMES.default;

  // Casualties: WIA/KIA-specific icons
  if (category === 'casualty' && entity?.medical?.casualty_status) {
    const status = entity.medical.casualty_status.toLowerCase();
    if (status === 'wia') {
      bases = ['casualty_wia', 'casualty'];
    } else if (status === 'kia') {
      bases = ['casualty_kia', 'casualty'];
    }
  }

  // Medical facility / medevac: use tipo_elemento for icon
  if ((category === 'medical_facility' || category === 'medevac_unit') && entity?.tipo_elemento) {
    let tipo = entity.tipo_elemento.toLowerCase().replace(/\s+/g, '_');
    if (category === 'medical_facility' && tipo.startsWith('medical_role_')) {
      tipo = tipo.replace('medical_role_', 'medical_facility_role_');
    }
    bases = [tipo, ...bases];
  }

  // UAV: use fixedwing / rotarywing subtype when present
  if (category === 'uav' && entity?.tipo_elemento) {
    const tipo = entity.tipo_elemento.toLowerCase();
    if (tipo === 'fixedwing' || tipo === 'rotarywing') {
      bases = [`uav_${tipo}`, 'uav'];
    }
  }

  // Transportation: supply subtype
  if (category === 'transportation' && entity?.tipo_elemento) {
    if (entity.tipo_elemento.toLowerCase() === 'supply') {
      bases = ['transportation_supply', 'transportation'];
    }
  }

  // Infantry, reconnaissance, engineer, mortar: use tipo_elemento
  if (['infantry', 'reconnaissance', 'engineer', 'mortar'].includes(category) && entity?.tipo_elemento) {
    const tipo = entity.tipo_elemento.toLowerCase().replace(/\s+/g, '_');
    if (category === 'infantry') {
      bases = tipo === 'standard'
        ? ['infantry', ...bases]
        : [`infantry_${tipo}`, 'infantry', ...bases];
    } else if (category === 'reconnaissance') {
      bases = ['reconnaissance', ...bases];
    } else if (category === 'engineer') {
      bases = tipo === 'armoured'
        ? ['engineer_armoured', 'engineer', ...bases]
        : ['engineer', ...bases];
    } else if (category === 'mortar') {
      bases = ['mortar', ...bases];
    } else {
      bases = [tipo, ...bases];
    }
  }

  const cn         = normalizeCountry(country);
  const tryCountry = country && country.toLowerCase() !== 'unknown' && cn;

  const candidates = [];
  for (const base of bases) {
    if (tryCountry) candidates.push(`${base}_${cn}.svg`);
    candidates.push(`${base}.svg`);
  }
  candidates.push('default.svg');
  return candidates;
}

async function urlExists(url) {
  try {
    return (await fetch(url, { method: 'HEAD' })).ok;
  } catch {
    return false;
  }
}

async function resolveIconUrl(category, alliance, country, entity) {
  const a      = (alliance || 'unknown').toLowerCase();
  const c      = (category || 'default').toLowerCase();
  const status = entity?.medical?.casualty_status || '';
  const tipo   = entity?.tipo_elemento || '';
  const key    = `${a}|${c}|${normalizeCountry(country)}|${tipo}|${status}`;

  if (iconCache.has(key)) return iconCache.get(key);

  for (const filename of buildFilenameCandidates(c, country, entity)) {
    const url = `/icons/${a}/${filename}`;
    if (await urlExists(url)) {
      iconCache.set(key, url);
      return url;
    }
  }

  const fallback = `/icons/${a}/default.svg`;
  iconCache.set(key, fallback);
  return fallback;
}

async function makeIcon(entity) {
  return L.icon({
    iconUrl:     await resolveIconUrl(entity.categoria, entity.alliance, entity.country, entity),
    iconSize:    [36, 36],
    iconAnchor:  [18, 36],
    popupAnchor: [0, -28]
  });
}

// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------
function initTheme() {
  const btn = document.getElementById('themeToggle');
  if (localStorage.getItem('cmop-theme') === 'dark') {
    document.body.classList.add('dark');
    btn.textContent = '☀️';
  }
  btn.addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark');
    btn.textContent = dark ? '☀️' : '🌙';
    localStorage.setItem('cmop-theme', dark ? 'dark' : 'light');
    setTileLayer(dark ? 'dark' : 'light');
    if (_currentTaskId) loadMedevacRoutes(_currentTaskId);
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    if (cfg.threatRadiusM) threatRadiusM = cfg.threatRadiusM;
  } catch (_) { /* keep default */ }

  initMap();
  initScenarios();
  loadEntities();
  setupEventListeners();
  initTheme();
  initSSE();
});

const TILE_LAYERS = {
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors'
  },
  dark: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors'
  }
};

function setTileLayer(theme) {
  if (tileLayer) map.removeLayer(tileLayer);
  const cfg = TILE_LAYERS[theme];
  tileLayer = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19 });
  tileLayer.addTo(map);
}

function initMap() {
  map = L.map('map').setView([39.47, -0.38], 12);
  setTileLayer(document.body.classList.contains('dark') ? 'dark' : 'light');

  routeLayer = L.layerGroup().addTo(map);
  threatCirclesLayer = L.layerGroup().addTo(map);

  // Real-time coordinate display
  const coordsEl = document.getElementById('map-coords');
  map.on('mousemove', (e) => {
    coordsEl.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
  });
  map.on('mouseout', () => { coordsEl.textContent = ''; });

  // Left-click: fill form if open, otherwise show context menu
  const ctxMenu   = document.getElementById('map-ctx-menu');
  const ctxAddBtn = document.getElementById('map-ctx-add');
  let   _ctxLatLng = null;

  function _hideCtxMenu() { ctxMenu.style.display = 'none'; }

  map.on('click', (e) => {
    const formOpen = document.getElementById('formModal').classList.contains('show');
    if (formOpen) {
      document.getElementById('latitud').value  = e.latlng.lat.toFixed(6);
      document.getElementById('longitud').value = e.latlng.lng.toFixed(6);
      _hideCtxMenu();
      return;
    }
    // Position the context menu at the click point
    _ctxLatLng = e.latlng;
    const containerPoint = map.latLngToContainerPoint(e.latlng);
    ctxMenu.style.left    = `${containerPoint.x + 4}px`;
    ctxMenu.style.top     = `${containerPoint.y + 4}px`;
    ctxMenu.style.display = 'block';
  });

  ctxAddBtn.addEventListener('click', () => {
    _hideCtxMenu();
    if (!_ctxLatLng) return;
    mostrarFormularioNuevoPunto();
    document.getElementById('latitud').value  = _ctxLatLng.lat.toFixed(6);
    document.getElementById('longitud').value = _ctxLatLng.lng.toFixed(6);
  });

  // Dismiss context menu on drag, zoom, or Escape
  map.on('movestart', _hideCtxMenu);
  map.on('zoomstart', _hideCtxMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _hideCtxMenu(); });
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------
function setupEventListeners() {
  // Collapsible filter sections
  document.querySelectorAll('.filter-section-header').forEach(header => {
    header.addEventListener('click', (e) => {
      // Don't toggle when clicking "Limpiar" button
      if (e.target.classList.contains('btn-clear')) return;
      const targetId = header.dataset.toggle;
      if (!targetId) return;
      const body = document.getElementById(targetId);
      body.classList.toggle('collapsed');
      header.querySelector('.chevron')?.classList.toggle('collapsed');
    });
  });

  // Category checkboxes → filter + toggle subfilters
  document.querySelectorAll('#categoryCheckboxes input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleSubfilters();
      filterEntities();
    });
  });

  document.getElementById('casevacFilter').addEventListener('change', filterEntities);

  // Triage subfilter checkboxes
  document.querySelectorAll('#triageCheckboxes input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', filterEntities);
  });

  // Medical facility subfilter checkboxes
  document.querySelectorAll('#medFacilityCheckboxes input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', filterEntities);
  });

  // MEDEVAC subfilter checkboxes
  document.querySelectorAll('#medevacCheckboxes input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', filterEntities);
  });

  // Alliance checkboxes
  document.querySelectorAll('#allianceCheckboxes input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', filterEntities);
  });

  // Name search
  document.getElementById('buscarNombre').addEventListener('input', filterEntities);

  // Clear buttons
  document.getElementById('clearCategories').addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('#categoryCheckboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('casevacFilter').checked = false;
    clearSubfilter('triageCheckboxes');
    clearSubfilter('medFacilityCheckboxes');
    clearSubfilter('medevacCheckboxes');
    toggleSubfilters();
    filterEntities();
  });

  document.getElementById('clearTriageFilter').addEventListener('click', (e) => {
    e.stopPropagation();
    clearSubfilter('triageCheckboxes');
    filterEntities();
  });

  document.getElementById('clearMedFacilityFilter').addEventListener('click', (e) => {
    e.stopPropagation();
    clearSubfilter('medFacilityCheckboxes');
    filterEntities();
  });

  document.getElementById('clearMedevacFilter').addEventListener('click', (e) => {
    e.stopPropagation();
    clearSubfilter('medevacCheckboxes');
    filterEntities();
  });

  document.getElementById('clearAlliance').addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('#allianceCheckboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
    filterEntities();
  });

  // Create entity form
  document.getElementById('nuevoPuntoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await crearNuevaEntidad();
  });

  document.getElementById('loadScenarioBtn').addEventListener('click', loadSelectedScenario);

  // MEDEVAC Routes panel
  document.getElementById('loadRoutesBtn').addEventListener('click', () => {
    const taskId = document.getElementById('routeTaskId').value.trim();
    if (!taskId) {
      document.getElementById('routesStatus').innerHTML = '<span class="routes-warn">Introduce un Task ID.</span>';
      return;
    }
    loadMedevacRoutes(taskId);
  });
  document.getElementById('clearRoutesBtn').addEventListener('click', clearRoutes);
  document.getElementById('refreshRoutesBtn').addEventListener('click', () => {
    if (_currentTaskId) loadMedevacRoutes(_currentTaskId);
  });
  document.getElementById('routeTaskId').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const taskId = e.target.value.trim();
      if (taskId) loadMedevacRoutes(taskId);
    }
  });

  // Dynamic tipo_elemento dropdown in modal
  document.getElementById('categoria').addEventListener('change', (e) => {
    updateTipoElementoOptions(e.target.value);
  });

  // Casualty status — toggle triage fields when KIA is selected
  document.getElementById('casualtyStatus').addEventListener('change', _updateCasualtyStatusUI);
}

function clearSubfilter(containerId) {
  document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach(cb => cb.checked = false);
}

// ---------------------------------------------------------------------------
// Subfilter visibility toggling
// ---------------------------------------------------------------------------
function toggleSubfilters() {
  const checkedCategories = getCheckedValues('categoryCheckboxes');

  document.getElementById('subfilterCasualty').style.display =
    checkedCategories.includes('casualty') ? 'block' : 'none';

  document.getElementById('subfilterMedFacility').style.display =
    checkedCategories.includes('medical_facility') ? 'block' : 'none';

  document.getElementById('subfilterMedevac').style.display =
    checkedCategories.includes('medevac_unit') ? 'block' : 'none';

  // Clear subfilter selections when parent category is unchecked
  if (!checkedCategories.includes('casualty'))        clearSubfilter('triageCheckboxes');
  if (!checkedCategories.includes('medical_facility')) clearSubfilter('medFacilityCheckboxes');
  if (!checkedCategories.includes('medevac_unit'))     clearSubfilter('medevacCheckboxes');
}

// ---------------------------------------------------------------------------
// Checkbox helpers
// ---------------------------------------------------------------------------
function getCheckedValues(containerId) {
  return [...document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`)]
    .map(cb => cb.value);
}

// ---------------------------------------------------------------------------
// Tipo Elemento options (modal)
// ---------------------------------------------------------------------------
const TIPO_ELEMENTO_OPTIONS = {
  infantry: [
    { value: 'standard', label: 'Infantry (Standard) — Infantería' },
    { value: 'light', label: 'Light Infantry — Infantería Ligera' },
    { value: 'motorised', label: 'Motorised Infantry — Infantería Motorizada' },
    { value: 'mechanised', label: 'Mechanised Infantry — Infantería Mecanizada' },
    { value: 'mechanised_wheeled', label: 'Mechanised Infantry Wheeled (APC) — Infantería Mecanizada con Ruedas' },
    { value: 'armoured', label: 'Armoured Infantry — Infantería Blindada' },
    { value: 'lav', label: 'Light Armoured Vehicle Infantry — Vehículos de Combate de Infantería a Ruedas' },
    { value: 'unarmed_transport', label: 'Unarmed Transport — Transporte Sin Armas' },
    { value: 'uav', label: 'UAV Infantry — Infantería con UAV' }
  ],
  reconnaissance: [
    { value: 'standard', label: 'Reconnaissance (Standard) — Reconocimiento' },
    { value: 'mechanised', label: 'Mechanised Reconnaissance — Reconocimiento Mecanizado' },
    { value: 'wheeled', label: 'Wheeled Reconnaissance — Reconocimiento con Ruedas' }
  ],
  engineer: [
    { value: 'standard', label: 'Engineer — Ingenieros' },
    { value: 'armoured', label: 'Engineer Armoured — Ingenieros Blindados' }
  ],
  mortar: [
    { value: 'heavy', label: 'Heavy Mortar — Mortero Pesado' },
    { value: 'medium', label: 'Medium Mortar — Mortero Medio' },
    { value: 'light', label: 'Light Mortar — Mortero Ligero' },
    { value: 'unknown', label: 'Mortar (Unknown Type) — Mortero (Tipo Desconocido)' }
  ],
  medical_facility: [
    { value: 'medical_role_1', label: 'Role 1 — Aid Post' },
    { value: 'medical_role_2', label: 'Role 2 — Surgical' },
    { value: 'medical_role_3', label: 'Role 3 — Field Hospital' },
    { value: 'medical_role_4', label: 'Role 4 — Definitive Care' },
    { value: 'medical_role_2basic', label: 'Role 2 Basic' },
    { value: 'medical_role_2enhanced', label: 'Role 2 Enhanced' },
    { value: 'medical_facility_multinational', label: 'Multinational Facility' }
  ],
  medevac_unit: [
    { value: 'medevac_role_1', label: 'MEDEVAC Role 1 — Immediate Care' },
    { value: 'medevac_role_2', label: 'MEDEVAC Role 2 — Forward Resuscitative' },
    { value: 'medevac_role_3', label: 'MEDEVAC Role 3 — Theater Hospitalization' },
    { value: 'medevac_role_4', label: 'MEDEVAC Role 4 — Definitive/Rehab' },
    { value: 'medevac_fixedwing', label: 'Fixed-Wing MEDEVAC' },
    { value: 'medevac_ambulance', label: 'Ambulance' },
    { value: 'medevac_mechanised', label: 'Mechanised MEDEVAC' },
    { value: 'medevac_mortuary', label: 'Mortuary Affairs' }
  ],
  uav: [
    { value: 'fixedwing',   label: 'Fixed-Wing UAV — UAV Ala Fija' },
    { value: 'rotarywing',  label: 'Rotary-Wing UAV — UAV Ala Rotatoria' }
  ],
  transportation: [
    { value: 'supply', label: 'Supply Transport — Transporte de Suministros' }
  ]
};

const MOBILITY_CATEGORIES = ['medevac_unit', 'transportation', 'reconnaissance'];

const CASEVAC_ELIGIBLE_CATEGORIES = [
  'transportation', 'reconnaissance', 'helicopter', 'ground_vehicle', 'armoured', 'ugv'
];

function updateTipoElementoOptions(categoria) {
  const group  = document.getElementById('tipoElementoGroup');
  const select = document.getElementById('tipoElemento');

  if (!TIPO_ELEMENTO_OPTIONS[categoria]) {
    group.style.display = 'none';
    select.innerHTML = '<option value="">— Selecciona tipo —</option>';
  } else {
    group.style.display = 'block';
    select.innerHTML = '<option value="">— Selecciona tipo —</option>' +
      TIPO_ELEMENTO_OPTIONS[categoria]
        .map(opt => `<option value="${opt.value}">${opt.label}</option>`)
        .join('');
  }

  const casevacGroup = document.getElementById('casevacGroup');
  const casevacCheck = document.getElementById('casevacEligible');
  if (CASEVAC_ELIGIBLE_CATEGORIES.includes(categoria)) {
    casevacGroup.style.display = 'block';
  } else {
    casevacGroup.style.display = 'none';
    casevacCheck.checked = false;
  }

  const mobilityGroup  = document.getElementById('mobilityGroup');
  const mobilitySelect = document.getElementById('mobility');
  if (MOBILITY_CATEGORIES.includes(categoria)) {
    mobilityGroup.style.display = 'block';
  } else {
    mobilityGroup.style.display = 'none';
    mobilitySelect.value = '';
  }

  const casualtyMedGroup = document.getElementById('casualtyMedicalGroup');
  if (categoria === 'casualty') {
    casualtyMedGroup.style.display = 'block';
    // Ensure triage group visibility matches current status selection
    _updateCasualtyStatusUI();
  } else {
    casualtyMedGroup.style.display = 'none';
  }
}

function _updateCasualtyStatusUI() {
  const status = document.getElementById('casualtyStatus').value;
  const triageGroup = document.getElementById('triageGroup');
  triageGroup.style.display = status === 'KIA' ? 'none' : 'block';
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
async function initScenarios() {
  try {
    const res  = await fetch('/api/scenarios');
    const data = await res.json();
    if (!data.success) return;

    const select = document.getElementById('scenarioSelect');
    select.innerHTML = '<option value="">— Selecciona escenario —</option>';

    for (const s of data.data) {
      const opt       = document.createElement('option');
      opt.value       = s.name;
      opt.textContent = s.name + (s.description ? `  —  ${s.description}` : '');
      select.appendChild(opt);
    }
  } catch (err) {
    console.error('Failed to fetch scenarios:', err);
  }
}

async function loadSelectedScenario() {
  const name = document.getElementById('scenarioSelect').value;
  if (!name) {
    showMessage('Selecciona un escenario primero', 'info');
    return;
  }

  showLoading(true);
  try {
    const res  = await fetch(`/api/scenarios/load/${name}`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showMessage(`Escenario "${name}" cargado`, 'success');
      await loadEntities();
    } else {
      showMessage(data.message || 'Error cargando escenario', 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

// ---------------------------------------------------------------------------
// Entity loading & filtering
// ---------------------------------------------------------------------------
async function loadEntities() {
  try {
    showLoading(true);
    const res  = await fetch('/api/entities');
    const data = await res.json();

    if (data.success) {
      allEntities      = data.data;
      filteredEntities = [...allEntities];
      updateStats();
      filterEntities();   // apply current filters to new data
    } else {
      showMessage('Error al cargar entidades', 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

async function filterEntities() {
  const selectedCategories = getCheckedValues('categoryCheckboxes');
  const selectedAlliances  = getCheckedValues('allianceCheckboxes');
  const selectedTriage     = getCheckedValues('triageCheckboxes');
  const selectedMedRoles   = getCheckedValues('medFacilityCheckboxes');
  const selectedMedevac    = getCheckedValues('medevacCheckboxes');
  const search             = document.getElementById('buscarNombre').value.toLowerCase();
  const casevacOnly        = document.getElementById('casevacFilter').checked;

  filteredEntities = allEntities.filter(e => {
    // Category filter (empty = all). CASEVAC eligible acts as an OR alternative.
    if (selectedCategories.length > 0 || casevacOnly) {
      const matchesCategory = selectedCategories.includes(e.categoria);
      const matchesCasevac  = casevacOnly && e.casevac_eligible;
      if (!matchesCategory && !matchesCasevac) return false;
    }

    // Alliance filter (empty = all)
    if (selectedAlliances.length > 0) {
      if (!selectedAlliances.includes(e.alliance)) return false;
    }

    // Name search
    if (search && !(e.nombre || '').toLowerCase().includes(search)) return false;

    // Triage subfilter (only applies to casualties)
    if (selectedTriage.length > 0 && e.categoria === 'casualty') {
      const triageColor = e.medical?.triage_color || 'UNKNOWN';
      if (!selectedTriage.includes(triageColor)) return false;
    }

    // Medical facility role subfilter
    if (selectedMedRoles.length > 0 && e.categoria === 'medical_facility') {
      const tipo = e.tipo_elemento || '';
      const matchesRole  = selectedMedRoles.some(role => {
        if (role === 'medical_other') return MED_FACILITY_OTHER.includes(tipo);
        return tipo === role;
      });
      if (!matchesRole) return false;
    }

    // MEDEVAC role subfilter
    if (selectedMedevac.length > 0 && e.categoria === 'medevac_unit') {
      const tipo = e.tipo_elemento || '';
      const matchesRole = selectedMedevac.some(role => {
        if (role === 'medevac_other') return MEDEVAC_OTHER.includes(tipo);
        return tipo === role;
      });
      if (!matchesRole) return false;
    }

    return true;
  });

  renderList();
  await renderMarkers();
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
function updateStats() {
  const casualties = allEntities.filter(e => e.categoria === 'casualty');
  const t1Count    = casualties.filter(e => e.medical?.triage_color === 'RED').length;
  const t2Count    = casualties.filter(e => e.medical?.triage_color === 'YELLOW').length;
  const t3Count    = casualties.filter(e => e.medical?.triage_color === 'GREEN').length;
  const t4Count    = casualties.filter(e => e.medical?.triage_color === 'BLUE').length;
  const deadCount  = casualties.filter(e => e.medical?.triage_color === 'BLACK').length;

  document.getElementById('totalPuntos').textContent     = allEntities.length;
  document.getElementById('totalCategorias').textContent  = [...new Set(allEntities.map(e => e.categoria))].length;
  document.getElementById('totalCasualties').textContent  = casualties.length;

  document.getElementById('triageCounts').innerHTML =
    `<span class="triage-pill RED"   title="T1 Immediate">${t1Count}</span>` +
    `<span class="triage-pill YELLOW" title="T2 Urgent">${t2Count}</span>` +
    `<span class="triage-pill GREEN"  title="T3 Minimal">${t3Count}</span>` +
    (t4Count > 0 ? `<span class="triage-pill BLUE" title="T4 Expectant">${t4Count}</span>` : '') +
    (deadCount > 0 ? `<span class="triage-pill BLACK" title="Dead">${deadCount}</span>` : '');
}

// ---------------------------------------------------------------------------
// List rendering
// ---------------------------------------------------------------------------
function renderList() {
  const container = document.getElementById('puntosList');

  if (filteredEntities.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">No se encontraron entidades</p>';
    return;
  }

  container.innerHTML = filteredEntities.map(e => {
    const allianceColor = ALLIANCE_COLORS[e.alliance || 'unknown'] || '#A9A9A9';
    const triageClass   = e.medical?.triage_color ? ` triage-${e.medical.triage_color}` : '';
    const activeClass   = selectedId === e.id ? ' active' : '';

    // Medical badge (only for casualties)
    let medicalBadge = '';
    if (e.medical) {
      const statusBadge = e.medical.casualty_status
        ? `<strong style="color:#c0392b;">${e.medical.casualty_status}</strong>`
        : '';
      medicalBadge = `
        <div class="medical-badge">
          ${statusBadge}
          <span class="triage-pill ${e.medical.triage_color || 'UNKNOWN'}">${e.medical.triage_color || '?'}</span>
          · ${e.medical.evac_stage || 'unknown'}
        </div>`;
    }

    // Build categoria display with tipo_elemento and mobility
    let categoriaText = e.categoria;
    if (e.tipo_elemento) categoriaText += ` · ${e.tipo_elemento}`;
    if (e.mobility)      categoriaText += ` · ${e.mobility}`;
    categoriaText += ` · ${e.alliance || 'unknown'}`;
    if (e.country) categoriaText += ` · ${e.country}`;

    const casevacBadge = e.casevac_eligible
      ? '<div class="medical-badge"><span class="casevac-badge">CASEVAC eligible</span></div>'
      : '';

    const callsign   = e.elemento_identificado;
    const titleLine  = callsign
      ? `<span class="punto-callsign">${callsign.toUpperCase()}</span>`
      : e.nombre;
    const subtitleLine = callsign
      ? `<div class="punto-unit-name">${e.nombre}</div>`
      : '';

    return `
      <div class="punto-item${activeClass}${triageClass}" onclick="selectEntity(${e.id})">
        <div class="punto-nombre">
          <span class="pill" style="background:${allianceColor}"></span>
          ${titleLine}
        </div>
        ${subtitleLine}
        <span class="punto-categoria">${categoriaText}</span>
        ${casevacBadge}
        ${medicalBadge}
      </div>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Threat risk-area circles
// ---------------------------------------------------------------------------
function renderThreatCircles() {
  threatCirclesLayer.clearLayers();
  for (const e of filteredEntities) {
    if ((e.alliance || '').toLowerCase() !== 'hostile') continue;
    L.circle([e.latitud, e.longitud], {
      radius:      threatRadiusM,
      color:       '#FF0000',
      weight:      1.5,
      opacity:     0.8,
      fillColor:   '#FF0000',
      fillOpacity: 0.10,
      interactive: false,
    }).addTo(threatCirclesLayer);
  }
}

// ---------------------------------------------------------------------------
// Map markers
// ---------------------------------------------------------------------------
async function renderMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers    = [];
  markersById = {};

  for (const e of filteredEntities) {
    const icon   = await makeIcon(e);
    const marker = L.marker([e.latitud, e.longitud], { icon })
      .addTo(map)
      .bindPopup(buildPopup(e), { className: 'custom-popup' });

    marker.on('click', () => selectEntity(e.id));
    markers.push(marker);
    markersById[e.id] = marker;
  }

  renderThreatCircles();

  if (markers.length > 0) {
    map.fitBounds(new L.featureGroup(markers).getBounds().pad(0.1));
  }
}

// ---------------------------------------------------------------------------
// Live position updates via SSE
// ---------------------------------------------------------------------------

function updateMarkerPosition(id, lat, lng) {
  const marker = markersById[id];
  if (marker) {
    marker.setLatLng([lat, lng]);
    const entity = allEntities.find(e => e.id === id);
    if (entity) { entity.latitud = lat; entity.longitud = lng; }
  }
}

function _setSimState(state) {
  _simState = state;
  const btn        = document.getElementById('simulateBtn');
  const restartBtn = document.getElementById('restartBtn');
  if (!btn) return;

  btn.classList.remove('btn-simulate-stop');

  if (state === 'running') {
    btn.textContent = '⏹ Detener';
    btn.classList.add('btn-simulate-stop');
    if (restartBtn) restartBtn.style.display = 'none';
  } else if (state === 'paused') {
    btn.textContent = '▶ Reanudar';
    if (restartBtn) restartBtn.style.display = '';
  } else {
    btn.textContent = '▶ Simular';
    if (restartBtn) restartBtn.style.display = 'none';
  }
}

function initSSE() {
  const evtSource = new EventSource('/api/events');
  evtSource.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'entity_updated') {
        updateMarkerPosition(msg.id, msg.lat, msg.lng);
      } else if (msg.type === 'route_updated' && _currentTaskId) {
        loadMedevacRoutes(_currentTaskId);
      } else if (msg.type === 'simulation_stopped') {
        // 'cancelled' = user clicked Detener → show Reanudar/Reiniciar
        // 'completed' = finished naturally → back to idle
        _setSimState(msg.reason === 'cancelled' ? 'paused' : 'idle');
      }
    } catch (_) {}
  };
  evtSource.onerror = () => {
    console.warn('[SSE] Connection lost — browser will reconnect automatically');
  };
}

async function toggleSimulation() {
  if (!_currentTaskId) {
    showMessage('Carga primero un plan de rutas', 'error');
    return;
  }

  if (_simState === 'running') {
    // Detener
    try {
      const res = await fetch(
        `/api/planner/tasks/${encodeURIComponent(_currentTaskId)}/simulate`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showMessage(data.detail || data.message || 'No se pudo detener la simulación', 'error');
      }
      // Button resets via simulation_stopped SSE event
    } catch (err) {
      showMessage(`Error de conexión: ${err.message}`, 'error');
    }

  } else if (_simState === 'paused') {
    // Reanudar
    try {
      const res = await fetch(
        `/api/planner/tasks/${encodeURIComponent(_currentTaskId)}/simulate/resume`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        _setSimState('running');
        showMessage('Simulación reanudada', 'success');
      } else {
        showMessage(data.detail || data.message || 'No se pudo reanudar', 'error');
      }
    } catch (err) {
      showMessage(`Error de conexión: ${err.message}`, 'error');
    }

  } else {
    // Iniciar (idle)
    try {
      const res = await fetch(
        `/api/planner/tasks/${encodeURIComponent(_currentTaskId)}/simulate`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        _setSimState('running');
        showMessage('Simulación iniciada', 'success');
      } else {
        showMessage(data.detail || data.message || 'No se pudo iniciar la simulación', 'error');
      }
    } catch (err) {
      showMessage(`Error de conexión: ${err.message}`, 'error');
    }
  }
}

async function restartSimulation() {
  if (!_currentTaskId) return;
  try {
    const res = await fetch(
      `/api/planner/tasks/${encodeURIComponent(_currentTaskId)}/simulate/restart`,
      { method: 'POST' }
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      _setSimState('running');
      showMessage('Simulación reiniciada', 'success');
    } else {
      showMessage(data.detail || data.message || 'No se pudo reiniciar', 'error');
    }
  } catch (err) {
    showMessage(`Error de conexión: ${err.message}`, 'error');
  }
}

// ---------------------------------------------------------------------------
// Popup
// ---------------------------------------------------------------------------
function buildPopup(e) {
  const allianceColor = ALLIANCE_COLORS[e.alliance || 'unknown'] || '#A9A9A9';

  // Build subtitle
  let categoriaDisplay = e.categoria;
  if (e.tipo_elemento) categoriaDisplay += ` · ${e.tipo_elemento}`;
  if (e.mobility)      categoriaDisplay += ` · ${e.mobility}`;
  categoriaDisplay += ` · ${e.alliance || 'unknown'}`;
  if (e.country)       categoriaDisplay += ` · ${e.country}`;

  // Medical section
  let medicalHTML = '';
  if (e.medical) {
    const m = e.medical;
    medicalHTML = `
      <div class="popup-medical">
        <h4>🏥 Medical</h4>
        <div class="med-row">
          <span class="med-label">Triage</span>
          <span class="med-value"><span class="triage-pill ${m.triage_color || 'UNKNOWN'}">${m.triage_color || '?'}</span></span>
        </div>
        ${m.casualty_status ? `<div class="med-row">
          <span class="med-label">Status</span>
          <span class="med-value"><strong>${m.casualty_status}</strong></span>
        </div>` : ''}
        <div class="med-row">
          <span class="med-label">Stage</span>
          <span class="med-value">${m.evac_stage || '—'}</span>
        </div>
        ${m.injury_mechanism ? `<div class="med-row">
          <span class="med-label">Mechanism</span>
          <span class="med-value">${m.injury_mechanism}</span>
        </div>` : ''}
        ${m.primary_injury ? `<div class="med-row">
          <span class="med-label">Injury</span>
          <span class="med-value">${m.primary_injury}</span>
        </div>` : ''}
        ${m.destination_facility ? `<div class="med-row">
          <span class="med-label">Destination</span>
          <span class="med-value">${m.destination_facility.nombre}</span>
        </div>` : ''}
        ${m.prehospital_treatment ? `<div class="med-row">
          <span class="med-label">Pre-hosp tx</span>
          <span class="med-value">${m.prehospital_treatment}</span>
        </div>` : ''}
      </div>`;
  }

  return `
    <div class="popup-content">
      <div class="popup-title">
        <span class="pill" style="background:${allianceColor}"></span>
        ${e.nombre}
      </div>
      <span class="popup-categoria">${categoriaDisplay}</span>
      <div class="popup-info">
        ${e.descripcion ? `<p>${e.descripcion}</p>` : ''}
        ${e.observaciones ? `<p><strong>Obs:</strong> ${e.observaciones}</p>` : ''}
        ${e.casevac_eligible ? '<p><strong>CASEVAC eligible</strong></p>' : ''}
      </div>
      ${medicalHTML}
      <div class="popup-actions">
        <button class="btn btn-danger" onclick="deleteEntity(${e.id})">🗑️ Eliminar</button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Select & zoom
// ---------------------------------------------------------------------------
function selectEntity(id) {
  selectedId = id;
  const e = allEntities.find(x => x.id === id);
  if (!e) return;

  renderList();
  map.setView([e.latitud, e.longitud], 14);

  const marker = markers.find(m => {
    const ll = m.getLatLng();
    return Math.abs(ll.lat - e.latitud) < 1e-9 && Math.abs(ll.lng - e.longitud) < 1e-9;
  });
  if (marker) marker.openPopup();
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
function mostrarFormularioNuevoPunto() {
  document.getElementById('formModal').classList.add('show');
  const c = map.getCenter();
  document.getElementById('latitud').value  = c.lat.toFixed(6);
  document.getElementById('longitud').value = c.lng.toFixed(6);
}

function cerrarFormularioNuevoPunto() {
  document.getElementById('formModal').classList.remove('show');
  document.getElementById('nuevoPuntoForm').reset();
  // Re-run the category update to restore correct visibility state after reset
  updateTipoElementoOptions('');
}

async function crearNuevaEntidad() {
  showLoading(true);
  try {
    const categoria    = document.getElementById('categoria').value;
    const tipoElemento = document.getElementById('tipoElemento').value;

    const payload = {
      nombre:      document.getElementById('nombre').value,
      descripcion: document.getElementById('descripcion').value,
      categoria,
      country:     document.getElementById('country').value,
      alliance:    document.getElementById('alliance').value,
      latitud:     parseFloat(document.getElementById('latitud').value),
      longitud:    parseFloat(document.getElementById('longitud').value)
    };

    if (tipoElemento) {
      payload.tipo_elemento = tipoElemento;
    }

    if (CASEVAC_ELIGIBLE_CATEGORIES.includes(categoria)) {
      payload.casevac_eligible = document.getElementById('casevacEligible').checked;
    }

    const mobility = document.getElementById('mobility').value;
    if (MOBILITY_CATEGORIES.includes(categoria) && mobility) {
      payload.mobility = mobility;
    }

    const res  = await fetch('/api/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || 'Error al crear', 'error');
      return;
    }

    // For casualties, also create the medical record
    if (categoria === 'casualty') {
      const casualtyStatus  = document.getElementById('casualtyStatus').value;
      const medPayload = { casualty_status: casualtyStatus, evac_stage: 'at_poi' };

      if (casualtyStatus === 'KIA') {
        medPayload.triage_color = 'BLACK';
      } else {
        medPayload.triage_color = document.getElementById('triageColor').value;
        const injMech    = document.getElementById('injuryMechanism').value.trim();
        const primInjury = document.getElementById('primaryInjury').value.trim();
        if (injMech)    medPayload.injury_mechanism = injMech;
        if (primInjury) medPayload.primary_injury   = primInjury;
      }

      await fetch(`/api/medical/${data.data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medPayload)
      });
    }

    showMessage('Entidad creada', 'success');
    cerrarFormularioNuevoPunto();
    await loadEntities();
  } catch (err) {
    console.error(err);
    showMessage('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
async function deleteEntity(id) {
  if (!confirm('¿Eliminar esta entidad? No se puede deshacer.')) return;

  showLoading(true);
  try {
    const res  = await fetch(`/api/entities/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      showMessage('Entidad eliminada', 'success');
      await loadEntities();
    } else {
      showMessage(data.message || 'Error al eliminar', 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function centrarMapa() {
  map.setView([39.47, -0.38], 12);
}

function showLoading(show) {
  document.getElementById('loading').classList.toggle('show', !!show);
}

function showMessage(text, type) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className   = `message message-${type} show`;
  setTimeout(() => el.classList.remove('show'), 4000);
}

// ---------------------------------------------------------------------------
// MEDEVAC Routes
// ---------------------------------------------------------------------------

function clearRoutes() {
  if (routeLayer) routeLayer.clearLayers();
  document.getElementById('routesStatus').innerHTML = '';
  document.getElementById('routesActions').style.display = 'none';
  _currentTaskId = null;
  _setSimState('idle');
}

async function loadMedevacRoutes(taskId) {
  const statusEl = document.getElementById('routesStatus');
  statusEl.innerHTML = '<span class="routes-loading">Cargando…</span>';

  try {
    const res  = await fetch(`/api/planner/tasks/${encodeURIComponent(taskId)}/routes`);
    const data = await res.json();

    if (res.status === 425) {
      statusEl.innerHTML = '<span class="routes-warn">⏳ El plan aún está en ejecución.</span>';
      return;
    }
    if (!res.ok || !data.routes) {
      statusEl.innerHTML = `<span class="routes-error">Error: ${data.message || res.status}</span>`;
      return;
    }

    clearRoutes();
    const routes = data.routes;

    if (routes.length === 0) {
      statusEl.innerHTML = '<span class="routes-warn">No hay rutas en este plan.</span>';
      return;
    }

    const bounds = [];

    routes.forEach((route, idx) => {
      const color = getRouteColors()[idx % ROUTE_COLORS_DARK.length];

      // Use real GeoJSON if available, otherwise build straight-line fallback
      const pickupGeo  = route.pickup_leg  || _straightLine(route.asset_position,    route.casualty_position);
      const deliveryGeo = route.delivery_leg || _straightLine(route.casualty_position, route.destination_position);

      // Pickup leg — dashed, lighter.  Only the best route is rendered.
      if (pickupGeo) {
        L.geoJSON(pickupGeo, {
          filter: (feature) => !feature.properties?.route_type || ['best', 'direct_haversine'].includes(feature.properties.route_type),
          style: { color, weight: 3, opacity: 0.7, dashArray: '8 6' }
        }).bindPopup(_routePopup(route, 'pickup')).addTo(routeLayer);
        _collectBounds(pickupGeo, bounds);
      }

      // Delivery leg — solid, full opacity.  Only the best route is rendered.
      if (deliveryGeo) {
        L.geoJSON(deliveryGeo, {
          filter: (feature) => !feature.properties?.route_type || ['best', 'direct_haversine'].includes(feature.properties.route_type),
          style: { color, weight: 4, opacity: 1 }
        }).bindPopup(_routePopup(route, 'delivery')).addTo(routeLayer);
        _collectBounds(deliveryGeo, bounds);
      }

      // Waypoint marker at the casualty POI
      const poiCoord = _firstCoord(deliveryGeo);
      if (poiCoord) {
        L.circleMarker(poiCoord, {
          radius: 6, color, fillColor: color,
          fillOpacity: 0.9, weight: 2
        }).bindPopup(_routePopup(route, 'poi')).addTo(routeLayer);
      }
    });

    // Fit map to routes
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.12));
    }

    _currentTaskId = taskId;
    document.getElementById('routesActions').style.display = 'flex';
    statusEl.innerHTML = _routesSummaryHTML(routes);

  } catch (err) {
    console.error('loadMedevacRoutes error:', err);
    statusEl.innerHTML = `<span class="routes-error">Error de conexión: ${err.message}</span>`;
  }
}

function _routePopup(route, leg) {
  const pickup   = route.pickup_eta_minutes   != null ? `${route.pickup_eta_minutes} min` : '—';
  const delivery = route.delivery_eta_minutes != null ? `${route.delivery_eta_minutes} min` : '—';
  const total    = route.total_eta_minutes    != null ? `${route.total_eta_minutes} min` : '—';
  const legLabel = leg === 'pickup'   ? '🔵 Trayecto de recogida'
                 : leg === 'delivery' ? '🔴 Trayecto de entrega'
                 :                     '📍 Punto de recogida';

  const notes = Array.isArray(route.doctrinal_notes) ? route.doctrinal_notes : [];
  const violations = notes.filter(n => n.startsWith('VIOLATION'));
  const warnings   = notes.filter(n => !n.startsWith('VIOLATION'));

  const doctrineHTML = (violations.length + warnings.length) === 0 ? '' : `
    <div class="popup-doctrine">
      ${violations.map(v => `<div class="doctrine-violation">⛔ ${v}</div>`).join('')}
      ${warnings.map(w => `<div class="doctrine-warning">⚠️ ${w}</div>`).join('')}
    </div>`;

  return `
    <div class="popup-content">
      <div class="popup-title">${route.plan_key || ''} — ${route.asset_name || '?'}</div>
      <div class="popup-categoria">${legLabel}</div>
      <div class="popup-info">
        <p>🚑 <strong>Vehículo:</strong> ${route.asset_name || '?'}</p>
        <p>🩸 <strong>Casualty:</strong> ${route.casualty_name || '?'}</p>
        <p>🏥 <strong>Destino:</strong> ${route.destination_name || '?'}</p>
        <p>⏱️ Recogida: ${pickup} | Entrega: ${delivery}</p>
        <p><strong>ETA total: ${total}</strong></p>
      </div>
      ${doctrineHTML}
    </div>`;
}

function _routesSummaryHTML(routes) {
  const items = routes.map((r, i) => {
    const color = getRouteColors()[i % ROUTE_COLORS_DARK.length];
    return `<div class="route-summary-item">
      <span class="route-color-dot" style="background:${color}"></span>
      <span><strong>${r.asset_name || '?'}</strong> → ${r.casualty_name || '?'} → ${r.destination_name || '?'}</span>
      <span class="route-eta">${r.total_eta_minutes != null ? r.total_eta_minutes + ' min' : ''}</span>
    </div>`;
  }).join('');
  return `<div class="routes-summary">${items}</div>`;
}

function _straightLine(from, to) {
  if (!from || !to) return null;
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[from.lng, from.lat], [to.lng, to.lat]]
      },
      properties: { fallback: true }
    }]
  };
}

function _firstCoord(geojson) {
  if (!geojson) return null;
  const features = geojson.features || [];
  const line = features.find(f => f.geometry?.type === 'LineString');
  if (!line) return null;
  const coords = line.geometry.coordinates;
  if (!coords || coords.length === 0) return null;
  // Return midpoint to mark the start of delivery (= POI = end of pickup)
  const c = coords[0];
  return [c[1], c[0]];  // [lat, lng]
}

function _collectBounds(geojson, bounds) {
  if (!geojson) return;
  (geojson.features || []).forEach(f => {
    const coords = f.geometry?.coordinates || [];
    coords.forEach(c => bounds.push([c[1], c[0]]));
  });
}