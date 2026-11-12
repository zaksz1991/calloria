import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { transformStaffRuntimeIntegration } from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = await readFile(path.join(here, 'fixtures/glb-world-integration-v12.fixture.js'), 'utf8');
const ids = ['female-agent', 'male-agent', 'gp5-woman'];
const modes = {
  'female-agent': 'static-mesh',
  'male-agent': 'skinned-static-pose',
  'gp5-woman': 'animated-skinned'
};
const transformed = transformStaffRuntimeIntegration(fixture, ids, modes);

 test('v6.35 transforms the checked staff runtime without warnings', () => {
  assert.ok(transformed.code);
  assert.deepEqual(transformed.warnings || [], []);
  assert.equal(transformed.eyeGazeMorphSupportAdded, true);
  assert.match(transformed.code, /__CALLORIA_STAFF_EYE_GAZE_MORPHS_V635__/);
});

test('eye gaze discovery accepts only explicit per-eye look directions', () => {
  assert.match(transformed.code, /\^\(\?:eye\)\?look\(up\|down\|in\|out\)\(left\|right\)\$/);
  assert.match(transformed.code, /direction: gazeMatch\[1\]/);
  assert.match(transformed.code, /side: gazeMatch\[2\]/);
  assert.doesNotMatch(transformed.code, /normalizedMorphName === 'happy'/);
});

test('eye gaze scanning shares the static-pose gate and is not restricted to skinned meshes', () => {
  const gate = transformed.code.indexOf("const proceduralIdle = !clip && ['skinned-static-pose', 'static-mesh'].includes(selectedRenderMode)");
  const gazeRegistry = transformed.code.indexOf('const idleGazeMorphTargets = []');
  const traversal = transformed.code.indexOf('if (proceduralIdle && clonedRoot?.traverse)');
  const gazeScan = transformed.code.indexOf('const gazeMatch = /^(?:eye)?look(up|down|in|out)(left|right)$/');
  assert.ok(gate >= 0 && gazeRegistry > gate && traversal > gate && gazeScan > traversal);
  assert.match(transformed.code, /if \(proceduralIdle && clonedRoot\?\.traverse\)/);
});

test('gaze morph indices and baseline influence are validated before use', () => {
  assert.match(transformed.code, /!Number\.isInteger\(morphIndex\) \|\| morphIndex < 0 \|\| morphIndex >= morphInfluences\.length/);
  assert.match(transformed.code, /if \(!Number\.isFinite\(baseInfluence\)\) continue;/);
  assert.match(transformed.code, /const amplitude = Math\.min\(0\.075, 1 - clampedBase\)/);
  assert.match(transformed.code, /target\.index >= influences\.length/);
});

test('eye glances are occasional, smooth and asynchronous per placed staff member', () => {
  assert.match(transformed.code, /gazePeriod: 8\.5 \+ \(\(replacements\.length \* 1\.37\) % 4\.5\)/);
  assert.match(transformed.code, /gazePhase: \(replacements\.length \* 1\.61\) % 4/);
  assert.match(transformed.code, /gazeCycle >= 0\.61 && gazeCycle < 0\.68/);
  assert.match(transformed.code, /gazeCycle >= 0\.68 && gazeCycle < 0\.77/);
  assert.match(transformed.code, /gazeCycle >= 0\.77 && gazeCycle < 0\.84/);
  assert.match(transformed.code, /gazeWeight = t \* t \* \(3 - 2 \* t\)/);
});

test('left and right glances map to opposite inward and outward eye morphs', () => {
  assert.match(transformed.code, /gazeDirection === 'left'.*target\.side === 'left'.*target\.direction === 'out'.*target\.side === 'right'.*target\.direction === 'in'/s);
  assert.match(transformed.code, /gazeDirection === 'right'.*target\.side === 'left'.*target\.direction === 'in'.*target\.side === 'right'.*target\.direction === 'out'/s);
  assert.match(transformed.code, /gazeDirections = \['up', 'left', 'right', 'down'\]/);
});

test('non-active gaze directions return to the captured neutral morph values', () => {
  assert.match(transformed.code, /const weight = activeDirection \? gazeWeight : 0/);
  assert.match(transformed.code, /target\.baseInfluence \+ target\.amplitude \* weight/);
  assert.match(transformed.code, /Math\.max\(0, Math\.min\(1, target\.baseInfluence \+ target\.amplitude \* weight\)\)/);
});

test('authored animated GLBs remain outside procedural eye-gaze updates', () => {
  const gate = transformed.code.indexOf("const proceduralIdle = !clip && ['skinned-static-pose', 'static-mesh'].includes(selectedRenderMode)");
  const scan = transformed.code.indexOf('const gazeMatch = /^(?:eye)?look(up|down|in|out)(left|right)$/');
  const mixerUpdate = transformed.code.indexOf('for (const mixer of mixers) mixer.update(step);');
  const gazeUpdate = transformed.code.indexOf('if (idle.gazeMorphTargets?.length)');
  assert.ok(gate >= 0 && scan > gate && mixerUpdate > 0 && gazeUpdate > mixerUpdate);
  assert.match(transformed.code, /for \(const mixer of mixers\) mixer\.update\(step\)/);
});

test('runtime diagnostics report gaze-capable staff and discovered gaze morph totals', () => {
  assert.match(transformed.code, /eyeGazeMorphStaffPlaced: replacements\.filter\(\(entry\) => entry\.proceduralIdleGazeTargets > 0\)\.length/);
  assert.match(transformed.code, /eyeGazeMorphTargets: replacements\.reduce\(\(sum, entry\) => sum \+ \(entry\.proceduralIdleGazeTargets \|\| 0\), 0\)/);
  assert.match(transformed.code, /proceduralIdleGazeTargets: idleGazeMorphTargets\.length/);
});

test('transformed runtime passes JavaScript syntax validation', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'calloria-v635-'));
  const runtimePath = path.join(directory, 'transformed-runtime.mjs');
  try {
    await writeFile(runtimePath, transformed.code, 'utf8');
    const result = spawnSync(process.execPath, ['--check', runtimePath], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('v6.35 transform is idempotent and fails closed when runtime anchors change', () => {
  const second = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.equal(second.code, transformed.code);
  assert.equal(second.alreadyPatched, true);
  assert.equal(second.eyeGazeMorphSupportAdded, false);
  const invalid = transformStaffRuntimeIntegration('export function integrateCalloriaGLBStaff(){ return null; }', ids, modes);
  assert.equal(invalid.code, null);
  assert.ok(invalid.warnings?.length);
});
