/**
 * CALLORIA v6.15 — pure GLB decoder configuration and load-error classification.
 * No Three.js dependency; safe to test in Node without a WebGL context.
 */
export const DEFAULT_DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

export function getOfficeDracoDecoderPath(configuredPath = null) {
  const supplied = String(configuredPath || '').trim();
  if (supplied) return supplied.endsWith('/') ? supplied : `${supplied}/`;
  return DEFAULT_DRACO_DECODER_PATH;
}

export function classifyOfficeLoadError(error) {
  const message = String(error?.message || error || 'Unknown office GLB loading error.');
  const lower = message.toLowerCase();
  if (/draco|decoder|wasm/.test(lower)) return 'draco-decoder';
  if (/http\s*(?:4\d\d|5\d\d)|404|failed to fetch|networkerror|load failed|cors/.test(lower)) return 'http-or-network';
  if (/parse|invalid glb|gltf|buffer|accessor|extension/.test(lower)) return 'glb-parse';
  if (/rejected|dimensions|triangle count|mesh count|texture/.test(lower)) return 'validation';
  if (/fit|placement|station|scene/.test(lower)) return 'placement';
  return 'unknown';
}
