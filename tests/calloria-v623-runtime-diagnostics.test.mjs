import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  calloriaCC0StaffGLBBundlePlugin,
  __calloriaCC0StaffGLBBundleTest as internals
} from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function readFixture() {
  return fs.readFileSync(path.join(here, 'fixtures', 'glb-world-integration-v12.fixture.js'), 'utf8');
}

test('runtime report distinguishes unavailable assets from bundled assets', () => {
  const payload = internals.makeRuntimeDiagnosticsPayload({
    generatedAt: '2026-11-12T12:00:00.000Z',
    entries: [
      { id: 'female-agent', name: 'OfficeLady', role: 'Agent', output: '/assets/models/female-agent.glb', status: 'downloaded-and-compatible', sizeBytes: 1200, renderMode: 'static-mesh', dimensions: { x: 0.5, y: 1.7, z: 0.4 }, triangleCount: 400, animationCount: 0, boneCount: 0, url: 'https://private.example/ignored' },
      { id: 'mr-r', name: 'OfficeManager', output: '/assets/models/mr-r.glb', status: 'unavailable', sizeBytes: 0, error: 'fixture validation error' }
    ],
    runtime: {
      staff: { status: 'skipped', source: '/js/glb-world-integration.js', warnings: ['anchor contract changed'] },
      office: { status: 'patched', source: '/js/production-world.js' }
    }
  });
  assert.equal(payload.bundle.expectedAssets, 5);
  assert.equal(payload.bundle.bundledAssets, 1);
  assert.equal(payload.bundle.unavailableAssets, 1);
  assert.equal(payload.bundle.totalBytes, 1200);
  assert.equal(payload.runtime.staff.status, 'skipped');
  assert.match(payload.runtime.staff.warnings[0], /anchor contract/);
  assert.equal(payload.runtime.office.status, 'patched');
  assert.equal('url' in payload.assets[0], false);
  assert.match(payload.notice, /does not prove/i);
});

test('diagnostics page performs a bounded GLB range probe and avoids claiming scene rendering', () => {
  const html = internals.makeRuntimeDiagnosticsHtml();
  assert.match(html, /calloria-staff-glb-diagnostics\.json/);
  assert.match(html, /Range/);
  assert.match(html, /bytes=0-3/);
  assert.match(html, /does not claim/i);
  assert.match(html, /Staff GLB Runtime Audit/);
});

test('Vite plugin emits deployment JSON and HTML with observed integration failures', () => {
  const plugin = calloriaCC0StaffGLBBundlePlugin();
  const emitted = [];
  const ctx = { warn() {}, info() {}, emitFile: (file) => emitted.push(file) };
  plugin.transform.call(ctx, 'export const version = 1;', '/repo/js/glb-world-integration.js');
  plugin.transform.call(ctx, 'export const version = 1;', '/repo/js/production-world.js');
  plugin.generateBundle.call(ctx);

  const jsonAsset = emitted.find((file) => file.fileName === internals.RUNTIME_DIAGNOSTICS_JSON);
  const htmlAsset = emitted.find((file) => file.fileName === internals.RUNTIME_DIAGNOSTICS_HTML);
  assert.ok(jsonAsset);
  assert.ok(htmlAsset);
  assert.match(htmlAsset.source, /Recheck files/);
  const report = JSON.parse(jsonAsset.source);
  assert.equal(report.runtime.staff.status, 'skipped');
  assert.equal(report.runtime.office.status, 'skipped');
  assert.match(report.runtime.staff.message, /No eligible staff GLB/);
  assert.equal(report.bundle.bundledAssets, 0);
});

test('existing v1.2 staff integration source still transforms with the v6.23 diagnostic build', () => {
  const transformed = internals.transformStaffRuntimeIntegration(
    readFixture(),
    ['female-agent'],
    { 'female-agent': 'static-mesh' }
  );
  assert.ok(transformed?.code);
  assert.match(transformed.code, new RegExp(internals.MARKER));
  assert.match(transformed.code, /assetsInUse/);
});
