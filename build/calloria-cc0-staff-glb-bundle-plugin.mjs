/**
 * CALLORIA v6.22 — transform-aware GLB staff validator and runtime placement.
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
const OFFICE_TARGET = '/js/production-world.js';
const MARKER = '__CALLORIA_CC0_STAFF_GLB_RUNTIME_V614__';
const OFFICE_MARKER = '__CALLORIA_OFFICE_GLB_RUNTIME_V615__';
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


/** Build a glTF node's column-major local matrix, honoring matrix or TRS. */
function getNodeLocalMatrix(node = {}) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    const matrix = node.matrix.map(Number);
    if (!matrix.every(Number.isFinite)) throw new Error('GLB node contains a non-finite matrix value.');
    return matrix;
  }
  const t = Array.isArray(node.translation) ? node.translation.map(Number) : [0, 0, 0];
  const r = Array.isArray(node.rotation) ? node.rotation.map(Number) : [0, 0, 0, 1];
  const scale = Array.isArray(node.scale) ? node.scale.map(Number) : [1, 1, 1];
  if (t.length !== 3 || r.length !== 4 || scale.length !== 3
      || ![...t, ...r, ...scale].every(Number.isFinite)) {
    throw new Error('GLB node contains an invalid TRS transform.');
  }
  const qLength = Math.hypot(...r);
  if (qLength < 1e-8) throw new Error('GLB node contains a zero-length rotation quaternion.');
  const [x, y, z, w] = r.map((value) => value / qLength);
  const [sx, sy, sz] = scale;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1
  ];
}

/** Multiply column-major 4x4 matrices as parent * local. */
function multiplyNodeMatrices(parent, local) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let k = 0; k < 4; k += 1) {
        result[column * 4 + row] += parent[k * 4 + row] * local[column * 4 + k];
      }
    }
  }
  return result;
}

function transformNodePoint(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
  ];
}

/**
 * Measure only meshes reachable from the active glTF scene, applying each
 * ancestor node transform. Accessor-local bounds alone are not world bounds.
 */
function measureSceneNodeBounds(json) {
  const accessors = Array.isArray(json.accessors) ? json.accessors : [];
  const meshes = Array.isArray(json.meshes) ? json.meshes : [];
  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  const sceneIndex = Number.isInteger(json.scene) ? json.scene : 0;
  const roots = json.scenes?.[sceneIndex]?.nodes;
  if (!Array.isArray(roots)) throw new Error('GLB default scene has no node list for bounds measurement.');

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let measuredPrimitives = 0;
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  const visit = (nodeIndex, parentMatrix, ancestors, depth) => {
    if (!Number.isInteger(nodeIndex) || !nodes[nodeIndex]) {
      throw new Error(`GLB scene references invalid node index ${nodeIndex}.`);
    }
    if (depth > nodes.length) throw new Error('GLB node hierarchy exceeds its safe traversal depth.');
    if (ancestors.has(nodeIndex)) throw new Error(`GLB node hierarchy contains a cycle at node ${nodeIndex}.`);
    const node = nodes[nodeIndex];
    const worldMatrix = multiplyNodeMatrices(parentMatrix, getNodeLocalMatrix(node));

    if (Number.isInteger(node.mesh)) {
      const mesh = meshes[node.mesh];
      if (!mesh) throw new Error(`GLB node ${nodeIndex} references missing mesh ${node.mesh}.`);
      for (const primitive of mesh.primitives || []) {
        const accessor = accessors[primitive?.attributes?.POSITION];
        if (!Array.isArray(accessor?.min) || !Array.isArray(accessor?.max)
            || accessor.min.length < 3 || accessor.max.length < 3) continue;
        const lower = accessor.min.slice(0, 3).map(Number);
        const upper = accessor.max.slice(0, 3).map(Number);
        if (![...lower, ...upper].every(Number.isFinite)) continue;
        for (let mask = 0; mask < 8; mask += 1) {
          const point = transformNodePoint(
            worldMatrix,
            mask & 1 ? upper[0] : lower[0],
            mask & 2 ? upper[1] : lower[1],
            mask & 4 ? upper[2] : lower[2]
          );
          for (let axis = 0; axis < 3; axis += 1) {
            min[axis] = Math.min(min[axis], point[axis]);
            max[axis] = Math.max(max[axis], point[axis]);
          }
        }
        measuredPrimitives += 1;
      }
    }

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(nodeIndex);
    for (const child of node.children || []) visit(child, worldMatrix, nextAncestors, depth + 1);
  };

  for (const root of roots) visit(root, identity, new Set(), 0);
  if (!measuredPrimitives || ![...min, ...max].every(Number.isFinite)) return null;
  return {
    min: { x: min[0], y: min[1], z: min[2] },
    max: { x: max[0], y: max[1], z: max[2] },
    dimensions: { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] },
    measuredPrimitives
  };
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
  const sceneBounds = measureSceneNodeBounds(json);
  const dimensions = sceneBounds?.dimensions || null;
  if (!dimensions) throw new Error('GLB active scene has no measurable POSITION accessor bounds.');
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
    boundsSource: 'active-scene-node-transforms',
    measuredPrimitives: sceneBounds.measuredPrimitives,
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
    buildIntegration: 'CALLORIA v6.29 transform-aware staff GLB validation and tier-aware articulated static-pose idle',
    createdAt: new Date().toISOString(),
    status,
    source: 'Gobkit CC0 character pack direct GLB files; provenance recorded per model and pack.',
    license: LICENSE,
    runtimeDelivery: 'Validated files are copied into CALLORIA public/assets/models and served from the CALLORIA deployment. No browser-time Gobkit request is made.',
    compatibilityPolicy: 'A valid GLB may be animated-skinned, animated-node-transforms, skinned-static-pose, or static-mesh. Character proportions are measured from POSITION accessor bounds transformed through the active scene node hierarchy (matrix or TRS). Accessor-local dimensions are not treated as world dimensions. Animation clips and a 15-joint minimum are not required. No skeleton or animation is fabricated.',
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
function transformStaffRuntimeIntegrationBase(source, availableIds, renderModes) {
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


/**
 * v6.30 extends conservative bone-aware idle with low-amplitude arm, forearm
 * and hand micro-gestures for rigs exposing recognisable named bones.
 *
 * v6.27 adds conservative bone-aware idle motion to static skinned staff.
 * Named head/neck/spine/shoulder bones receive small local rotations. Models
 * without recognizable bones keep the v6.26 low-amplitude root-motion fallback.
 * No animation clips are fabricated and no extra renderer/update loop is added.
 */
const PROCEDURAL_IDLE_MARKER = '__CALLORIA_BONE_AWARE_STAFF_IDLE_V627__';
function addProceduralStaticStaffIdle(code) {
  const original = String(code || '').replace(/\r\n?/g, '\n');
  if (original.includes(PROCEDURAL_IDLE_MARKER)) return { code: original, alreadyPatched: true };
  const anchors = [
    ['mixer registry', 'const mixers = [];'],
    ['wrapper scene insertion', 'scene.add(wrapper);'],
    ['animation update loop', 'for (const mixer of mixers) mixer.update(step);'],
    ['replacement status detail', "animatedPlaced: replacements.filter((entry) => String(entry.renderMode || '').startsWith('animated-')).length,"],
    ['replacement disposal', 'mixers.length = 0;']
  ];
  const missing = anchors.filter(([, text]) => original.split(text).length - 1 !== 1).map(([label]) => label);
  if (missing.length) return { code: null, warnings: [`Bone-aware staff idle motion was not added: ${missing.join(', ')} did not match the verified staff runtime.`] };

  let next = original.replace('const mixers = [];', 'const mixers = [];\n  const proceduralIdleControllers = [];');
  next = next.replace('scene.add(wrapper);', `scene.add(wrapper);
    const proceduralIdle = !clip && ['skinned-static-pose', 'static-mesh'].includes(selectedRenderMode);
    let proceduralIdleMode = 'none';
    const idleBoneTargets = [];
    const idleBlinkMorphTargets = [];
    if (proceduralIdle && clonedRoot?.traverse) {
      clonedRoot.traverse((node) => {
        // Static skinned and unskinned staff GLBs may expose eyelid movement
        // as morph targets. Scan all procedural static models; bone motion is
        // still restricted below to actual skeleton bones. Authored clips are
        // excluded by the proceduralIdle gate above.
        const morphDictionary = node?.morphTargetDictionary;
        const morphInfluences = node?.morphTargetInfluences;
        if (morphDictionary && morphInfluences && typeof morphInfluences.length === 'number') {
          for (const [morphName, morphIndexValue] of Object.entries(morphDictionary)) {
            const normalizedMorphName = String(morphName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const isBlinkMorph = /^(?:eyeblink(?:left|right|l|r)?|blink(?:left|right|l|r)?|eyesclosed|eyelidsclosed)$/.test(normalizedMorphName);
            const morphIndex = Number(morphIndexValue);
            if (!isBlinkMorph || !Number.isInteger(morphIndex) || morphIndex < 0 || morphIndex >= morphInfluences.length) continue;
            const baseInfluence = Number(morphInfluences[morphIndex] || 0);
            if (!Number.isFinite(baseInfluence)) continue;
            idleBlinkMorphTargets.push({ mesh: node, index: morphIndex, baseInfluence: Math.max(0, Math.min(1, baseInfluence)) });
          }
        }
        if (!node?.isBone || !node.quaternion?.clone) return;
        const boneName = String(node.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        let channelSpecs = null;
        if (/^(?:mixamorig)?head$/.test(boneName)) {
          channelSpecs = [
            { axis: [0, 1, 0], amplitude: 0.026, speed: 0.42, phase: 0 },
            { axis: [1, 0, 0], amplitude: 0.011, speed: 0.31, phase: 1.1 },
            // Occasional, low-amplitude attention glance; deliberately slower
            // than the continuous idle channel so staff do not look restless.
            { axis: [0, 1, 0], amplitude: 0.018, speed: 0.15, phase: 1.7, pattern: 'attention-glance' },
            // A brief listening nod every ~15 seconds, with the neck sharing
            // a smaller counter-rotation to keep the movement natural.
            { axis: [1, 0, 0], amplitude: 0.010, period: 15, phase: 0, pattern: 'attention-nod' }
          ];
        } else if (/^(?:mixamorig)?neck[0-9]*$/.test(boneName)) {
          channelSpecs = [
            { axis: [0, 1, 0], amplitude: 0.013, speed: 0.37, phase: 0.55 },
            { axis: [1, 0, 0], amplitude: -0.0045, period: 15, phase: 0, pattern: 'attention-counter-nod' }
          ];
        } else if (/^(?:mixamorig)?(?:spine[0-9]*|chest|upperchest)$/.test(boneName)) {
          channelSpecs = [{ axis: [0, 0, 1], amplitude: 0.005, speed: 0.68, phase: 1.45 }];
        } else if (/^(?:mixamorig)?(?:left|right)shoulder$/.test(boneName) || /^(?:mixamorig)?shoulder[lr]$/.test(boneName)) {
          const isRight = /right|shoulderr$/.test(boneName);
          channelSpecs = [{ axis: [0, 0, 1], amplitude: isRight ? -0.0035 : 0.0035, speed: 0.82, phase: 2.05 }];
        } else if (/^(?:mixamorig)?leftarm$|^upperarml$|^upperarmleft$/.test(boneName)) {
          // Upper-arm micro motion is deliberately tiny and mirrored for a relaxed stance.
          channelSpecs = [{ axis: [0, 0, 1], amplitude: 0.012, speed: 0.53, phase: 2.0 }];
        } else if (/^(?:mixamorig)?rightarm$|^upperarmr$|^upperarmright$/.test(boneName)) {
          channelSpecs = [{ axis: [0, 0, 1], amplitude: -0.012, speed: 0.53, phase: 2.0 }];
        } else if (/^(?:mixamorig)?leftforearm$|^(?:mixamorig)?leftlowerarm$|^forearml$|^lowerarml$|^forearmleft$|^lowerarmleft$/.test(boneName)) {
          channelSpecs = [{ axis: [1, 0, 0], amplitude: 0.009, speed: 0.71, phase: 2.65 }];
        } else if (/^(?:mixamorig)?rightforearm$|^(?:mixamorig)?rightlowerarm$|^forearmr$|^lowerarmr$|^forearmright$|^lowerarmright$/.test(boneName)) {
          channelSpecs = [{ axis: [1, 0, 0], amplitude: -0.009, speed: 0.71, phase: 2.65 }];
        } else if (/^(?:mixamorig)?lefthand$|^handl$|^handleft$/.test(boneName)) {
          channelSpecs = [{ axis: [0, 1, 0], amplitude: 0.006, speed: 0.64, phase: 0.9 }];
        } else if (/^(?:mixamorig)?righthand$|^handr$|^handright$/.test(boneName)) {
          channelSpecs = [{ axis: [0, 1, 0], amplitude: -0.006, speed: 0.64, phase: 0.9 }];
        }
        if (!channelSpecs) return;
        idleBoneTargets.push({
          bone: node,
          motionType: channelSpecs.some((spec) => String(spec.pattern || '').startsWith('attention-'))
            ? 'attention'
            : /arm|forearm|lowerarm|hand/.test(boneName) ? 'micro-gesture' : 'posture',
          baseQuaternion: node.quaternion.clone(),
          channels: channelSpecs.map((spec) => ({
            axis: new T.Vector3(spec.axis[0], spec.axis[1], spec.axis[2]),
            amplitude: spec.amplitude,
            speed: spec.speed,
            period: spec.period || 0,
            pattern: spec.pattern || 'sine',
            phase: spec.phase,
            deltaQuaternion: new T.Quaternion()
          }))
        });
      });
    }
    if (proceduralIdle) {
      proceduralIdleMode = idleBoneTargets.length ? 'articulated-bone-idle' : 'root-idle-fallback';
      proceduralIdleControllers.push({
        wrapper,
        baseRotationY: wrapper.rotation.y,
        baseRotationZ: wrapper.rotation.z,
        basePositionY: wrapper.position.y,
        boneTargets: idleBoneTargets,
        blinkMorphTargets: idleBlinkMorphTargets,
        blinkPeriod: 3.6 + ((replacements.length * 0.71) % 1.8),
        blinkPhase: (replacements.length * 1.31) % 2.4,
        elapsed: 0,
        updateAccumulator: 0,
        phase: (replacements.length * 0.83) % (Math.PI * 2)
      });
    }`);

  next = next.replace('for (const mixer of mixers) mixer.update(step);', `for (const mixer of mixers) mixer.update(step);
      // Static-pose staff do not need a bone pose recalculation on every render
      // frame. Keep the idle layer at 30 Hz and pause it when the tab or any
      // ancestor of the staff wrapper is hidden.
      if (typeof document === 'undefined' || !document.hidden) {
        for (const idle of proceduralIdleControllers) {
          let visibleInScene = true;
          for (let node = idle.wrapper; node; node = node.parent) {
            if (node.visible === false) { visibleInScene = false; break; }
          }
          if (!visibleInScene) continue;
          idle.updateAccumulator += step;
          if (idle.updateAccumulator < (1 / 30)) continue;
          const idleStep = Math.min(idle.updateAccumulator, 0.1);
          idle.updateAccumulator = 0;
          idle.elapsed += idleStep;
          const breath = Math.sin(idle.elapsed * 1.15 + idle.phase);
          const sway = Math.sin(idle.elapsed * 0.72 + idle.phase);
          // Short smooth eyelid pulses vary by character so staff do not blink
          // in sync. Static-pose models only are eligible for this controller.
          if (idle.blinkMorphTargets?.length) {
            const blinkCycle = ((idle.elapsed + idle.blinkPhase) % idle.blinkPeriod) / idle.blinkPeriod;
            const blinkWindow = 0.055;
            const blinkWeight = blinkCycle < blinkWindow
              ? Math.sin(Math.PI * blinkCycle / blinkWindow)
              : 0;
            for (const target of idle.blinkMorphTargets) {
              const influences = target.mesh?.morphTargetInfluences;
              if (!influences || target.index >= influences.length) continue;
              influences[target.index] = target.baseInfluence + (1 - target.baseInfluence) * blinkWeight;
            }
          }
          if (idle.boneTargets?.length) {
            for (const target of idle.boneTargets) {
              target.bone.quaternion.copy(target.baseQuaternion);
              for (const channel of target.channels) {
                let angle;
                if (channel.pattern === 'attention-nod' || channel.pattern === 'attention-counter-nod') {
                  const period = Math.max(8, channel.period || 15);
                  const cyclePosition = ((idle.elapsed + idle.phase * 1.7) % period) / period;
                  const nodWindow = 0.12;
                  const nodPulse = cyclePosition < nodWindow
                    ? Math.sin(Math.PI * cyclePosition / nodWindow)
                    : 0;
                  angle = nodPulse * channel.amplitude;
                } else {
                  const phase = idle.elapsed * channel.speed + idle.phase + channel.phase;
                  angle = Math.sin(phase) * channel.amplitude;
                }
                channel.deltaQuaternion.setFromAxisAngle(channel.axis, angle);
                target.bone.quaternion.multiply(channel.deltaQuaternion);
              }
            }
          } else {
            // Static meshes or rigs without known bone names retain restrained root idle.
            idle.wrapper.rotation.y = idle.baseRotationY + sway * 0.006;
            idle.wrapper.rotation.z = idle.baseRotationZ + Math.sin(idle.elapsed * 0.55 + idle.phase) * 0.0025;
            idle.wrapper.position.y = idle.basePositionY + breath * 0.0025;
          }
        }
      }`);

  next = next.replace(
    "animatedPlaced: replacements.filter((entry) => String(entry.renderMode || '').startsWith('animated-')).length,",
    "animatedPlaced: replacements.filter((entry) => String(entry.renderMode || '').startsWith('animated-')).length,\n        proceduralIdlePlaced: replacements.filter((entry) => entry.proceduralIdle).length,\n        articulatedIdlePlaced: replacements.filter((entry) => entry.proceduralIdleMode === 'articulated-bone-idle').length,\n        rootIdleFallbackPlaced: replacements.filter((entry) => entry.proceduralIdleMode === 'root-idle-fallback').length,\n        microGestureStaffPlaced: replacements.filter((entry) => entry.proceduralIdleGestureTargets > 0).length,\n        microGestureBoneTargets: replacements.reduce((sum, entry) => sum + (entry.proceduralIdleGestureTargets || 0), 0),\n        attentionGestureStaffPlaced: replacements.filter((entry) => entry.proceduralIdleAttentionTargets > 0).length,\n        attentionGestureBoneTargets: replacements.reduce((sum, entry) => sum + (entry.proceduralIdleAttentionTargets || 0), 0),\n        blinkMorphStaffPlaced: replacements.filter((entry) => entry.proceduralIdleBlinkTargets > 0).length,\n        blinkMorphTargets: replacements.reduce((sum, entry) => sum + (entry.proceduralIdleBlinkTargets || 0), 0),\n        adaptiveIdleUpdateHz: 30,\n        idleVisibilityAware: true,"
  );
  const pushAnchor = 'replacements.push({ wrapper, mixer, person, assetId: selected.asset.id, clipName: clip?.name || null, renderMode: selectedRenderMode, animationActive: Boolean(clip) });';
  if (next.split(pushAnchor).length - 1 !== 1) return { code: null, warnings: ['Bone-aware staff idle motion was not added: replacement record did not match the verified staff runtime.'] };
  next = next.replace(pushAnchor, "replacements.push({ wrapper, mixer, person, assetId: selected.asset.id, clipName: clip?.name || null, renderMode: selectedRenderMode, animationActive: Boolean(clip), proceduralIdle: !clip && ['skinned-static-pose', 'static-mesh'].includes(selectedRenderMode), proceduralIdleMode, proceduralIdleGestureTargets: idleBoneTargets.filter((target) => target.motionType === 'micro-gesture').length, proceduralIdleAttentionTargets: idleBoneTargets.filter((target) => target.motionType === 'attention').length, proceduralIdleBlinkTargets: idleBlinkMorphTargets.length });");
  next = next.replace('mixers.length = 0;', 'mixers.length = 0;\n      proceduralIdleControllers.length = 0;');
  return { code: `/* ${PROCEDURAL_IDLE_MARKER} */\n${next}`, alreadyPatched: false };
}

/**
 * v6.29 makes procedural idle quality tier-aware and reduces visibility-query
 * churn. Low devices use 12 Hz, balanced devices 20 Hz and high devices 30 Hz.
 * Visibility in the staff hierarchy is rechecked every 250 ms instead of
 * traversing every ancestor on every rendered frame. Controllers are staggered
 * so a group of static staff does not all recalculate on the same frame.
 */
const TIER_AWARE_IDLE_MARKER = '__CALLORIA_TIER_AWARE_STAFF_IDLE_V629__';
function addTierAwareStaffIdleScheduler(code) {
  const original = String(code || '').replace(/\r\n?/g, '\n');
  if (original.includes(TIER_AWARE_IDLE_MARKER)) return { code: original, alreadyPatched: true };
  const anchors = [
    ['idle controller registry', 'const proceduralIdleControllers = [];'],
    ['idle controller registration', 'updateAccumulator: 0,'],
    ['visibility-aware scheduler block', `          let visibleInScene = true;\n          for (let node = idle.wrapper; node; node = node.parent) {\n            if (node.visible === false) { visibleInScene = false; break; }\n          }\n          if (!visibleInScene) continue;\n          idle.updateAccumulator += step;\n          if (idle.updateAccumulator < (1 / 30)) continue;\n          const idleStep = Math.min(idle.updateAccumulator, 0.1);\n          idle.updateAccumulator = 0;`],
    ['idle runtime diagnostics', 'adaptiveIdleUpdateHz: 30,']
  ];
  const missing = anchors.filter(([, text]) => original.split(text).length - 1 !== 1).map(([label]) => label);
  if (missing.length) return { code: null, warnings: [`Tier-aware staff idle scheduler was not added: ${missing.join(', ')} did not match the verified v6.28 runtime.`] };

  let next = original.replace(
    'const proceduralIdleControllers = [];',
    `const proceduralIdleControllers = [];\n  const proceduralIdleUpdateHz = tier === 'low' ? 12 : tier === 'high' ? 30 : 20;\n  const proceduralIdleVisibilityInterval = 0.25;`
  );
  next = next.replace(
    'updateAccumulator: 0,',
    `updateAccumulator: (replacements.length % 4) * (1 / proceduralIdleUpdateHz / 4),\n        visibilityAccumulator: 0,\n        visibleInScene: true,`
  );
  const previousScheduler = anchors[2][1];
  const replacementScheduler = `          // Refresh ancestor visibility at 4 Hz; hierarchy traversal is not needed\n          // on every render frame. A hidden tab still pauses the entire idle layer.\n          idle.visibilityAccumulator -= step;\n          if (idle.visibilityAccumulator <= 0) {\n            let visibleInScene = true;\n            for (let node = idle.wrapper; node; node = node.parent) {\n              if (node.visible === false) { visibleInScene = false; break; }\n            }\n            idle.visibleInScene = visibleInScene;\n            idle.visibilityAccumulator = proceduralIdleVisibilityInterval;\n          }\n          if (!idle.visibleInScene) continue;\n          idle.updateAccumulator += step;\n          const idleInterval = 1 / proceduralIdleUpdateHz;\n          if (idle.updateAccumulator < idleInterval) continue;\n          const idleStep = Math.min(idle.updateAccumulator, 0.1);\n          idle.updateAccumulator = Math.max(0, idle.updateAccumulator - idleInterval);`;
  next = next.replace(previousScheduler, replacementScheduler);
  next = next.replace(
    'adaptiveIdleUpdateHz: 30,',
    'adaptiveIdleUpdateHz: proceduralIdleUpdateHz,\n        idleVisibilityCacheMs: 250,\n        idleUpdateTier: tier,'
  );
  return { code: `/* ${TIER_AWARE_IDLE_MARKER} */\n${next}`, alreadyPatched: false };
}

export function transformStaffRuntimeIntegration(source, availableIds, renderModes) {
  const base = transformStaffRuntimeIntegrationBase(source, availableIds, renderModes);
  if (!base?.code) return base;

  let working = base.code;
  let idleAdded = false;
  if (!base.alreadyPatched) {
    const idle = addProceduralStaticStaffIdle(working);
    if (!idle?.code) return { ...base, code: null, warnings: idle?.warnings || ['Static staff idle transform did not produce code.'] };
    working = idle.code;
    idleAdded = true;
  }
  const scheduled = addTierAwareStaffIdleScheduler(working);
  if (!scheduled?.code) return { ...base, code: null, warnings: scheduled?.warnings || ['Tier-aware staff idle scheduler did not produce code.'] };
  return {
    ...base,
    code: scheduled.code,
    attentionGesturesAdded: true,
    proceduralIdleAdded: idleAdded || working.includes(PROCEDURAL_IDLE_MARKER),
    tierAwareIdleSchedulerAdded: !scheduled.alreadyPatched,
    alreadyPatched: Boolean(base.alreadyPatched && scheduled.alreadyPatched)
  };
}
/**
 * Connect the v6.13 office-asset runtime to the production-world scene.
 * This transform uses checked source anchors and fails closed if the world API
 * has changed; it never creates a second renderer or animation loop.
 */
export function transformOfficeWorldIntegration(source) {
  const original = String(source || '').replace(/\r\n?/g, '\n');
  if (original.includes(OFFICE_MARKER)) {
    return { code: original, map: null, alreadyPatched: true, warnings: [] };
  }

  const readyAnchor = "  callbacks.onAssetsReady?.({ loaded: 0, fallback: staff.length, mode: 'merged-articulated-local-staff', tier });";
  const disposeAnchor = '      scene.traverse((object) => {';
  const existingImport = "import { integrateCalloriaGLBOfficeAssets } from './glb-office-world-integration.js';";
  const checks = [
    ['production-world initializer', original.split('export async function initProductionWorld(THREE, host, callbacks = {}) {').length - 1 === 1],
    ['office station list', original.split('  const stations = [];').length - 1 === 1],
    ['post-construction readiness anchor', original.split(readyAnchor).length - 1 === 1],
    ['scene disposal anchor', original.split(disposeAnchor).length - 1 === 1],
    ['single scene renderer contract', original.includes('renderer.render(scene, camera);')],
    ['office runtime import not already present', !original.includes(existingImport)]
  ];
  const missing = checks.filter(([, ok]) => !ok).map(([label]) => label);
  if (missing.length) {
    return {
      code: null,
      map: null,
      warnings: [`Office GLB runtime was not connected: ${missing.join(', ')} did not match the checked production-world contract.`]
    };
  }

  const bootstrap = `  // ${OFFICE_MARKER}: start after the floor and station anchors exist.\n  // The current local/instanced furniture remains visible until each GLB is\n  // loaded, validated and placed successfully by the office runtime.\n  let officeGlbLayer = null;\n  const officeGlbBootstrap = integrateCalloriaGLBOfficeAssets({ THREE, scene, stations, tier })\n    .then((layer) => {\n      if (disposed) { layer.dispose?.(); return null; }\n      officeGlbLayer = layer;\n      callbacks.onOfficeAssetsReady?.(layer.status);\n      if (Number(layer.status?.officeObjectsPlaced || 0) > 0) renderStill();\n      return layer;\n    })\n    .catch((error) => {\n      const message = String(error?.message || error);\n      const status = Object.freeze({\n        placed: 0, officeObjectsPlaced: 0, assets: [], loadedAssetIds: [],\n        failedAssetIds: ['office-runtime'], tier, stationCount: stations.length,\n        assetDetails: [], errors: [{ assetId: 'office-runtime', message }],\n        reason: 'Office GLB runtime failed: ' + message\n      });\n      callbacks.onOfficeAssetsReady?.(status);\n      if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {\n        window.dispatchEvent(new CustomEvent('calloria:office-glb-status', { detail: status }));\n      }\n      return null;\n    });\n  void officeGlbBootstrap;\n`;

  let code = original.replace(readyAnchor, `${bootstrap}${readyAnchor}`);
  code = code.replace(disposeAnchor, `      officeGlbLayer?.dispose?.();\n      officeGlbLayer = null;\n${disposeAnchor}`);
  code = `${existingImport}\n/* ${OFFICE_MARKER} */\n${code}`;
  return { code, map: null, alreadyPatched: false, warnings: [] };
}

export 
const RUNTIME_DIAGNOSTICS_JSON = 'calloria-staff-glb-diagnostics.json';
const RUNTIME_DIAGNOSTICS_HTML = 'calloria-staff-glb-diagnostics.html';

/** Produce a browser-safe summary; never expose remote source URLs or build secrets. */
function makeRuntimeDiagnosticsPayload({ entries = [], runtime = {}, generatedAt = new Date().toISOString() } = {}) {
  const assets = entries.filter(Boolean).map((entry) => ({
    id: entry.id,
    name: entry.name,
    role: entry.role,
    output: entry.output,
    status: entry.status,
    sizeBytes: entry.sizeBytes || 0,
    sha256: entry.sha256 || null,
    renderMode: entry.renderMode || null,
    dimensions: entry.dimensions || null,
    boundsSource: entry.boundsSource || null,
    meshCount: entry.meshCount ?? null,
    triangleCount: entry.triangleCount ?? null,
    boneCount: entry.boneCount ?? null,
    animationCount: entry.animationCount ?? null,
    animationNames: Array.isArray(entry.animationNames) ? entry.animationNames : [],
    error: entry.error || null
  }));
  const normalizedRuntime = {};
  for (const key of ['staff', 'office']) {
    const value = runtime[key] || {};
    normalizedRuntime[key] = {
      status: String(value.status || 'not-observed'),
      source: value.source || null,
      warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : [],
      message: value.message || null
    };
  }
  const bundled = assets.filter((asset) => asset.status !== 'unavailable');
  return {
    schemaVersion: 1,
    product: 'CALLORIA',
    generatedAt,
    notice: 'This report checks build-time GLB validation, generated runtime transforms and deployed file availability. It does not prove that a model was placed or rendered in the live game scene.',
    bundle: {
      expectedAssets: CC0_STAFF_MODELS.length,
      listedAssets: assets.length,
      bundledAssets: bundled.length,
      unavailableAssets: assets.length - bundled.length,
      totalBytes: bundled.reduce((sum, asset) => sum + asset.sizeBytes, 0)
    },
    runtime: normalizedRuntime,
    assets
  };
}

/** Self-contained page for checking GLB deployment without developer tools. */
function makeRuntimeDiagnosticsHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>CALLORIA — Staff GLB Runtime Audit</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;background:#09111f;color:#e8eef8;font-synthesis:none}*{box-sizing:border-box}body{margin:0;padding:28px;max-width:1180px;margin-inline:auto}header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}h1{font-size:clamp(25px,4vw,38px);margin:0 0 7px}p{color:#aab8cd;line-height:1.55}.eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#83b9ff;font-weight:800}.sub{margin:0 0 22px}.notice{border:1px solid #66552d;background:#261f12;color:#f3dca8;border-radius:12px;padding:13px 16px;margin:18px 0 22px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:12px;margin:18px 0}.card,.panel{background:#111d2f;border:1px solid #263750;border-radius:14px;padding:17px}.label{font-size:12px;color:#9fb0c8;text-transform:uppercase;letter-spacing:.08em}.value{font-size:25px;font-weight:800;margin-top:6px;overflow-wrap:anywhere}.state{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;background:#29364a;color:#dce8f8}.state.good{background:#123a2e;color:#8ff0c3}.state.bad{background:#49252a;color:#ffb1b8}.state.warn{background:#463718;color:#f4d78a}.panel{margin:12px 0 20px}.panel h2{margin:0 0 13px;font-size:17px}.runtime-row{display:grid;grid-template-columns:130px 1fr;gap:12px;padding:10px 0;border-top:1px solid #263750}.runtime-row:first-of-type{border-top:0}.runtime-row strong{font-size:13px}.runtime-row p{margin:3px 0 0;font-size:13px;overflow-wrap:anywhere}.table-wrap{overflow-x:auto;border:1px solid #263750;border-radius:14px;background:#111d2f}table{width:100%;border-collapse:collapse;min-width:780px}th,td{text-align:left;padding:13px 14px;border-bottom:1px solid #263750;font-size:13px}th{color:#9fb0c8;font-size:11px;text-transform:uppercase;letter-spacing:.08em}tr:last-child td{border-bottom:0}.asset-name{font-weight:750}.muted{color:#93a5be;font-size:12px;margin-top:3px}.error{color:#ffb1b8;max-width:280px;overflow-wrap:anywhere}.footer{font-size:12px;color:#91a2bb;margin-top:18px}.actions{display:flex;gap:8px;align-items:center}.button{background:#193a60;border:1px solid #315d8b;color:#e8f2ff;padding:9px 13px;border-radius:9px;font-weight:700;cursor:pointer}.button:disabled{opacity:.5;cursor:default}@media(max-width:600px){body{padding:16px}.runtime-row{grid-template-columns:1fr;gap:4px}}
</style></head>
<body>
<header><div><div class="eyebrow">CALLORIA · Deployment diagnostics</div><h1>Staff GLB Runtime Audit</h1><p class="sub">Build validation, runtime source transformation and production file checks.</p></div><div class="actions"><span id="last-check" class="state">Loading</span><button class="button" id="refresh" type="button">Recheck files</button></div></header>
<div class="notice" id="notice">Loading the build report. This page does not claim that a model has rendered in the game world.</div>
<section class="grid" id="summary"><div class="card"><div class="label">Bundled assets</div><div class="value">—</div></div><div class="card"><div class="label">Files reachable</div><div class="value">—</div></div><div class="card"><div class="label">Staff transform</div><div class="value">—</div></div><div class="card"><div class="label">Office transform</div><div class="value">—</div></div></section>
<section class="panel"><h2>Build runtime integration</h2><div id="runtime"><p>Waiting for report…</p></div></section>
<h2>Staff model assets</h2><div class="table-wrap"><table><thead><tr><th>Model</th><th>Build validation</th><th>Render mode</th><th>World dimensions</th><th>Production file</th></tr></thead><tbody id="assets"><tr><td colspan="5">Waiting for report…</td></tr></tbody></table></div>
<p class="footer" id="generated"></p>
<script>
const $=(id)=>document.getElementById(id);let report=null;let checking=false;
function badge(text,kind=''){return '<span class="state '+kind+'">'+escapeHtml(text)+'</span>'}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function kindFor(status){return ['patched','already-patched','reachable'].includes(status)?'good':['skipped','unavailable','missing','invalid'].includes(status)?'bad':'warn'}
function dimensionText(value){if(!value)return 'Not recorded';return [value.x,value.y,value.z].map((n)=>Number(n).toFixed(2)).join(' × ')+' m'}
async function probe(asset){if(!asset.output)return{status:'missing',detail:'No output path'};let response;try{response=await fetch(asset.output,{method:'GET',headers:{Range:'bytes=0-3'},cache:'no-store'});if(!response.ok)return{status:'missing',detail:'HTTP '+response.status};let bytes=new Uint8Array(0);if(response.body?.getReader){const reader=response.body.getReader();const first=await reader.read();if(first.value)bytes=first.value.slice(0,4);try{await reader.cancel()}catch{}}const magic=bytes.length===4&&bytes[0]===103&&bytes[1]===108&&bytes[2]===84&&bytes[3]===70;return magic?{status:'reachable',detail:'GLB header confirmed · HTTP '+response.status}:{status:'invalid',detail:'File responded but GLB header was not confirmed'}}catch(error){return{status:'missing',detail:String(error?.message||error)}}}
function renderRuntime(){const rows=[];for(const key of ['staff','office']){const item=report.runtime[key]||{};const title=key==='staff'?'Staff world integration':'Office world integration';const warnings=(item.warnings||[]).join(' · ');const detail=item.message||warnings||item.source||'No additional details';rows.push('<div class="runtime-row"><strong>'+escapeHtml(title)+'</strong><div>'+badge(item.status,kindFor(item.status))+'<p>'+escapeHtml(detail)+'</p></div></div>')} $('runtime').innerHTML=rows.join('')}
async function render(){if(!report)return;checking=true;$('refresh').disabled=true;const checks=await Promise.all(report.assets.map(probe));const ok=checks.filter((r)=>r.status==='reachable').length;const staff=report.runtime.staff.status;const office=report.runtime.office.status;$('summary').innerHTML=[['Bundled assets',report.bundle.bundledAssets+'/'+report.bundle.expectedAssets],['Files reachable',ok+'/'+report.assets.length],['Staff transform',staff],['Office transform',office]].map(([label,value])=>'<div class="card"><div class="label">'+escapeHtml(label)+'</div><div class="value">'+escapeHtml(value)+'</div></div>').join('');$('assets').innerHTML=report.assets.map((asset,index)=>{const check=checks[index];const dimensions=dimensionText(asset.dimensions);const mode=asset.renderMode||'Not classified';const meta=[asset.triangleCount?Number(asset.triangleCount).toLocaleString()+' triangles':null,asset.animationCount!=null?asset.animationCount+' clips':null,asset.boneCount!=null?asset.boneCount+' bones':null].filter(Boolean).join(' · ');const error=asset.error?'<div class="error">'+escapeHtml(asset.error)+'</div>':'';return '<tr><td><div class="asset-name">'+escapeHtml(asset.name||asset.id)+'</div><div class="muted">'+escapeHtml(asset.id)+' · '+escapeHtml(asset.role||'')+'</div></td><td>'+badge(asset.status,kindFor(asset.status))+'<div class="muted">'+escapeHtml(meta)+'</div>'+error+'</td><td>'+escapeHtml(mode)+'</td><td>'+escapeHtml(dimensions)+'<div class="muted">'+escapeHtml(asset.boundsSource||'')+'</div></td><td>'+badge(check.status,kindFor(check.status))+'<div class="muted">'+escapeHtml(check.detail)+'</div></td></tr>'}).join('')||'<tr><td colspan="5">No staff assets were recorded in this build.</td></tr>';$('last-check').textContent=ok+'/'+report.assets.length+' files reachable';$('last-check').className='state '+(ok===report.assets.length&&report.assets.length?'good':'warn');$('notice').textContent=report.notice;$('generated').textContent='Report generated '+new Date(report.generatedAt).toLocaleString()+' · Build bundle size '+Number(report.bundle.totalBytes||0).toLocaleString()+' bytes.';checking=false;$('refresh').disabled=false}
async function load(){try{const response=await fetch('./calloria-staff-glb-diagnostics.json',{cache:'no-store'});if(!response.ok)throw new Error('Diagnostic JSON returned HTTP '+response.status);report=await response.json();renderRuntime();await render()}catch(error){$('notice').textContent='Could not load the build report: '+String(error?.message||error);$('last-check').textContent='Report unavailable';$('last-check').className='state bad';$('refresh').disabled=false}}
$('refresh').addEventListener('click',()=>{if(!checking)render()});load();
</script></body></html>`;
}

function createCalloriaCC0StaffGLBBundlePlugin(options = {}) {
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
  const runtimeDiagnostics = {
    staff: { status: 'not-observed', source: '/js/glb-world-integration.js', warnings: [], message: 'Vite has not reported a staff runtime transform for this build.' },
    office: { status: 'not-observed', source: '/js/production-world.js', warnings: [], message: 'Vite has not reported an office runtime transform for this build.' }
  };

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
          this.info?.(`CALLORIA v6.22 bundled ${asset.name} (${bytes.length.toLocaleString()} bytes; ${metrics.triangleCount.toLocaleString()} triangles; world bounds ${metrics.dimensions.x.toFixed(2)} × ${metrics.dimensions.y.toFixed(2)} × ${metrics.dimensions.z.toFixed(2)} m; mode ${metrics.renderMode}; ${metrics.boneCount} joints; ${metrics.animationCount} clips).`);
        } catch (error) {
          failed += 1;
          const message = [priorError, String(error?.message || error)].filter(Boolean).join(' | ');
          results[index] = { id: asset.id, status: 'unavailable', error: message };
          entries[index] = { ...asset, output: `/assets/models/${asset.path}`, status: 'unavailable', source, error: message };
          this.warn?.(`CALLORIA v6.22 could not bundle ${asset.name}: ${message}`);
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
      this.info?.(`CALLORIA v6.22 staff GLB runtime bundle: ${availableIds.length}/${CC0_STAFF_MODELS.length} structurally compatible, ${manifest.animatedStaffModels} animated, ${manifest.staticPoseStaffModels} static-pose, ${totalBytes.toLocaleString()} bytes; manifest: /${MANIFEST_RELATIVE}.`);
    },
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (target.endsWith(OFFICE_TARGET)) {
        if (source.includes(OFFICE_MARKER)) {
          runtimeDiagnostics.office = { status: 'already-patched', source: target, warnings: [], message: 'The source already contains the office GLB runtime marker.' };
          return null;
        }
        const office = transformOfficeWorldIntegration(source);
        if (!office?.code) {
          const warnings = office?.warnings || ['Office runtime transform returned no code.'];
          runtimeDiagnostics.office = { status: 'skipped', source: target, warnings, message: warnings.join(' ') };
          for (const warning of warnings) this.warn?.(`CALLORIA v6.23 office integration: ${warning}`);
          return null;
        }
        runtimeDiagnostics.office = { status: 'patched', source: target, warnings: [], message: 'Office GLB bootstrap was inserted into the existing production-world scene lifecycle.' };
        this.info?.('CALLORIA v6.23 office GLB runtime activation preserved: desks, computers, headsets and reception assets load into the existing production-world scene.');
        return { code: office.code, map: null };
      }
      if (!target.endsWith(TARGET)) return null;
      if (source.includes(MARKER)) {
        runtimeDiagnostics.staff = { status: 'already-patched', source: target, warnings: [], message: 'The source already contains the staff GLB runtime marker.' };
        return null;
      }
      if (!availableIds.length) {
        runtimeDiagnostics.staff = { status: 'skipped', source: target, warnings: ['No staff GLB passed build validation.'], message: 'No eligible staff GLB files were available to connect to the world runtime.' };
        return null;
      }
      const transformed = transformStaffRuntimeIntegration(source, availableIds, renderModes);
      if (!transformed?.code) {
        const warnings = transformed?.warnings || ['Staff runtime transform returned no code.'];
        runtimeDiagnostics.staff = { status: 'skipped', source: target, warnings, message: warnings.join(' ') };
        for (const warning of warnings) this.warn?.(`CALLORIA v6.23 staff runtime integration: ${warning}`);
        return null;
      }
      runtimeDiagnostics.staff = { status: 'patched', source: target, warnings: [], message: `Staff runtime transform enabled for ${availableIds.length} validated model(s). Static-pose standing staff use conservative named-bone idle, including small upper-arm/forearm/hand micro-gestures where recognised; otherwise root-idle fallback. Procedural idle is visibility-aware and capped by graphics tier; no source animation clip is claimed. Live scene placement still requires browser verification.` };
      this.info?.(`CALLORIA v6.28 runtime integration enabled for ${availableIds.length} bundled staff GLB(s): ${Object.entries(renderModes).map(([id, mode]) => `${id}=${mode}`).join(', ')}. Static-pose staff are restricted to standing anchors and use conservative bone-aware idle when recognized rig nodes exist, with a small root-motion fallback otherwise.`);
      return { code: transformed.code, map: null };
    },
    generateBundle() {
      const payload = makeRuntimeDiagnosticsPayload({ entries: buildEntries, runtime: runtimeDiagnostics });
      this.emitFile?.({ type: 'asset', fileName: RUNTIME_DIAGNOSTICS_JSON, source: `${JSON.stringify(payload, null, 2)}\n` });
      this.emitFile?.({ type: 'asset', fileName: RUNTIME_DIAGNOSTICS_HTML, source: makeRuntimeDiagnosticsHtml() });
      this.info?.(`CALLORIA v6.28 deployment audit emitted: /${RUNTIME_DIAGNOSTICS_HTML} and /${RUNTIME_DIAGNOSTICS_JSON}. The report distinguishes validated files from runtime scene placement.`);
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
  TARGET, OFFICE_TARGET, MARKER, OFFICE_MARKER, MANIFEST_RELATIVE, MAX_MODEL_BYTES, MAX_TOTAL_BYTES, MAX_TRIANGLES,
  REQUIRED_ANIMATIONS: Object.freeze([]), PREFERRED_ANIMATIONS, LICENSE,
  readGlbJsonAndChunks, parseGlb, sha256, fetchWithRetry, makeManifest,
  getNodeLocalMatrix, multiplyNodeMatrices, transformNodePoint, measureSceneNodeBounds,
  transformStaffRuntimeIntegration, transformStaffRuntimeIntegrationBase, addProceduralStaticStaffIdle, PROCEDURAL_IDLE_MARKER, addTierAwareStaffIdleScheduler, TIER_AWARE_IDLE_MARKER, transformOfficeWorldIntegration,
  makeRuntimeDiagnosticsPayload, makeRuntimeDiagnosticsHtml,
  RUNTIME_DIAGNOSTICS_JSON, RUNTIME_DIAGNOSTICS_HTML
});
