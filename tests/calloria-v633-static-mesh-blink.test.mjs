import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { transformStaffRuntimeIntegration } from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = await readFile(path.join(here, 'fixtures/glb-world-integration-v12.fixture.js'), 'utf8');
const ids = ['female-agent', 'male-agent', 'gp5-woman'];
const modes = { 'female-agent': 'static-mesh', 'male-agent': 'skinned-static-pose', 'gp5-woman': 'animated-skinned' };
const transformed = transformStaffRuntimeIntegration(fixture, ids, modes);

 test('v6.33 transforms the verified staff runtime before adding static facial morph support', () => {
  assert.ok(transformed.code);
  assert.equal(transformed.warnings?.length || 0, 0);
});

test('static-mesh and skinned-static-pose models share the procedural idle traversal gate', () => {
  assert.match(transformed.code, /const proceduralIdle = !clip && \['skinned-static-pose', 'static-mesh'\]\.includes\(selectedRenderMode\)/);
  assert.match(transformed.code, /if \(proceduralIdle && clonedRoot\?\.traverse\)/);
});

test('morph targets are scanned before the skeleton-bone guard', () => {
  const morphScan = transformed.code.indexOf('const morphDictionary = node?.morphTargetDictionary');
  const boneGuard = transformed.code.indexOf('if (!node?.isBone || !node.quaternion?.clone) return;');
  assert.ok(morphScan >= 0);
  assert.ok(boneGuard > morphScan);
});

test('unskinned static-mesh models can bind recognised blink morph targets', () => {
  assert.match(transformed.code, /const morphInfluences = node\?\.morphTargetInfluences/);
  assert.match(transformed.code, /idleBlinkMorphTargets\.push\(\{ mesh: node, index: morphIndex, baseInfluence/);
  assert.match(transformed.code, /blinkMorphTargets: idleBlinkMorphTargets/);
});

test('animated GLBs cannot enter procedural blink updates', () => {
  assert.match(transformed.code, /const proceduralIdle = !clip && \['skinned-static-pose', 'static-mesh'\]\.includes\(selectedRenderMode\)/);
  assert.match(transformed.code, /if \(proceduralIdle && clonedRoot\?\.traverse\)/);
  assert.match(transformed.code, /if \(clip\) \{\s*mixer = new T\.AnimationMixer\(clonedRoot\)/);
});

test('blink indices and influence values remain guarded', () => {
  assert.match(transformed.code, /Number\.isInteger\(morphIndex\)/);
  assert.match(transformed.code, /morphIndex < 0 \|\| morphIndex >= morphInfluences\.length/);
  assert.match(transformed.code, /Number\.isFinite\(baseInfluence\)/);
});

test('the existing tier-aware scheduler still controls blink updates', () => {
  assert.match(transformed.code, /const proceduralIdleUpdateHz = tier === 'low' \? 12 : tier === 'high' \? 30 : 20/);
  assert.match(transformed.code, /if \(!idle\.visibleInScene\) continue/);
});

test('v6.33 remains idempotent and fails closed for changed runtime contracts', () => {
  const second = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.equal(second.code, transformed.code);
  assert.equal(second.alreadyPatched, true);
  const invalid = transformStaffRuntimeIntegration('export function integrateCalloriaGLBStaff(){ return null; }', ids, modes);
  assert.equal(invalid.code, null);
  assert.ok(invalid.warnings?.length);
});
