import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promoteOptimizedAssets } from '../tools/promote-glb-optimized-assets.mjs';

test('promoter copies only approved optimized outputs and writes deterministic manifest', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'calloria-glb-promote-'));
  try {
    const reportPath = path.join(root, 'report.json');
    const optimizedRoot = path.join(root, 'optimized');
    const destinationRoot = path.join(root, 'public', 'assets', 'models-optimized');
    await fs.mkdir(path.join(optimizedRoot, 'agents'), { recursive: true });
    await fs.writeFile(path.join(optimizedRoot, 'agents', 'male.glb'), Buffer.alloc(64, 1));
    await fs.writeFile(reportPath, JSON.stringify({ results: [
      { file: 'agents/male.glb', decision: 'optimized-copy', originalBytes: 100, savedBytes: 36, savedPercent: 36, before: { triangles: 123 }, after: { triangles: 123 } },
      { file: 'agents/female.glb', decision: 'copied-original', originalBytes: 100, savedBytes: 0, savedPercent: 0 }
    ] }));
    const result = await promoteOptimizedAssets({ reportPath, optimizedRoot, destinationRoot });
    assert.equal(result.promotedCount, 1);
    assert.equal((await fs.stat(path.join(destinationRoot, 'agents', 'male.glb'))).size, 64);
    await assert.rejects(fs.stat(path.join(destinationRoot, 'agents', 'female.glb')));
    const manifest = JSON.parse(await fs.readFile(path.join(destinationRoot, 'manifest.json'), 'utf8'));
    assert.deepEqual(Object.keys(manifest.files), ['agents/male.glb']);
    assert.equal(manifest.originalsModified, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('promoter rejects path traversal rather than copying outside its asset folder', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'calloria-glb-promote-'));
  try {
    const reportPath = path.join(root, 'report.json');
    await fs.writeFile(reportPath, JSON.stringify({ results: [
      { file: '../escape.glb', decision: 'optimized-copy' }
    ] }));
    await assert.rejects(promoteOptimizedAssets({ reportPath, optimizedRoot: root, destinationRoot: path.join(root, 'out') }), /Unsafe model path/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
