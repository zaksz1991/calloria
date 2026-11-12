import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { transformStaffRuntimeIntegration, __calloriaCC0StaffGLBBundleTest as internals } from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = await readFile(path.join(here, 'fixtures/glb-world-integration-v12.fixture.js'), 'utf8');
const ids = ['female-agent', 'male-agent', 'gp5-woman'];
const modes = { 'female-agent': 'static-mesh', 'male-agent': 'skinned-static-pose', 'gp5-woman': 'animated-skinned' };
const transformed = transformStaffRuntimeIntegration(fixture, ids, modes);

test('v6.29 defines separate low, balanced and high idle budgets', () => {
  assert.ok(transformed.code);
  assert.match(transformed.code, /tier === 'low' \? 12 : tier === 'high' \? 30 : 20/);
  assert.match(transformed.code, /adaptiveIdleUpdateHz: proceduralIdleUpdateHz/);
  assert.match(transformed.code, /idleUpdateTier: tier/);
});

test('visibility hierarchy is checked at four times per second, not every render frame', () => {
  assert.match(transformed.code, /const proceduralIdleVisibilityInterval = 0\.25/);
  assert.match(transformed.code, /idle\.visibilityAccumulator -= step/);
  assert.match(transformed.code, /idle\.visibilityAccumulator = proceduralIdleVisibilityInterval/);
  assert.match(transformed.code, /if \(!idle\.visibleInScene\) continue/);
});

test('idle controllers are phase-staggered to avoid a same-frame update burst', () => {
  assert.match(transformed.code, /updateAccumulator: \(replacements\.length % 4\) \* \(1 \/ proceduralIdleUpdateHz \/ 4\)/);
});

test('scheduler preserves accumulated time rather than discarding interval remainder', () => {
  assert.match(transformed.code, /const idleInterval = 1 \/ proceduralIdleUpdateHz/);
  assert.match(transformed.code, /idle\.updateAccumulator = Math\.max\(0, idle\.updateAccumulator - idleInterval\)/);
  assert.match(transformed.code, /const idleStep = Math\.min\(idle\.updateAccumulator, 0\.1\)/);
});

test('hidden documents still pause all procedural staff-idle work', () => {
  assert.match(transformed.code, /typeof document === 'undefined' \|\| !document\.hidden/);
});

test('authored animation mixers continue to update through the original mixer path', () => {
  assert.match(transformed.code, /for \(const mixer of mixers\) mixer\.update\(step\)/);
  assert.match(transformed.code, /mixer\.clipAction\(clip\)\.reset\(\)\.play\(\)/);
});

test('scheduler status reports the active tier and visibility-cache interval', () => {
  assert.match(transformed.code, /idleVisibilityCacheMs: 250/);
  assert.match(transformed.code, /adaptiveIdleUpdateHz: proceduralIdleUpdateHz/);
});

test('no new animation frame loop or renderer is introduced', () => {
  assert.equal((transformed.code.match(/requestAnimationFrame/g) || []).length, (fixture.match(/requestAnimationFrame/g) || []).length);
  assert.equal((transformed.code.match(/new T\.WebGLRenderer/g) || []).length, (fixture.match(/new T\.WebGLRenderer/g) || []).length);
});

test('v6.29 transform stays idempotent and fails closed for unknown runtime signatures', () => {
  const second = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.equal(second.code, transformed.code);
  assert.equal(second.alreadyPatched, true);
  const invalid = transformStaffRuntimeIntegration('export function integrateCalloriaGLBStaff(){ return null; }', ids, modes);
  assert.equal(invalid.code, null);
  assert.ok(invalid.warnings?.length);
});

test('standalone scheduler transform is idempotent', () => {
  const once = internals.addTierAwareStaffIdleScheduler(transformed.code);
  assert.equal(once.code, transformed.code);
  assert.equal(once.alreadyPatched, true);
});
