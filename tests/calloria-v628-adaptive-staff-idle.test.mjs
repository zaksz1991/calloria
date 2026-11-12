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

test('v6.28 keeps the v6.27 articulated idle and adds adaptive scheduling', () => {
  assert.ok(transformed.code);
  assert.match(transformed.code, new RegExp(internals.PROCEDURAL_IDLE_MARKER));
  assert.match(transformed.code, /adaptiveIdleUpdateHz: 30/);
  assert.match(transformed.code, /idleVisibilityAware: true/);
});

test('procedural idle pauses while the document is hidden', () => {
  assert.match(transformed.code, /typeof document === 'undefined' \|\| !document\.hidden/);
});

test('invisible staff and staff under invisible parents are not pose-updated', () => {
  assert.match(transformed.code, /for \(let node = idle\.wrapper; node; node = node\.parent\)/);
  assert.match(transformed.code, /if \(node\.visible === false\) \{ visibleInScene = false; break; \}/);
  assert.match(transformed.code, /if \(!visibleInScene\) continue;/);
});

test('idle poses update at no more than 30 Hz with bounded accumulated delta', () => {
  assert.match(transformed.code, /idle\.updateAccumulator \+= step/);
  assert.match(transformed.code, /idle\.updateAccumulator < \(1 \/ 30\)/);
  assert.match(transformed.code, /const idleStep = Math\.min\(idle\.updateAccumulator, 0\.1\)/);
  assert.match(transformed.code, /idle\.updateAccumulator = 0/);
  assert.match(transformed.code, /idle\.elapsed \+= idleStep/);
});

test('controller state is initialised and released with the staff runtime', () => {
  assert.match(transformed.code, /updateAccumulator: 0/);
  assert.match(transformed.code, /proceduralIdleControllers\.length = 0/);
});

test('rest quaternions are still restored before local pose offsets', () => {
  assert.match(transformed.code, /target\.bone\.quaternion\.copy\(target\.baseQuaternion\)/);
  assert.match(transformed.code, /target\.bone\.quaternion\.multiply\(channel\.deltaQuaternion\)/);
});

test('no second animation frame loop is added', () => {
  assert.equal((transformed.code.match(/requestAnimationFrame/g) || []).length, (fixture.match(/requestAnimationFrame/g) || []).length);
});

test('transform remains idempotent and fails closed on unknown source signatures', () => {
  const second = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.equal(second.alreadyPatched, true);
  assert.equal(second.code, transformed.code);
  const invalid = transformStaffRuntimeIntegration('export function integrateCalloriaGLBStaff(){ return null; }', ids, modes);
  assert.equal(invalid.code, null);
  assert.ok(invalid.warnings?.length);
});
