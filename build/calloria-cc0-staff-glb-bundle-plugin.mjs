/**
 * CALLORIA v6.14 — GLB staff runtime placement + compatibility validator.
 *
 * Drop-in replacement for the v3.9 build plugin. Keeps the same factory,
 * exported catalogue, plugin name, manifest path, and PRIMARY_CANDIDATES hook.
 *
 * Important change: animation clips and a 15-joint minimum are NOT GLB validity
 * requirements. A structurally valid static mesh, a skinned static pose, or an
 * animated character can be bundled. The manifest records which mode each
 * model supports; this plugin never invents a skeleton or animation.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, isAbsolute } from 'node:path';

const TARGET = '/js/glb-world-integration.js';
const MARKER = '__CALLORIA_CC0_STAFF_GLB_RUNTIME_V614__';
const MANIFEST_RELATIVE = 'assets/models/calloria-cc0-staff-manifest.json';
const MAX_MODEL_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 36 * 1024 * 1024;
const MAX_TRIANGLES = 45000;
const MAX_PRIMITIVES = 90;
const LICENSE = 'CC0 1.0 (public domain) — free for commercial or personal use; no attribution required.';
const PREFERRED_ANIMATIONS = Object.freeze(['idle', 'walk', 'run']);

// Stable IDs and destination paths already used by CALLORIA's staff registry.
// URLs remain pinned to the directly addressed Gobkit files used by v3.9.
export const CC0_STAFF_MODELS = Object.freeze([
  Object.freeze({ id: 'female-agent', name: 'OfficeLady', role: 'Customer experience agent', url: 'https://gobkit.com/freebies/human001/OfficeLady.glb', path: 'characters/agents/female-agent.glb', pack: 'Gobkit Free Character Pack Vol.1' }),
  Object.freeze({ id: 'male-agent', name: 'Accountant', role: 'Customer experience agent', url: 'https://gobkit.com/freebies/human002/Accountant.glb', path: 'characters/agents/male-agent.glb', pack: 'Gobkit Free Character Pack Vol.2' }),
  Object.freeze({ id: 'gp5-woman', name: 'Receptionist', role: 'Reception / customer welcome', url: 'https://gobkit.com/freebies/human002/Receptionist.glb', path: 'characters/agents/gp5woman.glb', pack: 'Gobkit Free Character Pack Vol.2' }),
  Object.freeze({ id: 'mr-r', name: 'OfficeManager', role: 'Team leader / supervisor', url: 'https://gobkit.com/freebies/human002/OfficeManager.glb', path: 'characters/agents/mr-r.glb', pack: 'Gobkit Free Character Pack Vol.2' }),
  Object.freeze({ id: 'office-lady-character', name: 'SalesRep', role: 'Customer experience agent', url: 'https://gobkit.com/freebies/human002/SalesRep.glb', path: 'characters/agents/office_lady_character.glb', pack: 'Gobkit Free Character Pack Vol.2' }),
]);

function safeRoot(rootDir) {
  return resolve(rootDir);
}

function readGlbJsonAndChunks(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('GLB header magic is missing.');
  }
  const version = buffer.readUInt32LE(4);
  const declaredLength = buffer.readUInt32LE(8);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}; expected 2.`);
  if (declaredLength !== buffer.length) throw new Error(`GLB length mismatch (${declaredLength} declared, ${buffer.length} received).`);

  let offset = 12;
  let json = null;
  let binaryChunkBytes = 0;
  let chunkCount = 0;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) throw new Error('GLB chunk header is truncated.');
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkLength % 4 !== 0) throw new Error('GLB chunk length is not 4-byte aligned.');
    if (chunkLength < 0 || offset + chunkLength > buffer.length) throw new Error('GLB chunk length exceeds the file boundary.');
    const chunk = buffer.subarray(offset, offset + chunkLength);
    if (chunkCount === 0 && chunkType !== 0x4E4F534A) throw new Error('First GLB chunk is not the required JSON chunk.');
    if (chunkType === 0x4E4F534A) {
      if (json) throw new Error('GLB contains more than one JSON chunk.');
      try {
        json = JSON.parse(chunk.toString('utf8').replace(/[\u0000\u0020]+$/g, ''));
      } catch (error) {
        throw new Error(`GLB JSON chunk is invalid: ${String(error?.message || error)}`);
      }
    } else if (chunkType === 0x004E4942) {
      binaryChunkBytes += chunkLength;
    }
    offset += chunkLength;
    chunkCount += 1;
  }
  if (!json) throw new Error('GLB has no JSON chunk.');
  if (offset !== buffer.length) throw new Error('GLB chunk sequence does not end at the declared file length.');
  return { buffer, json, version, binaryChunkBytes, chunkCount };
}

/**
 * Validate that the file is a useful, bounded, self-contained GLB scene.
 * Optional rigging and animation are measured, not required.
 */
function parseGlb(input) {
  const { buffer, json, version, binaryChunkBytes } = readGlbJsonAndChunks(input);
  if (json?.asset?.version !== '2.0') throw new Error('glTF asset.version must be 2.0.');
  if (!Array.isArray(json.meshes) || !json.meshes.length) throw new Error('GLB has no meshes.');
  if (!Array.isArray(json.nodes) || !json.nodes.length) throw new Error('GLB has no scene nodes.');
  if (!Array.isArray(json.scenes) || !json.scenes.length) throw new Error('GLB has no scene definition.');

  const sceneIndex = Number.isInteger(json.scene) ? json.scene : 0;
  if (!json.scenes[sceneIndex]) throw new Error(`GLB default scene index ${sceneIndex} is invalid.`);
  const sceneNodes = json.scenes[sceneIndex].nodes;
  if (!Array.isArray(sceneNodes) || !sceneNodes.some((index) => Number.isInteger(index) && json.nodes[index])) {
    throw new Error('GLB default scene has no valid root nodes.');
  }

  const buffers = Array.isArray(json.buffers) ? json.buffers : [];
  for (const entry of buffers) {
    if (entry?.uri && !String(entry.uri).startsWith('data:')) {
      throw new Error('GLB references an external buffer; self-contained GLB required.');
    }
  }
  const embeddedBufferBytes = buffers
    .filter((entry) => !entry?.uri)
    .reduce((sum, entry) => sum + Math.max(0, Number(entry?.byteLength) || 0), 0);
  if (embeddedBufferBytes > 0 && binaryChunkBytes < embeddedBufferBytes) {
    throw new Error(`GLB binary chunk is too small (${binaryChunkBytes} bytes for ${embeddedBufferBytes} declared buffer bytes).`);
  }
  for (const imageEntry of json.images || []) {
    if (imageEntry?.uri && !String(imageEntry.uri).startsWith('data:')) {
      throw new Error('GLB references an external image; self-contained GLB required.');
    }
  }

  const requiredExtensions = Array.isArray(json.extensionsRequired) ? json.extensionsRequired : [];
  const allowedExtensions = new Set(['KHR_draco_mesh_compression', 'EXT_meshopt_compression']);
  const unsupported = requiredExtensions.filter((name) => !allowedExtensions.has(name));
  if (unsupported.length) throw new Error(`Unsupported required glTF extension(s): ${unsupported.join(', ')}.`);

  const accessors = Array.isArray(json.accessors) ? json.accessors : [];
  let triangleCount = 0;
  let primitiveCount = 0;
  let skinnedPrimitiveCount = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let meshIndex = 0; meshIndex < json.meshes.length; meshIndex += 1) {
    const mesh = json.meshes[meshIndex];
    if (!Array.isArray(mesh?.primitives) || !mesh.primitives.length) {
      throw new Error(`Mesh ${meshIndex} has no primitives.`);
    }
    for (const primitive of mesh.primitives) {
      primitiveCount += 1;
      if (primitiveCount > MAX_PRIMITIVES) throw new Error(`GLB has more than ${MAX_PRIMITIVES} mesh primitives.`);
      const attributes = primitive?.attributes || {};
      if (!Number.isInteger(attributes.POSITION) || !accessors[attributes.POSITION]) {
        throw new Error(`Mesh ${meshIndex} contains a primitive without a valid POSITION accessor.`);
      }
      const positionAccessor = accessors[attributes.POSITION];
      if (positionAccessor.type !== 'VEC3' || !(Number(positionAccessor.count) > 0)) {
        throw new Error(`Mesh ${meshIndex} has an invalid POSITION accessor.`);
      }
      if (Array.isArray(positionAccessor.min) && Array.isArray(positionAccessor.max)) {
        minX = Math.min(minX, Number(positionAccessor.min[0]));
        minY = Math.min(minY, Number(positionAccessor.min[1]));
        minZ = Math.min(minZ, Number(positionAccessor.min[2]));
        maxX = Math.max(maxX, Number(positionAccessor.max[0]));
        maxY = Math.max(maxY, Number(positionAccessor.max[1]));
        maxZ = Math.max(maxZ, Number(positionAccessor.max[2]));
      }

      const jointsPresent = Number.isInteger(attributes.JOINTS_0);
      const weightsPresent = Number.isInteger(attributes.WEIGHTS_0);
      if (jointsPresent !== weightsPresent) {
        throw new Error(`Mesh ${meshIndex} has incomplete skinning attributes (JOINTS_0 and WEIGHTS_0 must appear together).`);
      }
      if (jointsPresent) {
        skinnedPrimitiveCount += 1;
        if (!accessors[attributes.JOINTS_0] || !accessors[attributes.WEIGHTS_0]) {
          throw new Error(`Mesh ${meshIndex} references missing skinning accessors.`);
        }
      }

      const mode = Number.isInteger(primitive.mode) ? primitive.mode : 4;
      const indexAccessor = Number.isInteger(primitive.indices) ? accessors[primitive.indices] : null;
      if (Number.isInteger(primitive.indices) && !indexAccessor) {
        throw new Error(`Mesh ${meshIndex} references a missing index accessor.`);
      }
      const elementCount = Number(indexAccessor?.count || positionAccessor.count || 0);
      if (!Number.isFinite(elementCount) || elementCount < 3) continue;
      if (mode === 4) triangleCount += Math.floor(elementCount / 3); // TRIANGLES
      else if (mode === 5 || mode === 6) triangleCount += Math.max(0, elementCount - 2); // STRIP / FAN
      else throw new Error(`Mesh ${meshIndex} uses unsupported primitive mode ${mode}; triangle geometry is required for staff.`);
    }
  }

  if (triangleCount < 1 || triangleCount > MAX_TRIANGLES) {
    throw new Error(`GLB has ${triangleCount.toLocaleString()} estimated triangles; asset budget is ${MAX_TRIANGLES.toLocaleString()}.`);
  }

  const skins = Array.isArray(json.skins) ? json.skins : [];
  const jointCounts = skins.map((skin) => Array.isArray(skin?.joints) ? skin.joints.length : 0);
  const boneCount = Math.max(0, ...jointCounts);
  const nodes = json.nodes;
  const skinnedNodes = nodes.filter((node) => Number.isInteger(node?.mesh) && Number.isInteger(node?.skin));
  if (skinnedNodes.some((node) => !json.meshes[node.mesh] || !skins[node.skin])) {
    throw new Error('A skinned node references a missing mesh or skin.');
  }
  if (skins.length && (!skinnedNodes.length || !skinnedPrimitiveCount)) {
    throw new Error('GLB declares a skin but has no mesh/node with valid skinning attributes.');
  }
  if (!skins.length && skinnedPrimitiveCount) {
    throw new Error('GLB contains skinning attributes but declares no skin.');
  }
  if (skins.some((skin) => !Array.isArray(skin?.joints) || skin.joints.length < 1)) {
    throw new Error('GLB contains an empty or malformed skin joint list.');
  }

  const animations = Array.isArray(json.animations) ? json.animations : [];
  for (const clip of animations) {
    if (!Array.isArray(clip?.channels) || clip.channels.length < 1) {
      throw new Error(`Animation clip '${String(clip?.name || 'unnamed')}' contains no channels.`);
    }
  }
  const animationNames = animations.map((clip) => String(clip?.name || 'unnamed').toLowerCase());
  const hasIdle = animationNames.some((name) => /idle|stand|standing|rest|breath|listen/.test(name));
  const hasWalk = animationNames.some((name) => /walk|walking|locomotion|move/.test(name));
  const renderMode = animations.length
    ? (skinnedPrimitiveCount ? 'animated-skinned' : 'animated-node-transforms')
    : (skinnedPrimitiveCount ? 'skinned-static-pose' : 'static-mesh');
  const dimensions = [minX, minY, minZ, maxX, maxY, maxZ].every(Number.isFinite)
    ? { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
    : null;
  if (dimensions && (dimensions.y < 0.4 || dimensions.y > 5.0
      || dimensions.x < 0.04 || dimensions.x > 3.5
      || dimensions.z < 0.04 || dimensions.z > 3.5)) {
    throw new Error(`GLB dimensions ${dimensions.x.toFixed(2)} × ${dimensions.y.toFixed(2)} × ${dimensions.z.toFixed(2)} are outside the broad staff-character range.`);
  }

  return {
    json,
    bytes: buffer.length,
    version,
    boneCount,
    hasSkin: skins.length > 0,
    hasSkinnedPrimitive: skinnedPrimitiveCount > 0,
    skinnedPrimitiveCount,
    animationCount: animations.length,
    animationNames,
    hasIdle,
    hasWalk,
    renderMode,
    motionMode: animations.length ? 'embedded-animation' : 'static-pose-only',
    triangleCount,
    primitiveCount,
    dimensions,
  };
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
          'User-Agent': 'CALLORIA-Staff-Asset-Bundler/6.14 (+https://calloria.vercel.app)',
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
  const models = entries.filter(Boolean);
  const animated = models.filter((entry) => String(entry.renderMode || '').startsWith('animated-')).length;
  const staticPose = models.filter((entry) => ['skinned-static-pose', 'static-mesh'].includes(entry.renderMode)).length;
  return {
    schemaVersion: 2,
    buildIntegration: 'CALLORIA v6.14 staff GLB runtime placement bundle',
    createdAt: new Date().toISOString(),
    status,
    source: 'Gobkit CC0 character pack direct GLB files; provenance recorded per model and pack.',
    license: LICENSE,
    runtimeDelivery: 'Validated files are copied into CALLORIA public/assets/models and served from the CALLORIA deployment. No browser-time Gobkit request is made.',
    compatibilityPolicy: 'A valid GLB may be animated-skinned, animated-node-transforms, skinned-static-pose, or static-mesh. Animation clips and a 15-joint minimum are not required. No skeleton or animation is fabricated.',
    seatedAgentPolicy: 'Standing or static-pose staff assets must not be placed at seated workstation anchors unless their visible proportions and pose have been approved. Existing seated-agent handling remains unchanged.',
    totalBytes: totals.bytes,
    validatedStaffModels: totals.valid,
    failedStaffModels: totals.failed,
    animatedStaffModels: animated,
    staticPoseStaffModels: staticPose,
    renderModeCounts: models.reduce((counts, entry) => {
      const key = entry.renderMode || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {}),
    models,
  };
}

/**
 * Patch the existing browser-side staff integration so the manifest produced
 * by this same build controls what can be placed. Static-pose assets are only
 * placed on standing/non-walking staff anchors; animated assets retain the
 * existing named-clip requirement and can replace seated or standing staff.
 *
 * This helper deliberately supports both repository generations of the
 * runtime candidate array (PRIMARY_CANDIDATES and CANDIDATE_IDS). Unknown
 * source shapes are reported as a warning by the plugin and left untouched.
 */
export function transformStaffRuntimeIntegration(source, availableIds, renderModes) {
  const original = String(source || '').replace(/\r\n?/g, '\n');
  if (original.includes(MARKER)) return { code: original, map: null, alreadyPatched: true };
  if (!Array.isArray(availableIds) || !availableIds.length) return null;

  const candidatePattern = /const (PRIMARY_CANDIDATES|CANDIDATE_IDS) = \[[^\]]*\];/g;
  const candidateMatches = [...original.matchAll(candidatePattern)];
  const rigAnchor = 'const rigValid = metrics.skinnedMeshCount > 0 && metrics.skeletonCount > 0 && metrics.boneCount >= 15;';
  const humanScaleAnchor = `const humanScale = metrics.size.y >= 1.0 && metrics.size.y <= 2.6\n        && metrics.size.x >= 0.2 && metrics.size.x <= 1.35\n        && metrics.size.z >= 0.12 && metrics.size.z <= 1.35;`;
  const selectionAnchor = `const candidateClip = chooseClip(candidate.gltf.animations, Boolean(person.seated));
      if (candidateClip) {
        selected = candidate;
        clip = candidateClip;
        break;
      }`;
  const selectedGuard = 'if (!selected || !clip) continue;';
  const mixerAnchor = `const mixer = new T.AnimationMixer(clonedRoot);
    mixer.clipAction(clip).reset().play();
    mixers.push(mixer);`;
  const pushAnchor = 'replacements.push({ wrapper, mixer, person, assetId: selected.asset.id, clipName: clip.name });';
  const disposeAnchor = 'entry.mixer.stopAllAction();';
  const approvalAnchor = 'return new Set(Array.isArray(data.approvedAssetIds) ? data.approvedAssetIds : []);';
  const catchAnchor = 'return new Set();';

  const checks = [
    ['one candidate array', candidateMatches.length === 1],
    ['one legacy rig-validation anchor', original.split(rigAnchor).length - 1 === 1],
    ['one human-scale validation anchor', original.split(humanScaleAnchor).length - 1 === 1],
    ['one candidate-selection loop anchor', original.split(selectionAnchor).length - 1 === 1],
    ['one selected-candidate guard', original.split(selectedGuard).length - 1 === 1],
    ['one animation-mixer anchor', original.split(mixerAnchor).length - 1 === 1],
    ['one replacement-record anchor', original.split(pushAnchor).length - 1 === 1],
    ['one source-model disposal anchor', original.split(disposeAnchor).length - 1 === 1],
    ['one inspector approval read anchor', original.split(approvalAnchor).length - 1 === 1],
    ['one inspector fallback anchor', original.split(catchAnchor).length - 1 === 1]
  ];
  const missing = checks.filter(([, ok]) => !ok).map(([label]) => label);
  if (missing.length) return { code: null, warnings: [`Runtime integration source was not modified: ${missing.join(', ')} did not match the checked v1.2+ contract.`] };

  const defaultIds = JSON.stringify(availableIds);
  const modeJson = JSON.stringify(renderModes || {});
  let code = original;
  const candidateName = candidateMatches[0][1];
  const candidateReplacement = `const CALLORIA_STAFF_RENDER_MODES = Object.freeze(${modeJson});\nconst CALLORIA_STAFF_DEFAULT_CANDIDATES = Object.freeze(${defaultIds});\nconst ${candidateName} = ${defaultIds};`;
  code = code.replace(candidatePattern, candidateReplacement);

  code = code.replace(approvalAnchor, `const explicit = Array.isArray(data.approvedAssetIds) ? data.approvedAssetIds : [];
    const selected = explicit.filter((id) => CALLORIA_STAFF_DEFAULT_CANDIDATES.includes(id));
    return new Set(selected.length ? selected : CALLORIA_STAFF_DEFAULT_CANDIDATES);`);
  code = code.replace(catchAnchor, 'return new Set(CALLORIA_STAFF_DEFAULT_CANDIDATES);');
  code = code.replace(humanScaleAnchor, `const humanScale = metrics.size.y >= 0.4 && metrics.size.y <= 5.0
        && metrics.size.x >= 0.04 && metrics.size.x <= 3.5
        && metrics.size.z >= 0.04 && metrics.size.z <= 3.5
        && metrics.size.x / Math.max(metrics.size.y, 0.001) <= 1.0
        && metrics.size.z / Math.max(metrics.size.y, 0.001) <= 1.0;`);

  code = code.replace(rigAnchor, `const staffRenderMode = CALLORIA_STAFF_RENDER_MODES[asset.id] || null;
      const usableSkin = metrics.skinnedMeshCount > 0 && metrics.skeletonCount > 0 && metrics.boneCount >= 1;
      const rigValid = staffRenderMode === 'static-mesh'
        || staffRenderMode === 'animated-node-transforms'
        || (['skinned-static-pose', 'animated-skinned'].includes(staffRenderMode) && usableSkin)
        || (!staffRenderMode && metrics.skinnedMeshCount > 0 && metrics.skeletonCount > 0 && metrics.boneCount >= 15);`);

  code = code.replace('    let clip = null;\n    for (let offset = 0;', '    let clip = null;\n    let selectedRenderMode = null;\n    for (let offset = 0;');
  code = code.replace(selectionAnchor, `const candidateRenderMode = CALLORIA_STAFF_RENDER_MODES[candidate.asset.id] || 'animated-skinned';
      const candidateClip = chooseClip(candidate.gltf.animations, Boolean(person.seated));
      const isStaticPose = ['skinned-static-pose', 'static-mesh'].includes(candidateRenderMode);
      const canUseStandingPose = !person.seated
        && (isStaticPose || String(candidateRenderMode).startsWith('animated-'));
      if (candidateClip || canUseStandingPose) {
        selected = candidate;
        clip = candidateClip;
        selectedRenderMode = candidateRenderMode;
        break;
      }`);
  code = code.replace(selectedGuard, `if (!selected || (!clip && person.seated)) continue;`);
  code = code.replace(mixerAnchor, `let mixer = null;
    if (clip) {
      mixer = new T.AnimationMixer(clonedRoot);
      mixer.clipAction(clip).reset().play();
      mixers.push(mixer);
    }`);
  code = code.replace(pushAnchor, `replacements.push({ wrapper, mixer, person, assetId: selected.asset.id, clipName: clip?.name || null, renderMode: selectedRenderMode, animationActive: Boolean(clip) });`);
  code = code.replace(disposeAnchor, 'entry.mixer?.stopAllAction?.();');

  // Expose real placement detail to the existing onAssetsReady/GLB status UI.
  const statusAnchor = '      mode: replacements.length ? \'approved-glb-staff-with-local-fallback\' : \'merged-articulated-local-staff\',';
  if (code.split(statusAnchor).length - 1 === 1) {
    code = code.replace(statusAnchor, `${statusAnchor}
        assetsInUse: [...new Set(replacements.map((entry) => entry.assetId))],
        staticPosePlaced: replacements.filter((entry) => ['skinned-static-pose', 'static-mesh'].includes(entry.renderMode)).length,
        animatedPlaced: replacements.filter((entry) => String(entry.renderMode || '').startsWith('animated-')).length,`);
  }

  return { code: `/* ${MARKER} */\n${code}`, map: null, alreadyPatched: false };
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
  let renderModes = {};

  return {
    // Keep the original plugin name: existing Vite config registration is unchanged.
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
            priorError = `Existing local file was incompatible and will be refreshed: ${String(error?.message || error)}`;
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
          results[index] = { id: asset.id, status: 'downloaded-and-compatible', bytes: bytes.length };
          entries[index] = { ...asset, output: `/assets/models/${asset.path}`, status: 'downloaded-and-compatible', source, sizeBytes: bytes.length, sha256: sha256(bytes), ...metrics };
          this.info?.(`CALLORIA v6.14 bundled ${asset.name} (${bytes.length.toLocaleString()} bytes; ${metrics.triangleCount.toLocaleString()} triangles; mode ${metrics.renderMode}; ${metrics.boneCount} joints; ${metrics.animationCount} clips).`);
        } catch (error) {
          failed += 1;
          const message = [priorError, String(error?.message || error)].filter(Boolean).join(' | ');
          results[index] = { id: asset.id, status: 'unavailable', error: message };
          entries[index] = { ...asset, output: `/assets/models/${asset.path}`, status: 'unavailable', source, error: message };
          this.warn?.(`CALLORIA v6.14 could not bundle ${asset.name}: ${message}`);
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
      buildEntries = entries;
      renderModes = Object.fromEntries(entries.filter((entry) => entry && entry.status !== 'unavailable').map((entry) => [entry.id, entry.renderMode]));
      const status = availableIds.length === CC0_STAFF_MODELS.length ? 'complete' : availableIds.length ? 'partial' : 'unavailable';
      const manifest = makeManifest(entries, { bytes: totalBytes, valid: availableIds.length, failed }, status);
      const manifestPath = resolve(publicRoot, MANIFEST_RELATIVE);
      mkdirSync(dirname(manifestPath), { recursive: true });
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      this.info?.(`CALLORIA v6.14 staff GLB runtime bundle: ${availableIds.length}/${CC0_STAFF_MODELS.length} structurally compatible, ${manifest.animatedStaffModels} animated, ${manifest.staticPoseStaffModels} static-pose, ${totalBytes.toLocaleString()} bytes; manifest: /${MANIFEST_RELATIVE}.`);
    },
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!target.endsWith(TARGET) || source.includes(MARKER) || !availableIds.length) return null;
      const transformed = transformStaffRuntimeIntegration(source, availableIds, renderModes);
      if (!transformed?.code) {
        for (const warning of transformed?.warnings || []) this.warn?.(`CALLORIA v6.14 ${warning}`);
        return null;
      }
      this.info?.(`CALLORIA v6.14 runtime integration enabled for ${availableIds.length} bundled staff GLB(s): ${Object.entries(renderModes).map(([id, mode]) => `${id}=${mode}`).join(', ')}. Static-pose models are restricted to standing staff anchors.`);
      return { code: transformed.code, map: null };
    },
    api: {
      getAvailableStaffIds() { return [...availableIds]; },
      getBuildManifestEntries() { return [...buildEntries]; },
      getStaffRenderModes() { return { ...renderModes }; }
    }
  };
}

export function calloriaCC0StaffGLBBundlePlugin() {
  return createCalloriaCC0StaffGLBBundlePlugin();
}

export const __calloriaCC0StaffGLBBundleTest = Object.freeze({
  TARGET, MARKER, MANIFEST_RELATIVE, MAX_MODEL_BYTES, MAX_TOTAL_BYTES, MAX_TRIANGLES,
  REQUIRED_ANIMATIONS: Object.freeze([]), PREFERRED_ANIMATIONS, LICENSE,
  readGlbJsonAndChunks, parseGlb, sha256, fetchWithRetry, makeManifest, transformStaffRuntimeIntegration
});
