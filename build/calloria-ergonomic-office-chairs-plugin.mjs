/**
 * CALLORIA v3.1 — replace selected placeholder workstation chairs with a
 * validated CC0 ergonomic task-chair GLB. This transform runs strictly after
 * the v3.0 lobby transform and fails closed when its source anchors drift.
 */
const TARGET = '/js/production-world.js';
const BASE_MARKER = '__CALLORIA_CC0_OFFICE_LOBBY_V30__';
const MARKER = '__CALLORIA_CC0_ERGONOMIC_CHAIRS_V31__';

const IMPORT = "import { integrateCalloriaCC0OfficeChairs } from './cc0-office-chair-integration.js';";

const ANCHORS = Object.freeze({
  declaration: '  let cc0LobbyLayer = null;',
  missionInit: '  try {\n    worldMissionLayer = createCalloriaWorldMission({ host });',
  update: '      cc0LobbyLayer?.update?.(delta);',
  dispose: '      cc0LobbyLayer?.dispose?.();',
  statusTail: '      + `  ·  ${lobbyLabel}`\n      + `  ·  ${String(tier).toUpperCase()}`;'
});

function count(source, needle) {
  return needle ? source.split(needle).length - 1 : 0;
}

export function calloriaErgonomicOfficeChairsPlugin() {
  return {
    name: 'calloria-ergonomic-office-chairs-v3-1',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(TARGET)) return null;
      if (source.includes(MARKER)) return null;
      if (!source.includes(BASE_MARKER)) {
        this.warn('CALLORIA v3.1 chair integration skipped: v3.0 lobby transform was not present. Existing chairs remain unchanged.');
        return null;
      }

      const missing = Object.entries(ANCHORS).filter(([, anchor]) => count(source, anchor) !== 1);
      if (missing.length) {
        this.warn(`CALLORIA v3.1 chair integration skipped safely; source anchors changed: ${missing.map(([name]) => name).join(', ')}. Existing chairs remain unchanged.`);
        return null;
      }

      let code = `${IMPORT}\nconst ${MARKER} = true;\n${source}`;
      code = code.replace(
        ANCHORS.declaration,
        `  let cc0LobbyLayer = null;\n  let cc0ChairLayer = null;\n  let chairAssetStatus = { loaded: false, reason: 'loading' };\n  let cc0ChairDisposed = false;`
      );
      code = code.replace(
        ANCHORS.missionInit,
        `  void integrateCalloriaCC0OfficeChairs({ scene, stations, tier, isActive: () => !cc0ChairDisposed }).then((layer) => {\n    if (cc0ChairDisposed) { layer?.dispose?.(); return; }\n    cc0ChairLayer = layer;\n    chairAssetStatus = layer?.status || { loaded: false, reason: 'chair layer returned no status' };\n    const chairLabel = chairAssetStatus.loaded ? 'CHAIRS: CC0 GLB' : 'CHAIRS: FALLBACK';\n    const statusNode = document.getElementById('assetStatus');\n    if (statusNode) statusNode.textContent = statusNode.textContent.replace(/CHAIRS: (?:LOADING|FALLBACK|CC0 GLB)/, chairLabel);\n    window.dispatchEvent(new CustomEvent('calloria:glb-chairs-ready', { detail: chairAssetStatus }));\n  }).catch((error) => {\n    chairAssetStatus = { loaded: false, reason: String(error?.message || error) };\n    const statusNode = document.getElementById('assetStatus');\n    if (statusNode) statusNode.textContent = statusNode.textContent.replace(/CHAIRS: (?:LOADING|FALLBACK|CC0 GLB)/, 'CHAIRS: FALLBACK');\n    console.warn('CALLORIA CC0 task chairs unavailable; retaining existing chairs.', error);\n  });\n  try {\n    worldMissionLayer = createCalloriaWorldMission({ host });`
      );
      code = code.replace(
        ANCHORS.statusTail,
        `      + \`  ·  \${lobbyLabel}\`\n      + \`  ·  \${chairAssetStatus.loaded ? 'CHAIRS: CC0 GLB' : chairAssetStatus.reason === 'loading' ? 'CHAIRS: LOADING' : 'CHAIRS: FALLBACK'}\`\n      + \`  ·  \${String(tier).toUpperCase()}\`;`
      );
      code = code.replace(ANCHORS.update, `${ANCHORS.update}\n      cc0ChairLayer?.update?.(delta);`);
      code = code.replace(
        ANCHORS.dispose,
        `${ANCHORS.dispose}\n      cc0ChairDisposed = true;\n      cc0ChairLayer?.dispose?.();`
      );
      return { code, map: null };
    }
  };
}

export const __ergonomicChairPluginTest = Object.freeze({ TARGET, BASE_MARKER, MARKER, IMPORT, ANCHORS, count });
