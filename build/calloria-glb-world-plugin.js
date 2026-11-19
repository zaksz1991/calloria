/**
 * CALLORIA GLB-first workplace activation + first-station onboarding.
 * v6.81 adds a narrowly scoped path retry for registered GLB assets. Registry
 * paths remain first choice; nested <asset-folder>/model.glb is attempted only
 * when the registered .glb URL fails. Existing Vite transforms are retained.
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
        [SPAWN_ANCHOR, 'initial player spawn']
      ];
      for (const [anchor, label] of anchors) requireExactlyOnce(this, source, anchor, label);
      let code = `${IMPORTS}\nconst ${MARKER} = true;\nconst ${HEALTH_MARKER} = true;\n${source}`;
      code = code.replace(
        READY_ANCHOR,
        `  let glbWorldLayer = null;
  let glbOfficeLayer = null;
  let worldMissionLayer = null;
  let glbHealthPanel = null;
  try {
    // Attach before GLB requests begin so no initial load attempt is missed.
    glbHealthPanel = createCalloriaGLBHealthPanel({ host, tier });
  } catch (error) {
    console.warn('CALLORIA GLB health panel unavailable.', error);
  }
  try {
    glbWorldLayer = await integrateCalloriaGLBStaff({ THREE, scene, staff, tier });
  } catch (error) {
    console.warn('CALLORIA staff GLB layer unavailable; retaining original staff.', error);
  }
  try {
    glbOfficeLayer = await integrateCalloriaGLBOfficeAssets({ THREE, scene, stations, tier });
  } catch (error) {
    console.warn('CALLORIA office GLB layer unavailable; retaining original office objects.', error);
  }
  try {
    worldMissionLayer = createCalloriaWorldMission({ host });
  } catch (error) {
    console.warn('CALLORIA first-shift mission overlay unavailable.', error);
  }
  const staffAssetStatus = glbWorldLayer?.status || { loaded: 0, fallback: staff.length };
  const officeAssetStatus = glbOfficeLayer?.status || { placed: 0, assets: [], errors: [] };
  const combinedAssetStatus = {
    ...staffAssetStatus,
    staffLoaded: Number(staffAssetStatus.loaded) || 0,
    officePlaced: Number(officeAssetStatus.placed) || 0,
    officeAssets: Array.isArray(officeAssetStatus.assets) ? officeAssetStatus.assets : [],
    officeErrors: Array.isArray(officeAssetStatus.errors) ? officeAssetStatus.errors : [],
    staffFailed: Number(staffAssetStatus.failed) || 0,
    staffErrors: Array.isArray(staffAssetStatus.errors) ? staffAssetStatus.errors : [],
    worldReady: true,
    tier
  };
  callbacks.onAssetsReady?.(combinedAssetStatus);
  const assetStatusNode = document.getElementById('assetStatus');
  if (assetStatusNode) {
    const staffCount = combinedAssetStatus.staffLoaded;
    const officeCount = combinedAssetStatus.officePlaced;
    const failedCount = combinedAssetStatus.officeErrors.length
      + (Array.isArray(staffAssetStatus.rejected) ? staffAssetStatus.rejected.length : 0);
    assetStatusNode.textContent =
      \`GLB STAFF: \${staffCount}  ·  OFFICE GLB OBJECTS: \${officeCount}\`
      + (failedCount ? \`  ·  REVIEW: \${failedCount}\` : '')
      + \`  ·  \${String(tier).toUpperCase()}\`;
  }
  window.dispatchEvent(new CustomEvent('calloria:glb-world-assets-ready', { detail: combinedAssetStatus }));
  glbHealthPanel?.update?.(combinedAssetStatus);`
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
