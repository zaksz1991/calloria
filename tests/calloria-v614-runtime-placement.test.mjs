import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformStaffRuntimeIntegration } from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

const fixtureUrl = new URL('./fixtures/glb-world-integration-v12.fixture.js', import.meta.url);
const ids = ['female-agent', 'male-agent', 'gp5-woman'];
const modes = {
  'female-agent': 'static-mesh',
  'male-agent': 'skinned-static-pose',
  'gp5-woman': 'animated-skinned'
};

async function sourceFixture() {
  return readFile(fixtureUrl, 'utf8');
}

test('runtime transform consumes validated IDs and render-mode manifest', async () => {
  const transformed = transformStaffRuntimeIntegration(await sourceFixture(), ids, modes);
  assert.ok(transformed?.code);
  assert.match(transformed.code, /CALLORIA_STAFF_RENDER_MODES = Object\.freeze/);
  assert.match(transformed.code, /CALLORIA_STAFF_DEFAULT_CANDIDATES = Object\.freeze/);
  assert.match(transformed.code, /const CANDIDATE_IDS = \["female-agent","male-agent","gp5-woman"\]/);
  assert.match(transformed.code, /return new Set\(selected\.length \? selected : CALLORIA_STAFF_DEFAULT_CANDIDATES\)/);
});

test('13-joint and non-skinned valid models are not rejected by the old 15-joint rule', async () => {
  const transformed = transformStaffRuntimeIntegration(await sourceFixture(), ids, modes).code;
  assert.match(transformed, /staffRenderMode === 'static-mesh'/);
  assert.match(transformed, /staffRenderMode === 'animated-node-transforms'/);
  assert.match(transformed, /metrics\.boneCount >= 1/);
  assert.match(transformed, /metrics\.size\.y >= 0\.4 && metrics\.size\.y <= 5\.0/);
  assert.doesNotMatch(transformed, /const rigValid = metrics\.skinnedMeshCount > 0 && metrics\.skeletonCount > 0 && metrics\.boneCount >= 15;/);
});

test('static-pose GLBs are restricted to non-seated staff anchors', async () => {
  const transformed = transformStaffRuntimeIntegration(await sourceFixture(), ids, modes).code;
  assert.match(transformed, /const canUseStandingPose = !person\.seated/);
  assert.match(transformed, /if \(!selected \|\| \(!clip && person\.seated\)\) continue/);
  assert.match(transformed, /renderMode: selectedRenderMode/);
});

test('static-pose placements do not start a non-existent animation mixer', async () => {
  const transformed = transformStaffRuntimeIntegration(await sourceFixture(), ids, modes).code;
  assert.match(transformed, /let mixer = null;\s*if \(clip\) \{/);
  assert.match(transformed, /entry\.mixer\?\.stopAllAction\?\.\(\)/);
});

test('runtime reports actual placed models and their render modes', async () => {
  const transformed = transformStaffRuntimeIntegration(await sourceFixture(), ids, modes).code;
  assert.match(transformed, /assetsInUse: \[\.\.\.new Set\(replacements\.map/);
  assert.match(transformed, /staticPosePlaced:/);
  assert.match(transformed, /animatedPlaced:/);
});

test('supports the newer PRIMARY_CANDIDATES runtime array name', async () => {
  const source = (await sourceFixture()).replace('const CANDIDATE_IDS = [', 'const PRIMARY_CANDIDATES = [');
  const transformed = transformStaffRuntimeIntegration(source, ids, modes);
  assert.ok(transformed?.code);
  assert.match(transformed.code, /const PRIMARY_CANDIDATES = \["female-agent","male-agent","gp5-woman"\]/);
});

test('unknown runtime source shape is left untouched rather than breaking Vite build', async () => {
  const source = 'export function integrateCalloriaGLBStaff(){ return null; }';
  const result = transformStaffRuntimeIntegration(source, ids, modes);
  assert.equal(result.code, null);
  assert.ok(result.warnings.some((warning) => warning.includes('not modified')));
});

test('transform is idempotent', async () => {
  const first = transformStaffRuntimeIntegration(await sourceFixture(), ids, modes);
  const second = transformStaffRuntimeIntegration(first.code, ids, modes);
  assert.equal(second.alreadyPatched, true);
  assert.equal(second.code, first.code);
});
