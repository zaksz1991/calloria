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

test('v6.34 transforms the checked staff runtime without warnings', () => {
  assert.ok(transformed.code);
  assert.deepEqual(transformed.warnings || [], []);
});

test('facial expression discovery shares the static procedural-model gate', () => {
  assert.match(transformed.code, /const proceduralIdle = !clip && \['skinned-static-pose', 'static-mesh'\]\.includes\(selectedRenderMode\)/);
  assert.match(transformed.code, /if \(proceduralIdle && clonedRoot\?\.traverse\)/);
  assert.match(transformed.code, /const idleExpressionMorphTargets = \[\]/);
});

test('only named smile and mouth-dimple morphs are recognised', () => {
  assert.match(transformed.code, /const isSmileMorph = \/\^\(\?:mouth\)\?smile/);
  assert.match(transformed.code, /\|\| \/\^mouthdimple/);
  assert.match(transformed.code, /kind: isSmileMorph \? 'smile' : 'brow-raise'/);
});

test('brow raise morphs use a separate narrow allow-list', () => {
  assert.match(transformed.code, /const isBrowRaiseMorph = \/\^\(\?:browinnerup/);
  assert.match(transformed.code, /browouterup/);
  assert.match(transformed.code, /browup/);
});

test('expression targets are range-checked and bounded to subtle amplitudes', () => {
  assert.match(transformed.code, /morphIndex < 0\s*\|\| morphIndex >= morphInfluences\.length/);
  assert.match(transformed.code, /Number\.isFinite\(baseInfluence\)/);
  assert.match(transformed.code, /Math\.min\(isSmileMorph \? 0\.12 : 0\.055, 1 - clampedBase\)/);
  assert.match(transformed.code, /Math\.max\(0, Math\.min\(1, target\.baseInfluence \+ target\.amplitude \* expressionWeight\)\)/);
});

test('expression morphs use a slow asynchronous rise-hold-release envelope', () => {
  assert.match(transformed.code, /expressionPeriod: 11 \+ \(\(replacements\.length \* 0\.97\) % 7\)/);
  assert.match(transformed.code, /expressionPhase: \(replacements\.length \* 1\.77\) % 5/);
  assert.match(transformed.code, /expressionCycle >= 0\.18 && expressionCycle < 0\.27/);
  assert.match(transformed.code, /expressionCycle >= 0\.27 && expressionCycle < 0\.43/);
  assert.match(transformed.code, /expressionCycle >= 0\.43 && expressionCycle < 0\.55/);
});

test('authored animated GLBs remain excluded from procedural expression updates', () => {
  const gate = transformed.code.indexOf('const proceduralIdle = !clip');
  const traversal = transformed.code.indexOf('if (proceduralIdle && clonedRoot?.traverse)');
  const animationBranch = transformed.code.indexOf('if (clip) {');
  assert.ok(gate >= 0 && traversal > gate && animationBranch > 0);
  assert.match(transformed.code, /expressionMorphTargets: idleExpressionMorphTargets/);
});

test('runtime diagnostics report expression-capable staff and morph counts', () => {
  assert.match(transformed.code, /expressionMorphStaffPlaced/);
  assert.match(transformed.code, /expressionMorphTargets: replacements\.reduce/);
  assert.match(transformed.code, /proceduralIdleExpressionTargets: idleExpressionMorphTargets\.length/);
});

test('v6.34 transform is idempotent and fails closed when the staff contract changes', () => {
  const second = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.equal(second.code, transformed.code);
  assert.equal(second.alreadyPatched, true);
  const invalid = transformStaffRuntimeIntegration('export function integrateCalloriaGLBStaff(){ return null; }', ids, modes);
  assert.equal(invalid.code, null);
  assert.ok(invalid.warnings?.length);
});
