/**
 * Loads optimized GLBs only when a deployment manifest explicitly lists them.
 * Missing manifests, missing entries, 404s, or decoder failures fall back to
 * the original /assets/models asset. Original assets are never modified.
 */
const OPTIMIZED_BASE = '/assets/models-optimized/';
const MANIFEST_URL = `${OPTIMIZED_BASE}manifest.json`;
let manifestPromise = null;

function safeRelativeModelPath(asset) {
  const raw = String(asset?.path || '').replaceAll('\\', '/');
  if (!raw || raw.startsWith('/') || raw.split('/').some((part) => part === '..' || part === '.' || !part)) {
    return null;
  }
  if (!raw.toLowerCase().endsWith('.glb')) return null;
  return raw;
}

async function readManifest(fetchImpl) {
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    if (typeof fetchImpl !== 'function') return null;
    try {
      const response = await fetchImpl(MANIFEST_URL, { cache: 'force-cache' });
      if (!response?.ok) return null;
      const manifest = await response.json();
      if (manifest?.schemaVersion !== 1 || !manifest.files || typeof manifest.files !== 'object') return null;
      return manifest;
    } catch {
      return null;
    }
  })();
  return manifestPromise;
}

/** Reset the one-session manifest cache; exported for deterministic tests. */
export function resetCalloriaOptimizedManifestCache() {
  manifestPromise = null;
}

export async function loadCalloriaGLTFWithOptimizedFallback(loader, asset, onProgress, options = {}) {
  if (!loader?.loadAsync) throw new TypeError('A configured Three.js GLTFLoader is required.');
  if (!asset?.url) throw new TypeError('A registered CALLORIA asset URL is required.');

  const relativePath = safeRelativeModelPath(asset);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const manifest = await readManifest(fetchImpl);
  const entry = relativePath ? manifest?.files?.[relativePath] : null;

  if (entry?.available === true) {
    const optimizedUrl = `${OPTIMIZED_BASE}${relativePath.split('/').map(encodeURIComponent).join('/')}`;
    try {
      return await loader.loadAsync(optimizedUrl, onProgress);
    } catch (error) {
      const logger = options.logger ?? globalThis.console;
      logger?.warn?.(`CALLORIA optimized model failed; loading original ${relativePath}.`, error);
    }
  }

  return loader.loadAsync(asset.url, onProgress);
}
