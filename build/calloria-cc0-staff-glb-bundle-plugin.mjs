/**
 * CALLORIA v3.9.0 — Build-time CC0 staff GLB acquisition and activation.
 *
 * Downloads five directly-addressed, CC0 1.0 animated human GLBs from Gobkit,
 * validates their GLB container/rig/animation structure, writes them into the
 * existing public asset paths, and updates the runtime's default candidate
 * list to include only the files that passed validation.
 *
 * This runs during Vite buildStart, before the v3.8.2 OJT plugin's buildStart
 * checks. Models are served from CALLORIA's own deployed /assets/models path;
 * the browser does not hotlink Gobkit at runtime.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, isAbsolute } from 'node:path';

const TARGET = '/js/glb-world-integration.js';
const MARKER = '__CALLORIA_CC0_STAFF_GLB_BUNDLE_V39__';
const MANIFEST_RELATIVE = 'assets/models/calloria-cc0-staff-manifest.json';
const MAX_MODEL_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 36 * 1024 * 1024;
const MAX_TRIANGLES = 45000;
const REQUIRED_ANIMATIONS = Object.freeze(['idle', 'walk']);
const LICENSE = 'CC0 1.0 (public domain) — free for commercial or personal use; no attribution required.';

// Exact model URLs from Gobkit's published free-model manifest. Do not construct URLs.
// These names are mapped to the stable ids/paths already present in CALLORIA's registry.
export const CC0_STAFF_MODELS = Object.freeze([
  Object.freeze({ id: 'female-agent', name: 'OfficeLady', role: 'Customer experience agent', url: 'https://gobkit.com/freebies/human001/OfficeLady.glb', path: 'characters/agents/female-agent.glb', pack: 'Gobkit Free Character Pack Vol.1' }),
  Object.freeze({ id: 'male-agent', name: 'Accountant', role: 'Customer experience agent', url: 'https://gobkit.com/freebies/human002/Accountant.glb', path: 'characters/agents/male-agent.glb', pack: 'Gobkit Free Character Pack Vol.2' }),
  Object.freeze({ id: 'gp5-woman', name: 'Receptionist', role: 'Reception / customer welcome', url: 'https://gobkit.com/freebies/human002/Receptionist.glb', path: 'characters/agents/gp5woman.glb', pack: 'Gobkit Free Character Pack Vol.2' }),
  Object.freeze({ id: 'mr-r', name: 'OfficeManager', role: 'Team leader / supervisor', url: 'https://gobkit.com/freebies/human002/OfficeManager.glb', path: 'characters/agents/mr-r.glb', pack: 'Gobkit Free Character Pack Vol.2' }),
  Object.freeze({ id: 'office-lady-character', name: 'SalesRep', role: 'Customer experience agent', url: 'https://gobkit.com/freebies/human002/SalesRep.glb', path: 'characters/agents/office_lady_character.glb', pack: 'Gobkit Free Character Pack Vol.2' }),
]);

function safeRoot(rootDir) {
  const root = resolve(rootDir);
  return root;
}

function parseGlb(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('GLB header magic is missing.');
  }
  const version = buffer.readUInt32LE(4);
  const declaredLength = buffer.readUInt32LE(8);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}; expected 2.`);
  if (declaredLength !== buffer.length) throw new Error(`GLB length mismatch (${declaredLength} declared, ${buffer.length} received).`);
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== 0x4E4F534A) throw new Error('First GLB chunk is not the required JSON chunk.');
  if (jsonLength < 2 || 20 + jsonLength > buffer.length) throw new Error('GLB JSON chunk length is invalid.');
  let json;
  try {
    json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).replace(/[\u0000\u0020]+$/g, ''));
  } catch (error) {
    throw new Error(`GLB JSON chunk is invalid: ${String(error?.message || error)}`);
  }
  if (json?.asset?.version !== '2.0') throw new Error('glTF asset.version must be 2.0.');
  if (!Array.isArray(json.meshes) || !json.meshes.length) throw new Error('GLB has no meshes.');
  if (!Array.isArray(json.skins) || !json.skins.length) throw new Error('GLB has no character skin/skeleton.');
  if (!Array.isArray(json.animations) || !json.animations.length) throw new Error('GLB has no embedded animation clips.');

  const jointCounts = json.skins.map((skin) => Array.isArray(skin.joints) ? skin.joints.length : 0);
  const boneCount = Math.max(0, ...jointCounts);
  const hasSkinnedNode = (json.nodes || []).some((node) => Number.isInteger(node?.mesh) && Number.isInteger(node?.skin));
  if (!hasSkinnedNode) throw new Error('No node binds a mesh to a character skin.');
  if (boneCount < 15) throw new Error(`Character skeleton has ${boneCount} joints; at least 15 are required by the runtime.`);

  const animationNames = json.animations.map((clip) => String(clip?.name || '').toLowerCase());
  const missingAnimations = REQUIRED_ANIMATIONS.filter((required) => !animationNames.some((name) => name.includes(required)));
  if (missingAnimations.length) throw new Error(`Required animation clip(s) missing: ${missingAnimations.join(', ')}.`);
  for (const clip of json.animations) {
    const clipName = String(clip?.name || '').toLowerCase();
    if (REQUIRED_ANIMATIONS.some((required) => clipName.includes(required)) && !(clip.channels || []).length) {
      throw new Error(`Animation clip '${clip.name}' contains no animation channels.`);
    }
  }

  const accessors = Array.isArray(json.accessors) ? json.accessors : [];
  let triangleCount = 0;
  let primitiveCount = 0;
  let hasSkinnedPrimitive = false;
  for (const mesh of json.meshes) {
    for (const primitive of mesh?.primitives || []) {
      primitiveCount += 1;
      const attributes = primitive?.attributes || {};
      if (Number.isInteger(attributes.JOINTS_0) && Number.isInteger(attributes.WEIGHTS_0)) hasSkinnedPrimitive = true;
      const indexAccessor = Number.isInteger(primitive.indices) ? accessors[primitive.indices] : null;
      const positionAccessor = Number.isInteger(attributes.POSITION) ? accessors[attributes.POSITION] : null;
      const vertices = Number(indexAccessor?.count || positionAccessor?.count || 0);
      triangleCount += Math.floor(vertices / 3);
    }
  }
  if (!hasSkinnedPrimitive) throw new Error('No mesh primitive contains JOINTS_0 and WEIGHTS_0 skinning attributes.');
  if (primitiveCount > 90) throw new Error(`GLB has ${primitiveCount} primitives; runtime limit is 90.`);
  if (triangleCount < 1 || triangleCount > MAX_TRIANGLES) throw new Error(`GLB has ${triangleCount.toLocaleString()} estimated triangles; runtime budget is ${MAX_TRIANGLES.toLocaleString()}.`);

  for (const bufferEntry of json.buffers || []) {
    if (bufferEntry?.uri && !String(bufferEntry.uri).startsWith('data:')) throw new Error('GLB references an external buffer; self-contained GLB required.');
  }
  for (const imageEntry of json.images || []) {
    if (imageEntry?.uri && !String(imageEntry.uri).startsWith('data:')) throw new Error('GLB references an external image; self-contained GLB required.');
  }
  const requiredExtensions = Array.isArray(json.extensionsRequired) ? json.extensionsRequired : [];
  const allowedExtensions = new Set(['KHR_draco_mesh_compression', 'EXT_meshopt_compression']);
  const unsupported = requiredExtensions.filter((name) => !allowedExtensions.has(name));
  if (unsupported.length) throw new Error(`Unsupported required glTF extension(s): ${unsupported.join(', ')}.`);

  return { json, bytes: buffer.length, version, boneCount, triangleCount, primitiveCount, animationNames };
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function fetchWithRetry(asset, fetchImpl, { attempts, timeoutMs, maxBytes, wait }) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`Timed out after ${timeoutMs}ms.`)), timeoutMs);
    try {
      const response = await fetchImpl(asset.url, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'model/gltf-binary, application/octet-stream;q=0.9, */*;q=0.1',
          'User-Agent': 'CALLORIA-Staff-Asset-Bundler/3.9 (+https://calloria.vercel.app)',
          Referer: 'https://gobkit.com/'
        }
      });
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 'unknown'} ${response?.statusText || ''}`.trim());
      const advertised = Number(response.headers?.get?.('content-length') || 0);
      if (advertised > maxBytes) throw new Error(`Server advertised ${advertised} bytes; limit is ${maxBytes}.`);
      const arrayBuffer = await response.arrayBuffer();
      const bytes = Buffer.from(arrayBuffer);
      if (!bytes.length || bytes.length > maxBytes) throw new Error(`Downloaded file size ${bytes.length} is outside the permitted range.`);
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(250 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('Download failed without a specific error.');
}

function makeManifest(entries, totals, status) {
  return {
    schemaVersion: 1,
    buildIntegration: 'CALLORIA v3.9.0 CC0 staff GLB bundle',
    createdAt: new Date().toISOString(),
    status,
    source: 'Gobkit published free-model manifest: https://gobkit.com/api/free',
    license: LICENSE,
    runtimeDelivery: 'Files are copied into CALLORIA public/assets/models and served from the CALLORIA deployment. No browser-time Gobkit request is made.',
    runtimeScope: 'Standing / support staff with compatible idle clips. Seated agent positions remain on the existing safe seated implementation until a seated/typing-compatible character asset is separately approved.',
    totalBytes: totals.bytes,
    validatedStaffModels: totals.valid,
    failedStaffModels: totals.failed,
    models: entries
  };
}

export function createCalloriaCC0StaffGLBBundlePlugin(options = {}) {
  const rootDir = safeRoot(options.rootDir || process.cwd());
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const attempts = options.attempts ?? 2;
  const timeoutMs = options.timeoutMs ?? 15000;
  const maxBytes = options.maxBytes ?? MAX_MODEL_BYTES;
  const wait = options.wait || ((ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms)));
  const forceRefresh = options.forceRefresh ?? process.env.CALLORIA_STAFF_GLB_REFRESH === '1';
  let availableIds = [];
  let buildEntries = [];

  return {
    name: 'calloria-cc0-staff-glb-bundle-v3-9',
    enforce: 'post',
    async buildStart() {
      const publicRoot = resolve(rootDir, 'public');
      const modelsRoot = resolve(publicRoot, 'assets/models');
      mkdirSync(modelsRoot, { recursive: true });
      const entries = new Array(CC0_STAFF_MODELS.length);
      const results = new Array(CC0_STAFF_MODELS.length);
      let totalBytes = 0;
      let failed = 0;
      let nextIndex = 0;

      const processAsset = async (asset, index) => {
        const outputPath = resolve(publicRoot, 'assets/models', asset.path);
        const outputRelative = relative(publicRoot, outputPath);
        if (!outputRelative || outputRelative.startsWith('..') || isAbsolute(outputRelative)) {
          throw new Error(`Unsafe output path for ${asset.id}.`);
        }
        mkdirSync(dirname(outputPath), { recursive: true });
        let bytes = null;
        let source = 'Gobkit CC0 direct GLB download';
        let priorError = null;

        if (!forceRefresh && existsSync(outputPath)) {
          try {
            bytes = readFileSync(outputPath);
            if (bytes.length > maxBytes) throw new Error(`Existing GLB is ${bytes.length} bytes; limit is ${maxBytes}.`);
            if (totalBytes + bytes.length > MAX_TOTAL_BYTES) throw new Error(`Existing local models exceed the ${MAX_TOTAL_BYTES}-byte staff bundle budget.`);
            const metrics = parseGlb(bytes);
            source = 'Existing local GLB (preserved; not overwritten)';
            totalBytes += bytes.length;
            results[index] = { id: asset.id, status: 'validated-existing', bytes: bytes.length };
            entries[index] = { ...asset, output: `/assets/models/${asset.path}`, status: 'validated-existing', source, sizeBytes: bytes.length, sha256: sha256(bytes), ...metrics };
            return;
          } catch (error) {
            priorError = `Existing local file was invalid and will be refreshed: ${String(error?.message || error)}`;
            bytes = null;
          }
        }

        try {
          if (typeof fetchImpl !== 'function') throw new Error('Node fetch is unavailable in this build runtime.');
          const parsedUrl = new URL(asset.url);
          if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'gobkit.com') throw new Error('Model URL failed the pinned Gobkit HTTPS host allowlist.');
          const bytesRemaining = Math.max(0, MAX_TOTAL_BYTES - totalBytes);
          if (bytesRemaining <= 0) throw new Error(`Total staff model bundle reached ${MAX_TOTAL_BYTES} bytes.`);
          bytes = await fetchWithRetry(asset, fetchImpl, { attempts, timeoutMs, maxBytes: Math.min(maxBytes, bytesRemaining), wait });
          const metrics = parseGlb(bytes);
          if (totalBytes + bytes.length > MAX_TOTAL_BYTES) throw new Error(`Total staff model bundle exceeds ${MAX_TOTAL_BYTES} bytes.`);
          writeFileSync(outputPath, bytes);
          totalBytes += bytes.length;
          results[index] = { id: asset.id, status: 'downloaded-and-validated', bytes: bytes.length };
          entries[index] = { ...asset, output: `/assets/models/${asset.path}`, status: 'downloaded-and-validated', source, sizeBytes: bytes.length, sha256: sha256(bytes), ...metrics };
          this.info?.(`CALLORIA v3.9 bundled ${asset.name} (${bytes.length.toLocaleString()} bytes; ${metrics.triangleCount.toLocaleString()} triangles; ${metrics.boneCount} joints).`);
        } catch (error) {
          failed += 1;
          const message = [priorError, String(error?.message || error)].filter(Boolean).join(' | ');
          results[index] = { id: asset.id, status: 'unavailable', error: message };
          entries[index] = { ...asset, output: `/assets/models/${asset.path}`, status: 'unavailable', source, error: message };
          this.warn?.(`CALLORIA v3.9 could not bundle ${asset.name}: ${message}`);
        }
      };

      const worker = async () => {
        while (true) {
          const index = nextIndex++;
          if (index >= CC0_STAFF_MODELS.length) return;
          await processAsset(CC0_STAFF_MODELS[index], index);
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, CC0_STAFF_MODELS.length) }, () => worker()));

      availableIds = results.filter((result) => result && result.status !== 'unavailable').map((result) => result.id);
      const status = availableIds.length === CC0_STAFF_MODELS.length ? 'complete' : availableIds.length ? 'partial' : 'unavailable';
      const manifest = makeManifest(entries, { bytes: totalBytes, valid: availableIds.length, failed }, status);
      const manifestPath = resolve(publicRoot, MANIFEST_RELATIVE);
      mkdirSync(dirname(manifestPath), { recursive: true });
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      buildEntries = entries;
      this.info?.(`CALLORIA v3.9 staff GLB bundle: ${availableIds.length}/${CC0_STAFF_MODELS.length} validated, ${totalBytes.toLocaleString()} bytes; manifest: /${MANIFEST_RELATIVE}.`);
    },
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!target.endsWith(TARGET) || source.includes(MARKER) || !availableIds.length) return null;
      const pattern = /const PRIMARY_CANDIDATES = \[[^\]]*\];/g;
      const matches = source.match(pattern) || [];
      if (matches.length !== 1) {
        this.warn?.(`CALLORIA v3.9 could not find exactly one PRIMARY_CANDIDATES array in ${TARGET} (found ${matches.length}); downloaded GLBs remain bundled, but the existing runtime candidate order is unchanged.`);
        return null;
      }
      const replacement = `const PRIMARY_CANDIDATES = ${JSON.stringify(availableIds)};`;
      let code = source.replace(pattern, replacement);
      const approvalAnchor = 'return new Set(explicit.length ? explicit : PRIMARY_CANDIDATES);';
      const approvalCount = code.split(approvalAnchor).length - 1;
      if (approvalCount === 1) {
        code = code.replace(approvalAnchor, `const selected = explicit.filter((id) => PRIMARY_CANDIDATES.includes(id));\n    return new Set(selected.length ? selected : PRIMARY_CANDIDATES);`);
      } else {
        this.warn?.(`CALLORIA v3.9 could not reconcile saved GLB Inspector approvals (${approvalCount} approval anchors); only the default candidate array was updated.`);
      }
      return { code: `/* ${MARKER} */\n${code}`, map: null };
    },
    api: {
      getAvailableStaffIds() { return [...availableIds]; },
      getBuildManifestEntries() { return [...buildEntries]; }
    }
  };
}

export function calloriaCC0StaffGLBBundlePlugin() {
  return createCalloriaCC0StaffGLBBundlePlugin();
}

export const __calloriaCC0StaffGLBBundleTest = Object.freeze({
  TARGET, MARKER, MANIFEST_RELATIVE, MAX_MODEL_BYTES, MAX_TOTAL_BYTES, MAX_TRIANGLES,
  REQUIRED_ANIMATIONS, LICENSE, parseGlb, sha256, fetchWithRetry, makeManifest
});
