import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function readU24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function imageDimensions(bytes) {
  if (!bytes || bytes.length < 12) return null;
  // PNG
  if (bytes[0] === 0x89 && bytes.toString('ascii', 1, 4) === 'PNG' && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), format: 'png' };
  }
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd9 || marker === 0xda) break;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      const isSOF = [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker);
      if (isSOF && length >= 7) {
        return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3), format: 'jpeg' };
      }
      offset += length;
    }
  }
  // WebP
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const kind = bytes.toString('ascii', 12, 16);
    if (kind === 'VP8X' && bytes.length >= 30) {
      return { width: readU24LE(bytes, 24) + 1, height: readU24LE(bytes, 27) + 1, format: 'webp' };
    }
    if (kind === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
      const b1 = bytes[21], b2 = bytes[22], b3 = bytes[23], b4 = bytes[24];
      return { width: 1 + (((b2 & 0x3f) << 8) | b1), height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)), format: 'webp' };
    }
    if (kind === 'VP8 ' && bytes.length >= 30) {
      return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff, format: 'webp' };
    }
  }
  // KTX2
  if (bytes.length >= 28 && bytes.toString('hex', 0, 12) === 'ab4b5458203230bb0d0a1a0a') {
    return { width: bytes.readUInt32LE(20), height: bytes.readUInt32LE(24), format: 'ktx2' };
  }
  return null;
}

function countTriangles(primitive, json) {
  const mode = primitive.mode ?? 4;
  const positionAccessor = json.accessors?.[primitive.attributes?.POSITION];
  const indexAccessor = primitive.indices == null ? null : json.accessors?.[primitive.indices];
  const count = indexAccessor?.count ?? positionAccessor?.count ?? 0;
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

export function inspectGlbBuffer(bytes, fileName = '<buffer>') {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (bytes.length < 20) throw new Error(`${fileName}: file is too small to be a GLB.`);
  if (bytes.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${fileName}: invalid GLB magic; expected 'glTF'.`);
  const version = bytes.readUInt32LE(4);
  const declaredLength = bytes.readUInt32LE(8);
  if (version !== 2) throw new Error(`${fileName}: GLB version ${version} is unsupported; expected version 2.`);
  if (declaredLength !== bytes.length) throw new Error(`${fileName}: header length ${declaredLength} does not match actual size ${bytes.length}.`);

  let offset = 12;
  let json = null;
  let bin = Buffer.alloc(0);
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkLength % 4 !== 0 || offset + chunkLength > bytes.length) {
      throw new Error(`${fileName}: malformed GLB chunk at byte ${offset - 8}.`);
    }
    const chunk = bytes.subarray(offset, offset + chunkLength);
    if (chunkType === JSON_CHUNK) {
      if (json) throw new Error(`${fileName}: multiple JSON chunks found.`);
      try { json = JSON.parse(chunk.toString('utf8').replace(/[\u0000\u0020]+$/g, '')); }
      catch (error) { throw new Error(`${fileName}: invalid JSON chunk (${error.message}).`); }
    } else if (chunkType === BIN_CHUNK) {
      bin = chunk;
    }
    offset += chunkLength;
  }
  if (!json) throw new Error(`${fileName}: GLB JSON chunk is missing.`);
  if (json.asset?.version !== '2.0') throw new Error(`${fileName}: glTF asset.version is not 2.0.`);
  const declaredBin = json.buffers?.[0]?.byteLength ?? 0;
  if (declaredBin > bin.length) throw new Error(`${fileName}: binary chunk is shorter than declared buffer byteLength.`);

  const meshes = json.meshes ?? [];
  let primitiveCount = 0;
  let triangles = 0;
  let vertices = 0;
  let skinnedPrimitiveCount = 0;
  for (const mesh of meshes) {
    for (const primitive of mesh.primitives ?? []) {
      primitiveCount++;
      triangles += countTriangles(primitive, json);
      const position = json.accessors?.[primitive.attributes?.POSITION];
      vertices += position?.count ?? 0;
      if (primitive.attributes?.JOINTS_0 != null || primitive.attributes?.WEIGHTS_0 != null) skinnedPrimitiveCount++;
    }
  }

  const images = (json.images ?? []).map((image, index) => {
    let dimensions = null;
    let imageBytes = 0;
    if (image.bufferView != null) {
      const view = json.bufferViews?.[image.bufferView];
      if (view) {
        const start = view.byteOffset ?? 0;
        const data = bin.subarray(start, start + view.byteLength);
        imageBytes = data.length;
        dimensions = imageDimensions(data);
      }
    } else if (typeof image.uri === 'string' && image.uri.startsWith('data:')) {
      const match = image.uri.match(/^data:([^;,]+)?;base64,(.*)$/s);
      if (match) {
        const data = Buffer.from(match[2], 'base64');
        imageBytes = data.length;
        dimensions = imageDimensions(data);
      }
    }
    return {
      index,
      name: image.name ?? `image-${index + 1}`,
      mimeType: image.mimeType ?? (image.uri?.split('.').pop() || 'unknown'),
      bytes: imageBytes,
      ...dimensions
    };
  });
  const knownCompressedExtensions = new Set([
    'EXT_meshopt_compression', 'KHR_draco_mesh_compression', 'KHR_texture_basisu',
    'EXT_texture_webp', 'EXT_texture_avif', 'KHR_mesh_quantization'
  ]);
  const requiredExtensions = json.extensionsRequired ?? [];
  const unknownRequiredExtensions = requiredExtensions.filter((name) => !knownCompressedExtensions.has(name));
  const externalUris = [];
  for (const buffer of json.buffers ?? []) if (buffer.uri && !buffer.uri.startsWith('data:')) externalUris.push(buffer.uri);
  for (const image of json.images ?? []) if (image.uri && !image.uri.startsWith('data:')) externalUris.push(image.uri);

  const estimatedTextureRgbaBytes = images.reduce((total, image) => total + ((image.width && image.height) ? image.width * image.height * 4 : 0), 0);
  const skins = json.skins ?? [];
  const maxBonesPerSkin = skins.reduce((max, skin) => Math.max(max, skin.joints?.length ?? 0), 0);
  const animationChannels = (json.animations ?? []).reduce((total, animation) => total + (animation.channels?.length ?? 0), 0);
  const maxTextureDimension = images.reduce((max, image) => Math.max(max, image.width ?? 0, image.height ?? 0), 0);
  const warnings = [];
  if (bytes.length > 5 * 1024 * 1024) warnings.push('Large download (>5 MiB): optimize textures and load only when needed.');
  if (triangles > 250_000) warnings.push('High triangle count (>250k): create lower-detail LODs or simplify a copy after visual review.');
  else if (triangles > 100_000) warnings.push('Elevated triangle count (>100k): test on target mobile devices.');
  if (primitiveCount > 60) warnings.push('High primitive count (>60): likely high draw-call cost.');
  else if (primitiveCount > 30) warnings.push('Elevated primitive count (>30): inspect material/mesh batching.');
  if (maxTextureDimension > 2048) warnings.push('Texture dimension exceeds 2048 px: make a smaller NPC/mobile texture variant.');
  if (estimatedTextureRgbaBytes > 64 * 1024 * 1024) warnings.push('Estimated uncompressed texture memory exceeds 64 MiB.');
  if (maxBonesPerSkin > 120) warnings.push('Large skeleton (>120 joints): inspect animation and skinning cost.');
  if (unknownRequiredExtensions.length) warnings.push(`Required extension(s) need explicit runtime support: ${unknownRequiredExtensions.join(', ')}.`);
  if (externalUris.length) warnings.push(`External resource URI(s) found: ${externalUris.join(', ')}.`);

  return {
    file: fileName,
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    glbVersion: version,
    gltfVersion: json.asset.version,
    generator: json.asset.generator ?? null,
    scenes: json.scenes?.length ?? 0,
    nodes: json.nodes?.length ?? 0,
    meshes: meshes.length,
    primitives: primitiveCount,
    vertices,
    triangles,
    materials: json.materials?.length ?? 0,
    textures: json.textures?.length ?? 0,
    images,
    maxTextureDimension,
    estimatedTextureRgbaBytes,
    skins: skins.length,
    maxBonesPerSkin,
    skinnedPrimitives: skinnedPrimitiveCount,
    animations: (json.animations ?? []).length,
    animationChannels,
    morphTargets: meshes.reduce((sum, mesh) => sum + (mesh.primitives ?? []).reduce((pSum, primitive) => pSum + (primitive.targets?.length ?? 0), 0), 0),
    requiredExtensions,
    unknownRequiredExtensions,
    externalUris,
    warnings,
    validGlbContainer: true
  };
}

async function walkGlbFiles(directory) {
  const files = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkGlbFiles(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) files.push(full);
  }
  return files.sort();
}

export async function auditDirectory(inputDirectory) {
  const files = await walkGlbFiles(inputDirectory);
  const results = [];
  for (const file of files) {
    try {
      const bytes = await fs.readFile(file);
      const result = inspectGlbBuffer(bytes, path.relative(inputDirectory, file).split(path.sep).join('/'));
      results.push({ status: 'valid-container', ...result });
    } catch (error) {
      results.push({ file: path.relative(inputDirectory, file).split(path.sep).join('/'), status: 'invalid-or-unreadable', error: error.message });
    }
  }
  const totalBytes = results.reduce((sum, item) => sum + (item.bytes ?? 0), 0);
  return {
    generatedAt: new Date().toISOString(),
    inputDirectory,
    fileCount: files.length,
    validCount: results.filter((item) => item.status === 'valid-container').length,
    invalidCount: results.filter((item) => item.status !== 'valid-container').length,
    totalBytes,
    totalMiB: Number((totalBytes / 1024 / 1024).toFixed(3)),
    results
  };
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = arg('--input', 'public/assets/models');
  const output = arg('--output', 'artifacts/glb-source-audit.json');
  const report = await auditDirectory(input);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Audited ${report.fileCount} GLB files: ${report.validCount} valid containers, ${report.invalidCount} invalid/unreadable. Total ${(report.totalBytes / 1024 / 1024).toFixed(2)} MiB.`);
  if (report.fileCount === 0) process.exitCode = 1;
}
