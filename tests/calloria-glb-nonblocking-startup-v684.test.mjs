import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calloriaGLBWorldPlugin } from '../build/calloria-glb-world-plugin.js';
import { summarizeCalloriaGLBHealth } from '../js/glb-asset-health-panel.js';

const WORLD_SOURCE = `
async function initProductionWorld(THREE, host, callbacks = {}) {
  let disposed = false;
  const staff = [];
  const stations = [];
  const scene = {};
  const tier = 'balanced';
  function renderStill() {}
  callbacks.onAssetsReady?.({ loaded: 0, fallback: staff.length, mode: 'merged-articulated-local-staff', tier });
  callbacks.onRenderStatus?.({ state: 'ready', tier, stations: stations.length, staff: staff.length });
  renderStill();
  function update(delta, timestamp) {
      updateStaff(delta, timestamp / 1000); animate.lastStaffAt = timestamp;
  }
  function disposeWorld() {
      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();
      scene.traverse((object) => {});
  }
  function nearest() {
      callbacks.onNearestStation?.(nearestStation ? { id: nearestStation.id, label: nearestStation.label, department: nearestStation.department } : null);
  }
  function use() {
    callbacks.onStation?.({ id: nearestStation.id, label: nearestStation.label, department: nearestStation.department });
  }
  function enter(active) {
    callbacks.onImmersiveChange?.(immersive);
  }
  function spawn() {
      player.x = 0; player.z = 15.0; player.yaw = 0; player.pitch = -0.04;
  }
}
`;

function runWorldTransform() {
  const plugin = calloriaGLBWorldPlugin();
  return plugin.transform.call({
    error(message) { throw new Error(message); },
  }, WORLD_SOURCE, '/repo/js/production-world.js');
}

test('world initialisation starts GLB work in the background instead of awaiting models', () => {
  const result = runWorldTransform();
  assert.ok(result?.code);
  assert.ok(result.code.includes('const staffGLBPromise = Promise.resolve()'));
  assert.ok(result.code.includes('const officeGLBPromise = Promise.resolve()'));
  assert.ok(result.code.includes('void Promise.allSettled([staffGLBPromise, officeGLBPromise])'));
  assert.ok(!result.code.includes('await integrateCalloriaGLBStaff('));
  assert.ok(!result.code.includes('await integrateCalloriaGLBOfficeAssets('));
  assert.ok(result.code.includes('renderStill();'));
});

test('the original render readiness path is left synchronous and GLB startup is deferred', () => {
  const result = runWorldTransform();
  const originalReady = result.code.indexOf("callbacks.onRenderStatus?.({ state: 'ready'");
  const originalRender = result.code.indexOf('renderStill();', originalReady);
  const scheduleIdle = result.code.indexOf('window.requestIdleCallback(startBackgroundGLBLoads');
  const scheduleTimer = result.code.indexOf('window.setTimeout(startBackgroundGLBLoads, 220)');
  const startGuard = result.code.indexOf('if (disposed) return;', result.code.indexOf('const startBackgroundGLBLoads'));
  assert.ok(originalReady >= 0);
  assert.ok(originalRender > originalReady);
  assert.ok(scheduleIdle > originalRender);
  assert.ok(scheduleTimer > originalRender);
  assert.ok(startGuard > 0);
});

test('runtime status marks zero counts as pending until each loader settles', () => {
  const result = runWorldTransform();
  assert.ok(result.code.includes('staffPending: true'));
  assert.ok(result.code.includes('officePending: true'));
  assert.ok(result.code.includes('assetsPending: Boolean(glbRuntimeState.staffPending || glbRuntimeState.officePending)'));
  assert.ok(result.code.includes('LOADING: '));
});

test('staff and office loaders settle independently and publish partial results', () => {
  const result = runWorldTransform();
  const staffStart = result.code.indexOf('const staffGLBPromise = Promise.resolve()');
  const officeStart = result.code.indexOf('const officeGLBPromise = Promise.resolve()');
  assert.ok(staffStart > 0 && officeStart > staffStart);
  assert.ok(result.code.includes('glbRuntimeState.staffPending = false'));
  assert.ok(result.code.includes('glbRuntimeState.officePending = false'));
  assert.ok(result.code.includes('publishGLBStatus();'));
  assert.ok(result.code.includes('glbWorldLayer = layer || null'));
  assert.ok(result.code.includes('glbOfficeLayer = layer || null'));
  assert.ok(result.code.includes('void Promise.allSettled([staffGLBPromise, officeGLBPromise])'));
});

test('late GLB layers are disposed instead of attached to a closed world', () => {
  const result = runWorldTransform();
  assert.equal((result.code.match(/if \(disposed\) \{/g) || []).length, 2);
  assert.ok(result.code.includes('layer?.dispose?.();'));
  assert.ok(result.code.includes("glbWorldLayer?.dispose?.();"));
  assert.ok(result.code.includes("glbOfficeLayer?.dispose?.();"));
});

test('pre-transform declares the office-runtime marker expected by the post-transform plugin', () => {
  const result = runWorldTransform();
  assert.ok(result.code.includes('__CALLORIA_OFFICE_GLB_RUNTIME_V615__'));
});

test('disposed world cancels a not-yet-started idle callback or timer', () => {
  const result = runWorldTransform();
  assert.ok(result.code.includes('const cancelPendingGLBStart = () =>'));
  assert.ok(result.code.includes('window.cancelIdleCallback(glbStartIdleHandle)'));
  assert.ok(result.code.includes('window.clearTimeout(glbStartTimer)'));
  assert.ok(result.code.includes('cancelPendingGLBStart();'));
});

test('staff validator rejections and office failed asset IDs are included in status', () => {
  const result = runWorldTransform();
  assert.ok(result.code.includes('const staffRejected = Array.isArray(staffAssetStatus.rejected)'));
  assert.ok(result.code.includes('const staffRejectionDetails = staffRejected.map'));
  assert.ok(result.code.includes('const officeFailedIds = Array.isArray(officeAssetStatus.failedAssetIds)'));
  assert.ok(result.code.includes('officeFailed: Math.max(officeErrors.length, officeFailedIds.length)'));
});

test('health summary distinguishes in-progress loading from a settled zero-placement failure', () => {
  const pending = summarizeCalloriaGLBHealth({
    staffLoaded: 0, officePlaced: 0, staffPending: true, officePending: true,
    assetsPending: true, worldReady: true,
  }, []);
  const settled = summarizeCalloriaGLBHealth({
    staffLoaded: 0, officePlaced: 0, staffPending: false, officePending: false,
    assetsPending: false, worldReady: true,
  }, []);
  assert.equal(pending.pending, true);
  assert.equal(settled.pending, false);
  assert.equal(pending.staffLoaded, 0);
  assert.equal(pending.officePlaced, 0);
});

test('health summary counts staff rejection arrays and office failed IDs without double-counting', () => {
  const summary = summarizeCalloriaGLBHealth({
    staffFailed: 1,
    staffErrors: [{ message: 'staff validation failed' }],
    officeFailed: 2,
    officeErrors: [{ message: 'desk failed' }, { message: 'lobby failed' }],
  }, []);
  assert.equal(summary.staffErrorCount, 1);
  assert.equal(summary.officeErrorCount, 2);
  assert.equal(summary.declaredProblems, 3);
});

test('health panel labels pending startup and does not call it a completed zero-placement failure', async () => {
  const source = await readFile(new URL('../js/glb-asset-health-panel.js', import.meta.url), 'utf8');
  assert.ok(source.includes('GLB assets are loading in the background'));
  assert.ok(source.includes('Asset startup pending'));
  assert.ok(source.includes('Asset startup settled'));
  assert.ok(source.includes('summary.pending'));
});
