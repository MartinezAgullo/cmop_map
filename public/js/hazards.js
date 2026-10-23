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
// Drawing (Leaflet-Geoman, served from public/vendor/geoman): the toolbar draws a
// polygon or a rectangle, and the dialog saves it as a new zone or as one more area
// of an existing zone (PostGIS fuses the areas that overlap). Each separate area of
// a zone is its own map layer, so edit mode reshapes one area and saves the zone on
// leaving the mode, and removal mode deletes that area only (the zone goes with its
// last area). Only the zones are editable (Geoman opt-in), never the entity markers
// or the routes.
//
// Clicks: outside the edit and removal modes a zone's areas are background, so a
// click on a flood opens the add-entity menu like anywhere else on the map; the
// event badge is the zone's handle (its popup activates, deactivates or deletes it).
// The areas take clicks only while one of those two modes is on.
//
// Globals used from app.js / i18n.js: map, t, getLang, esc, showMessage.
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
  document.getElementById('hazardName').addEventListener('input', () => {
    document.getElementById('hazardNameError').hidden = true;
  });
  document.getElementById('clearHazardTypes').addEventListener('click', () => {
    document.querySelectorAll('#hazardTypeCheckboxes input').forEach(cb => { cb.checked = false; });
    renderHazardZones();
  });
  initHazardDrawing();
  await loadHazardZones();
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

let _drawnLayer = null;    // the shape waiting in the dialog

function initHazardDrawing() {
  if (!map.pm) { console.warn('Leaflet-Geoman not loaded: hazard drawing disabled'); return; }
  L.PM.setOptIn(true);     // only layers created with pmIgnore:false are editable
  _setDrawingLang();
  map.pm.addControls({
    position: 'topleft',
    drawPolygon: true, drawRectangle: true,
    editMode: true, removalMode: true,
    drawMarker: false, drawCircleMarker: false, drawPolyline: false, drawCircle: false,
    drawText: false, cutPolygon: false, rotateMode: false, dragMode: false,
  });
  map.pm.setPathOptions({ color: '#E63946', weight: 2, dashArray: '4 4' });
  map.on('pm:create', (e) => _openHazardDialog(e.layer));
  map.on('pm:globaleditmodetoggled pm:globalremovalmodetoggled', _setAreasClickable);
  map.on('pm:remove', (e) => {
    if (e.layer._hazardZoneId) deleteHazardPart(e.layer._hazardZoneId, e.layer._hazardPart);
  });
  // The browser's own title tooltip shows late; move it to data-tip, which the
  // stylesheet shows at once. Delegated, so it survives Geoman rebuilding the toolbar.
  map.getContainer().addEventListener('mouseover', (e) => {
    const box = e.target.closest('.leaflet-pm-toolbar .button-container[title]');
    const btn = box && box.querySelector('.leaflet-buttons-control-button');
    if (btn) { btn.dataset.tip = box.title; box.removeAttribute('title'); }
  });
}

/** Geoman's own strings in the app language, with the toolbar buttons saying what they do here. */
function _setDrawingLang() {
  const lang = getLang() === 'es' ? 'es' : 'en';
  map.pm.setLang(`hazard-${lang}`, {
    buttonTitles: {
      drawPolyButton: t('hazard.tool.polygon'),
      drawRectButton: t('hazard.tool.rectangle'),
      editButton: t('hazard.tool.edit'),
      deleteButton: t('hazard.tool.remove'),
    },
  }, lang);
}

/** The areas take clicks only while Geoman edits or removes them. */
function _areasClickable() {
  return !!map.pm && (map.pm.globalEditModeEnabled() || map.pm.globalRemovalModeEnabled());
}

/** Toggled in place: redrawing would take the layers out of the mode that was just entered. */
function _setAreasClickable() {
  const on = _areasClickable();
  for (const layer of hazardLayer.getLayers()) {
    if (layer._hazardZoneId === undefined) continue;
    layer.options.interactive = on;
    if (layer._path) layer._path.classList.toggle('leaflet-interactive', on);
  }
}

/** True while a Geoman mode is on: map clicks belong to it. */
function isDrawingHazards() {
  if (!map || !map.pm) return false;
  return map.pm.globalDrawModeEnabled() || map.pm.globalEditModeEnabled()
      || map.pm.globalRemovalModeEnabled();
}

function _openHazardDialog(layer) {
  _drawnLayer = layer;
  const target = document.getElementById('hazardTarget');
  target.innerHTML = `<option value="new">${esc(t('hazard.newZone'))}</option>` +
    hazardZones.map(z => `<option value="${z.id}">${esc(z.name)} · ${esc(_hazardLabel(_hazardType(z.hazard_type)))}</option>`).join('');
  target.onchange = () => {
    document.getElementById('hazardNewGroup').style.display = target.value === 'new' ? 'block' : 'none';
  };
  document.getElementById('hazardType').innerHTML = hazardTypes
    .map(ht => `<option value="${esc(ht.value)}">${esc(_hazardLabel(ht))}</option>`).join('');
  document.getElementById('hazardName').value = '';
  document.getElementById('hazardNameError').hidden = true;
  document.getElementById('hazardDesc').value = '';
  target.value = 'new';
  target.onchange();
  document.getElementById('hazardModal').classList.add('show');
}

function cancelHazardArea() {
  document.getElementById('hazardModal').classList.remove('show');
  if (_drawnLayer) map.removeLayer(_drawnLayer);
  _drawnLayer = null;
}

async function saveHazardArea(event) {
  event.preventDefault();
  if (!_drawnLayer) return;
  const drawn  = _drawnLayer.toGeoJSON().geometry;           // a Polygon
  const target = document.getElementById('hazardTarget').value;

  let url, method, body;
  if (target === 'new') {
    const name = document.getElementById('hazardName').value.trim();
    if (!name) {
      document.getElementById('hazardNameError').hidden = false;
      document.getElementById('hazardName').focus();
      return;
    }
    url = '/api/hazard-zones'; method = 'POST';
    body = { name, hazard_type: document.getElementById('hazardType').value,
             description: document.getElementById('hazardDesc').value.trim() || null,
             geometry: drawn };
  } else {
    // One more area of the same event: the zone's parts plus the new one. PostGIS
    // (ST_MakeValid) fuses it with any part it overlaps; apart, it is a new part.
    const zone = hazardZones.find(z => z.id === Number(target));
    url = `/api/hazard-zones/${zone.id}`; method = 'PUT';
    body = { geometry: { type: 'MultiPolygon',
                         coordinates: [...zone.geometry.coordinates, drawn.coordinates] } };
  }
  const ok = await _writeZone(url, method, body);
  if (ok) cancelHazardArea();
}

/** Edit mode changed one area: save the zone as all its areas look on the map now. */
async function _saveEditedZone(id) {
  const coordinates = hazardLayer.getLayers()
    .filter(layer => layer._hazardZoneId === id)
    .sort((a, b) => a._hazardPart - b._hazardPart)
    .map(layer => layer.toGeoJSON().geometry.coordinates);
  await _writeZone(`/api/hazard-zones/${id}`, 'PUT',
                   { geometry: { type: 'MultiPolygon', coordinates } });
}

async function toggleHazardZone(id) {
  const zone = hazardZones.find(z => z.id === id);
  if (zone) await _writeZone(`/api/hazard-zones/${id}`, 'PUT', { active: !zone.active });
}

async function deleteHazardZone(id) {
  const zone = hazardZones.find(z => z.id === id);
  if (!zone || !confirm(t('hazard.confirmDelete', { name: zone.name }))) {
    renderHazardZones();                   // removal mode already took it off the map
    return;
  }
  await _writeZone(`/api/hazard-zones/${id}`, 'DELETE');
}

/** Delete one separate area of a zone; the last one takes the zone with it. */
async function deleteHazardPart(id, part) {
  const zone = hazardZones.find(z => z.id === id);
  if (!zone) { renderHazardZones(); return; }
  const parts = zone.geometry.coordinates;
  if (parts.length <= 1) { await deleteHazardZone(id); return; }
  if (!confirm(t('hazard.confirmDeletePart', { name: zone.name, left: parts.length - 1 }))) {
    renderHazardZones();                   // removal mode already took it off the map
    return;
  }
  await _writeZone(`/api/hazard-zones/${id}`, 'PUT', { geometry: {
    type: 'MultiPolygon', coordinates: parts.filter((_, i) => i !== part) } });
}

/** Write through the API; the SSE event that follows redraws the layer. */
async function _writeZone(url, method, body) {
  try {
    const res  = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!data.success) {
      showMessage(data.message || t('hazard.saveError'), 'error');
      renderHazardZones();
      return false;
    }
    if (data.data) onHazardZoneChanged(data.data);
    else if (method === 'DELETE') onHazardZoneDeleted(data.id);
    return true;
  } catch (err) {
    console.error(err);
    showMessage(t('msg.connError'), 'error');
    return false;
  }
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
    const style = {
      color:       main,
      weight:      2,
      opacity:     zone.active ? 0.9 : 0.5,
      dashArray:   zone.active ? null : '6 6',   // inactive: on record, no longer avoided
      fillColor:   `url(#${HAZARD_PATTERN_PREFIX}${zone.hazard_type})`,
      fillOpacity: zone.active ? 0.45 : 0.15,
    };

    // One layer per separate area, so Geoman edits or removes one area at a time.
    zone.geometry.coordinates.forEach((rings, part) => {
      const layer = L.polygon(rings.map(ring => ring.map(([lng, lat]) => [lat, lng])), {
        ...style,
        pmIgnore: false,                        // editable with the Geoman toolbar
        interactive: _areasClickable(),         // otherwise a click adds an entity here
      });
      layer._hazardZoneId = zone.id;
      layer._hazardPart   = part;
      layer.on('pm:update', () => _saveEditedZone(zone.id));
      layer.addTo(hazardLayer);
    });

    if (zone.icon_point) {
      L.marker([zone.icon_point.lat, zone.icon_point.lng], {
        icon: L.divIcon({
          className: 'hazard-badge-wrap',
          html: `<span class="hazard-badge${zone.active ? '' : ' inactive'}" style="--hz:${main}">${esc(type ? type.code : '?')}</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        keyboard: false,
        pmIgnore: true,
      }).bindPopup(_hazardPopup(zone, type), { className: 'custom-popup' }).addTo(hazardLayer);
    }
  }
}

/** Labels follow the language switch: app.js calls this from _rerenderDynamicStrings. */
function rerenderHazardStrings() {
  if (map && map.pm) _setDrawingLang();
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
      <div class="popup-actions">
        <button type="button" class="btn-danger" onclick="toggleHazardZone(${zone.id})">${t(zone.active ? 'hazard.deactivate' : 'hazard.activate')}</button>
        <button type="button" class="btn-danger" onclick="deleteHazardZone(${zone.id})">${t(parts > 1 ? 'hazard.deleteZone' : 'action.delete')}</button>
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
