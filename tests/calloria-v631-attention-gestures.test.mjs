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

test('v6.31 adds slow attention glances only to recognised head bones', () => {
  assert.match(transformed.code, /pattern: 'attention-glance'/);
  assert.match(transformed.code, /amplitude: 0\.018, speed: 0\.15/);
});

test('v6.31 adds an occasional short listening nod rather than continuous head bobbing', () => {
  assert.match(transformed.code, /pattern: 'attention-nod'/);
  assert.match(transformed.code, /period: 15/);
  assert.match(transformed.code, /const nodWindow = 0\.12/);
  assert.match(transformed.code, /Math\.sin\(Math\.PI \* cyclePosition \/ nodWindow\)/);
});

test('neck counter-rotation is synchronised with the head nod pulse', () => {
  assert.match(transformed.code, /pattern: 'attention-counter-nod'/);
  assert.match(transformed.code, /amplitude: -0\.0045, period: 15/);
  assert.match(transformed.code, /channel\.pattern === 'attention-nod' \|\| channel\.pattern === 'attention-counter-nod'/);
});

test('attention channels preserve per-bone bind quaternions and local-space composition', () => {
  assert.match(transformed.code, /target\.bone\.quaternion\.copy\(target\.baseQuaternion\)/);
  assert.match(transformed.code, /target\.bone\.quaternion\.multiply\(channel\.deltaQuaternion\)/);
  assert.match(transformed.code, /pattern: spec\.pattern \|\| 'sine'/);
});

test('runtime status separates attention gesture staff and bone target counts', () => {
  assert.match(transformed.code, /proceduralIdleAttentionTargets: idleBoneTargets\.filter/);
  assert.match(transformed.code, /attentionGestureStaffPlaced:/);
  assert.match(transformed.code, /attentionGestureBoneTargets:/);
});

test('authored animation clips remain on the original mixer path and skip procedural attention idle', () => {
  assert.match(transformed.code, /const proceduralIdle = !clip && \['skinned-static-pose', 'static-mesh'\]\.includes\(selectedRenderMode\)/);
  assert.match(transformed.code, /if \(clip\) \{\s*mixer = new T\.AnimationMixer\(clonedRoot\)/);
  assert.match(transformed.code, /for \(const mixer of mixers\) mixer\.update\(step\)/);
});

test('attention gestures remain bounded by the existing graphics-tier scheduler and visibility gate', () => {
  assert.match(transformed.code, /const proceduralIdleUpdateHz = tier === 'low' \? 12 : tier === 'high' \? 30 : 20/);
  assert.match(transformed.code, /if \(!idle\.visibleInScene\) continue/);
  assert.match(transformed.code, /typeof document === 'undefined' \|\| !document\.hidden/);
});

test('v6.31 transform is idempotent and still fails closed on unknown runtime layouts', () => {
  const second = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.equal(second.code, transformed.code);
  assert.equal(second.alreadyPatched, true);
  assert.equal(second.attentionGesturesAdded, true);
  const invalid = transformStaffRuntimeIntegration('export function integrateCalloriaGLBStaff(){ return null; }', ids, modes);
  assert.equal(invalid.code, null);
  assert.ok(invalid.warnings?.length);
});

test('v6.31 adds no second render loop or renderer', () => {
  assert.equal((transformed.code.match(/requestAnimationFrame/g) || []).length, (fixture.match(/requestAnimationFrame/g) || []).length);
  assert.equal((transformed.code.match(/new T\.WebGLRenderer/g) || []).length, (fixture.match(/new T\.WebGLRenderer/g) || []).length);
});
