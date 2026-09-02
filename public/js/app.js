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
let _lastRoutes     = null;   // last rendered route list (for language switching)
let _lastEventAt    = null;   // Date of the last SSE message — drives the LIVE dot
let _sseConnected   = false;
let _shouldFit      = true;   // fit the map on load / scenario change, not on every filter

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

// Triage scale — the order the ladder, the map legend and the roster all use.
// `fill` paints bands and pills; `ink` is the same colour made legible as text
// on either theme (both are CSS variables so a theme switch is free).
// UNKNOWN is a band of its own: without it a casualty with no triage assigned
// would be in the header total but in none of the bands, and the ladder would
// silently fail to add up.
const TRIAGE_ORDER = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'BLACK', 'UNKNOWN'];

const TRIAGE_META = {
  RED:     { tag: 'T1',  key: 'triage.t1',      fill: 'var(--t-red)',     ink: 'var(--t-red-ink)' },
  YELLOW:  { tag: 'T2',  key: 'triage.t2',      fill: 'var(--t-yellow)',  ink: 'var(--t-yellow-ink)' },
  GREEN:   { tag: 'T3',  key: 'triage.t3',      fill: 'var(--t-green)',   ink: 'var(--t-green-ink)' },
  BLUE:    { tag: 'T4',  key: 'triage.t4',      fill: 'var(--t-blue)',    ink: 'var(--t-blue-ink)' },
  BLACK:   { tag: 'KIA', key: 'triage.dead',    fill: 'var(--t-black)',   ink: 'var(--t-black-ink)' },
  UNKNOWN: { tag: '?',   key: 'triage.unknown', fill: 'var(--t-unknown)', ink: 'var(--t-unknown-ink)' }
};

// Category enum → i18n key, for the create form's category dropdown.
const CATEGORY_I18N_KEY = {
  missile: 'cat.missile', fighter: 'cat.fighter', bomber: 'cat.bomber',
  aircraft: 'cat.aircraft', helicopter: 'cat.helicopter', uav: 'cat.uav',
  ugv: 'cat.ugv', transportation: 'cat.transport', armoured: 'cat.armoured',
  artillery: 'cat.artillery', ship: 'cat.ship', destroyer: 'cat.destroyer',
  submarine: 'cat.submarine', ground_vehicle: 'cat.ground_vehicle',
  infantry: 'cat.infantry', reconnaissance: 'cat.recon', engineer: 'cat.engineer',
  mortar: 'cat.mortar', person: 'cat.person', base: 'cat.base',
  building: 'cat.building', infrastructure: 'cat.infrastructure',
  medical_facility: 'cat.medical_facility', medevac_unit: 'cat.medevac_unit',
  casualty: 'cat.casualty', default: 'cat.default'
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
// Theme, language and tabs
// ---------------------------------------------------------------------------

/**
 * Theme. On a first visit we follow the operating system; after that the
 * operator's own choice wins and is remembered.
 */
function initTheme() {
  const stored = localStorage.getItem('cmop-theme');
  const dark = stored
    ? stored === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;

  _applyTheme(dark);

  document.querySelectorAll('#themeToggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      const wantDark = btn.dataset.theme === 'dark';
      if (wantDark === document.body.classList.contains('dark')) return;
      _applyTheme(wantDark);
      localStorage.setItem('cmop-theme', wantDark ? 'dark' : 'light');
      setTileLayer(wantDark ? 'dark' : 'light');
      if (_currentTaskId) loadMedevacRoutes(_currentTaskId);
    });
  });
}

function _applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  document.querySelectorAll('#themeToggle button').forEach(b => {
    b.setAttribute('aria-pressed', String((b.dataset.theme === 'dark') === dark));
  });
}

/** Language. English is the default; the choice is remembered. */
function initLang() {
  initLangValue();
  setLang(getLang());   // paints the static DOM and the toggle state

  document.querySelectorAll('#langToggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.lang === getLang()) return;
      setLang(btn.dataset.lang, _rerenderDynamicStrings);
    });
  });
}

/** Everything the language switch cannot reach through data-i18n. */
function _rerenderDynamicStrings() {
  const scnSelect = document.getElementById('scenarioSelect');
  if (scnSelect && scnSelect.options.length) scnSelect.options[0].textContent = t('scenario.pick');

  renderCategoryOptions();
  updateStats();
  renderList();
  _setSimState(_simState);
  _updateLiveLabel();
  markers.forEach(m => m._cmopEntity && m.setPopupContent(buildPopup(m._cmopEntity)));
  if (_lastRoutes) document.getElementById('routesStatus').innerHTML = _routesSummaryHTML(_lastRoutes);
}

// The `categoria` enum values are English words, so English needs no gloss.
const ENUM_LANG = 'en';

/**
 * Category dropdown labels. The enum is the value the API stores, so it is
 * always what the option shows. A readable name is appended only when it can
 * actually teach the reader something: the UI is in a language other than the
 * one the enums are written in, and the name isn't just the enum re-spelled.
 *
 *   en  →  uav              ground_vehicle              missile
 *   es  →  uav — UAV / Dron  ground_vehicle — Vehículo terrestre  missile — Misil
 */
function renderCategoryOptions() {
  const flat = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  document.querySelectorAll('#categoria option[value]').forEach(opt => {
    const value = opt.value;
    if (!value) return;

    const key = CATEGORY_I18N_KEY[value];
    const label = key ? t(key) : '';
    // "medevac_unit — MEDEVAC" and "base — Base" add no letters the enum does
    // not already carry; "uav — UAV / Dron" and "missile — Misil" do.
    const worthShowing = label && getLang() !== ENUM_LANG && !flat(value).includes(flat(label));

    opt.textContent = worthShowing ? `${value} — ${label}` : value;
  });
}

/** Tabs — the roster is no longer buried under the filter stack. */
function initTabs() {
  const buttons = document.querySelectorAll('.tabs button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.setAttribute('aria-selected', String(b === btn)));
      document.querySelectorAll('.pane').forEach(p => {
        p.classList.toggle('on', p.id === 'pane-' + btn.dataset.pane);
      });
    });
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

  initTheme();
  initLang();
  renderCategoryOptions();
  initTabs();
  initMap();
  initScenarios();
  loadEntities();
  setupEventListeners();
  initSSE();
  startClocks();
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
      document.getElementById('routesStatus').innerHTML =
        `<span class="routes-warn">${t('routes.needTask')}</span>`;
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

  // Re-evaluate CASEVAC eligibility visibility when alliance changes
  document.getElementById('alliance').addEventListener('change', () => {
    const categoria = document.getElementById('categoria').value;
    updateTipoElementoOptions(categoria);
  });

  // Casualty status — toggle triage fields when KIA is selected
  document.getElementById('casualtyStatus').addEventListener('change', _updateCasualtyStatusUI);

  // Triage colour picker → the hidden field crearNuevaEntidad() reads
  document.getElementById('triagePicker').addEventListener('change', (e) => {
    if (e.target.name === 'triagePick') document.getElementById('triageColor').value = e.target.value;
  });

  // Escape closes the create-entity dialog
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('formModal').classList.contains('show')) {
      cerrarFormularioNuevoPunto();
    }
  });

  // Triage ladder — bands and counts both select the same band
  ['ladderBar', 'ladderScale'].forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.dataset.n === '0') return;
      selectTriageBand(btn.dataset.triage);
    });
  });

  document.getElementById('clearAllFilters').addEventListener('click', clearAllFilters);
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
  const alliance = document.getElementById('alliance').value;
  if (CASEVAC_ELIGIBLE_CATEGORIES.includes(categoria) && alliance === 'friendly') {
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
    select.innerHTML = `<option value="">${t('scenario.pick')}</option>`;

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
    showMessage(t('msg.scenarioFirst'), 'info');
    return;
  }

  showLoading(true);
  try {
    const res  = await fetch(`/api/scenarios/load/${name}`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showMessage(t('msg.scenarioLoaded', { name }), 'success');
      _shouldFit = true;          // a new scenario is a new area of operations
      await loadEntities();
    } else {
      showMessage(data.message || t('msg.scenarioError'), 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage(t('msg.connError'), 'error');
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
      showMessage(t('msg.entitiesError'), 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage(t('msg.connError'), 'error');
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
  updateStats();
  await renderMarkers();
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
/**
 * The triage ladder: a proportional bar plus a five-column count scale.
 * It is the census, the alarm and the triage filter in one object — clicking a
 * band drives the existing triage checkboxes, so all filtering still runs
 * through filterEntities().
 */
function updateStats() {
  const casualties = allEntities.filter(e => e.categoria === 'casualty');
  const counts = {};
  for (const k of TRIAGE_ORDER) {
    counts[k] = casualties.filter(e => (e.medical?.triage_color || 'UNKNOWN') === k).length;
  }

  const selected = getCheckedValues('triageCheckboxes');
  const active = selected.length === 1 ? selected[0] : null;
  const total = casualties.length;

  document.getElementById('ladderTotals').innerHTML =
    t('ladder.totals', { cas: `<b>${total}</b>`, all: allEntities.length });

  document.getElementById('ladder').classList.toggle('filtered', !!active);

  document.getElementById('ladderBar').innerHTML = TRIAGE_ORDER.map(k => {
    const n = counts[k];
    const m = TRIAGE_META[k];
    const label = `${m.tag} ${t(m.key)} — ${n}`;
    return `<button type="button" style="--c:${m.fill};flex:${n || 0.0001} 1 0"
              data-triage="${k}" data-n="${n}" class="${k === active ? 'on' : ''}"
              title="${label}" aria-label="${label}"></button>`;
  }).join('');

  document.getElementById('ladderScale').innerHTML = TRIAGE_ORDER.map(k => {
    const n = counts[k];
    const m = TRIAGE_META[k];
    const label = `${m.tag} ${t(m.key)} — ${n}`;
    return `<button type="button" style="--c-ink:${m.ink}" data-triage="${k}" data-n="${n}"
              class="${k === active ? 'on' : ''}" title="${label}" aria-label="${label}">
              <span class="n">${n}</span><span class="k">${m.tag}</span>
            </button>`;
  }).join('');
}

/**
 * Select one triage band. Selecting also narrows the category filter to
 * casualties, because the triage subfilter only applies to them.
 */
function selectTriageBand(color) {
  const boxes = [...document.querySelectorAll('#triageCheckboxes input[type="checkbox"]')];
  const already = boxes.filter(cb => cb.checked).map(cb => cb.value);
  const turningOff = already.length === 1 && already[0] === color;

  boxes.forEach(cb => { cb.checked = !turningOff && cb.value === color; });

  const casualtyBox = document.querySelector('#categoryCheckboxes input[value="casualty"]');
  if (casualtyBox) casualtyBox.checked = !turningOff;

  toggleSubfilters();
  filterEntities();
}

/** Reset every filter control in one go. */
function clearAllFilters() {
  document.querySelectorAll('#pane-filters input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById('buscarNombre').value = '';
  toggleSubfilters();
  filterEntities();
}

// ---------------------------------------------------------------------------
// List rendering
// ---------------------------------------------------------------------------
function renderList() {
  const container = document.getElementById('puntosList');

  if (filteredEntities.length === 0) {
    container.innerHTML = `<p class="roster-empty">${t('roster.empty')}</p>`;
    _updateRosterHead();
    return;
  }

  // Urgency first: casualties down the triage scale, then everything else.
  const rows = [...filteredEntities].sort((a, b) => {
    const ra = _urgencyRank(a), rb = _urgencyRank(b);
    if (ra !== rb) return ra - rb;
    return (a.nombre || '').localeCompare(b.nombre || '');
  });

  container.innerHTML = rows.map(e => {
    const isCasualty = e.categoria === 'casualty';
    const triage = isCasualty ? (e.medical?.triage_color || 'UNKNOWN') : null;
    const meta = triage ? TRIAGE_META[triage] : null;

    const edgeColor = meta ? meta.fill : (ALLIANCE_COLORS[e.alliance || 'unknown'] || ALLIANCE_COLORS.unknown);
    const inkColor  = meta ? meta.ink : 'var(--dim)';

    const callsign = e.elemento_identificado;
    const idLine   = esc((callsign || e.nombre || '').toUpperCase());
    const nameLine = _isRedundantName(callsign, e.nombre)
      ? ''
      : `<span class="ent-name">${esc(e.nombre)}</span>`;

    let metaText = e.categoria;
    if (e.tipo_elemento && e.tipo_elemento !== e.categoria) metaText += ` · ${e.tipo_elemento}`;
    if (e.mobility)      metaText += ` · ${e.mobility}`;
    metaText += ` · ${t('alliance.' + (e.alliance || 'unknown'))}`;
    if (e.country) metaText += ` · ${e.country}`;

    // Right column carries the two things that rank a casualty: triage and time.
    let right = '';
    if (meta) {
      const secs = elapsedSeconds(e.medical?.created_at);
      const clock = secs === null
        ? `<span class="ent-clock">—</span>`
        : `<span class="ent-clock${triage === 'RED' ? ' hot' : ''}" data-since="${esc(e.medical.created_at)}">${fmtElapsed(secs)}</span>`;
      right = `<span class="ent-right"><span class="ent-tag">${meta.tag}</span>${clock}</span>`;
    } else if (e.casevac_eligible) {
      right = `<span class="ent-right"><span class="ent-flag">CASEVAC</span></span>`;
    }

    const cls = ['ent'];
    if (!meta) cls.push('ent--unit');     // units keep a quieter edge than casualties
    if (triage === 'RED') cls.push('t1');
    if (selectedId === e.id) cls.push('active');

    return `
      <button type="button" class="${cls.join(' ')}" style="--c:${edgeColor};--c-ink:${inkColor}"
              onclick="selectEntity(${e.id})">
        <span class="ent-edge"></span>
        <span class="ent-body">
          <span class="ent-id">${idLine}</span>
          ${nameLine}
          <span class="ent-meta">${esc(metaText)}</span>
        </span>
        ${right}
      </button>`;
  }).join('');

  _updateRosterHead();
}

/**
 * True when the entity name adds nothing to the callsign already on the row —
 * "RUS-CAS-2" vs "RUS-CAS-2 (WIA)", or "RUS-ART-1" vs "RUS ART-1".
 */
function _isRedundantName(callsign, nombre) {
  if (!callsign || !nombre) return true;
  const flat = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return flat(nombre).startsWith(flat(callsign));
}

/** Casualties rank above units; inside casualties, down the triage scale. */
function _urgencyRank(e) {
  if (e.categoria !== 'casualty') return 100;
  const idx = TRIAGE_ORDER.indexOf(e.medical?.triage_color || 'UNKNOWN');
  return idx === -1 ? 90 : idx;
}

function _updateRosterHead() {
  const selected = getCheckedValues('triageCheckboxes');
  const el = document.getElementById('rosterLabel');
  if (!el) return;
  el.textContent = selected.length === 1
    ? t('roster.filtered', { label: t(TRIAGE_META[selected[0]].key) })
    : t('roster.sorted');
}

// ---------------------------------------------------------------------------
// Elapsed time — the column the picture was missing.
//
// There is no injury timestamp in the schema, so this measures time since the
// casualty record was written (medical.created_at). Values that cannot be
// trusted — negative, or older than 30 days, which is what a server/browser
// clock skew looks like — are shown as an em dash rather than a wrong number.
// ---------------------------------------------------------------------------
function elapsedSeconds(iso) {
  if (!iso) return null;
  // A zone-less "2026-09-02T14:57:11.123" is stored UTC but would be parsed as
  // local time, which reads as hours of skew. Pin it to UTC when no zone is given.
  const s = String(iso);
  const stamped = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
  const ms = Date.now() - new Date(stamped).getTime();
  if (!Number.isFinite(ms) || ms < 0 || ms > 30 * 86400000) return null;
  return Math.floor(ms / 1000);
}

function fmtElapsed(s) {
  const pad = n => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

/** One interval drives every clock on the page. */
function startClocks() {
  setInterval(() => {
    document.querySelectorAll('[data-since]').forEach(el => {
      const secs = elapsedSeconds(el.dataset.since);
      el.textContent = secs === null ? '—' : fmtElapsed(secs);
    });
    _updateLiveLabel();
  }, 1000);
}

function _updateLiveLabel() {
  const wrap = document.getElementById('liveIndicator');
  const label = document.getElementById('liveLabel');
  if (!wrap || !label) return;

  wrap.classList.toggle('on', _sseConnected);

  if (!_sseConnected) { label.textContent = t('live.lost'); return; }
  if (!_lastEventAt)  { label.textContent = t('live.waiting'); return; }

  const secs = Math.max(0, Math.floor((Date.now() - _lastEventAt) / 1000));
  label.textContent = secs > 999 ? t('live.waiting') : t('live.connected', { n: secs });
}

/** Escape text coming from the database before it goes into innerHTML. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
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

    marker._cmopEntity = e;          // so a language switch can rebuild the popup
    marker.on('click', () => selectEntity(e.id));
    markers.push(marker);
    markersById[e.id] = marker;
  }

  renderThreatCircles();

  // Only fit on load and on scenario change. Re-zooming on every filter change
  // moved the map out from under the operator; "Fit" is now an explicit control.
  if (_shouldFit && markers.length > 0) {
    map.fitBounds(new L.featureGroup(markers).getBounds().pad(0.1));
    _shouldFit = false;
  }
}

/** Frame every entity currently on the map. */
function fitToEntities() {
  if (markers.length === 0) return;
  map.fitBounds(new L.featureGroup(markers).getBounds().pad(0.1));
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
    btn.textContent = t('sim.stop');
    btn.classList.add('btn-simulate-stop');
    if (restartBtn) restartBtn.style.display = 'none';
  } else if (state === 'paused') {
    btn.textContent = t('sim.resume');
    if (restartBtn) restartBtn.style.display = '';
  } else {
    btn.textContent = t('sim.start');
    if (restartBtn) restartBtn.style.display = 'none';
  }
}

function initSSE() {
  const evtSource = new EventSource('/api/events');

  evtSource.onopen = () => { _sseConnected = true; _updateLiveLabel(); };

  evtSource.onmessage = (event) => {
    _sseConnected = true;
    _lastEventAt = Date.now();
    _updateLiveLabel();
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'entity_updated') {
        updateMarkerPosition(msg.id, msg.lat, msg.lng);
      } else if (msg.type === 'entity_created') {
        _onEntityCreated(msg.data);
      } else if (msg.type === 'entity_deleted') {
        _onEntityDeleted(msg.id);
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
    _sseConnected = false;
    _updateLiveLabel();
    console.warn('[SSE] Connection lost — browser will reconnect automatically');
  };
}

async function _onEntityCreated(entity) {
  if (!entity || allEntities.find(e => e.id === entity.id)) return; // already present
  allEntities.push(entity);
  updateStats();
  await filterEntities(); // re-applies filters, re-renders list + markers
}

function _onEntityDeleted(id) {
  const marker = markersById[id];
  if (marker) {
    map.removeLayer(marker);
    delete markersById[id];
    markers = markers.filter(m => m !== marker);
  }
  allEntities      = allEntities.filter(e => e.id !== id);
  filteredEntities = filteredEntities.filter(e => e.id !== id);
  updateStats();
  renderList();
  renderThreatCircles();
}

async function toggleSimulation() {
  if (!_currentTaskId) {
    showMessage(t('sim.needPlan'), 'error');
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
        showMessage(data.detail || data.message || t('sim.failStop'), 'error');
      }
      // Button resets via simulation_stopped SSE event
    } catch (err) {
      showMessage(`${t('msg.connError')}: ${err.message}`, 'error');
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
        showMessage(t('sim.resumed'), 'success');
      } else {
        showMessage(data.detail || data.message || t('sim.failResume'), 'error');
      }
    } catch (err) {
      showMessage(`${t('msg.connError')}: ${err.message}`, 'error');
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
        showMessage(t('sim.started'), 'success');
      } else {
        showMessage(data.detail || data.message || t('sim.failStart'), 'error');
      }
    } catch (err) {
      showMessage(`${t('msg.connError')}: ${err.message}`, 'error');
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
      showMessage(t('sim.restarted'), 'success');
    } else {
      showMessage(data.detail || data.message || t('sim.failRestart'), 'error');
    }
  } catch (err) {
    showMessage(`${t('msg.connError')}: ${err.message}`, 'error');
  }
}

// ---------------------------------------------------------------------------
// Popup
// ---------------------------------------------------------------------------
function buildPopup(e) {
  const isCasualty = e.categoria === 'casualty';
  const triage = isCasualty ? (e.medical?.triage_color || 'UNKNOWN') : null;
  const meta   = triage ? TRIAGE_META[triage] : null;
  const edge   = meta ? meta.fill : (ALLIANCE_COLORS[e.alliance || 'unknown'] || ALLIANCE_COLORS.unknown);

  const callsign = e.elemento_identificado;
  const title    = esc((callsign || e.nombre || '').toUpperCase());

  let subtitle = _isRedundantName(callsign, e.nombre) ? '' : `${e.nombre} · `;
  subtitle += e.categoria;
  if (e.tipo_elemento && e.tipo_elemento !== e.categoria) subtitle += ` · ${e.tipo_elemento}`;
  if (e.mobility)      subtitle += ` · ${e.mobility}`;
  subtitle += ` · ${t('alliance.' + (e.alliance || 'unknown'))}`;
  if (e.country) subtitle += ` · ${e.country}`;

  const row = (label, value, big) =>
    `<div class="med-row"><span class="med-label">${label}</span>` +
    `<span class="med-value${big ? ' big' : ''}">${value}</span></div>`;

  let medicalHTML = '';
  if (e.medical) {
    const m = e.medical;
    const secs = elapsedSeconds(m.created_at);
    medicalHTML = `
      <div class="popup-medical">
        <h4>${t('popup.medical')}</h4>
        ${row(t('popup.triage'), `<span style="color:${meta ? meta.ink : 'var(--dim)'}">${meta ? meta.tag : '?'} · ${t(meta ? meta.key : 'triage.unknown').toUpperCase()}</span>`)}
        ${m.casualty_status ? row(t('popup.status'), esc(m.casualty_status)) : ''}
        ${secs !== null ? row(t('popup.elapsed'), `<span data-since="${esc(m.created_at)}">${fmtElapsed(secs)}</span>`, true) : ''}
        ${row(t('popup.stage'), esc(m.evac_stage || '—'))}
        ${m.injury_mechanism ? row(t('popup.mechanism'), esc(m.injury_mechanism)) : ''}
        ${m.primary_injury ? row(t('popup.injury'), esc(m.primary_injury)) : ''}
        ${m.destination_facility ? row(t('popup.destination'), esc(m.destination_facility.nombre)) : ''}
        ${m.prehospital_treatment ? row(t('popup.treatment'), esc(m.prehospital_treatment)) : ''}
      </div>`;
  }

  const infoHTML = (e.descripcion || e.observaciones || e.casevac_eligible) ? `
      <div class="popup-info">
        ${e.descripcion ? `<p>${esc(e.descripcion)}</p>` : ''}
        ${e.observaciones ? `<p><strong>${t('popup.obs')}:</strong> ${esc(e.observaciones)}</p>` : ''}
        ${e.casevac_eligible ? `<p><span class="casevac-badge">${t('popup.casevac')}</span></p>` : ''}
      </div>` : '';

  return `
    <div class="popup-content" style="--c:${edge}">
      <div class="popup-head">
        <div class="popup-title">${title}</div>
        <span class="popup-categoria">${esc(subtitle)}</span>
      </div>
      ${infoHTML}
      ${medicalHTML}
      <div class="popup-actions">
        <button class="btn-danger" onclick="deleteEntity(${e.id})">${t('action.delete')}</button>
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
  document.getElementById('triageColor').value = 'UNKNOWN';
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
      showMessage(data.message || t('msg.createError'), 'error');
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

    showMessage(t('msg.entityCreated'), 'success');
    cerrarFormularioNuevoPunto();
    await loadEntities();
  } catch (err) {
    console.error(err);
    showMessage(t('msg.connError'), 'error');
  } finally {
    showLoading(false);
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
async function deleteEntity(id) {
  if (!confirm(t('msg.confirmDelete'))) return;

  showLoading(true);
  try {
    const res  = await fetch(`/api/entities/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      showMessage(t('msg.entityDeleted'), 'success');
      await loadEntities();
    } else {
      showMessage(data.message || t('msg.deleteError'), 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage(t('msg.connError'), 'error');
  } finally {
    showLoading(false);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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
  _lastRoutes    = null;
  _setSimState('idle');
}

async function loadMedevacRoutes(taskId) {
  const statusEl = document.getElementById('routesStatus');
  statusEl.innerHTML = `<span class="routes-loading">${t('routes.loading')}</span>`;

  try {
    const res  = await fetch(`/api/planner/tasks/${encodeURIComponent(taskId)}/routes`);
    const data = await res.json();

    if (res.status === 425) {
      statusEl.innerHTML = `<span class="routes-warn">${t('routes.pending')}</span>`;
      return;
    }
    if (!res.ok || !data.routes) {
      statusEl.innerHTML =
        `<span class="routes-error">${t('routes.error', { detail: data.message || res.status })}</span>`;
      return;
    }

    clearRoutes();
    const routes = data.routes;

    if (routes.length === 0) {
      statusEl.innerHTML = `<span class="routes-warn">${t('routes.none')}</span>`;
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
    _lastRoutes    = routes;
    document.getElementById('routesActions').style.display = 'flex';
    statusEl.innerHTML = _routesSummaryHTML(routes);

  } catch (err) {
    console.error('loadMedevacRoutes error:', err);
    statusEl.innerHTML =
      `<span class="routes-error">${t('routes.error', { detail: err.message })}</span>`;
  }
}

function _routePopup(route, leg) {
  const min = n => (n != null ? `${n} ${t('routes.min')}` : '—');
  const legLabel = leg === 'pickup'   ? t('popup.legPickup')
                 : leg === 'delivery' ? t('popup.legDelivery')
                 :                      t('popup.legPoi');

  const notes      = Array.isArray(route.doctrinal_notes) ? route.doctrinal_notes : [];
  const violations = notes.filter(n => n.startsWith('VIOLATION'));
  const warnings   = notes.filter(n => !n.startsWith('VIOLATION'));

  const doctrineHTML = (violations.length + warnings.length) === 0 ? '' : `
    <div class="popup-doctrine">
      ${violations.map(v => `<div class="doctrine-violation">${esc(v)}</div>`).join('')}
      ${warnings.map(w => `<div class="doctrine-warning">${esc(w)}</div>`).join('')}
    </div>`;

  const row = (label, value, big) =>
    `<div class="med-row"><span class="med-label">${label}</span>` +
    `<span class="med-value${big ? ' big' : ''}">${value}</span></div>`;

  return `
    <div class="popup-content" style="--c:var(--t-yellow)">
      <div class="popup-head">
        <div class="popup-title">${esc(route.plan_key || '')} — ${esc(route.asset_name || '?')}</div>
        <span class="popup-categoria">${legLabel}</span>
      </div>
      <div class="popup-medical">
        ${row(t('popup.asset'), esc(route.asset_name || '?'))}
        ${row(t('popup.casualty'), esc(route.casualty_name || '?'))}
        ${row(t('popup.destination'), esc(route.destination_name || '?'))}
        ${row(t('popup.pickupEta'), min(route.pickup_eta_minutes))}
        ${row(t('popup.deliveryEta'), min(route.delivery_eta_minutes))}
        ${row(t('popup.totalEta'), min(route.total_eta_minutes), true)}
      </div>
      ${doctrineHTML}
    </div>`;
}

function _routesSummaryHTML(routes) {
  const items = routes.map((r, i) => {
    const color = getRouteColors()[i % ROUTE_COLORS_DARK.length];
    const eta   = r.total_eta_minutes != null ? r.total_eta_minutes : '—';
    return `<div class="route-summary-item">
      <span class="route-color-dot" style="background:${color}"></span>
      <span>${esc(r.asset_name || '?')}<br>
        <em>&rarr;</em> ${esc(r.casualty_name || '?')}<br>
        <em>&rarr;</em> ${esc(r.destination_name || '?')}</span>
      <span class="route-eta">${eta}<br><span class="med-label">${t('routes.min')}</span></span>
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