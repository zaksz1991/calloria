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

test('v6.26 upgrades the existing v6.22 staff transform without replacing the runtime contract', () => {
  assert.ok(transformed.code);
  assert.match(transformed.code, new RegExp(internals.MARKER));
  assert.match(transformed.code, new RegExp(internals.PROCEDURAL_IDLE_MARKER));
  assert.match(transformed.code, /const CANDIDATE_IDS = \["female-agent","male-agent","gp5-woman"\]/);
  assert.match(transformed.code, /assetsInUse/);
});

test('procedural idle is assigned only to approved static-pose models on standing anchors', () => {
  assert.match(transformed.code, /const proceduralIdle = !clip && \['skinned-static-pose', 'static-mesh'\]\.includes\(selectedRenderMode\)/);
  assert.match(transformed.code, /proceduralIdle: !clip && \['skinned-static-pose', 'static-mesh'\]\.includes\(selectedRenderMode\)/);
  assert.match(transformed.code, /if \(!selected \|\| \(!clip && person\.seated\)\) continue;/);
});

test('static-pose idle uses deliberately small, root-level movement and does not fabricate a source clip', () => {
  assert.match(transformed.code, /sway \* 0\.006/);
  assert.match(transformed.code, /\* 0\.0025/);
  assert.match(transformed.code, /Small root-level motion only; no fabricated bone animation or clip/);
  assert.match(transformed.code, /proceduralIdlePlaced:/);
  assert.doesNotMatch(transformed.code, /AnimationClip\('CALLORIA/);
});

test('animated GLBs retain their real named clip and are not routed through procedural idle', () => {
  assert.match(transformed.code, /const candidateClip = chooseClip\(candidate\.gltf\.animations, Boolean\(person\.seated\)\)/);
  assert.match(transformed.code, /if \(clip\) \{/);
  assert.match(transformed.code, /mixer\.clipAction\(clip\)\.reset\(\)\.play\(\)/);
  assert.match(transformed.code, /const proceduralIdle = !clip/);
});

test('the idle update clamps frame delta and performs no additional render loop', () => {
  assert.match(transformed.code, /const step = Math\.max\(0, Math\.min\(Number\(delta\) \|\| 0, 0\.05\)\)/);
  assert.match(transformed.code, /for \(const idle of proceduralIdleControllers\)/);
  assert.equal((transformed.code.match(/requestAnimationFrame/g) || []).length, (fixture.match(/requestAnimationFrame/g) || []).length);
});

test('cleanup clears idle controllers and retains the existing local-avatar restoration', () => {
  assert.match(transformed.code, /proceduralIdleControllers\.length = 0/);
  assert.match(transformed.code, /entry\.person\.root\.visible = true/);
  assert.match(transformed.code, /if \(entry\.person\.shadow\) entry\.person\.shadow\.visible = true/);
});

test('transform is idempotent for repeated Vite transform passes', () => {
  const second = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.equal(second.alreadyPatched, true);
  assert.equal(second.code, transformed.code);
});

test('unknown source signatures fail closed instead of breaking Vite compilation', () => {
  const result = transformStaffRuntimeIntegration('export function integrateCalloriaGLBStaff(){ return null; }', ids, modes);
  assert.equal(result.code, null);
  assert.ok(result.warnings?.length);
});
