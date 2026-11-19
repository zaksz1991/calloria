import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getCalloriaGLBPathCandidates,
  loadCalloriaGLBWithPathFallback,
} from '../js/glb-asset-path-fallback.js';
import { calloriaGLBWorldPlugin } from '../build/calloria-glb-world-plugin.js';

const STAFF_SOURCE = `
  const candidates = CANDIDATE_IDS
    .filter((id) => approvedIds.has(id))
    .map((id) => GLB_ASSET_REGISTRY.find((asset) => asset.id === id))
    .filter(Boolean);
      const gltf = await loader.loadAsync(asset.url);
      loadedModels.set(asset.id, { gltf, asset, metrics });
`;

const OFFICE_SOURCE = `
  const safeTier = 'high';
  const deskStationIndexes = [];
  const preferred = safeTier === 'low' ? [10] : safeTier === 'high' ? [8, 9, 10, 11] : [9, 10];
  headsetStationIndexes: safeTier === 'low' ? [] : [...deskStationIndexes]
      const asset = getAsset(id);
      let gltf;
      try {
        gltf = await loader.loadAsync(asset.url);
      }
        path: asset.path,
        url: asset.url,
      const record = { asset, gltf, metrics, role: check.role };
`;

test('registry URL remains first and nested model.glb is second', () => {
  const paths = getCalloriaGLBPathCandidates({
    id: 'female-agent',
    url: '/assets/models/characters/agents/female-agent.glb',
    path: 'characters/agents/female-agent.glb',
  });
  assert.deepEqual(paths.map((entry) => entry.url), [
    '/assets/models/characters/agents/female-agent.glb',
    '/assets/models/characters/agents/female-agent/model.glb',
  ]);
});

test('an existing model.glb path does not create a duplicate nested fallback', () => {
  const paths = getCalloriaGLBPathCandidates({ path: 'accessories/headsets/model.glb' });
  assert.deepEqual(paths.map((entry) => entry.url), ['/assets/models/accessories/headsets/model.glb']);
});

test('loader stops after the registered model URL succeeds', async () => {
  const calls = [];
  const gltf = { scene: {} };
  const result = await loadCalloriaGLBWithPathFallback({
    async loadAsync(url) { calls.push(url); return gltf; },
  }, { id: 'male-agent', path: 'characters/agents/male-agent.glb' });
  assert.equal(result.gltf, gltf);
  assert.equal(result.resolvedPath, 'characters/agents/male-agent.glb');
  assert.equal(calls.length, 1);
});

test('loader retries nested model.glb after the registered file fails', async () => {
  const calls = [];
  const gltf = { scene: {} };
  const result = await loadCalloriaGLBWithPathFallback({
    async loadAsync(url) {
      calls.push(url);
      if (calls.length === 1) throw new Error('404');
      return gltf;
    },
  }, { id: 'office-desk', path: 'office/desks/office_desk.glb' });
  assert.deepEqual(calls, [
    '/assets/models/office/desks/office_desk.glb',
    '/assets/models/office/desks/office_desk/model.glb',
  ]);
  assert.equal(result.gltf, gltf);
  assert.equal(result.resolvedPath, 'office/desks/office_desk/model.glb');
  assert.equal(result.attempts.length, 1);
});

test('failed candidate errors retain both attempted first-party paths', async () => {
  await assert.rejects(
    () => loadCalloriaGLBWithPathFallback({ async loadAsync() { throw new Error('missing'); } }, {
      id: 'female-agent', path: 'characters/agents/female-agent.glb',
    }),
    (error) => error.attempts.length === 2
      && error.message.includes('/assets/models/characters/agents/female-agent.glb')
      && error.message.includes('/assets/models/characters/agents/female-agent/model.glb'),
  );
});

test('external URLs and paths outside the model root are rejected', () => {
  assert.deepEqual(getCalloriaGLBPathCandidates({ url: 'https://example.org/model.glb' }), []);
  assert.deepEqual(getCalloriaGLBPathCandidates({ path: '../../secret.glb' }), []);
});

test('Vite plugin repairs stale agent approvals and instruments the staff loader', () => {
  const plugin = calloriaGLBWorldPlugin();
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, STAFF_SOURCE,
    '/repo/js/glb-world-integration.js');
  assert.ok(result.code.includes("import { loadCalloriaGLBWithPathFallback } from './glb-asset-path-fallback.js';"));
  assert.ok(result.code.includes('approvedCandidateIds.length ? approvedCandidateIds : PRIMARY_CANDIDATES'));
  assert.ok(result.code.includes('const pathLoad = await loadCalloriaGLBWithPathFallback(loader, asset);'));
  assert.ok(result.code.includes('asset: resolvedAsset'));
});

test('Vite plugin instruments office GLB loading without changing the existing plan', async () => {
  const plugin = calloriaGLBWorldPlugin();
  const office = await readFile(new URL('../js/glb-asset-path-fallback.js', import.meta.url), 'utf8');
  assert.ok(office.includes('FALLBACK_FILENAME'));
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, OFFICE_SOURCE,
    '/repo/js/glb-office-world-integration.js');
  assert.ok(result.code.includes('let resolvedAsset = asset;'));
  assert.ok(result.code.includes('gltf = pathLoad.gltf;'));
  assert.ok(result.code.includes('asset: resolvedAsset'));
});
