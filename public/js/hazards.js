// public/js/hazards.js
// ---------------------------------------------------------------------------
// Hazard zones on the map: floods, fires and other disasters.
//
// Each zone is one hazard event (a MultiPolygon whose parts may lie apart), drawn
// hatched and semi-transparent in its type's colours, with the event badge at its
// icon point. The Filters tab shows or hides the whole layer and filters by type
// (no type ticked = every type). Types, labels and colours come from the server
// (GET /api/hazard-zones/meta/types, lib/hazard-types.js); nothing is hard-coded
// here. SSE events hazard_zone_changed / hazard_zone_deleted keep it live.
//
// Globals used from app.js / i18n.js: map, t, getLang, esc.
// ---------------------------------------------------------------------------

let hazardLayer  = null;   // L.LayerGroup with every drawn zone and badge
let hazardTypes  = [];     // [{ value, label_en, label_es, code, colors }]
let hazardZones  = [];     // rows from /api/hazard-zones

const HAZARD_PATTERN_PREFIX = 'hz-pattern-';
const SVG_NS = 'http://www.w3.org/2000/svg';

async function initHazards() {
  hazardLayer = L.layerGroup().addTo(map);
  try {
    const res = await fetch('/api/hazard-zones/meta/types').then(r => r.json());
    hazardTypes = res.success ? res.data : [];
  } catch (err) {
    console.warn('Hazard types unavailable', err);
  }
  _buildHazardPatterns();
  _renderHazardTypeFilters();
  document.getElementById('hazardShow').addEventListener('change', renderHazardZones);
  document.getElementById('clearHazardTypes').addEventListener('click', () => {
    document.querySelectorAll('#hazardTypeCheckboxes input').forEach(cb => { cb.checked = false; });
    renderHazardZones();
  });
  await loadHazardZones();
}

async function loadHazardZones() {
  try {
    const res = await fetch('/api/hazard-zones').then(r => r.json());
    hazardZones = res.success ? res.data : [];
  } catch (err) {
    console.warn('Hazard zones unavailable', err);
    hazardZones = [];
  }
  renderHazardZones();
}

/** SSE: a zone was created or changed. */
function onHazardZoneChanged(zone) {
  if (!zone) return;
  const i = hazardZones.findIndex(z => z.id === zone.id);
  if (i >= 0) hazardZones[i] = zone; else hazardZones.push(zone);
  renderHazardZones();
}

/** SSE: a zone was deleted. */
function onHazardZoneDeleted(id) {
  hazardZones = hazardZones.filter(z => z.id !== Number(id));
  renderHazardZones();
}

function renderHazardZones() {
  if (!hazardLayer) return;
  hazardLayer.clearLayers();
  if (!document.getElementById('hazardShow').checked) return;

  const picked = [...document.querySelectorAll('#hazardTypeCheckboxes input:checked')].map(cb => cb.value);
  for (const zone of hazardZones) {
    if (picked.length && !picked.includes(zone.hazard_type)) continue;
    const type  = _hazardType(zone.hazard_type);
    const main  = type ? type.colors[0] : '#888888';
    const popup = _hazardPopup(zone, type);

    L.geoJSON(zone.geometry, {
      style: {
        color:       main,
        weight:      2,
        opacity:     zone.active ? 0.9 : 0.5,
        dashArray:   zone.active ? null : '6 6',   // inactive: on record, no longer avoided
        fillColor:   `url(#${HAZARD_PATTERN_PREFIX}${zone.hazard_type})`,
        fillOpacity: zone.active ? 0.45 : 0.15,
      },
    }).bindPopup(popup, { className: 'custom-popup' }).addTo(hazardLayer);

    if (zone.icon_point) {
      L.marker([zone.icon_point.lat, zone.icon_point.lng], {
        icon: L.divIcon({
          className: 'hazard-badge-wrap',
          html: `<span class="hazard-badge${zone.active ? '' : ' inactive'}" style="--hz:${main}">${esc(type ? type.code : '?')}</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        keyboard: false,
      }).bindPopup(popup, { className: 'custom-popup' }).addTo(hazardLayer);
    }
  }
}

/** Labels follow the language switch: app.js calls this from _rerenderDynamicStrings. */
function rerenderHazardStrings() {
  _renderHazardTypeFilters();
  renderHazardZones();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _hazardType(value) {
  return hazardTypes.find(ht => ht.value === value) || null;
}

function _hazardLabel(type) {
  if (!type) return '?';
  return getLang() === 'es' ? type.label_es : type.label_en;
}

function _hazardPopup(zone, type) {
  const parts = zone.geometry?.coordinates?.length ?? 0;
  const km2   = zone.area_m2 != null ? (zone.area_m2 / 1e6).toFixed(2) : '—';
  return `
    <div class="popup-content" style="--c:${type ? type.colors[0] : 'var(--dim)'}">
      <div class="popup-head">
        <div class="popup-title">${esc(zone.name)}</div>
        <span class="popup-categoria">${esc(_hazardLabel(type))}${zone.active ? '' : ` · ${t('hazard.inactive')}`}</span>
      </div>
      <div class="popup-info">
        ${zone.description ? `<p>${esc(zone.description)}</p>` : ''}
        <p><strong>${t('hazard.area')}:</strong> ${km2} km²</p>
        ${parts > 1 ? `<p><strong>${t('hazard.parts')}:</strong> ${parts}</p>` : ''}
      </div>
    </div>`;
}

/** Hatch fills, one <pattern> per type, in an off-screen SVG the map paths refer to. */
function _buildHazardPatterns() {
  const svg = document.getElementById('hazardPatterns');
  const defs = svg.querySelector('defs');
  defs.replaceChildren();
  for (const type of hazardTypes) {
    const [main, second] = [type.colors[0], type.colors[1] || type.colors[0]];
    const p = document.createElementNS(SVG_NS, 'pattern');
    p.setAttribute('id', HAZARD_PATTERN_PREFIX + type.value);
    p.setAttribute('patternUnits', 'userSpaceOnUse');
    p.setAttribute('width', '12');
    p.setAttribute('height', '12');
    p.setAttribute('patternTransform', 'rotate(45)');
    p.append(
      _rect(0, 12, main, 0.25),     // light wash, so the zone reads as an area
      _rect(0, 3, main, 1),
      _rect(6, 3, second, 1),
    );
    defs.append(p);
  }
}

function _rect(x, width, fill, opacity) {
  const r = document.createElementNS(SVG_NS, 'rect');
  r.setAttribute('x', String(x));
  r.setAttribute('width', String(width));
  r.setAttribute('height', '12');
  r.setAttribute('fill', fill);
  r.setAttribute('fill-opacity', String(opacity));
  return r;
}

function _renderHazardTypeFilters() {
  const box = document.getElementById('hazardTypeCheckboxes');
  const ticked = new Set([...box.querySelectorAll('input:checked')].map(cb => cb.value));
  box.innerHTML = hazardTypes.map(type => `
    <label class="filter-cb"><input type="checkbox" value="${esc(type.value)}"${ticked.has(type.value) ? ' checked' : ''} />
      <span class="hazard-swatch" style="--hz:${type.colors[0]};--hz2:${type.colors[1] || type.colors[0]}"></span>
      <span>${esc(_hazardLabel(type))}</span></label>`).join('');
  box.querySelectorAll('input').forEach(cb => cb.addEventListener('change', renderHazardZones));
}
