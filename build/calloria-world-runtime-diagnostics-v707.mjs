/**
 * CALLORIA v7.07 — 3D scene/runtime diagnostics post-transform.
 * Adds a read-only scene snapshot section to the existing GLB asset panel.
 * It does not change asset loading, placement, rendering or save data.
 */
export const CALLORIA_WORLD_DIAGNOSTICS_V707_MARKER = '__CALLORIA_WORLD_RUNTIME_DIAGNOSTICS_V707__';

const TARGET = '/js/production-world.js';
const WORLD_MARKER = '__CALLORIA_GLB_FIRST_WORKPLACE_V22__';
const PANEL_ID = 'calloria-glb-health-panel-v682';
const IMPORT_LINE = "import { attachCalloriaWorldRuntimeDiagnostics } from './calloria-world-runtime-diagnostics-v707.js';";

function count(source, anchor) {
  return source.split(anchor).length - 1;
}

function replaceExactlyOnce(context, source, anchor, replacement, label) {
  const occurrences = count(source, anchor);
  if (occurrences !== 1) {
    context.warn?.(`CALLORIA v7.07 skipped: expected exactly one ${label} anchor, found ${occurrences}. Existing world source was left unchanged.`);
    return null;
  }
  return source.replace(anchor, replacement);
}

export function calloriaWorldRuntimeDiagnosticsPluginV707() {
  return {
    name: 'calloria-world-runtime-diagnostics-v7-07',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(TARGET)) return null;
      const input = String(source || '');
      if (input.includes(CALLORIA_WORLD_DIAGNOSTICS_V707_MARKER)) return null;
      if (!input.includes(WORLD_MARKER)) {
        this.warn?.('CALLORIA v7.07 skipped: the v6.84 GLB-first workplace transform is not present. No partial transform was applied.');
        return null;
      }

      const variableAnchor = 'let glbHealthPanel = null;';
      const createAnchor = 'glbHealthPanel = createCalloriaGLBHealthPanel({ host, tier });';
      const disposeAnchor = 'glbHealthPanel?.dispose?.();';
      for (const [anchor, label] of [
        [variableAnchor, 'GLB health panel state'],
        [createAnchor, 'GLB health panel creation'],
        [disposeAnchor, 'GLB health panel disposal']
      ]) {
        if (count(input, anchor) !== 1) {
          this.warn?.(`CALLORIA v7.07 skipped: expected exactly one ${label} anchor, found ${count(input, anchor)}. No partial transform was applied.`);
          return null;
        }
      }

      let code = `${IMPORT_LINE}\n/* ${CALLORIA_WORLD_DIAGNOSTICS_V707_MARKER} */\n${input}`;
      code = replaceExactlyOnce(
        this,
        code,
        variableAnchor,
        `${variableAnchor}\n  let worldRuntimeDiagnostics = null;`,
        'GLB health panel state'
      );
      if (!code) return null;

      code = replaceExactlyOnce(
        this,
        code,
        createAnchor,
        `${createAnchor}\n    worldRuntimeDiagnostics = attachCalloriaWorldRuntimeDiagnostics({\n      THREE, scene, camera, renderer, tier, panelId: '${PANEL_ID}'\n    });`,
        'GLB health panel creation'
      );
      if (!code) return null;

      code = replaceExactlyOnce(
        this,
        code,
        disposeAnchor,
        `worldRuntimeDiagnostics?.dispose?.();\n      ${disposeAnchor}`,
        'GLB health panel disposal'
      );
      if (!code) return null;
      return { code, map: null };
    }
  };
}
