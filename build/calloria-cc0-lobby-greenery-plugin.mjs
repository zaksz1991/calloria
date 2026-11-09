/**
 * CALLORIA v3.2 — add a light CC0 greenery pass to the v3.0 lobby GLB.
 * It relies on authored planter names and applies no guessed world positions.
 * Runs after the v3.1 chair plugin. All source edits are fail-closed.
 */
const LOBBY_TARGET = '/js/cc0-office-lobby-integration.js';
const WORLD_TARGET = '/js/production-world.js';
const BASE_MARKER = '__CALLORIA_CC0_OFFICE_LOBBY_V30__';
const CHAIR_MARKER = '__CALLORIA_CC0_ERGONOMIC_CHAIRS_V31__';
const LOBBY_MARKER = '__CALLORIA_CC0_LOBBY_GREENERY_V32__';
const WORLD_MARKER = '__CALLORIA_GREENERY_STATUS_V32__';

const IMPORT = "import { addCalloriaLobbyGreenery } from './cc0-lobby-greenery-integration.js';";

const LOBBY_ANCHORS = Object.freeze({
  disposeImport: "import { disposeGLTFResources } from './glb-asset-loader.js';",
  hiddenLegacy: '  let hiddenLegacy = [];',
  validated: "    if (!validation.valid) throw new Error(validation.errors.join('; '));\n\n    const renderRoot = createLobbyRenderRoot(gltf);",
  mergeNote: '        mergeNote: renderRoot.mergeReason',
  dispose: '        if (placedRoot) scene.remove(placedRoot);\n        for (const geometry of mergedGeometries) geometry.dispose();',
  catch: '    if (placedRoot) scene.remove(placedRoot);\n    if (gltf) disposeGLTFResources(gltf);'
});

const WORLD_ANCHORS = Object.freeze({
  declaration: "  let chairAssetStatus = { loaded: false, reason: 'loading' };",
  lobbyStatus: "    lobbyAssetStatus = layer?.status || { loaded: false, reason: 'lobby layer returned no status' };",
  lobbyNode: "    if (statusNode) statusNode.textContent = statusNode.textContent.replace(/LOBBY: (?:LOADING|FALLBACK|CC0 GLB)/, lobbyLabel);",
  lobbyCatch: "    lobbyAssetStatus = { loaded: false, reason: String(error?.message || error) };",
  catchNode: "    if (statusNode) statusNode.textContent = statusNode.textContent.replace(/LOBBY: (?:LOADING|FALLBACK|CC0 GLB)/, 'LOBBY: FALLBACK');",
  statusTail: '      + `  ·  ${lobbyLabel}`\n      + `  ·  ${chairAssetStatus.loaded ? \'CHAIRS: CC0 GLB\' : chairAssetStatus.reason === \'loading\' ? \'CHAIRS: LOADING\' : \'CHAIRS: FALLBACK\'}`\n      + `  ·  ${String(tier).toUpperCase()}`;'
});

function count(source, needle) {
  return needle ? source.split(needle).length - 1 : 0;
}

function applyAnchoredReplacements(source, anchors, replacements) {
  const missing = Object.entries(anchors).filter(([, anchor]) => count(source, anchor) !== 1);
  if (missing.length) return { ok: false, missing: missing.map(([name]) => name) };
  let code = source;
  for (const [name, anchor] of Object.entries(anchors)) code = code.replace(anchor, replacements[name]);
  return { ok: true, code };
}

function transformLobby(source, pluginContext) {
  if (source.includes(LOBBY_MARKER)) return null;
  if (!source.includes('export async function integrateCalloriaCC0Lobby(')) {
    pluginContext.warn('CALLORIA v3.2 greenery skipped: expected v3.0 lobby integration was not found. Existing lobby remains unchanged.');
    return null;
  }

  const replacements = {
    disposeImport: `${LOBBY_ANCHORS.disposeImport}\n${IMPORT}`,
    hiddenLegacy: `${LOBBY_ANCHORS.hiddenLegacy}\n  let greeneryLease = null;`,
    validated: `    if (!validation.valid) throw new Error(validation.errors.join('; '));\n\n    greeneryLease = await addCalloriaLobbyGreenery(gltf, { isActive: () => !disposed && isActive() });\n    if (disposed || !isActive()) {\n      greeneryLease?.dispose?.();\n      greeneryLease = null;\n      disposeGLTFResources(gltf);\n      return { status: { loaded: false, reason: 'world disposed during greenery integration' }, update() {}, dispose() {} };\n    }\n\n    const renderRoot = createLobbyRenderRoot(gltf);`,
    mergeNote: `${LOBBY_ANCHORS.mergeNote},\n        greenery: greeneryLease?.status || { loaded: false, reason: 'greenery integration returned no status' }`,
    dispose: `        if (placedRoot) scene.remove(placedRoot);\n        greeneryLease?.dispose?.();\n        greeneryLease = null;\n        for (const geometry of mergedGeometries) geometry.dispose();`,
    catch: `    if (placedRoot) scene.remove(placedRoot);\n    greeneryLease?.dispose?.();\n    greeneryLease = null;\n    if (gltf) disposeGLTFResources(gltf);`
  };
  const result = applyAnchoredReplacements(source, LOBBY_ANCHORS, replacements);
  if (!result.ok) {
    pluginContext.warn(`CALLORIA v3.2 greenery skipped safely; lobby source anchors changed: ${result.missing.join(', ')}. Existing lobby remains unchanged.`);
    return null;
  }
  return `const ${LOBBY_MARKER} = true;\n${result.code}`;
}

function transformWorld(source, pluginContext) {
  if (source.includes(WORLD_MARKER)) return null;
  if (!source.includes(CHAIR_MARKER) || !source.includes(BASE_MARKER)) {
    pluginContext.warn('CALLORIA v3.2 greenery status skipped: the v3.0 lobby plus v3.1 chair transforms are required. Existing world status remains unchanged.');
    return null;
  }

  const replacements = {
    declaration: `${WORLD_ANCHORS.declaration}\n  let greeneryAssetStatus = { loaded: false, reason: 'loading' };`,
    lobbyStatus: `${WORLD_ANCHORS.lobbyStatus}\n    greeneryAssetStatus = lobbyAssetStatus?.greenery || { loaded: false, reason: 'lobby integration returned no greenery status' };`,
    lobbyNode: `${WORLD_ANCHORS.lobbyNode}\n    const greeneryLabel = greeneryAssetStatus.loaded ? 'GREENERY: CC0 GLB' : greeneryAssetStatus.reason === 'loading' ? 'GREENERY: LOADING' : 'GREENERY: FALLBACK';\n    if (statusNode) statusNode.textContent = statusNode.textContent.replace(/GREENERY: (?:LOADING|FALLBACK|CC0 GLB)/, greeneryLabel);\n    window.dispatchEvent(new CustomEvent('calloria:glb-greenery-ready', { detail: greeneryAssetStatus }));`,
    lobbyCatch: `${WORLD_ANCHORS.lobbyCatch}\n    greeneryAssetStatus = { loaded: false, reason: 'reception lobby unavailable' };`,
    catchNode: `${WORLD_ANCHORS.catchNode}\n    if (statusNode) statusNode.textContent = statusNode.textContent.replace(/GREENERY: (?:LOADING|FALLBACK|CC0 GLB)/, 'GREENERY: FALLBACK');\n    window.dispatchEvent(new CustomEvent('calloria:glb-greenery-ready', { detail: greeneryAssetStatus }));`,
    statusTail: WORLD_ANCHORS.statusTail.replace(
      '      + `  ·  ${String(tier).toUpperCase()}`;',
      "      + `  ·  ${greeneryAssetStatus.loaded ? 'GREENERY: CC0 GLB' : greeneryAssetStatus.reason === 'loading' ? 'GREENERY: LOADING' : 'GREENERY: FALLBACK'}`\n      + `  ·  ${String(tier).toUpperCase()}`;"
    )
  };

  const result = applyAnchoredReplacements(source, WORLD_ANCHORS, replacements);
  if (!result.ok) {
    pluginContext.warn(`CALLORIA v3.2 greenery status skipped safely; production-world anchors changed: ${result.missing.join(', ')}. Existing world status remains unchanged.`);
    return null;
  }
  return `const ${WORLD_MARKER} = true;\n${result.code}`;
}

export function calloriaCC0LobbyGreeneryPlugin() {
  return {
    name: 'calloria-cc0-lobby-greenery-v3-2',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (normalizedId.endsWith(LOBBY_TARGET)) {
        const code = transformLobby(source, this);
        return code ? { code, map: null } : null;
      }
      if (normalizedId.endsWith(WORLD_TARGET)) {
        const code = transformWorld(source, this);
        return code ? { code, map: null } : null;
      }
      return null;
    }
  };
}

export const __greeneryPluginTest = Object.freeze({
  LOBBY_TARGET,
  WORLD_TARGET,
  BASE_MARKER,
  CHAIR_MARKER,
  LOBBY_MARKER,
  WORLD_MARKER,
  IMPORT,
  LOBBY_ANCHORS,
  WORLD_ANCHORS,
  count,
  transformLobby,
  transformWorld
});
