/** CALLORIA v3.3 — safely integrates CC0 glass modules into authored QA/supervisor panes. */
const WORLD_TARGET = '/js/production-world.js';
const BASE_MARKER = '__CALLORIA_GREENERY_STATUS_V32__';
const WORLD_MARKER = '__CALLORIA_GLAZED_DEPARTMENT_PARTITIONS_V33__';
const IMPORT = "import { integrateCalloriaGlazedDepartmentPartitions } from './cc0-glazed-department-partitions.js';";

const ANCHORS = Object.freeze({
  disposedDeclaration: '  let disposed = false;',
  assetMessage: "    get assetMessage() { return 'CALLORIA 3D workplace and draw-call-merged articulated staff ready'; },",
  dispose: '      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();'
});

function count(source, needle) {
  return needle ? source.split(needle).length - 1 : 0;
}

function transformWorld(source, pluginContext) {
  if (source.includes(WORLD_MARKER)) return null;
  if (!source.includes(BASE_MARKER)) {
    pluginContext.warn('CALLORIA v3.3 glazed partitions skipped: v3.2 greenery baseline marker is missing. Existing room glass remains unchanged.');
    return null;
  }
  const missing = Object.entries(ANCHORS).filter(([, anchor]) => count(source, anchor) !== 1);
  if (missing.length) {
    pluginContext.warn(`CALLORIA v3.3 glazed partitions skipped safely; production-world anchors changed: ${missing.map(([name]) => name).join(', ')}. Existing room glass remains unchanged.`);
    return null;
  }

  const disposedReplacement = `${ANCHORS.disposedDeclaration}
  let glazedDepartmentPartitionLease = null;
  let glazedDepartmentPartitionStatus = { loaded: false, reason: 'loading' };
  let glazedDepartmentPartitionDisposed = false;
  const glazedDepartmentPartitionLoad = integrateCalloriaGlazedDepartmentPartitions(scene, {
    tier,
    isActive: () => !disposed && !glazedDepartmentPartitionDisposed
  }).then((lease) => {
    if (disposed || glazedDepartmentPartitionDisposed) {
      lease?.dispose?.();
      return;
    }
    glazedDepartmentPartitionLease = lease || null;
    glazedDepartmentPartitionStatus = lease?.status || { loaded: false, reason: 'partition integration returned no status' };
    window.dispatchEvent(new CustomEvent('calloria:glazed-partitions-ready', { detail: glazedDepartmentPartitionStatus }));
    renderStill();
  }).catch((error) => {
    if (disposed || glazedDepartmentPartitionDisposed) return;
    glazedDepartmentPartitionStatus = { loaded: false, reason: String(error?.message || error) };
    window.dispatchEvent(new CustomEvent('calloria:glazed-partitions-ready', { detail: glazedDepartmentPartitionStatus }));
  });`;

  const messageReplacement = `${ANCHORS.assetMessage}
    get glazedDepartmentPartitionStatus() { return glazedDepartmentPartitionStatus; },`;
  const disposeReplacement = `      disposed = true;
      glazedDepartmentPartitionDisposed = true;
      glazedDepartmentPartitionLease?.dispose?.();
      glazedDepartmentPartitionLease = null;
      void glazedDepartmentPartitionLoad;
      stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();`;

  let code = source
    .replace(ANCHORS.disposedDeclaration, disposedReplacement)
    .replace(ANCHORS.assetMessage, messageReplacement)
    .replace(ANCHORS.dispose, disposeReplacement);
  code = `${IMPORT}\nconst ${WORLD_MARKER} = true;\n${code}`;
  return code;
}

export function calloriaGlazedDepartmentPartitionsPlugin() {
  return {
    name: 'calloria-glazed-department-partitions-v3-3',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(WORLD_TARGET)) return null;
      const code = transformWorld(source, this);
      return code ? { code, map: null } : null;
    }
  };
}

export const __partitionPluginTest = Object.freeze({
  WORLD_TARGET,
  BASE_MARKER,
  WORLD_MARKER,
  IMPORT,
  ANCHORS,
  count,
  transformWorld
});
