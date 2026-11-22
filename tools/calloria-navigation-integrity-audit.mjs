#!/usr/bin/env node
/**
 * CALLORIA v7.05 navigation integrity audit.
 * Node built-ins only. Runs before Vite to detect broken local routes/assets
 * and mismatches between the home navigation, view metadata and render switch.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_ROOT = process.cwd();

function readText(filePath, label, errors) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch (error) { errors.push(`${label} could not be read: ${error.message}`); return ''; }
}

function parseAttributes(raw) {
  const attrs = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of String(raw).matchAll(pattern)) {
    const key = match[1]?.toLowerCase();
    if (!key || key === '/') continue;
    attrs[key] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

export function extractViteHtmlEntries(viteConfigText) {
  const pattern = /([A-Za-z_$][\w$]*)\s*:\s*resolve\(process\.cwd\(\),\s*['"]([^'"]+\.html)['"]\)/g;
  return [...String(viteConfigText).matchAll(pattern)].map((match) => ({ name: match[1], source: match[2] }));
}

export function extractNavigationContract(indexHtml, mainJs) {
  const navViews = [...String(indexHtml).matchAll(/\bdata-view\s*=\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
  const uniqueNavViews = [...new Set(navViews)];

  const renderStart = String(mainJs).indexOf('function renderView()');
  const configMatch = renderStart >= 0
    ? String(mainJs).slice(renderStart).match(/const\s+config\s*=\s*\{([\s\S]*?)\n\s*\};/)
    : null;
  const configBlock = configMatch?.[1] || '';
  const configViews = [...configBlock.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:\s*\[/gm)].map((match) => match[1]);

  const switchMatchStart = renderStart >= 0
    ? String(mainJs).slice(renderStart).match(/switch\s*\(\s*state\.currentView\s*\)\s*\{/ )
    : null;
  const switchStart = switchMatchStart ? renderStart + switchMatchStart.index : -1;
  const switchTail = switchStart >= 0 ? String(mainJs).slice(switchStart) : '';
  const switchEndMatch = switchTail.match(/\n\s*}\s*\n\s*saveState\(\);/);
  const switchBlock = switchEndMatch ? switchTail.slice(0, switchEndMatch.index) : '';
  const switchViews = [...switchBlock.matchAll(/\bcase\s+['"]([^'"]+)['"]\s*:/g)].map((match) => match[1]);
  const literalAssignments = [...String(mainJs).matchAll(/state\.currentView\s*=\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);

  return {
    navViews: uniqueNavViews,
    configViews: [...new Set(configViews)],
    switchViews: [...new Set(switchViews)],
    literalAssignments: [...new Set(literalAssignments)],
    hasViewRoot: /<[^>]+\bid\s*=\s*['"]viewRoot['"]/i.test(String(indexHtml)),
    mainUsesViewRoot: /const\s+viewRoot\s*=\s*\$\(['"]#viewRoot['"]\)/.test(String(mainJs)),
    mainHasRenderView: renderStart >= 0,
    mainHasNavClickBinding: /closest\(['"]\.nav-item\[data-view\]['"]\)/.test(String(mainJs))
      && /state\.currentView\s*=\s*nav\.dataset\.view/.test(String(mainJs)),
  };
}

function isExternalOrNonRoute(value) {
  const raw = String(value || '').trim();
  return !raw || raw === '#' || raw.startsWith('#') || raw.startsWith('//')
    || /^(?:https?:|mailto:|tel:|sms:|javascript:|data:|blob:|about:)/i.test(raw)
    || raw.includes('${') || raw.includes('{{') || raw.includes('<%');
}

function localTargetsFromHtml(html) {
  const refs = [];
  const tagPattern = /<(a|link|script|img|source|iframe|video|audio|form)\b([^>]*)>/gi;
  for (const match of String(html).matchAll(tagPattern)) {
    const tag = match[1].toLowerCase();
    const attrs = parseAttributes(match[2]);
    const candidates = [];
    if (['a', 'link'].includes(tag) && attrs.href !== undefined) {
      if (tag !== 'link' || /stylesheet|icon|modulepreload|preload|manifest|alternate/i.test(attrs.rel || '')) {
        candidates.push({ kind: tag === 'a' ? 'route' : 'asset', value: attrs.href });
      }
    }
    if (['script', 'img', 'source', 'iframe', 'audio', 'video'].includes(tag) && attrs.src !== undefined) {
      candidates.push({ kind: 'asset', value: attrs.src });
    }
    if (tag === 'video' && attrs.poster !== undefined) candidates.push({ kind: 'asset', value: attrs.poster });
    if (tag === 'form' && attrs.action !== undefined && attrs.action.trim()) candidates.push({ kind: 'route', value: attrs.action });
    for (const candidate of candidates) {
      if (!isExternalOrNonRoute(candidate.value)) refs.push({ ...candidate, tag, targetBlank: attrs.target === '_blank', rel: attrs.rel || '' });
    }
  }
  return refs;
}

function cleanPathname(urlPath) {
  let decoded = urlPath;
  try { decoded = decodeURIComponent(urlPath); } catch { /* retain encoded path; it will fail visibly if absent */ }
  return decoded.replaceAll('\\', '/');
}

function resolveLocalReference({ root, htmlEntry, value, kind, cleanUrls }) {
  let url;
  try { url = new URL(String(value), `https://calloria.local/${htmlEntry.replace(/^\//, '')}`); }
  catch { return { ok: false, reason: `invalid local URL ${value}` }; }
  if (url.origin !== 'https://calloria.local') return { ok: true, external: true };
  let pathname = cleanPathname(url.pathname);
  if (!pathname || pathname === '/') pathname = '/index.html';
  const fromRoot = pathname.replace(/^\/+/, '');
  const candidates = [];
  const add = (candidate) => { if (!candidates.includes(candidate)) candidates.push(candidate); };
  add(path.resolve(root, fromRoot));
  add(path.resolve(root, 'public', fromRoot));

  if (kind === 'route' && cleanUrls && !path.extname(pathname)) {
    const htmlAlias = `${fromRoot}.html`;
    add(path.resolve(root, htmlAlias));
    add(path.resolve(root, 'public', htmlAlias));
    if (pathname.endsWith('/')) {
      add(path.resolve(root, fromRoot, 'index.html'));
      add(path.resolve(root, 'public', fromRoot, 'index.html'));
    }
  }

  const safeCandidates = candidates.filter((candidate) => {
    const relRoot = path.relative(root, candidate);
    return relRoot && !relRoot.startsWith('..') && !path.isAbsolute(relRoot);
  });
  const found = safeCandidates.find((candidate) => {
    try { return fs.statSync(candidate).isFile(); } catch { return false; }
  });
  if (found) return { ok: true, resolved: path.relative(root, found).split(path.sep).join('/') };
  return { ok: false, reason: `${kind} ${value} from ${htmlEntry} did not resolve to a local file${cleanUrls && kind === 'route' ? ' (including Vercel clean-URL .html mapping)' : ''}` };
}

export function auditCalloriaNavigation({ root = DEFAULT_ROOT } = {}) {
  const projectRoot = path.resolve(root);
  const errors = [];
  const warnings = [];
  const viteConfig = readText(path.join(projectRoot, 'vite.config.js'), 'vite.config.js', errors);
  const vercelText = readText(path.join(projectRoot, 'vercel.json'), 'vercel.json', errors);
  let vercel = {};
  try { vercel = JSON.parse(vercelText); } catch (error) { errors.push(`vercel.json is invalid JSON: ${error.message}`); }
  const cleanUrls = vercel.cleanUrls === true;
  const htmlEntries = extractViteHtmlEntries(viteConfig);
  if (!htmlEntries.length) errors.push('No configured HTML entries were found in vite.config.js.');

  const pageContents = new Map();
  for (const entry of htmlEntries) {
    const absolute = path.resolve(projectRoot, entry.source);
    const relative = path.relative(projectRoot, absolute);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      errors.push(`Unsafe Vite HTML entry path: ${entry.source}`);
      continue;
    }
    if (!fs.existsSync(absolute)) {
      errors.push(`Missing configured HTML page: ${entry.source}`);
      continue;
    }
    pageContents.set(entry.source, readText(absolute, entry.source, errors));
  }

  const indexHtml = pageContents.get('index.html') || '';
  const mainJs = readText(path.join(projectRoot, 'js/main.js'), 'js/main.js', errors);
  const contract = extractNavigationContract(indexHtml, mainJs);
  if (!contract.hasViewRoot) errors.push('index.html is missing the #viewRoot render container.');
  if (!contract.mainUsesViewRoot) errors.push('js/main.js no longer binds its renderer to #viewRoot.');
  if (!contract.mainHasRenderView) errors.push('js/main.js is missing renderView().');
  if (!contract.mainHasNavClickBinding) errors.push('js/main.js is missing the delegated data-view navigation handler.');
  const configSet = new Set(contract.configViews);
  const switchSet = new Set(contract.switchViews);
  for (const view of contract.navViews) {
    if (!configSet.has(view)) errors.push(`Home navigation view "${view}" has no renderView() page metadata entry.`);
    if (!switchSet.has(view)) errors.push(`Home navigation view "${view}" has no renderView() switch case.`);
  }
  for (const view of contract.configViews) {
    if (!switchSet.has(view)) errors.push(`renderView() metadata view "${view}" has no switch case.`);
  }
  for (const view of contract.switchViews) {
    if (!configSet.has(view)) errors.push(`renderView() switch case "${view}" has no page metadata entry.`);
  }
  for (const view of contract.literalAssignments) {
    if (!configSet.has(view) || !switchSet.has(view)) errors.push(`js/main.js assigns unknown currentView "${view}".`);
  }

  const brokenReferences = [];
  const checked = new Set();
  for (const [htmlEntry, html] of pageContents) {
    for (const ref of localTargetsFromHtml(html)) {
      const key = `${htmlEntry}\n${ref.kind}\n${ref.value}`;
      if (checked.has(key)) continue;
      checked.add(key);
      const resolved = resolveLocalReference({ root: projectRoot, htmlEntry, value: ref.value, kind: ref.kind, cleanUrls });
      if (!resolved.ok) brokenReferences.push({ page: htmlEntry, tag: ref.tag, value: ref.value, reason: resolved.reason });
      if (ref.targetBlank && !/\bnoopener\b/i.test(ref.rel) && /^https?:/i.test(ref.value)) {
        warnings.push(`${htmlEntry} opens ${ref.value} in a new tab without rel="noopener".`);
      }
    }
  }
  for (const item of brokenReferences) errors.push(item.reason);

  return {
    ok: errors.length === 0,
    root: projectRoot,
    cleanUrls,
    htmlEntries: [...pageContents.keys()],
    navigation: {
      navViews: contract.navViews,
      configViews: contract.configViews,
      switchViews: contract.switchViews,
      literalAssignments: contract.literalAssignments,
    },
    checkedLocalReferences: checked.size,
    brokenReferences,
    errors,
    warnings,
  };
}

function runCli() {
  const report = auditCalloriaNavigation();
  if (report.ok) {
    console.log(`CALLORIA navigation audit passed: ${report.htmlEntries.length} Vite pages, ${report.navigation.navViews.length} home views, ${report.checkedLocalReferences} local references, and the render metadata/switch contract are consistent.`);
  } else {
    console.error(`CALLORIA navigation audit failed (${report.errors.length} issue${report.errors.length === 1 ? '' : 's'}):`);
    for (const error of report.errors) console.error(`- ${error}`);
  }
  for (const warning of report.warnings) console.warn(`CALLORIA navigation audit warning: ${warning}`);
  if (!report.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('calloria-navigation-integrity-audit.mjs')) runCli();
