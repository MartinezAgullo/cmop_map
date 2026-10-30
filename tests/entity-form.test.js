// tests/entity-form.test.js — run with `npm test`
//
// The "New entity" form of public/js/app.js, driven in jsdom the way a user
// drives it: pick a category, fill fields, read what the form shows and sends.

const test   = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

function openForm({ fetch } = {}) {
  const page = loadApp({ fetch });
  const { document, window } = page;
  const $ = id => document.getElementById(id);
  const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));

  return {
    ...page,
    $,
    set(id, value) { $(id).value = value; fire($(id), 'change'); fire($(id), 'input'); },
    pick(categoria) { this.set('categoria', categoria); },
    shown: id => $(id).style.display !== 'none',
    typeOptions: () => [...$('tipoElemento').options].map(o => o.value),
    expectedTypes: categoria => page.run(`(TIPO_ELEMENTO_OPTIONS[${JSON.stringify(categoria)}] || []).map(o => o.value)`),
    allTypeCategories: () => page.run('Object.keys(TIPO_ELEMENTO_OPTIONS)'),
  };
}

test('the element type selector lists every subtype of each category that has them', () => {
  const form = openForm();
  const categories = form.allTypeCategories();
  assert.ok(categories.includes('medical_facility') && categories.includes('medevac_unit'));

  for (const categoria of categories) {
    form.pick(categoria);
    assert.ok(form.shown('tipoElementoGroup'), `${categoria}: selector hidden`);
    assert.deepEqual(form.typeOptions(), ['', ...form.expectedTypes(categoria)], categoria);
  }
});

test('a medical facility offers the Role 1 to Role 4 types', () => {
  const form = openForm();
  form.pick('medical_facility');
  for (const role of ['medical_role_1', 'medical_role_2', 'medical_role_3', 'medical_role_4']) {
    assert.ok(form.typeOptions().includes(role), role);
  }
});

test('every option has a readable label', () => {
  const form = openForm();
  for (const categoria of form.allTypeCategories()) {
    form.pick(categoria);
    for (const option of [...form.$('tipoElemento').options].slice(1)) {
      assert.ok(option.textContent.trim().length > 0, `${categoria}/${option.value}`);
    }
  }
});

test('changing category replaces the subtypes instead of piling them up', () => {
  const form = openForm();
  form.pick('medical_facility');
  form.pick('medevac_unit');
  assert.deepEqual(form.typeOptions(), ['', ...form.expectedTypes('medevac_unit')]);
  assert.ok(!form.typeOptions().includes('medical_role_1'));
});

test('a category without subtypes hides the selector and leaves only the placeholder', () => {
  const form = openForm();
  form.pick('medical_facility');
  form.pick('fighter');
  assert.equal(form.shown('tipoElementoGroup'), false);
  assert.deepEqual(form.typeOptions(), ['']);
});

test('the right extra fields appear for each category', () => {
  const form = openForm();
  const visible = () => ['capacityGroup', 'facilityCapacityGroup', 'headcountGroup',
    'mobilityGroup', 'casevacGroup', 'casualtyMedicalGroup'].filter(form.shown);

  form.set('alliance', 'friendly');
  form.pick('medical_facility');
  assert.deepEqual(visible(), ['facilityCapacityGroup']);
  form.pick('shelter');
  assert.deepEqual(visible(), ['facilityCapacityGroup']);
  form.pick('civilian');
  assert.deepEqual(visible(), ['headcountGroup']);
  form.pick('casualty');
  assert.deepEqual(visible(), ['casualtyMedicalGroup']);
  form.pick('medevac_unit');
  assert.deepEqual(visible(), ['capacityGroup', 'mobilityGroup']);
  form.pick('helicopter');
  assert.deepEqual(visible(), ['capacityGroup', 'casevacGroup']);
  form.pick('fighter');
  assert.deepEqual(visible(), []);
});

test('CASEVAC and vehicle capacity are offered only for friendly forces', () => {
  const form = openForm();
  form.pick('helicopter');
  form.set('alliance', 'hostile');
  assert.equal(form.shown('casevacGroup'), false);
  assert.equal(form.shown('capacityGroup'), false);
  form.set('alliance', 'friendly');
  assert.equal(form.shown('casevacGroup'), true);
  assert.equal(form.shown('capacityGroup'), true);
});

test('changing the alliance keeps the element type options', () => {
  const form = openForm();
  form.pick('medical_facility');
  form.set('alliance', 'hostile');
  assert.deepEqual(form.typeOptions(), ['', ...form.expectedTypes('medical_facility')]);
});

test('the form cannot be saved until the element type is chosen', () => {
  const form = openForm();
  form.set('nombre', 'Aid post');
  form.pick('medical_facility');
  form.set('maxCapacity', '40');
  form.set('latitud', '39.42');
  form.set('longitud', '-0.37');
  assert.equal(form.run('refreshSaveButton()'), false);
  assert.match(form.run('formProblems().missing.join()'), /Element type/);

  form.set('tipoElemento', 'medical_role_2');
  assert.equal(form.run('refreshSaveButton()'), true);
  assert.equal(form.$('saveEntityBtn').getAttribute('aria-disabled'), 'false');
});

test('a facility refuses an occupancy above its places', () => {
  const form = openForm();
  form.pick('shelter');
  form.set('maxCapacity', '10');
  form.set('occupancy', '11');
  assert.deepEqual(form.run('formProblems().refused.length'), 1);
  assert.equal(form.$('occupancyError').hidden, false);
});

test('saving a medical facility posts its element type and places', async () => {
  const sent = [];
  const form = openForm({
    fetch: async (url, init) => {
      if (init?.method === 'POST') sent.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    },
  });
  form.set('nombre', 'Refugio primeros auxilios');
  form.set('alliance', 'friendly');
  form.pick('medical_facility');
  form.set('tipoElemento', 'medical_role_1');
  form.set('maxCapacity', '40');
  form.set('latitud', '39.425221');
  form.set('longitud', '-0.372419');

  await form.run('crearNuevaEntidad()');

  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, '/api/entities');
  assert.deepEqual(sent[0].body, {
    nombre: 'Refugio primeros auxilios', descripcion: '', categoria: 'medical_facility',
    country: '', alliance: 'friendly', latitud: 39.425221, longitud: -0.372419,
    tipo_elemento: 'medical_role_1', max_capacity: 40, occupancy: 0,
  });
});

test('a KIA casualty is posted as triage BLACK without injury details', async () => {
  const sent = [];
  const form = openForm({
    fetch: async (url, init) => {
      if (init?.method === 'POST') sent.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    },
  });
  form.set('nombre', 'Casualty 1');
  form.pick('casualty');
  form.set('casualtyStatus', 'KIA');
  form.set('primaryInjury', 'ignored');
  form.set('latitud', '39.4');
  form.set('longitud', '-0.3');

  await form.run('crearNuevaEntidad()');

  assert.deepEqual(sent[0].medical, { casualty_status: 'KIA', evac_stage: 'at_poi', triage_color: 'BLACK' });
});

test('closing the form clears it and hides the optional fields', () => {
  const form = openForm();
  form.pick('medical_facility');
  form.set('tipoElemento', 'medical_role_1');
  form.run('cerrarFormularioNuevoPunto()');
  assert.equal(form.$('categoria').value, '');
  assert.equal(form.shown('tipoElementoGroup'), false);
  assert.deepEqual(form.typeOptions(), ['']);
});
