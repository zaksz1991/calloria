/**
 * CALLORIA GLB-first workplace activation + first-station onboarding.
 * v6.84 keeps the local world renderable while optional staff/office GLBs load
 * in the background. It retains v6.81 registered-path-first fallback and the
 * existing Vite transform contracts.
 */
const TARGET = '/js/production-world.js';
const STAFF_TARGET = '/js/glb-world-integration.js';
const OFFICE_TARGET = '/js/glb-office-world-integration.js';
const READY_ANCHOR =
  "  callbacks.onAssetsReady?.({ loaded: 0, fallback: staff.length, mode: 'merged-articulated-local-staff', tier });";
const UPDATE_ANCHOR =
  '      updateStaff(delta, timestamp / 1000); animate.lastStaffAt = timestamp;';
const DISPOSE_ANCHOR =
  '      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();';
const NEAREST_ANCHOR =
  '      callbacks.onNearestStation?.(nearestStation ? { id: nearestStation.id, label: nearestStation.label, department: nearestStation.department } : null);';
const USE_ANCHOR =
  '    callbacks.onStation?.({ id: nearestStation.id, label: nearestStation.label, department: nearestStation.department });';
const IMMERSIVE_ANCHOR = '    callbacks.onImmersiveChange?.(immersive);';
const SPAWN_ANCHOR =
  '      player.x = 0; player.z = 15.0; player.yaw = 0; player.pitch = -0.04;';
const INITIAL_RENDER_READY_ANCHOR = "  callbacks.onRenderStatus?.({ state: 'ready', tier, stations: stations.length, staff: staff.length });\n  renderStill();";
const IMPORTS = [
  "import { integrateCalloriaGLBStaff } from './glb-world-integration.js';",
  "import { integrateCalloriaGLBOfficeAssets } from './glb-office-world-integration.js';",
  "import { createCalloriaWorldMission } from './world-gameplay-mission.js';",
  "import { createCalloriaGLBHealthPanel } from './glb-asset-health-panel.js';"
].join('\n');
const PATH_IMPORT = "import { loadCalloriaGLBWithPathFallback } from './glb-asset-path-fallback.js';";
const MARKER = '__CALLORIA_GLB_FIRST_WORKPLACE_V22__';
const STAFF_PATH_MARKER = '__CALLORIA_GLB_STAFF_PATH_RECOVERY_V681__';
const OFFICE_PATH_MARKER = '__CALLORIA_GLB_OFFICE_PATH_RECOVERY_V681__';
const OFFICE_MARKER = '__CALLORIA_GLB_WORKSTATION_COVERAGE_V29__';
const OFFICE_PLAN_ANCHOR = /const preferred = safeTier === 'low'\s*\?\s*\[[^\]]*\]\s*:\s*safeTier === 'high'\s*\?\s*\[[^\]]*\]\s*:\s*\[[^\]]*\];/g;
const HEADSET_PLAN_ANCHOR = /headsetStationIndexes:\s*safeTier === 'low'\s*\?\s*\[[^\]]*\]\s*:\s*\[\.\.\.deskStationIndexes\]/g;
const STAFF_CANDIDATE_ANCHOR = `  const candidates = CANDIDATE_IDS
    .filter((id) => approvedIds.has(id))
    .map((id) => GLB_ASSET_REGISTRY.find((asset) => asset.id === id))
    .filter(Boolean);`;
const STAFF_LOAD_ANCHOR = '      const gltf = await loader.loadAsync(asset.url);';
const STAFF_STORE_ANCHOR = '      loadedModels.set(asset.id, { gltf, asset, metrics });';
const OFFICE_ASSET_ANCHOR = '      const asset = getAsset(id);\n      let gltf;';
const OFFICE_LOAD_ANCHOR = '        gltf = await loader.loadAsync(asset.url);';
const OFFICE_DETAIL_PATH_ANCHOR = '        path: asset.path,';
const OFFICE_DETAIL_URL_ANCHOR = '        url: asset.url,';
const OFFICE_STORE_ANCHOR = '      const record = { asset, gltf, metrics, role: check.role };';
const HEALTH_MARKER = '__CALLORIA_GLB_RUNTIME_HEALTH_V682__';

function count(source, needle) {
  return source.split(needle).length - 1;
}
function requireExactlyOnce(context, source, anchor, label) {
  const occurrences = count(source, anchor);
  if (occurrences !== 1) {
    context.error(
      `CALLORIA GLB v6.81 expected exactly one ${label} anchor (${occurrences} found). Refusing a partial transform.`
    );
  }
}
function requireOneOf(context, source, anchor, label) {
  if (!source.includes(anchor)) {
    context.error(`CALLORIA GLB v6.81 could not locate the ${label} anchor. Refusing a partial transform.`);
  }
}

function transformStaffPaths(context, source) {
  if (source.includes(STAFF_PATH_MARKER)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');
  requireExactlyOnce(context, code, STAFF_CANDIDATE_ANCHOR, 'staff candidate selection');
  requireExactlyOnce(context, code, STAFF_LOAD_ANCHOR, 'staff GLB load');
  requireExactlyOnce(context, code, STAFF_STORE_ANCHOR, 'staff model cache');

  const candidateReplacement = `  const approvedCandidateIds = CANDIDATE_IDS.filter((id) => approvedIds.has(id));
  // A stale/office-only inspector approval list must not silently disable all
  // agent models. Use the two primary candidates only when none of the six
  // eligible staff IDs is selected; normal approved selections remain honoured.
  const selectedCandidateIds = approvedCandidateIds.length ? approvedCandidateIds : PRIMARY_CANDIDATES;
  const candidates = selectedCandidateIds
    .map((id) => GLB_ASSET_REGISTRY.find((asset) => asset.id === id))
    .filter(Boolean);`;
  code = code.replace(STAFF_CANDIDATE_ANCHOR, candidateReplacement);
  code = code.replace(
    STAFF_LOAD_ANCHOR,
    `      const pathLoad = await loadCalloriaGLBWithPathFallback(loader, asset, (attempt) => {
        window.dispatchEvent(new CustomEvent('calloria:glb-load-attempt', { detail: { ...attempt, kind: 'staff', assetId: asset.id, assetName: asset.name || asset.id } }));
      });
      const gltf = pathLoad.gltf;
      const resolvedAsset = { ...asset, url: pathLoad.resolvedUrl, path: pathLoad.resolvedPath };`
  );
  code = code.replace(
    STAFF_STORE_ANCHOR,
    '      loadedModels.set(asset.id, { gltf, asset: resolvedAsset, metrics });'
  );
  code = `${PATH_IMPORT}\nconst ${STAFF_PATH_MARKER} = true;\n${code}`;
  return { code, map: null };
}

function transformOfficePaths(context, source) {
  if (source.includes(OFFICE_PATH_MARKER)) return String(source).replace(/\r\n?/g, '\n');
  let code = String(source).replace(/\r\n?/g, '\n');
  requireExactlyOnce(context, code, OFFICE_ASSET_ANCHOR, 'office asset declaration');
  requireExactlyOnce(context, code, OFFICE_LOAD_ANCHOR, 'office GLB load');
  requireExactlyOnce(context, code, OFFICE_DETAIL_PATH_ANCHOR, 'office resolved path detail');
  requireExactlyOnce(context, code, OFFICE_DETAIL_URL_ANCHOR, 'office resolved URL detail');
  requireExactlyOnce(context, code, OFFICE_STORE_ANCHOR, 'office model cache');

  code = code.replace(
    OFFICE_ASSET_ANCHOR,
    '      const asset = getAsset(id);\n      let resolvedAsset = asset;\n      let gltf;'
  );
  code = code.replace(
    OFFICE_LOAD_ANCHOR,
    `        const pathLoad = await loadCalloriaGLBWithPathFallback(loader, asset, (attempt) => {
          window.dispatchEvent(new CustomEvent('calloria:glb-load-attempt', { detail: { ...attempt, kind: 'office', assetId: asset.id, assetName: asset.name || asset.id } }));
        });
        gltf = pathLoad.gltf;
        resolvedAsset = { ...asset, url: pathLoad.resolvedUrl, path: pathLoad.resolvedPath };`
  );
  code = code.replace(OFFICE_DETAIL_PATH_ANCHOR, '        path: resolvedAsset.path,');
  code = code.replace(OFFICE_DETAIL_URL_ANCHOR, '        url: resolvedAsset.url,');
  code = code.replace(OFFICE_STORE_ANCHOR, '      const record = { asset: resolvedAsset, gltf, metrics, role: check.role };');
  code = `${PATH_IMPORT}\nconst ${OFFICE_PATH_MARKER} = true;\n${code}`;
  return code;
}

function transformOfficeCoverage(context, source) {
  let normalized = transformOfficePaths(context, source);
  if (normalized === null) normalized = String(source).replace(/\r\n?/g, '\n');
  if (normalized.includes(OFFICE_MARKER)) return null;
  const planMatches = normalized.match(OFFICE_PLAN_ANCHOR) || [];
  const headsetMatches = normalized.match(HEADSET_PLAN_ANCHOR) || [];
  if (planMatches.length !== 1 || headsetMatches.length !== 1) {
    context.error(
      `CALLORIA GLB workstation coverage v2.9 expected one device-tier plan and one headset plan (found ${planMatches.length} and ${headsetMatches.length}). Refusing a partial transform.`
    );
  }
  const preferred = "const preferred = safeTier === 'low' ? [9, 10] : safeTier === 'high' ? [4, 5, 6, 7, 8, 9, 10, 11] : [8, 9, 10, 11];";
  const headsetPlan = "headsetStationIndexes: safeTier === 'low' ? [10] : [...deskStationIndexes]";
  let code = normalized.replace(OFFICE_PLAN_ANCHOR, preferred);
  code = code.replace(HEADSET_PLAN_ANCHOR, headsetPlan);
  code = `const ${OFFICE_MARKER} = true;\n${code}`;
  return { code, map: null };
}

/** Vite plugin; already registered in vite.config.js. */
export function calloriaGLBWorldPlugin() {
  return {
    name: 'calloria-glb-first-workplace-v2-2',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (normalizedId.endsWith(STAFF_TARGET)) return transformStaffPaths(this, source);
      if (normalizedId.endsWith(OFFICE_TARGET)) return transformOfficeCoverage(this, source);
      if (!normalizedId.endsWith(TARGET)) return null;
      if (source.includes(MARKER) || source.includes(HEALTH_MARKER)) return null;
      const anchors = [
        [READY_ANCHOR, 'GLB-ready callback'],
        [UPDATE_ANCHOR, 'render-loop update'],
        [DISPOSE_ANCHOR, 'world disposal'],
        [NEAREST_ANCHOR, 'nearest-workstation callback'],
        [USE_ANCHOR, 'workstation USE callback'],
        [IMMERSIVE_ANCHOR, 'immersive-state callback'],
        [SPAWN_ANCHOR, 'initial player spawn'],
        [INITIAL_RENDER_READY_ANCHOR, 'initial render readiness']
      ];
      for (const [anchor, label] of anchors) requireExactlyOnce(this, source, anchor, label);
      let code = `${IMPORTS}\nconst ${MARKER} = true;\nconst ${HEALTH_MARKER} = true;\n${source}`;
      code = code.replace(
        READY_ANCHOR,
        `  let glbWorldLayer = null;
  let glbOfficeLayer = null;
  let worldMissionLayer = null;
  let glbHealthPanel = null;
  let glbStartIdleHandle = null;
  let glbStartTimer = null;
  const glbRuntimeState = {
    staffPending: true,
    officePending: true,
    staffStatus: { loaded: 0, fallback: staff.length, failed: 0, errors: [], reason: 'Staff GLB loading has started.' },
    officeStatus: { placed: 0, assets: [], errors: [], reason: 'Office GLB loading has started.' }
  };

  // The local workplace and its usable fallback staff/furniture must render
  // immediately. GLB downloads, parsing, validation and placement are optional
  // upgrades that finish in the background; they never block world startup.
  try {
    glbHealthPanel = createCalloriaGLBHealthPanel({ host, tier });
  } catch (error) {
    console.warn('CALLORIA GLB health panel unavailable.', error);
  }
  try {
    worldMissionLayer = createCalloriaWorldMission({ host });
  } catch (error) {
    console.warn('CALLORIA first-shift mission overlay unavailable.', error);
  }

  const publishGLBStatus = () => {
    const staffAssetStatus = glbRuntimeState.staffStatus || { loaded: 0, fallback: staff.length, errors: [] };
    const officeAssetStatus = glbRuntimeState.officeStatus || { placed: 0, assets: [], errors: [] };
    const rawOfficeErrors = Array.isArray(officeAssetStatus.errors) ? officeAssetStatus.errors : [];
    const officeFailedIds = Array.isArray(officeAssetStatus.failedAssetIds) ? officeAssetStatus.failedAssetIds : [];
    const officeAssetDetails = Array.isArray(officeAssetStatus.assetDetails) ? officeAssetStatus.assetDetails : [];
    const officeErrorIds = new Set(rawOfficeErrors.map((item) => item?.assetId).filter(Boolean));
    const officeFailureDetails = officeFailedIds
      .filter((assetId) => !officeErrorIds.has(assetId))
      .map((assetId) => {
        const detail = officeAssetDetails.find((item) => item?.id === assetId);
        const reasons = Array.isArray(detail?.reasons) ? detail.reasons.filter(Boolean).join('; ') : '';
        return { assetId, message: reasons || detail?.reason || 'Asset did not load, validate or place; the original office object remains visible.' };
      });
    const officeErrors = [...rawOfficeErrors, ...officeFailureDetails];
    const rawStaffErrors = Array.isArray(staffAssetStatus.errors) ? staffAssetStatus.errors : [];
    const staffRejected = Array.isArray(staffAssetStatus.rejected) ? staffAssetStatus.rejected : [];
    const staffRejectionDetails = staffRejected.map((item) => ({
      assetId: item?.id || 'staff-model',
      message: Array.isArray(item?.reasons) && item.reasons.length
        ? item.reasons.join('; ')
        : 'Staff model was rejected by runtime validation.'
    }));
    const staffErrors = [...rawStaffErrors, ...staffRejectionDetails];
    const staffFailedCount = Math.max(
      Number(staffAssetStatus.failed) || 0,
      staffRejected.length,
      rawStaffErrors.length
    );
    const combinedAssetStatus = {
      ...staffAssetStatus,
      staffLoaded: Number(staffAssetStatus.loaded) || 0,
      officePlaced: Number(officeAssetStatus.placed ?? officeAssetStatus.officeObjectsPlaced) || 0,
      officeAssets: Array.isArray(officeAssetStatus.assets) ? officeAssetStatus.assets : [],
      officeErrors,
      officeFailed: Math.max(officeErrors.length, officeFailedIds.length),
      staffFailed: staffFailedCount,
      staffRejected,
      staffErrors,
      staffPending: Boolean(glbRuntimeState.staffPending),
      officePending: Boolean(glbRuntimeState.officePending),
      assetsPending: Boolean(glbRuntimeState.staffPending || glbRuntimeState.officePending),
      worldReady: true,
      tier
    };
    try { callbacks.onAssetsReady?.(combinedAssetStatus); }
    catch (error) { console.warn('CALLORIA GLB status callback failed.', error); }
    const assetStatusNode = document.getElementById('assetStatus');
    if (assetStatusNode) {
      const staffCount = combinedAssetStatus.staffLoaded;
      const officeCount = combinedAssetStatus.officePlaced;
      const failedCount = combinedAssetStatus.officeFailed + staffFailedCount;
      const pendingNames = [combinedAssetStatus.staffPending ? 'STAFF' : '', combinedAssetStatus.officePending ? 'OFFICE' : ''].filter(Boolean).join(' + ');
      const progressLabel = combinedAssetStatus.assetsPending
        ? '  ·  LOADING: ' + pendingNames
        : failedCount ? '  ·  REVIEW: ' + failedCount : '';
      assetStatusNode.textContent = 'GLB STAFF: ' + staffCount
        + '  ·  OFFICE GLB OBJECTS: ' + officeCount
        + progressLabel + '  ·  ' + String(tier).toUpperCase();
    }
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('calloria:glb-world-assets-ready', { detail: combinedAssetStatus }));
    }
    glbHealthPanel?.update?.(combinedAssetStatus);
    return combinedAssetStatus;
  };

  // Publish a truthful pending state before either loader starts. A zero count
  // during this phase means “not loaded yet”, not “the integration failed”.
  publishGLBStatus();

  const startBackgroundGLBLoads = () => {
    glbStartIdleHandle = null;
    glbStartTimer = null;
    if (disposed) return;

    const staffGLBPromise = Promise.resolve()
    .then(() => integrateCalloriaGLBStaff({ THREE, scene, staff, tier }))
    .then((layer) => {
      if (disposed) {
        layer?.dispose?.();
        return null;
      }
      glbWorldLayer = layer || null;
      glbRuntimeState.staffStatus = layer?.status || {
        loaded: 0, fallback: staff.length, failed: 0, errors: [],
        reason: 'Staff GLB integration returned no status.'
      };
      glbRuntimeState.staffPending = false;
      publishGLBStatus();
      renderStill();
      return layer;
    })
    .catch((error) => {
      if (disposed) return null;
      const message = String(error?.message || error);
      glbRuntimeState.staffStatus = {
        loaded: 0, fallback: staff.length, failed: 1,
        errors: [{ message }], reason: message
      };
      glbRuntimeState.staffPending = false;
      console.warn('CALLORIA staff GLB layer unavailable; retaining original staff.', error);
      publishGLBStatus();
      renderStill();
      return null;
    });

    const officeGLBPromise = Promise.resolve()
    .then(() => integrateCalloriaGLBOfficeAssets({ THREE, scene, stations, tier }))
    .then((layer) => {
      if (disposed) {
        layer?.dispose?.();
        return null;
      }
      glbOfficeLayer = layer || null;
      glbRuntimeState.officeStatus = layer?.status || {
        placed: 0, assets: [], errors: [], reason: 'Office GLB integration returned no status.'
      };
      glbRuntimeState.officePending = false;
      publishGLBStatus();
      renderStill();
      return layer;
    })
    .catch((error) => {
      if (disposed) return null;
      const message = String(error?.message || error);
      glbRuntimeState.officeStatus = {
        placed: 0, assets: [], errors: [{ message }], reason: message
      };
      glbRuntimeState.officePending = false;
      console.warn('CALLORIA office GLB layer unavailable; retaining original office objects.', error);
      publishGLBStatus();
      renderStill();
      return null;
    });

    // Both independent asset families start together, but only after the browser
    // has had an idle slice (or a short timeout) to paint the workplace and mount
    // its touch controls. This keeps first interaction ahead of network/decode work.
    void Promise.allSettled([staffGLBPromise, officeGLBPromise]);
  };

  const cancelPendingGLBStart = () => {
    if (glbStartIdleHandle !== null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(glbStartIdleHandle);
    }
    if (glbStartTimer !== null) window.clearTimeout(glbStartTimer);
    glbStartIdleHandle = null;
    glbStartTimer = null;
  };

  /* __CALLORIA_OFFICE_GLB_RUNTIME_V615__ — office runtime is bootstrapped by the GLB-first workplace plugin. */`
      );
      // Schedule background model work only after the existing world-ready
      // callback and first still render have run. The browser can paint and
      // mount touch controls before GLTF network/decoder work is queued.
      code = code.replace(
        INITIAL_RENDER_READY_ANCHOR,
        `${INITIAL_RENDER_READY_ANCHOR}\n  if (typeof window.requestIdleCallback === 'function') {\n    glbStartIdleHandle = window.requestIdleCallback(startBackgroundGLBLoads, { timeout: 1200 });\n  } else {\n    glbStartTimer = window.setTimeout(startBackgroundGLBLoads, 220);\n  }`
      );
      code = code.replace(
        UPDATE_ANCHOR,
        `      updateStaff(delta, timestamp / 1000);
      glbWorldLayer?.update?.(delta);
      glbOfficeLayer?.update?.(delta);
      animate.lastStaffAt = timestamp;`
      );
      code = code.replace(
        DISPOSE_ANCHOR,
        `      disposed = true; stopLoop();
      cancelPendingGLBStart();
      glbHealthPanel?.dispose?.();
      glbWorldLayer?.dispose?.();
      glbOfficeLayer?.dispose?.();
      worldMissionLayer?.dispose?.();
      visibilityObserver?.disconnect(); resizeObserver?.disconnect();`
      );
      code = code.replace(
        SPAWN_ANCHOR,
        `      const assignedStartStation = stations.find((station) => station.id === 11) || stations[0];
      if (assignedStartStation) {
        player.x = assignedStartStation.x;
        player.z = assignedStartStation.z + 2.05;
      } else {
        player.x = 0;
        player.z = 15.0;
      }
      player.yaw = 0;
      player.pitch = -0.04;`
      );
      code = code.replace(
        NEAREST_ANCHOR,
        `      const nearestStationDetail = nearestStation
        ? { id: nearestStation.id, label: nearestStation.label, department: nearestStation.department }
        : null;
      window.dispatchEvent(new CustomEvent('calloria:world-nearest-station', { detail: nearestStationDetail }));
      callbacks.onNearestStation?.(nearestStationDetail);`
      );
      code = code.replace(
        USE_ANCHOR,
        `    const accessedStation = { id: nearestStation.id, label: nearestStation.label, department: nearestStation.department };
    window.dispatchEvent(new CustomEvent('calloria:world-station-accessed', { detail: accessedStation }));
    callbacks.onStation?.(accessedStation);`
      );
      code = code.replace(
        IMMERSIVE_ANCHOR,
        `    callbacks.onImmersiveChange?.(immersive);
    window.dispatchEvent(new CustomEvent('calloria:world-immersive', { detail: { active: immersive } }));`
      );
      return { code, map: null };
    }
  };
}
