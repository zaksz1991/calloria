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

test('v6.32 discovers only explicitly named eye-blink morph targets', () => {
  assert.match(transformed.code, /const morphDictionary = node\?\.morphTargetDictionary/);
  assert.match(transformed.code, /eyeblink\(\?:left\|right\|l\|r\)\?/);
  assert.match(transformed.code, /blink\(\?:left\|right\|l\|r\)\?/);
  assert.match(transformed.code, /eyesclosed\|eyelidsclosed/);
});

test('morph indices are validated before any influence array access', () => {
  assert.match(transformed.code, /Number\.isInteger\(morphIndex\)/);
  assert.match(transformed.code, /morphIndex < 0 \|\| morphIndex >= morphInfluences\.length/);
  assert.match(transformed.code, /Number\.isFinite\(baseInfluence\)/);
});

test('blink controllers retain the original neutral morph influence', () => {
  assert.match(transformed.code, /baseInfluence: Math\.max\(0, Math\.min\(1, baseInfluence\)\)/);
  assert.match(transformed.code, /target\.baseInfluence \+ \(1 - target\.baseInfluence\) \* blinkWeight/);
});

test('blink periods and phase offsets vary per placed staff member', () => {
  assert.match(transformed.code, /blinkPeriod: 3\.6 \+ \(\(replacements\.length \* 0\.71\) % 1\.8\)/);
  assert.match(transformed.code, /blinkPhase: \(replacements\.length \* 1\.31\) % 2\.4/);
});

test('blink pulse is a short smooth eyelid closure, not continuous facial movement', () => {
  assert.match(transformed.code, /const blinkWindow = 0\.055/);
  assert.match(transformed.code, /Math\.sin\(Math\.PI \* blinkCycle \/ blinkWindow\)/);
  assert.match(transformed.code, /blinkCycle < blinkWindow/);
});

test('only static-pose skinned staff receive the procedural morph controller', () => {
  assert.match(transformed.code, /const proceduralIdle = !clip && \['skinned-static-pose', 'static-mesh'\]\.includes\(selectedRenderMode\)/);
  assert.match(transformed.code, /if \(proceduralIdle && selectedRenderMode === 'skinned-static-pose' && clonedRoot\?\.traverse\)/);
});

test('authored animated GLBs remain on the AnimationMixer path', () => {
  assert.match(transformed.code, /if \(clip\) \{\s*mixer = new T\.AnimationMixer\(clonedRoot\)/);
  assert.match(transformed.code, /for \(const mixer of mixers\) mixer\.update\(step\)/);
});

test('blink morph coverage is reported separately in runtime diagnostics', () => {
  assert.match(transformed.code, /blinkMorphStaffPlaced:/);
  assert.match(transformed.code, /blinkMorphTargets:/);
  assert.match(transformed.code, /proceduralIdleBlinkTargets: idleBlinkMorphTargets\.length/);
});

test('blink updates remain under the existing tier scheduler and visibility gate', () => {
  assert.match(transformed.code, /const proceduralIdleUpdateHz = tier === 'low' \? 12 : tier === 'high' \? 30 : 20/);
  assert.match(transformed.code, /if \(!idle\.visibleInScene\) continue/);
  assert.match(transformed.code, /typeof document === 'undefined' \|\| !document\.hidden/);
});

test('v6.32 transform remains idempotent and fails closed on unknown runtime layouts', () => {
  const second = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.equal(second.code, transformed.code);
  assert.equal(second.alreadyPatched, true);
  assert.equal(second.tierAwareIdleSchedulerAdded, false);
  const invalid = transformStaffRuntimeIntegration('export function integrateCalloriaGLBStaff(){ return null; }', ids, modes);
  assert.equal(invalid.code, null);
  assert.ok(invalid.warnings?.length);
});

test('v6.32 adds no second renderer or requestAnimationFrame loop', () => {
  assert.equal((transformed.code.match(/requestAnimationFrame/g) || []).length, (fixture.match(/requestAnimationFrame/g) || []).length);
  assert.equal((transformed.code.match(/new T\.WebGLRenderer/g) || []).length, (fixture.match(/new T\.WebGLRenderer/g) || []).length);
});
