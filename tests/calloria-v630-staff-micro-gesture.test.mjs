import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  transformStaffRuntimeIntegration,
  __calloriaCC0StaffGLBBundleTest as internals
} from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = await readFile(path.join(here, 'fixtures/glb-world-integration-v12.fixture.js'), 'utf8');
const ids = ['female-agent', 'male-agent', 'gp5-woman'];
const modes = {
  'female-agent': 'static-mesh',
  'male-agent': 'skinned-static-pose',
  'gp5-woman': 'animated-skinned'
};
const transformed = transformStaffRuntimeIntegration(fixture, ids, modes);

test('v6.30 adds upper-arm micro movement for recognised Mixamo and common rig names', () => {
  assert.ok(transformed.code);
  assert.match(transformed.code, /leftarm\$\|\^upperarml\$\|\^upperarmleft\$/);
  assert.match(transformed.code, /rightarm\$\|\^upperarmr\$\|\^upperarmright\$/);
  assert.match(transformed.code, /amplitude: 0\.012, speed: 0\.53/);
  assert.match(transformed.code, /amplitude: -0\.012, speed: 0\.53/);
});

test('v6.30 adds restrained forearm and lower-arm motion', () => {
  assert.match(transformed.code, /leftforearm/);
  assert.match(transformed.code, /leftlowerarm/);
  assert.match(transformed.code, /rightforearm/);
  assert.match(transformed.code, /amplitude: 0\.009, speed: 0\.71/);
  assert.match(transformed.code, /amplitude: -0\.009, speed: 0\.71/);
});

test('v6.30 adds low-amplitude wrist and hand motion', () => {
  assert.match(transformed.code, /lefthand/);
  assert.match(transformed.code, /righthand/);
  assert.match(transformed.code, /amplitude: 0\.006, speed: 0\.64/);
  assert.match(transformed.code, /amplitude: -0\.006, speed: 0\.64/);
});

test('gesture bones retain and restore their original bind quaternion before each idle update', () => {
  assert.match(transformed.code, /motionType: channelSpecs\.some/);
  assert.match(transformed.code, /: \/arm\|forearm\|lowerarm\|hand\//);
  assert.match(transformed.code, /target\.bone\.quaternion\.copy\(target\.baseQuaternion\)/);
  assert.match(transformed.code, /baseQuaternion: node\.quaternion\.clone\(\)/);
});

test('gesture target counts are exposed in replacement and runtime status data', () => {
  assert.match(transformed.code, /proceduralIdleGestureTargets: idleBoneTargets\.filter/);
  assert.match(transformed.code, /microGestureStaffPlaced:/);
  assert.match(transformed.code, /microGestureBoneTargets:/);
});

test('static-pose idle is extended while authored GLB animation remains on its original mixer path', () => {
  assert.match(transformed.code, /proceduralIdle: !clip && \['skinned-static-pose', 'static-mesh'\]\.includes\(selectedRenderMode\)/);
  assert.match(transformed.code, /mixer\.clipAction\(clip\)\.reset\(\)\.play\(\)/);
  assert.match(transformed.code, /for \(const mixer of mixers\) mixer\.update\(step\)/);
});

test('all additional gestures remain under the existing tier-aware idle scheduler', () => {
  assert.match(transformed.code, /const proceduralIdleUpdateHz = tier === 'low' \? 12 : tier === 'high' \? 30 : 20/);
  assert.match(transformed.code, /idle\.updateAccumulator < idleInterval/);
  assert.match(transformed.code, /if \(!idle\.visibleInScene\) continue/);
  assert.match(transformed.code, /typeof document === 'undefined' \|\| !document\.hidden/);
});

test('v6.30 remains idempotent and rejects unrecognised runtime source layouts', () => {
  const second = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.equal(second.code, transformed.code);
  assert.equal(second.alreadyPatched, true);
  const invalid = transformStaffRuntimeIntegration('export function integrateCalloriaGLBStaff(){ return null; }', ids, modes);
  assert.equal(invalid.code, null);
  assert.ok(invalid.warnings?.length);
});

test('v6.30 keeps a single renderer and animation loop', () => {
  assert.equal((transformed.code.match(/requestAnimationFrame/g) || []).length, (fixture.match(/requestAnimationFrame/g) || []).length);
  assert.equal((transformed.code.match(/new T\.WebGLRenderer/g) || []).length, (fixture.match(/new T\.WebGLRenderer/g) || []).length);
});

test('v6.30 plugin exposes stable named transform helpers for regression inspection', () => {
  assert.equal(typeof internals.addProceduralStaticStaffIdle, 'function');
  assert.equal(typeof internals.addTierAwareStaffIdleScheduler, 'function');
  assert.ok(internals.PROCEDURAL_IDLE_MARKER);
  assert.ok(internals.TIER_AWARE_IDLE_MARKER);
});
