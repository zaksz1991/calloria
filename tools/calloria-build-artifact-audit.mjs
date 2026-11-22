#!/usr/bin/env node
/**
 * CALLORIA v7.02 post-build artifact audit.
 * Uses Node.js built-ins only. Runs after Vite and before Vercel deploys dist/.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_ROOT = process.cwd();
const EXPECTED_DIAGNOSTICS_HTML = 'calloria-staff-glb-diagnostics.html';
const EXPECTED_DIAGNOSTICS_JSON = 'calloria-staff-glb-diagnostics.json';
const EXPECTED_STAFF_MANIFEST = 'assets/models/calloria-cc0-staff-manifest.json';
const EXPECTED_STAFF_MODELS = 5;
const WIDGET_OUTPUT = 'widgets/calloria-chat.js';

function safeRelative(root, absolutePath) {
  const relative = path.relative(root, absolutePath).split(path.sep).join('/');
  if (!relative || relative === '.' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes the project root: ${absolutePath}`);
  }
  return relative;
}

function readJson(filePath, label, errors) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${label} is missing or invalid JSON: ${String(error?.message || error)}`);
    return null;
  }
}

function requireOutput(distRoot, relativePath, errors, label = relativePath) {
  const normalized = String(relativePath || '').replaceAll('\\', '/').replace(/^\/+/, '');
  const absolute = path.resolve(distRoot, normalized);
  const relative = path.relative(distRoot, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    errors.push(`${label} resolves outside dist/: ${relativePath}`);
    return null;
  }
  try {
    const stat = fs.statSync(absolute);
    if (!stat.isFile()) {
      errors.push(`${label} is not a file: dist/${normalized}`);
      return null;
    }
    if (stat.size <= 0) {
      errors.push(`${label} is empty: dist/${normalized}`);
      return null;
    }
    return { absolute, relative: normalized, size: stat.size };
  } catch {
    errors.push(`Missing ${label}: dist/${normalized}`);
    return null;
  }
}

function extractViteEntries(viteConfigText) {
  const pattern = /([A-Za-z_$][\w$]*)\s*:\s*resolve\(process\.cwd\(\),\s*['"]([^'"]+)['"]\)/g;
  return [...String(viteConfigText).matchAll(pattern)].map((match) => ({ name: match[1], source: match[2] }));
}

function expectedBuiltEntry(entry, root) {
  const source = path.resolve(root, entry.source);
  const sourceRelative = safeRelative(root, source);
  if (entry.name === 'calloriaChatWidget') return WIDGET_OUTPUT;
  if (path.extname(sourceRelative).toLowerCase() === '.html') return sourceRelative;
  return null; // Other JS chunks are content-hashed by Vite; their presence is checked through HTML references.
}

function collectLocalHtmlReferences(html) {
  const refs = [];
  const tagPattern = /<(script|link|img|source)\b([^>]*)>/gi;
  for (const match of String(html).matchAll(tagPattern)) {
    const tag = match[1].toLowerCase();
    const attributes = match[2];
    const rel = (attributes.match(/\brel\s*=\s*['"]([^'"]+)['"]/i)?.[1] || '').toLowerCase();
    let attribute = null;
    if (tag === 'script' || tag === 'img' || tag === 'source') attribute = 'src';
    if (tag === 'link' && /stylesheet|icon|modulepreload|preload/.test(rel)) attribute = 'href';
    if (!attribute) continue;
    const value = attributes.match(new RegExp(`\\b${attribute}\\s*=\\s*['"]([^'"]+)['"]`, 'i'))?.[1];
    if (!value || !value.startsWith('/') || value.startsWith('//')) continue;
    refs.push(value);
  }
  return refs;
}

function normalizedPublicReference(reference) {
  const withoutSuffix = String(reference).split(/[?#]/, 1)[0];
  let decoded = withoutSuffix;
  try { decoded = decodeURIComponent(withoutSuffix); } catch { /* invalid escapes are caught by lookup */ }
  return decoded.replace(/^\/+/, '');
}

function auditHtmlReferences(distRoot, htmlEntries, errors) {
  const checked = new Set();
  for (const htmlPath of htmlEntries) {
    const absolute = path.join(distRoot, htmlPath);
    let html;
    try { html = fs.readFileSync(absolute, 'utf8'); }
    catch { continue; }
    for (const reference of collectLocalHtmlReferences(html)) {
      const relative = normalizedPublicReference(reference);
      if (!relative || checked.has(relative)) continue;
      checked.add(relative);
      requireOutput(distRoot, relative, errors, `Local HTML asset reference ${reference} in ${htmlPath}`);
    }
  }
  return [...checked];
}

function auditStaffManifest(distRoot, errors, warnings) {
  const file = requireOutput(distRoot, EXPECTED_STAFF_MANIFEST, errors, 'Generated staff GLB manifest');
  if (!file) return { bundled: 0, expected: EXPECTED_STAFF_MODELS };
  const manifest = readJson(file.absolute, 'Generated staff GLB manifest', errors);
  if (!manifest) return { bundled: 0, expected: EXPECTED_STAFF_MODELS };
  if (manifest.schemaVersion !== 2) errors.push(`Staff GLB manifest schemaVersion must be 2; found ${manifest.schemaVersion ?? 'missing'}.`);
  if (!Array.isArray(manifest.models) || manifest.models.length !== EXPECTED_STAFF_MODELS) {
    errors.push(`Staff GLB manifest must list ${EXPECTED_STAFF_MODELS} models; found ${Array.isArray(manifest.models) ? manifest.models.length : 'no models array'}.`);
    return { bundled: 0, expected: EXPECTED_STAFF_MODELS };
  }
  const unavailable = manifest.models.filter((model) => model?.status === 'unavailable');
  const bundled = manifest.models.filter((model) => model?.status !== 'unavailable');
  if (Number(manifest.validatedStaffModels) !== bundled.length) {
    errors.push(`Staff GLB manifest validatedStaffModels (${manifest.validatedStaffModels}) does not match non-unavailable model count (${bundled.length}).`);
  }
  if (Number(manifest.failedStaffModels) !== unavailable.length) {
    errors.push(`Staff GLB manifest failedStaffModels (${manifest.failedStaffModels}) does not match unavailable model count (${unavailable.length}).`);
  }
  for (const model of bundled) {
    const output = String(model?.output || '');
    if (!output.startsWith('/assets/models/')) {
      errors.push(`Validated staff model ${model?.id || '(unknown)'} has an unsafe or missing output path.`);
      continue;
    }
    const relative = normalizedPublicReference(output);
    const fileInfo = requireOutput(distRoot, relative, errors, `Validated staff GLB ${model?.id || relative}`);
    if (!fileInfo) continue;
    const fd = fs.openSync(fileInfo.absolute, 'r');
    try {
      const header = Buffer.alloc(4);
      const bytesRead = fs.readSync(fd, header, 0, 4, 0);
      if (bytesRead !== 4 || header.toString('ascii') !== 'glTF') {
        errors.push(`Validated staff model ${model?.id || relative} does not begin with the GLB magic header.`);
      }
    } finally { fs.closeSync(fd); }
  }
  if (unavailable.length) {
    warnings.push(`${unavailable.length}/${EXPECTED_STAFF_MODELS} optional CC0 staff models were unavailable during build; fallback staff remain available. Inspect /${EXPECTED_DIAGNOSTICS_HTML} after deployment.`);
  }
  return { bundled: bundled.length, expected: EXPECTED_STAFF_MODELS };
}

export function auditCalloriaBuildArtifacts({ root = DEFAULT_ROOT, dist = 'dist' } = {}) {
  const projectRoot = path.resolve(root);
  const distRoot = path.resolve(projectRoot, dist);
  const errors = [];
  const warnings = [];
  const viteConfigPath = path.join(projectRoot, 'vite.config.js');
  let viteConfig = '';
  try { viteConfig = fs.readFileSync(viteConfigPath, 'utf8'); }
  catch { errors.push('vite.config.js is missing; cannot derive the production entry-point contract.'); }

  const entries = extractViteEntries(viteConfig);
  if (!entries.length) errors.push('No configured Rollup input entries were found in vite.config.js.');
  const builtHtml = [];
  for (const entry of entries) {
    const expected = expectedBuiltEntry(entry, projectRoot);
    if (!expected) continue;
    const found = requireOutput(distRoot, expected, errors, `Built entry ${entry.name} (${entry.source})`);
    if (found && expected.toLowerCase().endsWith('.html')) builtHtml.push(expected);
  }
  if (!entries.some((entry) => entry.name === 'calloriaChatWidget')) {
    warnings.push('The known calloriaChatWidget entry is not configured; verify whether that widget was intentionally removed.');
  } else {
    requireOutput(distRoot, WIDGET_OUTPUT, errors, 'Public CALLORIA chat widget bundle');
  }

  for (const generated of [EXPECTED_DIAGNOSTICS_HTML, EXPECTED_DIAGNOSTICS_JSON]) {
    requireOutput(distRoot, generated, errors, `Generated GLB diagnostics artifact (${generated})`);
  }
  const diagnosticsJsonPath = path.join(distRoot, EXPECTED_DIAGNOSTICS_JSON);
  if (fs.existsSync(diagnosticsJsonPath)) {
    const diagnostics = readJson(diagnosticsJsonPath, 'Generated GLB diagnostics JSON', errors);
    if (diagnostics) {
      if (diagnostics.schemaVersion !== 1 || diagnostics.product !== 'CALLORIA') {
        errors.push('Generated GLB diagnostics JSON has an unexpected schema or product identifier.');
      }
      if (!Array.isArray(diagnostics.assets) || diagnostics.assets.length !== EXPECTED_STAFF_MODELS) {
        errors.push(`Generated GLB diagnostics JSON must describe ${EXPECTED_STAFF_MODELS} staff assets.`);
      }
    }
  }
  const staffSummary = auditStaffManifest(distRoot, errors, warnings);
  const checkedReferences = auditHtmlReferences(distRoot, builtHtml, errors);

  const vercelConfigPath = path.join(projectRoot, 'vercel.json');
  const vercel = readJson(vercelConfigPath, 'vercel.json', errors);
  if (vercel) {
    if (vercel.buildCommand !== 'npm run build') errors.push(`vercel.json buildCommand must be "npm run build"; found ${vercel.buildCommand ?? 'missing'}.`);
    if (vercel.outputDirectory !== dist) errors.push(`vercel.json outputDirectory must be "${dist}"; found ${vercel.outputDirectory ?? 'missing'}.`);
  }

  return {
    ok: errors.length === 0,
    projectRoot,
    distRoot,
    htmlEntries: builtHtml,
    sourceEntries: entries.length,
    checkedHtmlReferences: checkedReferences,
    staffModels: staffSummary,
    errors,
    warnings
  };
}

function runCli() {
  const report = auditCalloriaBuildArtifacts();
  if (report.ok) {
    console.log(`CALLORIA post-build audit passed: ${report.htmlEntries.length} HTML entries, ${report.checkedHtmlReferences.length} local HTML assets, ${report.staffModels.bundled}/${report.staffModels.expected} validated staff GLBs, and Vercel output settings are consistent.`);
  } else {
    console.error(`CALLORIA post-build audit failed (${report.errors.length} issue${report.errors.length === 1 ? '' : 's'}):`);
    for (const error of report.errors) console.error(`- ${error}`);
  }
  for (const warning of report.warnings) console.warn(`CALLORIA post-build warning: ${warning}`);
  if (!report.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('calloria-build-artifact-audit.mjs')) {
  runCli();
}
