import fs from 'node:fs/promises';
import path from 'node:path';

function isSafeRelativeGlb(value) {
  if (typeof value !== 'string' || !value.toLowerCase().endsWith('.glb')) return false;
  const normalized = value.replaceAll('\\', '/');
  return !normalized.startsWith('/') && !normalized.split('/').some((part) => !part || part === '.' || part === '..');
}

export async function promoteOptimizedAssets({
  reportPath = 'artifacts/glb-optimization-report.json',
  optimizedRoot = 'artifacts/optimized/models',
  destinationRoot = 'public/assets/models-optimized'
} = {}) {
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  if (!Array.isArray(report.results)) throw new Error('Optimization report is missing its results array.');

  await fs.rm(destinationRoot, { recursive: true, force: true });
  await fs.mkdir(destinationRoot, { recursive: true });

  const files = {};
  let promotedCount = 0;
  for (const row of report.results) {
    if (row?.decision !== 'optimized-copy') continue;
    if (!isSafeRelativeGlb(row.file)) throw new Error(`Unsafe model path in optimization report: ${String(row.file)}`);

    const source = path.join(optimizedRoot, ...row.file.split('/'));
    const destination = path.join(destinationRoot, ...row.file.split('/'));
    const stat = await fs.stat(source).catch(() => null);
    if (!stat?.isFile() || stat.size < 20) throw new Error(`Optimized GLB is missing or too small: ${row.file}`);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);

    files[row.file] = {
      available: true,
      originalBytes: Number(row.originalBytes) || 0,
      optimizedBytes: stat.size,
      savedBytes: Number(row.savedBytes) || 0,
      savedPercent: Number(row.savedPercent) || 0,
      triangles: Number(row.after?.triangles ?? row.before?.triangles) || 0
    };
    promotedCount += 1;
  }

  // Deliberately deterministic: identical output does not create a needless commit.
  const manifest = {
    schemaVersion: 1,
    optimizer: 'glTF Transform 4.5.0: conservative optimize + Meshopt medium + WebP',
    originalsModified: false,
    optimizedFileCount: promotedCount,
    files
  };
  await fs.writeFile(path.join(destinationRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    promotedCount,
    destinationRoot,
    manifest
  };
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await promoteOptimizedAssets({
    reportPath: arg('--report', 'artifacts/glb-optimization-report.json'),
    optimizedRoot: arg('--input', 'artifacts/optimized/models'),
    destinationRoot: arg('--output', 'public/assets/models-optimized')
  });
  console.log(`Promoted ${result.promotedCount} optimized GLB files. Originals remain untouched.`);
}
