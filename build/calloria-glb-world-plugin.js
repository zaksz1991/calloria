/**
 * Build-time adapter for the existing CALLORIA production world.
 * Keeps js/production-world.js untouched while adding the approved GLB layer
 * at three narrow, version-checked integration anchors.
 */
const TARGET = '/js/production-world.js';
const READY_ANCHOR = "  callbacks.onAssetsReady?.({ loaded: 0, fallback: staff.length, mode: 'merged-articulated-local-staff', tier });";
const UPDATE_ANCHOR = '      updateStaff(delta, timestamp / 1000); animate.lastStaffAt = timestamp;';
const DISPOSE_ANCHOR = '      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();';
const IMPORT_LINE = "import { integrateCalloriaGLBStaff } from './glb-world-integration.js';";
const MARKER = '__CALLORIA_GLB_WORLD_INTEGRATION_V12__';

function count(text, needle) {
  return text.split(needle).length - 1;
}

export function calloriaGLBWorldPlugin() {
  return {
    name: 'calloria-glb-world-integration-v1-2',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(TARGET)) return null;
      if (source.includes(MARKER)) return null;

      const anchors = [READY_ANCHOR, UPDATE_ANCHOR, DISPOSE_ANCHOR];
      for (const anchor of anchors) {
        const occurrences = count(source, anchor);
        if (occurrences !== 1) {
          this.error(`CALLORIA GLB integration expected exactly one production-world anchor (${occurrences} found). The source changed; refusing a partial integration.`);
        }
      }

      let code = `${IMPORT_LINE}\nconst ${MARKER} = true;\n${source}`;
      code = code.replace(READY_ANCHOR, `  let glbWorldLayer = null;\n  try {\n    glbWorldLayer = await integrateCalloriaGLBStaff({ THREE, scene, staff, tier });\n  } catch (error) {\n    console.warn('CALLORIA approved GLB staff integration unavailable; retaining local staff.', error);\n  }\n  callbacks.onAssetsReady?.(glbWorldLayer?.status || { loaded: 0, fallback: staff.length, mode: 'merged-articulated-local-staff', tier });`);
      code = code.replace(UPDATE_ANCHOR, `      updateStaff(delta, timestamp / 1000);\n      glbWorldLayer?.update?.(delta);\n      animate.lastStaffAt = timestamp;`);
      code = code.replace(DISPOSE_ANCHOR, `      disposed = true; stopLoop(); glbWorldLayer?.dispose?.(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();`);
      return { code, map: null };
    }
  };
}
