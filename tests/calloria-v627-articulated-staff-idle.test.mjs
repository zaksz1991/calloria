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

test('v6.27 retains the checked v1.2 staff-runtime integration and adds the new idle marker', () => {
  assert.ok(transformed.code);
  assert.match(transformed.code, new RegExp(internals.MARKER));
  assert.match(transformed.code, new RegExp(internals.PROCEDURAL_IDLE_MARKER));
  assert.match(transformed.code, /const CANDIDATE_IDS = \["female-agent","male-agent","gp5-woman"\]/);
  assert.match(transformed.code, /assetsInUse/);
});

test('static-model morph scanning remains separate from skeleton-only bone idle collection', () => {
  assert.match(transformed.code, /if \(proceduralIdle && clonedRoot\?\.traverse\)/);
  assert.match(transformed.code, /if \(!node\?\.isBone \|\| !node\.quaternion\?\.clone\) return;/);
  assert.match(transformed.code, /if \(!selected \|\| \(!clip && person\.seated\)\) continue;/);
});

test('recognized head, neck, spine and shoulder names receive bounded local rotation channels', () => {
  assert.match(transformed.code, /\(\?:mixamorig\)\?head\$/);
  assert.match(transformed.code, /\(\?:mixamorig\)\?neck\[0-9\]\*/);
  assert.match(transformed.code, /spine\[0-9\]\*\|chest\|upperchest/);
  assert.match(transformed.code, /left\|right/);
  assert.match(transformed.code, /amplitude: 0\.026/);
  assert.match(transformed.code, /amplitude: 0\.011/);
  assert.match(transformed.code, /amplitude: 0\.005/);
});

test('runtime motion restores rest quaternions before applying local bone offsets', () => {
  assert.match(transformed.code, /target\.bone\.quaternion\.copy\(target\.baseQuaternion\)/);
  assert.match(transformed.code, /setFromAxisAngle\(channel\.axis, angle\)/);
  assert.match(transformed.code, /target\.bone\.quaternion\.multiply\(channel\.deltaQuaternion\)/);
  assert.match(transformed.code, /articulated-bone-idle/);
});

test('static meshes and unrecognised rigs retain the low-amplitude root fallback', () => {
  assert.match(transformed.code, /root-idle-fallback/);
  assert.match(transformed.code, /sway \* 0\.006/);
  assert.match(transformed.code, /\* 0\.0025/);
  assert.match(transformed.code, /rootIdleFallbackPlaced:/);
});

test('animated GLBs retain their authored clips and do not receive procedural idle', () => {
  assert.match(transformed.code, /mixer\.clipAction\(clip\)\.reset\(\)\.play\(\)/);
  assert.match(transformed.code, /const proceduralIdle = !clip/);
  assert.match(transformed.code, /articulatedIdlePlaced:/);
  assert.match(transformed.code, /proceduralIdlePlaced:/);
});

test('frame delta remains clamped and no second render loop is introduced', () => {
  assert.match(transformed.code, /const step = Math\.max\(0, Math\.min\(Number\(delta\) \|\| 0, 0\.05\)\)/);
  assert.match(transformed.code, /for \(const idle of proceduralIdleControllers\)/);
  assert.equal((transformed.code.match(/requestAnimationFrame/g) || []).length, (fixture.match(/requestAnimationFrame/g) || []).length);
});

test('cleanup releases the controllers and restores hidden local staff', () => {
  assert.match(transformed.code, /proceduralIdleControllers\.length = 0/);
  assert.match(transformed.code, /entry\.person\.root\.visible = true/);
  assert.match(transformed.code, /if \(entry\.person\.shadow\) entry\.person\.shadow\.visible = true/);
});

test('replacement status separates articulated and root-fallback idle counts', () => {
  assert.match(transformed.code, /let proceduralIdleMode = 'none'/);
  assert.match(transformed.code, /articulatedIdlePlaced/);
  assert.match(transformed.code, /rootIdleFallbackPlaced/);
});

test('transform is idempotent when Vite revisits the same module', () => {
  const second = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.equal(second.alreadyPatched, true);
  assert.equal(second.code, transformed.code);
});

test('unknown source signatures fail closed', () => {
  const result = transformStaffRuntimeIntegration('export function integrateCalloriaGLBStaff(){ return null; }', ids, modes);
  assert.equal(result.code, null);
  assert.ok(result.warnings?.length);
});
