/**
 * CALLORIA v2.8: make the existing staff GLB layer load Meshopt assets and
 * permit safe static GLB replacements at standing support positions.
 *
 * Seated staff are never replaced by a static/unposed model. Existing rigged
 * characters and embedded animation clips keep their normal priority.
 */
const TARGET = '/js/glb-world-integration.js';
const MARKER = '__CALLORIA_GLB_STAFF_RUNTIME_V28__';
const LOADER_IMPORT = "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';";
const LOADER_CREATE = '  const loader = new GLTFLoader();';
const RIG_CHECK = '      const rigValid = metrics.skinnedMeshCount > 0 && metrics.skeletonCount > 0 && metrics.boneCount >= 15;';
const EXTENSION_CHECK = "      const extensionsValid = !requiredExtensions.some((extension) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension));";
const REJECTION_CHECK = '      if (!humanScale || !rigValid || !geometryValid || !texturesValid || !extensionsValid) {';
const MODEL_STORE = '      loadedModels.set(asset.id, { gltf, asset, metrics });';
const STATIC_IDLE_BRANCH = `      if (!person.seated) {
        const idleAvailable = Boolean(createProceduralIdlePose(candidate.gltf.scene));
        if (idleAvailable) {
          selected = candidate;
          useProceduralIdle = true;
          break;
        }
      }`;
const NO_MOTION_GUARD = '    if (!clip && !idleProfile) {';
const LOADED_STATUS = '      loaded: replacements.length,';

function count(source, needle) {
  return source.split(needle).length - 1;
}

function requireOnce(context, source, needle, label) {
  const occurrences = count(source, needle);
  if (occurrences !== 1) {
    context.error(`CALLORIA GLB staff runtime v2.8 expected exactly one ${label} anchor (${occurrences} found). Refusing a partial transform.`);
  }
}

function transformStaff(context, source) {
  if (source.includes(MARKER)) return null;
  const codeSource = String(source).replace(/\r\n?/g, '\n');
  const anchors = [
    [LOADER_IMPORT, 'GLTFLoader import'],
    [LOADER_CREATE, 'staff GLTFLoader creation'],
    [RIG_CHECK, 'legacy 15-bone restriction'],
    [EXTENSION_CHECK, 'legacy compression rejection'],
    [REJECTION_CHECK, 'staff model rejection condition'],
    [MODEL_STORE, 'staff model registry insertion'],
    [STATIC_IDLE_BRANCH, 'standing staff idle-selection branch'],
    [NO_MOTION_GUARD, 'no-motion replacement guard'],
    [LOADED_STATUS, 'staff replacement status count']
  ];
  for (const [anchor, label] of anchors) requireOnce(context, codeSource, anchor, label);

  let code = `/* ${MARKER} */\n${codeSource}`;
  code = code.replace(LOADER_IMPORT, `${LOADER_IMPORT}\nimport { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';`);
  code = code.replace(LOADER_CREATE, `${LOADER_CREATE}\n  loader.setMeshoptDecoder(MeshoptDecoder);`);
  code = code.replace(RIG_CHECK, '      const hasUsableRig = metrics.skinnedMeshCount > 0 && metrics.skeletonCount > 0;');
  code = code.replace(EXTENSION_CHECK, "      const extensionsValid = !requiredExtensions.includes('KHR_draco_mesh_compression');");
  code = code.replace(REJECTION_CHECK, '      if (!humanScale || !geometryValid || !texturesValid || !extensionsValid) {');
  code = code.replace(MODEL_STORE, '      loadedModels.set(asset.id, { gltf, asset, metrics, hasUsableRig });');
  code = code.replace('    let useProceduralIdle = false;', '    let useProceduralIdle = false;\n    let useStaticModel = false;');
  code = code.replace(STATIC_IDLE_BRANCH, `      if (!person.seated) {
        const idleAvailable = Boolean(createProceduralIdlePose(candidate.gltf.scene));
        if (idleAvailable) {
          selected = candidate;
          useProceduralIdle = true;
          break;
        }
        // A mesh-only GLB is safe for a standing support position. Do not
        // force a static model into a seated agent position.
        if (!candidate.hasUsableRig) {
          selected = candidate;
          useStaticModel = true;
          break;
        }
      }`);
  code = code.replace(NO_MOTION_GUARD, '    if (!clip && !idleProfile && !useStaticModel) {');
  code = code.replace(LOADED_STATUS, `${LOADED_STATUS}\n      animatedLoaded: replacements.filter((entry) => !entry.staticModel).length,\n      staticLoaded: replacements.filter((entry) => entry.staticModel).length,`);
  code = code.replace("      clipName: clip?.name || 'CALLORIA procedural skeletal idle'", "      clipName: clip?.name || (useProceduralIdle ? 'CALLORIA procedural skeletal idle' : 'Static GLB — no embedded animation'),\n      staticModel: useStaticModel");
  return { code, map: null };
}

export function calloriaGLBStaffRuntimePlugin() {
  return {
    name: 'calloria-glb-staff-runtime-v2-8',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(TARGET)) return null;
      return transformStaff(this, source);
    }
  };
}

export const __calloriaGLBStaffRuntimeTest = Object.freeze({
  TARGET,
  MARKER,
  LOADER_IMPORT,
  LOADER_CREATE,
  RIG_CHECK,
  EXTENSION_CHECK,
  REJECTION_CHECK,
  MODEL_STORE,
  STATIC_IDLE_BRANCH,
  NO_MOTION_GUARD,
  LOADED_STATUS,
  transformStaff
});
