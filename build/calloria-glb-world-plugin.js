/**
 * CALLORIA GLB-first workplace activation + first-station onboarding.
 *
 * v2.9 extends the already-registered office GLB plan across more stations
 * without changing production-world.js, the Vite entry map, or the asset files.
 * The original v2.2 production-world transform remains intact.
 */
const TARGET = '/js/production-world.js';
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
const IMMERSIVE_ANCHOR =
  '    callbacks.onImmersiveChange?.(immersive);';
const SPAWN_ANCHOR =
  '      player.x = 0; player.z = 15.0; player.yaw = 0; player.pitch = -0.04;';
const IMPORTS = [
  "import { integrateCalloriaGLBStaff } from './glb-world-integration.js';",
  "import { integrateCalloriaGLBOfficeAssets } from './glb-office-world-integration.js';",
  "import { createCalloriaWorldMission } from './world-gameplay-mission.js';"
].join('\n');

const MARKER = '__CALLORIA_GLB_FIRST_WORKPLACE_V22__';
const OFFICE_MARKER = '__CALLORIA_GLB_WORKSTATION_COVERAGE_V29__';
const OFFICE_PLAN_ANCHOR = /const preferred = safeTier === 'low'\s*\?\s*\[[^\]]*\]\s*:\s*safeTier === 'high'\s*\?\s*\[[^\]]*\]\s*:\s*\[[^\]]*\];/g;
const HEADSET_PLAN_ANCHOR = /headsetStationIndexes:\s*safeTier === 'low'\s*\?\s*\[[^\]]*\]\s*:\s*\[\.\.\.deskStationIndexes\]/g;

function count(source, needle) {
  return source.split(needle).length - 1;
}
function requireExactlyOnce(context, source, anchor, label) {
  const occurrences = count(source, anchor);
  if (occurrences !== 1) {
    context.error(
      `CALLORIA GLB-first workplace v2.2 expected exactly one ${label} anchor (${occurrences} found). Refusing a partial transform.`
    );
  }
}
function transformOfficeCoverage(context, source) {
  if (source.includes(OFFICE_MARKER)) return null;
  const normalized = String(source).replace(/\r\n?/g, '\n');
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

/**
 * Vite plugin. Already registered through calloriaGLBWorldPlugin() in vite.config.js.
 */
export function calloriaGLBWorldPlugin() {
  return {
    name: 'calloria-glb-first-workplace-v2-2',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (normalizedId.endsWith(OFFICE_TARGET)) {
        return transformOfficeCoverage(this, source);
      }
      if (!normalizedId.endsWith(TARGET)) return null;
      if (source.includes(MARKER)) return null;
      const anchors = [
        [READY_ANCHOR, 'GLB-ready callback'],
        [UPDATE_ANCHOR, 'render-loop update'],
        [DISPOSE_ANCHOR, 'world disposal'],
        [NEAREST_ANCHOR, 'nearest-workstation callback'],
        [USE_ANCHOR, 'workstation USE callback'],
        [IMMERSIVE_ANCHOR, 'immersive-state callback'],
        [SPAWN_ANCHOR, 'initial player spawn']
      ];
      for (const [anchor, label] of anchors) {
        requireExactlyOnce(this, source, anchor, label);
      }
      let code = `${IMPORTS}\nconst ${MARKER} = true;\n${source}`;

      // Load staff and office GLBs independently. A missing/rejected GLB must
      // not prevent the world from starting or hide the original fallback.
      code = code.replace(
        READY_ANCHOR,
        `  let glbWorldLayer = null;
  let glbOfficeLayer = null;
  let worldMissionLayer = null;
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
    tier
  };
  callbacks.onAssetsReady?.(combinedAssetStatus);
  // Keep GLB telemetry honest: report actual model placements separately from
  // the procedural fallback objects that remain elsewhere on the office floor.
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
  }`
      );
      // Feed the two GLB layers from the existing frame loop. No second renderer
      // and no additional requestAnimationFrame loop are created.
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
      glbWorldLayer?.dispose?.();
      glbOfficeLayer?.dispose?.();
      worldMissionLayer?.dispose?.();
      visibilityObserver?.disconnect(); resizeObserver?.disconnect();`
      );
      // Start at station 11, which is included in every device-tier asset plan.
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
