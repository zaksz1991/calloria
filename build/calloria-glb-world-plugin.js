/**
 * CALLORIA GLB-first world integration adapter.
 *
 * Extends the existing production-world without replacing its 1,198-line
 * presentation/controller module. The transform is deliberately anchored and
 * fails closed when the upstream source changes.
 */
const WORLD_TARGET = '/js/production-world.js';
const STAFF_TARGET = '/js/glb-world-integration.js';
const MAIN_TARGET = '/js/main.js';

const READY_ANCHOR = "  callbacks.onAssetsReady?.({ loaded: 0, fallback: staff.length, mode: 'merged-articulated-local-staff', tier });";
const UPDATE_ANCHOR = '      updateStaff(delta, timestamp / 1000); animate.lastStaffAt = timestamp;';
const DISPOSE_ANCHOR = '      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();';
const PLAYER_ANCHOR = '  const player = { x: 0, z: 15.0, yaw: 0, pitch: -0.04, speed: 4.35 };';
const PLAYER_RESET_ANCHOR = '      player.x = 0; player.z = 15.0; player.yaw = 0; player.pitch = -0.04;';
const NEAREST_ANCHOR = '      callbacks.onNearestStation?.(nearestStation ? { id: nearestStation.id, label: nearestStation.label, department: nearestStation.department } : null);';
const USE_ANCHOR = '    callbacks.onStation?.({ id: nearestStation.id, label: nearestStation.label, department: nearestStation.department });';
const ASSET_MESSAGE_ANCHOR = "    get assetMessage() { return 'CALLORIA 3D workplace and draw-call-merged articulated staff ready'; },";
const IMMERSIVE_ANCHOR = '    callbacks.onImmersiveChange?.(immersive);';

const IMPORT_STAFF = "import { integrateCalloriaGLBStaff } from './glb-world-integration.js';";
const IMPORT_OFFICE = "import { integrateCalloriaGLBOfficeAssets } from './glb-office-world-integration.js';";
const IMPORT_MISSION = "import { createCalloriaWorldMission } from './world-gameplay-mission.js';";
const WORLD_MARKER = '__CALLORIA_GLB_FIRST_WORKPLACE_V21__';

const HUMAN_SCALE_ANCHOR = [
  '      const humanScale = metrics.size.y >= 1.0 && metrics.size.y <= 2.6',
  '        && metrics.size.x >= 0.2 && metrics.size.x <= 1.35',
  '        && metrics.size.z >= 0.12 && metrics.size.z <= 1.35;'
].join('\n');
const RIG_ANCHOR = '      const rigValid = metrics.skinnedMeshCount > 0 && metrics.skeletonCount > 0 && metrics.boneCount >= 15;';
const MODEL_REJECT_ANCHOR = '      if (!humanScale || !rigValid || !geometryValid || !texturesValid || !extensionsValid) {';
const RIG_REASON_ANCHOR = "        if (!rigValid) reasons.push('usable character skeleton not detected');";
const STANDING_IDLE_ANCHOR = [
  '      // A standing supervisor/support character may use a subtle bone-aware',
  '      // idle loop. A seated employee is never shown without a seated clip.',
  '      if (!person.seated) {',
  '        const idleAvailable = Boolean(createProceduralIdlePose(candidate.gltf.scene));',
  '        if (idleAvailable) {',
  '          selected = candidate;',
  '          useProceduralIdle = true;',
  '          break;',
  '        }',
  '      }'
].join('\n');
const STATIC_IDLE_DECLARATION = '    let useProceduralIdle = false;';
const STATIC_IDLE_GUARD = '    if (!clip && !idleProfile) {';
const STATIC_IDLE_UPDATE = '        if (entry.idleProfile) updateProceduralIdlePose(entry.idleProfile, elapsed, entry.phase);';

const MAIN_STATUS_ANCHOR = "        const label=result.loaded?`${result.loaded} 3D STAFF ASSETS READY`:'OPTIMISED LOCAL STAFF MODELS ACTIVE';";

function count(source, needle) {
  return source.split(needle).length - 1;
}

function replaceExactlyOnce(context, source, anchor, replacement, description = anchor) {
  const occurrences = count(source, anchor);
  if (occurrences !== 1) {
    context.error(`CALLORIA GLB world integration expected exactly one ${description} anchor (${occurrences} found). Refusing a partial transform.`);
  }
  return source.replace(anchor, replacement);
}

function transformProductionWorld(context, source) {
  if (source.includes(WORLD_MARKER)) return null;
  const required = [READY_ANCHOR, UPDATE_ANCHOR, DISPOSE_ANCHOR, PLAYER_ANCHOR, PLAYER_RESET_ANCHOR, NEAREST_ANCHOR, USE_ANCHOR, ASSET_MESSAGE_ANCHOR, IMMERSIVE_ANCHOR];
  for (const anchor of required) {
    const occurrences = count(source, anchor);
    if (occurrences !== 1) context.error(`CALLORIA GLB world integration expected exactly one production-world anchor (${occurrences} found): ${anchor}`);
  }

  let code = `${IMPORT_STAFF}\n${IMPORT_OFFICE}\n${IMPORT_MISSION}\nconst ${WORLD_MARKER} = true;\n${source}`;
  code = replaceExactlyOnce(context, code, PLAYER_ANCHOR,
    '  // Spawn at the front edge of GLB-backed Agent Station 11.\n  // This is the station approach point used by updatePlayer(), so USE is active immediately.\n  const player = { x: 2.9, z: 7.65, yaw: 0, pitch: -0.04, speed: 4.35 };',
    'mobile workstation spawn');
  code = replaceExactlyOnce(context, code, PLAYER_RESET_ANCHOR,
    '      // Return to the same usable GLB-backed workstation whenever the player enters the floor.\n      player.x = 2.9; player.z = 7.65; player.yaw = 0; player.pitch = -0.04;',
    'mobile workstation re-entry spawn');

  code = replaceExactlyOnce(context, code, READY_ANCHOR, `  let glbWorldLayer = null;\n  let glbOfficeLayer = null;\n  let glbOfficeStatus = { placed: 0, assets: [], loading: true, errors: [] };\n  const worldMissionLayer = createCalloriaWorldMission({ host, tier });\n  try {\n    glbWorldLayer = await integrateCalloriaGLBStaff({ THREE, scene, staff, tier });\n  } catch (error) {\n    console.warn('CALLORIA GLB staff layer unavailable; procedural staff remain visible.', error);\n  }\n  const notifyWorldAssets = () => {\n    const staffStatus = glbWorldLayer?.status || { loaded: 0, fallback: staff.length, mode: 'procedural-fallback-only' };\n    callbacks.onAssetsReady?.({\n      loaded: Number(staffStatus.loaded || 0),\n      fallback: Number(staffStatus.fallback ?? staff.length),\n      mode: staffStatus.mode || 'procedural-fallback-only',\n      tier,\n      furnitureLoaded: Number(glbOfficeStatus.placed || 0),\n      furnitureAssets: glbOfficeStatus.assets || [],\n      furnitureLoading: Boolean(glbOfficeStatus.loading),\n      furnitureErrors: glbOfficeStatus.errors || []\n    });\n  };\n  notifyWorldAssets();\n  // Office GLBs load in the background; first-frame controls and the world are not blocked.\n  integrateCalloriaGLBOfficeAssets({ THREE, scene, stations, tier }).then((layer) => {\n    if (disposed) { layer.dispose?.(); return; }\n    glbOfficeLayer = layer;\n    glbOfficeStatus = layer.status || { placed: 0, assets: [], errors: [] };\n    glbOfficeStatus.loading = false;\n    notifyWorldAssets();\n    renderStill();\n  }).catch((error) => {\n    if (disposed) return;\n    glbOfficeStatus = { placed: 0, assets: [], loading: false, errors: [String(error?.message || error)] };\n    console.warn('CALLORIA office GLBs could not be integrated; existing furniture remains visible.', error);\n    notifyWorldAssets();\n  });`, 'world asset readiness');

  code = replaceExactlyOnce(context, code, UPDATE_ANCHOR,
    '      updateStaff(delta, timestamp / 1000);\n      glbWorldLayer?.update?.(delta);\n      glbOfficeLayer?.update?.(delta);\n      animate.lastStaffAt = timestamp;', 'world update loop');

  code = replaceExactlyOnce(context, code, NEAREST_ANCHOR,
    `${NEAREST_ANCHOR}\n      window.dispatchEvent(new CustomEvent('calloria:world-nearest-station', { detail: nearestStation ? { id: nearestStation.id, label: nearestStation.label, department: nearestStation.department } : null }));`,
    'nearest-station objective signal');

  code = replaceExactlyOnce(context, code, USE_ANCHOR,
    `    const selectedStation = { id: nearestStation.id, label: nearestStation.label, department: nearestStation.department };\n    window.dispatchEvent(new CustomEvent('calloria:world-station-accessed', { detail: selectedStation }));\n    callbacks.onStation?.(selectedStation);`,
    'workstation-use objective signal');

  code = replaceExactlyOnce(context, code, IMMERSIVE_ANCHOR,
    `    window.dispatchEvent(new CustomEvent('calloria:world-immersive', { detail: { active: immersive } }));\n${IMMERSIVE_ANCHOR}`,
    'immersive objective signal');

  code = replaceExactlyOnce(context, code, ASSET_MESSAGE_ANCHOR,
    "    get assetMessage() {\n      const staffCount = Number(glbWorldLayer?.status?.loaded || 0);\n      const officeCount = Number(glbOfficeLayer?.status?.placed || 0);\n      return staffCount || officeCount\n        ? `CALLORIA GLB world active: ${staffCount} staff models, ${officeCount} office models`\n        : 'Procedural fallback active; GLB assets not yet confirmed';\n    },",
    'truthful GLB world status');

  code = replaceExactlyOnce(context, code, DISPOSE_ANCHOR,
    '      disposed = true; stopLoop(); glbWorldLayer?.dispose?.(); glbOfficeLayer?.dispose?.(); worldMissionLayer?.dispose?.(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();',
    'world resource disposal');
  return { code, map: null };
}

function transformStaffIntegration(context, source) {
  const marker = '__CALLORIA_STATIC_STANDING_GLB_V2__';
  if (source.includes(marker)) return null;
  let code = source;
  code = replaceExactlyOnce(context, code, HUMAN_SCALE_ANCHOR,
    `      // GLB authors use different unit scales (metres, centimetres, or normalized units).
      // Validate human-like proportions, then normalize the accepted model to the agent height below.
      const humanScale = metrics.size.y >= 0.08 && metrics.size.y <= 25
        && metrics.size.x >= metrics.size.y * 0.10 && metrics.size.x <= metrics.size.y * 1.25
        && metrics.size.z >= metrics.size.y * 0.05 && metrics.size.z <= metrics.size.y * 0.95;`,
    'unit-independent human proportions');
  code = replaceExactlyOnce(context, code, RIG_ANCHOR,
    `      // Four-bone rigs are sufficient for basic skeletal posing. Static character meshes are\n      // also allowed for standing support staff; seated agents still require a seated clip.\n      const rigValid = metrics.skinnedMeshCount > 0 && metrics.skeletonCount > 0 && metrics.boneCount >= 4;\n      const staticCharacterValid = metrics.meshCount > 0 && metrics.skinnedMeshCount === 0;\n      const ${marker} = true;`,
    'relaxed character-rig compatibility');
  code = replaceExactlyOnce(context, code, MODEL_REJECT_ANCHOR,
    '      if (!humanScale || (!rigValid && !staticCharacterValid) || !geometryValid || !texturesValid || !extensionsValid) {',
    'character compatibility gate');
  code = replaceExactlyOnce(context, code, RIG_REASON_ANCHOR,
    "        if (!rigValid && !staticCharacterValid) reasons.push('no usable character mesh or skin binding detected');",
    'character rejection explanation');
  code = replaceExactlyOnce(context, code, STATIC_IDLE_DECLARATION,
    '    let useProceduralIdle = false;\n    let useStaticIdle = false;',
    'static character idle state');
  code = replaceExactlyOnce(context, code, STANDING_IDLE_ANCHOR,
    `      // Standing roles can use a skeletal idle or a subtle root-level idle.\n      // Seated roles still require an authored seated/typing clip; never seat a T-pose.\n      if (!person.seated) {\n        const idleAvailable = Boolean(createProceduralIdlePose(candidate.gltf.scene));\n        if (idleAvailable) {\n          selected = candidate;\n          useProceduralIdle = true;\n          break;\n        }\n        if (candidate.metrics.meshCount > 0 && candidate.metrics.skinnedMeshCount === 0) {\n          selected = candidate;\n          useStaticIdle = true;\n          break;\n        }\n      }`,
    'standing static-character selection');
  code = replaceExactlyOnce(context, code, STATIC_IDLE_GUARD,
    '    if (!clip && !idleProfile && !useStaticIdle) {',
    'static model acceptance');
  code = replaceExactlyOnce(context, code,
    '      idleProfile,\n      phase: Number(person.phase) || 0,',
    '      idleProfile,\n      staticIdle: useStaticIdle,\n      phase: Number(person.phase) || 0,',
    'static model tracking');
  code = replaceExactlyOnce(context, code, STATIC_IDLE_UPDATE,
    `${STATIC_IDLE_UPDATE}\n        if (entry.staticIdle) {\n          entry.wrapper.position.y = entry.person.root.position.y + Math.sin(elapsed * 1.35 + entry.phase) * 0.008;\n          entry.wrapper.rotation.y = entry.person.root.rotation.y + Math.sin(elapsed * 0.55 + entry.phase) * 0.025;\n        }`,
    'static model idle update');
  return { code, map: null };
}

function transformMainStatus(context, source) {
  const marker = '__CALLORIA_TRUTHFUL_GLB_STATUS_V1__';
  if (source.includes(marker)) return null;
  const replacement = `        // ${marker}
        const staffCount=Number(result.loaded||0);
        const officeCount=Number(result.furnitureLoaded||0);
        const failureCount=Array.isArray(result.furnitureErrors)?result.furnitureErrors.length:0;
        const activeParts=[];
        if(staffCount)activeParts.push(\`${'${staffCount}'} GLB STAFF\`);
        if(officeCount)activeParts.push(\`${'${officeCount}'} GLB OFFICE OBJECTS\`);
        const label=activeParts.length
          ? \`${'${activeParts.join(` · `)}'}${'${result.furnitureLoading ? ` · OFFICE ASSETS LOADING` : ``}'}${'${failureCount ? ` · ${failureCount} ASSET LOAD FAILURES` : ``}'}\`
          : result.furnitureLoading?'LOADING REAL GLB OFFICE ASSETS…':\`NO GLB MODELS CONFIRMED · PROCEDURAL FALLBACK${'${failureCount ? ` · ${failureCount} ASSET LOAD FAILURES` : ``}'}\`;
        if(failureCount)console.warn('CALLORIA GLB asset loading details:',result.furnitureErrors);`;
  const code = replaceExactlyOnce(context, source, MAIN_STATUS_ANCHOR, replacement, 'truthful asset-status label');
  return { code, map: null };
}

export function calloriaGLBWorldPlugin() {
  return {
    name: 'calloria-glb-first-real-workplace-v2-1',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (normalizedId.endsWith(WORLD_TARGET)) return transformProductionWorld(this, source);
      if (normalizedId.endsWith(STAFF_TARGET)) return transformStaffIntegration(this, source);
      if (normalizedId.endsWith(MAIN_TARGET)) return transformMainStatus(this, source);
      return null;
    }
  };
}
