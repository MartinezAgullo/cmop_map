// tests/offline-assets.test.js — run with `npm test`
//
// The map page must load air-gapped: every script, stylesheet and font comes
// from public/, never from a CDN.  The OSM basemap in app.js is the one known
// exception, tracked in the latacc-medevac roadmap ("Offline map page").

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');

const PUBLIC = path.join(__dirname, '..', 'public');
const PAGES  = ['index.html', 'logs.html'];

// src/href attributes that point off the server (http://, https:// or //host)
const EXTERNAL_REF = /\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+["']/gi;

function localRefs(html) {
  return [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["'](\/[^/"'][^"']*)["']/gi)]
    .map(m => m[1]);
}

for (const page of PAGES) {
  const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');

  test(`${page} loads no external scripts, stylesheets or fonts`, () => {
    assert.deepEqual(html.match(EXTERNAL_REF) ?? [], []);
  });

  test(`${page} references only files that exist in public/`, () => {
    for (const ref of localRefs(html)) {
      assert.ok(fs.existsSync(path.join(PUBLIC, ref)), `missing ${ref}`);
    }
  });
}

test('every font in fonts.css exists', () => {
  const dir = path.join(PUBLIC, 'vendor', 'fonts');
  const css = fs.readFileSync(path.join(dir, 'fonts.css'), 'utf8');
  const urls = [...css.matchAll(/url\('\.\/([^']+)'\)/g)].map(m => m[1]);
  assert.ok(urls.length > 0);
  for (const file of urls) assert.ok(fs.existsSync(path.join(dir, file)), `missing ${file}`);
});
