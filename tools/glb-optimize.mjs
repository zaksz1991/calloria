import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditDirectory, inspectGlbBuffer } from './glb-audit.mjs';

async function walk(directory) {
  const out = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) out.push(full);
  }
  return out.sort();
}

function run(cli, args) {
  const result = spawnSync(cli, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `gltf-transform exited ${result.status}`).trim());
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const inputRoot = arg('--input', 'public/assets/models');
const outputRoot = arg('--output', 'artifacts/optimized/models');
const reportPath = arg('--report', 'artifacts/glb-optimization-report.json');
const cli = arg('--cli', process.env.GLTF_TRANSFORM_BIN || 'gltf-transform');
const minBytes = Number(arg('--min-bytes', '262144'));
const minSavingPercent = Number(arg('--min-saving-percent', '3'));
const originals = await walk(inputRoot);
if (!originals.length) throw new Error(`No .glb files found under ${inputRoot}`);

const rows = [];
for (let index = 0; index < originals.length; index++) {
  const source = originals[index];
  const relative = path.relative(inputRoot, source);
  const target = path.join(outputRoot, relative);
  const temporaryWebp = `${target}.webp-tmp.glb`;
  const temporaryMeshopt = `${target}.meshopt-tmp.glb`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  const sourceBytes = await fs.readFile(source);
  const before = inspectGlbBuffer(sourceBytes, relative);
  let decision = 'copied-original';
  let reason = 'Original preserved; no optimization applied.';
  let outputBytes = sourceBytes;
  let optimizedMetrics = null;
  let optimizationError = null;

  if (sourceBytes.length >= minBytes) {
    try {
      // Conservative pipeline: prune/deduplicate and WebP texture compression,
      // then Meshopt geometry/animation buffer compression. No polygon decimation.
      run(cli, ['optimize', source, temporaryWebp, '--texture-compress', 'webp']);
      run(cli, ['meshopt', temporaryWebp, temporaryMeshopt, '--level', 'medium']);
      const candidate = await fs.readFile(temporaryMeshopt);
      const candidateMetrics = inspectGlbBuffer(candidate, relative);
      const structuralMatch = candidateMetrics.triangles === before.triangles
        && candidateMetrics.primitives === before.primitives
        && candidateMetrics.skins === before.skins
        && candidateMetrics.maxBonesPerSkin === before.maxBonesPerSkin
        && candidateMetrics.animations === before.animations;
      const savingPercent = (1 - candidate.length / sourceBytes.length) * 100;
      if (!structuralMatch) {
        reason = 'Candidate changed structural counts; original retained.';
      } else if (savingPercent < minSavingPercent) {
        reason = `Candidate saved only ${savingPercent.toFixed(1)}%; original retained.`;
      } else {
        outputBytes = candidate;
        decision = 'optimized-copy';
        reason = `Accepted conservative Meshopt + WebP copy (${savingPercent.toFixed(1)}% smaller).`;
        optimizedMetrics = candidateMetrics;
      }
    } catch (error) {
      optimizationError = error.message;
      reason = 'Optimization failed; original retained.';
    } finally {
      await fs.rm(temporaryWebp, { force: true }).catch(() => {});
      await fs.rm(temporaryMeshopt, { force: true }).catch(() => {});
    }
  } else {
    reason = `Skipped below ${minBytes} byte threshold; original retained.`;
  }

  await fs.writeFile(target, outputBytes);
  rows.push({
    file: relative.split(path.sep).join('/'),
    decision,
    reason,
    optimizationError,
    originalBytes: sourceBytes.length,
    outputBytes: outputBytes.length,
    savedBytes: sourceBytes.length - outputBytes.length,
    savedPercent: Number(((1 - outputBytes.length / sourceBytes.length) * 100).toFixed(2)),
    before: {
      triangles: before.triangles,
      vertices: before.vertices,
      primitives: before.primitives,
      materials: before.materials,
      textures: before.textures,
      skins: before.skins,
      maxBonesPerSkin: before.maxBonesPerSkin,
      animations: before.animations,
      maxTextureDimension: before.maxTextureDimension,
      estimatedTextureRgbaBytes: before.estimatedTextureRgbaBytes,
      warnings: before.warnings
    },
    after: optimizedMetrics ? {
      triangles: optimizedMetrics.triangles,
      vertices: optimizedMetrics.vertices,
      primitives: optimizedMetrics.primitives,
      materials: optimizedMetrics.materials,
      textures: optimizedMetrics.textures,
      skins: optimizedMetrics.skins,
      maxBonesPerSkin: optimizedMetrics.maxBonesPerSkin,
      animations: optimizedMetrics.animations,
      maxTextureDimension: optimizedMetrics.maxTextureDimension,
      estimatedTextureRgbaBytes: optimizedMetrics.estimatedTextureRgbaBytes,
      requiredExtensions: optimizedMetrics.requiredExtensions
    } : null
  });
  console.log(`[${index + 1}/${originals.length}] ${relative}: ${decision} — ${reason}`);
}

const originalTotal = rows.reduce((sum, row) => sum + row.originalBytes, 0);
const outputTotal = rows.reduce((sum, row) => sum + row.outputBytes, 0);
const report = {
  generatedAt: new Date().toISOString(),
  inputRoot,
  outputRoot,
  method: 'gltf-transform optimize + Meshopt medium + WebP texture compression; no polygon decimation',
  originalsModified: false,
  fileCount: rows.length,
  originalBytes: originalTotal,
  outputBytes: outputTotal,
  savedBytes: originalTotal - outputTotal,
  savedPercent: Number(((1 - outputTotal / originalTotal) * 100).toFixed(2)),
  results: rows
};
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Completed ${rows.length} files. Overall size: ${(originalTotal / 1048576).toFixed(2)} MiB → ${(outputTotal / 1048576).toFixed(2)} MiB (${report.savedPercent}% saved). Originals were not modified.`);
