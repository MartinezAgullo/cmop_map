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
let markers          = [];
let allEntities      = [];
let filteredEntities = [];
let selectedId       = null;

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

function normalizeCountry(country) {
  if (!country) return '';
  return country
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
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
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initScenarios();
  loadEntities();
  setupEventListeners();
});

function initMap() {
  map = L.map('map').setView([39.47, -0.38], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  map.on('click', (e) => {
    if (document.getElementById('formModal').classList.contains('show')) {
      document.getElementById('latitud').value  = e.latlng.lat.toFixed(6);
      document.getElementById('longitud').value = e.latlng.lng.toFixed(6);
    }
  });
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

  // Dynamic tipo_elemento dropdown in modal
  document.getElementById('categoria').addEventListener('change', (e) => {
    updateTipoElementoOptions(e.target.value);
  });
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
  ]
};

function updateTipoElementoOptions(categoria) {
  const group  = document.getElementById('tipoElementoGroup');
  const select = document.getElementById('tipoElemento');

  if (!TIPO_ELEMENTO_OPTIONS[categoria]) {
    group.style.display = 'none';
    select.innerHTML = '<option value="">— Selecciona tipo —</option>';
    return;
  }

  group.style.display = 'block';
  select.innerHTML = '<option value="">— Selecciona tipo —</option>' +
    TIPO_ELEMENTO_OPTIONS[categoria]
      .map(opt => `<option value="${opt.value}">${opt.label}</option>`)
      .join('');
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

  filteredEntities = allEntities.filter(e => {
    // Category filter (empty = all)
    if (selectedCategories.length > 0) {
      if (!selectedCategories.includes(e.categoria)) return false;
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
          ${e.medical.evac_priority || ''}
          · ${e.medical.evac_stage || 'unknown'}
        </div>`;
    }

    // Build categoria display with tipo_elemento
    let categoriaText = e.categoria;
    if (e.tipo_elemento) {
      categoriaText += ` · ${e.tipo_elemento}`;
    }
    categoriaText += ` · ${e.alliance || 'unknown'}`;
    if (e.country) {
      categoriaText += ` · ${e.country}`;
    }

    return `
      <div class="punto-item${activeClass}${triageClass}" onclick="selectEntity(${e.id})">
        <div class="punto-nombre">
          <span class="pill" style="background:${allianceColor}"></span>
          ${e.nombre}
        </div>
        <span class="punto-categoria">${categoriaText}</span>
        ${medicalBadge}
      </div>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Map markers
// ---------------------------------------------------------------------------
async function renderMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  for (const e of filteredEntities) {
    const icon   = await makeIcon(e);
    const marker = L.marker([e.latitud, e.longitud], { icon })
      .addTo(map)
      .bindPopup(buildPopup(e), { className: 'custom-popup' });

    marker.on('click', () => selectEntity(e.id));
    markers.push(marker);
  }

  if (markers.length > 0) {
    map.fitBounds(new L.featureGroup(markers).getBounds().pad(0.1));
  }
}

// ---------------------------------------------------------------------------
// Popup
// ---------------------------------------------------------------------------
function buildPopup(e) {
  const allianceColor = ALLIANCE_COLORS[e.alliance || 'unknown'] || '#A9A9A9';

  // Build subtitle
  let categoriaDisplay = e.categoria;
  if (e.tipo_elemento) {
    categoriaDisplay += ` · ${e.tipo_elemento}`;
  }
  categoriaDisplay += ` · ${e.alliance || 'unknown'}`;
  if (e.country) {
    categoriaDisplay += ` · ${e.country}`;
  }

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
          <span class="med-label">Priority</span>
          <span class="med-value">${m.evac_priority || '—'}</span>
        </div>
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

    const res  = await fetch('/api/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showMessage('Entidad creada', 'success');
      cerrarFormularioNuevoPunto();
      await loadEntities();
    } else {
      showMessage(data.message || 'Error al crear', 'error');
    }
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