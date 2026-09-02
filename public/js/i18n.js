// i18n.js — UI strings for CMOP Map.
//
// One dictionary per language, flat dotted keys. Nothing here knows about the
// DOM beyond the three attributes applyI18n() understands:
//
//   data-i18n="key"        → textContent
//   data-i18n-ph="key"     → placeholder
//   data-i18n-label="key"  → label   (used on <optgroup>)
//
// Strings built at runtime (messages, popups, the roster) call t('key', vars)
// directly. Interpolation is {name}.
// ---------------------------------------------------------------------------

const I18N = {
  en: {
    'theme.light': 'LIGHT',
    'theme.dark':  'DARK',

    'scenario.label':   'SCN',
    'scenario.loading': 'Loading scenarios…',
    'scenario.pick':    'Select a scenario',
    'scenario.load':    'Load',

    'ladder.title':  'Triage',
    'ladder.totals': '{cas} casualties / {all} tracked',

    'tab.roster':  'Roster',
    'tab.filters': 'Filters',
    'tab.medevac': 'MEDEVAC',

    'roster.sorted':     'Sorted by urgency',
    'roster.filtered':   '{label} only',
    'roster.clear':      'Clear filters',
    'roster.empty':      'No entities match',
    'roster.elapsed':    'Since report',

    'filter.search':            'Search',
    'filter.searchPlaceholder': 'Callsign, unit, country…',
    'filter.categories':        'Categories',
    'filter.alliance':          'Alliance',
    'filter.triageLevel':       'Triage level',
    'filter.facilityRole':      'Facility role',
    'filter.medevacRole':       'MEDEVAC role',

    'action.clear':   'Clear',
    'action.cancel':  'Cancel',
    'action.loading': 'Loading',
    'action.delete':  'Delete',

    'cat.casualty':         'Casualty',
    'cat.medical_facility': 'Med facility',
    'cat.medevac_unit':     'MEDEVAC',
    'cat.casevac':          'CASEVAC eligible',
    'cat.infantry':         'Infantry',
    'cat.armoured':         'Armoured',
    'cat.artillery':        'Artillery',
    'cat.recon':            'Recon',
    'cat.engineer':         'Engineer',
    'cat.mortar':           'Mortar',
    'cat.helicopter':       'Helicopter',
    'cat.transport':        'Transport',
    'cat.aircraft':         'Aircraft',
    'cat.fighter':          'Fighter',
    'cat.bomber':           'Bomber',
    'cat.missile':          'Missile',
    'cat.ship':             'Ship',
    'cat.destroyer':        'Destroyer',
    'cat.submarine':        'Submarine',
    'cat.ground_vehicle':   'Ground veh.',
    'cat.person':           'Person',
    'cat.base':             'Base',
    'cat.building':         'Building',
    'cat.infrastructure':   'Infrastructure',

    'triage.t1':      'T1 Immediate',
    'triage.t2':      'T2 Urgent',
    'triage.t3':      'T3 Minimal',
    'triage.t4':      'T4 Expectant',
    'triage.dead':    'Dead',
    'triage.unknown': 'Unknown',

    'role.f1':     'Role 1 — Aid post',
    'role.f2':     'Role 2 — Surgical',
    'role.f3':     'Role 3 — Field hospital',
    'role.f4':     'Role 4 — Definitive',
    'role.fOther': 'Other (R2B/R2E/Multi)',
    'role.m1':     'Role 1 — Immediate',
    'role.m2':     'Role 2 — Forward',
    'role.m3':     'Role 3 — Theater',
    'role.m4':     'Role 4 — Definitive',
    'role.mOther': 'Other (FW/Amb/Mech/Mort)',

    'alliance.friendly': 'Friendly',
    'alliance.hostile':  'Hostile',
    'alliance.neutral':  'Neutral',
    'alliance.unknown':  'Unknown',

    'map.newEntity': 'New entity',
    'map.fit':       'Fit',
    'map.addHere':   'Add new entity here',

    'live.connected': 'LIVE {n}s',
    'live.waiting':   'LIVE',
    'live.lost':      'RECONNECTING',

    'routes.plan':            'Plan',
    'routes.taskPlaceholder': 'Task ID…',
    'routes.load':            'Load',
    'routes.refresh':         'Refresh',
    'routes.clear':           'Clear routes',
    'routes.loading':         'Loading…',
    'routes.needTask':        'Enter a Task ID.',
    'routes.pending':         'The plan is still running.',
    'routes.none':            'No routes in this plan.',
    'routes.error':           'Error: {detail}',
    'routes.min':             'min',

    'sim.start':       'Run',
    'sim.stop':        'Stop',
    'sim.resume':      'Resume',
    'sim.restart':     'Restart',
    'sim.needPlan':    'Load a route plan first',
    'sim.started':     'Simulation running',
    'sim.resumed':     'Simulation resumed',
    'sim.restarted':   'Simulation restarted',
    'sim.failStart':   'Could not start the simulation',
    'sim.failStop':    'Could not stop the simulation',
    'sim.failResume':  'Could not resume the simulation',
    'sim.failRestart': 'Could not restart the simulation',

    'msg.scenarioFirst':  'Select a scenario first',
    'msg.scenarioLoaded': 'Scenario "{name}" loaded',
    'msg.scenarioError':  'Could not load the scenario',
    'msg.entitiesError':  'Could not load entities',
    'msg.connError':      'Connection failed',
    'msg.entityCreated':  'Entity created',
    'msg.entityDeleted':  'Entity deleted',
    'msg.createError':    'Could not create the entity',
    'msg.deleteError':    'Could not delete the entity',
    'msg.confirmDelete':  'Delete this entity? This cannot be undone.',

    'popup.medical':     'Medical',
    'popup.triage':      'Triage',
    'popup.status':      'Status',
    'popup.stage':       'Stage',
    'popup.mechanism':   'Mechanism',
    'popup.injury':      'Injury',
    'popup.destination': 'Destination',
    'popup.treatment':   'Pre-hosp tx',
    'popup.elapsed':     'Since report',
    'popup.obs':         'Obs',
    'popup.casevac':     'CASEVAC eligible',
    'popup.legPickup':   'Pickup leg',
    'popup.legDelivery': 'Delivery leg',
    'popup.legPoi':      'Pickup point',
    'popup.asset':       'Asset',
    'popup.casualty':    'Casualty',
    'popup.pickupEta':   'Pickup',
    'popup.deliveryEta': 'Delivery',
    'popup.totalEta':    'Total ETA',

    'form.title':           'New entity',
    'form.name':            'Name *',
    'form.description':     'Description',
    'form.category':        'Category *',
    'form.categoryPick':    'Select a category',
    'form.grpMilitary':     'Military',
    'form.grpMedical':      'Medical & MEDEVAC',
    'form.grpCasualties':   'Casualties',
    'form.elementType':     'Element type *',
    'form.elementTypePick': 'Select type',
    'form.mobility':        'Mobility',
    'form.pick':            'Select',
    'form.casevac':         'CASEVAC eligible — can carry out improvised evacuations',
    'form.casualtyStatus':  'Casualty status *',
    'form.triage':          'Triage *',
    'form.mechanism':       'Injury mechanism',
    'form.primaryInjury':   'Primary injury',
    'form.primaryInjuryPh': 'Describe the primary injury…',
    'form.country':         'Country',
    'form.alliance':        'Alliance *',
    'form.lat':             'Latitude *',
    'form.lng':             'Longitude *',
    'form.save':            'Save entity',

    'mobility.air':    'Air',
    'mobility.ground': 'Ground',
    'mobility.sea':    'Sea',

    'status.wia':     'WIA — Wounded in action',
    'status.kia':     'KIA — Killed in action',
    'status.unknown': 'UNKNOWN'
  },

  es: {
    'theme.light': 'CLARO',
    'theme.dark':  'OSCURO',

    'scenario.label':   'ESC',
    'scenario.loading': 'Cargando escenarios…',
    'scenario.pick':    'Selecciona un escenario',
    'scenario.load':    'Cargar',

    'ladder.title':  'Triaje',
    'ladder.totals': '{cas} bajas / {all} entidades',

    'tab.roster':  'Listado',
    'tab.filters': 'Filtros',
    'tab.medevac': 'MEDEVAC',

    'roster.sorted':   'Por urgencia',
    'roster.filtered': 'Solo {label}',
    'roster.clear':    'Quitar filtros',
    'roster.empty':    'Ninguna entidad coincide',
    'roster.elapsed':  'Desde el parte',

    'filter.search':            'Buscar',
    'filter.searchPlaceholder': 'Indicativo, unidad, país…',
    'filter.categories':        'Categorías',
    'filter.alliance':          'Alianza',
    'filter.triageLevel':       'Nivel de triaje',
    'filter.facilityRole':      'Rol de instalación',
    'filter.medevacRole':       'Rol MEDEVAC',

    'action.clear':   'Quitar',
    'action.cancel':  'Cancelar',
    'action.loading': 'Cargando',
    'action.delete':  'Eliminar',

    'cat.casualty':         'Baja',
    'cat.medical_facility': 'Instalación',
    'cat.medevac_unit':     'MEDEVAC',
    'cat.casevac':          'Apto CASEVAC',
    'cat.infantry':         'Infantería',
    'cat.armoured':         'Acorazado',
    'cat.artillery':        'Artillería',
    'cat.recon':            'Reconocimiento',
    'cat.engineer':         'Ingenieros',
    'cat.mortar':           'Mortero',
    'cat.helicopter':       'Helicóptero',
    'cat.transport':        'Transporte',
    'cat.aircraft':         'Aeronave',
    'cat.fighter':          'Caza',
    'cat.bomber':           'Bombardero',
    'cat.missile':          'Misil',
    'cat.ship':             'Buque',
    'cat.destroyer':        'Destructor',
    'cat.submarine':        'Submarino',
    'cat.ground_vehicle':   'Veh. terrestre',
    'cat.person':           'Persona',
    'cat.base':             'Base',
    'cat.building':         'Edificio',
    'cat.infrastructure':   'Infraestructura',

    'triage.t1':      'T1 Inmediato',
    'triage.t2':      'T2 Urgente',
    'triage.t3':      'T3 Leve',
    'triage.t4':      'T4 Expectante',
    'triage.dead':    'Fallecido',
    'triage.unknown': 'Desconocido',

    'role.f1':     'Rol 1 — Puesto de socorro',
    'role.f2':     'Rol 2 — Quirúrgico',
    'role.f3':     'Rol 3 — Hospital de campaña',
    'role.f4':     'Rol 4 — Definitivo',
    'role.fOther': 'Otro (R2B/R2E/Multi)',
    'role.m1':     'Rol 1 — Inmediato',
    'role.m2':     'Rol 2 — Avanzado',
    'role.m3':     'Rol 3 — Teatro',
    'role.m4':     'Rol 4 — Definitivo',
    'role.mOther': 'Otro (FW/Amb/Mec/Mort)',

    'alliance.friendly': 'Propio',
    'alliance.hostile':  'Hostil',
    'alliance.neutral':  'Neutral',
    'alliance.unknown':  'Desconocido',

    'map.newEntity': 'Nueva entidad',
    'map.fit':       'Encuadrar',
    'map.addHere':   'Añadir entidad aquí',

    'live.connected': 'EN VIVO {n}s',
    'live.waiting':   'EN VIVO',
    'live.lost':      'RECONECTANDO',

    'routes.plan':            'Plan',
    'routes.taskPlaceholder': 'Task ID…',
    'routes.load':            'Cargar',
    'routes.refresh':         'Actualizar',
    'routes.clear':           'Quitar rutas',
    'routes.loading':         'Cargando…',
    'routes.needTask':        'Introduce un Task ID.',
    'routes.pending':         'El plan aún se está ejecutando.',
    'routes.none':            'No hay rutas en este plan.',
    'routes.error':           'Error: {detail}',
    'routes.min':             'min',

    'sim.start':       'Simular',
    'sim.stop':        'Detener',
    'sim.resume':      'Reanudar',
    'sim.restart':     'Reiniciar',
    'sim.needPlan':    'Carga primero un plan de rutas',
    'sim.started':     'Simulación en marcha',
    'sim.resumed':     'Simulación reanudada',
    'sim.restarted':   'Simulación reiniciada',
    'sim.failStart':   'No se pudo iniciar la simulación',
    'sim.failStop':    'No se pudo detener la simulación',
    'sim.failResume':  'No se pudo reanudar la simulación',
    'sim.failRestart': 'No se pudo reiniciar la simulación',

    'msg.scenarioFirst':  'Selecciona primero un escenario',
    'msg.scenarioLoaded': 'Escenario "{name}" cargado',
    'msg.scenarioError':  'No se pudo cargar el escenario',
    'msg.entitiesError':  'No se pudieron cargar las entidades',
    'msg.connError':      'Fallo de conexión',
    'msg.entityCreated':  'Entidad creada',
    'msg.entityDeleted':  'Entidad eliminada',
    'msg.createError':    'No se pudo crear la entidad',
    'msg.deleteError':    'No se pudo eliminar la entidad',
    'msg.confirmDelete':  '¿Eliminar esta entidad? No se puede deshacer.',

    'popup.medical':     'Sanitario',
    'popup.triage':      'Triaje',
    'popup.status':      'Estado',
    'popup.stage':       'Fase',
    'popup.mechanism':   'Mecanismo',
    'popup.injury':      'Lesión',
    'popup.destination': 'Destino',
    'popup.treatment':   'Tto. prehosp.',
    'popup.elapsed':     'Desde el parte',
    'popup.obs':         'Obs',
    'popup.casevac':     'Apto CASEVAC',
    'popup.legPickup':   'Trayecto de recogida',
    'popup.legDelivery': 'Trayecto de entrega',
    'popup.legPoi':      'Punto de recogida',
    'popup.asset':       'Vehículo',
    'popup.casualty':    'Baja',
    'popup.pickupEta':   'Recogida',
    'popup.deliveryEta': 'Entrega',
    'popup.totalEta':    'ETA total',

    'form.title':           'Nueva entidad',
    'form.name':            'Nombre *',
    'form.description':     'Descripción',
    'form.category':        'Categoría *',
    'form.categoryPick':    'Selecciona una categoría',
    'form.grpMilitary':     'Militar',
    'form.grpMedical':      'Sanitario y MEDEVAC',
    'form.grpCasualties':   'Bajas',
    'form.elementType':     'Tipo de elemento *',
    'form.elementTypePick': 'Selecciona tipo',
    'form.mobility':        'Movilidad',
    'form.pick':            'Selecciona',
    'form.casevac':         'Apto CASEVAC — puede realizar evacuaciones improvisadas',
    'form.casualtyStatus':  'Estado de la baja *',
    'form.triage':          'Triaje *',
    'form.mechanism':       'Mecanismo de lesión',
    'form.primaryInjury':   'Lesión principal',
    'form.primaryInjuryPh': 'Describe la lesión principal…',
    'form.country':         'País',
    'form.alliance':        'Alianza *',
    'form.lat':             'Latitud *',
    'form.lng':             'Longitud *',
    'form.save':            'Guardar entidad',

    'mobility.air':    'Aéreo',
    'mobility.ground': 'Terrestre',
    'mobility.sea':    'Marítimo',

    'status.wia':     'WIA — Herido en acción',
    'status.kia':     'KIA — Muerto en acción',
    'status.unknown': 'UNKNOWN — Desconocido'
  }
};

let _lang = 'en';

function getLang() {
  return _lang;
}

/** Translate a key, interpolating {placeholders} from `vars`. */
function t(key, vars) {
  const dict = I18N[_lang] || I18N.en;
  let s = dict[key] ?? I18N.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  }
  return s;
}

/** Rewrite every translatable node in the document. */
function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  root.querySelectorAll('[data-i18n-label]').forEach(el => {
    el.label = t(el.dataset.i18nLabel);
  });
  document.documentElement.lang = _lang;
}

/**
 * Set the active language, persist it, re-render the static DOM and let the
 * caller re-render everything built at runtime.
 */
function setLang(lang, onChange) {
  _lang = I18N[lang] ? lang : 'en';
  localStorage.setItem('cmop-lang', _lang);

  document.querySelectorAll('#langToggle button').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.lang === _lang));
  });

  applyI18n();
  if (typeof onChange === 'function') onChange();
}

/** Read the stored language (default English) without touching the DOM. */
function initLangValue() {
  _lang = I18N[localStorage.getItem('cmop-lang')] ? localStorage.getItem('cmop-lang') : 'en';
  return _lang;
}
