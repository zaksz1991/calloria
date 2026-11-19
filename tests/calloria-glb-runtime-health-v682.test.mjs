import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeCalloriaGLBHealth, createCalloriaGLBHealthPanel } from '../js/glb-asset-health-panel.js';
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

const WORLD_SOURCE = `
async function initProductionWorld() {
  callbacks.onAssetsReady?.({ loaded: 0, fallback: staff.length, mode: 'merged-articulated-local-staff', tier });
      updateStaff(delta, timestamp / 1000); animate.lastStaffAt = timestamp;
      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();
      callbacks.onNearestStation?.(nearestStation ? { id: nearestStation.id, label: nearestStation.label, department: nearestStation.department } : null);
    callbacks.onStation?.({ id: nearestStation.id, label: nearestStation.label, department: nearestStation.department });
    callbacks.onImmersiveChange?.(immersive);
      player.x = 0; player.z = 15.0; player.yaw = 0; player.pitch = -0.04;
}
`;

function transform(plugin, source, path) {
  return plugin.transform.call({ error(message) { throw new Error(message); } }, source, path);
}

test('health summary reports real counts and path outcomes without inventing success', () => {
  const summary = summarizeCalloriaGLBHealth({
    loaded: 2, fallback: 9, officePlaced: 4, failed: 1,
    officeErrors: ['desk failed'], tier: 'balanced', worldReady: true,
  }, [
    { status: 'loaded' }, { status: 'failed' }, { status: 'loading' },
  ]);
  assert.deepEqual(summary, {
    staffLoaded: 2,
    staffFallback: 9,
    officePlaced: 4,
    staffFailed: 1,
    officeErrorCount: 1,
    staffErrorCount: 0,
    failedPaths: 1,
    loadedPaths: 1,
    loadingPaths: 1,
    declaredProblems: 2,
    totalAttempts: 3,
    worldReady: true,
    tier: 'balanced',
  });
});

test('health summary keeps empty integration counts at zero', () => {
  const summary = summarizeCalloriaGLBHealth({ loaded: 0, fallback: 0, officePlaced: 0 }, []);
  assert.equal(summary.staffLoaded, 0);
  assert.equal(summary.officePlaced, 0);
  assert.equal(summary.totalAttempts, 0);
  assert.equal(summary.failedPaths, 0);
});

test('panel safely returns a no-DOM controller in Node or server rendering', () => {
  const panel = createCalloriaGLBHealthPanel();
  assert.equal(typeof panel.update, 'function');
  assert.equal(typeof panel.dispose, 'function');
  assert.doesNotThrow(() => panel.update({ loaded: 1 }));
  assert.doesNotThrow(() => panel.dispose());
});

test('staff and office path loaders emit channel-specific attempt telemetry', () => {
  const plugin = calloriaGLBWorldPlugin();
  const staff = transform(plugin, STAFF_SOURCE, '/repo/js/glb-world-integration.js');
  const office = transform(plugin, OFFICE_SOURCE, '/repo/js/glb-office-world-integration.js');
  assert.ok(staff.code.includes("kind: 'staff'"));
  assert.ok(office.code.includes("kind: 'office'"));
  assert.ok(staff.code.includes("'calloria:glb-load-attempt'"));
  assert.ok(office.code.includes("'calloria:glb-load-attempt'"));
  assert.ok(staff.code.includes('assetName: asset.name || asset.id'));
  assert.ok(office.code.includes('assetName: asset.name || asset.id'));
});

test('world transform creates the status panel before any staff or office loaders run', () => {
  const plugin = calloriaGLBWorldPlugin();
  const result = transform(plugin, WORLD_SOURCE, '/repo/js/production-world.js');
  const panelAt = result.code.indexOf('createCalloriaGLBHealthPanel({ host, tier })');
  const staffAt = result.code.indexOf('integrateCalloriaGLBStaff({ THREE, scene, staff, tier })');
  assert.ok(panelAt >= 0);
  assert.ok(staffAt > panelAt);
  assert.ok(result.code.includes("'calloria:glb-world-assets-ready'"));
  assert.ok(result.code.includes('glbHealthPanel?.dispose?.()'));
  assert.ok(result.code.includes("'./glb-asset-health-panel.js'"));
});

test('health panel is a collapsed, safe-area-aware mobile control with detailed error output', async () => {
  const source = await readFile(new URL('../js/glb-asset-health-panel.js', import.meta.url), 'utf8');
  assert.ok(source.includes("panel.hidden = true"));
  assert.ok(source.includes('env(safe-area-inset-top'));
  assert.ok(source.includes('max-height:68dvh'));
  assert.ok(source.includes('calloria-glb-error'));
  assert.ok(source.includes('/asset-inspector.html'));
});

