/**
 * CALLORIA v3.0 — activates a real CC0 lobby GLB inside the existing world.
 * Runs after the established GLB-first transform. Missing anchors produce a
 * warning and leave the original world untouched; they never break the build.
 */
const TARGET = '/js/production-world.js';
const BASE_MARKER = '__CALLORIA_GLB_FIRST_WORKPLACE_V22__';
const MARKER = '__CALLORIA_CC0_OFFICE_LOBBY_V30__';

const IMPORT = "import { integrateCalloriaCC0Lobby } from './cc0-office-lobby-integration.js';";

const ANCHORS = Object.freeze({
  declarations: '  let glbOfficeLayer = null;\n  let worldMissionLayer = null;',
  missionInit: '  try {\n    worldMissionLayer = createCalloriaWorldMission({ host });',
  update: '      glbOfficeLayer?.update?.(delta);',
  dispose: '      glbOfficeLayer?.dispose?.();',
  officeStatus: '  const officeAssetStatus = glbOfficeLayer?.status || { placed: 0, assets: [], errors: [] };',
  statusNode: '    const officeCount = combinedAssetStatus.officePlaced;',
  statusTail: '      + `  ·  ${String(tier).toUpperCase()}`;'
});

function count(source, needle) {
  return needle ? source.split(needle).length - 1 : 0;
}

export function calloriaCC0OfficeLobbyPlugin() {
  return {
    name: 'calloria-cc0-office-lobby-v3-0',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(TARGET)) return null;
      if (source.includes(MARKER)) return null;
      if (!source.includes(BASE_MARKER)) {
        this.warn('CALLORIA v3.0 lobby integration skipped: GLB-first world transform was not present. Existing reception remains unchanged.');
        return null;
      }

      const missing = Object.entries(ANCHORS).filter(([, anchor]) => count(source, anchor) !== 1);
      if (missing.length) {
        this.warn(`CALLORIA v3.0 lobby integration skipped safely; source anchors changed: ${missing.map(([name]) => name).join(', ')}. Existing reception remains unchanged.`);
        return null;
      }

      let code = `${IMPORT}\nconst ${MARKER} = true;\n${source}`;
      code = code.replace(
        ANCHORS.declarations,
        `  let glbOfficeLayer = null;\n  let cc0LobbyLayer = null;\n  let lobbyAssetStatus = { loaded: false, reason: 'loading' };\n  let cc0LobbyDisposed = false;\n  let worldMissionLayer = null;`
      );
      code = code.replace(
        ANCHORS.missionInit,
        `  void integrateCalloriaCC0Lobby({ scene, tier, isActive: () => !cc0LobbyDisposed }).then((layer) => {\n    if (cc0LobbyDisposed) { layer?.dispose?.(); return; }\n    cc0LobbyLayer = layer;\n    lobbyAssetStatus = layer?.status || { loaded: false, reason: 'lobby layer returned no status' };\n    const lobbyLabel = lobbyAssetStatus.loaded ? 'LOBBY: CC0 GLB' : 'LOBBY: FALLBACK';\n    const statusNode = document.getElementById('assetStatus');\n    if (statusNode) statusNode.textContent = statusNode.textContent.replace(/LOBBY: (?:LOADING|FALLBACK|CC0 GLB)/, lobbyLabel);\n    window.dispatchEvent(new CustomEvent('calloria:glb-lobby-ready', { detail: lobbyAssetStatus }));\n  }).catch((error) => {\n    lobbyAssetStatus = { loaded: false, reason: String(error?.message || error) };\n    const statusNode = document.getElementById('assetStatus');\n    if (statusNode) statusNode.textContent = statusNode.textContent.replace(/LOBBY: (?:LOADING|FALLBACK|CC0 GLB)/, 'LOBBY: FALLBACK');\n    console.warn('CALLORIA CC0 lobby unavailable; retaining existing reception.', error);\n  });\n  try {\n    worldMissionLayer = createCalloriaWorldMission({ host });`
      );
      code = code.replace(
        '    officeErrors: Array.isArray(officeAssetStatus.errors) ? officeAssetStatus.errors : [],',
        `    officeErrors: Array.isArray(officeAssetStatus.errors) ? officeAssetStatus.errors : [],\n    lobbyLoaded: Boolean(lobbyAssetStatus.loaded),\n    lobbyStatus: lobbyAssetStatus,`
      );
      code = code.replace(
        ANCHORS.statusNode,
        `${ANCHORS.statusNode}\n    const lobbyLabel = lobbyAssetStatus.loaded ? 'LOBBY: CC0 GLB' : lobbyAssetStatus.reason === 'loading' ? 'LOBBY: LOADING' : 'LOBBY: FALLBACK';`
      );
      code = code.replace(
        ANCHORS.statusTail,
        '      + `  ·  ${lobbyLabel}`\n      + `  ·  ${String(tier).toUpperCase()}`;'
      );
      code = code.replace(
        ANCHORS.update,
        `${ANCHORS.update}\n      cc0LobbyLayer?.update?.(delta);`
      );
      code = code.replace(
        ANCHORS.dispose,
        `${ANCHORS.dispose}\n      cc0LobbyDisposed = true;\n      cc0LobbyLayer?.dispose?.();`
      );
      return { code, map: null };
    }
  };
}

export const __cc0LobbyPluginTest = Object.freeze({ TARGET, BASE_MARKER, MARKER, IMPORT, ANCHORS, count });
