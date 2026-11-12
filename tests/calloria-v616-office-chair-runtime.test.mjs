import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const integration = await readFile(new URL('../js/cc0-office-chair-integration.js', import.meta.url), 'utf8');
const officeRuntime = await readFile(new URL('../js/glb-office-world-integration.js', import.meta.url), 'utf8');
const policy = await readFile(new URL('../js/office-chair-policy.js', import.meta.url), 'utf8');
const count = (source, expression) => [...source.matchAll(expression)].length;

test('chair runtime uses the official Three.js GLTFLoader and merge utility', () => {
  assert.match(integration, /from 'three\/addons\/loaders\/GLTFLoader\.js'/);
  assert.match(integration, /from 'three\/addons\/utils\/BufferGeometryUtils\.js'/);
  assert.match(integration, /loader\.setCrossOrigin\('anonymous'\)/);
});

test('chair meshes are merged by compatible material and vertex-attribute signatures', () => {
  assert.match(integration, /function attributeSignature\(geometry\)/);
  assert.match(integration, /mergeGeometries\(geometries, false\)/);
  assert.match(integration, /calloria-cc0-ergonomic-chair-batches/);
});

test('fallback chair instances are hidden only after the new batched root is added', () => {
  assert.ok(integration.indexOf('scene.add(placedRoot)') < integration.indexOf('hiddenLegacy = hideLegacyChairInstances(scene'));
  assert.match(integration, /chair-seats/);
  assert.match(integration, /chair-backs/);
  assert.match(integration, /chair-posts/);
  assert.match(integration, /chair-bases/);
});

test('selected fallback instance matrices are restored when the chair layer is disposed', () => {
  assert.match(integration, /function restoreLegacyChairInstances\(hidden\)/);
  assert.match(integration, /restoreLegacyChairInstances\(hiddenLegacy\)/);
  assert.match(integration, /if \(placedRoot\) scene\.remove\(placedRoot\)/);
  assert.match(integration, /generatedGeometries\.forEach|for \(const geometry of generatedGeometries\)/);
});

test('failed chair loading leaves existing fallback geometry visible and reports a useful category', () => {
  assert.match(integration, /load-or-placement/);
  assert.match(integration, /http-or-network/);
  assert.match(integration, /fallback instances|original chairs retained/i);
  assert.ok(integration.indexOf('hiddenLegacy = hideLegacyChairInstances(scene') > integration.indexOf('await loader.loadAsync'));
});

test('office runtime awaits chair activation as an independent job', () => {
  assert.match(officeRuntime, /integrateCalloriaCC0OfficeChairs\(/);
  assert.match(officeRuntime, /jobs\.push\(\(async \(\) => \{/);
  assert.match(officeRuntime, /await Promise\.allSettled\(jobs\)/);
});

test('office diagnostics include chair ID, load state, placement count and CC0 source', () => {
  assert.match(officeRuntime, /chairFurniture:/);
  assert.match(officeRuntime, /chairsPlaced/);
  assert.match(officeRuntime, /3dassets-office-task-chair/);
  assert.match(officeRuntime, /validated-and-placed/);
  assert.match(officeRuntime, /fallback-retained/);
  assert.match(officeRuntime, /sourceUrl/);
});

test('office status aggregates chair placements without hiding failures from the asset list', () => {
  assert.match(officeRuntime, /const officePlacedCount = placed\.length \+ chairCount/);
  assert.match(officeRuntime, /failedIds\.push\('3dassets-office-task-chair'\)/);
  assert.match(officeRuntime, /officeObjectsPlaced: officePlacedCount/);
});

test('disposing the main office GLB layer also disposes the task-chair layer', () => {
  assert.match(officeRuntime, /chairLayer\?\.dispose\?\.\(\)/);
});

test('chair tiers and budget are imported from a Three.js-free policy module', () => {
  assert.match(integration, /from '\.\/office-chair-policy\.js'/);
  assert.doesNotMatch(policy, /from ['"]three/);
  assert.equal(count(policy, /export function getCC0ChairStationIds/g), 1);
});
