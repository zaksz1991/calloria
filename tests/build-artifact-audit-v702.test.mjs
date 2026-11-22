import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditCalloriaBuildArtifacts } from '../tools/calloria-build-artifact-audit.mjs';

function write(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function fixture({ unavailable = 0 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-artifact-audit-'));
  write(root, 'vite.config.js', [
    "import { resolve } from 'node:path';",
    'export default { build: { rollupOptions: { input: {',
    "main: resolve(process.cwd(), 'index.html'),",
    "customerCare: resolve(process.cwd(), 'customer-care.html'),",
    "calloriaChatWidget: resolve(process.cwd(), 'widgets/calloria-chat.js')",
    '} } } };'
  ].join('\n'));
  write(root, 'vercel.json', JSON.stringify({ installCommand: 'npm install', buildCommand: 'npm run build', outputDirectory: 'dist' }));
  write(root, 'index.html', '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"><link rel="icon" href="/icon.svg"></head><body><script src="/boot.js"></script></body></html>');
  write(root, 'customer-care.html', '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head><body><img src="/img/card.svg"></body></html>');
  write(root, 'widgets/calloria-chat.js', 'export {}');
  write(root, 'dist/index.html', '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"><link rel="icon" href="/icon.svg"></head><body><script src="/boot.js"></script></body></html>');
  write(root, 'dist/customer-care.html', '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head><body><img src="/img/card.svg"></body></html>');
  write(root, 'dist/styles.css', 'body{margin:0}');
  write(root, 'dist/icon.svg', '<svg/>');
  write(root, 'dist/boot.js', 'console.log("CALLORIA")');
  write(root, 'dist/img/card.svg', '<svg/>');
  write(root, 'dist/widgets/calloria-chat.js', 'export {};');
  write(root, 'dist/calloria-staff-glb-diagnostics.html', '<!doctype html>');
  write(root, 'dist/calloria-staff-glb-diagnostics.json', JSON.stringify({ schemaVersion: 1, product: 'CALLORIA', assets: Array.from({ length: 5 }, (_, index) => ({ id: `staff-${index}` })) }));
  const models = Array.from({ length: 5 }, (_, index) => {
    const isUnavailable = index >= 5 - unavailable;
    const relative = `assets/models/agent-${index}.glb`;
    if (!isUnavailable) write(root, `dist/${relative}`, Buffer.concat([Buffer.from('glTF'), Buffer.from([2, 0, 0, 0])]));
    return { id: `staff-${index}`, status: isUnavailable ? 'unavailable' : 'validated-existing', output: `/assets/models/agent-${index}.glb` };
  });
  write(root, 'dist/assets/models/calloria-cc0-staff-manifest.json', JSON.stringify({
    schemaVersion: 2,
    status: unavailable ? 'partial' : 'complete',
    validatedStaffModels: 5 - unavailable,
    failedStaffModels: unavailable,
    models
  }));
  return root;
}

test('accepts a complete multi-page build with all local references and diagnostics', () => {
  const root = fixture();
  try {
    const result = auditCalloriaBuildArtifacts({ root });
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(result.htmlEntries.length, 2);
    assert.equal(result.staffModels.bundled, 5);
    assert.ok(result.checkedHtmlReferences.includes('styles.css'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fails when a configured HTML page is missing from dist', () => {
  const root = fixture();
  try {
    fs.rmSync(path.join(root, 'dist/customer-care.html'));
    const result = auditCalloriaBuildArtifacts({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(' '), /Built entry customerCare/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fails when a built HTML page references a missing local stylesheet or script', () => {
  const root = fixture();
  try {
    fs.rmSync(path.join(root, 'dist/styles.css'));
    const result = auditCalloriaBuildArtifacts({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(' '), /Local HTML asset reference \/styles\.css/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fails on a broken Vercel output directory contract', () => {
  const root = fixture();
  try {
    write(root, 'vercel.json', JSON.stringify({ installCommand: 'npm install', buildCommand: 'npm run build', outputDirectory: 'build' }));
    const result = auditCalloriaBuildArtifacts({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(' '), /outputDirectory must be "dist"/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('accepts unavailable optional CC0 models as warnings when fallback manifest remains valid', () => {
  const root = fixture({ unavailable: 2 });
  try {
    const result = auditCalloriaBuildArtifacts({ root });
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(result.staffModels.bundled, 3);
    assert.equal(result.warnings.length, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fails when an available GLB output does not contain the GLB magic header', () => {
  const root = fixture();
  try {
    write(root, 'dist/assets/models/agent-0.glb', 'not-a-glb');
    const result = auditCalloriaBuildArtifacts({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(' '), /does not begin with the GLB magic header/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fails when generated staff diagnostics JSON has an unexpected schema', () => {
  const root = fixture();
  try {
    write(root, 'dist/calloria-staff-glb-diagnostics.json', JSON.stringify({ schemaVersion: 9, product: 'OTHER', assets: [] }));
    const result = auditCalloriaBuildArtifacts({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(' '), /unexpected schema or product identifier/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
