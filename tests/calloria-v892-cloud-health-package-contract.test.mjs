import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('v8.6 read-only cloud-health regression command is restored exactly', () => {
  assert.equal(
    pkg.scripts?.['verify:workforce-cloud-health'],
    'node --test tests/workforce-trend-cloud-health-v806.test.mjs'
  );
});

test('Vercel protected prebuild and check scripts remain exact', () => {
  assert.equal(
    pkg.scripts?.prebuild,
    'node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs'
  );
  assert.equal(
    pkg.scripts?.check,
    'node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs'
  );
});

test('Node and dependency contract remains unchanged', () => {
  assert.equal(pkg.engines?.node, '22.x');
  assert.equal(pkg.dependencies?.['@supabase/supabase-js'], '2.119.0');
  assert.equal(pkg.dependencies?.three, '0.170.0');
  assert.equal(pkg.devDependencies?.vite, '6.4.5');
  assert.equal(pkg.devDependencies?.esbuild, '0.25.12');
  assert.equal(pkg.allowScripts?.['esbuild@0.25.12'], true);
});
