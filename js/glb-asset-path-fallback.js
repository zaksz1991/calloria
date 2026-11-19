/**
 * CALLORIA v6.81 — resilient first-party GLB path resolution.
 *
 * Registry paths remain the preferred source. When a model is stored as
 * <asset-folder>/model.glb rather than <asset-name>.glb, the loader tries that
 * exact nested-file convention as a second candidate. No remote model hosts,
 * guessed filenames or external origins are introduced.
 */
const ASSET_ROOT = '/assets/models/';
const FALLBACK_FILENAME = 'model.glb';

function currentOrigin() {
  return globalThis.location?.origin || 'https://calloria.invalid';
}

function toInternalPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw, currentOrigin());
    if (parsed.origin !== currentOrigin()) return null;
    const pathname = parsed.pathname.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    if (!pathname.startsWith('/assets/models/')) return null;
    return pathname;
  } catch {
    return null;
  }
}

function pathFromAsset(asset) {
  const fromUrl = toInternalPath(asset?.url);
  if (fromUrl) return fromUrl;

  const rawPath = String(asset?.path || '').replace(/^\/+/, '');
  if (!rawPath || rawPath.startsWith('..')) return null;
  const candidate = rawPath.startsWith('assets/models/')
    ? `/${rawPath}`
    : `${ASSET_ROOT}${rawPath}`;
  return toInternalPath(candidate);
}

/** Return the preferred registry URL and one conventional nested model.glb fallback. */
export function getCalloriaGLBPathCandidates(asset) {
  const path = pathFromAsset(asset);
  if (!path) return [];

  const paths = [path];
  const match = path.match(/^(.*)\/([^/]+)\.glb$/i);
  if (match && match[2].toLowerCase() !== 'model') {
    paths.push(`${match[1]}/${match[2]}/${FALLBACK_FILENAME}`);
  }

  return [...new Set(paths)].map((candidatePath) => ({
    url: candidatePath,
    path: candidatePath.slice(ASSET_ROOT.length),
  }));
}

/** Load sequentially and report every tried same-origin path on total failure. */
export async function loadCalloriaGLBWithPathFallback(loader, asset, onAttempt) {
  if (!loader || typeof loader.loadAsync !== 'function') {
    throw new TypeError('CALLORIA GLB path fallback requires a loader with loadAsync().');
  }

  const candidates = getCalloriaGLBPathCandidates(asset);
  if (!candidates.length) {
    throw new Error(`No safe first-party GLB path is available for '${asset?.id || asset?.name || 'unknown asset'}'.`);
  }

  const attempts = [];
  for (const candidate of candidates) {
    try {
      onAttempt?.({ ...candidate, status: 'loading' });
      const gltf = await loader.loadAsync(candidate.url);
      onAttempt?.({ ...candidate, status: 'loaded' });
      return {
        gltf,
        resolvedUrl: candidate.url,
        resolvedPath: candidate.path,
        attempts,
      };
    } catch (error) {
      const failure = {
        ...candidate,
        status: 'failed',
        message: String(error?.message || error || 'Unknown GLB load error'),
      };
      attempts.push(failure);
      onAttempt?.(failure);
    }
  }

  const tried = attempts.map((entry) => `${entry.url}: ${entry.message}`).join(' | ');
  const error = new Error(
    `Unable to load ${asset?.name || asset?.id || 'GLB asset'}. Tried ${attempts.length} first-party path(s): ${tried}`,
  );
  error.assetId = asset?.id || null;
  error.attempts = attempts;
  throw error;
}
